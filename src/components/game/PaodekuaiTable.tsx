'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameActions, { type GameActionItem } from '@/components/game/GameActions';
import PlayerSeat from '@/components/game/PlayerSeat';
import PokerCard from '@/components/game/PokerCard';
import Settlement from '@/components/game/Settlement';
import { applyBalanceDelta } from '@/lib/economy/balance';
import { PaodekuaiAI } from '@/lib/games/paodekuai/ai';
import {
  createPaodekuaiEngine,
  type PaodekuaiEngine,
  type PaodekuaiGameState,
} from '@/lib/games/paodekuai/engine';
import {
  buildPaodekuaiSettlementPayload,
  type PaodekuaiSettlementPayload,
} from '@/lib/games/paodekuai/persistence';
import { getCardPattern } from '@/lib/games/paodekuai/rules';
import { supabase } from '@/lib/supabase/client';
import { type GameTableRuntimeProps, useGameTableRuntime } from '@/lib/table/runtime';
import { useAuthStore } from '@/lib/store/useAuth';

export interface PaodekuaiPlayerSeed {
  userId: string;
  nickname: string;
  isBot: boolean;
}

interface PaodekuaiTableProps extends GameTableRuntimeProps {
  playerSeeds?: PaodekuaiPlayerSeed[];
  onSettlementPersist?: (payload: PaodekuaiSettlementPayload) => Promise<void> | void;
}

function formatPatternName(state: PaodekuaiGameState | null) {
  if (!state?.lastPlay) {
    return '等待领牌';
  }

  return state.lastPlay.pattern.type;
}

function getNumberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function PaodekuaiTable({
  roomId,
  roomCode,
  roomLabel,
  roomConfig,
  playerSeeds,
  onSettlementPersist,
}: PaodekuaiTableProps) {
  const engineRef = useRef<PaodekuaiEngine | null>(null);
  const aiRef = useRef<Record<string, PaodekuaiAI>>({});
  const settlementAppliedRef = useRef<string | null>(null);
  const [state, setState] = useState<PaodekuaiGameState | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const user = useAuthStore((store) => store.user);
  const profile = useAuthStore((store) => store.profile);
  const updateProfile = useAuthStore((store) => store.updateProfile);
  const resolvedPlayerSeeds = useMemo<PaodekuaiPlayerSeed[]>(
    () =>
      playerSeeds && playerSeeds.length > 0
        ? playerSeeds
        : [
            { userId: `${roomId}-human`, nickname: '你', isBot: false },
            { userId: `${roomId}-bot-1`, nickname: '好运连连', isBot: true },
            { userId: `${roomId}-bot-2`, nickname: '风生水起', isBot: true },
          ],
    [playerSeeds, roomId],
  );
  const sharedSettlement = useMemo(() => {
    if (!state?.settlement) {
      return null;
    }

    return {
      key: `${roomId}:${state.winnerIndex}:${state.settlement.summary}`,
      summary: state.settlement.summary,
      players: state.players.map((player, index) => ({
        id: player.userId,
        name: player.nickname,
        avatar: !player.isBot ? profile?.avatar_url ?? '/assets/avatars/default.png' : '/assets/avatars/default.png',
        roundDelta: state.settlement?.deltas[index] ?? 0,
        totalScore: player.score,
        isWinner: state.settlement?.winnerIndex === index,
      })),
    };
  }, [profile?.avatar_url, roomId, state]);
  const {
    initialized,
    roomCode: resolvedRoomCode,
    roomTitle,
    roomLabel: resolvedRoomLabel,
    roomConfig: resolvedRoomConfig,
    statusText,
    setStatusText,
    settlementEntry,
    settlementOpen,
    closeSettlement,
    exitRoom,
  } = useGameTableRuntime({
    roomId,
    roomCode,
    roomLabel,
    roomConfig,
    fallbackTitle: '跑得快',
    fallbackLabel: '跑得快牌桌',
    initialStatusText: '正在初始化跑得快牌桌...',
    settlement: sharedSettlement,
  });

  const engineConfig = useMemo(() => {
    const paodekuaiConfig =
      resolvedRoomConfig.paodekuai && typeof resolvedRoomConfig.paodekuai === 'object'
        ? (resolvedRoomConfig.paodekuai as Record<string, unknown>)
        : resolvedRoomConfig;

    return {
      cardCount: getNumberValue(paodekuaiConfig.cardCount, 16) === 15 ? 15 : 16,
      fourWithThree: paodekuaiConfig.fourWithThree !== false,
      heartsTenDouble: paodekuaiConfig.heartsTenDouble !== false,
      smallJokerDouble: paodekuaiConfig.smallJokerDouble !== false,
      autoPlaySeconds: Math.max(3, getNumberValue(paodekuaiConfig.autoPlaySeconds, 12)),
      doubleThreshold: Math.max(1, getNumberValue(paodekuaiConfig.doubleThreshold, 10)),
      basePoint: Math.max(0.5, getNumberValue(paodekuaiConfig.basePoint, 1)),
      rakePercent: Math.max(0, getNumberValue(paodekuaiConfig.rakePercent, 5)),
    } as const;
  }, [resolvedRoomConfig]);

  const syncState = useCallback(() => {
    if (!engineRef.current) {
      return;
    }

    const snapshot = engineRef.current.getState();
    const currentHandIds = new Set(snapshot.players[0]?.hand.map((card) => card.id) ?? []);

    setSelectedIds((current) => current.filter((cardId) => currentHandIds.has(cardId)));
    setState(snapshot);
  }, []);

  const startRound = useCallback(() => {
    const engine = createPaodekuaiEngine(engineConfig);
    engine.initialize(
      resolvedPlayerSeeds.length,
      resolvedPlayerSeeds.map((player) => ({
        userId: player.userId,
        nickname: player.nickname,
        isBot: player.isBot,
      })),
    );
    engine.deal();
    engineRef.current = engine;
    aiRef.current = resolvedPlayerSeeds.reduce<Record<string, PaodekuaiAI>>((accumulator, player) => {
      if (player.isBot) {
        accumulator[player.userId] = new PaodekuaiAI('normal');
      }

      return accumulator;
    }, {});
    settlementAppliedRef.current = null;
    setSelectedIds([]);
    syncState();
  }, [engineConfig, resolvedPlayerSeeds, syncState]);

  useEffect(() => {
    startRound();
  }, [startRound]);

  const handleToggleCard = useCallback((cardId: number) => {
    setSelectedIds((current) =>
      current.includes(cardId) ? current.filter((item) => item !== cardId) : [...current, cardId],
    );
  }, []);

  const handleHint = useCallback(() => {
    if (!engineRef.current || !state || state.currentPlayerIndex !== 0 || state.gamePhase !== 'playing') {
      return;
    }

    const hint = engineRef.current.getHint(0);
    setSelectedIds(hint.map((card) => card.id));
  }, [state]);

  const handlePlay = useCallback(() => {
    if (!engineRef.current || !state || state.currentPlayerIndex !== 0 || selectedIds.length === 0) {
      return;
    }

    const ok = engineRef.current.playCards(0, selectedIds);
    if (!ok) {
      return;
    }

    syncState();
  }, [selectedIds, state, syncState]);

  const handlePass = useCallback(() => {
    if (!engineRef.current || !state || state.currentPlayerIndex !== 0) {
      return;
    }

    const ok = engineRef.current.pass(0);
    if (!ok) {
      return;
    }

    setSelectedIds([]);
    syncState();
  }, [state, syncState]);

  const runBotTurn = useCallback(() => {
    const engine = engineRef.current;

    if (!engine) {
      return;
    }

    const snapshot = engine.getState();
    const currentPlayer = snapshot.players[snapshot.currentPlayerIndex];

    if (!currentPlayer?.isBot || snapshot.gamePhase !== 'playing') {
      return;
    }

    const ai = aiRef.current[currentPlayer.userId] ?? new PaodekuaiAI('normal');
    const decision = ai.decideMove(snapshot.currentPlayerIndex, snapshot);

    if (decision.type === 'play' && decision.cardIds.length > 0) {
      const played = engine.playCards(snapshot.currentPlayerIndex, decision.cardIds);

      if (!played) {
        engine.pass(snapshot.currentPlayerIndex);
      }
    } else {
      engine.pass(snapshot.currentPlayerIndex);
    }

    syncState();
  }, [syncState]);

  useEffect(() => {
    if (!state || state.gamePhase !== 'playing') {
      return;
    }

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer?.isBot) {
      return;
    }

    const timer = window.setTimeout(() => {
      runBotTurn();
    }, 900 + Math.floor(Math.random() * 900));

    return () => window.clearTimeout(timer);
  }, [runBotTurn, state]);

  const currentPlayer = state?.players[state.currentPlayerIndex] ?? null;
  const humanPlayer = state?.players[0] ?? null;
  const opponents = state?.players.slice(1) ?? [];

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.gamePhase === 'finished') {
      setStatusText(state.settlement?.summary ?? '本局已结束，等待下一局');
      return;
    }

    setStatusText(`当前轮到：${currentPlayer?.nickname ?? '未知'} / 牌型 ${formatPatternName(state)}`);
  }, [currentPlayer?.nickname, setStatusText, state]);

  useEffect(() => {
    if (!state?.settlement || !settlementEntry) {
      return;
    }

    if (settlementAppliedRef.current === settlementEntry.key) {
      return;
    }

    settlementAppliedRef.current = settlementEntry.key;

    const settlementPayload = buildPaodekuaiSettlementPayload(roomId, state);
    if (onSettlementPersist && settlementPayload) {
      void Promise.resolve(onSettlementPersist(settlementPayload)).catch(() => {
        // 服务端结算由上层负责兜底提示，这里不阻断已完成的牌局展示。
      });
      return;
    }

    if (!profile || !user) {
      return;
    }

    const delta = state.settlement.deltas[0] ?? 0;
    if (delta === 0) {
      return;
    }

    const nextBalance = applyBalanceDelta(profile.balance, delta);
    const logType = delta > 0 ? 'game_win' : 'game_lose';
    const roomDesc = roomCode ? `房号 ${roomCode}` : `房间 ${roomId}`;
    const detail = `${roomLabel ?? '跑得快'} 结算（${roomDesc}，已含 ${state.settlement.rakeAmount} 分抽水）`;

    void (async () => {
      try {
        await updateProfile({ balance: nextBalance });
        await supabase.from('balance_logs').insert({
          user_id: user.id,
          amount: delta,
          balance_after: nextBalance,
          type: logType,
          description: detail,
        });
      } catch {
        // 结算优先保证本地状态可继续，日志写入失败不阻断下一局。
      }
    })();
  }, [onSettlementPersist, profile, roomCode, roomId, roomLabel, settlementEntry, state, updateProfile, user]);

  const selectedPattern = useMemo(() => {
    if (!humanPlayer || selectedIds.length === 0) {
      return null;
    }

    const cards = humanPlayer.hand.filter((card) => selectedIds.includes(card.id));
    return getCardPattern(cards);
  }, [humanPlayer, selectedIds]);

  const canPass = Boolean(
    state &&
      state.gamePhase === 'playing' &&
      state.currentPlayerIndex === 0 &&
      state.lastPlay &&
      state.lastPlay.playerIndex !== 0,
  );
  const canPlay = Boolean(
    state &&
      state.gamePhase === 'playing' &&
      state.currentPlayerIndex === 0 &&
      selectedIds.length > 0 &&
      selectedPattern,
  );

  const actionItems = useMemo<GameActionItem[]>(() => {
    if (!state) {
      return [];
    }

    if (state.gamePhase === 'finished') {
      return [{ key: 'restart', label: '再来一局', onClick: startRound, variant: 'primary' }];
    }

    if (state.currentPlayerIndex !== 0) {
      return [];
    }

    const actions: GameActionItem[] = [
      { key: 'hint', label: '提示', onClick: handleHint, variant: 'secondary' },
      {
        key: 'pass',
        label: canPass ? '不出' : '要不起',
        onClick: handlePass,
        disabled: !canPass,
        variant: 'secondary',
      },
      {
        key: 'play',
        label: '出牌',
        onClick: handlePlay,
        disabled: !canPlay,
        variant: 'primary',
      },
    ];

    return actions;
  }, [canPass, canPlay, handleHint, handlePass, handlePlay, startRound, state]);

  if ((!initialized && !state) || !state || !humanPlayer) {
    return (
      <div className="flex h-full items-center justify-center text-lg font-semibold text-white/80">
        正在初始化跑得快牌桌...
      </div>
    );
  }

  return (
    <>
      <main className="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-5 px-4 py-4 md:px-6">
        <header className="relative overflow-hidden rounded-[34px] border border-[#d4a017]/14 bg-[linear-gradient(180deg,#0d1726_0%,#09111d_100%)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(233,194,92,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(39,174,96,0.12),_transparent_30%)]" />

          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <section className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#d4a017]/18 bg-[#d4a017]/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#f5d77a]">
                      真实牌局
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/45">
                      Phase 5
                    </span>
                  </div>
                  <h1 className="brand-gold-text mt-4 text-3xl font-black tracking-[0.12em]">{roomTitle}</h1>
                  <p className="mt-2 text-sm text-white/58">
                    {resolvedRoomLabel} · 房号 {resolvedRoomCode}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-[24px] border border-white/10 bg-black/25 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">当前轮到</p>
                    <p className="mt-2 text-base font-bold text-white">{currentPlayer?.nickname ?? '未知'}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-black/25 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">牌型</p>
                    <p className="mt-2 text-base font-bold text-white">{formatPatternName(state)}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-black/25 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">剩余牌</p>
                    <p className="mt-2 text-base font-bold text-white">{state.deckRemainder.length}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-black/25 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">托管</p>
                    <p className="mt-2 text-base font-bold text-white">{state.config.autoPlaySeconds}s</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.2))] p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">局内播报</p>
                  <p className="mt-3 text-lg font-semibold text-white">{state.lastAction}</p>
                  <p className="mt-2 text-sm leading-7 text-white/62">{statusText}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/72">
                      {state.config.cardCount} 张发牌
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/72">
                      {state.config.fourWithThree ? '四带三' : '四带二'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/72">
                      {state.config.heartsTenDouble ? '红桃10翻倍' : '红桃10不翻倍'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/72">
                      {state.config.smallJokerDouble ? '小王翻倍' : '小王不翻倍'}
                    </span>
                  </div>
                </section>

                <section className="rounded-[30px] border border-white/10 bg-black/25 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">房间节奏</p>
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <span>基础分</span>
                      <span className="font-semibold text-white">{state.config.basePoint}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <span>翻倍阈值</span>
                      <span className="font-semibold text-white">{state.config.doubleThreshold}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <span>抽水比例</span>
                      <span className="font-semibold text-white">{state.config.rakePercent}%</span>
                    </div>
                  </div>
                </section>
              </div>
            </section>

            <aside className="space-y-3">
              {state.players.map((player, index) => (
                <div
                  key={player.userId}
                  className={`rounded-[26px] border px-4 py-4 ${
                    index === state.currentPlayerIndex
                      ? 'border-[#d4a017]/30 bg-[#d4a017]/10'
                      : 'border-white/10 bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{player.nickname}</p>
                      <p className="mt-1 text-xs text-white/45">
                        {player.isBot ? 'AI 托管中' : '真人在线'} · 手牌 {player.hand.length}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">积分</p>
                      <p className="mt-1 text-2xl font-black text-[#f6d46c]">{player.score}</p>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={exitRoom}
                className="flex h-14 w-full items-center justify-center rounded-[26px] border border-white/10 bg-white/6 text-sm font-bold text-white transition hover:bg-white/10"
              >
                退出房间
              </button>
            </aside>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(22,72,52,0.98),rgba(7,16,27,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(242,182,79,0.08),_transparent_34%),linear-gradient(180deg,transparent,rgba(0,0,0,0.18))]" />
            <div className="pointer-events-none absolute left-[-15%] top-[58%] h-56 w-56 rounded-full bg-[#103523] opacity-80 blur-3xl" />
            <div className="pointer-events-none absolute right-[-12%] top-[8%] h-52 w-52 rounded-full bg-[#0f2f55] opacity-60 blur-3xl" />

            <div className="relative z-10 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                {opponents.map((player, index) => (
                  <div key={player.userId} className="rounded-[28px] border border-white/10 bg-black/18 p-4 backdrop-blur-sm">
                    <PlayerSeat
                      name={player.nickname}
                      handCount={player.hand.length}
                      huXi={0}
                      menZi={0}
                      score={player.score}
                      isCurrent={state.currentPlayerIndex === index + 1}
                      isBot={player.isBot}
                      align="left"
                    />
                    <div className="mt-4 rounded-[24px] border border-white/8 bg-black/22 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.24em] text-white/38">对手手牌区</p>
                        <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/55">
                          已持牌 {player.hand.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {player.hand.slice(0, 8).map((card) => (
                          <PokerCard key={card.id} card={card} faceDown compact />
                        ))}
                        {player.hand.length > 8 ? (
                          <div className="flex h-14 items-center rounded-xl border border-white/8 bg-white/6 px-3 text-xs font-semibold text-white/72">
                            +{player.hand.length - 8}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <section className="rounded-[32px] border border-[#ebc86c]/16 bg-[radial-gradient(circle_at_center,rgba(21,62,43,0.94),rgba(8,16,28,0.96))] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">中央出牌区</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {state.lastPlay
                        ? `${state.players[state.lastPlay.playerIndex]?.nickname ?? '玩家'} 刚刚出牌`
                        : '本轮还没人出牌'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPattern ? (
                      <span className="rounded-full border border-[#ebc86c]/20 bg-[#ebc86c]/10 px-3 py-1.5 text-xs font-semibold text-[#f6d46c]">
                        已选牌型：{selectedPattern.type}
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white/55">
                        未选择牌组
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 min-h-[220px] rounded-[28px] border border-dashed border-white/12 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5">
                  {state.lastPlay?.cards.length ? (
                    <div className="flex min-h-[180px] flex-wrap items-center justify-center gap-3">
                      {state.lastPlay.cards.map((card) => (
                        <PokerCard key={`last-${card.id}`} card={card} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[180px] items-center justify-center text-center">
                      <div>
                        <p className="text-base font-semibold text-white/72">等待首位玩家出牌</p>
                        <p className="mt-2 text-sm text-white/42">中央会显示上一手牌型，方便判断跟牌和压制关系。</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col gap-4">
            <PlayerSeat
              name={humanPlayer.nickname}
              handCount={humanPlayer.hand.length}
              huXi={0}
              menZi={0}
              score={humanPlayer.score}
              isCurrent={state.currentPlayerIndex === 0}
              align="left"
            />

            <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.22))] p-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-white/40">我的手牌</p>
                  <p className="mt-2 text-sm text-white/60">
                    {state.currentPlayerIndex === 0 ? '现在轮到你组牌出手' : `${currentPlayer?.nickname ?? '玩家'} 正在思考`}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/58">
                  已选 {selectedIds.length} 张
                </span>
              </div>

              <div className="mt-5 overflow-x-auto pb-3">
                <div className="flex min-h-[122px] w-max items-end pr-4">
                  {humanPlayer.hand.map((card, index) => (
                    <div key={card.id} className={index === 0 ? '' : '-ml-4'}>
                      <PokerCard
                        card={card}
                        selected={selectedIds.includes(card.id)}
                        onClick={
                          state.currentPlayerIndex === 0 && state.gamePhase === 'playing'
                            ? handleToggleCard
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.24))] p-4 backdrop-blur-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-white/40">出牌操作</p>
                  <p className="mt-2 text-sm text-white/60">
                    {state.gamePhase === 'finished'
                      ? '本局已结束，可以直接再来一局'
                      : state.currentPlayerIndex === 0
                        ? '提示、跳过和出牌都会即时生效'
                        : '等待其他玩家完成本轮操作'}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/58">
                  {selectedPattern ? `牌型 ${selectedPattern.type}` : '未成组'}
                </span>
              </div>

              <GameActions actions={actionItems} />
            </section>
          </aside>
        </section>
      </main>

      <Settlement
        open={settlementOpen && Boolean(settlementEntry)}
        roomCode={resolvedRoomCode}
        gameTitle={roomTitle}
        summary={settlementEntry?.summary}
        players={settlementEntry?.players ?? []}
        onClose={closeSettlement}
        onReplay={startRound}
      />
    </>
  );
}
