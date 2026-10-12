"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { getTerminalClaims, requirePermission } from "@/lib/auth/session";
import { businessDate } from "@/lib/domain/dates";
import { lateMinutes } from "@/lib/domain/payroll";
import { guard, UserError, type R } from "./_guard";

const tries = new Map<string, { n: number; until: number }>();

const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const weekday = (d: Date) => ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "short" }).format(d)];

/** Clock in / out with a PIN on a registered terminal (no POS login needed). Toggles based on the open record. */
export async function clockWithPin(pin: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const term = await getTerminalClaims();
  if (!term) return { ok: false, error: "This device is not registered" };
  const t = tries.get(term.tid);
  if (t && t.until > Date.now()) return { ok: false, error: "Too many attempts. Wait a moment" };
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "PIN must be 4–6 digits" };
  const db = await getDb();
  const links = await db.select({ id: s.staffBranches.staffId }).from(s.staffBranches).where(eq(s.staffBranches.branchId, term.bid));
  const staff = links.length ? await db.select().from(s.staff).where(and(eq(s.staff.isActive, true), inArray(s.staff.id, links.map((l) => l.id)))) : [];
  let who: (typeof staff)[number] | undefined;
  for (const st of staff) if (st.pinHash && (await bcrypt.compare(pin, st.pinHash))) { who = st; break; }
  if (!who) {
    const n = (t?.n ?? 0) + 1;
    tries.set(term.tid, { n: n >= 5 ? 0 : n, until: n >= 5 ? Date.now() + 30_000 : 0 });
    return { ok: false, error: "Wrong PIN" };
  }
  tries.delete(term.tid);
  const perms = await db.select({ p: s.rolePermissions.permission }).from(s.rolePermissions).where(eq(s.rolePermissions.roleId, who.roleId));
  if (!perms.some((p) => p.p === "attendance.clock")) return { ok: false, error: "Your role does not clock in" };

  const now = new Date();
  const [open] = await db.select().from(s.attendance).where(and(eq(s.attendance.staffId, who.id), eq(s.attendance.branchId, term.bid), isNull(s.attendance.clockOut)));
  if (open && open.clockIn) {
    const mins = Math.max(0, Math.round((now.getTime() - open.clockIn.getTime()) / 60000));
    await db.update(s.attendance).set({ clockOut: now, minutesWorked: mins }).where(eq(s.attendance.id, open.id));
    return { ok: true, message: `${who.fullName} clocked OUT at ${hhmm(now)} (${Math.floor(mins / 60)}h ${mins % 60}m)` };
  }
  const [sched] = await db.select().from(s.shiftSchedules).where(and(eq(s.shiftSchedules.staffId, who.id), eq(s.shiftSchedules.branchId, term.bid), eq(s.shiftSchedules.weekday, weekday(now))));
  const late = sched ? lateMinutes(String(sched.startsAt), hhmm(now)) : 0;
  await db.insert(s.attendance).values({ branchId: term.bid, staffId: who.id, workDate: businessDate(now), clockIn: now, status: late ? "late" : "present", terminalId: term.tid, note: late ? `${late} min late` : null });
  return { ok: true, message: `${who.fullName} clocked IN at ${hhmm(now)}${late ? ` — ${late} min late` : ""}` };
}

export async function saveSchedule(staffId: string, days: { weekday: number; start: string; end: string }[]): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("attendance.manage");
    const v = z.array(z.object({ weekday: z.number().int().min(0).max(6), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })).parse(days);
    if (v.some((d) => d.end <= d.start)) throw new UserError("End time must be after start time");
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.delete(s.shiftSchedules).where(and(eq(s.shiftSchedules.staffId, staffId), eq(s.shiftSchedules.branchId, session.branchId)));
      if (v.length) await tx.insert(s.shiftSchedules).values(v.map((d) => ({ branchId: session.branchId, staffId, weekday: d.weekday, startsAt: d.start, endsAt: d.end })));
    });
    await audit(session, { action: "attendance.schedule", entity: "staff", entityId: staffId, after: v });
    revalidatePath("/admin/attendance");
    return { ok: true };
  });
}

/** Fix or add an attendance record by hand (manager). */
export async function editAttendance(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("attendance.manage");
    const v = z.object({
      id: z.string().uuid().optional(), staffId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(["present", "late", "absent", "leave"]), clockIn: z.string().regex(/^\d{2}:\d{2}$/).optional(), clockOut: z.string().regex(/^\d{2}:\d{2}$/).optional(), note: z.string().max(120).optional(),
    }).parse(raw);
    const at = (hm?: string) => (hm ? new Date(`${v.date}T${hm}:00+05:00`) : null);
    const cin = at(v.clockIn), cout = at(v.clockOut);
    if (cin && cout && cout <= cin) throw new UserError("Clock-out must be after clock-in");
    const values = { status: v.status, clockIn: cin, clockOut: cout, minutesWorked: cin && cout ? Math.round((cout.getTime() - cin.getTime()) / 60000) : null, note: v.note };
    const db = await getDb();
    if (v.id) await db.update(s.attendance).set(values).where(and(eq(s.attendance.id, v.id), eq(s.attendance.branchId, session.branchId)));
    else await db.insert(s.attendance).values({ ...values, branchId: session.branchId, staffId: v.staffId, workDate: v.date });
    await audit(session, { action: "attendance.edit", entity: "attendance", entityId: v.id, after: v });
    revalidatePath("/admin/attendance");
    return { ok: true };
  });
}
