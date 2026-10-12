"use server";

import bcrypt from "bcryptjs";
import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { guard, UserError, type R } from "./_guard";

const reval = () => { revalidatePath("/admin/staff"); revalidatePath("/admin/attendance"); };

/** PINs are the only identifier on a POS terminal, so two staff at the same branch must never share one. */
async function pinTaken(pin: string, branchIds: string[], exceptStaffId?: string) {
  const db = await getDb();
  const links = await db.select().from(s.staffBranches).where(inArray(s.staffBranches.branchId, branchIds));
  const ids = [...new Set(links.map((l) => l.staffId))].filter((i) => i !== exceptStaffId);
  if (!ids.length) return false;
  const others = await db.select({ h: s.staff.pinHash }).from(s.staff).where(and(inArray(s.staff.id, ids), eq(s.staff.isActive, true)));
  for (const o of others) if (o.h && (await bcrypt.compare(pin, o.h))) return true;
  return false;
}

export async function saveStaff(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("staff.manage");
    const v = z.object({
      id: z.string().uuid().optional(), fullName: z.string().trim().min(2, "Enter the full name").max(80), roleId: z.string().uuid("Choose a role"),
      phone: z.string().trim().max(30).optional(), cnic: z.string().trim().regex(/^(\d{5}-?\d{7}-?\d)?$/, "CNIC looks wrong (13 digits)").optional(),
      email: z.string().trim().email("Email looks wrong").optional().or(z.literal("")), password: z.string().min(8, "Password needs 8+ characters").optional().or(z.literal("")),
      pin: z.string().regex(/^(\d{4,6})?$/, "PIN must be 4–6 digits").optional(), photoUrl: z.string().max(200).optional(),
      salaryType: z.enum(["monthly", "hourly"]), salaryRupees: z.number().min(0), branchIds: z.array(z.string().uuid()).min(1, "Choose at least one branch"),
    }).parse(raw);
    const db = await getDb();
    const [role] = await db.select().from(s.roles).where(eq(s.roles.id, v.roleId));
    if (role?.key === "owner" && session.roleKey !== "owner") throw new UserError("Only the owner can create another owner");
    if (v.id && v.pin && !session.can("staff.set_pin")) throw new UserError("Missing permission: staff.set_pin");
    if (v.pin && (await pinTaken(v.pin, v.branchIds, v.id))) throw new UserError("That PIN is already used by someone at this branch");
    if (v.email) {
      const [dup] = await db.select({ id: s.staff.id }).from(s.staff).where(v.id ? and(eq(s.staff.email, v.email.toLowerCase()), ne(s.staff.id, v.id)) : eq(s.staff.email, v.email.toLowerCase()));
      if (dup) throw new UserError("That email is already in use");
    }
    if (!v.id && !v.pin && !v.password) throw new UserError("Set a PIN (POS) or a password (back office)");

    const values: Partial<typeof s.staff.$inferInsert> = {
      fullName: v.fullName, roleId: v.roleId, phone: v.phone || null, cnic: v.cnic || null, email: v.email ? v.email.toLowerCase() : null,
      photoUrl: v.photoUrl || null, updatedAt: new Date(),
    };
    // Salary is only touched by people allowed to see it
    if (session.can("staff.salary_view")) { values.salaryType = v.salaryType; values.salaryAmount = Math.round(v.salaryRupees * 100); }
    if (v.pin) values.pinHash = await bcrypt.hash(v.pin, 10);
    if (v.password) values.passwordHash = await bcrypt.hash(v.password, 10);

    let id = v.id;
    await db.transaction(async (tx) => {
      if (id) await tx.update(s.staff).set(values).where(eq(s.staff.id, id));
      else { const [b] = await tx.select().from(s.business).limit(1); [{ id }] = await tx.insert(s.staff).values({ ...(values as typeof s.staff.$inferInsert), businessId: b.id }).returning({ id: s.staff.id }); }
      await tx.delete(s.staffBranches).where(eq(s.staffBranches.staffId, id!));
      await tx.insert(s.staffBranches).values(v.branchIds.map((branchId) => ({ staffId: id!, branchId })));
    });
    await audit(session, { action: v.id ? "staff.update" : "staff.create", entity: "staff", entityId: id, after: { ...values, pinHash: undefined, passwordHash: undefined, pinChanged: !!v.pin, passwordChanged: !!v.password } });
    reval();
    return { ok: true };
  });
}

export async function setStaffActive(id: string, active: boolean): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("staff.manage");
    if (id === session.staffId && !active) throw new UserError("You cannot deactivate yourself");
    const db = await getDb();
    await db.update(s.staff).set({ isActive: active }).where(eq(s.staff.id, id));
    await audit(session, { action: active ? "staff.activate" : "staff.deactivate", entity: "staff", entityId: id });
    reval();
    return { ok: true };
  });
}

export async function addPayrollAdjustment(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("attendance.manage");
    const v = z.object({ staffId: z.string().uuid(), kind: z.enum(["advance", "deduction", "bonus"]), amountRupees: z.number().positive("Enter an amount"), month: z.string().regex(/^\d{4}-\d{2}$/), note: z.string().max(120).optional() }).parse(raw);
    const db = await getDb();
    await db.insert(s.payrollAdjustments).values({ staffId: v.staffId, branchId: session.branchId, kind: v.kind, amount: Math.round(v.amountRupees * 100), forMonth: `${v.month}-01`, note: v.note });
    await audit(session, { action: "payroll.adjustment", entity: "staff", entityId: v.staffId, after: v });
    reval();
    return { ok: true };
  });
}
