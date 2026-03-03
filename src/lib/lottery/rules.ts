export type LotteryColor = 'red' | 'blue' | 'green';
export type Zodiac =
  | '鼠'
  | '牛'
  | '虎'
  | '兔'
  | '龙'
  | '蛇'
  | '马'
  | '羊'
  | '猴'
  | '鸡'
  | '狗'
  | '猪';

export type CategoryId =
  | 'colorWave'
  | 'teMa'
  | 'teXiao'
  | 'zhengMa'
  | 'zhengTe'
  | 'zhengMa1to6'
  | 'lianMa'
  | 'yiXiao'
  | 'ziXuanBuZhong';

export type LianMaTypeId = 'erQuanZhong' | 'sanQuanZhong' | 'erZhongEr' | 'teChuan';
export type NotInType = 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type ZhengMaPlayOption = '大' | '小' | '单' | '双' | '合单' | '合双' | '红波' | '蓝波';

export interface LotteryDrawResult {
  issueNo: string;
  numbers: number[];
  specialNumber: number;
  drawTime: string;
}

export const BASE_ISSUE_NO = '20260302001';
export const DRAW_INTERVAL_SECONDS = 90;
export const NUMBER_LIST = Array.from({ length: 49 }, (_, index) => index + 1);
export const ZODIAC_LIST: Zodiac[] = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
export const CATEGORY_TABS: Array<{ id: CategoryId; label: string }> = [
  { id: 'colorWave', label: '色波' },
  { id: 'teMa', label: '特码' },
  { id: 'teXiao', label: '特肖' },
  { id: 'zhengMa', label: '正码' },
  { id: 'zhengTe', label: '正特' },
  { id: 'zhengMa1to6', label: '正码1-6' },
  { id: 'lianMa', label: '连码' },
  { id: 'yiXiao', label: '一肖' },
  { id: 'ziXuanBuZhong', label: '自选不中' },
];

export const COLOR_LABELS: Record<LotteryColor, string> = {
  red: '红波',
  blue: '蓝波',
  green: '绿波',
};

export const LIANMA_TYPES: Array<{ id: LianMaTypeId; label: string; pick: number }> = [
  { id: 'erQuanZhong', label: '二全中', pick: 2 },
  { id: 'sanQuanZhong', label: '三全中', pick: 3 },
  { id: 'erZhongEr', label: '二中二', pick: 2 },
  { id: 'teChuan', label: '特串', pick: 2 },
];

export const NOT_IN_TYPES: NotInType[] = [5, 6, 7, 8, 9, 10, 11, 12];
export const ZHENGMA_PLAY_OPTIONS: ZhengMaPlayOption[] = [
  '大',
  '小',
  '单',
  '双',
  '合单',
  '合双',
  '红波',
  '蓝波',
];

const RED_NUMBERS = new Set([1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46]);
const BLUE_NUMBERS = new Set([3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48]);

export const ZODIAC_NUMBER_MAP: Record<Zodiac, number[]> = {
  鼠: [1, 13, 25, 37, 49],
  牛: [12, 24, 36, 48],
  虎: [11, 23, 35, 47],
  兔: [10, 22, 34, 46],
  龙: [9, 21, 33, 45],
  蛇: [8, 20, 32, 44],
  马: [7, 19, 31, 43],
  羊: [6, 18, 30, 42],
  猴: [5, 17, 29, 41],
  鸡: [4, 16, 28, 40],
  狗: [3, 15, 27, 39],
  猪: [2, 14, 26, 38],
};

const NUMBER_ZODIAC_MAP = new Map<number, Zodiac>(
  Object.entries(ZODIAC_NUMBER_MAP).flatMap(([zodiac, numbers]) =>
    numbers.map((number) => [number, zodiac as Zodiac] as const)
  )
);

export function formatNumber(value: number) {
  return String(value).padStart(2, '0');
}

export function formatNumberList(values: number[]) {
  return values
    .slice()
    .sort((a, b) => a - b)
    .map((value) => formatNumber(value))
    .join(' ');
}

export function getBallColor(number: number): LotteryColor {
  if (RED_NUMBERS.has(number)) {
    return 'red';
  }
  if (BLUE_NUMBERS.has(number)) {
    return 'blue';
  }
  return 'green';
}

export function getZodiacByNumber(number: number): Zodiac {
  return NUMBER_ZODIAC_MAP.get(number) ?? '鼠';
}

export function toggleValue<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function combination(n: number, k: number) {
  if (k < 0 || n < k) {
    return 0;
  }
  if (k === 0 || n === k) {
    return 1;
  }

  let result = 1;
  for (let index = 1; index <= k; index += 1) {
    result = (result * (n - index + 1)) / index;
  }
  return Math.round(result);
}

export function nextIssueNo(issueNo: string) {
  const hyphenated = issueNo.match(/^(\d{8})-(\d+)$/);
  if (hyphenated) {
    const [, datePart, sequencePart] = hyphenated;
    const nextSequence = String(Number(sequencePart) + 1).padStart(sequencePart.length, '0');
    return `${datePart}-${nextSequence}`;
  }

  const numeric = Number(issueNo);
  if (!Number.isFinite(numeric)) {
    return BASE_ISSUE_NO;
  }
  return String(numeric + 1);
}

function mulberry32(seed: number) {
  let t = seed;
  return function rand() {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), t | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromIssue(issueNo: string) {
  let seed = 0;
  for (const ch of issueNo) {
    seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return seed || 1;
}

export function buildHardcodedDraw(issueNo: string): LotteryDrawResult {
  const random = mulberry32(seedFromIssue(issueNo));
  const pool = [...NUMBER_LIST];
  const picked: number[] = [];

  while (picked.length < 7 && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    const [value] = pool.splice(index, 1);
    picked.push(value);
  }

  return {
    issueNo,
    numbers: picked.slice(0, 6).sort((a, b) => a - b),
    specialNumber: picked[6] ?? 49,
    drawTime: new Date().toISOString(),
  };
}
