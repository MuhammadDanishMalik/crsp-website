import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { businessDate } from "@/lib/domain/dates";
import { AttendanceBoard } from "./attendance-board";

export default async function AttendancePage({ searchParams }: PageProps<"/admin/attendance">) {
  const session = await requireSession({ permission: "attendance.manage", kind: "admin" });
  const sp = await searchParams;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : businessDate();
  const db = await getDb();
  const links = await db.select().from(s.staffBranches).where(eq(s.staffBranches.branchId, session.branchId));
  const ids = links.map((l) => l.staffId);
  const [staff, att, sched] = ids.length ? await Promise.all([
    db.select().from(s.staff).where(and(inArray(s.staff.id, ids), eq(s.staff.isActive, true))),
    db.select().from(s.attendance).where(and(eq(s.attendance.branchId, session.branchId), eq(s.attendance.workDate, date))),
    db.select().from(s.shiftSchedules).where(eq(s.shiftSchedules.branchId, session.branchId)),
  ]) : [[], [], []];
  const wd = new Date(`${date}T12:00:00+05:00`).getUTCDay();
  const hm = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: false }).format(d) : "");
  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-center gap-4"><h1 className="text-3xl font-bold">Attendance & schedules</h1>
        <Link href="/admin/payroll" className="ml-auto text-sm underline">Payroll & performance →</Link></div>
      <AttendanceBoard
        date={date}
        rows={staff.map((st) => {
          const a = att.filter((x) => x.staffId === st.id);
          const todays = sched.find((x) => x.staffId === st.id && x.weekday === wd);
          return {
            staffId: st.id, name: st.fullName, scheduled: todays ? `${String(todays.startsAt).slice(0, 5)}–${String(todays.endsAt).slice(0, 5)}` : "", expected: !!todays,
            records: a.map((r) => ({ id: r.id, status: r.status, clockIn: hm(r.clockIn), clockOut: hm(r.clockOut), minutes: r.minutesWorked, note: r.note ?? "" })),
          };
        })}
        schedules={Object.fromEntries(staff.map((st) => [st.id, sched.filter((x) => x.staffId === st.id).map((x) => ({ weekday: x.weekday, start: String(x.startsAt).slice(0, 5), end: String(x.endsAt).slice(0, 5) }))]))}
      />
    </div>
  );
}
