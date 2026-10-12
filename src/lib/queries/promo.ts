import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

/** Validate a promo / staff-meal code (shared by the POS preview and order creation). */
export async function findPromo(code: string) {
  const db = await getDb();
  const [d] = await db.select().from(s.discounts).where(and(eq(s.discounts.code, code.trim().toUpperCase()), eq(s.discounts.isActive, true)));
  const now = new Date();
  if (!d) return { ok: false as const, error: "Unknown promo code" };
  if ((d.validFrom && d.validFrom > now) || (d.validTo && d.validTo < now)) return { ok: false as const, error: "This code is not valid today" };
  if (d.maxUses != null && d.usedCount >= d.maxUses) return { ok: false as const, error: "This code has been fully used" };
  return { ok: true as const, id: d.id, name: d.name, kind: d.kind, value: d.value, isStaffMeal: d.isStaffMeal, minOrder: d.minOrder };
}
