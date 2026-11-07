import { describe, expect, it } from "vitest";
import { openingOfferBps, receiptNotice } from "./opening-offer";

describe("Iqbal Day offer", () => {
  it("is 9% on 9 Nov only", () => {
    expect(openingOfferBps("2026-11-08")).toBe(0);
    expect(openingOfferBps("2026-11-09")).toBe(900);
    expect(openingOfferBps("2026-11-10")).toBe(0);
  });
  it("announces in advance, on the day, and stops after", () => {
    expect(receiptNotice("2026-11-07")).toContain("9 Nov");
    expect(receiptNotice("2026-11-09")).toContain("applied");
    expect(receiptNotice("2026-11-10")).toBeNull();
  });
});

import { computeTotals } from "./pricing";
import { markNoDiscount } from "./discount-scope";

describe("no discount on cold drinks", () => {
  it("discounts only CRSP lines", () => {
    const lines = [
      { key: "a", itemId: "burger", name: "Burger", basePrice: 100_000, quantity: 1, modifiers: [] },
      { key: "b", itemId: "cola", name: "Cola", basePrice: 12_000, quantity: 1, modifiers: [] },
    ];
    const cat = (id: string) => (id === "cola" ? "Beverages" : "Burgers");
    const t = computeTotals({ lines: markNoDiscount(lines, cat), discount: { kind: "percent", value: 1000 }, orderType: "takeaway", taxRules: [] });
    expect(t.discountTotal).toBe(10_000);
    expect(t.total).toBe(102_000);
  });
});
