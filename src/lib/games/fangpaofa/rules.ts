import {
  cloneTile,
  cloneTiles,
  createDeck,
  getBaseRank,
  sortTiles,
  toExactValue,
  type Tile,
} from '@/lib/games/fangpaofa/tiles';

export type MeldType = 'chi' | 'peng' | 'wei' | 'pao' | 'ti';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  huXi: number;
  source: 'self' | 'discard' | 'upgrade';
}

export interface ChiOption {
  tiles: Tile[];
  combined: Tile[];
  huXi: number;
  label: string;
}

export interface TiOption {
  tileValue: number;
  tiles: Tile[];
  huXi: number;
  upgradeFromWei: boolean;
}

export interface HuCheckResult {
  valid: boolean;
  huXi: number;
  menZi: number;
  residual: number;
}

export interface HandBreakdown {
  groups: number;
  huXi: number;
  residual: number;
}

export interface GameConfig {
  minHuXi: number;
  maxScore: number;
  hasNiao: boolean;
  hasPiaoHu: boolean;
  firstDealerMode: 'random' | 'host';
  autoPlaySeconds: number;
  rakePercent: number;
  baseStake: number;
}

export const defaultFangpaofaConfig: GameConfig = {
  minHuXi: 15,
  maxScore: 100,
  hasNiao: false,
  hasPiaoHu: false,
  firstDealerMode: 'random',
  autoPlaySeconds: 120,
  rakePercent: 5,
  baseStake: 1,
};

export const fangpaofaRules = {
  maxPlayers: 3,
  minPlayers: 2,
  config: defaultFangpaofaConfig,
};

const SPECIAL_CHI_BY_SIZE = [
  [2, 7, 10],
  [12, 17, 20],
] as const;

function getCountByValue(tiles: Tile[]): Map<number, number> {
  const counts = new Map<number, number>();

  for (const tile of tiles) {
    counts.set(tile.value, (counts.get(tile.value) ?? 0) + 1);
  }

  return counts;
}

function getTileHuXiByType(type: MeldType, tileValue: number): number {
  const isSmall = tileValue <= 10;

  switch (type) {
    case 'chi':
      return 0;
    case 'peng':
      return isSmall ? 1 : 3;
    case 'wei':
      return isSmall ? 3 : 6;
    case 'pao':
      return isSmall ? 6 : 9;
    case 'ti':
      return isSmall ? 9 : 12;
    default:
      return 0;
  }
}

function cloneCounts(counts: Map<number, number>): Map<number, number> {
  return new Map<number, number>(counts.entries());
}

function pickTilesForValues(hand: Tile[], values: number[]): Tile[] | null {
  const available = [...hand];
  const selected: Tile[] = [];

  for (const value of values) {
    const foundIndex = available.findIndex((tile) => tile.value === value);

    if (foundIndex === -1) {
      return null;
    }

    const [foundTile] = available.splice(foundIndex, 1);
    selected.push(foundTile);
  }

  return sortTiles(selected);
}

function consumeSpecialChi(counts: Map<number, number>): HandBreakdown {
  let groups = 0;
  let huXi = 0;

  for (const pattern of SPECIAL_CHI_BY_SIZE) {
    while (pattern.every((value) => (counts.get(value) ?? 0) > 0)) {
      for (const value of pattern) {
        counts.set(value, (counts.get(value) ?? 0) - 1);
      }

      groups += 1;
      huXi += pattern[0] <= 10 ? 3 : 6;
    }
  }

  return { groups, huXi, residual: 0 };
}

function consumeSequences(counts: Map<number, number>): HandBreakdown {
  let groups = 0;

  for (let start = 1; start <= 8; start += 1) {
    while (
      (counts.get(start) ?? 0) > 0 &&
      (counts.get(start + 1) ?? 0) > 0 &&
      (counts.get(start + 2) ?? 0) > 0
    ) {
      counts.set(start, (counts.get(start) ?? 0) - 1);
      counts.set(start + 1, (counts.get(start + 1) ?? 0) - 1);
      counts.set(start + 2, (counts.get(start + 2) ?? 0) - 1);
      groups += 1;
    }
  }

  for (let start = 11; start <= 18; start += 1) {
    while (
      (counts.get(start) ?? 0) > 0 &&
      (counts.get(start + 1) ?? 0) > 0 &&
      (counts.get(start + 2) ?? 0) > 0
    ) {
      counts.set(start, (counts.get(start) ?? 0) - 1);
      counts.set(start + 1, (counts.get(start + 1) ?? 0) - 1);
      counts.set(start + 2, (counts.get(start + 2) ?? 0) - 1);
      groups += 1;
    }
  }

  return { groups, huXi: 0, residual: 0 };
}

function consumeTriplesAndQuads(counts: Map<number, number>): HandBreakdown {
  let groups = 0;
  let huXi = 0;

  for (let value = 1; value <= 20; value += 1) {
    while ((counts.get(value) ?? 0) >= 4) {
      counts.set(value, (counts.get(value) ?? 0) - 4);
      groups += 1;
      huXi += getTileHuXiByType('ti', value);
    }

    while ((counts.get(value) ?? 0) >= 3) {
      counts.set(value, (counts.get(value) ?? 0) - 3);
      groups += 1;
      huXi += getTileHuXiByType('wei', value);
    }
  }

  return { groups, huXi, residual: 0 };
}

function sumResidual(counts: Map<number, number>): number {
  let total = 0;

  counts.forEach((amount) => {
    total += amount;
  });

  return total;
}

function evaluateStrategy(originalCounts: Map<number, number>, preferSequenceFirst: boolean): HandBreakdown {
  const counts = cloneCounts(originalCounts);
  let groups = 0;
  let huXi = 0;

  if (preferSequenceFirst) {
    const special = consumeSpecialChi(counts);
    groups += special.groups;
    huXi += special.huXi;

    const sequences = consumeSequences(counts);
    groups += sequences.groups;

    const triples = consumeTriplesAndQuads(counts);
    groups += triples.groups;
    huXi += triples.huXi;

    const extraSequences = consumeSequences(counts);
    groups += extraSequences.groups;
  } else {
    const triples = consumeTriplesAndQuads(counts);
    groups += triples.groups;
    huXi += triples.huXi;

    const special = consumeSpecialChi(counts);
    groups += special.groups;
    huXi += special.huXi;

    const sequences = consumeSequences(counts);
    groups += sequences.groups;

    const extraTriples = consumeTriplesAndQuads(counts);
    groups += extraTriples.groups;
    huXi += extraTriples.huXi;
  }

  return {
    groups,
    huXi,
    residual: sumResidual(counts),
  };
}

export function evaluateFreeHand(hand: Tile[]): HandBreakdown {
  const counts = getCountByValue(hand);
  const sequenceFirst = evaluateStrategy(counts, true);
  const tripleFirst = evaluateStrategy(counts, false);

  if (sequenceFirst.residual !== tripleFirst.residual) {
    return sequenceFirst.residual < tripleFirst.residual ? sequenceFirst : tripleFirst;
  }

  if (sequenceFirst.groups !== tripleFirst.groups) {
    return sequenceFirst.groups > tripleFirst.groups ? sequenceFirst : tripleFirst;
  }

  return sequenceFirst.huXi >= tripleFirst.huXi ? sequenceFirst : tripleFirst;
}

export function calculateMeldHuXi(melds: Meld[]): number {
  return melds.reduce((total, meld) => total + meld.huXi, 0);
}

export function analyzeHu(melds: Meld[], hand: Tile[], config: GameConfig = defaultFangpaofaConfig): HuCheckResult {
  const freeHand = evaluateFreeHand(hand);
  const totalHuXi = calculateMeldHuXi(melds) + freeHand.huXi;
  const totalMenZi = melds.length + freeHand.groups;
  const valid = totalHuXi >= config.minHuXi && totalMenZi >= 7 && freeHand.residual <= 2;

  return {
    valid,
    huXi: totalHuXi,
    menZi: totalMenZi,
    residual: freeHand.residual,
  };
}

export function canPeng(hand: Tile[], tile: Tile): boolean {
  return hand.filter((candidate) => candidate.value === tile.value).length >= 2;
}

export function canWei(hand: Tile[], tile: Tile): boolean {
  return hand.filter((candidate) => candidate.value === tile.value).length >= 3;
}

export function canPao(hand: Tile[], melds: Meld[], tile: Tile): boolean {
  const sameInHand = hand.filter((candidate) => candidate.value === tile.value).length;

  if (sameInHand >= 3) {
    return true;
  }

  return melds.some(
    (meld) =>
      (meld.type === 'peng' || meld.type === 'wei') &&
      meld.tiles.length > 0 &&
      meld.tiles[0].value === tile.value
  );
}

export function canTi(hand: Tile[], melds: Meld[]): TiOption[] {
  const counts = getCountByValue(hand);
  const options: TiOption[] = [];

  counts.forEach((amount, value) => {
    if (amount >= 4) {
      const tiles = sortTiles(hand.filter((tile) => tile.value === value).slice(0, 4));
      options.push({
        tileValue: value,
        tiles,
        huXi: getTileHuXiByType('ti', value),
        upgradeFromWei: false,
      });
    }
  });

  for (const meld of melds) {
    if (meld.type !== 'wei' || meld.tiles.length === 0) {
      continue;
    }

    const targetValue = meld.tiles[0].value;
    const candidate = hand.find((tile) => tile.value === targetValue);

    if (!candidate) {
      continue;
    }

    options.push({
      tileValue: targetValue,
      tiles: [...cloneTiles(meld.tiles), cloneTile(candidate)],
      huXi: getTileHuXiByType('ti', targetValue),
      upgradeFromWei: true,
    });
  }

  return options.sort((left, right) => right.huXi - left.huXi || left.tileValue - right.tileValue);
}

export function findChiOptions(hand: Tile[], tile: Tile): ChiOption[] {
  const options: ChiOption[] = [];
  const baseRank = getBaseRank(tile.value);
  const sequenceCandidates = [
    [baseRank - 2, baseRank - 1],
    [baseRank - 1, baseRank + 1],
    [baseRank + 1, baseRank + 2],
  ];

  for (const [left, right] of sequenceCandidates) {
    if (left < 1 || right > 10) {
      continue;
    }

    const exactValues = [toExactValue(left, tile.isSmall), toExactValue(right, tile.isSmall)];
    const selected = pickTilesForValues(hand, exactValues);

    if (!selected) {
      continue;
    }

    const combined = sortTiles([...selected, cloneTile(tile)]);
    options.push({
      tiles: selected,
      combined,
      huXi: 0,
      label: combined.map((candidate) => candidate.display).join(''),
    });
  }

  if (baseRank === 2 || baseRank === 7 || baseRank === 10) {
    const specialValues = [2, 7, 10]
      .filter((rank) => rank !== baseRank)
      .map((rank) => toExactValue(rank, tile.isSmall));

    const specialTiles = pickTilesForValues(hand, specialValues);

    if (specialTiles) {
      const combined = sortTiles([...specialTiles, cloneTile(tile)]);
      options.push({
        tiles: specialTiles,
        combined,
        huXi: tile.isSmall ? 3 : 6,
        label: combined.map((candidate) => candidate.display).join(''),
      });
    }
  }

  const deduped = new Map<string, ChiOption>();

  for (const option of options) {
    const key = option.combined.map((candidate) => candidate.value).join('-');

    if (!deduped.has(key)) {
      deduped.set(key, option);
    }
  }

  return Array.from(deduped.values()).sort(
    (left, right) => right.huXi - left.huXi || left.label.localeCompare(right.label)
  );
}

export function createChiMeld(option: ChiOption, claimedTile: Tile): Meld {
  return {
    type: 'chi',
    tiles: sortTiles([...cloneTiles(option.tiles), cloneTile(claimedTile)]),
    huXi: option.huXi,
    source: 'discard',
  };
}

export function createMeld(type: Exclude<MeldType, 'chi'>, tiles: Tile[], source: Meld['source']): Meld {
  const sorted = sortTiles(tiles);
  const tileValue = sorted[0]?.value ?? 1;

  return {
    type,
    tiles: sorted,
    huXi: getTileHuXiByType(type, tileValue),
    source,
  };
}

export { createDeck, cloneTile, cloneTiles, sortTiles, type Tile };
