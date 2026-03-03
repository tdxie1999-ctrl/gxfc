// 抽水计算占位
export function calculateRake(winAmount: number, rakePercent = 5) {
  return (winAmount * rakePercent) / 100;
}
