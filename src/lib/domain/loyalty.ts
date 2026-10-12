/** Loyalty maths. Points are whole numbers; money is integer paisa. */
export type LoyaltyRules = { earnPerRupee: number; pointValuePaisa: number; minRedeemPoints: number };

/** Points earned on what the customer actually pays (after discounts), rounded down. */
export function pointsEarned(netPaisa: number, rules: Pick<LoyaltyRules, "earnPerRupee">): number {
  return Math.max(0, Math.floor((netPaisa / 100) * rules.earnPerRupee));
}

/** Value of redeeming `points`, never more than the bill can absorb. */
export function redeemValue(points: number, payablePaisa: number, rules: Pick<LoyaltyRules, "pointValuePaisa">): number {
  return Math.min(points * rules.pointValuePaisa, Math.max(0, payablePaisa));
}

/** Largest redeemable point count for a balance and a bill (0 if under the minimum). */
export function maxRedeemablePoints(balance: number, payablePaisa: number, rules: LoyaltyRules): number {
  if (balance < rules.minRedeemPoints || rules.pointValuePaisa <= 0) return 0;
  return Math.min(balance, Math.floor(Math.max(0, payablePaisa) / rules.pointValuePaisa));
}
