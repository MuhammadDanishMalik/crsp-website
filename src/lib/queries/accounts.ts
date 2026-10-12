import "server-only";
import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

/** Simple P&L for a date range: sales (ex-tax) − refunds − food cost − expenses. */
export async function loadPnl(branchId: string, from: string, to: string) {
  const db = await getDb();
  const live = and(eq(s.orders.branchId, branchId), gte(s.orders.businessDate, from), lte(s.orders.businessDate, to), ne(s.orders.status, "voided"), ne(s.orders.status, "held"));
  const [[sales], [cost], refundRows, expenses, cats] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`, gross: sql<number>`coalesce(sum(${s.orders.total}),0)::int`, tax: sql<number>`coalesce(sum(${s.orders.taxTotal}),0)::int`, discount: sql<number>`coalesce(sum(${s.orders.discountTotal}),0)::int` }).from(s.orders).where(live),
    db.select({ c: sql<number>`coalesce(sum(${s.orderItems.costSnapshot} * ${s.orderItems.quantity}),0)::int` }).from(s.orderItems).innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId)).where(and(live, eq(s.orderItems.isVoided, false))),
    db.select({ amount: s.refunds.amount, kind: s.refunds.kind, at: s.refunds.createdAt }).from(s.refunds).innerJoin(s.orders, eq(s.orders.id, s.refunds.orderId)).where(and(eq(s.orders.branchId, branchId), gte(s.orders.businessDate, from), lte(s.orders.businessDate, to), eq(s.refunds.kind, "refund"))),
    db.select().from(s.expenses).where(and(eq(s.expenses.branchId, branchId), gte(s.expenses.expenseDate, from), lte(s.expenses.expenseDate, to))),
    db.select().from(s.expenseCategories),
  ]);
  const refunded = refundRows.reduce((a, r) => a + r.amount, 0);
  const revenue = sales.gross - sales.tax - refunded; // tax collected is not income
  const byCat = cats.map((c) => ({ name: c.name, total: expenses.filter((e) => e.categoryId === c.id).reduce((a, e) => a + e.amount, 0) })).filter((c) => c.total > 0);
  const expenseTotal = byCat.reduce((a, c) => a + c.total, 0);
  const gross = revenue - cost.c;
  return { orders: sales.n, gross: sales.gross, tax: sales.tax, discount: sales.discount, refunded, revenue, foodCost: cost.c, grossProfit: gross, expenses: byCat, expenseTotal, net: gross - expenseTotal, foodCostPct: revenue > 0 ? Math.round((cost.c / revenue) * 1000) / 10 : 0 };
}

/** End-of-day cash position for one business date. */
export async function loadDayEnd(branchId: string, date: string) {
  const db = await getDb();
  const orders = await db.select({ id: s.orders.id }).from(s.orders).where(and(eq(s.orders.branchId, branchId), eq(s.orders.businessDate, date)));
  const ids = orders.map((o) => o.id);
  const [pays, refunds, exps, deposits, supplierCash] = await Promise.all([
    ids.length ? db.select().from(s.payments).where(inArray(s.payments.orderId, ids)) : Promise.resolve([]),
    ids.length ? db.select().from(s.refunds).where(inArray(s.refunds.orderId, ids)) : Promise.resolve([]),
    db.select().from(s.expenses).where(and(eq(s.expenses.branchId, branchId), eq(s.expenses.expenseDate, date))),
    db.select().from(s.bankDeposits).where(and(eq(s.bankDeposits.branchId, branchId), eq(s.bankDeposits.depositDate, date))),
    db.select().from(s.supplierPayments).where(and(eq(s.supplierPayments.branchId, branchId), eq(s.supplierPayments.method, "cash"), eq(s.supplierPayments.paidFromDrawer, false), gte(s.supplierPayments.createdAt, new Date(`${date}T00:00:00+05:00`)), lte(s.supplierPayments.createdAt, new Date(`${date}T23:59:59+05:00`)))),
  ]);
  const byMethod: Record<string, number> = {};
  for (const p of pays) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  const cashSales = byMethod.cash ?? 0;
  const cashRefunds = refunds.filter((r) => r.method === "cash").reduce((a, r) => a + r.amount, 0);
  const cashExpenses = exps.filter((e) => e.paymentSource === "cash").reduce((a, e) => a + e.amount, 0);
  const cashSuppliers = supplierCash.reduce((a, p) => a + p.amount, 0);
  const deposited = deposits.reduce((a, d) => a + d.amount, 0);
  return { byMethod, cashSales, cashRefunds, cashExpenses, cashSuppliers, deposited, deposits, cashAvailable: cashSales - cashRefunds - cashExpenses - cashSuppliers - deposited };
}
