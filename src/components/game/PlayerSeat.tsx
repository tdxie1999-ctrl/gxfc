import clsx from 'clsx';

interface PlayerSeatProps {
  name: string;
  handCount: number;
  huXi: number;
  menZi: number;
  score: number;
  isCurrent?: boolean;
  isDealer?: boolean;
  isBot?: boolean;
  align?: 'left' | 'right' | 'center';
}

export default function PlayerSeat({
  name,
  handCount,
  huXi,
  menZi,
  score,
  isCurrent = false,
  isDealer = false,
  isBot = false,
  align = 'center',
}: PlayerSeatProps) {
  return (
    <section
      className={clsx(
        'w-full rounded-2xl border p-3 backdrop-blur-sm',
        isCurrent ? 'border-[#D4A017] bg-[#D4A017]/15' : 'border-white/15 bg-black/25',
        align === 'left' && 'text-left',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center'
      )}
    >
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-white">{name}</span>
        <span className="text-xs text-white/60">{isBot ? 'AI' : '玩家'}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/80">
        {isDealer && <span className="rounded-full bg-[#c0392b] px-2 py-0.5 text-white">庄</span>}
        {isCurrent && <span className="rounded-full bg-[#D4A017] px-2 py-0.5 text-[#2c1b04]">当前</span>}
        <span>手牌 {handCount}</span>
        <span>胡息 {huXi}</span>
        <span>门子 {menZi}</span>
      </div>
      <div className="mt-2 text-lg font-bold text-white">{score >= 0 ? '+' : ''}{score.toFixed(0)}</div>
    </section>
  );
}
