import "server-only";
import { and, asc, desc, eq, gt, gte, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { foodCostPct, recipeCost } from "@/lib/domain/inventory";
import { loadConversions } from "@/lib/inventory/stock";
import { loadNutritionMaps } from "./nutrition";

export async function loadUnits() {
  const db = await getDb();
  const units = await db.select().from(s.units).orderBy(asc(s.units.code));
  const conv = await loadConversions(db);
  // For each unit, the units it can be entered in (same dimension)
  return { units: units.map((u) => ({ id: u.id, code: u.code })), conv };
}

/** Daily usage is the average over the last 14 days (or the days since the first sale if the shop is newer than that). */
const USAGE_DAYS = 14;

/** `asof` (YYYY-MM-DD, Karachi): show the stock as it stood at the end of that day, by undoing every movement recorded after it. */
export async function loadStock(branchId: string, asof?: string) {
  const db = await getDb();
  const since = new Date(Date.now() - USAGE_DAYS * 86_400_000);
  const afterAsof = asof ? new Date(`${asof}T23:59:59.999+05:00`) : null;
  const [salesMv, laterMv] = await Promise.all([
    db.select({ i: s.stockMovements.ingredientId, q: s.stockMovements.quantity, at: s.stockMovements.createdAt }).from(s.stockMovements).where(and(eq(s.stockMovements.branchId, branchId), eq(s.stockMovements.type, "sale"), gte(s.stockMovements.createdAt, since))),
    afterAsof ? db.select({ i: s.stockMovements.ingredientId, q: s.stockMovements.quantity }).from(s.stockMovements).where(and(eq(s.stockMovements.branchId, branchId), gt(s.stockMovements.createdAt, afterAsof))) : Promise.resolve([]),
  ]);
  const firstSale = salesMv.reduce((m, x) => Math.min(m, x.at.getTime()), Date.now());
  const windowDays = Math.min(USAGE_DAYS, Math.max(1, Math.ceil((Date.now() - firstSale) / 86_400_000)));
  const [ings, stock, units, batches] = await Promise.all([
    db.select().from(s.ingredients).where(eq(s.ingredients.isActive, true)).orderBy(asc(s.ingredients.name)),
    db.select().from(s.ingredientStock).where(eq(s.ingredientStock.branchId, branchId)),
    db.select().from(s.units),
    db.select().from(s.stockBatches).where(and(eq(s.stockBatches.branchId, branchId), gt(s.stockBatches.quantityRemaining, "0"))).orderBy(asc(s.stockBatches.expiryDate)),
  ]);
  const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  return ings.map((i) => {
    const st = stock.find((x) => x.ingredientId === i.id);
    const now = Number(st?.quantity ?? 0), reorder = Number(st?.reorderLevel ?? 0);
    const qty = afterAsof ? now - laterMv.filter((m) => m.i === i.id).reduce((a, m) => a + Number(m.q), 0) : now; // undo movements after the chosen day
    const used = -salesMv.filter((m) => m.i === i.id).reduce((a, m) => a + Number(m.q), 0);
    const perDay = used > 0 ? used / windowDays : 0;
    const daysLeft = perDay > 0 && qty > 0 ? qty / perDay : null;
    const runOut = daysLeft === null ? "" : new Date(Date.now() + daysLeft * 86_400_000).toISOString().slice(0, 10);
    const bs = batches.filter((b) => b.ingredientId === i.id);
    return {
      id: i.id, name: i.name, baseUnitId: i.baseUnitId, unit: units.find((u) => u.id === i.baseUnitId)?.code ?? "", qty, reorder, avgCost: i.avgCost, perDay, daysLeft, runOut,
      isImported: i.isImported, origin: i.originCountry ?? "", nutrition: { kcal: Number(i.kcal), protein: Number(i.proteinG), carbs: Number(i.carbsG), fat: Number(i.fatG) }, low: qty <= reorder, negative: qty < 0,
      batches: bs.map((b) => ({ id: b.id, no: b.batchNo ?? "", expiry: b.expiryDate ?? "", remaining: Number(b.quantityRemaining), landed: b.landedUnitCost, expiringSoon: !!b.expiryDate && b.expiryDate <= soon })),
    };
  });
}

export async function loadMovements(branchId: string, limit = 100) {
  const db = await getDb();
  const rows = await db.select().from(s.stockMovements).where(eq(s.stockMovements.branchId, branchId)).orderBy(desc(s.stockMovements.createdAt)).limit(limit);
  const ings = rows.length ? await db.select({ id: s.ingredients.id, n: s.ingredients.name }).from(s.ingredients).where(inArray(s.ingredients.id, [...new Set(rows.map((r) => r.ingredientId))])) : [];
  return rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), name: ings.find((i) => i.id === r.ingredientId)?.n ?? "", type: r.type, qty: Number(r.quantity), note: r.note ?? "" }));
}

/** Menu items with recipe lines, recipe cost and food-cost % (cost at current average cost). */
export async function loadRecipes(branchId: string) {
  const db = await getDb();
  const nut = await loadNutritionMaps();
  const [items, recipes, ings, branchRows, conv] = await Promise.all([
    db.select().from(s.menuItems).where(eq(s.menuItems.isActive, true)).orderBy(asc(s.menuItems.sortOrder)),
    db.select().from(s.recipes), db.select().from(s.ingredients),
    db.select().from(s.branchMenuItems).where(eq(s.branchMenuItems.branchId, branchId)), loadConversions(db),
  ]);
  const ingMap = new Map(ings.map((i) => [i.id, { baseUnitId: i.baseUnitId, avgCost: i.avgCost }]));
  return items.map((it) => {
    const lines = recipes.filter((r) => r.itemId === it.id && !r.modifierId).map((r) => ({ ingredientId: r.ingredientId, qty: Number(r.quantity), unitId: r.unitId }));
    const price = branchRows.find((b) => b.itemId === it.id)?.price ?? it.basePrice;
    const cost = recipeCost(lines, ingMap, conv);
    const nn = nut.items.get(it.id);
    return { nutrition: nn?.value ?? null, nutritionManual: !!nn?.manual, id: it.id, name: it.name, emoji: it.imageUrl?.startsWith("emoji:") ? it.imageUrl.slice(6) : "", price, lines, cost, pct: lines.length ? foodCostPct(cost, price) : null };
  });
}
