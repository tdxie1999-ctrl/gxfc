import { NextRequest, NextResponse } from 'next/server';
import { LotteryAuthError, getLotterySnapshot, placeLotteryBet, settleLotteryForCurrentUser } from '@/lib/lottery/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId')?.trim() ?? '';

  try {
    return NextResponse.json({
      snapshot: await getLotterySnapshot(clientId),
    });
  } catch (error) {
    if (error instanceof LotteryAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取六合彩数据失败' },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        action?: 'place_bet' | 'settle';
        clientId?: string;
        issueNo?: string;
        category?: string;
        detail?: string;
        units?: number;
        stake?: number;
      }
    | null;

  const action = body?.action;
  const clientId = body?.clientId?.trim() ?? '';

  if (!action) {
    return NextResponse.json({ error: 'action必填' }, { status: 400 });
  }

  try {
    if (action === 'place_bet') {
      return NextResponse.json(
        await placeLotteryBet({
          requestedClientId: clientId,
          payload: {
            issueNo: body?.issueNo ?? '',
            category: body?.category ?? '',
            detail: body?.detail ?? '',
            units: Number(body?.units),
            stake: Number(body?.stake),
          },
        })
      );
    }

    if (action === 'settle') {
      return NextResponse.json({
        snapshot: await settleLotteryForCurrentUser(clientId),
      });
    }

    return NextResponse.json({ error: '不支持的action' }, { status: 400 });
  } catch (error) {
    if (error instanceof LotteryAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '六合彩操作失败' },
      { status: 400 }
    );
  }
}
