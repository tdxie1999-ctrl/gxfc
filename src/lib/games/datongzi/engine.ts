import {
  createStandardDeck,
  shuffleDeck,
  sortCards,
  type PaodekuaiCard,
} from '@/lib/games/paodekuai/cards';
import {
  canBeatDatongzi,
  findDatongziPlayableHands,
  getDatongziPattern,
  type DatongziPatternResult,
  type DatongziPlay,
} from '@/lib/games/datongzi/rules';

export interface DatongziPlayer {
  userId: string;
  nickname: string;
  isBot: boolean;
  hand: PaodekuaiCard[];
  xi: number;
  score: number;
  playedPatterns: DatongziPatternResult[];
}

export interface DatongziConfig {
  handCardCount: number;
  basePoint: number;
  autoPlaySeconds: number;
}

export interface DatongziSettlement {
  winnerIndex: number;
  totalXi: number;
  bottomBonusXi: number;
  winnerGain: number;
  deltas: number[];
  summary: string;
}

export interface DatongziGameState {
  players: DatongziPlayer[];
  lastPlay: DatongziPlay | null;
  currentPlayerIndex: number;
  passCount: number;
  gamePhase: 'dealing' | 'playing' | 'finished';
  config: DatongziConfig;
  bottomCards: PaodekuaiCard[];
  lastAction: string;
  winnerIndex: number | null;
  settlement: DatongziSettlement | null;
}

function clonePattern(pattern: DatongziPatternResult): DatongziPatternResult {
  return {
    ...pattern,
    cards: pattern.cards.map((card) => ({ ...card })),
  };
}

export class DatongziEngine {
  players: DatongziPlayer[] = [];

  lastPlay: DatongziPlay | null = null;

  currentPlayerIndex = 0;

  passCount = 0;

  gamePhase: 'dealing' | 'playing' | 'finished' = 'dealing';

  bottomCards: PaodekuaiCard[] = [];

  lastAction = '等待发牌';

  winnerIndex: number | null = null;

  settlement: DatongziSettlement | null = null;

  config: DatongziConfig;

  constructor(config?: Partial<DatongziConfig>) {
    this.config = {
      handCardCount: 24,
      basePoint: 2,
      autoPlaySeconds: 8,
      ...config,
    };
  }

  initialize(
    playerCount = 2,
    playerSeeds?: Array<{ userId: string; nickname: string; isBot: boolean }>,
  ) {
    const safeCount = Math.max(2, Math.min(2, playerCount));

    this.players = Array.from({ length: safeCount }, (_, index) => {
      const seed = playerSeeds?.[index];

      return {
        userId: seed?.userId ?? `dtz-player-${index + 1}`,
        nickname: seed?.nickname ?? `玩家${index + 1}`,
        isBot: seed?.isBot ?? index !== 0,
        hand: [],
        xi: 0,
        score: 0,
        playedPatterns: [],
      };
    });
    this.lastPlay = null;
    this.currentPlayerIndex = 0;
    this.passCount = 0;
    this.gamePhase = 'dealing';
    this.bottomCards = [];
    this.lastAction = '等待发牌';
    this.winnerIndex = null;
    this.settlement = null;
  }

  deal() {
    if (this.players.length === 0) {
      this.initialize();
    }

    const deck = shuffleDeck(createStandardDeck());
    const maxHandCount = Math.floor(deck.length / this.players.length);
    const handCardCount = Math.max(8, Math.min(this.config.handCardCount, maxHandCount));

    this.players = this.players.map((player, index) => {
      const start = index * handCardCount;
      const end = start + handCardCount;

      return {
        ...player,
        hand: sortCards(deck.slice(start, end)),
        xi: 0,
        playedPatterns: [],
      };
    });

    this.bottomCards = deck.slice(handCardCount * this.players.length);
    this.lastPlay = null;
    this.passCount = 0;
    this.gamePhase = 'playing';
    this.winnerIndex = null;
    this.settlement = null;

    const firstPlayer = this.findOpeningPlayerIndex();
    this.currentPlayerIndex = firstPlayer;
    this.lastAction = `${this.players[firstPlayer]?.nickname ?? '玩家'} 先手`;
  }

  getState(): DatongziGameState {
    return {
      players: this.players.map((player) => ({
        ...player,
        hand: player.hand.map((card) => ({ ...card })),
        playedPatterns: player.playedPatterns.map(clonePattern),
      })),
      lastPlay: this.lastPlay
        ? {
            cards: this.lastPlay.cards.map((card) => ({ ...card })),
            playerIndex: this.lastPlay.playerIndex,
            pattern: clonePattern(this.lastPlay.pattern),
          }
        : null,
      currentPlayerIndex: this.currentPlayerIndex,
      passCount: this.passCount,
      gamePhase: this.gamePhase,
      config: { ...this.config },
      bottomCards: this.bottomCards.map((card) => ({ ...card })),
      lastAction: this.lastAction,
      winnerIndex: this.winnerIndex,
      settlement: this.settlement ? { ...this.settlement, deltas: [...this.settlement.deltas] } : null,
    };
  }

  getPlayableHands(playerIndex: number): PaodekuaiCard[][] {
    const player = this.players[playerIndex];

    if (!player) {
      return [];
    }

    const previous =
      this.lastPlay && this.lastPlay.playerIndex !== playerIndex ? this.lastPlay : null;

    return findDatongziPlayableHands(player.hand, previous);
  }

  getHint(playerIndex: number): PaodekuaiCard[] {
    return this.getPlayableHands(playerIndex)[0] ?? [];
  }

  playCards(playerIndex: number, cardIds: number[]): boolean {
    if (this.gamePhase !== 'playing' || playerIndex !== this.currentPlayerIndex) {
      return false;
    }

    const player = this.players[playerIndex];

    if (!player) {
      return false;
    }

    const selected = player.hand.filter((card) => cardIds.includes(card.id));
    if (selected.length !== cardIds.length) {
      return false;
    }

    const pattern = getDatongziPattern(selected);

    if (!pattern) {
      return false;
    }

    if (
      this.lastPlay &&
      this.lastPlay.playerIndex !== playerIndex &&
      !canBeatDatongzi(pattern, this.lastPlay.pattern)
    ) {
      return false;
    }

    this.players[playerIndex] = {
      ...player,
      hand: sortCards(player.hand.filter((card) => !cardIds.includes(card.id))),
      xi: player.xi + pattern.xi,
      playedPatterns: [...player.playedPatterns, pattern],
    };

    this.lastPlay = {
      cards: sortCards(selected),
      playerIndex,
      pattern,
    };
    this.passCount = 0;
    this.lastAction = `${player.nickname} 出 ${pattern.label}（${selected
      .map((card) => card.label)
      .join(' ')}）`;

    if (this.players[playerIndex].hand.length === 0) {
      this.finishRound(playerIndex);
      return true;
    }

    this.currentPlayerIndex = this.getNextPlayerIndex(playerIndex);
    return true;
  }

  pass(playerIndex: number): boolean {
    if (
      this.gamePhase !== 'playing' ||
      playerIndex !== this.currentPlayerIndex ||
      !this.lastPlay ||
      this.lastPlay.playerIndex === playerIndex
    ) {
      return false;
    }

    const player = this.players[playerIndex];

    if (!player) {
      return false;
    }

    this.passCount += 1;

    if (this.passCount >= this.players.length - 1) {
      const roundWinner = this.lastPlay.playerIndex;
      const winnerName = this.players[roundWinner]?.nickname ?? '玩家';
      this.lastPlay = null;
      this.passCount = 0;
      this.currentPlayerIndex = roundWinner;
      this.lastAction = `${player.nickname} 过牌，${winnerName} 重新领出`;
      return true;
    }

    this.currentPlayerIndex = this.getNextPlayerIndex(playerIndex);
    this.lastAction = `${player.nickname} 选择过牌`;
    return true;
  }

  private calculateScore(): DatongziSettlement {
    if (this.winnerIndex === null) {
      return {
        winnerIndex: 0,
        totalXi: 0,
        bottomBonusXi: 0,
        winnerGain: 0,
        deltas: this.players.map(() => 0),
        summary: '本局尚未结束',
      };
    }

    const winner = this.players[this.winnerIndex];
    const bottomBonusXi = this.bottomCards.length > 0 ? Math.max(1, Math.floor(this.bottomCards.length / 3)) : 0;
    const totalXi = Math.max(1, winner.xi + bottomBonusXi);

    const deltas = this.players.map((player, index) => {
      if (index === this.winnerIndex) {
        return 0;
      }

      const handPenalty = player.hand.length * this.config.basePoint;
      const xiPenalty = totalXi * this.config.basePoint;
      return -(handPenalty + xiPenalty);
    });

    const winnerGain = Math.abs(deltas.reduce((sum, value) => sum + value, 0));
    deltas[this.winnerIndex] = winnerGain;

    return {
      winnerIndex: this.winnerIndex,
      totalXi,
      bottomBonusXi,
      winnerGain,
      deltas,
      summary: `${winner.nickname} 收下 ${totalXi} 喜，净赢 ${winnerGain} 分`,
    };
  }

  private finishRound(winnerIndex: number) {
    this.gamePhase = 'finished';
    this.winnerIndex = winnerIndex;
    this.currentPlayerIndex = winnerIndex;
    this.settlement = this.calculateScore();
    this.players = this.players.map((player, index) => ({
      ...player,
      score: player.score + (this.settlement?.deltas[index] ?? 0),
    }));
    this.lastAction = this.settlement.summary;
  }

  private getNextPlayerIndex(current: number): number {
    return (current + 1) % this.players.length;
  }

  private findOpeningPlayerIndex(): number {
    let bestIndex = 0;
    let bestCard = this.players[0]?.hand[0] ?? null;

    for (let index = 1; index < this.players.length; index += 1) {
      const currentCard = this.players[index]?.hand[0];

      if (!currentCard) {
        continue;
      }

      if (!bestCard || currentCard.value < bestCard.value) {
        bestCard = currentCard;
        bestIndex = index;
      }
    }

    return bestIndex;
  }
}

export function createDatongziEngine(config?: Partial<DatongziConfig>) {
  return new DatongziEngine(config);
}
