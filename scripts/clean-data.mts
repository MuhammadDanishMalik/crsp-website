/**
 * Wipes ALL business activity (orders, payments, shifts, stock movements, customers, expenses, audit log …) and resets
 * stock to zero, but KEEPS the setup: menu, categories, modifiers, recipes, ingredients, staff, roles, settings, printers,
 * tax rules, branches, terminals, suppliers (balance reset to 0), sadqa rules, loyalty rules.
 *
 *   npm run clean:data                       → the local embedded database (.data/pglite). Stop `npm run dev` first.
 *   DATABASE_URL=postgres://… npm run clean:data -- --live    → a real/live Postgres. Irreversible.
 */
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import path from "node:path";

const WIPE = [
  "order_counters", "orders", "order_items", "order_item_modifiers", "order_discounts", "order_tax_lines", "order_splits", "payments", "refunds", "deliveries", "rider_settlements",
  "tax_invoices", "print_jobs", "loyalty_transactions", "shifts", "cash_movements", "day_closures", "attendance", "payroll_adjustments", "stock_movements", "stock_batches",
  "purchase_orders", "purchase_order_lines", "supplier_payments", "expenses", "bank_deposits", "sadqa_given", "audit_logs", "notification_log", "sync_receipts", "pos_sessions",
  "customers", "customer_addresses", "vouchers",
];
const KEEP = ["menu_items", "categories", "modifiers", "recipes", "ingredients", "staff", "roles", "terminals", "printers", "kitchen_stations", "tax_rules", "sadqa_rules", "branches", "suppliers"];
const RESET = ["update ingredient_stock set quantity = 0", "update suppliers set balance = 0", "update discounts set used_count = 0", "update scheduled_reports set last_sent_on = null"];

const url = process.env.DATABASE_URL;
if (url && !process.argv.includes("--live")) { console.error("DATABASE_URL is set: this is a real database. Re-run with --live if you are sure."); process.exit(1); }

let run: (q: string) => Promise<unknown[]>, close: () => Promise<void>;
if (url) {
  const sql = postgres(url, { prepare: false });
  run = async (q) => [...(await sql.unsafe(q))]; close = () => sql.end();
  console.log("Target: live Postgres");
} else {
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data/pglite");
  const pg = new PGlite(dir);
  run = async (q) => (await pg.query(q)).rows as unknown[]; close = () => pg.close();
  console.log("Target: local database", dir);
}
const count = async (t: string) => Number(((await run(`select count(*)::int as n from ${t}`))[0] as { n: number }).n);
const before = Object.fromEntries(await Promise.all(KEEP.map(async (t) => [t, await count(t)])));
await run(`truncate table ${WIPE.join(", ")} restart identity cascade`);
for (const q of RESET) await run(q);
const after = Object.fromEntries(await Promise.all(KEEP.map(async (t) => [t, await count(t)])));
const intact = KEEP.every((t) => before[t] === after[t]);
console.log("Wiped:", WIPE.length, "tables. Kept (before → after):", KEEP.map((t) => `${t} ${before[t]}→${after[t]}`).join(", "));
console.log(intact ? "Setup data intact." : "WARNING: setup data changed, check the list above!");
await close();
process.exit(intact ? 0 : 2);
