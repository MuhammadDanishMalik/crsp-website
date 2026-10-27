import { openingOfferBps } from "@/lib/domain/opening-offer";
import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import type { Nutrition } from "@/lib/domain/nutrition";
import { loadNutritionMaps } from "./nutrition";

export type PosModifier = { id: string; name: string; priceDelta: number; isDefault: boolean; nutrition: Nutrition | null };
export type PosGroup = { id: string; name: string; min: number; max: number; modifiers: PosModifier[] };
export type PosItem = {
  id: string; categoryId: string; name: string; nameUr: string | null; price: number; image: string | null;
  isFavourite: boolean; available: boolean; barcode: string | null; stationId: string | null; description: string | null; nutrition: Nutrition | null; groups: PosGroup[];
};
export type PosMenu = {
  categories: { id: string; name: string; nameUr: string | null; icon: string | null }[];
  items: PosItem[];
  taxRules: { id: string; name: string; rateBps: number; appliesToOrderTypes: string[]; appliesToPaymentMethods: string[]; appliesToServiceCharge: boolean; isInclusive: boolean; priority: number }[];
  paymentMethods: string[];
  paymentProviders: Record<string, string>; // method → provider id ("manual" asks for an approval code)
  serviceChargeBps: number;
  openingOfferBps: number; // automatic opening-week discount (0 = not running)
  zones: { id: string; name: string; charge: number }[];
  loyalty: { earnPerRupee: number; pointValuePaisa: number; minRedeemPoints: number } | null;
};

const TAX_DISABLED = true;

export async function loadTaxRules(branchId: string) {
  // Tax is switched off for every bill (owner's decision); old rules stay in the database but are never applied.
  if (TAX_DISABLED) return [];
  const db = await getDb();
  const rows = await db.select().from(s.taxRules).where(eq(s.taxRules.isActive, true));
  return rows
    .filter((r) => !r.branchId || r.branchId === branchId)
    .map((r) => ({
      id: r.id, name: r.name, rateBps: r.rateBps, appliesToOrderTypes: r.appliesToOrderTypes as string[],
      appliesToPaymentMethods: r.appliesToPaymentMethods as string[], appliesToServiceCharge: r.appliesToServiceCharge,
      isInclusive: r.isInclusive, priority: r.priority,
    }));
}

export async function loadPosMenu(branchId: string): Promise<PosMenu> {
  const db = await getDb();
  const [cats, items, branchRows, itemGroups, taxRules, methods, zones, [biz], [lr]] = await Promise.all([
    db.select().from(s.categories).where(eq(s.categories.isActive, true)).orderBy(asc(s.categories.sortOrder)),
    db.select().from(s.menuItems).where(eq(s.menuItems.isActive, true)).orderBy(asc(s.menuItems.sortOrder)),
    db.select().from(s.branchMenuItems).where(eq(s.branchMenuItems.branchId, branchId)),
    db.select().from(s.itemModifierGroups).orderBy(asc(s.itemModifierGroups.sortOrder)),
    loadTaxRules(branchId),
    db.select().from(s.paymentMethodSettings).where(and(eq(s.paymentMethodSettings.branchId, branchId), eq(s.paymentMethodSettings.isEnabled, true))),
    db.select().from(s.deliveryZones).where(and(eq(s.deliveryZones.branchId, branchId), eq(s.deliveryZones.isActive, true))),
    db.select().from(s.business).limit(1),
    db.select().from(s.loyaltyRules).where(eq(s.loyaltyRules.isActive, true)).limit(1),
  ]);
  const groupIds = [...new Set(itemGroups.map((g) => g.groupId))];
  const groups = groupIds.length ? await db.select().from(s.modifierGroups).where(inArray(s.modifierGroups.id, groupIds)) : [];
  const mods = groupIds.length
    ? await db.select().from(s.modifiers).where(and(inArray(s.modifiers.groupId, groupIds), eq(s.modifiers.isActive, true))).orderBy(asc(s.modifiers.sortOrder))
    : [];
  const nut = await loadNutritionMaps();
  const groupMap = new Map<string, PosGroup>(
    groups.map((g) => [g.id, {
      id: g.id, name: g.name, min: g.minSelect, max: g.maxSelect,
      modifiers: mods.filter((m) => m.groupId === g.id).map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta, isDefault: m.isDefault, nutrition: nut.modifiers.get(m.id) ?? null })),
    }]),
  );
  const override = new Map(branchRows.map((b) => [b.itemId, b]));
  return {
    categories: cats.map((c) => ({ id: c.id, name: c.name, nameUr: c.nameUr, icon: c.icon })),
    items: items.map((i) => {
      const o = override.get(i.id);
      return {
        id: i.id, categoryId: i.categoryId, name: i.name, nameUr: i.nameUr, price: o?.price ?? i.basePrice, image: i.imageUrl,
        isFavourite: i.isFavourite, available: o ? o.isAvailable : true, barcode: i.barcode, stationId: i.kitchenStationId, description: i.description, nutrition: nut.items.get(i.id)?.value ?? null,
        groups: itemGroups.filter((g) => g.itemId === i.id).map((g) => groupMap.get(g.groupId)).filter((g): g is PosGroup => !!g),
      };
    }),
    taxRules,
    paymentMethods: methods.map((m) => m.method),
    paymentProviders: Object.fromEntries(methods.map((m) => [m.method, m.provider])),
    serviceChargeBps: ((biz?.settings as { serviceChargeBps?: number } | null)?.serviceChargeBps) ?? 0,
    openingOfferBps: openingOfferBps(),
    zones: zones.map((z) => ({ id: z.id, name: z.name, charge: z.charge })),
    loyalty: lr ? { earnPerRupee: Number(lr.earnPerRupee), pointValuePaisa: lr.pointValuePaisa, minRedeemPoints: lr.minRedeemPoints } : null,
  };
}

export type PublicItem = PosItem & { description?: string | null };
export type PublicCategory = { id: string; name: string; nameUr: string | null; icon: string | null; count?: number };
export type PublicMenu = {
  categories: PublicCategory[];
  items: PublicItem[];
  zones: { id: string; name: string; charge: number }[];
  branches: { id: string; name: string; city: string | null; address: string | null; phone: string | null }[];
};

export async function loadPublicMenu(): Promise<PublicMenu> {
  const db = await getDb();
  const branchList = await db.select().from(s.branches).where(eq(s.branches.isActive, true));
  const primaryBranch = branchList[0];
  const posMenu = primaryBranch ? await loadPosMenu(primaryBranch.id) : null;
  return {
    categories: posMenu?.categories ?? [],
    items: (posMenu?.items ?? []).map((it) => ({
      ...it,
      description: it.description,
    })),
    zones: posMenu?.zones ?? [],
    branches: branchList.map((b) => ({ id: b.id, name: b.name, city: b.city, address: b.address, phone: b.phone })),
  };
}


/** Category name per menu item, for rules that depend on the category (e.g. no discount on cold drinks). */
export async function categoryNamesOf(itemIds: string[]): Promise<(itemId: string) => string | undefined> {
  if (!itemIds.length) return () => undefined;
  const db = await getDb();
  const rows = await db.select({ id: s.menuItems.id, cat: s.categories.name }).from(s.menuItems).innerJoin(s.categories, eq(s.categories.id, s.menuItems.categoryId)).where(inArray(s.menuItems.id, itemIds));
  const map = new Map(rows.map((r) => [r.id, r.cat]));
  return (id) => map.get(id);
}
