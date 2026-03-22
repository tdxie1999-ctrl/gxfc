'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import DatongziTable from '@/components/game/DatongziTable';
import FangpaofaTable from '@/components/game/FangpaofaTable';
import HandCards, { type HandCardItem } from '@/components/game/HandCards';
import PaodekuaiRoomShell from '@/components/game/PaodekuaiRoomShell';
import Settlement from '@/components/game/Settlement';
import TableLayout, { type TableScoreRow, type TableSeatItem } from '@/components/game/TableLayout';
import GameBackground from '@/components/layout/GameBackground';
import { botAvatars } from '@/lib/bot/avatars';
import { botNames } from '@/lib/bot/names';
import { createDeck as createFangpaofaDeck } from '@/lib/games/fangpaofa/tiles';
import { createStandardDeck } from '@/lib/games/paodekuai/cards';
import { useAuthStore } from '@/lib/store/useAuth';
import { useGameStore } from '@/lib/store/useGame';
import { useToastStore } from '@/lib/store/useToast';

interface RoomPageProps {
  params: {
    id: string;
  };
}

export default function RoomPage({ params }: RoomPageProps) {
  const router = useRouter();
  const initialize = useGameStore((state) => state.initialize);
  const rooms = useGameStore((state) => state.rooms);
  const initialized = useGameStore((state) => state.initialized);
  const setCurrentRoomId = useGameStore((state) => state.setCurrentRoomId);
  const profile = useAuthStore((state) => state.profile);
  const pushToast = useToastStore((state) => state.push);

  const [logicMode, setLogicMode] = useState(false);
  const [phaseStage, setPhaseStage] = useState<'waiting' | 'dealing' | 'playing'>('waiting');
  const [selfReady, setSelfReady] = useState(false);
  const [readyBotIds, setReadyBotIds] = useState<string[]>([]);
  const [dealtCount, setDealtCount] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [statusText, setStatusText] = useState('等待所有玩家准备中...');
  const [showSettlement, setShowSettlement] = useState(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const room = useMemo(() => rooms.find((item) => item.id === params.id), [params.id, rooms]);
  const displayRoomCode = room?.roomCode ?? params.id;

  useEffect(() => {
    setLogicMode(false);
    setPhaseStage('waiting');
    setSelfReady(false);
    setReadyBotIds([]);
    setDealtCount(0);
    setSelectedIndices([]);
    setStatusText('等待所有玩家准备中...');
    setShowSettlement(false);
  }, [params.id]);

  const roomTitle = room?.title ?? '牌桌';
  const roomLabel = room?.label ?? '房间';
  const myName = profile?.nickname ?? '你';
  const myAvatar = profile?.avatar_url ?? '/assets/avatars/default.png';

  const seatDefinitions = useMemo(() => {
    if (!room) {
      return [] as TableSeatItem[];
    }

    const targetPlayers = Math.max(2, Math.min(room.maxPlayers, room.currentPlayers || room.maxPlayers));
    const positions = targetPlayers === 2 ? (['bottom', 'top'] as const) : (['bottom', 'left', 'right'] as const);
    const opponentsNeeded = positions.length - 1;
    const seededOpponents: Array<{ id: string; name: string; avatar: string }> = [];

    if (room.hostName && room.hostName !== myName) {
      seededOpponents.push({
        id: `${room.id}-host`,
        name: room.hostName,
        avatar: room.hostAvatar,
      });
    }

    for (let index = seededOpponents.length; index < opponentsNeeded; index += 1) {
      seededOpponents.push({
        id: `${room.id}-bot-${index}`,
        name: botNames[(index + room.roomCode.length) % botNames.length] ?? `牌友${index + 1}`,
        avatar: botAvatars[(index + room.roomCode.length) % botAvatars.length] ?? '/assets/avatars/default.png',
      });
    }

    const seats: TableSeatItem[] = [
      {
        id: `${room.id}-self`,
        name: myName,
        avatar: myAvatar,
        score: 198.7,
        handCount: Math.max(0, dealtCount),
        position: 'bottom',
        isOnline: true,
        isReady: selfReady,
        isCurrent: phaseStage === 'playing',
        isDealer: true,
        isBot: false,
      },
    ];

    seededOpponents.slice(0, opponentsNeeded).forEach((opponent, index) => {
      seats.push({
        id: opponent.id,
        name: opponent.name,
        avatar: opponent.avatar,
        score: 175.5 - index * 12,
        handCount: Math.max(0, dealtCount),
        position: positions[index + 1],
        isOnline: true,
        isReady: readyBotIds.includes(opponent.id),
        isBot: true,
      });
    });

    return seats;
  }, [dealtCount, myAvatar, myName, phaseStage, readyBotIds, room, selfReady]);

  const botSeats = useMemo(() => seatDefinitions.filter((seat) => seat.isBot), [seatDefinitions]);

  const targetHandCount = useMemo(() => {
    if (!room) {
      return 0;
    }

    if (room.gameType === 'fangpaofa') {
      return 21;
    }

    if (room.gameType === 'datongzi') {
      return 8;
    }

    return 16;
  }, [room]);

  const deckLabel = useMemo(() => {
    if (!room || room.gameType === 'paodekuai') {
      return undefined;
    }

    const totalDeck = room.gameType === 'fangpaofa' ? 80 : 54;
    const remaining = Math.max(0, totalDeck - dealtCount * Math.max(seatDefinitions.length, 1));
    return `${remaining}底牌`;
  }, [dealtCount, room, seatDefinitions.length]);

  useEffect(() => {
    if (phaseStage !== 'waiting' || !selfReady) {
      return;
    }

    const nextBot = botSeats.find((seat) => !readyBotIds.includes(seat.id));

    if (!nextBot) {
      return;
    }

    const timer = window.setTimeout(() => {
      setReadyBotIds((current) => [...current, nextBot.id]);
      setStatusText(`${nextBot.name} 已准备，等待其他玩家...`);
    }, 1000 + Math.floor(Math.random() * 2000));

    return () => {
      window.clearTimeout(timer);
    };
  }, [botSeats, phaseStage, readyBotIds, selfReady]);

  useEffect(() => {
    if (
      phaseStage === 'waiting' &&
      selfReady &&
      botSeats.length > 0 &&
      readyBotIds.length === botSeats.length
    ) {
      setPhaseStage('dealing');
      setDealtCount(0);
      setStatusText('全员准备完成，开始发牌...');
    }
  }, [botSeats.length, phaseStage, readyBotIds.length, selfReady]);

  useEffect(() => {
    if (phaseStage !== 'dealing') {
      return;
    }

    if (dealtCount >= targetHandCount) {
      setPhaseStage('playing');
      setStatusText('发牌完成，可以开始体验牌桌操作壳');
      return;
    }

    const timer = window.setTimeout(() => {
      setDealtCount((current) => current + 1);
    }, 100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dealtCount, phaseStage, targetHandCount]);

  const handleExit = useCallback(() => {
    const currentStatus = room?.status === 'playing' || phaseStage === 'playing' ? 'playing' : 'waiting';

    if (
      currentStatus === 'playing' &&
      !window.confirm('确定要中途退出吗？当前局将记为放弃')
    ) {
      return;
    }

    setCurrentRoomId(null);
    router.push('/hall');
  }, [phaseStage, room?.status, router, setCurrentRoomId]);

  const handleReady = useCallback(() => {
    if (phaseStage !== 'waiting') {
      return;
    }

    setSelfReady((current) => {
      const next = !current;

      if (!next) {
        setReadyBotIds([]);
      }

      setStatusText(next ? '你已准备，等待其他玩家...' : '已取消准备');
      return next;
    });
  }, [phaseStage]);

  const handleFakeAction = useCallback((label: string) => {
    setStatusText(`已触发「${label}」操作（step3 演示壳）`);
  }, []);

  const handleReplay = useCallback(() => {
    setShowSettlement(false);
    setLogicMode(false);
    setPhaseStage('waiting');
    setSelfReady(false);
    setReadyBotIds([]);
    setDealtCount(0);
    setSelectedIndices([]);
    setStatusText('等待所有玩家准备中...');
  }, []);

  const logicAvailable = Boolean(
    room &&
      (room.gameType === 'fangpaofa' ||
        room.gameType === 'paodekuai' ||
        room.gameType === 'datongzi'),
  );

  const phase3Rules = useMemo(() => {
    if (!room) {
      return [] as string[];
    }

    const config = (room.config ?? {}) as Record<string, unknown>;

    if (room.gameType === 'fangpaofa') {
      return [
        `${room.maxPlayers}人场，房主付`,
        `${String(config.autoTrustee ?? '2分钟')}后托管`,
        '两百封顶',
        '15胡起胡，有炮必接',
        '满百结算，不打鸟',
        `首局${String(config.dealerRule ?? '房主')}坐庄`,
        `积分底分 x${String(config.baseScore ?? room.baseScore)}`,
      ];
    }

    if (room.gameType === 'datongzi') {
      return [
        `${room.maxPlayers}人场，对家配对`,
        `${String(config.birdRule ?? '2鸟')}抓鸟`,
        `${String(config.autoTrustee ?? '2分钟')}托管`,
        `少于${String(config.doubleThreshold ?? 10)}分翻倍`,
        `积分底分 x${String(config.baseScore ?? room.baseScore)}`,
      ];
    }

    return [
      `${room.maxPlayers}人场，快速开局`,
      `${String(config.autoTrustee ?? '2分钟')}托管`,
      `少于${String(config.doubleThreshold ?? 10)}分翻倍`,
      `积分底分 x${String(config.baseScore ?? room.baseScore)}`,
      '支持连对、飞机、炸弹',
    ];
  }, [room]);

  const scoreRows = useMemo<TableScoreRow[]>(() => {
    return seatDefinitions.map((seat, index) => ({
      id: seat.id,
      playerName: seat.name,
      historyScore: seat.score + index * 12,
      roundScore: phaseStage === 'playing' ? (seat.isBot ? -6 - index : 12) : 0,
      extraLabel: room?.gameType === 'fangpaofa' ? '胡息' : room?.gameType === 'datongzi' ? '喜分' : '牌面',
      extraValue:
        room?.gameType === 'fangpaofa'
          ? `${seat.isBot ? 0 : 15}`
          : room?.gameType === 'datongzi'
            ? `${seat.isBot ? 1 : 3}`
            : `${seat.isBot ? 0 : 2}`,
      totalScore: seat.score,
      isCurrent: !seat.isBot,
    }));
  }, [phaseStage, room?.gameType, seatDefinitions]);

  const handCards = useMemo<HandCardItem[]>(() => {
    if (!room || targetHandCount === 0) {
      return [];
    }

    const visibleCount = phaseStage === 'playing' ? targetHandCount : dealtCount;

    if (room.gameType === 'fangpaofa') {
      const deck = createFangpaofaDeck().slice(0, targetHandCount);
      return deck.slice(0, visibleCount).map((tile) => ({
        key: `tile-${tile.id}`,
        kind: 'tile' as const,
        tile,
        faceDown: phaseStage === 'dealing',
      }));
    }

    const deck = createStandardDeck().slice(0, targetHandCount);
    return deck.slice(0, visibleCount).map((card) => ({
      key: `poker-${card.id}`,
      kind: 'poker' as const,
      card,
      faceDown: phaseStage === 'dealing',
    }));
  }, [dealtCount, phaseStage, room, targetHandCount]);

  const handleSelectCard = useCallback(
    (index: number) => {
      if (phaseStage !== 'playing') {
        return;
      }

      setSelectedIndices((current) =>
        current.includes(index) ? current.filter((item) => item !== index) : [...current, index]
      );
    },
    [phaseStage]
  );

  let content: ReactNode = null;

  if (!initialized) {
    content = (
      <div className="flex h-full items-center justify-center text-lg font-semibold text-white/80">
        正在加载房间...
      </div>
    );
  } else if (!room) {
    content = <PaodekuaiRoomShell roomId={params.id} onExit={handleExit} />;
  } else if (room.gameType === 'paodekuai') {
    content = <PaodekuaiRoomShell roomId={params.id} onExit={handleExit} />;
  } else if (room.gameType === 'datongzi') {
    content = (
      <DatongziTable
        roomId={params.id}
        roomCode={room.roomCode}
        roomLabel={room.label}
        roomConfig={room.config}
      />
    );
  } else if (room.gameType === 'fangpaofa' || logicMode) {
    content = (
      <FangpaofaTable
        roomId={params.id}
        roomCode={room.roomCode}
        roomLabel={room.label}
        roomConfig={room.config}
      />
    );
  } else {
    const baseActionLabels =
      phaseStage === 'waiting'
        ? []
        : room.gameType === 'fangpaofa'
          ? ['吃', '碰', '偎', '跑', '提', '胡']
          : ['提示', '重选', '不出', '出牌'];

    content = (
      <>
        <TableLayout
          roomCode={room.roomCode}
          roundNumber={1}
          gameTitle={roomTitle}
          modeLabel={roomLabel}
          rules={phase3Rules}
          deckLabel={deckLabel}
          statusText={statusText}
          seats={seatDefinitions}
          scoreRows={scoreRows}
          centerContent={
            <div className="space-y-3">
              <p className="text-sm text-white/80">
                {phaseStage === 'waiting'
                  ? '等待玩家准备，当前为 step3 独立牌桌壳。'
                  : phaseStage === 'dealing'
                    ? `发牌中... ${dealtCount}/${targetHandCount}`
                    : '发牌完成，当前操作与结算为演示交互。'}
              </p>
              <div className="rounded-2xl bg-white/6 px-4 py-3 text-left text-sm text-white/70">
                <p>房间类型：{roomTitle}</p>
                <p className="mt-1">当前玩法：{roomLabel}</p>
                <p className="mt-1">最近状态：{statusText}</p>
              </div>
              {phaseStage === 'dealing' ? (
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F2994A] to-[#F2C94C]"
                    style={{ width: `${Math.round((dealtCount / Math.max(targetHandCount, 1)) * 100)}%` }}
                  />
                </div>
              ) : null}
            </div>
          }
          handArea={
            <HandCards
              cards={handCards}
              selectedIndices={selectedIndices}
              onCardSelect={handleSelectCard}
            />
          }
          actionArea={
            <div className="space-y-3">
              {phaseStage === 'waiting' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleReady}
                    className={`h-12 rounded-2xl text-base font-bold text-white ${
                      selfReady
                        ? 'border border-white/15 bg-white/10'
                        : 'bg-gradient-to-r from-[#F2994A] to-[#F2C94C]'
                    }`}
                  >
                    {selfReady ? '取消准备' : '准 备'}
                  </button>
                  <button
                    type="button"
                    onClick={() => (logicAvailable ? setLogicMode(true) : pushToast('当前游戏逻辑将在后续阶段接入', 'info'))}
                    className={`h-12 rounded-2xl text-base font-bold text-white ${
                      logicAvailable
                        ? 'bg-gradient-to-r from-[#27AE60] to-[#6FCF97]'
                        : 'border border-white/15 bg-white/8'
                    }`}
                  >
                    {logicAvailable ? '进入真实逻辑' : '逻辑开发中'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {baseActionLabels.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleFakeAction(label)}
                        className="h-12 rounded-2xl border border-white/15 bg-white/8 text-sm font-bold text-white transition hover:bg-white/12"
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowSettlement(true)}
                      className="h-12 rounded-2xl border border-white/15 bg-white/8 text-sm font-bold text-white transition hover:bg-white/12"
                    >
                      结算
                    </button>
                    {logicAvailable ? (
                      <button
                        type="button"
                        onClick={() => setLogicMode(true)}
                        className="h-12 rounded-2xl bg-gradient-to-r from-[#27AE60] to-[#6FCF97] text-sm font-bold text-white"
                      >
                        真实逻辑
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          }
          onExit={handleExit}
          onVoice={() => pushToast('语音功能开发中', 'info')}
          onChat={() => pushToast('快捷语：好牌！ / 快点吧！ / 运气真好', 'info')}
          onHelp={() => pushToast('Step3 牌桌壳：等待、发牌演示、假操作、假结算', 'info')}
          onSettings={() => pushToast('设置功能开发中', 'info')}
        />

        <Settlement
          open={showSettlement}
          roomCode={room.roomCode}
          gameTitle={roomTitle}
          players={seatDefinitions.slice(0, 2).map((seat, index) => ({
            id: seat.id,
            name: seat.name,
            avatar: seat.avatar,
            roundDelta: index === 0 ? 18.5 : -18.5,
            totalScore: seat.score + (index === 0 ? 18.5 : -18.5),
            isWinner: index === 0,
          }))}
          onClose={() => setShowSettlement(false)}
          onReplay={handleReplay}
          onShare={() => pushToast('截图分享给朋友', 'success')}
        />
      </>
    );
  }

  return (
    <GameBackground>
      <div className="pointer-events-none absolute left-4 top-3 z-20 text-gray-400 text-sm">
        房间号：{displayRoomCode}
      </div>
      {content}
    </GameBackground>
  );
}
