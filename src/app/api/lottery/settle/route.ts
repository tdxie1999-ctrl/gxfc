import { NextRequest, NextResponse } from 'next/server';
import { LotteryAuthError, settleLotteryForCurrentUser } from '@/lib/lottery/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        clientId?: string;
      }
    | null;

  const clientId = body?.clientId?.trim() ?? '';

  try {
    return NextResponse.json({
      snapshot: await settleLotteryForCurrentUser(clientId),
    });
  } catch (error) {
    if (error instanceof LotteryAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '结算失败' },
      { status: 400 }
    );
  }
}
