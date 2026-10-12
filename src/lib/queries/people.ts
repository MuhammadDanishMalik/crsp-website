import "server-only";
import { and, eq, gte, inArray, lt, lte, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { computePayroll, type PayrollRow } from "@/lib/domain/payroll";

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from: `${month}-01`, to: next };
};

export async function loadPayroll(branchId: string, month: string): Promise<(PayrollRow & { staffId: string; name: string; role: string })[]> {
  const db = await getDb();
  const { from, to } = monthRange(month);
  const links = await db.select().from(s.staffBranches).where(eq(s.staffBranches.branchId, branchId));
  if (!links.length) return [];
  const ids = links.map((l) => l.staffId);
  const [staff, roles, att, adj] = await Promise.all([
    db.select().from(s.staff).where(inArray(s.staff.id, ids)),
    db.select().from(s.roles),
    db.select().from(s.attendance).where(and(eq(s.attendance.branchId, branchId), gte(s.attendance.workDate, from), lt(s.attendance.workDate, to))),
    db.select().from(s.payrollAdjustments).where(and(eq(s.payrollAdjustments.branchId, branchId), gte(s.payrollAdjustments.forMonth, from), lt(s.payrollAdjustments.forMonth, to))),
  ]);
  return staff.filter((st) => st.isActive).map((st) => {
    const a = att.filter((x) => x.staffId === st.id);
    const days = new Set(a.filter((x) => x.status === "present" || x.status === "late").map((x) => x.workDate)).size;
    const sum = (k: string) => adj.filter((x) => x.staffId === st.id && x.kind === k).reduce((n, x) => n + x.amount, 0);
    const row = computePayroll({
      salaryType: st.salaryType, salaryAmount: st.salaryAmount, daysWorked: days, minutesWorked: a.reduce((n, x) => n + (x.minutesWorked ?? 0), 0),
      lateCount: a.filter((x) => x.status === "late").length, absentCount: a.filter((x) => x.status === "absent").length,
      advances: sum("advance"), deductions: sum("deduction"), bonuses: sum("bonus"),
    });
    return { ...row, staffId: st.id, name: st.fullName, role: roles.find((r) => r.id === st.roleId)?.name ?? "" };
  });
}

export async function loadPerformance(branchId: string, from: string, to: string) {
  const db = await getDb();
  const orders = await db.select().from(s.orders).where(and(eq(s.orders.branchId, branchId), gte(s.orders.businessDate, from), lte(s.orders.businessDate, to), ne(s.orders.status, "held")));
  const staffIds = [...new Set(orders.map((o) => o.createdBy))];
  const names = staffIds.length ? await db.select({ id: s.staff.id, n: s.staff.fullName }).from(s.staff).where(inArray(s.staff.id, staffIds)) : [];
  return staffIds.map((id) => {
    const mine = orders.filter((o) => o.createdBy === id);
    const live = mine.filter((o) => o.status !== "voided");
    const timed = live.filter((o) => o.readyAt).map((o) => (o.readyAt!.getTime() - o.createdAt.getTime()) / 60000);
    return {
      staffId: id, name: names.find((x) => x.id === id)?.n ?? "—", orders: live.length, sales: live.reduce((a, o) => a + o.total, 0),
      voids: mine.filter((o) => o.status === "voided").length, voidValue: mine.filter((o) => o.status === "voided").reduce((a, o) => a + o.total, 0),
      discounts: live.reduce((a, o) => a + o.discountTotal, 0), avgMinutes: timed.length ? Math.round((timed.reduce((a, b) => a + b, 0) / timed.length) * 10) / 10 : null,
    };
  }).sort((a, b) => b.sales - a.sales);
}

