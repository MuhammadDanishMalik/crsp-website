"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { guard, UserError, type R } from "./_guard";

const reval = () => revalidatePath("/admin/customers");
const phone = z.string().trim().transform((v) => v.replace(/[^\d+]/g, "")).refine((v) => v.length >= 7 && v.length <= 15, "Phone number looks wrong");

export async function saveCustomer(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("customer.manage");
    const v = z.object({ id: z.string().uuid().optional(), phone, name: z.string().trim().max(80).optional(), notes: z.string().trim().max(500).optional(), isCorporate: z.boolean(), creditLimitRupees: z.number().min(0).optional() }).parse(raw);
    const db = await getDb();
    const [b] = await db.select().from(s.business).limit(1);
    const values = { name: v.name || null, notes: v.notes || null, isCorporate: v.isCorporate, creditLimit: Math.round((v.creditLimitRupees ?? 0) * 100) };
    if (v.id) await db.update(s.customers).set(values).where(eq(s.customers.id, v.id));
    else {
      const [dup] = await db.select({ id: s.customers.id }).from(s.customers).where(eq(s.customers.phone, v.phone));
      if (dup) throw new UserError("A customer with this phone already exists");
      await db.insert(s.customers).values({ ...values, phone: v.phone, businessId: b.id });
    }
    await audit(session, { action: v.id ? "customer.update" : "customer.create", entity: "customer", entityId: v.id, after: { ...values, phone: v.phone } });
    reval();
    return { ok: true };
  });
}

export async function adjustPoints(customerId: string, points: number, reason: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("loyalty.adjust");
    const p = z.number().int().refine((n) => n !== 0, "Enter a number of points (negative to remove)").parse(points);
    const why = z.string().trim().min(3, "Enter a reason").parse(reason);
    const db = await getDb();
    const [c] = await db.select().from(s.customers).where(eq(s.customers.id, customerId));
    if (!c) throw new UserError("Customer not found");
    if (c.loyaltyPoints + p < 0) throw new UserError("That would take the balance below zero");
    await db.transaction(async (tx) => {
      await tx.insert(s.loyaltyTransactions).values({ customerId, points: p, reason: `Manual: ${why}` });
      await tx.update(s.customers).set({ loyaltyPoints: c.loyaltyPoints + p }).where(eq(s.customers.id, customerId));
    });
    await audit(session, { action: "loyalty.adjust", entity: "customer", entityId: customerId, before: { points: c.loyaltyPoints }, after: { points: c.loyaltyPoints + p }, reason: why });
    reval();
    return { ok: true };
  });
}

export async function saveLoyaltyRules(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.loyalty");
    const v = z.object({ earnPer100: z.number().min(0).max(100), pointValueRupees: z.number().min(0.01).max(1000), minRedeem: z.number().int().min(0).max(100000), active: z.boolean() }).parse(raw);
    const db = await getDb();
    const [b] = await db.select().from(s.business).limit(1);
    const values = { earnPerRupee: String(v.earnPer100 / 100), pointValuePaisa: Math.round(v.pointValueRupees * 100), minRedeemPoints: v.minRedeem, isActive: v.active };
    const [cur] = await db.select().from(s.loyaltyRules).limit(1);
    if (cur) await db.update(s.loyaltyRules).set(values).where(eq(s.loyaltyRules.id, cur.id));
    else await db.insert(s.loyaltyRules).values({ ...values, businessId: b.id });
    await audit(session, { action: "settings.loyalty", entity: "loyalty_rules", before: cur, after: values });
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}
