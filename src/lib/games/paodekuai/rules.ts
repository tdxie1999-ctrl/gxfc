import { sortCards, type PaodekuaiCard } from '@/lib/games/paodekuai/cards';

export enum CardPattern {
  SINGLE = 'SINGLE',
  PAIR = 'PAIR',
  TRIPLE = 'TRIPLE',
  TRIPLE_ONE = 'TRIPLE_ONE',
  TRIPLE_TWO = 'TRIPLE_TWO',
  FOUR_TWO = 'FOUR_TWO',
  FOUR_THREE = 'FOUR_THREE',
  STRAIGHT = 'STRAIGHT',
  DOUBLE_STRAIGHT = 'DOUBLE_STRAIGHT',
  PLANE = 'PLANE',
  BOMB = 'BOMB',
  ROCKET = 'ROCKET',
}

export interface CardPatternResult {
  type: CardPattern;
  rank: number;
  length: number;
  cards: PaodekuaiCard[];
}

export interface CardPlay {
  cards: PaodekuaiCard[];
  playerIndex: number;
  pattern: CardPatternResult;
}

type RankGroup = {
  rank: number;
  cards: PaodekuaiCard[];
};

function groupByRank(cards: PaodekuaiCard[]): RankGroup[] {
  const map = new Map<number, PaodekuaiCard[]>();

  for (const card of sortCards(cards)) {
    const list = map.get(card.value) ?? [];
    list.push(card);
    map.set(card.value, list);
  }

  return [...map.entries()]
    .map(([rank, groupedCards]) => ({ rank, cards: groupedCards }))
    .sort((left, right) => left.rank - right.rank);
}

function isStraight(groups: RankGroup[], totalLength: number): boolean {
  if (totalLength < 5 || groups.length !== totalLength) {
    return false;
  }

  for (let index = 0; index < groups.length; index += 1) {
    const current = groups[index];

    if (current.cards.length !== 1 || current.rank >= 15) {
      return false;
    }

    if (index > 0 && current.rank !== groups[index - 1].rank + 1) {
      return false;
    }
  }

  return true;
}

function isDoubleStraight(groups: RankGroup[], totalLength: number): boolean {
  if (totalLength < 6 || totalLength % 2 !== 0 || groups.length !== totalLength / 2) {
    return false;
  }

  for (let index = 0; index < groups.length; index += 1) {
    const current = groups[index];

    if (current.cards.length !== 2 || current.rank >= 15) {
      return false;
    }

    if (index > 0 && current.rank !== groups[index - 1].rank + 1) {
      return false;
    }
  }

  return true;
}

function isPlane(groups: RankGroup[], totalLength: number): boolean {
  if (totalLength < 6 || totalLength % 3 !== 0 || groups.length !== totalLength / 3) {
    return false;
  }

  for (let index = 0; index < groups.length; index += 1) {
    const current = groups[index];

    if (current.cards.length !== 3 || current.rank >= 15) {
      return false;
    }

    if (index > 0 && current.rank !== groups[index - 1].rank + 1) {
      return false;
    }
  }

  return true;
}

function sortPatternResults(results: CardPatternResult[]): CardPatternResult[] {
  const typeWeight: Record<CardPattern, number> = {
    [CardPattern.SINGLE]: 1,
    [CardPattern.PAIR]: 2,
    [CardPattern.TRIPLE]: 3,
    [CardPattern.TRIPLE_ONE]: 4,
    [CardPattern.TRIPLE_TWO]: 5,
    [CardPattern.FOUR_TWO]: 6,
    [CardPattern.FOUR_THREE]: 7,
    [CardPattern.STRAIGHT]: 8,
    [CardPattern.DOUBLE_STRAIGHT]: 9,
    [CardPattern.PLANE]: 10,
    [CardPattern.BOMB]: 11,
    [CardPattern.ROCKET]: 12,
  };

  return results.sort((left, right) => {
    if (typeWeight[left.type] !== typeWeight[right.type]) {
      return typeWeight[left.type] - typeWeight[right.type];
    }

    if (left.length !== right.length) {
      return left.length - right.length;
    }

    return left.rank - right.rank;
  });
}

export function getCardPattern(cards: PaodekuaiCard[]): CardPatternResult | null {
  const sorted = sortCards(cards);
  const groups = groupByRank(sorted);
  const totalLength = sorted.length;
  const counts = groups.map((group) => group.cards.length).sort((left, right) => right - left);
  const maxGroup = groups.reduce((best, current) => (current.cards.length > best.cards.length ? current : best), groups[0] ?? { rank: 0, cards: [] });
  const tripleGroup = groups.find((group) => group.cards.length === 3) ?? null;
  const bombGroup = groups.find((group) => group.cards.length === 4) ?? null;

  if (totalLength === 0) {
    return null;
  }

  if (totalLength === 1) {
    return { type: CardPattern.SINGLE, rank: sorted[0].value, length: 1, cards: sorted };
  }

  if (totalLength === 2) {
    const isRocket =
      sorted[0].suit === 'joker' && sorted[1].suit === 'joker' && sorted[0].value !== sorted[1].value;

    if (isRocket) {
      return { type: CardPattern.ROCKET, rank: 17, length: 2, cards: sorted };
    }

    if (groups.length === 1) {
      return { type: CardPattern.PAIR, rank: sorted[0].value, length: 2, cards: sorted };
    }

    return null;
  }

  if (totalLength === 3 && groups.length === 1) {
    return { type: CardPattern.TRIPLE, rank: sorted[0].value, length: 3, cards: sorted };
  }

  if (totalLength === 4) {
    if (groups.length === 1) {
      return { type: CardPattern.BOMB, rank: sorted[0].value, length: 4, cards: sorted };
    }

    if (counts[0] === 3 && counts[1] === 1 && tripleGroup) {
      return { type: CardPattern.TRIPLE_ONE, rank: tripleGroup.rank, length: 4, cards: sorted };
    }
  }

  if (totalLength === 5) {
    if (counts[0] === 3 && counts[1] === 2 && tripleGroup) {
      return { type: CardPattern.TRIPLE_TWO, rank: tripleGroup.rank, length: 5, cards: sorted };
    }

    if (isStraight(groups, totalLength)) {
      return {
        type: CardPattern.STRAIGHT,
        rank: groups[groups.length - 1].rank,
        length: totalLength,
        cards: sorted,
      };
    }
  }

  if (isStraight(groups, totalLength)) {
    return {
      type: CardPattern.STRAIGHT,
      rank: groups[groups.length - 1].rank,
      length: totalLength,
      cards: sorted,
    };
  }

  if (isDoubleStraight(groups, totalLength)) {
    return {
      type: CardPattern.DOUBLE_STRAIGHT,
      rank: groups[groups.length - 1].rank,
      length: totalLength,
      cards: sorted,
    };
  }

  if (isPlane(groups, totalLength)) {
    return {
      type: CardPattern.PLANE,
      rank: groups[groups.length - 1].rank,
      length: totalLength,
      cards: sorted,
    };
  }

  if (bombGroup) {
    if (totalLength === 6) {
      return { type: CardPattern.FOUR_TWO, rank: bombGroup.rank, length: totalLength, cards: sorted };
    }

    if (totalLength === 7) {
      return {
        type: CardPattern.FOUR_THREE,
        rank: bombGroup.rank,
        length: totalLength,
        cards: sorted,
      };
    }
  }

  if (maxGroup.cards.length === 4 && totalLength === 4) {
    return { type: CardPattern.BOMB, rank: maxGroup.rank, length: totalLength, cards: sorted };
  }

  return null;
}

export function canBeat(current: CardPatternResult, previous: CardPatternResult): boolean {
  if (current.type === CardPattern.ROCKET) {
    return true;
  }

  if (previous.type === CardPattern.ROCKET) {
    return false;
  }

  if (current.type === CardPattern.BOMB && previous.type !== CardPattern.BOMB) {
    return true;
  }

  if (current.type !== previous.type) {
    return false;
  }

  if (current.length !== previous.length) {
    return false;
  }

  return current.rank > previous.rank;
}

function addCandidate(list: CardPatternResult[], cards: PaodekuaiCard[]) {
  const pattern = getCardPattern(cards);

  if (!pattern) {
    return;
  }

  const key = pattern.cards
    .map((card) => card.id)
    .sort((left, right) => left - right)
    .join('-');

  if (list.some((item) => item.cards.map((card) => card.id).sort((l, r) => l - r).join('-') === key)) {
    return;
  }

  list.push(pattern);
}

function buildSequentialCandidates(groups: RankGroup[], minGroups: number, width: number): PaodekuaiCard[][] {
  const sequences: PaodekuaiCard[][] = [];
  let start = 0;

  while (start < groups.length) {
    let end = start;

    while (end + 1 < groups.length && groups[end + 1].rank === groups[end].rank + 1) {
      end += 1;
    }

    const segment = groups.slice(start, end + 1);

    if (segment.length >= minGroups) {
      for (let left = 0; left <= segment.length - minGroups; left += 1) {
        for (let right = left + minGroups; right <= segment.length; right += 1) {
          const chunk = segment.slice(left, right);
          const cards = chunk.flatMap((group) => group.cards.slice(0, width));
          sequences.push(cards);
        }
      }
    }

    start = end + 1;
  }

  return sequences;
}

export function findPlayableHands(hand: PaodekuaiCard[], lastPlay: CardPlay | null): PaodekuaiCard[][] {
  const sortedHand = sortCards(hand);
  const groups = groupByRank(sortedHand);
  const patterns: CardPatternResult[] = [];

  for (const card of sortedHand) {
    addCandidate(patterns, [card]);
  }

  for (const group of groups) {
    if (group.cards.length >= 2) {
      addCandidate(patterns, group.cards.slice(0, 2));
    }

    if (group.cards.length >= 3) {
      addCandidate(patterns, group.cards.slice(0, 3));
    }

    if (group.cards.length >= 4) {
      addCandidate(patterns, group.cards.slice(0, 4));
    }
  }

  const jokers = sortedHand.filter((card) => card.suit === 'joker');
  if (jokers.length >= 2) {
    addCandidate(patterns, jokers.slice(0, 2));
  }

  const tripleGroups = groups.filter((group) => group.cards.length >= 3);
  const pairGroups = groups.filter((group) => group.cards.length >= 2);
  const bombGroups = groups.filter((group) => group.cards.length >= 4);

  for (const triple of tripleGroups) {
    const single = sortedHand.find((card) => card.value !== triple.rank);
    if (single) {
      addCandidate(patterns, [...triple.cards.slice(0, 3), single]);
    }

    const pair = pairGroups.find((group) => group.rank !== triple.rank);
    if (pair) {
      addCandidate(patterns, [...triple.cards.slice(0, 3), ...pair.cards.slice(0, 2)]);
    }
  }

  for (const bomb of bombGroups) {
    const singles = sortedHand.filter((card) => card.value !== bomb.rank).slice(0, 3);

    if (singles.length >= 2) {
      addCandidate(patterns, [...bomb.cards.slice(0, 4), ...singles.slice(0, 2)]);
    }

    if (singles.length >= 3) {
      addCandidate(patterns, [...bomb.cards.slice(0, 4), ...singles.slice(0, 3)]);
    }
  }

  const singleGroups = groups.filter((group) => group.cards.length >= 1 && group.rank < 15);
  const straightCandidates = buildSequentialCandidates(singleGroups, 5, 1);
  const doubleStraightCandidates = buildSequentialCandidates(
    pairGroups.filter((group) => group.rank < 15),
    3,
    2,
  );
  const planeCandidates = buildSequentialCandidates(
    tripleGroups.filter((group) => group.rank < 15),
    2,
    3,
  );

  for (const cards of [...straightCandidates, ...doubleStraightCandidates, ...planeCandidates]) {
    addCandidate(patterns, cards);
  }

  const filtered = lastPlay
    ? patterns.filter((pattern) => canBeat(pattern, lastPlay.pattern))
    : patterns;

  return sortPatternResults(filtered).map((pattern) => pattern.cards);
}
