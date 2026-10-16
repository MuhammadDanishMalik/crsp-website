import "server-only";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { isEmptyN, recipeNutrition, roundN, type IngNutrition, type Nutrition } from "@/lib/domain/nutrition";
import { loadConversions } from "@/lib/inventory/stock";

const num = (v: string | number | null | undefined) => Number(v ?? 0);

/** Nutrition per menu item (hand-typed value wins, else calculated from the recipe) and per modifier (extra sauce etc.). null = unknown. */
export async function loadNutritionMaps() {
  const db = await getDb();
  const [ings, units, recipes, items, conv] = await Promise.all([db.select().from(s.ingredients), db.select().from(s.units), db.select().from(s.recipes), db.select({ id: s.menuItems.id, o: s.menuItems.nutritionOverride }).from(s.menuItems), loadConversions(db)]);
  const map = new Map<string, IngNutrition>(ings.map((i) => [i.id, { baseUnitId: i.baseUnitId, unitCode: units.find((u) => u.id === i.baseUnitId)?.code ?? "g", per: { kcal: num(i.kcal), protein: num(i.proteinG), carbs: num(i.carbsG), fat: num(i.fatG) } }]));
  const line = (r: (typeof recipes)[number]) => ({ ingredientId: r.ingredientId, qty: num(r.quantity), unitId: r.unitId });
  const itemMap = new Map<string, { value: Nutrition | null; manual: boolean; calculated: Nutrition | null }>();
  for (const it of items) {
    const lines = recipes.filter((r) => r.itemId === it.id && !r.modifierId).map(line);
    const calc = lines.length ? roundN(recipeNutrition(lines, map, conv)) : null;
    const calcKnown = calc && !isEmptyN(calc) ? calc : null; // a recipe whose ingredients have no nutrition filled in says nothing
    const o = it.o as Nutrition | null;
    itemMap.set(it.id, { value: o ?? calcKnown, manual: !!o, calculated: calcKnown });
  }
  const modMap = new Map<string, Nutrition>();
  for (const id of new Set(recipes.filter((r) => r.modifierId).map((r) => r.modifierId!))) {
    const n = roundN(recipeNutrition(recipes.filter((r) => r.modifierId === id).map(line), map, conv));
    if (!isEmptyN(n)) modMap.set(id, n);
  }
  return { items: itemMap, modifiers: modMap };
}
