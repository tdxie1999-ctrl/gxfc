import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticatedRequest, unauthorizedResponse } from '@/lib/admin-auth';
import {
  getAiStrategyConfig,
  listRiggingHands,
  listRiggingPlans,
  type GameType,
} from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

const VALID_GAME_TYPES: GameType[] = ['跑得快', '打筒子', '放炮罚'];

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const gameTypeParam = request.nextUrl.searchParams.get('gameType') as GameType | null;
  const gameType =
    gameTypeParam && VALID_GAME_TYPES.includes(gameTypeParam) ? gameTypeParam : '跑得快';

  return NextResponse.json({
    gameType,
    hands: listRiggingHands(gameType),
    plans: listRiggingPlans(50),
    aiStrategy: getAiStrategyConfig(),
  });
}
