import { describe, expect, it } from "vitest";
import { allocateFifo, convertQty, foodCostPct, landedUnitCost, recipeCost, weightedAvgCost } from "./inventory";
import { computePayroll, csvEscape, lateMinutes } from "./payroll";

const conv = [{ from: "kg", to: "g", factor: 1000 }, { from: "l", to: "ml", factor: 1000 }];

describe("inventory", () => {
  it("converts units both ways", () => {
    expect(convertQty(2, "kg", "g", conv)).toBe(2000);
    expect(convertQty(500, "g", "kg", conv)).toBe(0.5);
    expect(() => convertQty(1, "kg", "ml", conv)).toThrow();
  });
  it("landed cost spreads freight and duty over quantity", () => {
    expect(landedUnitCost(100, 500, { freight: 5000, duty: 5000 })).toBe(600);
  });
  it("weighted average", () => expect(weightedAvgCost(100, 10, 100, 20)).toBe(15));
  it("recipe cost and food cost %", () => {
    const ing = new Map([["chicken", { baseUnitId: "g", avgCost: 60 }]]);
    const cost = recipeCost([{ ingredientId: "chicken", qty: 0.25, unitId: "kg" }], ing, conv);
    expect(cost).toBe(15000);
    expect(foodCostPct(cost, 52000)).toBe(28.8);
  });
  it("fifo", () => {
    const r = allocateFifo([{ id: "a", remaining: 5 }, { id: "b", remaining: 10 }], 12);
    expect(r.takes).toEqual([{ id: "a", qty: 5 }, { id: "b", qty: 7 }]);
    expect(allocateFifo([{ id: "a", remaining: 1 }], 3).shortfall).toBe(2);
  });
});

describe("payroll", () => {
  it("monthly net", () => expect(computePayroll({ salaryType: "monthly", salaryAmount: 3_000_000, daysWorked: 26, minutesWorked: 0, lateCount: 1, absentCount: 0, advances: 500_000, deductions: 100_000 }).net).toBe(2_400_000));
  it("hourly gross", () => expect(computePayroll({ salaryType: "hourly", salaryAmount: 20_000, daysWorked: 5, minutesWorked: 600, lateCount: 0, absentCount: 0, advances: 0, deductions: 0 }).gross).toBe(200_000));
  it("lateness respects grace", () => { expect(lateMinutes("09:00", "09:08")).toBe(0); expect(lateMinutes("09:00", "09:25")).toBe(25); });
  it("csv escaping", () => expect(csvEscape('a,"b"')).toBe('"a,""b"""'));
});

import { recipeNutrition, roundN } from "./nutrition";
describe("nutrition calculator", () => {
  const ings = new Map([
    ["chicken", { baseUnitId: "g", unitCode: "g", per: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 } }],
    ["bun", { baseUnitId: "pc", unitCode: "pc", per: { kcal: 150, protein: 5, carbs: 28, fat: 2 } }],
  ]);
  it("scales per-100g values by the quantity used, converting units", () => {
    const n = roundN(recipeNutrition([{ ingredientId: "chicken", qty: 0.2, unitId: "kg" }, { ingredientId: "bun", qty: 1, unitId: "pc" }], ings, conv));
    expect(n).toEqual({ kcal: 480, protein: 67, carbs: 28, fat: 9.2 });
  });
});
