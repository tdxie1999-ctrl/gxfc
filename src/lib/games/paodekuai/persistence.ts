import type { PaodekuaiGameState } from '@/lib/games/paodekuai/engine';

export interface PaodekuaiSettlementPlayerSnapshot {
  userId: string;
  nickname: string;
  isBot: boolean;
  score: number;
  delta: number;
}

export interface PaodekuaiSettlementPayload {
  roomId: string;
  winnerIndex: number;
  lastAction: string;
  config: PaodekuaiGameState['config'];
  settlement: NonNullable<PaodekuaiGameState['settlement']>;
  players: PaodekuaiSettlementPlayerSnapshot[];
}

export function buildPaodekuaiSettlementPayload(
  roomId: string,
  state: PaodekuaiGameState | null,
): PaodekuaiSettlementPayload | null {
  if (!state?.settlement || state.winnerIndex === null) {
    return null;
  }

  return {
    roomId,
    winnerIndex: state.winnerIndex,
    lastAction: state.lastAction,
    config: state.config,
    settlement: state.settlement,
    players: state.players.map((player, index) => ({
      userId: player.userId,
      nickname: player.nickname,
      isBot: player.isBot,
      score: player.score,
      delta: state.settlement?.deltas[index] ?? 0,
    })),
  };
}
