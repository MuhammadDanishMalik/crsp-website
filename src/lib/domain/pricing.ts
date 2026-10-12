import { bps } from "./money";

export type CartModifier = { id: string; name: string; priceDelta: number; isRemoval?: boolean };
export type CartLine = {
  key: string;
  itemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  modifiers: CartModifier[];
  note?: string;
};
export type DiscountInput = { kind: "percent" | "fixed"; value: number }; // percent in bps, fixed in paisa
export type TaxRuleInput = {
  id: string;
  name: string;
  rateBps: number;
  appliesToOrderTypes: string[]; // empty = all
  appliesToPaymentMethods: string[]; // empty = all
  appliesToServiceCharge: boolean;
  isInclusive: boolean;
  priority: number;
};

export const unitPrice = (l: CartLine) => l.basePrice + l.modifiers.reduce((s, m) => s + m.priceDelta, 0);
export const lineTotal = (l: CartLine) => unitPrice(l) * l.quantity;

export type Totals = {
  subtotal: number;
  discountTotal: number; // promo/manual discount + loyalty redemption
  loyaltyDiscount: number;
  serviceCharge: number;
  deliveryCharge: number;
  taxLines: { ruleId: string; name: string; rateBps: number; amount: number }[];
  taxTotal: number;
  total: number;
};

export function computeTotals(input: {
  lines: CartLine[];
  discount?: DiscountInput | null;
  orderType: string;
  paymentMethod?: string | null;
  taxRules: TaxRuleInput[];
  serviceChargeBps?: number;
  deliveryCharge?: number;
  loyaltyDiscount?: number; // paisa from redeemed points, applied after the main discount
}): Totals {
  const subtotal = input.lines.reduce((s, l) => s + lineTotal(l), 0);
  let discountTotal = 0;
  if (input.discount) {
    discountTotal =
      input.discount.kind === "percent" ? bps(subtotal, input.discount.value) : Math.min(input.discount.value, subtotal);
  }
  const loyaltyDiscount = Math.min(Math.max(0, input.loyaltyDiscount ?? 0), subtotal - discountTotal);
  discountTotal += loyaltyDiscount;
  const afterDiscount = subtotal - discountTotal;
  const serviceCharge = input.orderType === "dine_in" && input.serviceChargeBps ? bps(afterDiscount, input.serviceChargeBps) : 0;
  const deliveryCharge = input.orderType === "delivery" ? (input.deliveryCharge ?? 0) : 0;

  const rules = input.taxRules
    .filter((r) => !r.appliesToOrderTypes.length || r.appliesToOrderTypes.includes(input.orderType))
    .filter((r) => !r.appliesToPaymentMethods.length || (input.paymentMethod && r.appliesToPaymentMethods.includes(input.paymentMethod)))
    .sort((a, b) => a.priority - b.priority);

  let exclusiveTax = 0;
  const taxLines = rules.map((r) => {
    const base = afterDiscount + (r.appliesToServiceCharge ? serviceCharge : 0);
    // Inclusive: tax is already inside the price, extract it. Exclusive: added on top.
    const amount = r.isInclusive ? Math.round(base - base / (1 + r.rateBps / 10_000)) : bps(base, r.rateBps);
    if (!r.isInclusive) exclusiveTax += amount;
    return { ruleId: r.id, name: r.name, rateBps: r.rateBps, amount };
  });
  const taxTotal = taxLines.reduce((s, t) => s + t.amount, 0);
  const total = afterDiscount + serviceCharge + deliveryCharge + exclusiveTax;
  return { subtotal, discountTotal, loyaltyDiscount, serviceCharge, deliveryCharge, taxLines, taxTotal, total };
}

/** Selection validity for a modifier group (min/max). */
export function groupError(min: number, max: number, selected: number): string | null {
  if (selected < min) return `Choose at least ${min}`;
  if (selected > max) return `Choose at most ${max}`;
  return null;
}
