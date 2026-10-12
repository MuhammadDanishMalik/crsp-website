import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

export async function getOpenShift(terminalId: string | null, staffId: string) {
  if (!terminalId) return null;
  const db = await getDb();
  const [shift] = await db.select().from(s.shifts)
    .where(and(eq(s.shifts.terminalId, terminalId), eq(s.shifts.staffId, staffId), eq(s.shifts.status, "open"))).limit(1);
  return shift ?? null;
}

/** Totals for an X/Z report of one shift. */
export async function shiftSummary(shiftId: string) {
  const db = await getDb();
  const [shift] = await db.select().from(s.shifts).where(eq(s.shifts.id, shiftId));
  const pay = await db
    .select({ method: s.payments.method, status: s.payments.status, total: sql<number>`coalesce(sum(${s.payments.amount}),0)::int`, n: sql<number>`count(*)::int` })
    .from(s.payments).where(eq(s.payments.shiftId, shiftId)).groupBy(s.payments.method, s.payments.status);
  const [ord] = await db
    .select({ n: sql<number>`count(*)::int`, sales: sql<number>`coalesce(sum(${s.orders.total}),0)::int`, disc: sql<number>`coalesce(sum(${s.orders.discountTotal}),0)::int`, tax: sql<number>`coalesce(sum(${s.orders.taxTotal}),0)::int` })
    .from(s.orders).where(and(eq(s.orders.shiftId, shiftId), sql`${s.orders.status} <> 'voided'`));
  const moves = await db.select().from(s.cashMovements).where(eq(s.cashMovements.shiftId, shiftId));
  const refundRows = await db.select({ method: s.refunds.method, total: sql<number>`coalesce(sum(${s.refunds.amount}),0)::int` }).from(s.refunds).where(eq(s.refunds.shiftId, shiftId)).groupBy(s.refunds.method);
  const refundTotal = refundRows.reduce((a, r) => a + r.total, 0);
  const cashRefunds = refundRows.filter((r) => r.method === "cash").reduce((a, r) => a + r.total, 0);
  const cashSales = pay.filter((p) => p.method === "cash").reduce((a, p) => a + p.total, 0);
  const cashIn = moves.filter((m) => m.type === "cash_in").reduce((a, m) => a + m.amount, 0);
  const cashOut = moves.filter((m) => m.type === "cash_out" || m.type === "drop").reduce((a, m) => a + m.amount, 0);
  const expectedCash = (shift?.openingFloat ?? 0) + cashSales + cashIn - cashOut - cashRefunds;
  return { shift, refundTotal, cashRefunds, orders: ord, byMethod: pay, cashSales, cashIn, cashOut, expectedCash, moves };
}
