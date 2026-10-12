"use server";

import { desc, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export async function lookupCustomer(phone: string) {
  const session = await getSession();
  if (!session || !session.can("customer.view")) return null;
  const clean = phone.replace(/[^\d+]/g, "");
  if (clean.length < 7) return null;
  const db = await getDb();
  const [c] = await db.select().from(s.customers).where(and(eq(s.customers.phone, clean)));
  if (!c) return null;
  const [addr] = await db.select().from(s.customerAddresses).where(eq(s.customerAddresses.customerId, c.id)).orderBy(desc(s.customerAddresses.lastUsedAt)).limit(1);
  return { name: c.name ?? "", address: addr?.address ?? "", zoneId: addr?.zoneId ?? null, points: c.loyaltyPoints };
}
