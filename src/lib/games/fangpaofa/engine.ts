import { calculateRake } from '@/lib/economy/rake';
import {
  analyzeHu,
  canPao,
  canPeng,
  canTi,
  canWei,
  createChiMeld,
  createDeck,
  createMeld,
  defaultFangpaofaConfig,
  findChiOptions,
  sortTiles,
  type ChiOption,
  type GameConfig,
  type HuCheckResult,
  type Meld,
  type TiOption,
  type Tile,
} from '@/lib/games/fangpaofa/rules';
import { shuffleDeck } from '@/lib/games/fangpaofa/tiles';

export type GamePhase = 'waiting' | 'dealing' | 'playing' | 'finished';
export type TurnStage = 'draw' | 'discard';

export interface PlayerDescriptor {
  userId: string;
  nickname: string;
  isBot?: boolean;
}

export interface PlayerState {
  userId: string;
  nickname: string;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  huXi: number;
  menZi: number;
  isDealer: boolean;
  isBot: boolean;
  score: number;
  lastDelta: number;
}

export interface HuResult {
  winnerIndex: number;
  loserIndex: number | null;
  huXi: number;
  menZi: number;
  type: 'selfDraw' | 'jiePao';
  delta: number;
  rake: number;
}

export interface PlayerSettlement {
  userId: string;
  nickname: string;
  rawDelta: number;
  netDelta: number;
  rake: number;
  scoreAfter: number;
}

export interface SettlementResult {
  reason: 'hu' | 'emptyDeck' | 'maxScore';
  winnerIndex: number | null;
  unitScore: number;
  totalRake: number;
  detail: string;
  players: PlayerSettlement[];
}

export interface PendingReactionAction {
  key: string;
  type: 'hu' | 'pao' | 'peng' | 'chi';
  label: string;
  chiOption?: ChiOption;
}

export interface PendingReaction {
  playerIndex: number;
  sourcePlayerIndex: number;
  tile: Tile;
  actions: PendingReactionAction[];
}

export interface FangpaofaGameState {
  players: PlayerState[];
  deck: Tile[];
  discardPile: Tile[];
  currentPlayerIndex: number;
  dealerIndex: number;
  roundNumber: number;
  gamePhase: GamePhase;
  turnStage: TurnStage;
  config: GameConfig;
  lastDiscard: { tile: Tile; playerIndex: number } | null;
  lastAction: string;
  actionLog: string[];
  winnerIndex: number | null;
  settlement: SettlementResult | null;
  pendingReaction: PendingReaction | null;
}

interface RankedReaction {
  type: 'hu' | 'pao' | 'peng' | 'chi';
  playerIndex: number;
  priority: number;
  distance: number;
  chiOption?: ChiOption;
  huCheck?: HuCheckResult;
}

function clonePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    hand: sortTiles(player.hand),
    melds: player.melds.map((meld) => ({
      ...meld,
      tiles: sortTiles(meld.tiles),
    })),
    discards: sortTiles(player.discards),
  };
}

function createDefaultPlayers(playerCount: number): PlayerDescriptor[] {
  const names = ['好好先生', '风生水起', '财运当头'];

  return Array.from({ length: playerCount }, (_, index) => ({
    userId: `player-${index + 1}`,
    nickname: names[index] ?? `玩家${index + 1}`,
    isBot: index !== 0,
  }));
}

export class FangpaofaEngine {
  players: PlayerState[] = [];
  deck: Tile[] = [];
  discardPile: Tile[] = [];
  currentPlayerIndex = 0;
  dealerIndex = 0;
  roundNumber = 1;
  gamePhase: GamePhase = 'waiting';
  turnStage: TurnStage = 'discard';
  config: GameConfig = { ...defaultFangpaofaConfig };
  lastDiscard: { tile: Tile; playerIndex: number } | null = null;
  lastAction = '等待开始';
  actionLog: string[] = [];
  winnerIndex: number | null = null;
  settlement: SettlementResult | null = null;
  pendingReaction: PendingReaction | null = null;

  constructor(config?: Partial<GameConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  initialize(playerCount: number, config?: Partial<GameConfig>, players?: PlayerDescriptor[]): void {
    const count = Math.max(2, Math.min(3, playerCount));
    const descriptors = players && players.length >= count ? players.slice(0, count) : createDefaultPlayers(count);

    this.config = { ...defaultFangpaofaConfig, ...this.config, ...config };
    this.dealerIndex = this.config.firstDealerMode === 'host' ? 0 : Math.floor(Math.random() * count);
    this.currentPlayerIndex = this.dealerIndex;
    this.players = descriptors.map((player, index) => ({
      userId: player.userId,
      nickname: player.nickname,
      hand: [],
      melds: [],
      discards: [],
      huXi: 0,
      menZi: 0,
      isDealer: index === this.dealerIndex,
      isBot: Boolean(player.isBot),
      score: 0,
      lastDelta: 0,
    }));
    this.deck = [];
    this.discardPile = [];
    this.gamePhase = 'waiting';
    this.turnStage = 'discard';
    this.lastDiscard = null;
    this.lastAction = `第${this.roundNumber}局等待发牌`;
    this.actionLog = [];
    this.winnerIndex = null;
    this.settlement = null;
    this.pendingReaction = null;
  }

  deal(): void {
    if (this.players.length < 2) {
      this.initialize(3);
    }

    this.gamePhase = 'dealing';
    const shuffled = shuffleDeck(createDeck());
    let pointer = 0;

    this.players = this.players.map((player, index) => {
      const handSize = index === this.dealerIndex ? 21 : 20;
      const hand = sortTiles(shuffled.slice(pointer, pointer + handSize));
      pointer += handSize;

      return {
        ...player,
        hand,
        melds: [],
        discards: [],
        huXi: 0,
        menZi: 0,
        lastDelta: 0,
      };
    });

    this.deck = shuffled.slice(pointer);
    this.discardPile = [];
    this.currentPlayerIndex = this.dealerIndex;
    this.gamePhase = 'playing';
    this.turnStage = 'discard';
    this.lastDiscard = null;
    this.winnerIndex = null;
    this.settlement = null;
    this.pendingReaction = null;
    this.recalculateAllPlayers();
    this.pushLog(`${this.players[this.dealerIndex]?.nickname ?? '庄家'} 发牌完成，先手出牌`);
  }

  getState(): FangpaofaGameState {
    return {
      players: this.players.map(clonePlayer),
      deck: sortTiles(this.deck),
      discardPile: sortTiles(this.discardPile),
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
      roundNumber: this.roundNumber,
      gamePhase: this.gamePhase,
      turnStage: this.turnStage,
      config: { ...this.config },
      lastDiscard: this.lastDiscard
        ? {
            tile: { ...this.lastDiscard.tile },
            playerIndex: this.lastDiscard.playerIndex,
          }
        : null,
      lastAction: this.lastAction,
      actionLog: [...this.actionLog],
      winnerIndex: this.winnerIndex,
      settlement: this.settlement
        ? {
            ...this.settlement,
            players: this.settlement.players.map((player) => ({ ...player })),
          }
        : null,
      pendingReaction: this.pendingReaction
        ? {
            ...this.pendingReaction,
            tile: { ...this.pendingReaction.tile },
            actions: this.pendingReaction.actions.map((action) => ({
              ...action,
              chiOption: action.chiOption
                ? {
                    ...action.chiOption,
                    tiles: sortTiles(action.chiOption.tiles),
                    combined: sortTiles(action.chiOption.combined),
                  }
                : undefined,
            })),
          }
        : null,
    };
  }

  drawTile(playerIndex = this.currentPlayerIndex): Tile | null {
    if (!this.isActiveTurn(playerIndex) || this.turnStage !== 'draw') {
      return null;
    }

    const tile = this.deck.shift() ?? null;

    if (!tile) {
      this.settle('emptyDeck');
      return null;
    }

    this.players[playerIndex].hand = sortTiles([...this.players[playerIndex].hand, tile]);
    this.turnStage = 'discard';
    this.recalculatePlayer(playerIndex);
    this.pushLog(`${this.players[playerIndex].nickname} 摸牌 ${tile.display}`);

    return tile;
  }

  discardTile(playerIndex: number, tileId: number): boolean {
    if (!this.isActiveTurn(playerIndex) || this.turnStage !== 'discard') {
      return false;
    }

    const player = this.players[playerIndex];
    const tileIndex = player.hand.findIndex((tile) => tile.id === tileId);

    if (tileIndex === -1) {
      return false;
    }

    const [tile] = player.hand.splice(tileIndex, 1);
    player.hand = sortTiles(player.hand);
    player.discards = [...player.discards, tile];
    this.discardPile = [...this.discardPile, tile];
    this.lastDiscard = { tile, playerIndex };
    this.recalculatePlayer(playerIndex);
    this.pushLog(`${player.nickname} 打出 ${tile.display}`);

    const claimed = this.resolveDiscardResponses(playerIndex, tile);

    if (!claimed && this.gamePhase === 'playing') {
      this.advanceTurnAfterDiscard(playerIndex);
    }

    return true;
  }

  canChi(playerIndex: number, tile: Tile): ChiOption[] {
    const nextPlayer = this.getNextPlayerIndex(this.lastDiscard?.playerIndex ?? playerIndex);

    if (nextPlayer !== playerIndex) {
      return [];
    }

    return findChiOptions(this.players[playerIndex].hand, tile);
  }

  canPeng(playerIndex: number, tile: Tile): boolean {
    return canPeng(this.players[playerIndex].hand, tile);
  }

  canWei(playerIndex: number, tile: Tile): boolean {
    return canWei(this.players[playerIndex].hand, tile);
  }

  canPao(playerIndex: number, tile: Tile): boolean {
    return canPao(this.players[playerIndex].hand, this.players[playerIndex].melds, tile);
  }

  canTi(playerIndex: number): TiOption[] {
    return canTi(this.players[playerIndex].hand, this.players[playerIndex].melds);
  }

  canHu(playerIndex: number, extraTile?: Tile): HuCheckResult {
    const player = this.players[playerIndex];
    const hand = extraTile ? sortTiles([...player.hand, extraTile]) : player.hand;
    return analyzeHu(player.melds, hand, this.config);
  }

  executeChi(playerIndex: number, option: ChiOption, claimedTile = this.lastDiscard?.tile): boolean {
    if (!claimedTile) {
      return false;
    }

    const player = this.players[playerIndex];

    for (const usedTile of option.tiles) {
      const handIndex = player.hand.findIndex((candidate) => candidate.id === usedTile.id);

      if (handIndex === -1) {
        return false;
      }

      player.hand.splice(handIndex, 1);
    }

    player.hand = sortTiles(player.hand);
    player.melds = [...player.melds, createChiMeld(option, claimedTile)];
    this.claimDiscardTile(claimedTile.id);
    this.currentPlayerIndex = playerIndex;
    this.turnStage = 'discard';
    this.recalculatePlayer(playerIndex);
    this.pushLog(`${player.nickname} 吃牌 ${option.label}`);

    return true;
  }

  executePeng(playerIndex: number, claimedTile = this.lastDiscard?.tile): boolean {
    if (!claimedTile) {
      return false;
    }

    const player = this.players[playerIndex];
    const matches = player.hand.filter((tile) => tile.value === claimedTile.value).slice(0, 2);

    if (matches.length < 2) {
      return false;
    }

    for (const tile of matches) {
      const index = player.hand.findIndex((candidate) => candidate.id === tile.id);
      player.hand.splice(index, 1);
    }

    player.hand = sortTiles(player.hand);
    player.melds = [...player.melds, createMeld('peng', [...matches, claimedTile], 'discard')];
    this.claimDiscardTile(claimedTile.id);
    this.currentPlayerIndex = playerIndex;
    this.turnStage = 'discard';
    this.recalculatePlayer(playerIndex);
    this.pushLog(`${player.nickname} 碰牌 ${claimedTile.display}`);

    return true;
  }

  executeWei(playerIndex: number, tile: Tile): boolean {
    const player = this.players[playerIndex];
    const matches = player.hand.filter((candidate) => candidate.value === tile.value).slice(0, 3);

    if (matches.length < 3) {
      return false;
    }

    for (const match of matches) {
      const index = player.hand.findIndex((candidate) => candidate.id === match.id);
      player.hand.splice(index, 1);
    }

    player.hand = sortTiles(player.hand);
    player.melds = [...player.melds, createMeld('wei', matches, 'self')];
    this.currentPlayerIndex = playerIndex;
    this.turnStage = 'discard';
    this.recalculatePlayer(playerIndex);
    this.pushLog(`${player.nickname} 偎牌 ${tile.display}`);

    return true;
  }

  executePao(playerIndex: number, claimedTile = this.lastDiscard?.tile): boolean {
    if (!claimedTile) {
      return false;
    }

    const player = this.players[playerIndex];
    const upgradeIndex = player.melds.findIndex(
      (meld) =>
        (meld.type === 'peng' || meld.type === 'wei') &&
        meld.tiles[0]?.value === claimedTile.value
    );

    if (upgradeIndex >= 0) {
      const upgraded = {
        ...player.melds[upgradeIndex],
        type: 'pao' as const,
        tiles: sortTiles([...player.melds[upgradeIndex].tiles, claimedTile]),
        huXi: createMeld('pao', [...player.melds[upgradeIndex].tiles, claimedTile], 'upgrade').huXi,
        source: 'upgrade' as const,
      };
      player.melds[upgradeIndex] = upgraded;
    } else {
      const matches = player.hand.filter((candidate) => candidate.value === claimedTile.value).slice(0, 3);

      if (matches.length < 3) {
        return false;
      }

      for (const match of matches) {
        const index = player.hand.findIndex((candidate) => candidate.id === match.id);
        player.hand.splice(index, 1);
      }

      player.melds = [...player.melds, createMeld('pao', [...matches, claimedTile], 'discard')];
      player.hand = sortTiles(player.hand);
    }

    this.claimDiscardTile(claimedTile.id);
    this.currentPlayerIndex = playerIndex;
    this.turnStage = 'discard';
    this.recalculatePlayer(playerIndex);
    this.pushLog(`${player.nickname} 跑牌 ${claimedTile.display}`);

    return true;
  }

  executeTi(playerIndex: number, option: TiOption): boolean {
    const player = this.players[playerIndex];

    if (option.upgradeFromWei) {
      const meldIndex = player.melds.findIndex(
        (meld) => meld.type === 'wei' && meld.tiles[0]?.value === option.tileValue
      );
      const handTileIndex = player.hand.findIndex((tile) => tile.value === option.tileValue);

      if (meldIndex === -1 || handTileIndex === -1) {
        return false;
      }

      const [extraTile] = player.hand.splice(handTileIndex, 1);
      player.melds[meldIndex] = createMeld('ti', [...player.melds[meldIndex].tiles, extraTile], 'upgrade');
    } else {
      const matches = player.hand.filter((tile) => tile.value === option.tileValue).slice(0, 4);

      if (matches.length < 4) {
        return false;
      }

      for (const tile of matches) {
        const index = player.hand.findIndex((candidate) => candidate.id === tile.id);
        player.hand.splice(index, 1);
      }

      player.melds = [...player.melds, createMeld('ti', matches, 'self')];
    }

    player.hand = sortTiles(player.hand);
    this.currentPlayerIndex = playerIndex;
    this.turnStage = 'discard';
    this.recalculatePlayer(playerIndex);
    this.pushLog(`${player.nickname} 提牌 ${option.tiles[0]?.display ?? ''}`.trim());

    return true;
  }

  executeHu(playerIndex: number, winningTile?: Tile): HuResult | null {
    const player = this.players[playerIndex];
    const targetTile = winningTile ?? undefined;
    const hand = targetTile ? sortTiles([...player.hand, targetTile]) : player.hand;
    const check = analyzeHu(player.melds, hand, this.config);
    const discardSourcePlayerIndex = targetTile ? this.lastDiscard?.playerIndex ?? null : null;

    if (!check.valid) {
      return null;
    }

    this.pendingReaction = null;

    if (targetTile) {
      player.hand = hand;
      if (this.lastDiscard?.tile.id === targetTile.id) {
        this.claimDiscardTile(targetTile.id);
      }
    }

    player.huXi = check.huXi;
    player.menZi = check.menZi;
    this.winnerIndex = playerIndex;
    this.gamePhase = 'finished';
    this.turnStage = 'discard';

    const settlement = this.settleInternal('hu', playerIndex, check);
    this.settlement = settlement;
    const playerSettlement = settlement.players[playerIndex];
    this.pushLog(`${player.nickname} 胡牌，${check.huXi} 胡息 / ${check.menZi} 门子`);

    return {
      winnerIndex: playerIndex,
      loserIndex: discardSourcePlayerIndex,
      huXi: check.huXi,
      menZi: check.menZi,
      type: targetTile ? 'jiePao' : 'selfDraw',
      delta: playerSettlement?.netDelta ?? 0,
      rake: settlement.totalRake,
    };
  }

  executePass(playerIndex: number): void {
    if (this.pendingReaction?.playerIndex === playerIndex) {
      this.passPendingReaction(playerIndex);
      return;
    }

    if (!this.isActiveTurn(playerIndex)) {
      return;
    }

    this.advanceTurnAfterDiscard(playerIndex);
  }

  resolvePendingReaction(playerIndex: number, actionKey: string): boolean {
    const pending = this.pendingReaction;

    if (!pending || pending.playerIndex !== playerIndex) {
      return false;
    }

    const action = pending.actions.find((candidate) => candidate.key === actionKey);

    if (!action) {
      return false;
    }

    this.pendingReaction = null;

    switch (action.type) {
      case 'hu':
        return this.executeHu(playerIndex, pending.tile) !== null;
      case 'pao':
        return this.executePao(playerIndex, pending.tile);
      case 'peng':
        return this.executePeng(playerIndex, pending.tile);
      case 'chi':
        return action.chiOption ? this.executeChi(playerIndex, action.chiOption, pending.tile) : false;
      default:
        return false;
    }
  }

  passPendingReaction(playerIndex: number): boolean {
    const pending = this.pendingReaction;

    if (!pending || pending.playerIndex !== playerIndex) {
      return false;
    }

    this.pendingReaction = null;
    this.pushLog(`${this.players[playerIndex].nickname} 选择过`);
    this.advanceTurnAfterDiscard(pending.sourcePlayerIndex);

    return true;
  }

  calculateHuXi(melds: Meld[], hand: Tile[]): number {
    return analyzeHu(melds, hand, this.config).huXi;
  }

  isValidHu(playerIndex: number): HuCheckResult {
    return this.canHu(playerIndex);
  }

  settle(reason: 'emptyDeck' | 'maxScore' = 'emptyDeck'): SettlementResult {
    if (this.settlement) {
      return this.settlement;
    }

    this.gamePhase = 'finished';
    this.settlement = this.settleInternal(reason, this.winnerIndex);

    return this.settlement;
  }

  private isActiveTurn(playerIndex: number): boolean {
    return (
      this.gamePhase === 'playing' &&
      this.currentPlayerIndex === playerIndex &&
      this.pendingReaction === null
    );
  }

  private getNextPlayerIndex(from: number): number {
    return (from + 1) % this.players.length;
  }

  private getDistance(from: number, to: number): number {
    return (to - from + this.players.length) % this.players.length;
  }

  private recalculatePlayer(playerIndex: number): void {
    const player = this.players[playerIndex];
    const check = analyzeHu(player.melds, player.hand, this.config);
    player.huXi = check.huXi;
    player.menZi = check.menZi;
  }

  private recalculateAllPlayers(): void {
    for (let index = 0; index < this.players.length; index += 1) {
      this.recalculatePlayer(index);
    }
  }

  private claimDiscardTile(tileId: number): void {
    const discardIndex = this.discardPile.findIndex((tile) => tile.id === tileId);

    if (discardIndex >= 0) {
      this.discardPile.splice(discardIndex, 1);
    }

    if (this.lastDiscard?.tile.id === tileId) {
      this.lastDiscard = null;
    }

    if (this.pendingReaction?.tile.id === tileId) {
      this.pendingReaction = null;
    }
  }

  private advanceTurnAfterDiscard(previousPlayerIndex: number): void {
    if (this.gamePhase !== 'playing') {
      return;
    }

    if (this.deck.length === 0) {
      this.settle('emptyDeck');
      return;
    }

    this.currentPlayerIndex = this.getNextPlayerIndex(previousPlayerIndex);
    this.turnStage = 'draw';
    this.pushLog(`${this.players[this.currentPlayerIndex].nickname} 轮到摸牌`);
  }

  private resolveDiscardResponses(fromPlayerIndex: number, tile: Tile): boolean {
    const reactions: RankedReaction[] = [];

    for (let index = 0; index < this.players.length; index += 1) {
      if (index === fromPlayerIndex) {
        continue;
      }

      const distance = this.getDistance(fromPlayerIndex, index);
      const huCheck = this.canHu(index, tile);

      if (huCheck.valid) {
        reactions.push({ type: 'hu', playerIndex: index, priority: 4, distance, huCheck });
      }

      if (this.canPao(index, tile)) {
        reactions.push({ type: 'pao', playerIndex: index, priority: 3, distance });
      }

      if (this.canPeng(index, tile)) {
        reactions.push({ type: 'peng', playerIndex: index, priority: 2, distance });
      }

      if (distance === 1) {
        const chiOptions = findChiOptions(this.players[index].hand, tile);

        if (chiOptions.length > 0) {
          reactions.push({ type: 'chi', playerIndex: index, priority: 1, distance, chiOption: chiOptions[0] });
        }
      }
    }

    if (reactions.length === 0) {
      return false;
    }

    reactions.sort((left, right) => right.priority - left.priority || left.distance - right.distance);
    const chosen = reactions[0];

    if (chosen.playerIndex === 0) {
      const actions = this.buildPendingActions(chosen, fromPlayerIndex, tile);

      if (actions.length > 0) {
        this.pendingReaction = {
          playerIndex: 0,
          sourcePlayerIndex: fromPlayerIndex,
          tile,
          actions,
        };
        this.currentPlayerIndex = 0;
        this.pushLog(`轮到你响应：${actions.map((action) => action.label).join(' / ')}`);
        return true;
      }
    }

    switch (chosen.type) {
      case 'hu':
        return this.executeHu(chosen.playerIndex, tile) !== null;
      case 'pao':
        return this.executePao(chosen.playerIndex, tile);
      case 'peng':
        return this.executePeng(chosen.playerIndex, tile);
      case 'chi':
        return chosen.chiOption ? this.executeChi(chosen.playerIndex, chosen.chiOption, tile) : false;
      default:
        return false;
    }
  }

  private buildPendingActions(
    chosen: RankedReaction,
    fromPlayerIndex: number,
    tile: Tile
  ): PendingReactionAction[] {
    switch (chosen.type) {
      case 'hu':
        return [{ key: 'hu', type: 'hu', label: '胡' }];
      case 'pao':
        return [{ key: 'pao', type: 'pao', label: '跑' }];
      case 'peng':
        return [{ key: 'peng', type: 'peng', label: '碰' }];
      case 'chi': {
        const distance = this.getDistance(fromPlayerIndex, chosen.playerIndex);

        if (distance !== 1) {
          return [];
        }

        const chiOptions = this.canChi(chosen.playerIndex, tile);

        return chiOptions.map((option, index) => ({
          key: `chi-${index}`,
          type: 'chi' as const,
          label: `吃 ${option.label}`,
          chiOption: option,
        }));
      }
      default:
        return [];
    }
  }

  private settleInternal(
    reason: SettlementResult['reason'],
    forcedWinnerIndex: number | null,
    huCheck?: HuCheckResult
  ): SettlementResult {
    const winnerIndex = forcedWinnerIndex;
    let unitScore = 0;
    let totalRake = 0;
    let detail = '本局流局';

    for (const player of this.players) {
      player.lastDelta = 0;
    }

    if (winnerIndex !== null) {
      const resolvedHu = huCheck ?? this.canHu(winnerIndex);
      unitScore = Math.max(this.config.minHuXi, resolvedHu.huXi) * this.config.baseStake;
      unitScore = Math.min(unitScore, this.config.maxScore);
      const loserCount = Math.max(1, this.players.length - 1);
      const rawWin = unitScore * loserCount;
      totalRake = calculateRake(rawWin, this.config.rakePercent);
      detail = `${this.players[winnerIndex].nickname} 获胜，原始赢额 ${rawWin.toFixed(2)}`;

      this.players.forEach((player, index) => {
        if (index === winnerIndex) {
          player.lastDelta = rawWin - totalRake;
          player.score += player.lastDelta;
        } else {
          player.lastDelta = -unitScore;
          player.score += player.lastDelta;
        }
      });
    }

    const settlements = this.players.map((player, index) => ({
      userId: player.userId,
      nickname: player.nickname,
      rawDelta: winnerIndex === null ? 0 : index === winnerIndex ? unitScore * (this.players.length - 1) : -unitScore,
      netDelta: player.lastDelta,
      rake: winnerIndex === index ? totalRake : 0,
      scoreAfter: player.score,
    }));

    this.lastAction = detail;

    return {
      reason,
      winnerIndex,
      unitScore,
      totalRake,
      detail,
      players: settlements,
    };
  }

  private pushLog(message: string): void {
    this.lastAction = message;
    this.actionLog = [message, ...this.actionLog].slice(0, 10);
  }
}

export function createFangpaofaEngine(config?: Partial<GameConfig>): FangpaofaEngine {
  return new FangpaofaEngine(config);
}
