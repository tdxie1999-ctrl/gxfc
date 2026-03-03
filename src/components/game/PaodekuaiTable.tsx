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
      <main className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
        <header className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-3xl border border-white/15 bg-black/30 p-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/50">Phase 5 / 跑得快</p>
                <h1 className="brand-gold-text mt-1 text-2xl font-black tracking-[0.2em]">{roomTitle}</h1>
                <p className="mt-1 text-xs text-white/45">
                  {resolvedRoomLabel} · 房号 {resolvedRoomCode}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                <span>牌型 {formatPatternName(state)}</span>
                <span>剩余弃牌 {state.deckRemainder.length}</span>
                <span>当前 {currentPlayer?.nickname ?? '未知'}</span>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-white/5 p-3 text-sm text-white/80">
              <p>{state.lastAction}</p>
              <p className="mt-1 text-xs text-white/55">{statusText}</p>
              <p className="mt-1 text-xs text-white/55">
                规则：{state.config.cardCount}张 / {state.config.fourWithThree ? '四带三' : '四带二'} /{' '}
                {state.config.heartsTenDouble ? '红桃10翻倍' : '红桃10不翻倍'} /{' '}
                {state.config.smallJokerDouble ? '小王翻倍' : '小王不翻倍'} / 托管 {state.config.autoPlaySeconds}s
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={exitRoom}
                className="rounded-xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white"
              >
                退出房间
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/15 bg-black/30 backdrop-blur-sm">
            <table className="w-full text-left text-sm text-white/85">
              <thead className="bg-white/10 text-xs uppercase tracking-[0.2em] text-white/60">
                <tr>
                  <th className="px-3 py-2">玩家</th>
                  <th className="px-3 py-2">手牌</th>
                  <th className="px-3 py-2">积分</th>
                </tr>
              </thead>
              <tbody>
                {state.players.map((player, index) => (
                  <tr
                    key={player.userId}
                    className={index === state.currentPlayerIndex ? 'bg-[#D4A017]/10' : 'border-t border-white/10'}
                  >
                    <td className="px-3 py-2 font-medium">{player.nickname}</td>
                    <td className="px-3 py-2">{player.hand.length}</td>
                    <td className="px-3 py-2">{player.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              {opponents.map((player, index) => (
                <div key={player.userId} className="space-y-3">
                  <PlayerSeat
                    name={player.nickname}
                    handCount={player.hand.length}
                    huXi={0}
                    menZi={0}
                    score={player.score}
                    isCurrent={state.currentPlayerIndex === index + 1}
                    isBot={player.isBot}
                  />
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 text-xs text-white/60">对手手牌</div>
                    <div className="flex flex-wrap gap-1.5">
                      {player.hand.slice(0, 8).map((card) => (
                        <PokerCard key={card.id} card={card} faceDown compact />
                      ))}
                      {player.hand.length > 8 ? (
                        <div className="flex items-center rounded-lg bg-white/10 px-2 text-xs text-white/70">
                          +{player.hand.length - 8}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <section className="rounded-3xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/50">中央出牌区</p>
                  <p className="mt-1 text-sm text-white/70">
                    {state.lastPlay
                      ? `${state.players[state.lastPlay.playerIndex]?.nickname ?? '玩家'} 上一手`
                      : '当前无人出牌'}
                  </p>
                </div>
                {selectedPattern ? (
                  <span className="rounded-full bg-[#D4A017]/20 px-3 py-1 text-xs text-[#f6d46c]">
                    已选牌型：{selectedPattern.type}
                  </span>
                ) : (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">未选择牌组</span>
                )}
              </div>

              <div className="min-h-[88px] rounded-2xl border border-dashed border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap gap-2">
                  {state.lastPlay?.cards.map((card) => <PokerCard key={`last-${card.id}`} card={card} />)}
                </div>
              </div>
            </section>
          </div>

          <section className="space-y-4">
            <PlayerSeat
              name={humanPlayer.nickname}
              handCount={humanPlayer.hand.length}
              huXi={0}
              menZi={0}
              score={humanPlayer.score}
              isCurrent={state.currentPlayerIndex === 0}
            />

            <section className="rounded-3xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-white/50">我的手牌</p>
              <div className="mt-4 overflow-x-auto pb-2">
                <div className="flex min-h-[92px] w-max items-end">
                  {humanPlayer.hand.map((card, index) => (
                    <div key={card.id} className={index === 0 ? '' : '-ml-5'}>
                      <PokerCard
                        card={card}
                        selected={selectedIds.includes(card.id)}
                        onClick={state.currentPlayerIndex === 0 && state.gamePhase === 'playing' ? handleToggleCard : undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <GameActions actions={actionItems} />
          </section>
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
