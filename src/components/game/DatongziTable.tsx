'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { botAvatars } from '@/lib/bot/avatars';
import GameActions, { type GameActionItem } from '@/components/game/GameActions';
import PlayerSeat from '@/components/game/PlayerSeat';
import PokerCard from '@/components/game/PokerCard';
import Settlement from '@/components/game/Settlement';
import { DatongziAI } from '@/lib/games/datongzi/ai';
import {
  createDatongziEngine,
  type DatongziEngine,
  type DatongziGameState,
} from '@/lib/games/datongzi/engine';
import { getDatongziPattern } from '@/lib/games/datongzi/rules';
import { useAuthStore } from '@/lib/store/useAuth';
import { useGameStore } from '@/lib/store/useGame';
import { useToastStore } from '@/lib/store/useToast';

type TablePhase = 'waiting' | 'dealing' | 'playing';

interface DatongziTableProps {
  roomId: string;
  roomCode?: string;
  roomLabel?: string;
  roomConfig?: Record<string, unknown>;
}

function getNumberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrentPattern(state: DatongziGameState | null) {
  if (!state?.lastPlay) {
    return '等待领牌';
  }

  return state.lastPlay.pattern.label;
}

export default function DatongziTable({
  roomId,
  roomCode,
  roomLabel,
  roomConfig,
}: DatongziTableProps) {
  const router = useRouter();
  const setCurrentRoomId = useGameStore((store) => store.setCurrentRoomId);
  const profile = useAuthStore((store) => store.profile);
  const pushToast = useToastStore((store) => store.push);
  const engineRef = useRef<DatongziEngine | null>(null);
  const aiRef = useRef<Record<string, DatongziAI>>({});
  const [state, setState] = useState<DatongziGameState | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [tablePhase, setTablePhase] = useState<TablePhase>('waiting');
  const [statusText, setStatusText] = useState('等待所有玩家准备中...');
  const [selfReady, setSelfReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [dealingProgress, setDealingProgress] = useState(0);
  const [showSettlement, setShowSettlement] = useState(false);

  const safeRoomCode = roomCode ?? roomId.slice(-6);
  const opponentName = '招财阿福';

  const engineConfig = useMemo(() => {
    const datongziConfig =
      roomConfig && typeof roomConfig.datongzi === 'object' && roomConfig.datongzi
        ? (roomConfig.datongzi as Record<string, unknown>)
        : roomConfig ?? {};

    return {
      handCardCount: Math.max(8, Math.min(24, getNumberValue(datongziConfig.handCardCount, 24))),
      basePoint: Math.max(1, getNumberValue(datongziConfig.basePoint, 2)),
      autoPlaySeconds: Math.max(3, getNumberValue(datongziConfig.autoPlaySeconds, 8)),
    } as const;
  }, [roomConfig]);

  const ruleLines = useMemo(() => {
    const config = roomConfig ?? {};
    const datongziConfig =
      roomConfig && typeof roomConfig.datongzi === 'object' && roomConfig.datongzi
        ? (roomConfig.datongzi as Record<string, unknown>)
        : {};

    return [
      '2人场，房主付',
      `抓鸟 ${String(config.birdRule ?? '2鸟')}`,
      `${String(config.autoTrustee ?? '2分钟')}后托管`,
      `少于 ${String(config.doubleThreshold ?? 10)} 分翻倍`,
      `积分底分 x${getNumberValue(datongziConfig.basePoint ?? config.baseScore, 2)}`,
    ];
  }, [roomConfig]);

  const syncState = useCallback(() => {
    if (!engineRef.current) {
      return;
    }

    const snapshot = engineRef.current.getState();
    const currentHandIds = new Set(snapshot.players[0]?.hand.map((card) => card.id) ?? []);

    setSelectedIds((current) => current.filter((cardId) => currentHandIds.has(cardId)));
    setState(snapshot);
  }, []);

  const handleExit = useCallback(() => {
    setCurrentRoomId(null);
    router.push('/hall');
  }, [router, setCurrentRoomId]);

  const resetToWaiting = useCallback(() => {
    engineRef.current = null;
    aiRef.current = {};
    setState(null);
    setSelectedIds([]);
    setTablePhase('waiting');
    setStatusText('等待所有玩家准备中...');
    setSelfReady(false);
    setOpponentReady(false);
    setDealingProgress(0);
    setShowSettlement(false);
  }, []);

  const startRound = useCallback(() => {
    const engine = createDatongziEngine(engineConfig);

    engine.initialize(2, [
      { userId: `${roomId}-human`, nickname: '你', isBot: false },
      { userId: `${roomId}-bot-1`, nickname: opponentName, isBot: true },
    ]);
    engine.deal();

    engineRef.current = engine;
    aiRef.current = {
      [`${roomId}-bot-1`]: new DatongziAI('normal'),
    };
    setSelectedIds([]);
    setShowSettlement(false);
    setTablePhase('playing');
    syncState();
  }, [engineConfig, roomId, syncState]);

  const beginDealSequence = useCallback((source: 'ready' | 'replay') => {
    setState(null);
    setSelectedIds([]);
    setShowSettlement(false);
    setTablePhase('dealing');
    setDealingProgress(0);
    setStatusText(source === 'replay' ? '开始新一局，正在洗牌发牌...' : '双方已准备，正在洗牌发牌...');
  }, []);

  useEffect(() => {
    resetToWaiting();
  }, [resetToWaiting, roomId]);

  useEffect(() => {
    if (tablePhase !== 'waiting' || !selfReady || opponentReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      setOpponentReady(true);
      setStatusText(`${opponentName} 已准备`);
    }, 900 + Math.floor(Math.random() * 900));

    return () => window.clearTimeout(timer);
  }, [opponentReady, opponentName, selfReady, tablePhase]);

  useEffect(() => {
    if (tablePhase !== 'waiting' || !selfReady || !opponentReady) {
      return;
    }

    beginDealSequence('ready');
  }, [beginDealSequence, opponentReady, selfReady, tablePhase]);

  useEffect(() => {
    if (tablePhase !== 'dealing') {
      return;
    }

    if (dealingProgress >= 100) {
      startRound();
      return;
    }

    const nextProgress = Math.min(100, dealingProgress + 20);
    const timer = window.setTimeout(() => {
      setDealingProgress(nextProgress);
      setStatusText(nextProgress >= 100 ? '发牌完成，开始出牌' : `正在发牌... ${nextProgress}%`);
    }, 140);

    return () => window.clearTimeout(timer);
  }, [dealingProgress, startRound, tablePhase]);

  useEffect(() => {
    if (!state?.settlement) {
      return;
    }

    setShowSettlement(true);
    setStatusText(state.settlement.summary);
  }, [state?.settlement]);

  const handleToggleCard = useCallback((cardId: number) => {
    if (tablePhase !== 'playing') {
      return;
    }

    setSelectedIds((current) =>
      current.includes(cardId) ? current.filter((item) => item !== cardId) : [...current, cardId],
    );
  }, [tablePhase]);

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

    const played = engineRef.current.playCards(0, selectedIds);

    if (!played) {
      return;
    }

    syncState();
  }, [selectedIds, state, syncState]);

  const handlePass = useCallback(() => {
    if (!engineRef.current || !state || state.currentPlayerIndex !== 0) {
      return;
    }

    const passed = engineRef.current.pass(0);

    if (!passed) {
      return;
    }

    setSelectedIds([]);
    syncState();
  }, [state, syncState]);

  const handlePrepare = useCallback(() => {
    if (tablePhase !== 'waiting') {
      return;
    }

    setSelfReady((current) => {
      const next = !current;

      if (!next) {
        setOpponentReady(false);
        setStatusText('等待所有玩家准备中...');
      } else {
        setStatusText('你已准备，等待对手...');
      }

      return next;
    });
  }, [tablePhase]);

  const handleReplay = useCallback(() => {
    setSelfReady(true);
    setOpponentReady(true);
    beginDealSequence('replay');
  }, [beginDealSequence]);

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

    const ai = aiRef.current[currentPlayer.userId] ?? new DatongziAI('normal');
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
    if (!state || tablePhase !== 'playing' || state.gamePhase !== 'playing') {
      return;
    }

    const currentPlayer = state.players[state.currentPlayerIndex];

    if (!currentPlayer?.isBot) {
      return;
    }

    const timer = window.setTimeout(() => {
      runBotTurn();
    }, 700 + Math.floor(Math.random() * 700));

    return () => window.clearTimeout(timer);
  }, [runBotTurn, state, tablePhase]);

  const humanPlayer = state?.players[0] ?? null;
  const opponent = state?.players[1] ?? null;
  const currentPlayer = state?.players[state.currentPlayerIndex] ?? null;

  const selectedPattern = useMemo(() => {
    if (!humanPlayer || selectedIds.length === 0) {
      return null;
    }

    const cards = humanPlayer.hand.filter((card) => selectedIds.includes(card.id));
    return getDatongziPattern(cards);
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

  const settlementPlayers = useMemo(() => {
    if (!state?.settlement) {
      return [];
    }

    return state.players.map((player, index) => ({
      id: player.userId,
      name: player.nickname,
      avatar:
        index === 0
          ? profile?.avatar_url ?? '/assets/avatars/default.png'
          : botAvatars[index % botAvatars.length] ?? '/assets/avatars/default.png',
      roundDelta: state.settlement?.deltas[index] ?? 0,
      totalScore: player.score,
      isWinner: index === state.winnerIndex,
    }));
  }, [profile?.avatar_url, state]);

  const actionItems = useMemo<GameActionItem[]>(() => {
    if (!state) {
      return [];
    }

    if (state.gamePhase === 'finished') {
      return [{ key: 'restart', label: '再来一局', onClick: handleReplay, variant: 'primary' }];
    }

    if (state.currentPlayerIndex !== 0) {
      return [];
    }

    return [
      { key: 'hint', label: '提示', onClick: handleHint, variant: 'secondary' },
      {
        key: 'pass',
        label: canPass ? '过牌' : '不能过',
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
  }, [canPass, canPlay, handleHint, handlePass, handlePlay, handleReplay, state]);

  const waitingHandCount = tablePhase === 'dealing'
    ? Math.floor((engineConfig.handCardCount * dealingProgress) / 100)
    : 0;

  if (tablePhase !== 'playing' || !state || !humanPlayer || !opponent) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-[1360px] flex-col gap-4 px-3 py-4 md:px-5 md:py-5">
        <header className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <section className="overflow-hidden rounded-[34px] border border-white/15 bg-[linear-gradient(135deg,rgba(13,28,45,0.96),rgba(8,20,32,0.88))] shadow-[0_24px_52px_rgba(0,0,0,0.28)]">
            <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(212,160,23,0.12),transparent_36%)] px-5 py-5 md:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#f0c252]/35 bg-[#f0c252]/10 px-3 py-1 text-xs font-semibold tracking-[0.22em] text-[#f6d46c]">
                      双人对局
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/55">
                      打筒子
                    </span>
                  </div>
                  <h1 className="brand-gold-text mt-4 text-3xl font-black tracking-[0.2em] md:text-4xl">房号 {safeRoomCode}</h1>
                  <p className="mt-2 text-sm text-white/70">
                    {roomLabel || '双人抢分房'} · 开桌后自动发牌，进入真实出牌流程
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '状态', value: tablePhase === 'waiting' ? '待准备' : '发牌中' },
                    { label: '底分', value: `${engineConfig.basePoint}分` },
                    { label: '手牌数', value: `${engineConfig.handCardCount}张` },
                    { label: '托管', value: `${engineConfig.autoPlaySeconds}s` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[22px] border border-white/10 bg-black/25 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{item.label}</p>
                      <p className="mt-2 text-xl font-black text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.18))] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-white/35">开桌播报</p>
                <p className="mt-3 text-2xl font-black text-white">{statusText}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ruleLines.map((rule) => (
                    <span key={rule} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/78">
                      {rule}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 self-start xl:sticky xl:top-4">
            <PlayerSeat
              name={opponentName}
              handCount={waitingHandCount}
              huXi={0}
              menZi={0}
              score={0}
              isBot
              isCurrent={false}
            />

            <PlayerSeat
              name={profile?.nickname ?? '你'}
              handCount={waitingHandCount}
              huXi={0}
              menZi={0}
              score={0}
              isCurrent={false}
            />
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.24))] p-5 backdrop-blur-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl">
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">开局阶段</p>
                <h2 className="mt-2 text-2xl font-black text-white">对家就位后自动切牌发牌</h2>
                <p className="mt-3 text-sm leading-7 text-white/68">
                  这张桌现在走完整房间流程：准备、补位、发牌、出牌、结算。等待时会展示双方准备状态，发牌中则显示进度。
                </p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/20 px-5 py-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">桌面阶段</p>
                <p className="mt-2 text-3xl font-black text-[#f6d46c]">{tablePhase === 'waiting' ? 'WAIT' : 'DEAL'}</p>
              </div>
            </div>

            <div className="mt-6 rounded-[30px] border border-white/10 bg-black/20 p-5">
              {tablePhase === 'dealing' ? (
                <>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#F2994A] to-[#F2C94C]"
                      style={{ width: `${dealingProgress}%` }}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm text-white/72">
                    <span>正在切牌发牌</span>
                    <span>{dealingProgress}%</span>
                  </div>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">你的状态</p>
                    <p className="mt-2 text-xl font-black text-white">{selfReady ? '已准备' : '待准备'}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">对家状态</p>
                    <p className="mt-2 text-xl font-black text-white">{opponentReady ? '已准备' : '待准备'}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.24))] p-4 backdrop-blur-sm">
            {tablePhase === 'waiting' ? (
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={handlePrepare}
                  className={`h-12 rounded-2xl text-sm font-bold text-white ${
                    selfReady
                      ? 'border border-white/15 bg-white/10'
                      : 'bg-gradient-to-r from-[#F2994A] to-[#F2C94C] text-[#2c1b04]'
                  }`}
                >
                  {selfReady ? '取消准备' : '准备开局'}
                </button>
                <button
                  type="button"
                  onClick={handleExit}
                  className="h-12 rounded-2xl border border-white/12 bg-white/8 text-sm font-bold text-white transition hover:bg-white/12"
                >
                  退出房间
                </button>
              </div>
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/72">
                发牌完成后自动进入出牌阶段，不需要额外点击开始。
              </div>
            )}
          </section>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-4 px-3 py-4 md:px-5 md:py-5">
        <header className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <section className="overflow-hidden rounded-[34px] border border-white/15 bg-[linear-gradient(135deg,rgba(13,28,45,0.96),rgba(8,20,32,0.88))] shadow-[0_24px_52px_rgba(0,0,0,0.28)]">
            <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(212,160,23,0.12),transparent_36%)] px-5 py-5 md:px-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#f0c252]/35 bg-[#f0c252]/10 px-3 py-1 text-xs font-semibold tracking-[0.22em] text-[#f6d46c]">
                      真实牌局
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/55">
                      打筒子
                    </span>
                  </div>
                  <h1 className="brand-gold-text mt-4 text-3xl font-black tracking-[0.2em] md:text-4xl">房号 {safeRoomCode}</h1>
                  <p className="mt-2 text-sm text-white/70">{roomLabel || '双人抢分局'} · 跟牌、压牌、结算已经串起来</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: '牌型', value: formatCurrentPattern(state) },
                    { label: '底牌', value: String(state.bottomCards.length) },
                    { label: '当前', value: currentPlayer?.nickname ?? '未知' },
                    {
                      label: '已出',
                      value: `${state.players.reduce((count, player) => count + player.playedPatterns.length, 0)}手`,
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-white/10 bg-black/25 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{item.label}</p>
                      <p className="mt-2 text-xl font-black text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.18))] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-white/35">局内播报</p>
                <p className="mt-3 text-2xl font-black text-white">{statusText}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ruleLines.map((rule) => (
                    <span key={rule} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/78">
                      {rule}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.22))] p-4 backdrop-blur-sm">
            <div className="space-y-3">
              {state.players.map((player, index) => (
                <div
                  key={player.userId}
                  className={`rounded-[24px] border px-4 py-3 ${
                    index === state.currentPlayerIndex
                      ? 'border-[#f0c252]/35 bg-[#f0c252]/10'
                      : 'border-white/10 bg-black/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{player.nickname}</p>
                      <p className="mt-1 text-xs text-white/55">
                        手牌 {player.hand.length} · 喜分 {player.xi}
                      </p>
                    </div>
                    <p className="text-2xl font-black text-[#f6d46c]">{player.score >= 0 ? '+' : ''}{player.score}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExit}
              className="mt-4 h-12 w-full rounded-2xl border border-white/12 bg-white/8 text-sm font-bold text-white transition hover:bg-white/12"
            >
              退出房间
            </button>
          </section>
        </header>

        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <PlayerSeat
              name={opponent.nickname}
              handCount={opponent.hand.length}
              huXi={opponent.xi}
              menZi={opponent.playedPatterns.length}
              score={opponent.score}
              isCurrent={state.currentPlayerIndex === 1}
              isBot={opponent.isBot}
            />

            <section className="rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.24))] p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">对手手牌</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {opponent.hand.slice(0, 10).map((card) => (
                  <PokerCard key={card.id} card={card} faceDown compact />
                ))}
                {opponent.hand.length > 10 ? (
                  <div className="flex items-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white/70">
                    +{opponent.hand.length - 10}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.24))] p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">底牌区</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {state.bottomCards.map((card) => (
                  <PokerCard key={`bottom-${card.id}`} card={card} faceDown compact />
                ))}
              </div>
            </section>
          </aside>

          <div className="space-y-4">
            <section className="rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.24))] p-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">中央出牌区</p>
                  <p className="mt-1 text-sm text-white/68">
                    {state.lastPlay
                      ? `${state.players[state.lastPlay.playerIndex]?.nickname ?? '玩家'} 上一手`
                      : '等待首个牌型落桌'}
                  </p>
                </div>
                {selectedPattern ? (
                  <span className="rounded-full bg-[#D4A017]/18 px-3 py-1 text-xs text-[#f6d46c]">
                    已选牌型：{selectedPattern.label}
                  </span>
                ) : (
                  <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/60">未选择牌组</span>
                )}
              </div>

              <div className="mt-4 rounded-[28px] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(13,28,45,0.8),rgba(7,16,27,0.92))] p-4">
                <div className="min-h-[126px]">
                  <div className="flex flex-wrap gap-2">
                    {state.lastPlay?.cards.map((card) => <PokerCard key={`last-${card.id}`} card={card} />)}
                  </div>
                  {!state.lastPlay ? (
                    <p className="mt-6 text-sm text-white/45">首位玩家出牌后，这里会展示桌面牌型。</p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.24))] p-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">我的手牌</p>
                    <p className="mt-1 text-sm text-white/65">竖屏下可横向拖动，点牌组成牌型再出牌</p>
                  </div>
                  <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/60">
                    已选 {selectedIds.length} 张
                  </span>
                </div>

                <div className="mt-4 overflow-x-auto pb-2">
                  <div className="flex min-h-[112px] w-max items-end">
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

              <div className="space-y-4">
                <PlayerSeat
                  name={humanPlayer.nickname}
                  handCount={humanPlayer.hand.length}
                  huXi={humanPlayer.xi}
                  menZi={humanPlayer.playedPatterns.length}
                  score={humanPlayer.score}
                  isCurrent={state.currentPlayerIndex === 0}
                />

                <GameActions actions={actionItems} />
              </div>
            </section>
          </div>
        </section>
      </main>

      <Settlement
        open={showSettlement}
        roomCode={safeRoomCode}
        gameTitle="打筒子"
        summary={state.settlement?.summary}
        players={settlementPlayers}
        onClose={() => setShowSettlement(false)}
        onReplay={handleReplay}
        onShare={() => pushToast('分享结算功能开发中', 'info')}
      />
    </>
  );
}
