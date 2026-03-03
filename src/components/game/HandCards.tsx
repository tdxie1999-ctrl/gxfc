import clsx from 'clsx';
import CardTile from '@/components/game/CardTile';
import PokerCard from '@/components/game/PokerCard';
import type { Tile } from '@/lib/games/fangpaofa/tiles';
import type { PaodekuaiCard } from '@/lib/games/paodekuai/cards';

export type HandCardItem =
  | {
      key: string;
      kind: 'tile';
      tile: Tile;
      faceDown?: boolean;
    }
  | {
      key: string;
      kind: 'poker';
      card: PaodekuaiCard;
      faceDown?: boolean;
    };

interface HandCardsProps {
  cards: HandCardItem[];
  selectedIndices?: number[];
  onCardSelect?: (index: number) => void;
  className?: string;
}

export default function HandCards({
  cards,
  selectedIndices = [],
  onCardSelect,
  className = '',
}: HandCardsProps) {
  const overlapOffset = cards.length > 16 ? -24 : cards.length > 10 ? -18 : -12;

  return (
    <div className={clsx('w-full overflow-x-auto pb-2 pt-4', className)}>
      <div className="flex min-w-max items-end justify-center px-6">
        {cards.map((item, index) => {
          const isSelected = selectedIndices.includes(index);

          return (
            <div
              key={item.key}
              className="transition-transform duration-150"
              style={{
                marginLeft: index === 0 ? 0 : overlapOffset,
                transform: isSelected ? 'translateY(-12px)' : 'translateY(0)',
              }}
            >
              {item.kind === 'tile' ? (
                <CardTile
                  tile={item.tile}
                  faceDown={item.faceDown}
                  selected={isSelected}
                  onClick={onCardSelect ? () => onCardSelect(index) : undefined}
                />
              ) : (
                <PokerCard
                  card={item.card}
                  faceDown={item.faceDown}
                  selected={isSelected}
                  onClick={onCardSelect ? () => onCardSelect(index) : undefined}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

