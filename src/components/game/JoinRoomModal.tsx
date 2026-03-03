'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import { useGameStore } from '@/lib/store/useGame';
import { useToastStore } from '@/lib/store/useToast';

export default function JoinRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const joinRoomByCode = useGameStore((state) => state.joinRoomByCode);
  const pushToast = useToastStore((state) => state.push);
  const [roomCode, setRoomCode] = useState('');

  const handleJoin = async () => {
    if (!/^\d{6}$/.test(roomCode)) {
      pushToast('请输入6位房间号', 'error');
      return;
    }

    const result = await joinRoomByCode(roomCode);

    if (!result.ok || !result.roomId) {
      pushToast(result.message, 'error');
      return;
    }

    pushToast('加入成功', 'success');
    onClose();
    router.push(`/room/${result.roomId}`);
  };

  return (
    <Modal open={open} title="加入房间" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="mb-3 text-center text-sm text-slate-500">输入 6 位数字房间号</p>
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="h-14 w-full rounded-2xl border border-slate-200 px-4 text-center text-3xl font-black tracking-[0.6em] outline-none focus:border-[#4A90D9]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl bg-slate-100 font-semibold text-slate-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleJoin}
            className="h-12 rounded-2xl bg-gradient-to-r from-[#F2994A] to-[#F2C94C] font-semibold text-white"
          >
            加入
          </button>
        </div>
      </div>
    </Modal>
  );
}
