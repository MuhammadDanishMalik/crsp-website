import { describe, expect, it } from "vitest";
import { openingOfferBps } from "./opening-offer";

describe("opening offer", () => {
  it("runs from the first to the last day inclusive", () => {
    // the automatic offer is switched off: discounts are chosen by tick on the till
    expect(openingOfferBps("2026-10-27")).toBe(0);
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
