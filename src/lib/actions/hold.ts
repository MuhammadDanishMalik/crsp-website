"use server";

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { PermissionError, requirePermission } from "@/lib/auth/session";
import { businessDate } from "@/lib/domain/dates";
import { createOrderSchema } from "@/lib/validation/order";
import { getOpenShift } from "@/lib/queries/shift";
import { publish } from "@/lib/realtime/bus";

type Err = { ok: false; error: string };
const fail = (e: unknown): Err => {
  if (e instanceof PermissionError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Something went wrong" };
};

const holdSchema = createOrderSchema.pick({ type: true, tableNo: true, customerPhone: true, customerName: true, deliveryAddress: true, deliveryZoneId: true, aggregatorName: true, lines: true });

export async function holdOrder(raw: unknown): Promise<{ ok: true; ref: string } | Err> {
  try {
    const session = await requirePermission("order.hold");
    const v = holdSchema.parse(raw);
    if (!session.terminalId) return { ok: false, error: "No terminal" };
    const shift = await getOpenShift(session.terminalId, session.staffId);
    const db = await getDb();
    const itemIds = [...new Set(v.lines.map((l) => l.itemId))];
    const items = await db.select().from(s.menuItems).where(inArray(s.menuItems.id, itemIds));
    const modIds = [...new Set(v.lines.flatMap((l) => l.modifierIds))];
    const mods = modIds.length ? await db.select().from(s.modifiers).where(inArray(s.modifiers.id, modIds)) : [];
    const ref = `H${Date.now().toString(36).slice(-4).toUpperCase()}`;
    await db.transaction(async (tx) => {
      const [o] = await tx.insert(s.orders).values({
        branchId: session.branchId, terminalId: session.terminalId!, shiftId: shift?.id, businessDate: businessDate(), orderNo: ref, type: v.type, status: "held",
        tableNo: v.tableNo, deliveryAddress: v.deliveryAddress, deliveryZoneId: v.deliveryZoneId, aggregatorName: v.aggregatorName,
        note: JSON.stringify({ phone: v.customerPhone, name: v.customerName }), createdBy: session.staffId,
      }).returning();
      for (const l of v.lines) {
        const it = items.find((i) => i.id === l.itemId);
        if (!it) continue;
        const [oi] = await tx.insert(s.orderItems).values({ orderId: o.id, itemId: it.id, nameSnapshot: it.name, unitPrice: it.basePrice, quantity: l.quantity, lineTotal: it.basePrice * l.quantity, note: l.note }).returning();
        const picked = l.modifierIds.map((id) => mods.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m);
        if (picked.length) await tx.insert(s.orderItemModifiers).values(picked.map((m) => ({ orderItemId: oi.id, modifierId: m.id, nameSnapshot: m.name, priceDelta: m.priceDelta })));
      }
    });
    publish(session.branchId, { type: "order.updated" });
    return { ok: true, ref };
  } catch (e) {
    return fail(e);
  }
}

export type HeldOrder = { id: string; ref: string; type: string; tableNo: string | null; createdAt: string; by: string; summary: string; count: number };

export async function listHeld(): Promise<HeldOrder[]> {
  try {
    const session = await requirePermission("order.hold");
    const db = await getDb();
    const orders = await db.select().from(s.orders).where(and(eq(s.orders.branchId, session.branchId), eq(s.orders.status, "held")));
    if (!orders.length) return [];
    const items = await db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, orders.map((o) => o.id)));
    const staff = await db.select({ id: s.staff.id, n: s.staff.fullName }).from(s.staff).where(inArray(s.staff.id, orders.map((o) => o.createdBy)));
    return orders.map((o) => {
      const mine = items.filter((i) => i.orderId === o.id);
      return { id: o.id, ref: o.orderNo, type: o.type, tableNo: o.tableNo, createdAt: o.createdAt.toISOString(), by: staff.find((x) => x.id === o.createdBy)?.n ?? "", count: mine.reduce((a, i) => a + i.quantity, 0), summary: mine.map((i) => `${i.quantity}× ${i.nameSnapshot}`).join(", ") };
    });
  } catch {
    return [];
  }
}

export type RecalledOrder = {
  type: string; tableNo: string | null; customerPhone: string; customerName: string; deliveryAddress: string; deliveryZoneId: string | null; aggregatorName: string;
  lines: { itemId: string; quantity: number; modifierIds: string[]; note: string | null }[];
};

/** Returns the held order's contents and removes the hold. Recalling several into one cart merges them. */
export async function recallHeld(id: string): Promise<{ ok: true; order: RecalledOrder } | Err> {
  try {
    const session = await requirePermission("order.hold");
    const db = await getDb();
    const [o] = await db.select().from(s.orders).where(and(eq(s.orders.id, id), eq(s.orders.branchId, session.branchId), eq(s.orders.status, "held")));
    if (!o) return { ok: false, error: "That order is no longer held" };
    const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id));
    const mods = items.length ? await db.select().from(s.orderItemModifiers).where(inArray(s.orderItemModifiers.orderItemId, items.map((i) => i.id))) : [];
    let c: { phone?: string; name?: string } = {};
    try { c = JSON.parse(o.note ?? "{}"); } catch { /* none */ }
    await db.delete(s.orders).where(eq(s.orders.id, o.id));
    publish(session.branchId, { type: "order.updated" });
    return {
      ok: true,
      order: {
        type: o.type, tableNo: o.tableNo, customerPhone: c.phone ?? "", customerName: c.name ?? "", deliveryAddress: o.deliveryAddress ?? "", deliveryZoneId: o.deliveryZoneId, aggregatorName: o.aggregatorName ?? "",
        lines: items.map((i) => ({ itemId: i.itemId, quantity: i.quantity, note: i.note, modifierIds: mods.filter((m) => m.orderItemId === i.id && m.modifierId).map((m) => m.modifierId!) })),
      },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function discardHeld(id: string): Promise<{ ok: true } | Err> {
  try {
    const session = await requirePermission("order.hold");
    const db = await getDb();
    await db.delete(s.orders).where(and(eq(s.orders.id, id), eq(s.orders.branchId, session.branchId), eq(s.orders.status, "held")));
    await audit(session, { action: "order.hold.discard", entity: "order", entityId: id });
    publish(session.branchId, { type: "order.updated" });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function moveTable(id: string, tableNo: string): Promise<{ ok: true } | Err> {
  try {
    const session = await requirePermission("order.transfer_table");
    const t = tableNo.trim().slice(0, 10);
    if (!t) return { ok: false, error: "Enter a table number" };
    const db = await getDb();
    const [before] = await db.select({ t: s.orders.tableNo }).from(s.orders).where(eq(s.orders.id, id));
    await db.update(s.orders).set({ tableNo: t, type: "dine_in" }).where(and(eq(s.orders.id, id), eq(s.orders.branchId, session.branchId), eq(s.orders.status, "held")));
    await audit(session, { action: "order.transfer_table", entity: "order", entityId: id, before, after: { tableNo: t } });
    publish(session.branchId, { type: "order.updated" });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
