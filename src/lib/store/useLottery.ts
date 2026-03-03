import { create } from 'zustand';
import {
  BASE_ISSUE_NO,
  DRAW_INTERVAL_SECONDS,
  buildHardcodedDraw,
} from '@/lib/lottery/rules';
import type { LotterySnapshot, PlaceBetPayload, PlaceBetResult } from '@/lib/lottery/types';

interface LotteryState extends LotterySnapshot {
  initialized: boolean;
  loading: boolean;
  settling: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  placeBet: (payload: PlaceBetPayload) => Promise<PlaceBetResult>;
  settleCurrentIssue: () => Promise<void>;
}

const initialDraw = buildHardcodedDraw(BASE_ISSUE_NO);

function createClientId() {
  if (typeof window === 'undefined') {
    return 'server-placeholder';
  }

  const existing = window.localStorage.getItem('gxfc-lottery-client-id');
  if (existing) {
    return existing;
  }

  const generated = window.crypto?.randomUUID
    ? `lottery-${window.crypto.randomUUID()}`
    : `lottery-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem('gxfc-lottery-client-id', generated);
  return generated;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function fetchLotterySnapshot(clientId: string) {
  const response = await fetch(`/api/lottery?clientId=${encodeURIComponent(clientId)}`, {
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        snapshot?: LotterySnapshot;
        error?: string;
      }
    | null;

  if (!response.ok || !payload?.snapshot) {
    throw new Error(payload?.error ?? '获取六合彩状态失败');
  }

  return payload.snapshot;
}

function applySnapshot(set: (partial: Partial<LotteryState>) => void, snapshot: LotterySnapshot) {
  set({
    ...snapshot,
    balance: roundMoney(snapshot.balance),
    initialized: true,
  });
}

export const useLotteryStore = create<LotteryState>((set, get) => ({
  clientId: '',
  currentIssueNo: BASE_ISSUE_NO,
  closesAt: new Date(Date.now() + DRAW_INTERVAL_SECONDS * 1000).toISOString(),
  drawIntervalSeconds: DRAW_INTERVAL_SECONDS,
  balance: 5000,
  latestDraw: initialDraw,
  drawHistory: [initialDraw],
  betHistory: [],
  initialized: false,
  loading: false,
  settling: false,

  hydrate: async () => {
    const clientId = createClientId();
    set({ loading: true });

    try {
      const snapshot = await fetchLotterySnapshot(clientId);
      applySnapshot(set, snapshot);
      set({ loading: false });
    } catch (error) {
      set({
        clientId,
        initialized: true,
        loading: false,
      });
      throw error;
    }
  },

  refresh: async () => {
    const clientId = get().clientId || createClientId();
    const snapshot = await fetchLotterySnapshot(clientId);
    applySnapshot(set, snapshot);
  },

  placeBet: async (payload) => {
    const clientId = get().clientId || createClientId();

    try {
      const response = await fetch('/api/lottery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'place_bet',
          clientId,
          ...payload,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | {
            result?: PlaceBetResult;
            snapshot?: LotterySnapshot;
            error?: string;
          }
        | null;

      if (!response.ok || !result?.result || !result.snapshot) {
        return {
          ok: false,
          message: result?.error ?? '下注失败，请稍后重试。',
        };
      }

      applySnapshot(set, result.snapshot);
      return result.result;
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '下注失败，请稍后重试。',
      };
    }
  },

  settleCurrentIssue: async () => {
    if (get().settling) {
      return;
    }

    const clientId = get().clientId || createClientId();
    set({ settling: true });

    try {
      const response = await fetch('/api/lottery/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            snapshot?: LotterySnapshot;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.snapshot) {
        throw new Error(payload?.error ?? '封盘结算失败');
      }

      applySnapshot(set, payload.snapshot);
    } finally {
      set({ settling: false });
    }
  },
}));
