/** Delivery charge rule: Rs 100 on a delivery order of Rs 1000 or more (before discounts). The cashier / admin can change it for any order. */
export const DELIVERY_FEE = 10_000; // paisa
export const DELIVERY_MIN_ORDER = 100_000; // paisa
export const DELIVERY_MAX = 50_000; // the most that can be typed: Rs 500

/** The charge that applies by itself. `override` (paisa) is what the cashier typed, null/undefined means "use the rule". */
export function deliveryChargeFor(orderType: string, subtotal: number, override?: number | null): number {
  if (orderType !== "delivery") return 0;
  if (override != null) return Math.min(Math.max(0, Math.round(override)), DELIVERY_MAX);
  return subtotal >= DELIVERY_MIN_ORDER ? DELIVERY_FEE : 0;
}
