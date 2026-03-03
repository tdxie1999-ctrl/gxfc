import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticatedRequest, unauthorizedResponse } from '@/lib/admin-auth';
import { listEconomyLogs, updateUserEconomy } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS = ['recharge', 'debit', 'gift_diamond'] as const;
type ValidAction = (typeof VALID_ACTIONS)[number];

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: number;
    action?: ValidAction;
    amount?: number;
    note?: string;
  } | null;

  if (!body || !body.userId || !body.action || !body.amount) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  if (!VALID_ACTIONS.includes(body.action)) {
    return NextResponse.json({ error: '非法操作类型' }, { status: 400 });
  }

  try {
    const user = updateUserEconomy({
      userId: Number(body.userId),
      action: body.action,
      amount: Number(body.amount),
      note: body.note,
      operator: 'admin',
    });

    return NextResponse.json({ user, logs: listEconomyLogs(120) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '经济操作失败' },
      { status: 400 }
    );
  }
}
