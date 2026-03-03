import type { SettlementResult } from '@/lib/games/fangpaofa/engine';
import type { GameConfig, MeldType } from '@/lib/games/fangpaofa/rules';

export interface FangpaofaPersistPlayerSnapshot {
  userId: string;
  nickname: string;
  isBot: boolean;
  isDealer: boolean;
  huXi: number;
  menZi: number;
  score: number;
  handCount: number;
  melds: Array<{
    type: MeldType;
    values: number[];
    huXi: number;
  }>;
}

export interface FangpaofaPersistPayload {
  action: 'fangpaofa_settle';
  humanProfileId: string | null;
  room: {
    localRoomId: string;
    roomCode: string;
    label: string;
    baseScore: number;
    maxPlayers: number;
  };
  roundNumber: number;
  config: GameConfig;
  winnerIndex: number | null;
  settlement: SettlementResult;
  players: FangpaofaPersistPlayerSnapshot[];
  actionLog: string[];
  discardValues: number[];
  deckRemainder: number;
  finishedAt: string;
}

export interface FangpaofaPersistResponse {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  gameRoundId?: string;
  updatedBalance?: number | null;
}
