import "server-only";
import { and, asc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

export type KdsItem = { id: string; name: string; qty: number; mods: string[]; note: string | null; status: string; stationId: string | null };
export type KdsTicket = { orderId: string; orderNo: string; type: string; tableNo: string | null; createdAt: string; started: boolean; items: KdsItem[] };
export type KdsStation = { id: string; name: string; warnSeconds: number; lateSeconds: number };
export type KdsData = { tickets: KdsTicket[]; stations: KdsStation[]; lastBumped: { orderId: string; orderNo: string } | null; serverNow: number };

const ACTIVE = ["new", "preparing", "recalled"];

export async function loadKds(branchId: string, stationId: string | null): Promise<KdsData> {
  const db = await getDb();
  const stations = await db.select().from(s.kitchenStations).where(eq(s.kitchenStations.branchId, branchId)).orderBy(asc(s.kitchenStations.name));
  const orders = await db.select().from(s.orders)
    .where(and(eq(s.orders.branchId, branchId), inArray(s.orders.status, ["sent", "preparing"]))).orderBy(asc(s.orders.createdAt));
  const ids = orders.map((o) => o.id);
  const items = ids.length ? await db.select().from(s.orderItems).where(and(inArray(s.orderItems.orderId, ids), eq(s.orderItems.isVoided, false))) : [];
  const mods = items.length ? await db.select().from(s.orderItemModifiers).where(inArray(s.orderItemModifiers.orderItemId, items.map((i) => i.id))) : [];

  const tickets: KdsTicket[] = [];
  for (const o of orders) {
    const mine = items.filter((i) => i.orderId === o.id && (!stationId || i.stationId === stationId || !i.stationId));
    if (!mine.some((i) => ACTIVE.includes(i.kdsStatus))) continue;
    tickets.push({
      orderId: o.id, orderNo: o.orderNo, type: o.type, tableNo: o.tableNo, createdAt: o.createdAt.toISOString(), started: o.status === "preparing",
      items: mine.map((i) => ({ id: i.id, name: i.nameSnapshot, qty: i.quantity, note: i.note, status: i.kdsStatus, stationId: i.stationId, mods: mods.filter((m) => m.orderItemId === i.id).map((m) => m.nameSnapshot) })),
    });
  }
  const [last] = await db.select({ orderId: s.orderItems.orderId, orderNo: s.orders.orderNo, at: s.orderItems.bumpedAt })
    .from(s.orderItems).innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
    .where(and(eq(s.orders.branchId, branchId), eq(s.orderItems.kdsStatus, "bumped"), gte(s.orderItems.bumpedAt, new Date(Date.now() - 30 * 60_000)), sql`${s.orders.status} <> 'voided'`))
    .orderBy(sql`${s.orderItems.bumpedAt} desc`).limit(1);
  return {
    tickets, serverNow: Date.now(), lastBumped: last ? { orderId: last.orderId, orderNo: last.orderNo } : null,
    stations: stations.map((x) => ({ id: x.id, name: x.name, warnSeconds: x.warnSeconds, lateSeconds: x.lateSeconds })),
  };
}

export async function loadStatusBoard(branchId: string) {
  const db = await getDb();
  const rows = await db.select({ no: s.orders.orderNo, status: s.orders.status, readyAt: s.orders.readyAt, at: s.orders.createdAt }).from(s.orders)
    .where(and(eq(s.orders.branchId, branchId), or(inArray(s.orders.status, ["sent", "preparing"]), and(eq(s.orders.status, "ready"), gte(s.orders.readyAt, new Date(Date.now() - 15 * 60_000))))))
    .orderBy(asc(s.orders.createdAt));
  return { preparing: rows.filter((r) => r.status !== "ready").map((r) => r.no), ready: rows.filter((r) => r.status === "ready").map((r) => r.no) };
}
