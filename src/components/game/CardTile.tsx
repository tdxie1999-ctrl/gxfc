import clsx from 'clsx';
import type { Tile } from '@/lib/games/fangpaofa/rules';

interface CardTileProps {
  tile: Tile;
  selected?: boolean;
  compact?: boolean;
  faceDown?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export default function CardTile({
  tile,
  selected = false,
  compact = false,
  faceDown = false,
  disabled = false,
  onClick,
}: CardTileProps) {
  const heightClass = compact ? 'h-16 w-11 text-sm' : 'h-24 w-16 text-xl';

  if (faceDown) {
    return (
      <button
        type="button"
        disabled
        className={clsx(
          'rounded-xl border border-white/30 bg-gradient-to-br from-[#8B6914] via-[#6c4e0f] to-[#4a3207] shadow-lg',
          heightClass
        )}
      >
        <span className="text-xs tracking-[0.18em] text-white/80">发</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center justify-between rounded-xl border px-1.5 py-1 shadow-lg transition',
        heightClass,
        tile.isRed
          ? 'border-[#ffd4d4] bg-white text-[#c0392b]'
          : 'border-[#d7d7d7] bg-white text-[#1f2937]',
        onClick && !disabled && 'cursor-pointer hover:-translate-y-1',
        selected && '-translate-y-3 border-[#D4A017] ring-2 ring-[#D4A017]/60',
        disabled && 'cursor-not-allowed opacity-70'
      )}
    >
      <span className="self-start text-[0.55em] font-semibold leading-none">{tile.display}</span>
      <span className="text-[1.35em] font-black leading-none">{tile.display}</span>
      <span className="self-end text-[0.55em] font-semibold leading-none">{tile.isSmall ? '小' : '大'}</span>
    </button>
  );
}
