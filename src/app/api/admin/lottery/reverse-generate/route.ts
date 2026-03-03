import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticatedRequest, unauthorizedResponse } from '@/lib/admin-auth';
import { reverseGenerateLotteryNumbers, setLotteryIssueResult } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as {
    issueNo?: string;
    apply?: boolean;
  } | null;

  try {
    const suggestion = reverseGenerateLotteryNumbers(body?.issueNo);

    if (body?.apply) {
      const issue = setLotteryIssueResult({
        issueNo: suggestion.issueNo,
        numbers: suggestion.numbers,
        specialNumber: suggestion.specialNumber,
        operator: 'admin(reverse)',
      });

      return NextResponse.json({ suggestion, appliedIssue: issue });
    }

    return NextResponse.json({ suggestion });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '反向生成失败' },
      { status: 400 }
    );
  }
}
