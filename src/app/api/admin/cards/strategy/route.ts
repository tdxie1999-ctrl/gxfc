import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticatedRequest, unauthorizedResponse } from '@/lib/admin-auth';
import { getAiStrategyConfig, updateAiStrategyConfig, type AiStrategyMode } from '@/lib/admin-db';
import { calculateAiDecisionSummary } from '@/lib/ai-strategy';

export const dynamic = 'force-dynamic';

const VALID_MODES: AiStrategyMode[] = ['balanced', 'favor_player', 'harvest'];

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const strategy = getAiStrategyConfig();
  const preview = calculateAiDecisionSummary(strategy, {
    userWinRate: 0.48,
    userProfit: -900,
    recentBetAmount: 5000,
  });
  return NextResponse.json({ strategy, preview });
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as {
    mode?: AiStrategyMode;
    waterRatio?: number;
    description?: string;
  } | null;

  if (!body || !body.mode || body.waterRatio === undefined) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  if (!VALID_MODES.includes(body.mode)) {
    return NextResponse.json({ error: 'AI 模式不合法' }, { status: 400 });
  }

  try {
    const strategy = updateAiStrategyConfig({
      mode: body.mode,
      waterRatio: Number(body.waterRatio),
      description: body.description,
    });

    const preview = calculateAiDecisionSummary(strategy, {
      userWinRate: 0.48,
      userProfit: -900,
      recentBetAmount: 5000,
    });

    return NextResponse.json({ strategy, preview });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新 AI 策略失败' },
      { status: 400 }
    );
  }
}
