'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FilterModal from '@/components/game/FilterModal';
import JoinRoomModal from '@/components/game/JoinRoomModal';
import GameBackground from '@/components/layout/GameBackground';
import { useAuthStore } from '@/lib/store/useAuth';
import { type GameType, useGameStore } from '@/lib/store/useGame';
import { useToastStore } from '@/lib/store/useToast';

export default function HallPage() {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.push);
  const isGuest = useAuthStore((state) => state.isGuest);
  const profile = useAuthStore((state) => state.profile);

  const initialize = useGameStore((state) => state.initialize);
  const refreshRooms = useGameStore((state) => state.refreshRooms);
  const rooms = useGameStore((state) => state.rooms);
  const quickJoin = useGameStore((state) => state.quickJoin);
  const lastPlayedLabel = useGameStore((state) => state.lastPlayedLabel);

  const [showFilter, setShowFilter] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [filters, setFilters] = useState<GameType[]>([]);

  useEffect(() => {
    void initialize();
    const timer = window.setInterval(() => {
      void refreshRooms();
    }, 10000);

    return () => {
      window.clearInterval(timer);
    };
  }, [initialize, refreshRooms]);

  const filteredRooms = useMemo(() => {
    if (filters.length === 0) {
      return rooms;
    }

    return rooms.filter((room) => filters.includes(room.gameType));
  }, [filters, rooms]);

  const openRoom = (roomId: string) => {
    if (isGuest) {
      pushToast('请先登录', 'info');
      return;
    }

    router.push(`/room/${roomId}`);
  };

  const handleQuickJoin = async () => {
    if (isGuest) {
      pushToast('请先登录', 'info');
      return;
    }

    const result = await quickJoin(filters);

    if (!result.ok || !result.roomId) {
      pushToast(result.message, 'error');
      return;
    }

    router.push(`/room/${result.roomId}`);
  };

  return (
    <GameBackground className="before:absolute before:inset-0 before:bg-[linear-gradient(180deg,#0d1f0f_0%,#1a3a20_100%)] after:absolute after:inset-x-0 after:top-0 after:h-[34%] after:bg-[radial-gradient(circle_at_top,rgba(217,163,56,0.12),transparent_55%)]">
      <main className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-4 text-white sm:px-6">
        <header className="rounded-3xl border border-yellow-700/30 bg-black/40 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.32)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push('/lobby')}
              className="rounded-2xl border border-yellow-700/40 bg-black/40 px-3 py-2 text-sm font-bold text-yellow-300"
            >
              ← 返回
            </button>

            <div className="flex min-w-0 items-center gap-3">
              <div
                className="h-11 w-11 rounded-full border-2 border-yellow-600/60 bg-cover bg-center"
                style={{ backgroundImage: `url(${profile?.avatar_url ?? '/assets/avatars/default.png'})` }} />
              <div className="min-w-0 text-xs">
                <p className="truncate font-semibold text-yellow-300">{profile?.nickname ?? '游客玩家'}</p>
                <p className="truncate text-yellow-100/70">ID:{profile?.id?.slice(0, 6) ?? '17599'}</p>
                <p className="truncate text-yellow-300">金币 {profile?.balance?.toFixed(2) ?? '1000.00'}</p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-yellow-100/70">休闲竞技</p>
              <p className="font-black tracking-[0.15em] text-yellow-300">ID:17599</p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button type="button" className="rounded-2xl bg-black/35 px-3 py-2 text-yellow-300">赠送</button>
              <button type="button" className="rounded-2xl bg-black/35 px-3 py-2 text-white">成员</button>
              <button type="button" className="rounded-2xl bg-black/35 px-3 py-2 text-yellow-300">战绩</button>
            </div>
          </div>
        </header>

        <div className="mt-3 overflow-hidden rounded-2xl border border-yellow-700/30 bg-black/45 px-3 py-2 text-sm text-yellow-100">
          <div className="marquee-track whitespace-nowrap">📢 场内桌位每 10 秒自动同步，当前展示 Supabase 实时房间数据，支持筛选和快速加入。</div>
        </div>

        <section className="mt-4 flex-1 overflow-hidden rounded-[32px] border border-yellow-700/25 bg-black/25 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-sm">
          <div className="h-full overflow-y-auto">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  className="rounded-3xl border border-yellow-700/50 bg-[#1a3a20]/80 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.24)] backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-yellow-300">房号 {room.roomCode}</p>
                      <h2 className="mt-1 text-lg font-black text-white">{room.title}</h2>
                      <p className="mt-1 text-sm text-yellow-100/80">{room.label}</p>
                    </div>
                    <span className="rounded-full bg-black/35 px-3 py-1 text-xs text-yellow-200">
                      {room.status === 'waiting' ? '等待中' : room.status === 'playing' ? '游戏中' : '已结束'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/85">
                    <div className="rounded-2xl bg-black/25 px-3 py-3">
                      <p className="text-xs text-yellow-100/60">房主</p>
                      <p className="mt-1 truncate font-semibold text-white">{room.hostName}</p>
                    </div>
                    <div className="rounded-2xl bg-black/25 px-3 py-3">
                      <p className="text-xs text-yellow-100/60">人数</p>
                      <p className="mt-1 font-semibold text-white">
                        {room.currentPlayers}/{room.maxPlayers}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-yellow-100/65">
                      底分 {room.baseScore} · {room.hostOnline ? '房主在线' : '房主离线'}
                    </p>
                    <button
                      type="button"
                      onClick={() => openRoom(room.id)}
                      className="rounded-2xl bg-yellow-600 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-500"
                    >
                      进入
                    </button>
                  </div>
                </div>
              ))}

              {filteredRooms.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-yellow-700/40 bg-[#1a3a20]/60 p-6 text-center text-sm text-yellow-100/80 md:col-span-2 xl:col-span-3">
                  当前筛选条件下暂无房间，试试清空筛选或快速加入。
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <footer className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-3xl border border-yellow-700/30 bg-black/50 p-3 text-sm shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setShowFilter(true)}
            className="h-11 rounded-2xl bg-black/35 px-4 font-bold text-yellow-300"
          >
            玩法筛选
          </button>

          <div className="truncate text-center text-yellow-100/85">上次：{lastPlayedLabel}</div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => (isGuest ? pushToast('请先登录', 'info') : setShowJoin(true))}
              className="h-11 rounded-2xl bg-black/35 px-4 font-semibold text-white"
            >
              房号加入
            </button>
            <button
              type="button"
              onClick={handleQuickJoin}
              className="h-11 rounded-2xl bg-yellow-600 px-5 font-bold text-black transition hover:bg-yellow-500"
            >
              快速加入
            </button>
          </div>
        </footer>
      </main>

      <FilterModal open={showFilter} selected={filters} onClose={() => setShowFilter(false)} onApply={setFilters} />
      <JoinRoomModal open={showJoin} onClose={() => setShowJoin(false)} />
    </GameBackground>
  );
}
