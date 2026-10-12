import { describe, expect, it } from "vitest";
import { computeTotals, type CartLine } from "./pricing";
import { cashChange, splitEqually } from "./payments";

const line = (over: Partial<CartLine> = {}): CartLine => ({
  key: "a", itemId: "i", name: "Broast", basePrice: 100_000, quantity: 2, modifiers: [{ id: "m", name: "Spicy", priceDelta: 5_000 }], ...over,
});
const gst = { id: "t", name: "GST", rateBps: 1600, appliesToOrderTypes: [], appliesToPaymentMethods: [], appliesToServiceCharge: false, isInclusive: false, priority: 0 };

describe("computeTotals", () => {
  it("sums modifiers and applies exclusive tax", () => {
    const t = computeTotals({ lines: [line()], orderType: "takeaway", taxRules: [gst] });
    expect(t.subtotal).toBe(210_000);
    expect(t.taxTotal).toBe(33_600);
    expect(t.total).toBe(243_600);
  });
  it("percent discount applies before tax", () => {
    const t = computeTotals({ lines: [line()], orderType: "takeaway", taxRules: [gst], discount: { kind: "percent", value: 1000 } });
    expect(t.discountTotal).toBe(21_000);
    expect(t.total).toBe(189_000 + 30_240);
  });
  it("tax rule filtered by payment method", () => {
    const rule = { ...gst, rateBps: 500, appliesToPaymentMethods: ["card"] };
    expect(computeTotals({ lines: [line()], orderType: "takeaway", taxRules: [rule], paymentMethod: "cash" }).taxTotal).toBe(0);
    expect(computeTotals({ lines: [line()], orderType: "takeaway", taxRules: [rule], paymentMethod: "card" }).taxTotal).toBe(10_500);
  });
  it("service charge only on dine-in", () => {
    expect(computeTotals({ lines: [line()], orderType: "dine_in", taxRules: [], serviceChargeBps: 500 }).serviceCharge).toBe(10_500);
    expect(computeTotals({ lines: [line()], orderType: "takeaway", taxRules: [], serviceChargeBps: 500 }).serviceCharge).toBe(0);
  });
});
describe("payments", () => {
  it("change", () => expect(cashChange(243_600, 500_000)).toBe(256_400));
  it("splits equally without losing paisa", () => expect(splitEqually(100, 3).reduce((a, b) => a + b)).toBe(100));
});

import { maxRedeemablePoints, pointsEarned, redeemValue } from "./loyalty";
describe("loyalty", () => {
  const rules = { earnPerRupee: 0.01, pointValuePaisa: 100, minRedeemPoints: 100 };
  it("earns on net paid", () => expect(pointsEarned(603_20, rules)).toBe(6));
  it("redemption capped by the bill", () => expect(redeemValue(500, 20_000, rules)).toBe(20_000));
  it("needs the minimum balance", () => { expect(maxRedeemablePoints(50, 100_000, rules)).toBe(0); expect(maxRedeemablePoints(300, 100_000, rules)).toBe(300); });
  it("loyalty discount stacks after promo and reduces tax base", () => {
    const l = { key: "a", itemId: "i", name: "x", basePrice: 100_000, quantity: 1, modifiers: [] };
    const t = computeTotals({ lines: [l], orderType: "takeaway", taxRules: [], discount: { kind: "percent", value: 1000 }, loyaltyDiscount: 20_000 });
    expect(t.discountTotal).toBe(30_000);
    expect(t.total).toBe(70_000);
  });
});
