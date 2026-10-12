import "server-only";
import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { allocateFifo, convertQty, type Conversion } from "@/lib/domain/inventory";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function loadConversions(tx: Tx | Db): Promise<Conversion[]> {
  const rows = await tx.select().from(s.unitConversions);
  return rows.map((r) => ({ from: r.fromUnitId, to: r.toUnitId, factor: Number(r.factor) }));
}

/** Add (positive) or remove (negative) stock and record the movement. Stock may go negative; reports flag it. */
export async function applyMovement(tx: Tx, m: {
  branchId: string; ingredientId: string; qty: number; type: (typeof s.stockMovements.$inferInsert)["type"];
  unitCost?: number; orderId?: string; batchId?: string; transferBranchId?: string; reasonCodeId?: string; note?: string; staffId?: string;
}) {
  await tx.insert(s.ingredientStock).values({ branchId: m.branchId, ingredientId: m.ingredientId, quantity: String(m.qty) })
    .onConflictDoUpdate({ target: [s.ingredientStock.branchId, s.ingredientStock.ingredientId], set: { quantity: sql`${s.ingredientStock.quantity} + ${m.qty}` } });
  await tx.insert(s.stockMovements).values({
    branchId: m.branchId, ingredientId: m.ingredientId, type: m.type, quantity: String(m.qty), unitCost: m.unitCost ?? 0, orderId: m.orderId, batchId: m.batchId,
    transferBranchId: m.transferBranchId, reasonCodeId: m.reasonCodeId, note: m.note, createdBy: m.staffId,
  });
}

/** Consume from batches oldest-expiry-first (only ingredients that are batch-tracked have batches). */
async function consumeBatches(tx: Tx, branchId: string, ingredientId: string, need: number) {
  const batches = await tx.select().from(s.stockBatches)
    .where(and(eq(s.stockBatches.branchId, branchId), eq(s.stockBatches.ingredientId, ingredientId), gt(s.stockBatches.quantityRemaining, "0")))
    .orderBy(asc(s.stockBatches.expiryDate), asc(s.stockBatches.receivedAt));
  const { takes } = allocateFifo(batches.map((b) => ({ id: b.id, remaining: Number(b.quantityRemaining) })), need);
  for (const t of takes) await tx.update(s.stockBatches).set({ quantityRemaining: sql`${s.stockBatches.quantityRemaining} - ${t.qty}` }).where(eq(s.stockBatches.id, t.id));
}

/** Deduct recipe ingredients for a sale. Returns the recipe cost (paisa) of ONE unit for each order line. */
export async function deductForOrder(tx: Tx, o: {
  branchId: string; orderId: string; staffId: string;
  lines: { orderItemId: string; itemId: string; quantity: number; modifierIds: string[] }[];
}): Promise<Map<string, number>> {
  const itemIds = [...new Set(o.lines.map((l) => l.itemId))];
  const modIds = [...new Set(o.lines.flatMap((l) => l.modifierIds))];
  const recipes = await tx.select().from(s.recipes).where(or(inArray(s.recipes.itemId, itemIds), modIds.length ? inArray(s.recipes.modifierId, modIds) : undefined)!);
  const costs = new Map<string, number>();
  if (!recipes.length) return costs;
  const ings = await tx.select().from(s.ingredients).where(inArray(s.ingredients.id, [...new Set(recipes.map((r) => r.ingredientId))]));
  const conv = await loadConversions(tx);
  const need = new Map<string, number>();

  for (const l of o.lines) {
    let unitCost = 0;
    const lineRecipes = recipes.filter((r) => (r.itemId === l.itemId && !r.modifierId) || (r.modifierId && l.modifierIds.includes(r.modifierId)));
    for (const r of lineRecipes) {
      const ing = ings.find((i) => i.id === r.ingredientId);
      if (!ing) continue;
      const perUnit = convertQty(Number(r.quantity), r.unitId, ing.baseUnitId, conv);
      unitCost += perUnit * ing.avgCost;
      need.set(ing.id, (need.get(ing.id) ?? 0) + perUnit * l.quantity);
    }
    costs.set(l.orderItemId, Math.round(unitCost));
  }
  for (const [ingredientId, qty] of need) {
    const ing = ings.find((i) => i.id === ingredientId)!;
    await consumeBatches(tx, o.branchId, ingredientId, qty);
    await applyMovement(tx, { branchId: o.branchId, ingredientId, qty: -qty, type: "sale", unitCost: ing.avgCost, orderId: o.orderId, staffId: o.staffId });
  }
  return costs;
}

/** Put a voided order's ingredients back (once). */
export async function restoreForOrder(tx: Tx, orderId: string, branchId: string, staffId: string) {
  const sold = await tx.select().from(s.stockMovements).where(and(eq(s.stockMovements.orderId, orderId), eq(s.stockMovements.type, "sale")));
  const restored = await tx.select().from(s.stockMovements).where(and(eq(s.stockMovements.orderId, orderId), eq(s.stockMovements.type, "adjustment")));
  if (!sold.length || restored.length) return;
  for (const m of sold) {
    await applyMovement(tx, { branchId, ingredientId: m.ingredientId, qty: -Number(m.quantity), type: "adjustment", unitCost: m.unitCost, orderId, staffId, note: "Order voided — stock restored" });
  }
}
