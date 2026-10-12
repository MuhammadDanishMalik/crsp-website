import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

export type PosModifier = { id: string; name: string; priceDelta: number; isDefault: boolean };
export type PosGroup = { id: string; name: string; min: number; max: number; modifiers: PosModifier[] };
export type PosItem = {
  id: string; categoryId: string; name: string; nameUr: string | null; price: number; image: string | null;
  isFavourite: boolean; available: boolean; barcode: string | null; stationId: string | null; groups: PosGroup[];
};
export type PosMenu = {
  categories: { id: string; name: string; nameUr: string | null; icon: string | null }[];
  items: PosItem[];
  taxRules: { id: string; name: string; rateBps: number; appliesToOrderTypes: string[]; appliesToPaymentMethods: string[]; appliesToServiceCharge: boolean; isInclusive: boolean; priority: number }[];
  paymentMethods: string[];
  paymentProviders: Record<string, string>; // method → provider id ("manual" asks for an approval code)
  serviceChargeBps: number;
  zones: { id: string; name: string; charge: number }[];
  loyalty: { earnPerRupee: number; pointValuePaisa: number; minRedeemPoints: number } | null;
};

export async function loadTaxRules(branchId: string) {
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
  const groupMap = new Map<string, PosGroup>(
    groups.map((g) => [g.id, {
      id: g.id, name: g.name, min: g.minSelect, max: g.maxSelect,
      modifiers: mods.filter((m) => m.groupId === g.id).map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta, isDefault: m.isDefault })),
    }]),
  );
  const override = new Map(branchRows.map((b) => [b.itemId, b]));
  return {
    categories: cats.map((c) => ({ id: c.id, name: c.name, nameUr: c.nameUr, icon: c.icon })),
    items: items.map((i) => {
      const o = override.get(i.id);
      return {
        id: i.id, categoryId: i.categoryId, name: i.name, nameUr: i.nameUr, price: o?.price ?? i.basePrice, image: i.imageUrl,
        isFavourite: i.isFavourite, available: o ? o.isAvailable : true, barcode: i.barcode, stationId: i.kitchenStationId,
        groups: itemGroups.filter((g) => g.itemId === i.id).map((g) => groupMap.get(g.groupId)).filter((g): g is PosGroup => !!g),
      };
    }),
    taxRules,
    paymentMethods: methods.map((m) => m.method),
    paymentProviders: Object.fromEntries(methods.map((m) => [m.method, m.provider])),
    serviceChargeBps: ((biz?.settings as { serviceChargeBps?: number } | null)?.serviceChargeBps) ?? 0,
    zones: zones.map((z) => ({ id: z.id, name: z.name, charge: z.charge })),
    loyalty: lr ? { earnPerRupee: Number(lr.earnPerRupee), pointValuePaisa: lr.pointValuePaisa, minRedeemPoints: lr.minRedeemPoints } : null,
  };
}
