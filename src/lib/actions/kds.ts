"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { PermissionError, requirePermission, getSession } from "@/lib/auth/session";
import { loadKds, type KdsData } from "@/lib/queries/kds";
import { publish } from "@/lib/realtime/bus";

export async function fetchKds(stationId: string | null): Promise<KdsData | null> {
  const session = await getSession();
  if (!session || !session.can("kds.view")) return null;
  return loadKds(session.branchId, stationId);
}

/** After any bump, an order whose items are all bumped becomes "ready". */
async function syncOrderStatus(orderId: string) {
  const db = await getDb();
  const items = await db.select({ st: s.orderItems.kdsStatus }).from(s.orderItems).where(and(eq(s.orderItems.orderId, orderId), eq(s.orderItems.isVoided, false)));
  if (!items.length) return;
  const allBumped = items.every((i) => i.st === "bumped");
  await db.update(s.orders).set(allBumped ? { status: "ready", readyAt: new Date(), updatedAt: new Date() } : { updatedAt: new Date() })
    .where(and(eq(s.orders.id, orderId), inArray(s.orders.status, ["sent", "preparing", "ready"])));
}

async function wrap(fn: (branchId: string) => Promise<void>) {
  try {
    const session = await requirePermission("kds.bump");
    await fn(session.branchId);
    publish(session.branchId, { type: "kds.changed" });
    return { ok: true as const };
  } catch (e) {
    if (e instanceof PermissionError) return { ok: false as const, error: e.message };
    console.error(e);
    return { ok: false as const, error: "Something went wrong" };
  }
}

export async function startTicket(orderId: string) {
  return wrap(async (branchId) => {
    const db = await getDb();
    await db.update(s.orderItems).set({ kdsStatus: "preparing" }).where(and(eq(s.orderItems.orderId, orderId), eq(s.orderItems.kdsStatus, "new")));
    await db.update(s.orders).set({ status: "preparing", updatedAt: new Date() }).where(and(eq(s.orders.id, orderId), eq(s.orders.branchId, branchId), eq(s.orders.status, "sent")));
  });
}

export async function bumpItem(itemId: string) {
  return wrap(async (branchId) => {
    const db = await getDb();
    const [it] = await db.select({ orderId: s.orderItems.orderId }).from(s.orderItems).innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
      .where(and(eq(s.orderItems.id, itemId), eq(s.orders.branchId, branchId)));
    if (!it) return;
    await db.update(s.orderItems).set({ kdsStatus: "bumped", bumpedAt: new Date() }).where(eq(s.orderItems.id, itemId));
    await syncOrderStatus(it.orderId);
  });
}

/** Bump everything on the ticket that this station can see (all items when no station is selected). */
export async function bumpOrder(orderId: string, stationId: string | null) {
  return wrap(async (branchId) => {
    const db = await getDb();
    const [o] = await db.select({ id: s.orders.id }).from(s.orders).where(and(eq(s.orders.id, orderId), eq(s.orders.branchId, branchId)));
    if (!o) return;
    const cond = stationId
      ? and(eq(s.orderItems.orderId, orderId), sql`(${s.orderItems.stationId} = ${stationId} or ${s.orderItems.stationId} is null)`, inArray(s.orderItems.kdsStatus, ["new", "preparing", "recalled"]))
      : and(eq(s.orderItems.orderId, orderId), inArray(s.orderItems.kdsStatus, ["new", "preparing", "recalled"]));
    await db.update(s.orderItems).set({ kdsStatus: "bumped", bumpedAt: new Date() }).where(cond);
    await syncOrderStatus(orderId);
  });
}

export async function recallLast() {
  try {
    const session = await requirePermission("kds.recall");
    const db = await getDb();
    const [last] = await db.select({ orderId: s.orderItems.orderId }).from(s.orderItems).innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
      .where(and(eq(s.orders.branchId, session.branchId), eq(s.orderItems.kdsStatus, "bumped"), sql`${s.orders.status} <> 'voided'`)).orderBy(desc(s.orderItems.bumpedAt)).limit(1);
    if (!last) return { ok: false as const, error: "Nothing to recall" };
    await db.update(s.orderItems).set({ kdsStatus: "recalled", bumpedAt: null }).where(eq(s.orderItems.orderId, last.orderId));
    await db.update(s.orders).set({ status: "preparing", readyAt: null, updatedAt: new Date() }).where(eq(s.orders.id, last.orderId));
    publish(session.branchId, { type: "kds.changed" });
    return { ok: true as const };
  } catch (e) {
    if (e instanceof PermissionError) return { ok: false as const, error: e.message };
    console.error(e);
    return { ok: false as const, error: "Something went wrong" };
  }
}
