// Read-only: times one query per table, then pairs, to find the one that never answers.
//   cd /opt/crsp && git pull -q && set -a && . /etc/crsp.env && set +a && node deploy/dbtest2.mjs
import postgres from "postgres";

const u = new URL(process.env.POSTGRES_URL);
u.searchParams.delete("supa");
const tables = ["categories", "menu_items", "branch_menu_items", "item_modifier_groups", "modifier_groups", "modifiers", "tax_rules", "payment_method_settings", "delivery_zones", "business", "loyalty_rules", "branches", "orders"];

const timed = async (label, fn) => {
  const t0 = Date.now();
  try {
    const r = await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("NO ANSWER in 8 s")), 8000))]);
    const bytes = Array.isArray(r) ? JSON.stringify(r).length : 0;
    console.log(`  ${label}: ok ${Date.now() - t0} ms  (${Array.isArray(r) ? r.length : "?"} rows, ${bytes} bytes)`);
  } catch (e) {
    console.log(`  ${label}: FAIL after ${Date.now() - t0} ms -> ${e.message}`);
  }
};

console.log("== each table alone, on a fresh connection ==");
for (const t of tables) {
  const sql = postgres(u.toString(), { prepare: false, ssl: "require", connect_timeout: 15, max: 1 });
  await timed(t, () => sql.unsafe(`select * from ${t}`));
  await sql.end({ timeout: 1 }).catch(() => {});
}

console.log("\n== 3 cheap queries in parallel (same connection pool) ==");
{
  const sql = postgres(u.toString(), { prepare: false, ssl: "require", connect_timeout: 15, max: 5 });
  await timed("3 x select 1 in parallel", () => Promise.all([sql`select 1`, sql`select 2`, sql`select 3`]));
  await timed("3 small tables in parallel", () => Promise.all(["business", "categories", "tax_rules"].map((t) => sql.unsafe(`select * from ${t}`))));
  await sql.end({ timeout: 1 }).catch(() => {});
}
process.exit(0);
