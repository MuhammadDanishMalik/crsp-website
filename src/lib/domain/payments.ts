export const QUICK_CASH = [50_000, 100_000, 500_000]; // Rs 500, 1000, 5000 in paisa

export function cashChange(total: number, tendered: number) {
  return Math.max(0, tendered - total);
}

/** Round up to common note denominations for quick-cash suggestions. */
export function quickCashOptions(total: number): number[] {
  const set = new Set<number>([total]);
  for (const step of [10_000, 50_000, 100_000, 500_000]) {
    const v = Math.ceil(total / step) * step;
    if (v >= total) set.add(v);
  }
  return [...set].sort((a, b) => a - b).slice(0, 4);
}

export function splitEqually(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}
