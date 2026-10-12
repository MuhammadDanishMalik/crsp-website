import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { businessDate } from "@/lib/domain/dates";
import { loadPayroll, loadPerformance } from "@/lib/queries/people";
import { PayrollView } from "./payroll-view";

export default async function PayrollPage({ searchParams }: PageProps<"/admin/payroll">) {
  const session = await requireSession({ kind: "admin" });
  const sp = await searchParams;
  const today = businessDate();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const from = typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = typeof sp.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;
  const canPayroll = session.can("payroll.export") || session.can("staff.salary_view");
  const [payroll, perf] = await Promise.all([
    canPayroll ? loadPayroll(session.branchId, month) : Promise.resolve([]),
    session.can("report.staff") ? loadPerformance(session.branchId, from, to) : Promise.resolve([]),
  ]);
  return (
    <div className="max-w-6xl">
      <div className="mb-4 flex items-center"><h1 className="text-3xl font-bold">Payroll & performance</h1><Link href="/admin/attendance" className="ml-auto text-sm underline">← Attendance</Link></div>
      <PayrollView month={month} from={from} to={to} payroll={payroll} perf={perf} can={{ payroll: canPayroll, export: session.can("payroll.export"), adjust: session.can("attendance.manage"), perf: session.can("report.staff") }} />
    </div>
  );
}
