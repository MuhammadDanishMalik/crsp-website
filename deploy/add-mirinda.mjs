// Adds ONLY "Mirinda Citrus" (Rs 400) to the live menu; nothing else is touched (the full update:menu would rebuild the whole menu).
// Safe to run twice.   cd /opt/crsp && set -a && . /etc/crsp.env && set +a && node deploy/add-mirinda.mjs
import postgres from "postgres";

const u = new URL(process.env.POSTGRES_URL);
u.searchParams.delete("supa");
const sql = postgres(u.toString(), { prepare: false, max: 1, ssl: "require", connect_timeout: 15 });
const NAME = "Mirinda Citrus", NAME_UR = "مرینڈا سٹرس", PRICE = 40000; // paisa

await sql.begin(async (tx) => {
  const [ref] = await tx`select i.id, i.business_id, i.category_id, i.kitchen_station_id, i.sort_order from menu_items i where i.name = 'Soft Drink (Can 250 ml)' and i.is_active limit 1`;
  if (!ref) throw new Error("Could not find 'Soft Drink (Can 250 ml)' to copy the category from.");
  const [have] = await tx`select id from menu_items where name = ${NAME} and business_id = ${ref.business_id} limit 1`;
  let itemId = have?.id;
  if (!itemId) {
    [{ id: itemId }] = await tx`insert into menu_items (business_id, category_id, name, name_ur, description, base_price, image_url, sort_order, is_favourite, is_combo, kitchen_station_id)
      values (${ref.business_id}, ${ref.category_id}, ${NAME}, ${NAME_UR}, 'Chilled Mirinda Citrus soft drink', ${PRICE}, 'emoji:🥤', ${ref.sort_order}, true, false, ${ref.kitchen_station_id}) returning id`;
    console.log("Menu item added.");
  } else {
    await tx`update menu_items set base_price = ${PRICE}, is_active = true where id = ${itemId}`;
    console.log("Menu item already there: price set to Rs 400.");
  }
  for (const b of await tx`select id from branches`) await tx`insert into branch_menu_items (branch_id, item_id, is_available) values (${b.id}, ${itemId}, true) on conflict do nothing`;

  // stock tracking: one can = one piece
  const [pc] = await tx`select id from units where code = 'pc' limit 1`;
  let [ing] = await tx`select id from ingredients where name = ${NAME} and business_id = ${ref.business_id} limit 1`;
  if (!ing) [ing] = await tx`insert into ingredients (business_id, name, base_unit_id, avg_cost, kcal, protein_g, carbs_g, fat_g) values (${ref.business_id}, ${NAME}, ${pc.id}, 18000, 150, 0, 38, 0) returning id`;
  for (const b of await tx`select id from branches`) await tx`insert into ingredient_stock (branch_id, ingredient_id, quantity, reorder_level) values (${b.id}, ${ing.id}, 0, 48) on conflict do nothing`;
  const [rec] = await tx`select id from recipes where item_id = ${itemId} limit 1`;
  if (!rec) await tx`insert into recipes (item_id, ingredient_id, quantity, unit_id) values (${itemId}, ${ing.id}, 1, ${pc.id})`;

  // choosable as a drink inside deals / soft-drink flavours
  for (const g of ["Drink (deal)", "Drink Flavor"]) {
    const [grp] = await tx`select id from modifier_groups where name = ${g} and business_id = ${ref.business_id} limit 1`;
    if (!grp) { console.log(`(group "${g}" not found: skipped)`); continue; }
    const [m] = await tx`select id from modifiers where group_id = ${grp.id} and name = ${NAME} limit 1`;
    if (!m) { const [{ n }] = await tx`select coalesce(max(sort_order), 0) + 1 as n from modifiers where group_id = ${grp.id}`; await tx`insert into modifiers (group_id, name, name_ur, price_delta, sort_order) values (${grp.id}, ${NAME}, ${NAME_UR}, 0, ${n})`; console.log(`Added to "${g}".`); }
  }
});
console.log("Done:", JSON.stringify(await sql`select name, base_price, is_active from menu_items where name = ${NAME}`));
await sql.end();
