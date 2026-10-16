import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Sadqa set aside per day (from live, non-voided orders) and what has been given out, for a date range. */
export async function loadSadqa(branchIds: string[], from: string, to: string) {
  const db = await getDb();
  const orders = await db.select({ id: s.orders.id, d: s.orders.businessDate }).from(s.orders)
    .where(and(inArray(s.orders.branchId, branchIds), gte(s.orders.businessDate, from), lte(s.orders.businessDate, to), ne(s.orders.status, "voided"), ne(s.orders.status, "held")));
  const items = orders.length ? await db.select().from(s.orderItems).where(and(inArray(s.orderItems.orderId, orders.map((o) => o.id)), eq(s.orderItems.isVoided, false))) : [];
  const dayOf = new Map(orders.map((o) => [o.id, o.d]));
  const sadqaItems = items.filter((i) => i.sadqaAmount > 0);
  const days = [...new Set(sadqaItems.map((i) => dayOf.get(i.orderId)!))].sort().reverse().map((d) => {
    const m = sadqaItems.filter((i) => dayOf.get(i.orderId) === d);
    return { date: d, units: sum(m.map((i) => i.quantity)), sales: sum(m.map((i) => i.lineTotal)), amount: sum(m.map((i) => i.sadqaAmount)), byItem: [...new Set(m.map((i) => i.nameSnapshot))].map((n) => ({ name: n, qty: sum(m.filter((i) => i.nameSnapshot === n).map((i) => i.quantity)), amount: sum(m.filter((i) => i.nameSnapshot === n).map((i) => i.sadqaAmount)) })) };
  });
  const given = await db.select().from(s.sadqaGiven).where(and(inArray(s.sadqaGiven.branchId, branchIds), gte(s.sadqaGiven.givenOn, from), lte(s.sadqaGiven.givenOn, to))).orderBy(desc(s.sadqaGiven.givenOn));
  return { days, given: given.map((g) => ({ id: g.id, date: g.givenOn, amount: g.amount, note: g.note ?? "" })), totalSet: sum(days.map((d) => d.amount)), totalGiven: sum(given.map((g) => g.amount)) };
}

/** Everything ever set aside minus everything ever given: the sadqa still owed. */
export async function sadqaBalance(branchIds: string[]) {
  const db = await getDb();
  const [all, given] = await Promise.all([
    db.select({ id: s.orders.id }).from(s.orders).where(and(inArray(s.orders.branchId, branchIds), ne(s.orders.status, "voided"), ne(s.orders.status, "held"))),
    db.select().from(s.sadqaGiven).where(inArray(s.sadqaGiven.branchId, branchIds)),
  ]);
  const items = all.length ? await db.select({ a: s.orderItems.sadqaAmount }).from(s.orderItems).where(and(inArray(s.orderItems.orderId, all.map((o) => o.id)), eq(s.orderItems.isVoided, false))) : [];
  const set = sum(items.map((i) => i.a)), g = sum(given.map((x) => x.amount));
  return { set, given: g, owed: set - g };
}

export async function loadSadqaRules() {
  const db = await getDb();
  const [rules, items] = await Promise.all([db.select().from(s.sadqaRules), db.select({ id: s.menuItems.id, name: s.menuItems.name, price: s.menuItems.basePrice, active: s.menuItems.isActive }).from(s.menuItems).orderBy(asc(s.menuItems.sortOrder))]);
  return { rules: rules.map((r) => ({ id: r.id, itemId: r.itemId, name: items.find((i) => i.id === r.itemId)?.name ?? "", price: items.find((i) => i.id === r.itemId)?.price ?? 0, percent: r.percentBps / 100, active: r.isActive })), items: items.filter((i) => i.active).map((i) => ({ id: i.id, name: i.name })) };
}
