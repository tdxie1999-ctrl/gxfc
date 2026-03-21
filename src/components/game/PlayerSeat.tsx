import clsx from 'clsx';

interface PlayerSeatProps {
  name: string;
  handCount: number;
  huXi: number;
  menZi: number;
  score: number;
  avatarUrl?: string;
  isCurrent?: boolean;
  isDealer?: boolean;
  isBot?: boolean;
  isReady?: boolean;
  align?: 'left' | 'right' | 'center';
}

export default function PlayerSeat({
  name,
  handCount,
  huXi,
  menZi,
  score,
  avatarUrl,
  isCurrent = false,
  isDealer = false,
  isBot = false,
  isReady = handCount > 0 || isCurrent,
  align = 'center',
}: PlayerSeatProps) {
  const avatarLabel = name.trim().charAt(0) || '玩';

  return (
    <section
      className={clsx(
        'w-full rounded-2xl p-3 backdrop-blur-sm',
        isCurrent ? 'border-2 border-yellow-500 bg-black/60' : 'border border-gray-600/50 bg-black/40',
        align === 'left' && 'text-left',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center'
      )}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-bold text-white ring-1 ring-white/30"
            style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
            aria-hidden="true"
          >
            {!avatarUrl ? avatarLabel : null}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-yellow-200">{name}</span>
              {isBot ? <span className="text-xs text-gray-400">[AI]</span> : null}
            </div>
            {!isReady ? (
              <p className="mt-1 text-xs text-yellow-200/80 animate-pulse">准备中...</p>
            ) : (
              <p className="mt-1 text-xs text-white/55">{isBot ? '机器人托管中' : '已入座'}</p>
            )}
          </div>
        </div>
        <span className="text-xs text-white/60">{isBot ? '机器人' : '玩家'}</span>
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
