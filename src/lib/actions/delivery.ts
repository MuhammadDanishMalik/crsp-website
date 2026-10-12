"use server";

import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { getSession, requirePermission } from "@/lib/auth/session";
import { getOpenShift } from "@/lib/queries/shift";
import { loadDeliveries, loadRiderCash } from "@/lib/queries/delivery";
import { publish } from "@/lib/realtime/bus";
import { guard, UserError, type R } from "./_guard";

export async function fetchDeliveries(scope: "board" | "mine") {
  const session = await getSession();
  if (!session) return null;
  if (scope === "mine") return session.can("delivery.view_assigned") ? { rows: await loadDeliveries(session.branchId, { riderId: session.staffId, sinceDays: 1 }), riders: [] } : null;
  if (!session.can("delivery.assign") && !session.can("delivery.settle")) return null;
  return { rows: await loadDeliveries(session.branchId), riders: await loadRiderCash(session.branchId) };
}

export async function assignRider(deliveryId: string, riderId: string | null): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("delivery.assign");
    const db = await getDb();
    const [d] = await db.select().from(s.deliveries).where(and(eq(s.deliveries.id, deliveryId), eq(s.deliveries.branchId, session.branchId)));
    if (!d) throw new UserError("Delivery not found");
    if (["delivered", "cancelled"].includes(d.status)) throw new UserError("This delivery is already closed");
    if (riderId) {
      const link = await db.select().from(s.staffBranches).where(and(eq(s.staffBranches.staffId, riderId), eq(s.staffBranches.branchId, session.branchId)));
      if (!link.length) throw new UserError("That rider does not work at this branch");
    }
    await db.update(s.deliveries).set({ riderId, status: riderId ? "assigned" : "unassigned", assignedAt: riderId ? new Date() : null }).where(eq(s.deliveries.id, deliveryId));
    await audit(session, { action: "delivery.assign", entity: "delivery", entityId: deliveryId, after: { riderId } });
    publish(session.branchId, { type: "order.updated", orderId: d.orderId });
    return { ok: true };
  });
}

/** Rider (or a manager on their behalf) moves a delivery along. Riders can only touch their own. */
export async function updateDelivery(deliveryId: string, action: "picked" | "delivered" | "failed", opts: { cashCollectedPaisa?: number; reason?: string } = {}): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("delivery.update_status");
    const db = await getDb();
    const [d] = await db.select().from(s.deliveries).where(and(eq(s.deliveries.id, deliveryId), eq(s.deliveries.branchId, session.branchId)));
    if (!d) throw new UserError("Delivery not found");
    if (!session.can("delivery.assign") && d.riderId !== session.staffId) throw new UserError("This delivery is not assigned to you");
    const now = new Date();
    if (action === "picked") {
      if (d.status !== "assigned") throw new UserError("Assign a rider first");
      await db.update(s.deliveries).set({ status: "picked", pickedAt: now }).where(eq(s.deliveries.id, d.id));
    } else if (action === "failed") {
      if (!["assigned", "picked"].includes(d.status)) throw new UserError("Nothing to mark as failed");
      const why = z.string().trim().min(2, "Enter a reason").parse(opts.reason ?? "");
      await db.update(s.deliveries).set({ status: "failed", failureReason: why }).where(eq(s.deliveries.id, d.id));
    } else {
      if (!["assigned", "picked"].includes(d.status)) throw new UserError("This delivery cannot be completed");
      const collected = d.cashToCollect > 0 ? z.number().int().min(0).parse(opts.cashCollectedPaisa ?? d.cashToCollect) : 0;
      await db.transaction(async (tx) => {
        await tx.update(s.deliveries).set({ status: "delivered", deliveredAt: now, cashCollected: collected, pickedAt: d.pickedAt ?? now }).where(eq(s.deliveries.id, d.id));
        await tx.update(s.orders).set({ status: "completed", completedAt: now, amountPaid: collected, updatedAt: now }).where(eq(s.orders.id, d.orderId));
        if (d.cashToCollect > 0) await tx.update(s.payments).set({ status: "confirmed", confirmedAt: now, amount: collected, tendered: collected }).where(and(eq(s.payments.orderId, d.orderId), eq(s.payments.status, "pending")));
      });
    }
    await audit(session, { action: `delivery.${action}`, entity: "delivery", entityId: d.id, after: opts });
    publish(session.branchId, { type: "order.updated", orderId: d.orderId });
    return { ok: true };
  });
}

/** Cashier/manager receives the cash a rider is holding. Adds it to the current shift's expected cash. */
export async function settleRider(riderId: string, receivedPaisa: number): Promise<R & { expected?: number; diff?: number }> {
  try {
    const session = await requirePermission("delivery.settle");
    const received = z.number().int().min(0).parse(receivedPaisa);
    const shift = await getOpenShift(session.terminalId, session.staffId);
    if (!shift) return { ok: false, error: "Open a shift on a POS terminal to receive rider cash" };
    const db = await getDb();
    const ds = await db.select().from(s.deliveries).where(and(eq(s.deliveries.branchId, session.branchId), eq(s.deliveries.riderId, riderId), eq(s.deliveries.status, "delivered"), isNull(s.deliveries.settlementId), ne(s.deliveries.cashToCollect, 0)));
    if (!ds.length) return { ok: false, error: "This rider has nothing to settle" };
    const expected = ds.reduce((a, d) => a + (d.cashCollected ?? 0), 0);
    await db.transaction(async (tx) => {
      const [st] = await tx.insert(s.riderSettlements).values({ branchId: session.branchId, riderId, shiftId: shift.id, expectedCash: expected, receivedCash: received, settledBy: session.staffId }).returning();
      await tx.update(s.deliveries).set({ settlementId: st.id }).where(inArray(s.deliveries.id, ds.map((d) => d.id)));
      // The COD cash becomes a sale in this shift's drawer; any shortage shows up as the shift's own over/short.
      await tx.update(s.payments).set({ shiftId: shift.id }).where(and(inArray(s.payments.orderId, ds.map((d) => d.orderId)), eq(s.payments.provider, "cod")));
    });
    await audit(session, { action: "delivery.settle", entity: "staff", entityId: riderId, after: { expected, received, diff: received - expected } });
    publish(session.branchId, { type: "order.updated" });
    return { ok: true, expected, diff: received - expected };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Missing permission")) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}
