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
        'w-full rounded-[28px] border px-4 py-4 shadow-[0_18px_44px_rgba(0,0,0,0.16)] backdrop-blur-xl transition',
        isCurrent
          ? 'border-[#f0c252]/60 bg-[linear-gradient(135deg,rgba(240,194,82,0.14),rgba(7,16,27,0.92))]'
          : 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(7,16,27,0.82))]',
        align === 'left' && 'text-left',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-sm font-bold text-white ring-1 ring-white/20"
            style={
              avatarUrl
                ? {
                    backgroundImage: `url(${avatarUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
            aria-hidden="true"
          >
            {!avatarUrl ? avatarLabel : null}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-bold text-white">{name}</span>
              {isBot ? (
                <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/55">
                  AI
                </span>
              ) : null}
              {isDealer ? (
                <span className="rounded-full bg-[#b53a30] px-2 py-0.5 text-[10px] font-bold text-white">庄</span>
              ) : null}
              {isCurrent ? (
                <span className="rounded-full bg-[#f0c252] px-2 py-0.5 text-[10px] font-bold text-[#281605]">当前</span>
              ) : null}
            </div>

            {!isReady ? (
              <p className="mt-1 text-xs text-[#f0cf77] animate-pulse">准备中...</p>
            ) : (
              <p className="mt-1 text-xs text-white/55">{isBot ? '机器人托管中' : '已入座，等待出牌'}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">积分</p>
          <p className="mt-1 text-2xl font-black text-[#f6d46c]">
            {score >= 0 ? '+' : ''}
            {score.toFixed(0)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-left">
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">手牌</p>
          <p className="mt-1 text-sm font-semibold text-white">{handCount}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">胡息</p>
          <p className="mt-1 text-sm font-semibold text-white">{huXi}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">门子</p>
          <p className="mt-1 text-sm font-semibold text-white">{menZi}</p>
        </div>
      </div>
    </section>
  );
}
