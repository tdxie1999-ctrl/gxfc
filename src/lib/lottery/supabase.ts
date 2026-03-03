import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  DRAW_INTERVAL_SECONDS,
  buildHardcodedDraw,
  combination,
  getBallColor,
  getZodiacByNumber,
  nextIssueNo,
  type LotteryColor,
  type LotteryDrawResult,
  type Zodiac,
} from '@/lib/lottery/rules';
import type { LotterySnapshot, PlaceBetPayload, PlaceBetResult, LotteryBetRecord } from '@/lib/lottery/types';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type DrawStatus = 'betting' | 'closed' | 'drawing' | 'finished';
type BetResultStatus = 'pending' | 'win' | 'lose';
type JsonObject = Record<string, unknown>;

interface LotteryDrawRow {
  id: string;
  period: string;
  draw_time: string;
  numbers: number[] | null;
  special: number | null;
  status: DrawStatus;
}

interface LotteryBetRow {
  id: string;
  user_id: string;
  draw_id: string;
  bet_type: string;
  bet_content: JsonObject | null;
  amount: number | string;
  odds: number | string;
  result: BetResultStatus;
  payout: number | string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  balance: number | string;
}

interface LotteryUserContext {
  userId: string;
  clientId: string;
  userClient: SupabaseClient;
  profile: ProfileRow;
}

interface SettlementOutcome {
  result: BetResultStatus;
  payout: number;
}

export class LotteryAuthError extends Error {}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function getOptionalAdminClient() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function getCurrentDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function buildDailyIssueNo(date: Date, sequence: number) {
  return `${getCurrentDateKey(date)}-${String(sequence).padStart(3, '0')}`;
}

function previousIssueNo(issueNo: string) {
  const hyphenated = issueNo.match(/^(\d{8})-(\d+)$/);
  if (hyphenated) {
    const [, datePart, sequencePart] = hyphenated;
    const current = Number(sequencePart);
    if (Number.isFinite(current) && current > 1) {
      return `${datePart}-${String(current - 1).padStart(sequencePart.length, '0')}`;
    }
    return `${datePart}-${'1'.padStart(sequencePart.length, '0')}`;
  }

  const numeric = Number(issueNo);
  if (!Number.isFinite(numeric) || numeric <= 1) {
    return issueNo;
  }
  return String(numeric - 1);
}

function extractSelectionSegment(detail: string) {
  const index = detail.search(/[：:]/);
  return index >= 0 ? detail.slice(index + 1).trim() : detail.trim();
}

function splitSelectionValues(detail: string) {
  return extractSelectionSegment(detail)
    .split(/[\s、,，/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSelectedNumbers(detail: string) {
  return splitSelectionValues(detail)
    .map((item) => Number(item))
    .filter((value) => Number.isFinite(value));
}

function parseSelectedZodiacs(detail: string) {
  return splitSelectionValues(detail).filter((item): item is Zodiac =>
    ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'].includes(item)
  );
}

function parseSelectedColors(detail: string) {
  const colorMap: Array<{ label: string; value: LotteryColor }> = [
    { label: '红波', value: 'red' },
    { label: '蓝波', value: 'blue' },
    { label: '绿波', value: 'green' },
  ];

  return colorMap
    .filter((item) => detail.includes(item.label))
    .map((item) => item.value);
}

function getPositionIndex(detail: string) {
  const match = detail.match(/正(?:码)?(\d)/);
  if (!match) {
    return 0;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 1) {
    return 0;
  }

  return Math.min(value, 6) - 1;
}

function getDigitSum(value: number) {
  return String(Math.abs(value))
    .split('')
    .reduce((sum, digit) => sum + Number(digit), 0);
}

function matchesZhengmaOption(number: number, option: string) {
  switch (option) {
    case '大':
      return number >= 25;
    case '小':
      return number <= 24;
    case '单':
      return number % 2 === 1;
    case '双':
      return number % 2 === 0;
    case '合单':
      return getDigitSum(number) % 2 === 1;
    case '合双':
      return getDigitSum(number) % 2 === 0;
    case '红波':
      return getBallColor(number) === 'red';
    case '蓝波':
      return getBallColor(number) === 'blue';
    case '绿波':
      return getBallColor(number) === 'green';
    default:
      return false;
  }
}

function getOddsForCategory(category: string) {
  switch (category) {
    case '特码':
      return 48.9;
    case '特肖':
      return 11;
    case '正码':
      return 8.02;
    case '正特':
      return 2.85;
    case '正码1-6':
      return 1.98;
    case '连码':
      return 3.2;
    case '一肖':
      return 2.2;
    case '自选不中':
      return 3.6;
    case '色波':
    default:
      return 2.0;
  }
}

function getCurrentLotteryResult(draw: LotteryDrawRow): LotteryDrawResult {
  const numbers = Array.isArray(draw.numbers) ? draw.numbers : [];

  if (numbers.length >= 6 && draw.special !== null) {
    return {
      issueNo: draw.period,
      numbers: numbers.slice(0, 6),
      specialNumber: draw.special,
      drawTime: draw.draw_time,
    };
  }

  throw new Error(`期号 ${draw.period} 尚未生成完整开奖结果`);
}

function getSafeBetContent(raw: unknown): JsonObject {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as JsonObject;
  }

  return {};
}

function mapBetHistory(rows: LotteryBetRow[], drawMap: Map<string, string>): LotteryBetRecord[] {
  return rows.map((row) => {
    const content = getSafeBetContent(row.bet_content);
    const units = Math.max(1, toNumber(content.units, 1));
    const totalAmount = roundMoney(toNumber(row.amount, 0));
    const stake = roundMoney(toNumber(content.stake, totalAmount / units || 0));

    return {
      id: row.id,
      issueNo: drawMap.get(row.draw_id) ?? String(content.issueNo ?? '未知期号'),
      category: row.bet_type,
      detail: String(content.detail ?? ''),
      units,
      stake,
      totalAmount,
      createdAt: row.created_at,
    };
  });
}

function getLatestDrawFromRows(rows: LotteryDrawRow[]) {
  if (rows.length === 0) {
    throw new Error('lottery_draws 中暂无已开奖数据');
  }

  return getCurrentLotteryResult(rows[0]);
}

function evaluateBet(betType: string, content: JsonObject, drawResult: LotteryDrawResult, odds: number): SettlementOutcome {
  const detail = String(content.detail ?? '');
  const stake = Math.max(0, roundMoney(toNumber(content.stake, 0)));
  const selectedNumbers = parseSelectedNumbers(detail);
  const selectedZodiacs = parseSelectedZodiacs(detail);
  const allDrawnNumbers = [...drawResult.numbers, drawResult.specialNumber];

  let matchedUnits = 0;

  switch (betType) {
    case '色波': {
      const selectedColors = parseSelectedColors(detail);
      matchedUnits = selectedColors.includes(getBallColor(drawResult.specialNumber)) ? 1 : 0;
      break;
    }

    case '特码':
      matchedUnits = selectedNumbers.includes(drawResult.specialNumber) ? 1 : 0;
      break;

    case '特肖':
      matchedUnits = selectedZodiacs.includes(getZodiacByNumber(drawResult.specialNumber)) ? 1 : 0;
      break;

    case '正码':
      matchedUnits = selectedNumbers.filter((number) => drawResult.numbers.includes(number)).length;
      break;

    case '正特': {
      const index = getPositionIndex(detail);
      matchedUnits = selectedNumbers.includes(drawResult.numbers[index] ?? -1) ? 1 : 0;
      break;
    }

    case '正码1-6': {
      const index = getPositionIndex(detail);
      const currentNumber = drawResult.numbers[index] ?? 0;
      const selectedOptions = splitSelectionValues(detail);
      matchedUnits = selectedOptions.filter((option) => matchesZhengmaOption(currentNumber, option)).length;
      break;
    }

    case '连码': {
      const prefix = detail.split(/[：:]/)[0] ?? '';
      const regularMatches = selectedNumbers.filter((number) => drawResult.numbers.includes(number)).length;

      if (prefix.includes('三全中')) {
        matchedUnits = regularMatches >= 3 ? combination(regularMatches, 3) : 0;
      } else if (prefix.includes('特串')) {
        const includesSpecial = selectedNumbers.includes(drawResult.specialNumber);
        matchedUnits = regularMatches >= 1 && includesSpecial ? regularMatches : 0;
      } else {
        matchedUnits = regularMatches >= 2 ? combination(regularMatches, 2) : 0;
      }
      break;
    }

    case '一肖': {
      const drawZodiacs = new Set(allDrawnNumbers.map((number) => getZodiacByNumber(number)));
      matchedUnits = selectedZodiacs.filter((zodiac) => drawZodiacs.has(zodiac)).length;
      break;
    }

    case '自选不中':
      matchedUnits = selectedNumbers.every((number) => !allDrawnNumbers.includes(number)) ? 1 : 0;
      break;

    default:
      matchedUnits = 0;
      break;
  }

  if (matchedUnits <= 0 || stake <= 0) {
    return { result: 'lose', payout: 0 };
  }

  return {
    result: 'win',
    payout: roundMoney(matchedUnits * stake * odds),
  };
}

async function loadProfile(userClient: SupabaseClient, user: User) {
  const { data, error } = await userClient
    .from('profiles')
    .select('id, balance')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data as ProfileRow;
  }

  const username =
    (user.user_metadata?.username as string | undefined) ?? user.email?.split('@')[0] ?? `user_${user.id.slice(0, 6)}`;
  const nickname = (user.user_metadata?.nickname as string | undefined) ?? '新玩家';

  const { data: created, error: createError } = await userClient
    .from('profiles')
    .upsert(
      {
        id: user.id,
        username,
        nickname,
      },
      {
        onConflict: 'id',
        ignoreDuplicates: false,
      }
    )
    .select('id, balance')
    .single();

  if (createError || !created) {
    throw new Error(createError?.message ?? '无法初始化用户资料');
  }

  return created as ProfileRow;
}

async function loadExistingProfile(userClient: SupabaseClient, userId: string) {
  const { data, error } = await userClient
    .from('profiles')
    .select('id, balance')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '读取账户余额失败');
  }

  return data as ProfileRow;
}

async function getLotteryUserContext(requestedClientId?: string): Promise<LotteryUserContext> {
  const userClient = createServerClient();
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    throw new LotteryAuthError('请先登录后再使用购彩功能');
  }

  const profile = await loadProfile(userClient, user);

  return {
    userId: user.id,
    clientId: requestedClientId?.trim() || user.id,
    userClient,
    profile,
  };
}

async function queryActiveDraw(client: SupabaseClient) {
  const { data, error } = await client
    .from('lottery_draws')
    .select('id, period, draw_time, numbers, special, status')
    .in('status', ['betting', 'closed', 'drawing'])
    .order('draw_time', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as LotteryDrawRow | null) ?? null;
}

async function queryFinishedDraws(client: SupabaseClient) {
  const { data, error } = await client
    .from('lottery_draws')
    .select('id, period, draw_time, numbers, special, status')
    .eq('status', 'finished')
    .order('draw_time', { ascending: false })
    .limit(10)
    .returns<LotteryDrawRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function queryLatestDraws(client: SupabaseClient, limit = 2) {
  const { data, error } = await client
    .from('lottery_draws')
    .select('id, period, draw_time, numbers, special, status')
    .order('draw_time', { ascending: false })
    .limit(limit)
    .returns<LotteryDrawRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function insertDraw(client: SupabaseClient, input: Omit<LotteryDrawRow, 'id'>) {
  const { data, error } = await client
    .from('lottery_draws')
    .insert({
      period: input.period,
      draw_time: input.draw_time,
      numbers: input.numbers ?? [],
      special: input.special,
      status: input.status,
    })
    .select('id, period, draw_time, numbers, special, status')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '写入 lottery_draws 失败');
  }

  return data as LotteryDrawRow;
}

async function seedBootstrapDraws(adminClient: SupabaseClient) {
  const now = Date.now();
  const previousIssueNoValue = buildDailyIssueNo(new Date(now), 1);
  const currentIssueNoValue = buildDailyIssueNo(new Date(now), 2);
  const previousResult = buildHardcodedDraw(previousIssueNoValue);

  await insertDraw(adminClient, {
    period: previousIssueNoValue,
    draw_time: new Date(now - DRAW_INTERVAL_SECONDS * 1000).toISOString(),
    numbers: previousResult.numbers,
    special: previousResult.specialNumber,
    status: 'finished',
  });

  return insertDraw(adminClient, {
    period: currentIssueNoValue,
    draw_time: new Date(now + DRAW_INTERVAL_SECONDS * 1000).toISOString(),
    numbers: [],
    special: null,
    status: 'betting',
  });
}

async function ensureActiveDraw(userClient: SupabaseClient, adminClient: SupabaseClient | null) {
  const existingActive = await queryActiveDraw(userClient);
  if (existingActive) {
    return existingActive;
  }

  const latestRows = await queryLatestDraws(userClient);

  if (latestRows.length === 0) {
    if (!adminClient) {
      throw new Error('lottery_draws 为空，且未配置 service_role key，无法自动初始化期号');
    }

    return seedBootstrapDraws(adminClient);
  }

  if (!adminClient) {
    throw new Error('当前没有可投注期号，请先配置 service_role key 或在后台创建 lottery_draws');
  }

  const nextPeriod = nextIssueNo(latestRows[0].period);
  return insertDraw(adminClient, {
    period: nextPeriod,
    draw_time: new Date(Date.now() + DRAW_INTERVAL_SECONDS * 1000).toISOString(),
    numbers: [],
    special: null,
    status: 'betting',
  });
}

async function ensureFinishedHistory(
  userClient: SupabaseClient,
  adminClient: SupabaseClient | null,
  activeDraw: LotteryDrawRow
) {
  const finished = await queryFinishedDraws(userClient);
  if (finished.length > 0) {
    return finished;
  }

  if (!adminClient) {
    throw new Error('lottery_draws 中暂无已开奖数据，请先初始化一期开奖结果');
  }

  const derivedPreviousIssueNo = previousIssueNo(activeDraw.period);
  const fallbackPreviousIssueNo = buildDailyIssueNo(
    new Date(new Date(activeDraw.draw_time).getTime() - DRAW_INTERVAL_SECONDS * 1000),
    1
  );
  const previousIssueNoValue =
    derivedPreviousIssueNo === activeDraw.period ? fallbackPreviousIssueNo : derivedPreviousIssueNo;
  const previousResult = buildHardcodedDraw(previousIssueNoValue);

  await insertDraw(adminClient, {
    period: previousIssueNoValue,
    draw_time: new Date(new Date(activeDraw.draw_time).getTime() - DRAW_INTERVAL_SECONDS * 1000).toISOString(),
    numbers: previousResult.numbers,
    special: previousResult.specialNumber,
    status: 'finished',
  });

  return queryFinishedDraws(adminClient);
}

async function queryUserBets(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('lottery_bets')
    .select('id, user_id, draw_id, bet_type, bet_content, amount, odds, result, payout, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40)
    .returns<LotteryBetRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function queryDrawPeriods(client: SupabaseClient, drawIds: string[]) {
  if (drawIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await client
    .from('lottery_draws')
    .select('id, period')
    .in('id', drawIds)
    .returns<Array<{ id: string; period: string }>>();

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((item) => [item.id, item.period]));
}

async function buildSnapshot(
  context: LotteryUserContext,
  adminClient: SupabaseClient | null,
  balanceOverride?: number
): Promise<LotterySnapshot> {
  const activeDraw = await ensureActiveDraw(context.userClient, adminClient);
  const finishedDraws = await ensureFinishedHistory(context.userClient, adminClient, activeDraw);
  const betRows = await queryUserBets(context.userClient, context.userId);
  const drawMap = await queryDrawPeriods(
    context.userClient,
    Array.from(new Set(betRows.map((row) => row.draw_id)))
  );

  const latestDraw = getLatestDrawFromRows(finishedDraws);
  const drawHistory = finishedDraws.map((row) => getCurrentLotteryResult(row));

  return {
    clientId: context.clientId,
    currentIssueNo: activeDraw.period,
    closesAt: new Date(activeDraw.draw_time).toISOString(),
    drawIntervalSeconds: DRAW_INTERVAL_SECONDS,
    balance: roundMoney(balanceOverride ?? toNumber(context.profile.balance, 0)),
    latestDraw,
    drawHistory,
    betHistory: mapBetHistory(betRows, drawMap),
  };
}

async function ensureBettingWindow(activeDraw: LotteryDrawRow) {
  const closesAtMs = new Date(activeDraw.draw_time).getTime();

  if (activeDraw.status !== 'betting' || !Number.isFinite(closesAtMs) || closesAtMs <= Date.now()) {
    throw new Error('当前期已封盘，请等待下一期');
  }
}

async function bestEffortDeleteBet(adminClient: SupabaseClient, betId: string) {
  await adminClient.from('lottery_bets').delete().eq('id', betId);
}

export async function getLotterySnapshot(requestedClientId?: string) {
  const context = await getLotteryUserContext(requestedClientId);
  return buildSnapshot(context, getOptionalAdminClient());
}

export async function placeLotteryBet(input: {
  requestedClientId?: string;
  payload: PlaceBetPayload;
}): Promise<{ result: PlaceBetResult; snapshot: LotterySnapshot }> {
  const context = await getLotteryUserContext(input.requestedClientId);
  const adminClient = createAdminClient();
  const activeDraw = await ensureActiveDraw(context.userClient, adminClient);

  if (input.payload.issueNo !== activeDraw.period) {
    throw new Error(`当前期号已切换到 ${activeDraw.period}，请重新选择后下注`);
  }

  await ensureBettingWindow(activeDraw);

  const units = Math.max(1, Math.floor(input.payload.units));
  const stake = roundMoney(input.payload.stake);
  const category = input.payload.category.trim();
  const detail = input.payload.detail.trim();

  if (!category || !detail || !Number.isFinite(stake) || stake <= 0) {
    throw new Error('投注参数不完整');
  }

  const totalAmount = roundMoney(units * stake);
  const currentBalance = roundMoney(toNumber(context.profile.balance, 0));

  if (currentBalance < totalAmount) {
    throw new Error('账号余额不足');
  }

  const odds = getOddsForCategory(category);

  const { data: insertBet, error: insertBetError } = await adminClient
    .from('lottery_bets')
    .insert({
      user_id: context.userId,
      draw_id: activeDraw.id,
      bet_type: category,
      bet_content: {
        issueNo: activeDraw.period,
        detail,
        units,
        stake,
      },
      amount: totalAmount,
      odds,
    })
    .select('id')
    .single();

  if (insertBetError) {
    throw new Error(insertBetError.message ?? '写入 lottery_bets 失败');
  }

  const nextBalance = roundMoney(currentBalance - totalAmount);

  const { error: updateBalanceError } = await adminClient
    .from('profiles')
    .update({
      balance: nextBalance,
      last_online: new Date().toISOString(),
    })
    .eq('id', context.userId);

  if (updateBalanceError) {
    await bestEffortDeleteBet(adminClient, (insertBet as { id: string }).id);
    throw new Error(updateBalanceError.message);
  }

  const { error: balanceLogError } = await adminClient.from('balance_logs').insert({
    user_id: context.userId,
    amount: -totalAmount,
    balance_after: nextBalance,
    type: 'lottery_bet',
    description: `六合彩 ${activeDraw.period} ${category} ${detail}`,
    reference_id: (insertBet as { id: string }).id,
  });

  if (balanceLogError) {
    throw new Error(balanceLogError.message);
  }

  context.profile.balance = nextBalance;

  return {
    result: {
      ok: true,
      message: `投注成功，扣款 ¥${totalAmount.toFixed(2)}。`,
      totalAmount,
    },
    snapshot: await buildSnapshot(context, adminClient, nextBalance),
  };
}

async function finalizeDraw(adminClient: SupabaseClient, activeDraw: LotteryDrawRow) {
  const existingNumbers = Array.isArray(activeDraw.numbers) ? activeDraw.numbers : [];
  const hasCompletedResult = existingNumbers.length >= 6 && activeDraw.special !== null;
  const generated = hasCompletedResult ? null : buildHardcodedDraw(activeDraw.period);

  const { data, error } = await adminClient
    .from('lottery_draws')
    .update({
      numbers: hasCompletedResult ? existingNumbers.slice(0, 6) : generated?.numbers ?? [],
      special: hasCompletedResult ? activeDraw.special : generated?.specialNumber ?? null,
      status: 'finished',
    })
    .eq('id', activeDraw.id)
    .select('id, period, draw_time, numbers, special, status')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '更新开奖结果失败');
  }

  return data as LotteryDrawRow;
}

async function settlePendingBetsForDraw(adminClient: SupabaseClient, draw: LotteryDrawRow) {
  const drawResult = getCurrentLotteryResult(draw);

  const { data: pendingBets, error: pendingBetsError } = await adminClient
    .from('lottery_bets')
    .select('id, user_id, draw_id, bet_type, bet_content, amount, odds, result, payout, created_at')
    .eq('draw_id', draw.id)
    .eq('result', 'pending')
    .returns<LotteryBetRow[]>();

  if (pendingBetsError) {
    throw new Error(pendingBetsError.message);
  }

  if (!pendingBets || pendingBets.length === 0) {
    return;
  }

  const payoutMap = new Map<string, number>();

  for (const bet of pendingBets) {
    const content = getSafeBetContent(bet.bet_content);
    const outcome = evaluateBet(bet.bet_type, content, drawResult, toNumber(bet.odds, getOddsForCategory(bet.bet_type)));

    const { error: updateBetError } = await adminClient
      .from('lottery_bets')
      .update({
        result: outcome.result,
        payout: outcome.payout,
      })
      .eq('id', bet.id);

    if (updateBetError) {
      throw new Error(updateBetError.message);
    }

    if (outcome.payout > 0) {
      payoutMap.set(bet.user_id, roundMoney((payoutMap.get(bet.user_id) ?? 0) + outcome.payout));
    }
  }

  const winnerIds = [...payoutMap.keys()];

  if (winnerIds.length === 0) {
    return;
  }

  const { data: profiles, error: profileError } = await adminClient
    .from('profiles')
    .select('id, balance')
    .in('id', winnerIds)
    .returns<ProfileRow[]>();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, roundMoney(toNumber(profile.balance, 0))]));

  for (const userId of winnerIds) {
    const payout = roundMoney(payoutMap.get(userId) ?? 0);
    const currentBalance = profileMap.get(userId) ?? 0;
    const nextBalance = roundMoney(currentBalance + payout);

    const { error: updateBalanceError } = await adminClient
      .from('profiles')
      .update({
        balance: nextBalance,
        last_online: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateBalanceError) {
      throw new Error(updateBalanceError.message);
    }

    const { error: winLogError } = await adminClient.from('balance_logs').insert({
      user_id: userId,
      amount: payout,
      balance_after: nextBalance,
      type: 'lottery_win',
      description: `六合彩 ${draw.period} 开奖派彩`,
      reference_id: draw.id,
    });

    if (winLogError) {
      throw new Error(winLogError.message);
    }
  }
}

async function ensureNextDraw(adminClient: SupabaseClient, settledDraw: LotteryDrawRow) {
  const activeDraw = await queryActiveDraw(adminClient);
  if (activeDraw) {
    return activeDraw;
  }

  return insertDraw(adminClient, {
    period: nextIssueNo(settledDraw.period),
    draw_time: new Date(Date.now() + DRAW_INTERVAL_SECONDS * 1000).toISOString(),
    numbers: [],
    special: null,
    status: 'betting',
  });
}

export async function settleLotteryForCurrentUser(requestedClientId?: string) {
  const context = await getLotteryUserContext(requestedClientId);
  const adminClient = createAdminClient();
  const activeDraw = await ensureActiveDraw(context.userClient, adminClient);
  const closesAtMs = new Date(activeDraw.draw_time).getTime();
  const hasCompletedResult =
    Array.isArray(activeDraw.numbers) && activeDraw.numbers.length >= 6 && activeDraw.special !== null;

  if (Number.isFinite(closesAtMs) && closesAtMs > Date.now() && !hasCompletedResult) {
    return buildSnapshot(context, adminClient);
  }

  const settledDraw = await finalizeDraw(adminClient, activeDraw);
  await settlePendingBetsForDraw(adminClient, settledDraw);
  await ensureNextDraw(adminClient, settledDraw);

  const refreshedProfile = await loadExistingProfile(context.userClient, context.userId);
  context.profile = refreshedProfile;

  return buildSnapshot(context, adminClient, toNumber(refreshedProfile.balance, 0));
}
