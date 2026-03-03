import type { LotteryDrawResult } from '@/lib/lottery/rules';

export interface LotteryBetRecord {
  id: string;
  issueNo: string;
  category: string;
  detail: string;
  units: number;
  stake: number;
  totalAmount: number;
  createdAt: string;
}

export interface PlaceBetPayload {
  issueNo: string;
  category: string;
  detail: string;
  units: number;
  stake: number;
}

export interface PlaceBetResult {
  ok: boolean;
  message: string;
  totalAmount?: number;
}

export interface LotterySnapshot {
  clientId: string;
  currentIssueNo: string;
  closesAt: string;
  drawIntervalSeconds: number;
  balance: number;
  latestDraw: LotteryDrawResult;
  drawHistory: LotteryDrawResult[];
  betHistory: LotteryBetRecord[];
}
