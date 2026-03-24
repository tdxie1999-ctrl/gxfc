'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CardTile from '@/components/game/CardTile';
import GameActions, { type GameActionItem } from '@/components/game/GameActions';
import PlayerSeat from '@/components/game/PlayerSeat';
import ScoreTable from '@/components/game/ScoreTable';
import Settlement from '@/components/game/Settlement';
import { FangpaofaAI } from '@/lib/games/fangpaofa/ai';
import {
  createFangpaofaEngine,
  type FangpaofaGameState,
  type FangpaofaEngine,
} from '@/lib/games/fangpaofa/engine';
import type { FangpaofaPersistPayload } from '@/lib/games/fangpaofa/persistence';
import type { Tile } from '@/lib/games/fangpaofa/rules';
import { useAuthStore } from '@/lib/store/useAuth';
import { useToastStore } from '@/lib/store/useToast';
import { type GameTableRuntimeProps, useGameTableRuntime } from '@/lib/table/runtime';

type FangpaofaTableProps = GameTableRuntimeProps;

function findWeiCandidate(hand: Tile[]): Tile | null {
  const counts = new Map<number, number>();

  for (const tile of hand) {
    counts.set(tile.value, (counts.get(tile.value) ?? 0) + 1);
  }

  const match = hand.find((tile) => (counts.get(tile.value) ?? 0) >= 3);
  return match ?? null;
}

function getSelfActionNames(engine: FangpaofaEngine, state: FangpaofaGameState, playerIndex: number): string[] {
  const actions: string[] = [];

  if (engine.canHu(playerIndex).valid) {
    actions.push('hu');
  }

  if (engine.canTi(playerIndex).length > 0) {
    actions.push('ti');
  }

  const weiCandidate = findWeiCandidate(state.players[playerIndex]?.hand ?? []);

  if (weiCandidate && engine.canWei(playerIndex, weiCandidate)) {
    actions.push('wei');
  }

  return actions;
}

function renderMelds(tiles: Tile[][]) {
  if (tiles.length === 0) {
    return <p className="text-xs text-white/45">当前没有亮出的牌组</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tiles.map((meld, index) => (
        <div key={`${meld[0]?.id ?? index}-${index}`} className="flex gap-1 rounded-xl bg-black/20 p-1.5">
          {meld.map((tile) => (
            <CardTile key={tile.id} tile={tile} compact />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function FangpaofaTable({
  roomId,
  roomCode,
  roomLabel,
  roomConfig,
}: FangpaofaTableProps) {
  const engineRef = useRef<FangpaofaEngine | null>(null);
  const botRegistryRef = useRef<Record<string, FangpaofaAI>>({});
  const persistedSettlementKeyRef = useRef<string | null>(null);
  const [state, setState] = useState<FangpaofaGameState | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const profile = useAuthStore((store) => store.profile);
  const user = useAuthStore((store) => store.user);
  const refreshProfile = useAuthStore((store) => store.refreshProfile);
  const pushToast = useToastStore((store) => store.push);
  const sharedSettlement = useMemo(() => {
    if (!state?.settlement) {
      return null;
    }

    return {
      key: `${roomId}:${state.settlement.reason}:${state.settlement.detail}`,
      summary: state.settlement.detail,
      players: state.settlement.players.map((player, index) => ({
        id: player.userId,
        name: player.nickname,
        avatar: '/assets/avatars/default.png',
        roundDelta: player.netDelta,
        totalScore: player.scoreAfter,
        isWinner: state.settlement?.winnerIndex === index,
      })),
    };
  }, [roomId, state]);
  const {
    initialized,
    room,
    roomCode: resolvedRoomCode,
    roomTitle,
    roomLabel: resolvedRoomLabel,
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
    fallbackTitle: '娄底放炮罚',
    fallbackLabel: '放炮罚牌桌',
    initialStatusText: '正在初始化放炮罚牌桌...',
    settlement: sharedSettlement,
  });

  const syncState = useCallback(() => {
    if (!engineRef.current) {
      return;
    }

    setSelectedTileId(null);
    setState(engineRef.current.getState());
  }, []);

  const startRound = useCallback(() => {
    const engine = createFangpaofaEngine();
    engine.initialize(3, undefined, [
      { userId: `${roomId}-human`, nickname: '你', isBot: false },
      { userId: `${roomId}-bot-1`, nickname: '风生水起', isBot: true },
      { userId: `${roomId}-bot-2`, nickname: '财运常来', isBot: true },
    ]);
    engine.deal();
    engineRef.current = engine;
    botRegistryRef.current = {
      [`${roomId}-bot-1`]: new FangpaofaAI('normal'),
      [`${roomId}-bot-2`]: new FangpaofaAI('normal'),
    };
    persistedSettlementKeyRef.current = null;
    syncState();
  }, [roomId, syncState]);

  useEffect(() => {
    startRound();
  }, [startRound]);

  const runBotTurn = useCallback(() => {
    const engine = engineRef.current;

    if (!engine) {
      return;
    }

    let snapshot = engine.getState();

    if (snapshot.gamePhase !== 'playing') {
      syncState();
      return;
    }

    let currentPlayer = snapshot.players[snapshot.currentPlayerIndex];

    if (!currentPlayer?.isBot) {
      return;
    }

    const bot = botRegistryRef.current[currentPlayer.userId] ?? new FangpaofaAI('normal');

    if (snapshot.turnStage === 'draw') {
      engine.drawTile(snapshot.currentPlayerIndex);
      snapshot = engine.getState();
      currentPlayer = snapshot.players[snapshot.currentPlayerIndex];
    }

    if (snapshot.gamePhase !== 'playing' || !currentPlayer?.isBot) {
      syncState();
      return;
    }

    const selfActions = getSelfActionNames(engine, snapshot, snapshot.currentPlayerIndex);
    const chosenAction = bot.decideAction(selfActions, snapshot);

    if (chosenAction === 'hu') {
      engine.executeHu(snapshot.currentPlayerIndex);
    } else if (chosenAction === 'ti') {
      const options = engine.canTi(snapshot.currentPlayerIndex);
      if (options[0]) {
        engine.executeTi(snapshot.currentPlayerIndex, options[0]);
      }
    } else if (chosenAction === 'wei') {
      const weiCandidate = findWeiCandidate(engine.getState().players[snapshot.currentPlayerIndex].hand);
      if (weiCandidate) {
        engine.executeWei(snapshot.currentPlayerIndex, weiCandidate);
      }
    }

    snapshot = engine.getState();

    if (snapshot.gamePhase !== 'playing') {
      syncState();
      return;
    }

    currentPlayer = snapshot.players[snapshot.currentPlayerIndex];

    if (!currentPlayer?.isBot || snapshot.turnStage !== 'discard') {
      syncState();
      return;
    }

    const discardId = bot.decideTile(currentPlayer.hand, currentPlayer.melds, snapshot);

    if (discardId !== null) {
      engine.discardTile(snapshot.currentPlayerIndex, discardId);
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

    const delay = 900 + Math.floor(Math.random() * 900);
    const timer = window.setTimeout(() => {
      runBotTurn();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [runBotTurn, state]);

  const currentPlayer = state?.players[state.currentPlayerIndex] ?? null;
  const humanPlayer = state?.players[0] ?? null;
  const pendingReaction = state?.pendingReaction ?? null;
  const canReact = Boolean(
    state &&
      humanPlayer &&
      state.gamePhase === 'playing' &&
      pendingReaction &&
      pendingReaction.playerIndex === 0
  );
  const canTakeTurn = Boolean(
    state &&
      humanPlayer &&
      state.gamePhase === 'playing' &&
      state.currentPlayerIndex === 0 &&
      !pendingReaction
  );
  const tiOptions = useMemo(() => {
    if (!state || !engineRef.current || !canTakeTurn) {
      return [];
    }

    return engineRef.current.canTi(0);
  }, [canTakeTurn, state]);
  const canHu = useMemo(() => {
    if (!state || !engineRef.current || !canTakeTurn) {
      return false;
    }

    return engineRef.current.canHu(0).valid;
  }, [canTakeTurn, state]);
  const weiCandidate = useMemo(() => {
    if (!state || !canTakeTurn || state.turnStage !== 'discard') {
      return null;
    }

    return findWeiCandidate(state.players[0].hand);
  }, [canTakeTurn, state]);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.gamePhase === 'finished') {
      setStatusText(state.settlement?.detail ?? '本局已结束，等待下一局');
      return;
    }

    if (pendingReaction?.playerIndex === 0) {
      setStatusText(
        `等待你响应 ${state.players[pendingReaction.sourcePlayerIndex]?.nickname ?? '对手'} 打出的 ${pendingReaction.tile.display}`,
      );
      return;
    }

    setStatusText(
      `当前轮到：${currentPlayer?.nickname ?? '未知'} / ${state.turnStage === 'draw' ? '摸牌阶段' : '出牌阶段'}`,
    );
  }, [currentPlayer?.nickname, pendingReaction, setStatusText, state]);

  useEffect(() => {
    if (!state?.settlement) {
      persistedSettlementKeyRef.current = null;
      return;
    }

    const settlementKey = JSON.stringify({
      roomId,
      winnerIndex: state.settlement.winnerIndex,
      detail: state.settlement.detail,
      players: state.settlement.players.map((player) => ({
        userId: player.userId,
        netDelta: player.netDelta,
        scoreAfter: player.scoreAfter,
      })),
    });

    if (persistedSettlementKeyRef.current === settlementKey) {
      return;
    }

    persistedSettlementKeyRef.current = settlementKey;

    let cancelled = false;

    const payload: FangpaofaPersistPayload = {
      action: 'fangpaofa_settle',
      humanProfileId: profile?.id ?? user?.id ?? null,
      room: {
        localRoomId: roomId,
        roomCode: resolvedRoomCode,
        label: resolvedRoomLabel,
        baseScore: room?.baseScore ?? 0,
        maxPlayers: room?.maxPlayers ?? 3,
      },
      roundNumber: state.roundNumber,
      config: state.config,
      winnerIndex: state.winnerIndex,
      settlement: state.settlement,
      players: state.players.map((player) => ({
        userId: player.userId,
        nickname: player.nickname,
        isBot: player.isBot,
        isDealer: player.isDealer,
        huXi: player.huXi,
        menZi: player.menZi,
        score: player.score,
        handCount: player.hand.length,
        melds: player.melds.map((meld) => ({
          type: meld.type,
          values: meld.tiles.map((tile) => tile.value),
          huXi: meld.huXi,
        })),
      })),
      actionLog: state.actionLog,
      discardValues: state.discardPile.map((tile) => tile.value),
      deckRemainder: state.deck.length,
      finishedAt: new Date().toISOString(),
    };

    const persistSettlement = async () => {
      try {
        const response = await fetch('/api/game', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              reason?: string;
              skipped?: boolean;
              updatedBalance?: number | null;
            }
          | null;

        if (!response.ok || !result?.ok) {
          throw new Error(result?.reason || '放炮罚结算写入失败');
        }

        if (!cancelled) {
          const message = result.skipped
            ? '放炮罚战绩已写入 game_rounds，余额日志因缺少真实账号信息已跳过'
            : '放炮罚战绩与余额流水已写入 Supabase';
          setStatusText(message);
          pushToast('放炮罚结算已入库', 'success', 1800);
        }

        if (result.updatedBalance !== null && result.updatedBalance !== undefined && user) {
          await refreshProfile();
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : '放炮罚结算写入失败';
          setStatusText(message);
          pushToast(message, 'error', 2800);
        }
      }
    };

    void persistSettlement();

    return () => {
      cancelled = true;
    };
  }, [
    profile?.id,
    pushToast,
    refreshProfile,
    resolvedRoomCode,
    resolvedRoomLabel,
    room?.baseScore,
    room?.maxPlayers,
    roomId,
    setStatusText,
    state,
    user,
  ]);

  const handleDraw = useCallback(() => {
    if (!engineRef.current || !state || !canTakeTurn) {
      return;
    }

    engineRef.current.drawTile(0);
    syncState();
  }, [canTakeTurn, state, syncState]);

  const handleDiscard = useCallback(() => {
    if (!engineRef.current || selectedTileId === null || !canTakeTurn) {
      return;
    }

    engineRef.current.discardTile(0, selectedTileId);
    syncState();
  }, [canTakeTurn, selectedTileId, syncState]);

  const handleHu = useCallback(() => {
    if (!engineRef.current || !canTakeTurn) {
      return;
    }

    engineRef.current.executeHu(0);
    syncState();
  }, [canTakeTurn, syncState]);

  const handleTi = useCallback(() => {
    if (!engineRef.current || !canTakeTurn) {
      return;
    }

    const options = engineRef.current.canTi(0);

    if (options[0]) {
      engineRef.current.executeTi(0, options[0]);
      syncState();
    }
  }, [canTakeTurn, syncState]);

  const handleWei = useCallback(() => {
    if (!engineRef.current || !canTakeTurn || !humanPlayer) {
      return;
    }

    const candidate = findWeiCandidate(humanPlayer.hand);

    if (candidate) {
      engineRef.current.executeWei(0, candidate);
      syncState();
    }
  }, [canTakeTurn, humanPlayer, syncState]);

  const handleReaction = useCallback(
    (actionKey: string) => {
      if (!engineRef.current || !canReact) {
        return;
      }

      engineRef.current.resolvePendingReaction(0, actionKey);
      syncState();
    },
    [canReact, syncState]
  );

  const handleReactionPass = useCallback(() => {
    if (!engineRef.current || !canReact) {
      return;
    }

    engineRef.current.passPendingReaction(0);
    syncState();
  }, [canReact, syncState]);

  const actionItems = useMemo<GameActionItem[]>(() => {
    if (!state) {
      return [];
    }

    if (canReact && pendingReaction) {
      return [
        ...pendingReaction.actions.map((action) => ({
          key: action.key,
          label: action.label,
          onClick: () => handleReaction(action.key),
          variant: action.type === 'hu' ? ('danger' as const) : ('primary' as const),
        })),
        {
          key: 'reaction-pass',
          label: '过',
          onClick: handleReactionPass,
          variant: 'secondary' as const,
        },
      ];
    }

    if (!canTakeTurn) {
      return state?.gamePhase === 'finished'
        ? [{ key: 'restart', label: '再来一局', onClick: startRound, variant: 'primary' }]
        : [];
    }

    const items: GameActionItem[] = [];

    if (state.turnStage === 'draw') {
      items.push({ key: 'draw', label: '摸牌', onClick: handleDraw, variant: 'primary' });
      return items;
    }

    if (canHu) {
      items.push({ key: 'hu', label: '胡', onClick: handleHu, variant: 'danger' });
    }

    if (tiOptions.length > 0) {
      items.push({ key: 'ti', label: '提', onClick: handleTi, variant: 'primary' });
    }

    if (weiCandidate) {
      items.push({ key: 'wei', label: '偎', onClick: handleWei, variant: 'secondary' });
    }

    items.push({
      key: 'discard',
      label: '出牌',
      onClick: handleDiscard,
      disabled: selectedTileId === null,
      variant: 'primary',
    });

    return items;
  }, [
    canHu,
    canReact,
    canTakeTurn,
    handleDiscard,
    handleDraw,
    handleHu,
    handleReaction,
    handleReactionPass,
    handleTi,
    handleWei,
    pendingReaction,
    selectedTileId,
    startRound,
    state,
    tiOptions.length,
    weiCandidate,
  ]);

  if ((!initialized && !state) || !state || !humanPlayer) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-lg font-semibold text-white/80">
        正在初始化放炮罚牌桌...
      </div>
    );
  }

  const opponents = state.players.slice(1);
  return (
    <>
      <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-4 px-3 py-4 md:px-5 md:py-5">
        <header className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_380px]">
          <section className="overflow-hidden rounded-[34px] border border-white/15 bg-[linear-gradient(135deg,rgba(13,28,45,0.96),rgba(8,20,32,0.88))] shadow-[0_26px_54px_rgba(0,0,0,0.28)]">
            <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(212,160,23,0.12),transparent_34%)] px-5 py-5 md:px-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#f0c252]/35 bg-[#f0c252]/10 px-3 py-1 text-xs font-semibold tracking-[0.22em] text-[#f6d46c]">
                      真实牌局
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/55">
                      娄底放炮罚
                    </span>
                  </div>
                  <h1 className="brand-gold-text mt-4 text-3xl font-black tracking-[0.18em] md:text-4xl">{roomTitle}</h1>
                  <p className="mt-2 text-sm text-white/70">
                    {resolvedRoomLabel} · 房号 {resolvedRoomCode}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: '当前轮到', value: currentPlayer?.nickname ?? '未知' },
                    { label: '阶段', value: state.turnStage === 'draw' ? '摸牌' : '出牌' },
                    { label: '牌墙', value: String(state.deck.length) },
                    { label: '起胡', value: `${state.config.minHuXi}息` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-white/10 bg-black/25 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{item.label}</p>
                      <p className="mt-2 text-xl font-black text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.18))] px-4 py-4 md:px-5">
                <p className="text-xs uppercase tracking-[0.24em] text-white/35">局内播报</p>
                <p className="mt-3 text-2xl font-black text-white">{state.lastAction}</p>
                <p className="mt-2 text-sm text-white/65">{statusText}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/78">有炮必接</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/78">优先级 胡 &gt; 跑 &gt; 碰 &gt; 吃</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/78">AI 自动响应</span>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 self-start xl:sticky xl:top-4">
            <ScoreTable
              players={state.players.map((player, index) => ({
                userId: player.userId,
                nickname: player.nickname,
                score: player.score,
                huXi: player.huXi,
                menZi: player.menZi,
                isCurrent: index === state.currentPlayerIndex,
              }))}
            />

            <section className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.22))] p-4 backdrop-blur-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '弃牌', value: String(state.discardPile.length) },
                  { label: '轮次', value: `${state.roundNumber}局` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{item.label}</p>
                    <p className="mt-2 text-xl font-black text-[#f6d46c]">{item.value}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={exitRoom}
                className="mt-4 h-12 w-full rounded-2xl border border-white/12 bg-white/8 text-sm font-bold text-white transition hover:bg-white/12"
              >
                退出房间
              </button>
            </section>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_380px]">
          <div className="space-y-4">
            <section className="rounded-[34px] border border-[#52c37c]/20 bg-[linear-gradient(180deg,rgba(18,65,44,0.58),rgba(7,24,17,0.82))] p-4 shadow-[0_20px_46px_rgba(0,0,0,0.22)] backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">对手区域</p>
                  <p className="mt-1 text-sm text-white/72">看牌势、看亮牌、看谁准备放炮</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs text-[#d7f0e2]">
                  共 {opponents.length} 位对手
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {opponents.map((player, index) => (
                  <div key={player.userId} className="rounded-[30px] border border-white/10 bg-black/18 p-3">
                    <PlayerSeat
                      name={player.nickname}
                      handCount={player.hand.length}
                      huXi={player.huXi}
                      menZi={player.menZi}
                      score={player.score}
                      isCurrent={state.currentPlayerIndex === index + 1}
                      isDealer={player.isDealer}
                      isBot={player.isBot}
                      align={index === 0 ? 'left' : 'right'}
                    />
                    <div className="mt-3 rounded-[24px] border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">亮牌 / 门子</p>
                      <div className="mt-3">{renderMelds(player.melds.map((meld) => meld.tiles))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.26))] p-4 backdrop-blur-sm">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="rounded-[28px] border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/45">中央牌桌</p>
                      <p className="mt-1 text-sm text-white/68">当前桌面最新动作和接炮机会都显示在这里</p>
                    </div>
                    <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/58">
                      {pendingReaction?.playerIndex === 0 ? '等待你响应' : '桌面平稳'}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[28px] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(13,28,45,0.84),rgba(7,16,27,0.92))] p-4">
                    <div className="flex min-h-[124px] flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs text-white/45">上一手出牌</p>
                        <div className="mt-3 flex items-center gap-3">
                          {state.lastDiscard ? (
                            <>
                              <CardTile tile={state.lastDiscard.tile} compact />
                              <div>
                                <p className="text-base font-semibold text-white">
                                  {state.players[state.lastDiscard.playerIndex]?.nickname}
                                </p>
                                <p className="mt-1 text-sm text-white/60">
                                  打出「{state.lastDiscard.tile.display}」
                                </p>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-white/45">等待首张出牌</p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:text-right">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                          AI 会在 0.9 - 1.8 秒内自动响应
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                          当前优先级：胡 &gt; 跑 &gt; 碰 &gt; 吃
                        </div>
                      </div>
                    </div>
                  </div>

                  {pendingReaction?.playerIndex === 0 ? (
                    <div className="mt-4 rounded-2xl border border-[#D4A017]/25 bg-[#D4A017]/10 px-4 py-3 text-sm text-[#f7dd86]">
                      你可以对 {state.players[pendingReaction.sourcePlayerIndex]?.nickname ?? '对手'} 打出的
                      「{pendingReaction.tile.display}」进行响应。
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[28px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">最近操作</p>
                      <p className="mt-1 text-sm text-white/65">保留最近节奏，方便判断牌势</p>
                    </div>
                    <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/55">
                      {state.actionLog.length} 条
                    </span>
                  </div>
                  <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                    {state.actionLog.map((entry) => (
                      <div key={entry} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white/82">
                        {entry}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4 self-start xl:sticky xl:top-4">
            <PlayerSeat
              name={humanPlayer.nickname}
              handCount={humanPlayer.hand.length}
              huXi={humanPlayer.huXi}
              menZi={humanPlayer.menZi}
              score={humanPlayer.score}
              isCurrent={state.currentPlayerIndex === 0}
              isDealer={humanPlayer.isDealer}
              isBot={false}
              align="left"
            />

            <section className="rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.22))] p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">你的亮牌区</p>
              <div className="mt-3">{renderMelds(humanPlayer.melds.map((meld) => meld.tiles))}</div>
            </section>

            <section className="rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.24))] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">你的手牌</p>
                  <p className="mt-1 text-sm text-white/65">点击牌张选择出牌，竖屏会自动横向滚动</p>
                </div>
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/55">
                  {selectedTileId === null ? '未选牌' : '已选1张'}
                </span>
              </div>

              <div className="mt-4 overflow-x-auto pb-2">
                <div className="flex w-max gap-2">
                  {humanPlayer.hand.map((tile) => (
                    <CardTile
                      key={tile.id}
                      tile={tile}
                      selected={selectedTileId === tile.id}
                      disabled={!canTakeTurn || state.turnStage !== 'discard'}
                      onClick={() => {
                        if (!canTakeTurn || state.turnStage !== 'discard') {
                          return;
                        }

                        setSelectedTileId((current) => (current === tile.id ? null : tile.id));
                      }}
                    />
                  ))}
                </div>
              </div>
            </section>

            <GameActions actions={actionItems} />
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
