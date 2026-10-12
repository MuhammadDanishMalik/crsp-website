import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const hourOf = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", hour12: false }).format(d)) % 24;
export const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export async function loadDashboard(branchIds: string[], date: string) {
  const db = await getDb();
  const live = (d: string) => and(inArray(s.orders.branchId, branchIds), eq(s.orders.businessDate, d), ne(s.orders.status, "voided"), ne(s.orders.status, "held"));
  const [today, yesterday, lastWeek] = await Promise.all([date, addDays(date, -1), addDays(date, -7)].map((d) => db.select().from(s.orders).where(live(d))));
  const ids = today.map((o) => o.id);
  const [items, pays, stock, pendingPay, held, openDel] = await Promise.all([
    ids.length ? db.select().from(s.orderItems).where(and(inArray(s.orderItems.orderId, ids), eq(s.orderItems.isVoided, false))) : Promise.resolve([]),
    ids.length ? db.select().from(s.payments).where(inArray(s.payments.orderId, ids)) : Promise.resolve([]),
    db.select().from(s.ingredientStock).where(inArray(s.ingredientStock.branchId, branchIds)),
    db.select({ id: s.payments.id }).from(s.payments).where(and(inArray(s.payments.branchId, branchIds), eq(s.payments.status, "pending_verification"))),
    db.select({ id: s.orders.id }).from(s.orders).where(and(inArray(s.orders.branchId, branchIds), eq(s.orders.status, "held"))),
    db.select({ id: s.deliveries.id }).from(s.deliveries).where(and(inArray(s.deliveries.branchId, branchIds), inArray(s.deliveries.status, ["unassigned", "assigned", "picked"]))),
  ]);
  const sales = sum(today.map((o) => o.total));
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h % 12 || 12}${h < 12 ? "a" : "p"}`, sales: 0, orders: 0 }));
  for (const o of today) { const b = byHour[hourOf(o.createdAt)]; b.sales += o.total; b.orders += 1; }
  const first = byHour.findIndex((b) => b.orders), last = byHour.findLastIndex((b) => b.orders);
  const hours = first < 0 ? byHour.slice(10, 23) : byHour.slice(Math.max(0, Math.min(first, 10)), Math.min(24, Math.max(last, 22) + 1));

  const names = [...new Set(items.map((i) => i.nameSnapshot))];
  const top = names.map((n) => ({ name: n, qty: sum(items.filter((i) => i.nameSnapshot === n).map((i) => i.quantity)), revenue: sum(items.filter((i) => i.nameSnapshot === n).map((i) => i.lineTotal)) })).sort((a, b) => b.qty - a.qty).slice(0, 8);
  const methods = [...new Set(pays.map((p) => p.method))].map((m) => ({ name: m.replace("_", " "), value: sum(pays.filter((p) => p.method === m && p.status !== "refunded").map((p) => p.amount)) })).filter((m) => m.value > 0).sort((a, b) => b.value - a.value);
  const types = [...new Set(today.map((o) => o.type))].map((t) => ({ name: t.replace("_", " "), value: sum(today.filter((o) => o.type === t).map((o) => o.total)), orders: today.filter((o) => o.type === t).length })).sort((a, b) => b.value - a.value);
  return {
    sales, orders: today.length, aov: today.length ? Math.round(sales / today.length) : 0, tax: sum(today.map((o) => o.taxTotal)),
    yesterday: sum(yesterday.map((o) => o.total)), lastWeek: sum(lastWeek.map((o) => o.total)),
    hours, top, methods, types,
    alerts: { lowStock: stock.filter((x) => Number(x.quantity) <= Number(x.reorderLevel)).length, pendingPayments: pendingPay.length, held: held.length, openDeliveries: openDel.length },
  };
}
