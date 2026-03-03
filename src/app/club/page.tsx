'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GameBackground from '@/components/layout/GameBackground';
import Modal from '@/components/ui/Modal';
import { useToastStore } from '@/lib/store/useToast';

export default function ClubPage() {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.push);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [clubCode, setClubCode] = useState('');

  const handleJoinHall = () => {
    setShowJoinModal(false);
    router.push('/hall');
  };

  const handleSubmitClubCode = () => {
    if (!clubCode.trim()) {
      pushToast('请输入亲友圈ID', 'info');
      return;
    }

    handleJoinHall();
  };

  return (
    <GameBackground className="before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_25%_28%,rgba(255,255,255,0.14),transparent_24%)]">
      <div
        className="pointer-events-none absolute inset-x-[12%] top-[16%] h-[18%] rounded-[50%] bg-[#4e735f]/35"
        style={{ clipPath: 'polygon(0 100%, 18% 40%, 35% 72%, 48% 22%, 67% 70%, 82% 34%, 100% 100%)' }}
      />
      <div
        className="pointer-events-none absolute inset-x-[4%] top-[24%] h-[22%] rounded-[50%] bg-[#365946]/45"
        style={{ clipPath: 'polygon(0 100%, 14% 36%, 29% 68%, 45% 18%, 58% 62%, 78% 28%, 100% 100%)' }}
      />
      <div className="pointer-events-none absolute left-[72%] top-[21%] h-[34%] w-[3.2%] rounded-full bg-gradient-to-b from-white/55 via-white/25 to-white/0 blur-[1px]" />
      <div className="pointer-events-none absolute left-[70%] top-[28%] h-[20%] w-[8%] rounded-full bg-white/12 blur-xl" />

      <main className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col px-4 py-5 text-white sm:px-6">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/lobby')}
            className="flex h-12 items-center gap-2 rounded-2xl bg-black/30 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm"
          >
            <span className="text-lg">←</span>
            <span>返回大厅</span>
          </button>

          <div className="rounded-2xl bg-black/25 px-4 py-2 text-xs font-medium text-white/75 backdrop-blur-sm">
            亲友圈 · 预设入口
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[520px] rounded-[36px] border border-[#f6e4b7]/60 bg-white/95 p-8 text-center text-[#1f2937] shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="inline-flex rounded-full bg-gradient-to-r from-[#E7C66B] to-[#F4E3A1] px-5 py-2 text-sm font-black tracking-[0.2em] text-[#2b1f06]">
              休闲竞技
            </div>

            <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-[#f7d794] via-[#f5cd79] to-[#e58e26] text-4xl shadow-lg">
              👩
            </div>

            <h1 className="mt-5 text-3xl font-black text-[#17212f]">发财亲友圈</h1>
            <p className="mt-3 text-base font-semibold text-[#4b5563]">亲友圈ID: 88888</p>
            <p className="mt-2 text-sm text-[#6b7280]">成员数: 999+</p>
            <p className="mt-4 text-sm leading-6 text-[#6b7280]">预设圈子已就绪。点击进入即可查看当前在线桌子并快速开局。</p>

            <button
              type="button"
              onClick={() => router.push('/hall')}
              className="mt-8 h-12 min-w-[180px] rounded-2xl bg-gradient-to-r from-[#F2994A] to-[#F2C94C] px-6 text-base font-black text-white shadow-[0_14px_28px_rgba(242,153,74,0.35)] transition hover:-translate-y-0.5 active:scale-[0.98]"
            >
              点击进入
            </button>
          </div>
        </section>

        <footer className="mx-auto grid w-full max-w-[520px] grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => pushToast('暂不支持', 'info')}
            className="h-12 rounded-2xl bg-gradient-to-r from-[#2D9CDB] to-[#56CCF2] px-4 text-sm font-bold text-white shadow-[0_14px_28px_rgba(45,156,219,0.28)]"
          >
            创建亲友圈
          </button>
          <button
            type="button"
            onClick={() => {
              setClubCode('');
              setShowJoinModal(true);
            }}
            className="h-12 rounded-2xl bg-gradient-to-r from-[#F2994A] to-[#F2C94C] px-4 text-sm font-bold text-white shadow-[0_14px_28px_rgba(242,153,74,0.28)]"
          >
            加入亲友圈
          </button>
        </footer>
      </main>

      <Modal open={showJoinModal} title="加入亲友圈" onClose={() => setShowJoinModal(false)}>
        <div className="space-y-4">
          <label className="block text-left text-sm font-semibold text-slate-700">
            亲友圈ID
            <input
              type="text"
              inputMode="numeric"
              value={clubCode}
              onChange={(event) => setClubCode(event.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="输入任意圈号即可进入"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-base text-slate-900 outline-none transition focus:border-[#F2994A]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setShowJoinModal(false)}
              className="h-11 rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmitClubCode}
              className="h-11 rounded-2xl bg-gradient-to-r from-[#F2994A] to-[#F2C94C] text-sm font-bold text-white"
            >
              进入大厅
            </button>
          </div>
        </div>
      </Modal>
    </GameBackground>
  );
}
