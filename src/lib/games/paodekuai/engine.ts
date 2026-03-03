import {
  buildPaodekuaiDeck,
  cloneCard,
  sortCards,
  type PaodekuaiCard,
} from '@/lib/games/paodekuai/cards';
import {
  canBeat,
  findPlayableHands,
  getCardPattern,
  type CardPlay,
  type CardPatternResult,
} from '@/lib/games/paodekuai/rules';

export interface PaodekuaiPlayer {
  userId: string;
  nickname: string;
  isBot: boolean;
  hand: PaodekuaiCard[];
  score: number;
  hasPlayedAny: boolean;
}

export interface SettlementResult {
  winnerIndex: number;
  spring: boolean;
  rakeAmount: number;
  winnerGain: number;
  deltas: number[];
  summary: string;
}

export interface PaodekuaiConfig {
  cardCount: number;
  fourWithThree: boolean;
  heartsTenDouble: boolean;
  smallJokerDouble: boolean;
  autoPlaySeconds: number;
  doubleThreshold: number;
  basePoint: number;
  rakePercent: number;
}

export interface PaodekuaiGameState {
  players: PaodekuaiPlayer[];
  lastPlay: CardPlay | null;
  currentPlayerIndex: number;
  passCount: number;
  gamePhase: 'dealing' | 'playing' | 'finished';
  config: PaodekuaiConfig;
  deckRemainder: PaodekuaiCard[];
  lastAction: string;
  winnerIndex: number | null;
  settlement: SettlementResult | null;
}

export class PaodekuaiEngine {
  players: PaodekuaiPlayer[] = [];

  lastPlay: CardPlay | null = null;

  currentPlayerIndex = 0;

  passCount = 0;

  gamePhase: 'dealing' | 'playing' | 'finished' = 'dealing';

  deckRemainder: PaodekuaiCard[] = [];

  lastAction = '等待发牌';

  winnerIndex: number | null = null;

  settlement: SettlementResult | null = null;

  config: PaodekuaiConfig;

  constructor(config?: Partial<PaodekuaiConfig>) {
    this.config = {
      cardCount: 16,
      fourWithThree: true,
      heartsTenDouble: true,
      smallJokerDouble: true,
      autoPlaySeconds: 12,
      doubleThreshold: 10,
      basePoint: 1,
      rakePercent: 5,
      ...config,
    };
  }

  initialize(
    playerCount = 3,
    playerSeeds?: Array<{ userId: string; nickname: string; isBot: boolean }>,
  ) {
    this.players = Array.from({ length: playerCount }, (_, index) => {
      const seed = playerSeeds?.[index];
      return {
        userId: seed?.userId ?? `pk-player-${index + 1}`,
        nickname: seed?.nickname ?? `玩家${index + 1}`,
        isBot: seed?.isBot ?? index !== 0,
        hand: [],
        score: 0,
        hasPlayedAny: false,
      };
    });
    this.gamePhase = 'dealing';
    this.lastPlay = null;
    this.currentPlayerIndex = 0;
    this.passCount = 0;
    this.deckRemainder = [];
    this.lastAction = '等待发牌';
    this.winnerIndex = null;
    this.settlement = null;
  }

  deal() {
    if (this.players.length === 0) {
      this.initialize();
    }

    const { deck, leftovers } = buildPaodekuaiDeck({
      playerCount: this.players.length,
      cardCount: this.config.cardCount,
    });

    this.players = this.players.map((player, index) => ({
      ...player,
      hand: sortCards(deck.slice(index * this.config.cardCount, (index + 1) * this.config.cardCount)),
      hasPlayedAny: false,
    }));
    this.deckRemainder = leftovers;
    this.lastPlay = null;
    this.passCount = 0;
    this.gamePhase = 'playing';
    this.winnerIndex = null;
    this.settlement = null;

    const firstPlayer = this.findOpeningPlayerIndex();
    this.currentPlayerIndex = firstPlayer;
    this.lastAction = `${this.players[firstPlayer]?.nickname ?? '玩家'} 先手`;
  }

  getState(): PaodekuaiGameState {
    return {
      players: this.players.map((player) => ({
        ...player,
        hand: player.hand.map(cloneCard),
      })),
      lastPlay: this.lastPlay
        ? {
            cards: this.lastPlay.cards.map(cloneCard),
            playerIndex: this.lastPlay.playerIndex,
            pattern: { ...this.lastPlay.pattern, cards: this.lastPlay.pattern.cards.map(cloneCard) },
          }
        : null,
      currentPlayerIndex: this.currentPlayerIndex,
      passCount: this.passCount,
      gamePhase: this.gamePhase,
      config: { ...this.config },
      deckRemainder: this.deckRemainder.map(cloneCard),
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

    if (!this.lastPlay || this.lastPlay.playerIndex === playerIndex) {
      return findPlayableHands(player.hand, null);
    }

    return findPlayableHands(player.hand, this.lastPlay);
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

    const pattern = getCardPattern(selected);
    if (!pattern) {
      return false;
    }

    if (this.lastPlay && this.lastPlay.playerIndex !== playerIndex) {
      if (!this.canUsePattern(pattern)) {
        return false;
      }
    }

    this.players[playerIndex] = {
      ...player,
      hand: sortCards(player.hand.filter((card) => !cardIds.includes(card.id))),
      hasPlayedAny: true,
    };

    this.lastPlay = {
      cards: sortCards(selected),
      playerIndex,
      pattern,
    };
    this.passCount = 0;
    this.lastAction = `${player.nickname} 出牌 ${selected.map((card) => card.label).join(' ')}`;

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
      this.lastAction = `${player.nickname} 选择不出，${winnerName} 重新领出`;
      return true;
    }

    this.currentPlayerIndex = this.getNextPlayerIndex(playerIndex);
    this.lastAction = `${player.nickname} 选择不出`;
    return true;
  }

  isSpring(): boolean {
    if (this.winnerIndex === null) {
      return false;
    }

    return this.players.every((player, index) => index === this.winnerIndex || !player.hasPlayedAny);
  }

  calculateScore(): SettlementResult {
    if (this.winnerIndex === null) {
      return {
        winnerIndex: 0,
        spring: false,
        rakeAmount: 0,
        winnerGain: 0,
        deltas: this.players.map(() => 0),
        summary: '本局尚未结束',
      };
    }

    const spring = this.isSpring();
    const multiplier = spring ? 2 : 1;
    const deltas = this.players.map((player, index) =>
      index === this.winnerIndex ? 0 : -player.hand.length * this.config.basePoint * multiplier,
    );
    const grossWin = Math.abs(deltas.reduce((sum, value) => sum + value, 0));
    const rakeAmount = Math.floor(grossWin * (this.config.rakePercent / 100));
    const winnerGain = grossWin - rakeAmount;
    deltas[this.winnerIndex] = winnerGain;

    return {
      winnerIndex: this.winnerIndex,
      spring,
      rakeAmount,
      winnerGain,
      deltas,
      summary: `${this.players[this.winnerIndex]?.nickname ?? '玩家'} 获胜，净赢 ${winnerGain} 分`,
    };
  }

  private canUsePattern(pattern: CardPatternResult): boolean {
    if (!this.lastPlay) {
      return true;
    }

    return canBeat(pattern, this.lastPlay.pattern);
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

  private findOpeningPlayerIndex(): number {
    for (let index = 0; index < this.players.length; index += 1) {
      const hasClubThree = this.players[index].hand.some((card) => card.rank === '3' && card.suit === 'club');
      if (hasClubThree) {
        return index;
      }
    }

    let minIndex = 0;
    let minValue = Number.POSITIVE_INFINITY;

    for (let index = 0; index < this.players.length; index += 1) {
      const value = this.players[index].hand[0]?.value ?? Number.POSITIVE_INFINITY;
      if (value < minValue) {
        minValue = value;
        minIndex = index;
      }
    }

    return minIndex;
  }

  private getNextPlayerIndex(currentIndex: number): number {
    return (currentIndex + 1) % this.players.length;
  }
}

export function createPaodekuaiEngine(config?: Partial<PaodekuaiConfig>) {
  return new PaodekuaiEngine(config);
}
