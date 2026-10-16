"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { PermissionError, readOverride, requirePermission, type Session } from "@/lib/auth/session";
import type { Permission } from "@/lib/domain/permissions";
import { getOpenShift } from "@/lib/queries/shift";
import { publish } from "@/lib/realtime/bus";
import { restoreForOrder } from "@/lib/inventory/stock";
import { cancelInvoiceFor } from "@/lib/tax/fiscalize";
import { getProvider } from "@/lib/adapters/payments";

type R = { ok: true } | { ok: false; error: string };
class UserError extends Error {}
async function guard(fn: () => Promise<R>): Promise<R> {
  try { return await fn(); } catch (e) {
    if (e instanceof PermissionError || e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}

/** The actor's own permission, or a manager's PIN-override token for it. Returns the approver id when overridden. */
async function approval(session: Session, perm: Permission, token?: string): Promise<string | undefined> {
  if (session.can(perm)) return undefined;
  const aid = await readOverride(token, perm);
  if (!aid) throw new PermissionError("Manager approval required");
  return aid;
}

const reasonSchema = z.string().trim().min(2, "Choose a reason").max(120);

/** Full void: reverses every payment, cancels the kitchen ticket, keeps the record for audit. */
export async function voidOrder(orderId: string, reason: string, overrideToken?: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("order.create");
    const why = reasonSchema.parse(reason);
    const approverId = await approval(session, "order.void", overrideToken);
    const db = await getDb();
    const [o] = await db.select().from(s.orders).where(and(eq(s.orders.id, orderId), eq(s.orders.branchId, session.branchId)));
    if (!o) throw new UserError("Order not found");
    if (["voided", "refunded"].includes(o.status)) throw new UserError("This order is already voided or refunded");
    const shift = await getOpenShift(session.terminalId, session.staffId);
    const pays = await db.select().from(s.payments).where(eq(s.payments.orderId, o.id));
    if (pays.some((p) => p.method === "cash") && !shift) throw new UserError("Open a shift to refund cash");
    const prior = await db.select().from(s.refunds).where(eq(s.refunds.orderId, o.id));
    const given = new Map<string, number>(); // money already handed back per method (e.g. when the bill was reduced by an edit)
    for (const r of prior) given.set(r.method ?? "", (given.get(r.method ?? "") ?? 0) + r.amount);
    for (const p of pays.filter((x) => x.status !== "pending" && x.method !== "cash" && x.provider !== "manual" && x.provider !== "cod")) {
      const rr = await getProvider(p.provider).refund(p.providerRef, p.amount, why);
      if (!rr.ok) throw new UserError(rr.message ?? "The payment gateway refused the refund");
    }
    await db.transaction(async (tx) => {
      for (const p of pays.filter((x) => x.status !== "pending")) { // an unpaid cash-on-delivery has nothing to give back
        const used = Math.min(p.amount, given.get(p.method) ?? 0);
        given.set(p.method, (given.get(p.method) ?? 0) - used);
        const left = p.amount - used;
        if (left > 0) await tx.insert(s.refunds).values({ orderId: o.id, paymentId: p.id, branchId: o.branchId, shiftId: shift?.id, kind: "void", method: p.method, amount: left, reasonCode: why, requestedBy: session.staffId, approvedBy: approverId ?? session.staffId });
      }
      await tx.update(s.payments).set({ status: "refunded" }).where(eq(s.payments.orderId, o.id));
      await restoreForOrder(tx, o.id, o.branchId, session.staffId);
      await tx.update(s.deliveries).set({ status: "cancelled" }).where(and(eq(s.deliveries.orderId, o.id), ne(s.deliveries.status, "delivered")));
      if (o.customerId && (o.loyaltyPointsEarned || o.loyaltyPointsRedeemed)) {
        const back = o.loyaltyPointsRedeemed - o.loyaltyPointsEarned;
        await tx.insert(s.loyaltyTransactions).values({ customerId: o.customerId, orderId: o.id, points: back, reason: "Order voided" });
        await tx.update(s.customers).set({ loyaltyPoints: sql`${s.customers.loyaltyPoints} + ${back}` }).where(eq(s.customers.id, o.customerId));
      }
      await tx.update(s.orders).set({ status: "voided", voidedBy: session.staffId, voidReason: why, updatedAt: new Date() }).where(eq(s.orders.id, o.id));
    });
    await audit(session, { action: "order.void", entity: "order", entityId: o.id, before: { status: o.status, total: o.total }, reason: why, approverId });
    await cancelInvoiceFor(o.id, why);
    publish(session.branchId, { type: "order.voided", orderId: o.id });
    return { ok: true };
  });
}

export async function refundOrder(orderId: string, amountPaisa: number, method: string, reason: string, overrideToken?: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("order.create");
    const why = reasonSchema.parse(reason);
    const amount = z.number().int().min(1, "Enter an amount").parse(amountPaisa);
    const m = z.enum(["cash", "card", "jazzcash", "easypaisa", "raast", "bank_transfer"]).parse(method);
    // Staff who can both create and approve refunds go straight through; everyone else needs a manager PIN.
    const approverId = session.can("refund.create") && session.can("refund.approve") ? undefined : await approval({ ...session, can: () => false } as Session, "refund.approve", overrideToken);
    const db = await getDb();
    const [o] = await db.select().from(s.orders).where(and(eq(s.orders.id, orderId), eq(s.orders.branchId, session.branchId)));
    if (!o) throw new UserError("Order not found");
    if (["voided", "refunded", "held"].includes(o.status)) throw new UserError("This order cannot be refunded");
    const pays = await db.select().from(s.payments).where(and(eq(s.payments.orderId, o.id), inArray(s.payments.status, ["confirmed", "partially_refunded", "pending_verification"])));
    const paidVia = pays.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0);
    const [done] = await db.select({ t: sql<number>`coalesce(sum(case when ${s.refunds.kind} <> 'adjustment' then ${s.refunds.amount} else 0 end),0)::int`, /* t: refunds against the current total (edit adjustments already lowered it); tm: all money actually returned per method */ tm: sql<number>`coalesce(sum(case when ${s.refunds.method} = ${m} then ${s.refunds.amount} else 0 end),0)::int` }).from(s.refunds).where(eq(s.refunds.orderId, o.id));
    if (amount > o.total - done.t) throw new UserError("Refund exceeds what is left on the order");
    if (amount > paidVia - done.tm) throw new UserError(`Only ${(paidVia - done.tm) / 100} can be refunded to ${m}`);
    const shift = await getOpenShift(session.terminalId, session.staffId);
    if (m === "cash" && !shift) throw new UserError("Open a shift to refund cash");
    const via = pays.find((p) => p.method === m);
    if (via && via.provider !== "manual" && via.provider !== "cod") { // gateway payments are returned through the gateway
      const rr = await getProvider(via.provider).refund(via.providerRef, amount, why);
      if (!rr.ok) throw new UserError(rr.message ?? "The payment gateway refused the refund");
    }
    const full = amount === o.total - done.t;
    await db.transaction(async (tx) => {
      await tx.insert(s.refunds).values({ orderId: o.id, paymentId: pays.find((p) => p.method === m)?.id, branchId: o.branchId, shiftId: shift?.id, kind: "refund", method: m, amount, reasonCode: why, requestedBy: session.staffId, approvedBy: approverId ?? session.staffId });
      await tx.update(s.payments).set({ status: full ? "refunded" : "partially_refunded" }).where(eq(s.payments.orderId, o.id));
      if (full) await tx.update(s.orders).set({ status: "refunded", updatedAt: new Date() }).where(eq(s.orders.id, o.id));
    });
    await audit(session, { action: "refund.create", entity: "order", entityId: o.id, after: { amount, method: m }, reason: why, approverId });
    publish(session.branchId, { type: "order.updated", orderId: o.id });
    return { ok: true };
  });
}
