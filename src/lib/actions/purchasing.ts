"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { convertQty, landedUnitCost, weightedAvgCost } from "@/lib/domain/inventory";
import { applyMovement, loadConversions, type Tx } from "@/lib/inventory/stock";
import { getOpenShift } from "@/lib/queries/shift";
import { guard, UserError, type R } from "./_guard";

const reval = () => { revalidatePath("/admin/purchasing"); revalidatePath("/admin/inventory"); };

export async function saveSupplier(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("purchasing.manage");
    const v = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1, "Name is required").max(80), phone: z.string().trim().max(30).optional(), address: z.string().trim().max(200).optional(), isImporter: z.boolean() }).parse(raw);
    const db = await getDb();
    const values = { name: v.name, phone: v.phone || null, address: v.address || null, isImporter: v.isImporter };
    if (v.id) await db.update(s.suppliers).set(values).where(eq(s.suppliers.id, v.id));
    else { const [b] = await db.select().from(s.business).limit(1); await db.insert(s.suppliers).values({ ...values, businessId: b.id }); }
    await audit(session, { action: v.id ? "purchasing.supplier.update" : "purchasing.supplier.create", entity: "supplier", entityId: v.id, after: values });
    reval();
    return { ok: true };
  });
}

const lineSchema = z.object({
  ingredientId: z.string().uuid(), qty: z.number().positive("Enter a quantity"), unitId: z.string().uuid(),
  totalRupees: z.number().min(0), // price paid for the line in the supplier's currency (PKR), goods only
  batchNo: z.string().trim().max(40).optional(), expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  freightRupees: z.number().min(0).optional(), dutyRupees: z.number().min(0).optional(), otherRupees: z.number().min(0).optional(),
});

/** Create a PO. With `receiveNow`, the goods are booked into stock immediately ("quick purchase"). */
export async function createPurchase(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("purchasing.manage");
    const v = z.object({ supplierId: z.string().uuid("Choose a supplier"), receiveNow: z.boolean(), note: z.string().max(200).optional(), lines: z.array(lineSchema).min(1, "Add at least one item") }).parse(raw);
    const db = await getDb();
    const conv = await loadConversions(db);
    const ings = await db.select().from(s.ingredients).where(inArray(s.ingredients.id, v.lines.map((l) => l.ingredientId)));

    const prepared = v.lines.map((l) => {
      const ing = ings.find((i) => i.id === l.ingredientId);
      if (!ing) throw new UserError("Ingredient not found");
      let base: number;
      try { base = convertQty(l.qty, l.unitId, ing.baseUnitId, conv); } catch { throw new UserError(`Unit does not match ${ing.name}`); }
      const total = Math.round(l.totalRupees * 100);
      return { l, ing, base, total, unitCost: Math.round(total / base) };
    });
    for (const p of prepared) if (p.ing.isImported && v.receiveNow && (!p.l.batchNo || !p.l.expiry)) throw new UserError(`${p.ing.name} is imported: enter batch number and expiry`);

    await db.transaction(async (tx) => {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.purchaseOrders).where(eq(s.purchaseOrders.branchId, session.branchId));
      const [po] = await tx.insert(s.purchaseOrders).values({
        branchId: session.branchId, supplierId: v.supplierId, poNo: `PO-${String(n + 1).padStart(4, "0")}`, status: v.receiveNow ? "received" : "ordered",
        total: prepared.reduce((a, p) => a + p.total, 0), note: v.note, createdBy: session.staffId,
      }).returning();
      for (const p of prepared) {
        const [line] = await tx.insert(s.purchaseOrderLines).values({ poId: po.id, ingredientId: p.ing.id, quantity: String(p.base), unitCost: p.unitCost, receivedQty: "0" }).returning();
        if (v.receiveNow) await receiveLine(tx, { branchId: session.branchId, staffId: session.staffId, supplierId: v.supplierId, poId: po.id, lineId: line.id, ing: p.ing, base: p.base, unitCost: p.unitCost, l: p.l });
      }
    });
    await audit(session, { action: v.receiveNow ? "purchasing.quick_purchase" : "purchasing.po.create", entity: "purchase_order", after: { supplierId: v.supplierId, lines: v.lines.length } });
    reval();
    return { ok: true };
  });
}

async function receiveLine(tx: Tx, a: {
  branchId: string; staffId: string; supplierId: string; poId: string; lineId: string; ing: typeof s.ingredients.$inferSelect; base: number; unitCost: number;
  l: z.infer<typeof lineSchema>;
}) {
  const extras = { freight: Math.round((a.l.freightRupees ?? 0) * 100), duty: Math.round((a.l.dutyRupees ?? 0) * 100), other: Math.round((a.l.otherRupees ?? 0) * 100) };
  const landed = landedUnitCost(a.base, a.unitCost, extras);
  const [stock] = await tx.select().from(s.ingredientStock).where(and(eq(s.ingredientStock.branchId, a.branchId), eq(s.ingredientStock.ingredientId, a.ing.id)));
  const newAvg = weightedAvgCost(Number(stock?.quantity ?? 0), a.ing.avgCost, a.base, landed);
  let batchId: string | undefined;
  if (a.l.batchNo || a.l.expiry || a.ing.isImported) {
    const [b] = await tx.insert(s.stockBatches).values({
      branchId: a.branchId, ingredientId: a.ing.id, batchNo: a.l.batchNo, expiryDate: a.l.expiry, quantityRemaining: String(a.base), unitCost: a.unitCost, landedUnitCost: landed,
      freightCost: extras.freight, dutyCost: extras.duty, otherCost: extras.other, purchaseOrderId: a.poId,
    }).returning();
    batchId = b.id;
  }
  await applyMovement(tx, { branchId: a.branchId, ingredientId: a.ing.id, qty: a.base, type: "purchase", unitCost: landed, batchId, staffId: a.staffId, note: `PO ${a.poId.slice(0, 8)}` });
  await tx.update(s.ingredients).set({ avgCost: newAvg }).where(eq(s.ingredients.id, a.ing.id));
  await tx.update(s.purchaseOrderLines).set({ receivedQty: String(a.base) }).where(eq(s.purchaseOrderLines.id, a.lineId));
  await tx.update(s.suppliers).set({ balance: sql`${s.suppliers.balance} + ${Math.round(a.unitCost * a.base)}` }).where(eq(s.suppliers.id, a.supplierId));
}

/** Receive an open PO in full (batch/expiry/landed cost per line). */
export async function receivePurchaseOrder(poId: string, lines: Record<string, Pick<z.infer<typeof lineSchema>, "batchNo" | "expiry" | "freightRupees" | "dutyRupees" | "otherRupees">>): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("purchasing.manage");
    const db = await getDb();
    const [po] = await db.select().from(s.purchaseOrders).where(and(eq(s.purchaseOrders.id, poId), eq(s.purchaseOrders.branchId, session.branchId)));
    if (!po) throw new UserError("Purchase order not found");
    if (po.status === "received" || po.status === "cancelled") throw new UserError("This order is already closed");
    const pls = await db.select().from(s.purchaseOrderLines).where(eq(s.purchaseOrderLines.poId, poId));
    const ings = await db.select().from(s.ingredients).where(inArray(s.ingredients.id, pls.map((l) => l.ingredientId)));
    await db.transaction(async (tx) => {
      for (const pl of pls) {
        const ing = ings.find((i) => i.id === pl.ingredientId)!;
        const extra = lines[pl.id] ?? {};
        if (ing.isImported && (!extra.batchNo || !extra.expiry)) throw new UserError(`${ing.name} is imported: enter batch number and expiry`);
        await receiveLine(tx, { branchId: session.branchId, staffId: session.staffId, supplierId: po.supplierId, poId, lineId: pl.id, ing, base: Number(pl.quantity), unitCost: pl.unitCost, l: { ingredientId: ing.id, qty: 1, unitId: ing.baseUnitId, totalRupees: 0, ...extra } });
      }
      await tx.update(s.purchaseOrders).set({ status: "received" }).where(eq(s.purchaseOrders.id, poId));
    });
    await audit(session, { action: "purchasing.po.receive", entity: "purchase_order", entityId: poId });
    reval();
    return { ok: true };
  });
}

export async function cancelPurchaseOrder(poId: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("purchasing.manage");
    const db = await getDb();
    await db.update(s.purchaseOrders).set({ status: "cancelled" }).where(and(eq(s.purchaseOrders.id, poId), eq(s.purchaseOrders.branchId, session.branchId), eq(s.purchaseOrders.status, "ordered")));
    await audit(session, { action: "purchasing.po.cancel", entity: "purchase_order", entityId: poId });
    reval();
    return { ok: true };
  });
}

export async function paySupplier(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("purchasing.pay_supplier");
    const v = z.object({ supplierId: z.string().uuid(), amountRupees: z.number().positive("Enter an amount"), method: z.enum(["cash", "bank", "jazzcash", "easypaisa", "cheque"]), reference: z.string().max(60).optional(), fromDrawer: z.boolean() }).parse(raw);
    const amount = Math.round(v.amountRupees * 100);
    const db = await getDb();
    const [sup] = await db.select().from(s.suppliers).where(eq(s.suppliers.id, v.supplierId));
    if (!sup) throw new UserError("Supplier not found");
    const shift = v.fromDrawer ? await getOpenShift(session.terminalId, session.staffId) : null;
    if (v.fromDrawer && !shift) throw new UserError("Open a shift on a POS terminal to pay from the drawer");
    await db.transaction(async (tx) => {
      await tx.insert(s.supplierPayments).values({ supplierId: v.supplierId, branchId: session.branchId, amount, method: v.method, reference: v.reference, paidFromDrawer: v.fromDrawer, createdBy: session.staffId });
      await tx.update(s.suppliers).set({ balance: sql`${s.suppliers.balance} - ${amount}` }).where(eq(s.suppliers.id, v.supplierId));
      if (shift) await tx.insert(s.cashMovements).values({ shiftId: shift.id, branchId: session.branchId, type: "cash_out", amount, reason: `Supplier: ${sup.name}`, createdBy: session.staffId });
    });
    await audit(session, { action: "purchasing.supplier_payment", entity: "supplier", entityId: v.supplierId, after: { amount, method: v.method } });
    reval();
    return { ok: true };
  });
}
