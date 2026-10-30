// Read-only database timing test, run on the VPS:  cd /opt/crsp && set -a && . /etc/crsp.env && set +a && node deploy/dbtest.mjs
import postgres from "postgres";

const u = new URL(process.env.POSTGRES_URL);
u.searchParams.delete("supa");
const tables = ["categories", "menu_items", "branch_menu_items", "item_modifier_groups", "modifier_groups", "modifiers", "tax_rules", "payment_method_settings", "delivery_zones", "business", "loyalty_rules"];

const timed = async (label, fn) => {
  const t0 = Date.now();
  try {
    const r = await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("NO ANSWER in 10 s")), 10_000))]);
    console.log(`  ${label}: ok ${Date.now() - t0} ms`, Array.isArray(r) ? "" : "");
    return true;
  } catch (e) {
    console.log(`  ${label}: FAIL after ${Date.now() - t0} ms -> ${e.message}`);
    return false;
  }
};

async function run(name, opts) {
  console.log(`\n== ${name} ==`);
  const sql = postgres(u.toString(), { prepare: false, ssl: "require", connect_timeout: 15, ...opts });
  const all = () => Promise.all(tables.map((t) => sql.unsafe(`select * from ${t}`)));
  await timed("select 1", () => sql`select 1`);
  for (const t of ["categories", "menu_items", "business"]) await timed(`one query on ${t}`, () => sql.unsafe(`select * from ${t}`));
  await timed("all 11 tables in parallel (like the home page)", all);
  console.log("  ...waiting 7 s idle...");
  await new Promise((r) => setTimeout(r, 7000));
  await timed("again after the idle gap", all);
  await timed("and once more", all);
  await sql.end({ timeout: 2 }).catch(() => {});
}

await run("A) settings the app uses now (max 5, idle_timeout 5 s)", { max: 5, idle_timeout: 5, max_lifetime: 120 });
await run("B) postgres.js defaults (max 10, no idle timeout)", {});
await run("C) one connection only (max 1)", { max: 1 });
process.exit(0);
