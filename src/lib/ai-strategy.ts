import type { AiStrategyConfig } from '@/lib/admin-db';

export interface AiRoundContext {
  userWinRate: number;
  userProfit: number;
  recentBetAmount: number;
}

export interface AiDecisionSummary {
  targetWinProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateAiDecisionSummary(
  strategy: AiStrategyConfig,
  context: AiRoundContext
): AiDecisionSummary {
  let targetWinProbability = 0.5;
  const ratio = strategy.waterRatio / 100;

  if (strategy.mode === 'favor_player') targetWinProbability += 0.16 * ratio;
  if (strategy.mode === 'harvest') targetWinProbability -= 0.18 * ratio;
  if (strategy.mode === 'balanced') {
    targetWinProbability += (context.userProfit < 0 ? 0.04 : -0.03) * ratio;
  }

  if (context.userWinRate < 0.35) targetWinProbability += 0.06;
  if (context.userWinRate > 0.65) targetWinProbability -= 0.06;
  if (context.recentBetAmount > 10000) targetWinProbability -= 0.04;

  targetWinProbability = clamp(targetWinProbability, 0.08, 0.92);

  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  if (targetWinProbability <= 0.35 || targetWinProbability >= 0.7) {
    riskLevel = 'high';
  } else if (targetWinProbability > 0.42 && targetWinProbability < 0.6) {
    riskLevel = 'low';
  }

  const recommendation =
    strategy.mode === 'favor_player'
      ? '当前策略偏放水，建议只对特定层级用户启用，避免短期套利。'
      : strategy.mode === 'harvest'
        ? '当前策略偏收割，建议控制连续输局，降低投诉风险。'
        : '当前策略平衡，建议结合用户输赢分层执行差异化发牌。';

  return {
    targetWinProbability: Number(targetWinProbability.toFixed(3)),
    riskLevel,
    recommendation,
  };
}
