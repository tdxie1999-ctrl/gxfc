'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

  const userIdLabel = profile?.id ?? user?.id ?? 'guest';
  const balanceLabel = profile?.balance?.toFixed(2) ?? '1000.00';
  const diamondLabel = profile?.diamonds ?? 10;
  const menuItems = [
    { label: '游戏记录', action: () => router.push('/hall') },
    { label: '账号设置', action: () => router.push('/profile') },
    { label: '大厅入口', action: () => router.push('/lobby') },
    { label: '帮助中心', action: () => router.push('/club') },
  ];

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#0a1f0d] to-[#1a3a20] px-4 py-4 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[420px] flex-col">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 w-fit text-sm font-semibold text-yellow-400"
        >
          ← 返回
        </button>

        <section className="rounded-xl border border-yellow-700/40 bg-black/50 p-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full ring-2 ring-yellow-500">
              <div
                className="h-full w-full rounded-full bg-cover bg-center"
                style={{ backgroundImage: `url(${profile?.avatar_url ?? '/assets/avatars/default.png'})` }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-yellow-300">{profile?.nickname ?? '游客玩家'}</p>
              <p className="mt-1 truncate text-sm text-gray-400">ID: {userIdLabel.slice(0, 12)}</p>
              <p className="mt-3 text-2xl font-bold text-yellow-400">¥{balanceLabel}</p>
              <p className="mt-1 text-sm font-medium text-blue-300">💎 {diamondLabel}</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-400">{isGuest ? '当前为游客模式' : '当前为正式账号'}</p>
        </section>

        <section className="mt-5 overflow-hidden rounded-xl border border-gray-700/40 bg-black/20">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="flex w-full items-center justify-between border-b border-gray-700/40 bg-black/30 px-4 py-4 text-left text-sm text-white last:border-b-0"
            >
              <span>{item.label}</span>
              <span className="text-lg text-gray-500">›</span>
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
