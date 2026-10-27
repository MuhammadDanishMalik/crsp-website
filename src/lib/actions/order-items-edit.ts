"use server";

import { markNoDiscount } from "@/lib/domain/discount-scope";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { PermissionError, readOverride, requirePermission, type Session } from "@/lib/auth/session";
import { computeTotals, groupError, type CartLine } from "@/lib/domain/pricing";
import { pointsEarned } from "@/lib/domain/loyalty";
import { sadqaFor } from "@/lib/domain/sadqa";
import { applyMovement, deductForOrder } from "@/lib/inventory/stock";
import { loadPosMenu, loadTaxRules, categoryNamesOf, type PosMenu } from "@/lib/queries/menu";
import { getOpenShift } from "@/lib/queries/shift";
import { cancelInvoiceFor, fiscalizeNow } from "@/lib/tax/fiscalize";
import { publish } from "@/lib/realtime/bus";
import { UserError, type R } from "./_guard";

const editSchema = z.object({
  keep: z.array(z.object({ orderItemId: z.string().uuid(), quantity: z.number().int().min(0).max(99) })), // 0 = remove the line
  add: z.array(z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(1).max(99), modifierIds: z.array(z.string().uuid()).max(30), note: z.string().max(200).optional() })).max(40),
});
const payInput = z.object({ method: z.enum(["cash", "card", "jazzcash", "easypaisa"]), tendered: z.number().int().min(0).optional(), approvalCode: z.string().max(40).optional() });

export type EditLine = { orderItemId: string; name: string; unitPrice: number; quantity: number; mods: string[]; note: string | null };
export type EditChanges = { added: { name: string; qty: number; mods: string[]; note: string | null }[]; removed: { name: string; qty: number }[] };

/** Everything the edit screen needs: the order's current lines and the menu to add from. */
export async function loadOrderForEdit(orderId: string): Promise<{ ok: true; orderNo: string; status: string; lines: EditLine[]; menu: PosMenu; blocked: string | null } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("order.create");
    const db = await getDb();
    const [o] = await db.select().from(s.orders).where(and(eq(s.orders.id, orderId), eq(s.orders.branchId, session.branchId)));
    if (!o) return { ok: false, error: "Order not found" };
    const [items, mods, menu] = await Promise.all([
      db.select().from(s.orderItems).where(and(eq(s.orderItems.orderId, orderId), eq(s.orderItems.isVoided, false))),
      db.select().from(s.orderItemModifiers),
      loadPosMenu(session.branchId),
    ]);
    const ctx = await loadContext(session, orderId).catch((e) => e as Error);
    return {
      ok: true, orderNo: o.orderNo, status: o.status, menu, blocked: ctx instanceof Error ? ctx.message : null,
      lines: items.map((i) => ({ orderItemId: i.id, name: i.nameSnapshot, unitPrice: i.unitPrice, quantity: i.quantity, note: i.note, mods: mods.filter((m) => m.orderItemId === i.id).map((m) => m.nameSnapshot) })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

async function loadContext(session: Session, orderId: string) {
  const db = await getDb();
  const [o] = await db.select().from(s.orders).where(and(eq(s.orders.id, orderId), eq(s.orders.branchId, session.branchId)));
  if (!o) throw new UserError("Order not found");
  if (["voided", "refunded", "held"].includes(o.status)) throw new UserError("This order is closed and cannot be edited");
  if (o.createdBy !== session.staffId && !session.can("order.view_all")) throw new UserError("You can only edit your own orders");
  if (o.loyaltyPointsRedeemed > 0) throw new UserError("This order used loyalty points. Void it and enter it again instead of editing.");
  const [pays, refunds, discount, delivery] = await Promise.all([
    db.select().from(s.payments).where(eq(s.payments.orderId, orderId)),
    db.select().from(s.refunds).where(eq(s.refunds.orderId, orderId)),
    db.select().from(s.orderDiscounts).where(eq(s.orderDiscounts.orderId, orderId)),
    db.select().from(s.deliveries).where(eq(s.deliveries.orderId, orderId)),
  ]);
  if (refunds.some((r) => r.kind !== "adjustment")) throw new UserError("This order already has a refund and cannot be edited");
  if (pays.some((p) => p.status === "pending_verification")) throw new UserError("A transfer on this order is still waiting for verification. Verify it first.");
  const cod = pays.find((p) => p.provider === "cod" && p.status === "pending");
  if (delivery[0] && ["delivered", "cancelled", "failed"].includes(delivery[0].status)) throw new UserError("This delivery is already closed");
  const paidNet = pays.filter((p) => p.status === "confirmed").reduce((a, p) => a + p.amount, 0) - refunds.reduce((a, r) => a + r.amount, 0);
  return { o, pays, refunds, discount: discount[0] ?? null, cod, delivery: delivery[0] ?? null, paidNet, adjusted: refunds.length > 0 };
}

/** Price everything and work out the new totals, without writing anything. */
async function plan(session: Session, orderId: string, raw: unknown) {
  const edit = editSchema.parse(raw);
  const db = await getDb();
  const ctx = await loadContext(session, orderId);
  const { o } = ctx;
  const old = await db.select().from(s.orderItems).where(and(eq(s.orderItems.orderId, orderId), eq(s.orderItems.isVoided, false)));
  const oldMods = old.length ? await db.select().from(s.orderItemModifiers).where(inArray(s.orderItemModifiers.orderItemId, old.map((i) => i.id))) : [];
  const keepMap = new Map(edit.keep.map((k) => [k.orderItemId, k.quantity]));
  for (const k of edit.keep) if (!old.some((i) => i.id === k.orderItemId)) throw new UserError("An item on this order changed. Reopen the order and try again.");

  // new lines: priced and validated like a normal sale
  const itemIds = [...new Set(edit.add.map((l) => l.itemId))];
  const menuItems = itemIds.length ? await db.select().from(s.menuItems).where(inArray(s.menuItems.id, itemIds)) : [];
  const branchRows = itemIds.length ? await db.select().from(s.branchMenuItems).where(and(eq(s.branchMenuItems.branchId, o.branchId), inArray(s.branchMenuItems.itemId, itemIds))) : [];
  const groupLinks = itemIds.length ? await db.select().from(s.itemModifierGroups).where(inArray(s.itemModifierGroups.itemId, itemIds)) : [];
  const modIds = [...new Set(edit.add.flatMap((l) => l.modifierIds))];
  const mods = modIds.length ? await db.select().from(s.modifiers).where(inArray(s.modifiers.id, modIds)) : [];
  const gIds = [...new Set(groupLinks.map((g) => g.groupId))];
  const groups = gIds.length ? await db.select().from(s.modifierGroups).where(inArray(s.modifierGroups.id, gIds)) : [];
  const sadqa = await db.select().from(s.sadqaRules).where(eq(s.sadqaRules.isActive, true));
  const added = edit.add.map((l) => {
    const item = menuItems.find((i) => i.id === l.itemId);
    if (!item || !item.isActive) throw new UserError("An item you added no longer exists");
    const ov = branchRows.find((b) => b.itemId === item.id);
    if (ov && !ov.isAvailable) throw new UserError(`${item.name} is sold out`);
    const allowed = groupLinks.filter((g) => g.itemId === item.id).map((g) => g.groupId);
    const picked = l.modifierIds.map((id) => { const m = mods.find((x) => x.id === id); if (!m || !allowed.includes(m.groupId)) throw new UserError(`Invalid option for ${item.name}`); return m; });
    for (const gid of allowed) { const g = groups.find((x) => x.id === gid)!; const err = groupError(g.minSelect, g.maxSelect, picked.filter((m) => m.groupId === gid).length); if (err) throw new UserError(`${item.name} — ${g.name}: ${err}`); }
    const unit = (ov?.price ?? item.basePrice) + picked.reduce((a, m) => a + m.priceDelta, 0);
    return { item, picked, unit, qty: l.quantity, note: l.note, sadqa: sadqaFor(unit * l.quantity, sadqa.find((r) => r.itemId === item.id)?.percentBps ?? 0) };
  });

  const kept = old.map((i) => ({ row: i, qty: keepMap.has(i.id) ? keepMap.get(i.id)! : i.quantity }));
  const lines: CartLine[] = [
    ...kept.filter((k) => k.qty > 0).map((k) => ({ key: k.row.id, itemId: k.row.itemId, name: k.row.nameSnapshot, basePrice: k.row.unitPrice, quantity: k.qty, modifiers: [] })),
    ...added.map((a, i) => ({ key: `new${i}`, itemId: a.item.id, name: a.item.name, basePrice: a.unit, quantity: a.qty, modifiers: [] })),
  ];
  if (!lines.length) throw new UserError("An order needs at least one item. To cancel everything, use Void.");

  const [biz] = await db.select().from(s.business).limit(1);
  const serviceChargeBps = ((biz?.settings as { serviceChargeBps?: number } | null)?.serviceChargeBps) ?? 0;
  const dominant = ctx.cod ? "cash" : [...ctx.pays].sort((a, b) => b.amount - a.amount)[0]?.method ?? "cash";
  const discount = ctx.discount ? { kind: ctx.discount.kind, value: ctx.discount.value } : null;
  const catOf = await categoryNamesOf([...new Set(lines.map((l) => l.itemId))]);
  const totals = computeTotals({ lines: markNoDiscount(lines, catOf), discount, orderType: o.type, paymentMethod: dominant, taxRules: await loadTaxRules(o.branchId), serviceChargeBps, deliveryCharge: o.deliveryCharge });
  const diff = ctx.cod ? 0 : totals.total - ctx.paidNet;
  return { edit, ctx, old, oldMods, kept, added, totals, diff, dominant, lines };
}

/** Give money back newest payment first, never more than that payment still holds. Returns what to hand back per payment. */
function allocateRefund(pays: (typeof s.payments.$inferSelect)[], refunds: (typeof s.refunds.$inferSelect)[], amount: number) {
  const given = new Map<string, number>();
  for (const r of refunds) given.set(r.paymentId ?? r.method ?? "", (given.get(r.paymentId ?? r.method ?? "") ?? 0) + r.amount);
  let left = amount;
  const out: { paymentId: string; method: string; amount: number }[] = [];
  for (const p of [...pays].filter((x) => x.status === "confirmed").reverse()) {
    const holds = p.amount - (given.get(p.id) ?? 0);
    const take = Math.min(holds, left);
    if (take > 0) { out.push({ paymentId: p.id, method: p.method, amount: take }); left -= take; }
  }
  if (left > 0) throw new UserError("Not enough paid money on this order to return that amount");
  return out;
}

const NEEDS_APPROVAL = "Manager approval required";

export type EditPreview = { ok: true; oldTotal: number; newTotal: number; diff: number; refundMethod: string | null; needsApproval: boolean; cod: boolean } | { ok: false; error: string };

export async function previewOrderEdit(orderId: string, raw: unknown): Promise<EditPreview> {
  try {
    const session = await requirePermission("order.create");
    const p = await plan(session, orderId, raw);
    const back = p.diff < 0 ? allocateRefund(p.ctx.pays, p.ctx.refunds, -p.diff) : [];
    return { ok: true, oldTotal: p.ctx.o.total, newTotal: p.totals.total, diff: p.diff, refundMethod: back.map((b) => b.method.replace("_", " ")).join(" + ") || null, needsApproval: !session.can("order.edit_sent"), cod: !!p.ctx.cod };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export async function applyOrderEdit(orderId: string, raw: unknown, payment: unknown, overrideToken?: string): Promise<(R & { changes?: EditChanges; newTotal?: number; diff?: number; change?: number })> {
  try {
    const session = await requirePermission("order.create");
    let approverId: string | undefined;
    if (!session.can("order.edit_sent")) {
      const aid = await readOverride(overrideToken, "order.edit_sent");
      if (!aid) throw new PermissionError(NEEDS_APPROVAL);
      approverId = aid;
    }
    const p = await plan(session, orderId, raw);
    const { ctx, totals, diff } = p;
    const db = await getDb();
    const shift = await getOpenShift(session.terminalId, session.staffId);
    const pay = diff > 0 ? payInput.parse(payment) : null;
    const back = diff < 0 ? allocateRefund(ctx.pays, ctx.refunds, -diff) : [];
    if ((pay?.method === "cash" || back.some((b) => b.method === "cash")) && !shift) throw new UserError("Open a shift on this till to handle cash");
    if (pay && pay.method !== "cash" && !(pay.approvalCode ?? "").trim()) throw new UserError("Enter the terminal approval / transaction ID");
    if (pay?.method === "cash" && (pay.tendered ?? diff) < diff) throw new UserError("Cash received is less than the amount due");
    const change = pay?.method === "cash" ? (pay.tendered ?? diff) - diff : 0;

    const changes: EditChanges = { added: [], removed: [] };
    await db.transaction(async (tx) => {
      const now = new Date();
      // 1. stock: undo what this order consumed so far, then consume for the new set of lines
      const mv = await tx.select({ i: s.stockMovements.ingredientId, q: s.stockMovements.quantity }).from(s.stockMovements).where(eq(s.stockMovements.orderId, orderId));
      const net = new Map<string, number>();
      for (const m of mv) net.set(m.i, (net.get(m.i) ?? 0) + Number(m.q));
      for (const [ingredientId, q] of net) if (Math.abs(q) > 1e-9) await applyMovement(tx, { branchId: ctx.o.branchId, ingredientId, qty: -q, type: "adjustment", orderId, staffId: session.staffId, note: "Order edited: stock reset" });

      // 2. order lines
      let reopen = false;
      const forStock: { orderItemId: string; itemId: string; quantity: number; modifierIds: string[] }[] = [];
      for (const k of p.kept) {
        const modsOf = p.oldMods.filter((m) => m.orderItemId === k.row.id);
        if (k.qty === 0) {
          await tx.update(s.orderItems).set({ isVoided: true, voidReason: "Order edited", voidedBy: session.staffId }).where(eq(s.orderItems.id, k.row.id));
          changes.removed.push({ name: k.row.nameSnapshot, qty: k.row.quantity });
          continue;
        }
        if (k.qty !== k.row.quantity) {
          const more = k.qty > k.row.quantity;
          await tx.update(s.orderItems).set({ quantity: k.qty, lineTotal: k.row.unitPrice * k.qty, sadqaAmount: k.row.quantity ? Math.round((k.row.sadqaAmount / k.row.quantity) * k.qty) : 0, ...(more ? { kdsStatus: "new" as const, bumpedAt: null, sentAt: now } : {}) }).where(eq(s.orderItems.id, k.row.id));
          if (more) { reopen = true; changes.added.push({ name: k.row.nameSnapshot, qty: k.qty - k.row.quantity, mods: modsOf.map((m) => m.nameSnapshot), note: k.row.note }); }
          else changes.removed.push({ name: k.row.nameSnapshot, qty: k.row.quantity - k.qty });
        }
        forStock.push({ orderItemId: k.row.id, itemId: k.row.itemId, quantity: k.qty, modifierIds: modsOf.map((m) => m.modifierId).filter((x): x is string => !!x) });
      }
      for (const a of p.added) {
        const [oi] = await tx.insert(s.orderItems).values({ orderId, itemId: a.item.id, nameSnapshot: a.item.name, unitPrice: a.unit, quantity: a.qty, lineTotal: a.unit * a.qty, note: a.note, stationId: a.item.kitchenStationId, sentAt: now, sadqaAmount: a.sadqa }).returning();
        if (a.picked.length) await tx.insert(s.orderItemModifiers).values(a.picked.map((m) => ({ orderItemId: oi.id, modifierId: m.id, nameSnapshot: m.name, priceDelta: m.priceDelta })));
        forStock.push({ orderItemId: oi.id, itemId: a.item.id, quantity: a.qty, modifierIds: a.picked.map((m) => m.id) });
        changes.added.push({ name: a.item.name, qty: a.qty, mods: a.picked.map((m) => m.name), note: a.note ?? null });
        reopen = true;
      }
      const costs = await deductForOrder(tx, { branchId: ctx.o.branchId, orderId, staffId: session.staffId, lines: forStock });
      for (const [orderItemId, cost] of costs) await tx.update(s.orderItems).set({ costSnapshot: cost }).where(eq(s.orderItems.id, orderItemId));

      // 3. totals, tax lines, discount amount
      await tx.delete(s.orderTaxLines).where(eq(s.orderTaxLines.orderId, orderId));
      if (totals.taxLines.length) await tx.insert(s.orderTaxLines).values(totals.taxLines.map((t) => ({ orderId, taxRuleId: t.ruleId, name: t.name, rateBps: t.rateBps, amount: t.amount })));
      if (ctx.discount) await tx.update(s.orderDiscounts).set({ amount: totals.discountTotal }).where(eq(s.orderDiscounts.id, ctx.discount.id));
      const [lr] = await tx.select().from(s.loyaltyRules).where(eq(s.loyaltyRules.isActive, true)).limit(1);
      let earned = ctx.o.loyaltyPointsEarned;
      if (ctx.o.customerId && lr) {
        earned = pointsEarned(totals.total, { earnPerRupee: Number(lr.earnPerRupee) });
        const d = earned - ctx.o.loyaltyPointsEarned;
        if (d !== 0) {
          await tx.insert(s.loyaltyTransactions).values({ customerId: ctx.o.customerId, orderId, points: d, reason: "Order edited" });
          await tx.update(s.customers).set({ loyaltyPoints: sql`${s.customers.loyaltyPoints} + ${d}` }).where(eq(s.customers.id, ctx.o.customerId));
        }
      }
      await tx.update(s.orders).set({
        subtotal: totals.subtotal, discountTotal: totals.discountTotal, serviceCharge: totals.serviceCharge, taxTotal: totals.taxTotal, total: totals.total, loyaltyPointsEarned: earned,
        amountPaid: ctx.cod ? 0 : totals.total, updatedAt: now,
        ...(reopen && ctx.o.status === "ready" ? { status: "preparing" as const, readyAt: null } : {}),
      }).where(eq(s.orders.id, orderId));

      // 4. money
      if (ctx.cod) {
        await tx.update(s.payments).set({ amount: totals.total }).where(eq(s.payments.id, ctx.cod.id));
        if (ctx.delivery) await tx.update(s.deliveries).set({ cashToCollect: totals.total }).where(eq(s.deliveries.id, ctx.delivery.id));
      } else if (diff > 0 && pay) {
        await tx.insert(s.payments).values({
          orderId, branchId: ctx.o.branchId, shiftId: shift?.id, method: pay.method, status: "confirmed", amount: diff, tendered: pay.method === "cash" ? (pay.tendered ?? diff) : null,
          changeGiven: pay.method === "cash" ? change : null, provider: "manual", approvalCode: pay.approvalCode, createdBy: session.staffId, confirmedAt: now,
        });
      } else if (diff < 0) {
        // "adjustment": money handed back because the bill got smaller. Counted in the drawer, but not a refund in the sales reports (the order total already dropped).
        for (const b of back) await tx.insert(s.refunds).values({ orderId, paymentId: b.paymentId, branchId: ctx.o.branchId, shiftId: shift?.id, kind: "adjustment", method: b.method, amount: b.amount, reasonCode: "Order edited", requestedBy: session.staffId, approvedBy: approverId ?? session.staffId });
      }
    });

    // 5. tax authority: the filed invoice no longer matches, so cancel it and file the new one
    const [inv] = await db.select().from(s.taxInvoices).where(eq(s.taxInvoices.orderId, orderId));
    if (inv) {
      if (inv.authorityInvoiceNo) await cancelInvoiceFor(orderId, "Order edited");
      await db.update(s.taxInvoices).set({ state: "pending", authorityInvoiceNo: null, qrPayload: null, attempts: 0, nextRetryAt: null, sentAt: null }).where(eq(s.taxInvoices.id, inv.id));
      await fiscalizeNow(orderId, ctx.o.branchId);
    }
    await audit(session, { action: "order.items_edit", entity: "order", entityId: orderId, before: { total: ctx.o.total }, after: { total: totals.total, diff, changes }, approverId });
    publish(session.branchId, { type: "order.updated", orderId });
    revalidatePath("/orders"); revalidatePath("/admin/orders");
    return { ok: true, changes, newTotal: totals.total, diff, change };
  } catch (e) {
    if (e instanceof PermissionError || e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(e);
    return { ok: false, error: "Could not edit the order" };
  }
}
