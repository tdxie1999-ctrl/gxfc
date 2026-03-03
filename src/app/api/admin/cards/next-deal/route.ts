import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticatedRequest, unauthorizedResponse } from '@/lib/admin-auth';
import {
  createRiggingPlan,
  listRiggingHands,
  listRiggingPlans,
  type AiStrategyMode,
  type GameType,
} from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

const VALID_GAME_TYPES: GameType[] = ['跑得快', '打筒子', '放炮罚'];
const VALID_AI_MODES: AiStrategyMode[] = ['balanced', 'favor_player', 'harvest'];

function parseCards(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\s,，]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as {
    issueNo?: string;
    gameType?: GameType;
    userId?: number;
    targetOutcome?: string;
    handCards?: unknown;
    aiMode?: AiStrategyMode;
    note?: string;
  } | null;

  if (!body || !body.gameType || !body.userId || !body.targetOutcome || !body.aiMode) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  if (!VALID_GAME_TYPES.includes(body.gameType)) {
    return NextResponse.json({ error: '游戏类型不合法' }, { status: 400 });
  }

  if (!VALID_AI_MODES.includes(body.aiMode)) {
    return NextResponse.json({ error: 'AI 模式不合法' }, { status: 400 });
  }

  try {
    const handCards = parseCards(body.handCards);
    const plan = createRiggingPlan({
      issueNo: body.issueNo,
      gameType: body.gameType,
      userId: Number(body.userId),
      targetOutcome: body.targetOutcome,
      handCards,
      aiMode: body.aiMode,
      note: body.note,
    });

    return NextResponse.json({
      plan,
      hands: listRiggingHands(body.gameType),
      plans: listRiggingPlans(50),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '设置控牌失败' },
      { status: 400 }
    );
  }
}
