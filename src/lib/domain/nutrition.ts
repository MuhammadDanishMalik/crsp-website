import { convertQty, type Conversion } from "./inventory";

export type Nutrition = { kcal: number; protein: number; carbs: number; fat: number };
export const ZERO_N: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** Ingredient nutrition is stored per 100 g / 100 ml, or per piece when the base unit is a piece. */
export const nutritionBasis = (unitCode: string) => (unitCode === "pc" ? 1 : 100);

export const addN = (a: Nutrition, b: Nutrition): Nutrition => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat });
export const roundN = (n: Nutrition): Nutrition => ({ kcal: Math.round(n.kcal), protein: Math.round(n.protein * 10) / 10, carbs: Math.round(n.carbs * 10) / 10, fat: Math.round(n.fat * 10) / 10 });
export const isEmptyN = (n: Nutrition) => !n.kcal && !n.protein && !n.carbs && !n.fat;

export type IngNutrition = { baseUnitId: string; unitCode: string; per: Nutrition };

/** Nutrition of one portion: sum over recipe lines of (quantity in base unit ÷ basis) × per-basis values. */
export function recipeNutrition(lines: { ingredientId: string; qty: number; unitId: string }[], ings: Map<string, IngNutrition>, conv: Conversion[]): Nutrition {
  let total = ZERO_N;
  for (const l of lines) {
    const i = ings.get(l.ingredientId);
    if (!i) continue;
    const f = convertQty(l.qty, l.unitId, i.baseUnitId, conv) / nutritionBasis(i.unitCode);
    total = addN(total, { kcal: i.per.kcal * f, protein: i.per.protein * f, carbs: i.per.carbs * f, fat: i.per.fat * f });
  }
  return total;
}
