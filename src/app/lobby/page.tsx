'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateRoomModal from '@/components/game/CreateRoomModal';
import JoinRoomModal from '@/components/game/JoinRoomModal';
import GameBackground from '@/components/layout/GameBackground';
import Modal from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/useAuth';
import { useGameStore } from '@/lib/store/useGame';
import { useToastStore } from '@/lib/store/useToast';

const lobbyCards = [
  {
    title: '亲友圈',
    icon: '🀄🎲',
    description: '好友约局，随时开桌',
    bg: 'from-[#E8F5E9] to-[#C8E6C9]',
    text: 'text-[#1B5E20]',
  },
  {
    title: '娱乐场',
    icon: '🃏',
    description: '查看桌位，快速入场',
    bg: 'from-[#E3F2FD] to-[#BBDEFB]',
    text: 'text-[#0D47A1]',
  },
  {
    title: '创建房间',
    icon: '☕',
    description: '自定玩法，邀人对局',
    bg: 'from-[#FFF3E0] to-[#FFCC80]',
    text: 'text-[#E65100]',
  },
  {
    title: '加入房间',
    icon: '🎋',
    description: '输入房号，直接进桌',
    bg: 'from-[#F3E5F5] to-[#E1BEE7]',
    text: 'text-[#6A1B9A]',
  },
] as const;

export default function LobbyPage() {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.push);
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const isGuest = useAuthStore((state) => state.isGuest);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const logout = useAuthStore((state) => state.logout);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const initializeGame = useGameStore((state) => state.initialize);
  const rooms = useGameStore((state) => state.rooms);
  const claimDailySignin = useGameStore((state) => state.claimDailySignin);
  const lastPlayedLabel = useGameStore((state) => state.lastPlayedLabel);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    void initializeGame();
    if (user) {
      void refreshProfile();
    }
  }, [initializeGame, refreshProfile, user]);

  const stats = useMemo(() => {
    const totalRooms = rooms.filter((room) => !room.isFake).length;
    const totalGames = Math.max(12, totalRooms * 4 || 12);
    const totalWins = Math.max(6, Math.floor(totalGames * 0.58));
    const winRate = Math.round((totalWins / totalGames) * 100);

    return {
      totalGames,
      winRate,
      totalDelta: (totalWins - (totalGames - totalWins)) * 8,
    };
  }, [rooms]);

  const guardAction = (action: () => void) => {
    if (isGuest) {
      pushToast('请先登录', 'info');
      return;
    }

    action();
  };

  const handleCardClick = (index: number) => {
    if (index === 0) {
      guardAction(() => router.push('/club'));
      return;
    }

    if (index === 1) {
      guardAction(() => router.push('/hall'));
      return;
    }

    if (index === 2) {
      guardAction(() => setShowCreate(true));
      return;
    }

    guardAction(() => setShowJoin(true));
  };

  const handleSignin = async () => {
    if (!user || !profile) {
      pushToast('请先登录', 'error');
      return;
    }

    const result = claimDailySignin(user.id);

    if (!result.ok) {
      pushToast(result.message, 'info');
      return;
    }

    const nextDiamonds = profile.diamonds + 1;
    await updateProfile({ diamonds: nextDiamonds });
    await supabase.from('diamond_logs').insert({
      user_id: user.id,
      amount: 1,
      diamonds_after: nextDiamonds,
      type: 'daily_signin',
      description: '每日签到奖励',
    });
    pushToast(result.message, 'success');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <GameBackground>
      <main className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-4 text-white sm:px-6">
        <header className="rounded-3xl bg-black/35 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="h-12 w-12 shrink-0 rounded-full border-2 border-white bg-cover bg-center"
                style={{ backgroundImage: `url(${profile?.avatar_url ?? '/assets/avatars/default.png'})` }}
              />
              <div className="min-w-0 text-sm">
                <p className="truncate font-bold text-white">{profile?.nickname ?? '游客玩家'}</p>
                <p className="truncate text-white/60">ID:{profile?.id?.slice(0, 6) ?? '375531'}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span>💎 {profile?.diamonds ?? 10}</span>
                  <span className="text-[#F2C94C]">💰 {profile?.balance?.toFixed(2) ?? '1000.00'}</span>
                </div>
              </div>
            </div>

            <div className="brand-gold-text text-xl font-black tracking-[0.2em]">恭喜发财</div>

            <button
              type="button"
              className="h-10 w-10 rounded-2xl bg-white/10 text-xl backdrop-blur-sm"
              onClick={() => (isGuest ? pushToast('请先登录', 'info') : setShowSettings(true))}
            >
              ⚙
            </button>
          </div>
        </header>

        <div className="mt-3 overflow-hidden rounded-2xl bg-black/30 px-3 py-2 text-sm text-white/85">
          <div className="marquee-track whitespace-nowrap">
            📢 欢迎来到恭喜发财，祝您财运亨通！新春活动火热进行中，创建房间仅需 2 钻石，邀请牌友马上开局。
          </div>
        </div>

        <section className="flex flex-1 items-center justify-center py-5">
          <div className="grid w-full max-w-4xl grid-cols-2 gap-4 lg:gap-6">
            {lobbyCards.map((card, index) => (
              <button
                key={card.title}
                type="button"
                onClick={() => handleCardClick(index)}
                className={`rounded-3xl bg-gradient-to-br ${card.bg} ${card.text} min-h-[140px] p-5 text-left shadow-[0_20px_40px_rgba(15,23,42,0.15)] transition hover:-translate-y-1 active:scale-[0.98]`}
              >
                <div className="text-3xl">{card.icon}</div>
                <h2 className="mt-3 text-2xl font-black">{card.title}</h2>
                <p className="mt-2 text-sm opacity-85">{card.description}</p>
              </button>
            ))}
          </div>
        </section>

        <div className="mb-3 rounded-2xl bg-black/25 px-4 py-2 text-center text-xs text-white/70">
          当前大厅桌数 {rooms.length} · 最近一局：{lastPlayedLabel}
        </div>

        <footer className="grid grid-cols-5 gap-2 rounded-3xl bg-black/35 p-2 text-xs shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
          <button type="button" className="rounded-2xl px-2 py-3 hover:bg-white/10" onClick={() => guardAction(() => void handleSignin())}>
            <div className="text-lg">📍</div>
            <div>签到</div>
          </button>
          <button type="button" className="rounded-2xl px-2 py-3 hover:bg-white/10" onClick={() => guardAction(() => setShowStats(true))}>
            <div className="text-lg">🏆</div>
            <div>战绩</div>
          </button>
          <button type="button" className="rounded-2xl px-2 py-3 hover:bg-white/10" onClick={() => guardAction(() => router.push('/lottery'))}>
            <div className="text-lg">🎰</div>
            <div>购彩</div>
          </button>
          <button type="button" className="rounded-2xl px-2 py-3 hover:bg-white/10" onClick={() => guardAction(() => pushToast('功能开发中', 'info'))}>
            <div className="text-lg">🤝</div>
            <div>合作</div>
          </button>
          <button type="button" className="rounded-2xl px-2 py-3 hover:bg-white/10" onClick={() => setShowNotice(true)}>
            <div className="text-lg">📢</div>
            <div>公告</div>
          </button>
        </footer>

        {isGuest ? (
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="fixed bottom-20 right-4 z-40 rounded-full bg-gradient-to-r from-[#F2994A] to-[#F2C94C] px-5 py-3 text-sm font-bold text-white shadow-2xl"
          >
            去登录
          </button>
        ) : null}
      </main>

      <CreateRoomModal open={showCreate} onClose={() => setShowCreate(false)} />
      <JoinRoomModal open={showJoin} onClose={() => setShowJoin(false)} />

      <Modal open={showStats} title="战绩统计" onClose={() => setShowStats(false)}>
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">总局数：{stats.totalGames}</div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">胜率：{stats.winRate}%</div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">总赢输：{stats.totalDelta >= 0 ? '+' : ''}{stats.totalDelta}</div>
        </div>
      </Modal>

      <Modal open={showNotice} title="平台公告" onClose={() => setShowNotice(false)}>
        <div className="space-y-3 text-sm text-slate-700">
          <p>1. 新春活动进行中，创建房间仅需 2 钻石。</p>
          <p>2. 游客可浏览大厅，完整功能请登录后使用。</p>
          <p>3. 六合彩模块与真实牌局逻辑将在后续阶段持续开放。</p>
        </div>
      </Modal>

      <Modal open={showSettings} title="设置" onClose={() => setShowSettings(false)}>
        <div className="space-y-3 text-sm text-slate-700">
          <button type="button" className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span>音效开关</span>
            <span>开启</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-2xl bg-rose-50 px-4 py-3 text-rose-600"
            onClick={() => void handleLogout()}
          >
            <span>退出登录</span>
            <span>→</span>
          </button>
        </div>
      </Modal>
    </GameBackground>
  );
}
