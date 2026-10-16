"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { guard, UserError, type R } from "./_guard";

/**
 * Fix or add the customer details on an order that was already rung and printed (name, phone, address), e.g. a customer
 * asks for their name on the bill afterwards. Money, items and stock are untouched; reprint the receipt to get the new details.
 */
export async function updateOrderCustomer(orderId: string, raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("order.create");
    const v = z.object({ name: z.string().trim().max(80), phone: z.string().trim().max(20), address: z.string().trim().max(300) }).parse(raw);
    const phone = v.phone.replace(/[^\d+]/g, "");
    if (phone && (phone.length < 7 || phone.length > 15)) throw new UserError("Phone number looks wrong");
    const db = await getDb();
    const [o] = await db.select().from(s.orders).where(and(eq(s.orders.id, orderId), eq(s.orders.branchId, session.branchId)));
    if (!o) throw new UserError("Order not found");
    if (o.status === "voided") throw new UserError("A voided order cannot be edited");
    if (o.createdBy !== session.staffId && !session.can("order.view_all")) throw new UserError("You can only edit your own orders");
    if (o.type === "delivery" && !v.address) throw new UserError("A delivery order needs an address");
    let customerId: string | null = null;
    if (phone) {
      const [b] = await db.select().from(s.business).limit(1);
      const [c] = await db.insert(s.customers).values({ businessId: b.id, phone, name: v.name || null })
        .onConflictDoUpdate({ target: [s.customers.businessId, s.customers.phone], set: v.name ? { name: v.name } : { phone } }).returning();
      customerId = c.id;
    }
    await db.update(s.orders).set({ customerName: v.name || null, customerId, deliveryAddress: v.address || null, updatedAt: new Date() }).where(eq(s.orders.id, orderId));
    await audit(session, { action: "order.customer_edit", entity: "order", entityId: orderId, before: { name: o.customerName, address: o.deliveryAddress }, after: { name: v.name, phone, address: v.address } });
    revalidatePath("/orders"); revalidatePath("/admin/orders");
    return { ok: true };
  });
}
