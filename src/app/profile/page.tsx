'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GameBackground from '@/components/layout/GameBackground';
import { useAuthStore } from '@/lib/store/useAuth';

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const isGuest = useAuthStore((state) => state.isGuest);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  useEffect(() => {
    if (user) {
      void refreshProfile();
    }
  }, [refreshProfile, user]);

  return (
    <GameBackground>
      <main className="mx-auto flex h-full w-full max-w-[375px] flex-col px-4 pb-24 pt-4 text-white">
        <section className="rounded-[28px] border border-white/10 bg-[#0b3f27]/90 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Profile</p>
          <h1 className="mt-2 text-3xl font-black">我的信息</h1>
          <p className="mt-2 text-sm text-white/70">当前账号与资产信息，可从大厅底部 Tab 进入。</p>
        </section>

        <section className="mt-4 flex-1 space-y-3 rounded-[28px] border border-white/10 bg-black/20 p-4 backdrop-blur-md">
          <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4">
            <p className="text-xs text-white/55">模式</p>
            <p className="mt-1 text-lg font-bold text-white">{isGuest ? '游客体验' : '账号登录'}</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4">
            <p className="text-xs text-white/55">昵称</p>
            <p className="mt-1 text-lg font-bold text-white">{profile?.nickname ?? '游客玩家'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4">
              <p className="text-xs text-white/55">余额</p>
              <p className="mt-1 text-lg font-bold text-white">{profile?.balance?.toFixed(2) ?? '1000.00'}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4">
              <p className="text-xs text-white/55">钻石</p>
              <p className="mt-1 text-lg font-bold text-white">{profile?.diamonds ?? 10}</p>
            </div>
          </div>
        </section>

        <nav className="absolute bottom-0 left-1/2 flex w-full max-w-[375px] -translate-x-1/2 gap-2 border-t border-white/10 bg-[#082d1c]/95 px-4 pb-[calc(var(--safe-bottom)+10px)] pt-3 backdrop-blur-xl">
          <button
            type="button"
            className="flex-1 rounded-2xl bg-transparent px-3 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/8"
            onClick={() => router.push('/lobby')}
          >
            大厅
          </button>
          <button
            type="button"
            className="flex-1 rounded-2xl bg-transparent px-3 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/8"
            onClick={() => router.push('/hall')}
          >
            排行
          </button>
          <button type="button" className="flex-1 rounded-2xl bg-white/12 px-3 py-3 text-sm font-bold text-white">
            我的
          </button>
        </nav>
      </main>
    </GameBackground>
  );
}
