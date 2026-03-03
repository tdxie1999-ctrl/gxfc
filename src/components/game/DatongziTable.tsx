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
      <main className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6">
        <header className="rounded-3xl border border-white/15 bg-black/30 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/50">Phase 6 / 打筒子</p>
              <h1 className="brand-gold-text mt-1 text-2xl font-black tracking-[0.2em]">房号 {safeRoomCode}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                {tablePhase === 'waiting' ? '等待中' : '发牌中'}
              </span>
              <button
                type="button"
                onClick={handleExit}
                className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/12"
              >
                退出房间
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white/5 p-3 text-sm text-white/80">
            <p>{statusText}</p>
            <p className="mt-1 text-xs text-white/55">
              先走完整流程：进房等待、准备、发牌、对战、结算。规则继续保持最小可玩。
            </p>
            {roomLabel ? <p className="mt-1 text-xs text-white/45">{roomLabel}</p> : null}
          </div>
        </header>

        <section className="grid flex-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
          <section className="rounded-3xl border border-white/15 bg-black/25 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.25em] text-white/50">本桌规则</p>
            <div className="mt-3 space-y-2 text-sm text-white/80">
              {ruleLines.map((rule) => (
                <p key={rule}>{rule}</p>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
              <p className="text-xs uppercase tracking-[0.28em] text-white/50">牌桌流程</p>
              <h2 className="brand-gold-text mt-2 text-3xl font-black tracking-[0.2em]">恭喜发财</h2>
              <p className="mt-3 text-sm text-white/75">打筒子 / 欢乐四喜（基础流程版）</p>
              {tablePhase === 'dealing' ? (
                <div className="mt-5">
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#F2994A] to-[#F2C94C]"
                      style={{ width: `${dealingProgress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-white/70">发牌进度 {dealingProgress}%</p>
                </div>
              ) : (
                <div className="mt-5 flex items-center justify-center gap-3 text-sm text-white/70">
                  <span className="rounded-full bg-white/10 px-3 py-2">你 {selfReady ? '已准备' : '等待中'}</span>
                  <span className="rounded-full bg-white/10 px-3 py-2">
                    {opponentName} {opponentReady ? '已准备' : '等待中'}
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
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

            <div className="rounded-3xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm">
              {tablePhase === 'waiting' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handlePrepare}
                    className={`h-12 rounded-2xl text-sm font-bold text-white ${
                      selfReady
                        ? 'border border-white/15 bg-white/10'
                        : 'bg-gradient-to-r from-[#F2994A] to-[#F2C94C]'
                    }`}
                  >
                    {selfReady ? '取消准备' : '准 备'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExit}
                    className="h-12 rounded-2xl bg-gradient-to-r from-[#2f9e62] to-[#51b97f] text-sm font-bold text-white"
                  >
                    退出房间
                  </button>
                </div>
              ) : (
                <div className="text-center text-sm text-white/70">
                  <p>系统正在切牌并发牌。</p>
                  <p className="mt-2 text-xs text-white/50">发牌完成后自动进入出牌阶段。</p>
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
        <header className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <section className="rounded-3xl border border-white/15 bg-black/30 p-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/50">Phase 6 / 打筒子</p>
                <h1 className="brand-gold-text mt-1 text-2xl font-black tracking-[0.2em]">房号 {safeRoomCode}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                <span>牌型 {formatCurrentPattern(state)}</span>
                <span>{state.bottomCards.length} 底牌</span>
                <span>当前 {currentPlayer?.nickname ?? '未知'}</span>
                <button
                  type="button"
                  onClick={handleExit}
                  className="rounded-2xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/12"
                >
                  退出房间
                </button>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-white/5 p-3 text-sm text-white/80">
              <p>{statusText}</p>
              <p className="mt-1 text-xs text-white/55">
                当前为最小可玩规则：单张 / 对子 / 三条 / 顺子 / 筒子，结算按喜分和剩余手牌计算。
              </p>
              {roomLabel ? <p className="mt-1 text-xs text-white/45">{roomLabel}</p> : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/15 bg-black/30 backdrop-blur-sm">
            <table className="w-full text-left text-sm text-white/85">
              <thead className="bg-white/10 text-xs uppercase tracking-[0.2em] text-white/60">
                <tr>
                  <th className="px-3 py-2">玩家</th>
                  <th className="px-3 py-2">手牌</th>
                  <th className="px-3 py-2">喜分</th>
                  <th className="px-3 py-2">总分</th>
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
                    <td className="px-3 py-2">{player.xi}</td>
                    <td className="px-3 py-2">{player.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <PlayerSeat
                  name={opponent.nickname}
                  handCount={opponent.hand.length}
                  huXi={opponent.xi}
                  menZi={opponent.playedPatterns.length}
                  score={opponent.score}
                  isCurrent={state.currentPlayerIndex === 1}
                  isBot={opponent.isBot}
                />
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 text-xs text-white/60">对手手牌</div>
                  <div className="flex flex-wrap gap-1.5">
                    {opponent.hand.slice(0, 10).map((card) => (
                      <PokerCard key={card.id} card={card} faceDown compact />
                    ))}
                    {opponent.hand.length > 10 ? (
                      <div className="flex items-center rounded-lg bg-white/10 px-2 text-xs text-white/70">
                        +{opponent.hand.length - 10}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 text-xs text-white/60">底牌</div>
                <div className="flex max-w-[180px] flex-wrap gap-1.5">
                  {state.bottomCards.map((card) => (
                    <PokerCard key={`bottom-${card.id}`} card={card} faceDown compact />
                  ))}
                </div>
              </div>
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
                    已选牌型：{selectedPattern.label}
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
              huXi={humanPlayer.xi}
              menZi={humanPlayer.playedPatterns.length}
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
