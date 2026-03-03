'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FilterModal from '@/components/game/FilterModal';
import JoinRoomModal from '@/components/game/JoinRoomModal';
import TableCard from '@/components/game/TableCard';
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
    <GameBackground className="after:absolute after:bottom-0 after:left-0 after:h-[24%] after:w-full after:bg-gradient-to-t after:from-[#99c27f]/20 after:to-transparent">
      <main className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-4 text-white sm:px-6">
        <header className="rounded-3xl bg-black/30 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => router.push('/lobby')} className="rounded-2xl bg-white/10 px-3 py-2 text-sm">
              ← 返回
            </button>

            <div className="flex min-w-0 items-center gap-3">
              <div className="h-11 w-11 rounded-full border-2 border-white bg-cover bg-center"
                style={{ backgroundImage: `url(${profile?.avatar_url ?? '/assets/avatars/default.png'})` }} />
              <div className="min-w-0 text-xs">
                <p className="truncate font-semibold text-white">{profile?.nickname ?? '游客玩家'}</p>
                <p className="truncate text-white/70">ID:{profile?.id?.slice(0, 6) ?? '17599'}</p>
                <p className="truncate text-[#F2C94C]">💰 {profile?.balance?.toFixed(2) ?? '1000.00'}</p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-white/70">休闲竞技</p>
              <p className="font-black tracking-[0.15em]">ID:17599</p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button type="button" className="rounded-2xl bg-white/10 px-3 py-2">🎁赠送</button>
              <button type="button" className="rounded-2xl bg-white/10 px-3 py-2">👥成员</button>
              <button type="button" className="rounded-2xl bg-white/10 px-3 py-2">🏆战绩</button>
            </div>
          </div>
        </header>

        <div className="mt-3 overflow-hidden rounded-2xl bg-black/30 px-3 py-2 text-sm text-white/85">
          <div className="marquee-track whitespace-nowrap">📢 场内桌位每 10 秒自动同步，当前展示 Supabase 实时房间数据，支持筛选和快速加入。</div>
        </div>

        <section className="mt-4 flex-1 overflow-hidden rounded-[32px] bg-black/22 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.26)] backdrop-blur-sm">
          <div className="h-full overflow-x-auto overflow-y-hidden">
            <div className="grid h-full min-w-[780px] auto-cols-[180px] grid-flow-col grid-rows-2 gap-4">
              {filteredRooms.map((room) => (
                <TableCard key={room.id} room={room} onOpen={openRoom} />
              ))}
            </div>
          </div>
        </section>

        <footer className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-3xl bg-black/35 p-3 text-sm shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setShowFilter(true)}
            className="h-11 rounded-2xl bg-gradient-to-r from-[#F2994A] to-[#F2C94C] px-4 font-bold text-white"
          >
            玩法筛选
          </button>

          <div className="truncate text-center text-white/80">上次：{lastPlayedLabel}</div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => (isGuest ? pushToast('请先登录', 'info') : setShowJoin(true))}
              className="h-11 rounded-2xl bg-white/10 px-4 font-semibold text-white"
            >
              房号加入
            </button>
            <button
              type="button"
              onClick={handleQuickJoin}
              className="h-11 rounded-2xl bg-gradient-to-r from-[#EB5757] to-[#E74C3C] px-5 font-bold text-white"
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
