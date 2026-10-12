import { getSession } from "@/lib/auth/session";
import { csvEscape } from "@/lib/domain/payroll";
import { loadPayroll } from "@/lib/queries/people";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.can("payroll.export")) return new Response("Forbidden", { status: 403 });
  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Bad month", { status: 400 });
  const rows = await loadPayroll(session.branchId, month);
  const rs = (p: number) => (p / 100).toFixed(2);
  const lines = [["Name", "Role", "Pay type", "Days worked", "Hours", "Late", "Absent", "Gross (Rs)", "Bonus (Rs)", "Advances (Rs)", "Deductions (Rs)", "Net (Rs)"].join(",")];
  for (const r of rows) lines.push([r.name, r.role, r.salaryType, r.daysWorked, (r.minutesWorked / 60).toFixed(1), r.lateCount, r.absentCount, rs(r.gross), rs(r.bonuses ?? 0), rs(r.advances), rs(r.deductions), rs(r.net)].map(csvEscape).join(","));
  return new Response("﻿" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payroll-${month}.csv"` } });
}
