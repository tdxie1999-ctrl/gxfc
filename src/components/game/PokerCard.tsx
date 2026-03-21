import clsx from 'clsx';
import { getSuitSymbol, type PaodekuaiCard, type PokerSuit } from '@/lib/games/paodekuai/cards';

interface PokerCardProps {
  card: PaodekuaiCard;
  selected?: boolean;
  faceDown?: boolean;
  compact?: boolean;
  onClick?: (cardId: number) => void;
}

function isRedSuit(suit: PokerSuit) {
  return suit === 'heart' || suit === 'diamond';
}

export default function PokerCard({
  card,
  selected = false,
  faceDown = false,
  compact = false,
  onClick,
}: PokerCardProps) {
  const width = compact ? 'w-10' : 'w-12';
  const height = compact ? 'h-14' : 'h-[72px]';

  if (faceDown) {
    return (
      <div
        className={clsx(
          width,
          height,
          'rounded-lg border border-white/30 bg-gradient-to-br from-[#b52d1f] to-[#7f160f] shadow-md'
        )}
      >
        <div className="m-1 flex h-[calc(100%-0.5rem)] items-center justify-center rounded-md border border-white/25 bg-white/10 text-[10px] font-bold text-white/70">
          发
        </div>
      </div>
    );
  }

  const suitSymbol = card.suit === 'joker' ? '王' : getSuitSymbol(card.suit);
  const textColor =
    card.suit === 'joker'
      ? card.rank === 'BJ'
        ? 'text-red-500'
        : 'text-gray-900'
      : isRedSuit(card.suit)
        ? 'text-red-500'
        : 'text-gray-900';

  const content = (
    <div
      className={clsx(
        width,
        height,
        'relative rounded border bg-white shadow-md transition',
        selected ? '-translate-y-3 border-[#f4c542] ring-2 ring-[#f4c542]/70' : 'border-slate-300',
        onClick && 'cursor-pointer hover:-translate-y-1'
      )}
    >
      <div className={clsx('absolute left-1.5 top-1 text-[10px] font-bold leading-tight', textColor)}>
        <div>{card.suit === 'joker' ? (card.rank === 'BJ' ? '大' : '小') : card.rank}</div>
        <div>{suitSymbol}</div>
      </div>

      <div className={clsx('flex h-full items-center justify-center text-2xl font-black', textColor)}>
        {suitSymbol}
      </div>

      <div
        className={clsx(
          'absolute bottom-1 right-1.5 rotate-180 text-[10px] font-bold leading-tight',
          textColor
        )}
      >
        <div>{card.suit === 'joker' ? (card.rank === 'BJ' ? '大' : '小') : card.rank}</div>
        <div>{suitSymbol}</div>
      </div>
    </div>
  );

  if (!onClick) {
    return content;
  }

  return (
    <button type="button" onClick={() => onClick(card.id)} className="bg-transparent p-0">
      {content}
    </button>
  );
}
