import { sortCards, type PaodekuaiCard } from '@/lib/games/paodekuai/cards';

export enum DatongziPatternType {
  SINGLE = 'SINGLE',
  PAIR = 'PAIR',
  TRIPLE = 'TRIPLE',
  STRAIGHT = 'STRAIGHT',
  TONGZI = 'TONGZI',
}

export interface DatongziPatternResult {
  type: DatongziPatternType;
  rank: number;
  length: number;
  xi: number;
  label: string;
  cards: PaodekuaiCard[];
}

export interface DatongziPlay {
  cards: PaodekuaiCard[];
  playerIndex: number;
  pattern: DatongziPatternResult;
}

interface RankGroup {
  rank: number;
  cards: PaodekuaiCard[];
}

const patternWeight: Record<DatongziPatternType, number> = {
  [DatongziPatternType.SINGLE]: 1,
  [DatongziPatternType.PAIR]: 2,
  [DatongziPatternType.TRIPLE]: 3,
  [DatongziPatternType.STRAIGHT]: 4,
  [DatongziPatternType.TONGZI]: 5,
};

function groupByRank(cards: PaodekuaiCard[]): RankGroup[] {
  const grouped = new Map<number, PaodekuaiCard[]>();

  for (const card of sortCards(cards)) {
    const items = grouped.get(card.value) ?? [];
    items.push(card);
    grouped.set(card.value, items);
  }

  return [...grouped.entries()]
    .map(([rank, rankCards]) => ({ rank, cards: rankCards }))
    .sort((left, right) => left.rank - right.rank);
}

function sortPatterns(patterns: DatongziPatternResult[]): DatongziPatternResult[] {
  return [...patterns].sort((left, right) => {
    if (patternWeight[left.type] !== patternWeight[right.type]) {
      return patternWeight[left.type] - patternWeight[right.type];
    }

    if (left.length !== right.length) {
      return left.length - right.length;
    }

    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }

    return (left.cards[0]?.id ?? 0) - (right.cards[0]?.id ?? 0);
  });
}

function createStraightPattern(cards: PaodekuaiCard[]): DatongziPatternResult {
  const sorted = sortCards(cards);
  const highest = sorted[sorted.length - 1];
  const extraXi = sorted.length >= 5 ? sorted.length - 4 : 0;

  return {
    type: DatongziPatternType.STRAIGHT,
    rank: highest?.value ?? 0,
    length: sorted.length,
    xi: extraXi,
    label: `${sorted.length}连顺`,
    cards: sorted,
  };
}

export function getDatongziPattern(cards: PaodekuaiCard[]): DatongziPatternResult | null {
  const sorted = sortCards(cards);
  const groups = groupByRank(sorted);
  const totalLength = sorted.length;

  if (totalLength === 0) {
    return null;
  }

  if (totalLength === 1) {
    return {
      type: DatongziPatternType.SINGLE,
      rank: sorted[0].value,
      length: 1,
      xi: 0,
      label: '单张',
      cards: sorted,
    };
  }

  if (totalLength === 2 && groups.length === 1) {
    return {
      type: DatongziPatternType.PAIR,
      rank: sorted[0].value,
      length: 2,
      xi: 0,
      label: '对子',
      cards: sorted,
    };
  }

  if (totalLength === 3 && groups.length === 1) {
    return {
      type: DatongziPatternType.TRIPLE,
      rank: sorted[0].value,
      length: 3,
      xi: 2,
      label: '三条',
      cards: sorted,
    };
  }

  if (totalLength === 4 && groups.length === 1) {
    return {
      type: DatongziPatternType.TONGZI,
      rank: sorted[0].value,
      length: 4,
      xi: 6,
      label: '筒子',
      cards: sorted,
    };
  }

  const isStraight =
    totalLength >= 3 &&
    groups.length === totalLength &&
    groups.every((group) => group.cards.length === 1 && group.rank < 15) &&
    groups.every((group, index) => (index === 0 ? true : group.rank === groups[index - 1].rank + 1));

  if (isStraight) {
    return createStraightPattern(sorted);
  }

  return null;
}

export function canBeatDatongzi(
  current: DatongziPatternResult,
  previous: DatongziPatternResult,
): boolean {
  if (current.type === DatongziPatternType.TONGZI && previous.type !== DatongziPatternType.TONGZI) {
    return true;
  }

  if (previous.type === DatongziPatternType.TONGZI && current.type !== DatongziPatternType.TONGZI) {
    return false;
  }

  if (current.type !== previous.type) {
    return false;
  }

  if (current.type === DatongziPatternType.STRAIGHT && current.length !== previous.length) {
    return false;
  }

  if (current.length !== previous.length) {
    return false;
  }

  return current.rank > previous.rank;
}

function findStraightPatterns(groups: RankGroup[]): DatongziPatternResult[] {
  const usable = groups.filter((group) => group.cards.length > 0 && group.rank < 15);
  const results: DatongziPatternResult[] = [];

  for (let start = 0; start < usable.length; start += 1) {
    const picked: PaodekuaiCard[] = [usable[start].cards[0]];

    for (let end = start + 1; end < usable.length; end += 1) {
      if (usable[end].rank !== usable[end - 1].rank + 1) {
        break;
      }

      picked.push(usable[end].cards[0]);

      if (picked.length >= 3) {
        results.push(createStraightPattern([...picked]));
      }
    }
  }

  return results;
}

export function findDatongziPatterns(hand: PaodekuaiCard[]): DatongziPatternResult[] {
  const sortedHand = sortCards(hand);
  const groups = groupByRank(sortedHand);
  const patterns: DatongziPatternResult[] = [];

  for (const card of sortedHand) {
    patterns.push({
      type: DatongziPatternType.SINGLE,
      rank: card.value,
      length: 1,
      xi: 0,
      label: '单张',
      cards: [card],
    });
  }

  for (const group of groups) {
    if (group.cards.length >= 2) {
      patterns.push({
        type: DatongziPatternType.PAIR,
        rank: group.rank,
        length: 2,
        xi: 0,
        label: '对子',
        cards: group.cards.slice(0, 2),
      });
    }

    if (group.cards.length >= 3) {
      patterns.push({
        type: DatongziPatternType.TRIPLE,
        rank: group.rank,
        length: 3,
        xi: 2,
        label: '三条',
        cards: group.cards.slice(0, 3),
      });
    }

    if (group.cards.length >= 4) {
      patterns.push({
        type: DatongziPatternType.TONGZI,
        rank: group.rank,
        length: 4,
        xi: 6,
        label: '筒子',
        cards: group.cards.slice(0, 4),
      });
    }
  }

  patterns.push(...findStraightPatterns(groups));

  return sortPatterns(patterns);
}

export function findDatongziPlayableHands(
  hand: PaodekuaiCard[],
  previousPlay: DatongziPlay | null,
): PaodekuaiCard[][] {
  const candidates = findDatongziPatterns(hand);

  if (!previousPlay) {
    return candidates.map((pattern) => [...pattern.cards]);
  }

  return candidates
    .filter((pattern) => canBeatDatongzi(pattern, previousPlay.pattern))
    .map((pattern) => [...pattern.cards]);
}

export const datongziRules = {
  maxPlayers: 2,
  minStraightLength: 3,
  placeholderMode: true,
};
