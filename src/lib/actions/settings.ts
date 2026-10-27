"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { PermissionError, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS, type Permission } from "@/lib/domain/permissions";
import { providersFor, type PayMethod } from "@/lib/adapters/payments";

type R = { ok: true; message?: string } | { ok: false; error: string };
async function guard(fn: () => Promise<R>): Promise<R> {
  try { return await fn(); } catch (e) {
    if (e instanceof PermissionError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function setPaymentMethodEnabled(method: string, enabled: boolean): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.payment_methods");
    const m = z.enum(["cash", "card", "jazzcash", "easypaisa", "raast", "bank_transfer", "credit_account", "voucher"]).parse(method);
    const db = await getDb();
    await db.insert(s.paymentMethodSettings).values({ branchId: session.branchId, method: m, isEnabled: enabled })
      .onConflictDoUpdate({ target: [s.paymentMethodSettings.branchId, s.paymentMethodSettings.method], set: { isEnabled: enabled } });
    await audit(session, { action: "settings.payment_method", entity: "payment_method", entityId: m, after: { enabled } });
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}

export async function saveTaxRule(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.tax");
    const v = z.object({
      id: z.string().uuid().optional(), name: z.string().trim().min(1).max(60), ratePercent: z.number().min(0).max(100),
      orderTypes: z.array(z.string()), paymentMethods: z.array(z.string()), isInclusive: z.boolean(), isActive: z.boolean(),
    }).parse(raw);
    const db = await getDb();
    const values = { name: v.name, rateBps: Math.round(v.ratePercent * 100), appliesToOrderTypes: v.orderTypes, appliesToPaymentMethods: v.paymentMethods, isInclusive: v.isInclusive, isActive: v.isActive };
    if (v.id) {
      const [before] = await db.select().from(s.taxRules).where(eq(s.taxRules.id, v.id));
      await db.update(s.taxRules).set(values).where(eq(s.taxRules.id, v.id));
      await audit(session, { action: "settings.tax.update", entity: "tax_rule", entityId: v.id, before, after: values });
    } else {
      const [r] = await db.insert(s.taxRules).values(values).returning();
      await audit(session, { action: "settings.tax.create", entity: "tax_rule", entityId: r.id, after: values });
    }
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}

export async function createTerminal(name: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.terminals");
    const n = z.string().trim().min(1, "Name is required").max(40).parse(name);
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
    const db = await getDb();
    const taken = new Set((await db.select({ p: s.terminals.orderNoPrefix }).from(s.terminals)).map((x) => x.p));
    const prefix = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("").find((c) => !taken.has(c)) ?? "Z"; // offline receipts: A001, B001 … never collide across terminals
    const [t] = await db.insert(s.terminals).values({ branchId: session.branchId, name: n, orderNoPrefix: prefix, deviceKeyHash: await bcrypt.hash(code, 10) }).returning();
    await audit(session, { action: "settings.terminal.create", entity: "terminal", entityId: t.id, after: { name: n } });
    revalidatePath("/admin/settings");
    return { ok: true, message: `Terminal code for ${n}: ${code} — shown once, enter it on the device at /terminal` };
  });
}

export async function setRolePermission(roleId: string, permission: string, granted: boolean): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("role.manage");
    if (!(permission in PERMISSIONS)) return { ok: false, error: "Unknown permission" };
    const db = await getDb();
    const [role] = await db.select().from(s.roles).where(eq(s.roles.id, roleId));
    if (!role) return { ok: false, error: "Role not found" };
    if (role.key === "owner") return { ok: false, error: "The owner role always has every permission" };
    if (granted) await db.insert(s.rolePermissions).values({ roleId, permission }).onConflictDoNothing();
    else await db.delete(s.rolePermissions).where(and(eq(s.rolePermissions.roleId, roleId), eq(s.rolePermissions.permission, permission as Permission)));
    await audit(session, { action: "role.permission", entity: "role", entityId: roleId, after: { permission, granted } });
    revalidatePath("/admin/roles");
    return { ok: true };
  });
}

export async function setDiscountLimit(roleId: string, percent: number): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("role.manage");
    const bpsValue = Math.round(z.number().min(0).max(100).parse(percent) * 100);
    const db = await getDb();
    await db.update(s.roles).set({ discountLimitBps: bpsValue }).where(eq(s.roles.id, roleId));
    await audit(session, { action: "role.discount_limit", entity: "role", entityId: roleId, after: { bps: bpsValue } });
    revalidatePath("/admin/roles");
    return { ok: true };
  });
}

export async function setPaymentMethodProvider(method: string, providerId: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.payment_methods");
    const m = z.enum(["cash", "card", "jazzcash", "easypaisa", "raast", "bank_transfer"]).parse(method);
    if (!providersFor(m as PayMethod).some((p) => p.id === providerId)) return { ok: false, error: "That provider does not handle this payment method" };
    const db = await getDb();
    await db.update(s.paymentMethodSettings).set({ provider: providerId }).where(and(eq(s.paymentMethodSettings.branchId, session.branchId), eq(s.paymentMethodSettings.method, m)));
    await audit(session, { action: "settings.payment_provider", entity: "payment_method", entityId: m, after: { providerId } });
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}

async function mergeBusinessSettings(patch: Record<string, unknown>, columns: Partial<typeof s.business.$inferInsert> = {}) {
  const db = await getDb();
  const [b] = await db.select().from(s.business).limit(1);
  await db.update(s.business).set({ ...columns, settings: { ...(b.settings as object), ...patch } }).where(eq(s.business.id, b.id));
  return b;
}

export async function saveBusiness(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.business");
    const v = z.object({ name: z.string().trim().min(1, "Business name is required").max(80), ntn: z.string().trim().max(30).optional(), strn: z.string().trim().max(30).optional(), serviceChargePercent: z.number().min(0).max(30), lockMinutes: z.number().int().min(1).max(120) }).parse(raw);
    const before = await mergeBusinessSettings({ serviceChargeBps: Math.round(v.serviceChargePercent * 100), lockMinutes: v.lockMinutes }, { name: v.name, ntn: v.ntn || null, strn: v.strn || null });
    await audit(session, { action: "settings.business", entity: "business", before: { name: before.name, ntn: before.ntn, settings: before.settings }, after: v });
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}

export async function setWebsiteOrdering(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.business");
    const v = z.object({ open: z.boolean(), message: z.string().trim().max(240) }).parse(raw);
    await mergeBusinessSettings({ websiteOrdersOpen: v.open, websiteClosedMessage: v.message });
    await audit(session, { action: "settings.website_ordering", entity: "business", after: v });
    revalidatePath("/admin/settings");
    revalidatePath("/");
    return { ok: true, message: v.open ? "Website is now taking orders" : "Website orders are switched off" };
  });
}

export async function saveReceiptText(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.receipt");
    const v = z.object({ header: z.string().trim().max(120), footer: z.string().trim().max(160), footerUr: z.string().trim().max(160) }).parse(raw);
    await mergeBusinessSettings({ receiptHeader: v.header, receiptFooter: v.footer, receiptFooterUr: v.footerUr });
    await audit(session, { action: "settings.receipt", entity: "business", after: v });
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}
