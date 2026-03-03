'use client';

import type { GameRoom } from '@/lib/store/useGame';

const colorMap = {
  fangpaofa: 'bg-[#4A90D9]',
  paodekuai: 'bg-[#E74C3C]',
  datongzi: 'bg-[#27AE60]',
};

export default function TableCard({
  room,
  onOpen,
}: {
  room: GameRoom;
  onOpen: (roomId: string) => void;
}) {
  return (
    <div className="w-[180px] shrink-0 rounded-3xl bg-white/85 p-3 text-slate-900 shadow-[0_18px_40px_rgba(17,24,39,0.2)]">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full border-2 border-white bg-cover bg-center shadow"
            style={{ backgroundImage: `url(${room.hostAvatar})` }} />
          <div>
            <p className="text-xs font-semibold">{room.hostName}</p>
            <p className={`text-[10px] ${room.hostOnline ? 'text-emerald-600' : 'text-rose-500'}`}>
              {room.hostOnline ? '● 在线' : '离线'}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-slate-400">#{room.roomCode}</p>
      </div>

      <div className="relative flex h-[118px] items-center justify-center">
        <span className="absolute left-0 top-8 h-8 w-3 rounded-full bg-[#8B6914]/80" />
        <span className="absolute right-0 top-8 h-8 w-3 rounded-full bg-[#8B6914]/80" />
        <div className="flex h-[95px] w-[82%] flex-col items-center justify-center rounded-[999px] border-[3px] border-[#8B6914] bg-[#1a5c2e] px-3 text-center text-white shadow-inner">
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${colorMap[room.gameType]}`}>
            {room.title}
          </span>
          <p className="mt-2 text-[11px] text-white/85">{room.label}</p>
          <p className="mt-1 text-lg font-black text-[#F2C94C]">{room.baseScore}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpen(room.id)}
        className="mt-3 h-9 w-full rounded-2xl bg-gradient-to-r from-[#F2994A] to-[#F2C94C] text-sm font-bold text-white"
      >
        详情
      </button>
    </div>
  );
}
