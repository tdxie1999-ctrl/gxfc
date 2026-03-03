'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PaodekuaiTable from '@/components/game/PaodekuaiTable';
import type { PaodekuaiSettlementPayload } from '@/lib/games/paodekuai/persistence';
import {
  fetchRoomSnapshot,
  subscribeToRoom,
  type RoomPlayerRecord,
  type RoomRecord,
} from '@/lib/rooms/client';
import { useAuthStore } from '@/lib/store/useAuth';
import { useToastStore } from '@/lib/store/useToast';

interface PaodekuaiRoomShellProps {
  roomId: string;
  onExit: () => void;
}

interface RoomSnapshotState {
  room: RoomRecord | null;
  players: RoomPlayerRecord[];
}

function getRoomTitle(room: RoomRecord | null) {
  const roomName = room?.config?.room_name;
  if (typeof roomName === 'string' && roomName.trim()) {
    return roomName.trim();
  }

  return '跑得快';
}

function getRoomLabel(room: RoomRecord | null) {
  const baseScore = room?.config?.baseScore;
  const displayScore = Number.isFinite(Number(baseScore)) ? Number(baseScore) : 1;
  return `${displayScore}分 跑得快样板房`;
}

function renderReady(player: RoomPlayerRecord) {
  return player.is_ready ? '已准备' : '等待中';
}

export default function PaodekuaiRoomShell({ roomId, onExit }: PaodekuaiRoomShellProps) {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const pushToast = useToastStore((state) => state.push);
  const [snapshot, setSnapshot] = useState<RoomSnapshotState>({ room: null, players: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadSnapshot = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const nextSnapshot = await fetchRoomSnapshot(roomId);
        setSnapshot(nextSnapshot);
        setError(null);
      } catch {
        setError('读取真实房间失败，请稍后重试。');
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [roomId],
  );

  useEffect(() => {
    void loadSnapshot();

    const unsubscribe = subscribeToRoom(roomId, () => {
      void loadSnapshot(true);
    });

    return unsubscribe;
  }, [loadSnapshot, roomId]);

  const sortedPlayers = useMemo(
    () => [...snapshot.players].sort((a, b) => a.seat_index - b.seat_index),
    [snapshot.players],
  );
  const me = useMemo(
    () => sortedPlayers.find((player) => player.user_id && player.user_id === user?.id) ?? null,
    [sortedPlayers, user?.id],
  );
  const isHost = Boolean(snapshot.room?.host_id && snapshot.room.host_id === user?.id);
  const playerSeeds = useMemo(
    () =>
      sortedPlayers.map((player) => ({
        userId: player.user_id ?? `room-bot-${player.id}`,
        nickname: player.bot_name ?? `玩家${player.seat_index + 1}`,
        isBot: Boolean(player.is_bot),
      })),
    [sortedPlayers],
  );

  const handleStart = useCallback(async () => {
    setStarting(true);

    try {
      const response = await fetch(`/api/paodekuai/rooms/${roomId}/start`, {
        method: 'POST',
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? '开始对局失败');
      }

      pushToast('真实跑得快房间已开局', 'success');
      await loadSnapshot(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '开始对局失败';
      pushToast(message, 'error');
    } finally {
      setStarting(false);
    }
  }, [loadSnapshot, pushToast, roomId]);

  const handleSettlementPersist = useCallback(
    async (payload: PaodekuaiSettlementPayload) => {
      try {
        const response = await fetch('/api/paodekuai/settle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const result = (await response.json().catch(() => ({}))) as {
          message?: string;
          balance?: number;
        };

        if (!response.ok) {
          throw new Error(result.message ?? '写入真实结算失败');
        }

        if (typeof result.balance === 'number') {
          await updateProfile({ balance: result.balance });
        }

        await loadSnapshot(true);
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : '写入真实结算失败';
        pushToast(message, 'error');
      }
    },
    [loadSnapshot, pushToast, updateProfile],
  );

  if (loading && !snapshot.room) {
    return (
      <div className="flex h-full items-center justify-center text-lg font-semibold text-white/80">
        正在加载真实跑得快房间...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="rounded-3xl border border-white/15 bg-black/30 px-8 py-6 text-center text-white/85 backdrop-blur-sm">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadSnapshot()}
            className="mt-4 rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot.room || snapshot.room.game_type !== 'paodekuai') {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="rounded-3xl border border-white/15 bg-black/30 px-8 py-6 text-center text-white/85 backdrop-blur-sm">
          未找到真实跑得快房间，请返回大厅重试。
        </div>
      </div>
    );
  }

  if (snapshot.room.status === 'playing' && playerSeeds.length >= 2) {
    return (
      <PaodekuaiTable
        roomId={roomId}
        roomCode={snapshot.room.room_code}
        roomLabel={getRoomLabel(snapshot.room)}
        roomConfig={(snapshot.room.config as Record<string, unknown>) ?? {}}
        playerSeeds={playerSeeds}
        onSettlementPersist={handleSettlementPersist}
      />
    );
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 px-4 py-4 md:px-6">
      <section className="rounded-3xl border border-white/15 bg-black/30 p-5 text-white backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/50">Phase 5 / 真实样板房</p>
            <h1 className="brand-gold-text mt-1 text-2xl font-black tracking-[0.2em]">
              {getRoomTitle(snapshot.room)}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              房号 {snapshot.room.room_code} · 状态 {snapshot.room.status}
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white"
          >
            返回大厅
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-white/80">
          <p>这是跑得快的第一套真实闭环样板：房间、开局、结算、日志全部走服务端。</p>
          <p className="mt-1">
            当前规则：{getRoomLabel(snapshot.room)} / 抽水 {String(snapshot.room.config?.paodekuai && typeof snapshot.room.config.paodekuai === 'object'
              ? (snapshot.room.config.paodekuai as Record<string, unknown>).rakePercent ?? 5
              : 5)}
            %
          </p>
          <p className="mt-1 text-xs text-white/55">开局时会自动补齐空座位 AI，结算会写入 game_rounds / balance_logs。</p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/15 bg-black/25 p-5 text-white backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/50">房间玩家</p>
            <p className="mt-1 text-sm text-white/70">
              已入座 {sortedPlayers.length}/{snapshot.room.max_players}
            </p>
          </div>
          {me ? (
            <span className="rounded-full bg-[#D4A017]/20 px-3 py-1 text-xs text-[#f6d46c]">
              你的座位 #{me.seat_index + 1}
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {sortedPlayers.map((player) => (
            <div key={player.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-bold text-white">{player.bot_name ?? `玩家${player.seat_index + 1}`}</p>
              <p className="mt-1 text-xs text-white/60">座位 #{player.seat_index + 1}</p>
              <p className="mt-2 text-sm text-white/75">
                {player.is_bot ? 'AI' : '真人'} · {renderReady(player)}
              </p>
              <p className="mt-1 text-sm text-white/75">累计积分 {Number(player.score ?? 0)}</p>
            </div>
          ))}

          {Array.from({ length: Math.max(0, snapshot.room.max_players - sortedPlayers.length) }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-4 text-sm text-white/45"
            >
              空座位，开局时将由 AI 自动补齐
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-white/70">
            {isHost ? '你是房主，可以直接开始对局。' : '等待房主开始对局。'}
          </p>
          <button
            type="button"
            onClick={handleStart}
            disabled={!isHost || starting}
            className={`h-12 rounded-2xl px-6 text-sm font-bold text-white ${
              isHost
                ? 'bg-gradient-to-r from-[#27AE60] to-[#6FCF97]'
                : 'border border-white/15 bg-white/8'
            } ${starting ? 'opacity-70' : ''}`}
          >
            {starting ? '开局中...' : '开始对局'}
          </button>
        </div>
      </section>
    </main>
  );
}
