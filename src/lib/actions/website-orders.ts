"use server";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { PermissionError, getSession } from "@/lib/auth/session";
import { restoreForOrder } from "@/lib/inventory/stock";
import { cancelInvoiceFor } from "@/lib/tax/fiscalize";
import { publish } from "@/lib/realtime/bus";

export type WebsiteOrderRow = {
  orderId: string; orderNo: string; state: "new" | "accepted" | "rejected"; createdAt: string; total: number;
  customerName: string; address: string; mapsUrl: string | null; note: string | null;
  items: { name: string; qty: number; mods: string[]; note: string | null }[];
  phone: string | null; whatsapp: string | null; // shown once the kitchen has accepted
};

async function kitchenSession() {
  const session = await getSession();
  if (!session) throw new PermissionError("Not signed in");
  if (!session.can("order.create") && !session.can("kds.view")) throw new PermissionError("You cannot manage website orders");
  return session;
}

/** Website orders of the last 24 hours (new first) for the POS "Website" tab. */
export async function listWebsiteOrders(): Promise<{ ok: true; rows: WebsiteOrderRow[]; newCount: number } | { ok: false; error: string }> {
  try {
    const session = await kitchenSession();
    const db = await getDb();
    const since = new Date(Date.now() - 24 * 3600_000);
    const w = await db.select({ w: s.websiteOrders, o: s.orders }).from(s.websiteOrders).innerJoin(s.orders, eq(s.orders.id, s.websiteOrders.orderId))
      .where(and(eq(s.websiteOrders.branchId, session.branchId), gte(s.websiteOrders.createdAt, since))).orderBy(desc(s.websiteOrders.createdAt)).limit(100);
    const ids = w.map((r) => r.o.id);
    const items = ids.length ? await db.select().from(s.orderItems).where(and(inArray(s.orderItems.orderId, ids), eq(s.orderItems.isVoided, false))) : [];
    const mods = items.length ? await db.select().from(s.orderItemModifiers).where(inArray(s.orderItemModifiers.orderItemId, items.map((i) => i.id))) : [];
    const rank = { new: 0, accepted: 1, rejected: 2 } as const;
    const rows: WebsiteOrderRow[] = w.map(({ w: x, o }) => {
      const accepted = x.state === "accepted";
      return {
        orderId: o.id, orderNo: o.orderNo, state: x.state as WebsiteOrderRow["state"], createdAt: o.createdAt.toISOString(), total: o.total,
        customerName: o.customerName ?? "", address: o.deliveryAddress ?? "", mapsUrl: x.lat != null && x.lng != null ? `https://www.google.com/maps?q=${x.lat},${x.lng}` : null, note: x.note,
        items: items.filter((i) => i.orderId === o.id).map((i) => ({ name: i.nameSnapshot, qty: i.quantity, note: i.note, mods: mods.filter((m) => m.orderItemId === i.id).map((m) => m.nameSnapshot) })),
        phone: accepted ? x.phone : null, whatsapp: accepted ? x.whatsapp ?? x.phone : null,
      };
    }).sort((a, b) => rank[a.state] - rank[b.state]);
    return { ok: true, rows, newCount: rows.filter((r) => r.state === "new").length };
  } catch (e) {
    if (e instanceof PermissionError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Could not load website orders" };
  }
}

/** The kitchen accepts (the order goes to the kitchen screen and the Deliveries board) or rejects (voided, stock put back). */
export async function decideWebsiteOrder(orderId: string, decision: "accept" | "reject"): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await kitchenSession();
    const db = await getDb();
    const [row] = await db.select({ w: s.websiteOrders, o: s.orders }).from(s.websiteOrders).innerJoin(s.orders, eq(s.orders.id, s.websiteOrders.orderId))
      .where(and(eq(s.websiteOrders.orderId, orderId), eq(s.websiteOrders.branchId, session.branchId)));
    if (!row) return { ok: false, error: "Order not found" };
    if (row.w.state !== "new") return { ok: false, error: `This order was already ${row.w.state}` };
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(s.websiteOrders).set({ state: decision === "accept" ? "accepted" : "rejected", decidedAt: now, decidedBy: session.staffId }).where(eq(s.websiteOrders.orderId, orderId));
      if (decision === "accept") {
        await tx.update(s.orders).set({ status: "sent", updatedAt: now }).where(eq(s.orders.id, orderId));
        await tx.insert(s.deliveries).values({ orderId, branchId: row.o.branchId, cashToCollect: row.o.total }).onConflictDoNothing();
      } else {
        await tx.update(s.payments).set({ status: "refunded" }).where(eq(s.payments.orderId, orderId));
        await restoreForOrder(tx, orderId, row.o.branchId, session.staffId);
        if (row.o.customerId && (row.o.loyaltyPointsEarned || row.o.loyaltyPointsRedeemed)) {
          const back = row.o.loyaltyPointsRedeemed - row.o.loyaltyPointsEarned;
          await tx.insert(s.loyaltyTransactions).values({ customerId: row.o.customerId, orderId, points: back, reason: "Website order rejected" });
          await tx.update(s.customers).set({ loyaltyPoints: sql`${s.customers.loyaltyPoints} + ${back}` }).where(eq(s.customers.id, row.o.customerId));
        }
        await tx.update(s.orders).set({ status: "voided", voidedBy: session.staffId, voidReason: "Website order rejected by the kitchen", updatedAt: now }).where(eq(s.orders.id, orderId));
      }
    });
    if (decision === "reject") await cancelInvoiceFor(orderId, "Website order rejected");
    await audit(session, { action: decision === "accept" ? "website.accept" : "website.reject", entity: "order", entityId: orderId });
    publish(session.branchId, { type: decision === "accept" ? "kds.changed" : "order.voided", orderId });
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (e) {
    if (e instanceof PermissionError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}
