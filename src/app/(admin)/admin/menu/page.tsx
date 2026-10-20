import { asc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { MenuManager } from "./menu-manager";

export const maxDuration = 60; // "Load CRSP menu card" writes ~25 batched statements to a remote database

export default async function MenuPage() {
  const session = await requireSession({ permission: "menu.view", kind: "admin" });
  const db = await getDb();
  const [cats, items, branch, links, groups] = await Promise.all([
    db.select().from(s.categories).orderBy(asc(s.categories.sortOrder)),
    db.select().from(s.menuItems).where(eq(s.menuItems.isActive, true)).orderBy(asc(s.menuItems.sortOrder)),
    db.select().from(s.branchMenuItems).where(eq(s.branchMenuItems.branchId, session.branchId)),
    db.select().from(s.itemModifierGroups),
    db.select().from(s.modifierGroups),
  ]);
  const mods = groups.length ? await db.select().from(s.modifiers).where(eq(s.modifiers.isActive, true)).orderBy(asc(s.modifiers.sortOrder)) : [];
  return (
    <MenuManager
      can={{ manage: session.can("menu.manage"), availability: session.can("menu.availability"), price: session.can("menu.price"), owner: session.roleKey === "owner" }}
      categories={cats.map((c) => ({ id: c.id, name: c.name }))}
      items={items.map((i) => ({
        id: i.id, name: i.name, nameUr: i.nameUr ?? "", categoryId: i.categoryId, price: i.basePrice, emoji: i.imageUrl?.startsWith("emoji:") ? i.imageUrl.slice(6) : "",
        barcode: i.barcode ?? "", isFavourite: i.isFavourite, available: branch.find((b) => b.itemId === i.id)?.isAvailable ?? true, branchPrice: branch.find((b) => b.itemId === i.id)?.price ?? null,
        groupIds: links.filter((l) => l.itemId === i.id).map((l) => l.groupId),
      }))}
      groups={groups.map((g) => ({ id: g.id, name: g.name, min: g.minSelect, max: g.maxSelect, options: mods.filter((m) => m.groupId === g.id).map((m) => ({ name: m.name, price: m.priceDelta, isDefault: m.isDefault })) }))}
    />
  );
}
