import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";
import { CATEGORIES, GROUPS, INGREDIENTS, ITEMS, MODIFIER_RECIPES, RECIPES, SADQA, STATION_OF, URDU, type GroupKey, type RecipeLine } from "./menu-data";

const R = (rupees: number) => Math.round(rupees * 100);

/**
 * Replace the menu with the one in menu-data.ts. Safe on a database that already has orders: old items that past orders point to are
 * hidden (deactivated) instead of deleted, everything else old is removed. Ingredients and stock are kept (new ingredients are added).
 */
export async function installMenu(db: Db, bizId: string, branchIds: string[]) {
  // All or nothing: if the connection drops or the request times out half way, the old menu is still there.
  return db.transaction((tx) => installMenuIn(tx as unknown as Db, bizId, branchIds));
}

async function installMenuIn(db: Db, bizId: string, branchIds: string[]) {
  // ---- 1. remove the old menu ----
  const oldItems = await db.select({ id: s.menuItems.id }).from(s.menuItems).where(eq(s.menuItems.businessId, bizId));
  const oldItemIds = oldItems.map((i) => i.id);
  if (oldItemIds.length) {
    const used = new Set((await db.selectDistinct({ id: s.orderItems.itemId }).from(s.orderItems).where(inArray(s.orderItems.itemId, oldItemIds))).map((x) => x.id));
    const usedIds = [...used], free = oldItemIds.filter((id) => !used.has(id));
    await db.delete(s.recipes).where(inArray(s.recipes.itemId, oldItemIds));
    await db.delete(s.sadqaRules).where(inArray(s.sadqaRules.itemId, oldItemIds));
    await db.delete(s.itemModifierGroups).where(inArray(s.itemModifierGroups.itemId, oldItemIds));
    await db.delete(s.branchMenuItems).where(inArray(s.branchMenuItems.itemId, oldItemIds));
    if (usedIds.length) await db.update(s.menuItems).set({ isActive: false, isFavourite: false }).where(inArray(s.menuItems.id, usedIds));
    if (free.length) await db.delete(s.menuItems).where(inArray(s.menuItems.id, free));
  }
  const oldGroups = await db.select({ id: s.modifierGroups.id }).from(s.modifierGroups).where(eq(s.modifierGroups.businessId, bizId));
  const oldGroupIds = oldGroups.map((g) => g.id);
  if (oldGroupIds.length) {
    const oldMods = await db.select({ id: s.modifiers.id }).from(s.modifiers).where(inArray(s.modifiers.groupId, oldGroupIds));
    const modIds = oldMods.map((m) => m.id);
    if (modIds.length) {
      await db.delete(s.recipes).where(inArray(s.recipes.modifierId, modIds));
      const usedMods = new Set((await db.selectDistinct({ id: s.orderItemModifiers.modifierId }).from(s.orderItemModifiers).where(inArray(s.orderItemModifiers.modifierId, modIds))).map((x) => x.id));
      const freeMods = modIds.filter((id) => !usedMods.has(id));
      if (usedMods.size) await db.update(s.modifiers).set({ isActive: false }).where(inArray(s.modifiers.id, [...usedMods] as string[]));
      if (freeMods.length) await db.delete(s.modifiers).where(inArray(s.modifiers.id, freeMods));
    }
    const stillUsed = (await db.selectDistinct({ g: s.modifiers.groupId }).from(s.modifiers).where(inArray(s.modifiers.groupId, oldGroupIds))).map((x) => x.g);
    const goneGroups = oldGroupIds.filter((id) => !stillUsed.includes(id));
    if (goneGroups.length) await db.delete(s.modifierGroups).where(inArray(s.modifierGroups.id, goneGroups));
  }
  const oldCats = await db.select({ id: s.categories.id }).from(s.categories).where(eq(s.categories.businessId, bizId));
  for (const c of oldCats) {
    const [left] = await db.select({ n: sql<number>`count(*)::int` }).from(s.menuItems).where(eq(s.menuItems.categoryId, c.id));
    if (left.n) await db.update(s.categories).set({ isActive: false }).where(eq(s.categories.id, c.id));
    else await db.delete(s.categories).where(eq(s.categories.id, c.id));
  }

  // ---- 2. units + ingredients (add what is missing, keep the rest). Bulk statements: a remote database is slow per round trip. ----
  const unitRows = await db.select().from(s.units);
  const unit: Record<string, string> = Object.fromEntries(unitRows.map((u) => [u.code, u.id]));
  const missingUnits = ([["kg", "Kilogram"], ["g", "Gram"], ["l", "Litre"], ["ml", "Millilitre"], ["pc", "Piece"]] as const).filter(([c]) => !unit[c]);
  if (missingUnits.length) for (const u of await db.insert(s.units).values(missingUnits.map(([code, name]) => ({ code, name }))).returning()) unit[u.code] = u.id;
  if (!(await db.select().from(s.unitConversions)).length) {
    await db.insert(s.unitConversions).values([{ fromUnitId: unit.kg, toUnitId: unit.g, factor: "1000" }, { fromUnitId: unit.l, toUnitId: unit.ml, factor: "1000" }]);
  }
  const haveIng = await db.select().from(s.ingredients).where(eq(s.ingredients.businessId, bizId));
  const ing: Record<string, string> = Object.fromEntries(haveIng.map((i) => [i.name, i.id]));
  const newIng = INGREDIENTS.filter(([name]) => !ing[name]);
  if (newIng.length) {
    const rows = await db.insert(s.ingredients).values(newIng.map(([name, u, cost, imported, , n]) => ({ businessId: bizId, name, baseUnitId: unit[u], avgCost: cost, isImported: imported, originCountry: imported ? "Saudi Arabia" : null, kcal: String(n[0]), proteinG: String(n[1]), carbsG: String(n[2]), fatG: String(n[3]) }))).returning();
    for (const r of rows) ing[r.name] = r.id;
  }
  await db.insert(s.ingredientStock).values(branchIds.flatMap((b) => INGREDIENTS.map(([name, , , , reorder]) => ({ branchId: b, ingredientId: ing[name], quantity: "0", reorderLevel: String(reorder) })))).onConflictDoNothing();

  // ---- 3. kitchen stations (reuse by name) ----
  const stations = await db.select().from(s.kitchenStations).where(eq(s.kitchenStations.branchId, branchIds[0]));
  const station: Record<string, string> = Object.fromEntries(stations.map((x) => [x.name, x.id]));
  const needStations = [...new Set(Object.values(STATION_OF))].filter((n) => !station[n]);
  if (needStations.length) for (const st of await db.insert(s.kitchenStations).values(needStations.map((name) => ({ branchId: branchIds[0], name }))).returning()) station[st.name] = st.id;

  // ---- 4. categories, option groups, items ----
  const cat: Record<string, string> = {};
  for (const row of await db.insert(s.categories).values(CATEGORIES.map((c, i) => ({ businessId: bizId, name: c.name, nameUr: c.nameUr, icon: c.icon, sortOrder: i + 1 }))).returning()) cat[row.name] = row.id;
  const keys = Object.keys(GROUPS) as GroupKey[];
  const groupRows = await db.insert(s.modifierGroups).values(keys.map((k) => ({ businessId: bizId, name: GROUPS[k].name, nameUr: GROUPS[k].nameUr, minSelect: GROUPS[k].min, maxSelect: GROUPS[k].max }))).returning();
  const groupId = {} as Record<GroupKey, string>;
  keys.forEach((k, i) => { groupId[k] = groupRows[i].id; }); // returning() keeps insertion order
  const optionDefs = keys.flatMap((k) => GROUPS[k].options.map((o, i) => ({ k, o, i })));
  const modRows = await db.insert(s.modifiers).values(optionDefs.map(({ k, o, i }) => ({ groupId: groupId[k], name: o.name, nameUr: o.nameUr, priceDelta: R(o.price ?? 0), isDefault: !!o.isDefault, sortOrder: i + 1 }))).returning();
  const modId: Record<string, string> = {};
  modRows.forEach((m) => { modId[m.name] = m.id; });
  const itemRows = await db.insert(s.menuItems).values(ITEMS.map((it, i) => ({
    businessId: bizId, categoryId: cat[it.cat], name: it.name, nameUr: URDU[it.name] ?? null, description: it.desc, basePrice: R(it.price), imageUrl: `emoji:${it.emoji}`,
    sortOrder: i, isFavourite: it.fav, isCombo: it.combo, kitchenStationId: station[STATION_OF[it.cat]],
  }))).returning();
  const itemId: Record<string, string> = {};
  itemRows.forEach((r) => { itemId[r.name] = r.id; });
  const links = ITEMS.flatMap((it) => it.groups.map((g, k) => ({ itemId: itemId[it.name], groupId: groupId[g], sortOrder: k })));
  if (links.length) await db.insert(s.itemModifierGroups).values(links);
  await db.insert(s.branchMenuItems).values(ITEMS.flatMap((it) => branchIds.map((b) => ({ branchId: b, itemId: itemId[it.name], isAvailable: true }))));

  // ---- 5. sadqa pledge + recipes ----
  const rules = Object.entries(SADQA).filter(([name]) => itemId[name]).map(([name, bps]) => ({ itemId: itemId[name], percentBps: bps }));
  if (rules.length) await db.insert(s.sadqaRules).values(rules);
  const line = (l: RecipeLine) => ({ ingredientId: ing[l[0]], quantity: String(l[1]), unitId: unit[l[2]] });
  const recipeRows = [
    ...Object.entries(RECIPES).filter(([name]) => itemId[name]).flatMap(([name, lines]) => lines.map((l) => ({ itemId: itemId[name], ...line(l) }))),
    ...Object.entries(MODIFIER_RECIPES).filter(([name]) => modId[name]).flatMap(([name, lines]) => lines.map((l) => ({ modifierId: modId[name], ...line(l) }))),
  ];
  for (let i = 0; i < recipeRows.length; i += 400) await db.insert(s.recipes).values(recipeRows.slice(i, i + 400));
  return { items: Object.keys(itemId).length, categories: Object.keys(cat).length };
}
