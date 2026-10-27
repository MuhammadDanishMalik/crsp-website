import { describe, expect, it } from "vitest";
import { openingOfferBps } from "./opening-offer";

describe("opening offer", () => {
  it("runs from the first to the last day inclusive", () => {
    expect(openingOfferBps("2026-10-25")).toBe(0);
    expect(openingOfferBps("2026-10-26")).toBe(1000);
    expect(openingOfferBps("2026-11-01")).toBe(1000);
    expect(openingOfferBps("2026-11-02")).toBe(0);
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
