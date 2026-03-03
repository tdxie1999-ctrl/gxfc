import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticatedRequest, unauthorizedResponse } from '@/lib/admin-auth';
import {
  getLatestLotteryIssue,
  listLotteryBets,
  listLotteryIssues,
  setLotteryIssueResult,
} from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

function parseNumbers(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isInteger(item));
  }
  if (typeof value === 'string') {
    return value
      .split(/[\s,，]+/)
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item));
  }
  return [];
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const latestIssue = getLatestLotteryIssue();
  const issueNo = request.nextUrl.searchParams.get('issueNo') ?? latestIssue.issueNo;

  return NextResponse.json({
    latestIssue,
    issues: listLotteryIssues(20),
    bets: listLotteryBets(issueNo),
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as {
    issueNo?: string;
    numbers?: unknown;
    specialNumber?: number;
  } | null;

  if (!body?.issueNo) {
    return NextResponse.json({ error: '期号必填' }, { status: 400 });
  }

  try {
    const issue = setLotteryIssueResult({
      issueNo: body.issueNo,
      numbers: parseNumbers(body.numbers),
      specialNumber: Number(body.specialNumber),
      operator: 'admin',
    });

    return NextResponse.json({
      issue,
      issues: listLotteryIssues(20),
      bets: listLotteryBets(issue.issueNo),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存开奖号码失败' },
      { status: 400 }
    );
  }
}
