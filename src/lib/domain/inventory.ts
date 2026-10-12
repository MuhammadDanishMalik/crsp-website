/** Pure inventory maths. Quantities are plain numbers in an ingredient's base unit; money is integer paisa. */
export type Conversion = { from: string; to: string; factor: number };

export function convertQty(qty: number, fromUnit: string, toUnit: string, conversions: Conversion[]): number {
  if (fromUnit === toUnit) return qty;
  const direct = conversions.find((c) => c.from === fromUnit && c.to === toUnit);
  if (direct) return qty * direct.factor;
  const inverse = conversions.find((c) => c.from === toUnit && c.to === fromUnit);
  if (inverse) return qty / inverse.factor;
  throw new Error("No unit conversion defined");
}

/** Landed cost per base unit = (goods + freight + duty + other) / quantity, rounded to paisa. */
export function landedUnitCost(qty: number, unitCost: number, extras: { freight?: number; duty?: number; other?: number } = {}): number {
  if (qty <= 0) return 0;
  const total = unitCost * qty + (extras.freight ?? 0) + (extras.duty ?? 0) + (extras.other ?? 0);
  return Math.round(total / qty);
}

/** Moving weighted-average cost after receiving `inQty` at `inCost`. */
export function weightedAvgCost(onHand: number, avgCost: number, inQty: number, inCost: number): number {
  const base = Math.max(onHand, 0);
  const total = base + inQty;
  return total <= 0 ? inCost : Math.round((base * avgCost + inQty * inCost) / total);
}

export type RecipeLine = { ingredientId: string; qty: number; unitId: string };

/** Cost of one portion = sum(qty in base unit × avg cost). */
export function recipeCost(lines: RecipeLine[], ing: Map<string, { baseUnitId: string; avgCost: number }>, conversions: Conversion[]): number {
  return Math.round(lines.reduce((sum, l) => {
    const i = ing.get(l.ingredientId);
    return i ? sum + convertQty(l.qty, l.unitId, i.baseUnitId, conversions) * i.avgCost : sum;
  }, 0));
}

export const foodCostPct = (cost: number, price: number) => (price > 0 ? Math.round((cost / price) * 1000) / 10 : 0);

/** FIFO allocation across batches (oldest expiry first). Returns what to take from each and any shortfall. */
export function allocateFifo(batches: { id: string; remaining: number }[], need: number) {
  const takes: { id: string; qty: number }[] = [];
  let left = need;
  for (const b of batches) {
    if (left <= 0) break;
    const q = Math.min(b.remaining, left);
    if (q > 0) { takes.push({ id: b.id, qty: q }); left -= q; }
  }
  return { takes, shortfall: Math.max(0, left) };
}
