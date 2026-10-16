"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { guard, type R } from "./_guard";

const reval = () => revalidatePath("/admin/sadqa");

/** One rule per menu item. Changing a percentage only affects future sales; past sales keep the amount set aside at the time. */
export async function saveSadqaRule(itemId: string, percent: number, active = true): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("sadqa.manage");
    const p = z.number().min(0).max(100, "Percentage cannot be above 100").parse(percent);
    const bps = Math.round(p * 100);
    const db = await getDb();
    await db.insert(s.sadqaRules).values({ itemId, percentBps: bps, isActive: active })
      .onConflictDoUpdate({ target: s.sadqaRules.itemId, set: { percentBps: bps, isActive: active } });
    await audit(session, { action: "sadqa.rule", entity: "menu_item", entityId: itemId, after: { percent: p, active } });
    reval();
    return { ok: true };
  });
}

export async function removeSadqaRule(itemId: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("sadqa.manage");
    await (await getDb()).delete(s.sadqaRules).where(eq(s.sadqaRules.itemId, itemId));
    await audit(session, { action: "sadqa.rule.remove", entity: "menu_item", entityId: itemId });
    reval();
    return { ok: true };
  });
}

export async function recordSadqaGiven(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("sadqa.manage");
    const v = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amountRupees: z.number().positive("Enter the amount given"), note: z.string().trim().max(160).optional() }).parse(raw);
    const db = await getDb();
    const [g] = await db.insert(s.sadqaGiven).values({ branchId: session.branchId, givenOn: v.date, amount: Math.round(v.amountRupees * 100), note: v.note || null, createdBy: session.staffId }).returning();
    await audit(session, { action: "sadqa.given", entity: "sadqa_given", entityId: g.id, after: v });
    reval();
    return { ok: true };
  });
}
