"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { convertQty } from "@/lib/domain/inventory";
import { applyMovement, loadConversions } from "@/lib/inventory/stock";
import { guard, UserError, type R } from "./_guard";

const reval = () => { revalidatePath("/admin/inventory"); revalidatePath("/admin/recipes"); };
const num = (min = 0) => z.number().finite().min(min);

export async function saveIngredient(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("inventory.adjust");
    const v = z.object({
      id: z.string().uuid().optional(), name: z.string().trim().min(1, "Name is required").max(80), baseUnitId: z.string().uuid("Choose a unit"),
      isImported: z.boolean(), originCountry: z.string().trim().max(40).optional(), costPerUnitPaisa: num(), reorderLevel: num(),
    }).parse(raw);
    const db = await getDb();
    const values = { name: v.name, baseUnitId: v.baseUnitId, isImported: v.isImported, originCountry: v.isImported ? v.originCountry || null : null, avgCost: Math.round(v.costPerUnitPaisa) };
    let id = v.id;
    if (id) await db.update(s.ingredients).set(values).where(eq(s.ingredients.id, id));
    else { const [b] = await db.select().from(s.business).limit(1); [{ id }] = await db.insert(s.ingredients).values({ ...values, businessId: b.id }).returning({ id: s.ingredients.id }); }
    await db.insert(s.ingredientStock).values({ branchId: session.branchId, ingredientId: id!, reorderLevel: String(v.reorderLevel) })
      .onConflictDoUpdate({ target: [s.ingredientStock.branchId, s.ingredientStock.ingredientId], set: { reorderLevel: String(v.reorderLevel) } });
    await audit(session, { action: v.id ? "inventory.ingredient.update" : "inventory.ingredient.create", entity: "ingredient", entityId: id, after: values });
    reval();
    return { ok: true };
  });
}

export async function saveRecipe(itemId: string, lines: { ingredientId: string; qty: number; unitId: string }[]): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("inventory.recipes");
    const v = z.array(z.object({ ingredientId: z.string().uuid(), qty: z.number().positive("Quantities must be above zero"), unitId: z.string().uuid() })).parse(lines);
    const db = await getDb();
    const conv = await loadConversions(db);
    const ings = v.length ? await db.select().from(s.ingredients).where(inArray(s.ingredients.id, v.map((l) => l.ingredientId))) : [];
    for (const l of v) { // reject lines whose unit cannot be converted to the ingredient's base unit
      const ing = ings.find((i) => i.id === l.ingredientId);
      try { convertQty(1, l.unitId, ing!.baseUnitId, conv); } catch { throw new UserError(`Unit does not match ${ing?.name ?? "ingredient"}`); }
    }
    await db.transaction(async (tx) => {
      await tx.delete(s.recipes).where(and(eq(s.recipes.itemId, itemId)));
      if (v.length) await tx.insert(s.recipes).values(v.map((l) => ({ itemId, ingredientId: l.ingredientId, quantity: String(l.qty), unitId: l.unitId })));
    });
    await audit(session, { action: "inventory.recipe.save", entity: "menu_item", entityId: itemId, after: v });
    reval();
    return { ok: true };
  });
}

/** Enter quantities in any compatible unit; they're converted to the ingredient's base unit. */
async function toBase(ingredientId: string, qty: number, unitId: string) {
  const db = await getDb();
  const [ing] = await db.select().from(s.ingredients).where(eq(s.ingredients.id, ingredientId));
  if (!ing) throw new UserError("Ingredient not found");
  try { return { ing, base: convertQty(qty, unitId, ing.baseUnitId, await loadConversions(db)) }; } catch { throw new UserError("That unit does not match this ingredient"); }
}

export async function recordWastage(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("inventory.wastage");
    const v = z.object({ ingredientId: z.string().uuid(), qty: z.number().positive("Enter a quantity"), unitId: z.string().uuid(), reasonCodeId: z.string().uuid("Choose a reason"), note: z.string().max(200).optional() }).parse(raw);
    const { ing, base } = await toBase(v.ingredientId, v.qty, v.unitId);
    const db = await getDb();
    await db.transaction((tx) => applyMovement(tx, { branchId: session.branchId, ingredientId: ing.id, qty: -base, type: "wastage", unitCost: ing.avgCost, reasonCodeId: v.reasonCodeId, note: v.note, staffId: session.staffId }));
    await audit(session, { action: "inventory.wastage", entity: "ingredient", entityId: ing.id, after: { base, reason: v.reasonCodeId } });
    reval();
    return { ok: true };
  });
}

/** Stock count: sets the on-hand quantity and records the difference. */
export async function stockCount(ingredientId: string, counted: number, unitId: string, note?: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("inventory.adjust");
    const q = z.number().min(0, "Count cannot be negative").parse(counted);
    const { ing, base } = await toBase(ingredientId, q, unitId);
    const db = await getDb();
    const [cur] = await db.select().from(s.ingredientStock).where(and(eq(s.ingredientStock.branchId, session.branchId), eq(s.ingredientStock.ingredientId, ingredientId)));
    const before = Number(cur?.quantity ?? 0);
    await db.transaction((tx) => applyMovement(tx, { branchId: session.branchId, ingredientId, qty: base - before, type: "count", unitCost: ing.avgCost, note: note || "Stock count", staffId: session.staffId }));
    await audit(session, { action: "inventory.count", entity: "ingredient", entityId: ingredientId, before: { qty: before }, after: { qty: base } });
    reval();
    return { ok: true };
  });
}

export async function transferStock(ingredientId: string, toBranchId: string, qty: number, unitId: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("inventory.transfer");
    const q = z.number().positive("Enter a quantity").parse(qty);
    if (toBranchId === session.branchId) throw new UserError("Choose a different branch");
    const { ing, base } = await toBase(ingredientId, q, unitId);
    const db = await getDb();
    const [cur] = await db.select().from(s.ingredientStock).where(and(eq(s.ingredientStock.branchId, session.branchId), eq(s.ingredientStock.ingredientId, ingredientId)));
    if (Number(cur?.quantity ?? 0) < base) throw new UserError("Not enough stock to transfer");
    await db.transaction(async (tx) => {
      await applyMovement(tx, { branchId: session.branchId, ingredientId, qty: -base, type: "transfer_out", unitCost: ing.avgCost, transferBranchId: toBranchId, staffId: session.staffId });
      await applyMovement(tx, { branchId: toBranchId, ingredientId, qty: base, type: "transfer_in", unitCost: ing.avgCost, transferBranchId: session.branchId, staffId: session.staffId });
    });
    await audit(session, { action: "inventory.transfer", entity: "ingredient", entityId: ingredientId, after: { toBranchId, base } });
    reval();
    return { ok: true };
  });
}
