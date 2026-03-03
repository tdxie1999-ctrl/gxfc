export function formatBalance(value: number) {
  return value.toFixed(2);
}

export function applyBalanceDelta(currentBalance: number, delta: number) {
  return Math.round((currentBalance + delta) * 100) / 100;
}
