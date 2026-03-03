export const SMALL_TILE_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const;
export const BIG_TILE_LABELS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'] as const;

const RED_TILE_VALUES = new Set([2, 7, 10, 12, 17, 20]);

export interface Tile {
  id: number;
  value: number;
  display: string;
  isRed: boolean;
  isSmall: boolean;
}

export function createDeck(): Tile[] {
  const deck: Tile[] = [];

  for (let value = 1; value <= 20; value += 1) {
    const isSmall = value <= 10;
    const labelIndex = isSmall ? value - 1 : value - 11;
    const display = isSmall ? SMALL_TILE_LABELS[labelIndex] : BIG_TILE_LABELS[labelIndex];

    for (let copy = 0; copy < 4; copy += 1) {
      deck.push({
        id: deck.length,
        value,
        display,
        isRed: RED_TILE_VALUES.has(value),
        isSmall,
      });
    }
  }

  return deck;
}

export function shuffleDeck(deck: Tile[]): Tile[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

export function cloneTile(tile: Tile): Tile {
  return { ...tile };
}

export function cloneTiles(tiles: Tile[]): Tile[] {
  return tiles.map(cloneTile);
}

export function getBaseRank(value: number): number {
  return value > 10 ? value - 10 : value;
}

export function toExactValue(rank: number, isSmall: boolean): number {
  return isSmall ? rank : rank + 10;
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((left, right) => {
    if (left.value !== right.value) {
      return left.value - right.value;
    }

    return left.id - right.id;
  });
}
