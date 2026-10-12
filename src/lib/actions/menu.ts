"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { PermissionError, requirePermission } from "@/lib/auth/session";
import { publish } from "@/lib/realtime/bus";

type R = { ok: true } | { ok: false; error: string };
async function guard(fn: () => Promise<R>): Promise<R> {
  try { return await fn(); } catch (e) {
    if (e instanceof PermissionError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}

/** Instant sold-out toggle: POS reloads menu on next refresh/order, and the server rejects sold-out items. */
export async function setAvailability(itemId: string, available: boolean, reason?: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("menu.availability");
    const db = await getDb();
    await db.insert(s.branchMenuItems).values({ branchId: session.branchId, itemId, isAvailable: available, soldOutReason: available ? null : reason })
      .onConflictDoUpdate({ target: [s.branchMenuItems.branchId, s.branchMenuItems.itemId], set: { isAvailable: available, soldOutReason: available ? null : reason ?? null, updatedAt: new Date() } });
    await audit(session, { action: available ? "menu.available" : "menu.sold_out", entity: "menu_item", entityId: itemId });
    publish(session.branchId, { type: "menu.changed" });
    revalidatePath("/admin/menu");
    return { ok: true };
  });
}

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(80),
  nameUr: z.string().trim().max(80).optional(),
  categoryId: z.string().uuid("Choose a category"),
  priceRupees: z.number().min(0).max(1_000_000),
  emoji: z.string().max(8).optional(),
  barcode: z.string().trim().max(40).optional(),
  isFavourite: z.boolean(),
  groupIds: z.array(z.string().uuid()),
});

export async function saveItem(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("menu.manage");
    const v = itemSchema.parse(raw);
    const db = await getDb();
    const [b] = await db.select().from(s.business).limit(1);
    const base = Math.round(v.priceRupees * 100);
    const values = {
      name: v.name, nameUr: v.nameUr || null, categoryId: v.categoryId, basePrice: base, barcode: v.barcode || null,
      imageUrl: v.emoji ? `emoji:${v.emoji}` : null, isFavourite: v.isFavourite, updatedAt: new Date(),
    };
    let id = v.id;
    if (id) {
      if (!session.can("menu.price")) {
        const [cur] = await db.select().from(s.menuItems).where(eq(s.menuItems.id, id));
        if (cur && cur.basePrice !== base) throw new PermissionError("Missing permission: menu.price");
      }
      await db.update(s.menuItems).set(values).where(eq(s.menuItems.id, id));
    } else {
      if (!session.can("menu.price")) throw new PermissionError("Missing permission: menu.price");
      [{ id }] = await db.insert(s.menuItems).values({ ...values, businessId: b.id }).returning({ id: s.menuItems.id });
    }
    await db.delete(s.itemModifierGroups).where(eq(s.itemModifierGroups.itemId, id!));
    if (v.groupIds.length) await db.insert(s.itemModifierGroups).values(v.groupIds.map((groupId, i) => ({ itemId: id!, groupId, sortOrder: i })));
    await audit(session, { action: v.id ? "menu.item.update" : "menu.item.create", entity: "menu_item", entityId: id, after: values });
    revalidatePath("/admin/menu");
    return { ok: true };
  });
}

export async function deactivateItem(id: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("menu.manage");
    const db = await getDb();
    await db.update(s.menuItems).set({ isActive: false }).where(eq(s.menuItems.id, id));
    await audit(session, { action: "menu.item.deactivate", entity: "menu_item", entityId: id });
    revalidatePath("/admin/menu");
    return { ok: true };
  });
}

export async function saveCategory(name: string, icon?: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("menu.manage");
    const n = z.string().trim().min(1, "Name is required").max(40).parse(name);
    const db = await getDb();
    const [b] = await db.select().from(s.business).limit(1);
    const [c] = await db.insert(s.categories).values({ businessId: b.id, name: n, icon: icon || null, sortOrder: 99 }).returning();
    await audit(session, { action: "menu.category.create", entity: "category", entityId: c.id, after: { name: n } });
    revalidatePath("/admin/menu");
    return { ok: true };
  });
}

const groupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Group name is required").max(60),
  minSelect: z.number().int().min(0).max(20), maxSelect: z.number().int().min(1).max(20),
  options: z.array(z.object({ name: z.string().trim().min(1, "Option name is required").max(60), priceRupees: z.number().min(0).max(100_000), isDefault: z.boolean() })).min(1, "Add at least one option"),
}).refine((g) => g.minSelect <= g.maxSelect, { message: "Min cannot exceed max" });

export async function saveModifierGroup(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("menu.manage");
    const v = groupSchema.parse(raw);
    const db = await getDb();
    const [b] = await db.select().from(s.business).limit(1);
    let id = v.id;
    if (id) await db.update(s.modifierGroups).set({ name: v.name, minSelect: v.minSelect, maxSelect: v.maxSelect }).where(eq(s.modifierGroups.id, id));
    else [{ id }] = await db.insert(s.modifierGroups).values({ businessId: b.id, name: v.name, minSelect: v.minSelect, maxSelect: v.maxSelect }).returning({ id: s.modifierGroups.id });
    // Options are replaced by deactivation + insert so past orders (which snapshot names) are unaffected.
    await db.update(s.modifiers).set({ isActive: false }).where(and(eq(s.modifiers.groupId, id!), eq(s.modifiers.isActive, true)));
    await db.insert(s.modifiers).values(v.options.map((o, i) => ({ groupId: id!, name: o.name, priceDelta: Math.round(o.priceRupees * 100), isDefault: o.isDefault, sortOrder: i })));
    await audit(session, { action: "menu.modifier_group.save", entity: "modifier_group", entityId: id, after: v });
    revalidatePath("/admin/menu");
    return { ok: true };
  });
}
