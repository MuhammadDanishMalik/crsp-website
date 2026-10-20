/**
 * Swap the menu in an existing database for the CRSP menu card in src/lib/db/menu-data.ts.
 *   npm run update:menu                                   → local embedded database (stop `npm run dev` first)
 *   DATABASE_URL=postgres://… npm run update:menu -- --live      → a real/live Postgres (also reads POSTGRES_URL)
 * Old items that past orders point to are hidden, not deleted, so reports keep working. Other data (orders, staff, stock) is untouched.
 * Already up to date? It does nothing unless you add --force.
 */
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../src/lib/db/schema";
import { installMenu } from "../src/lib/db/install-menu";
import { ITEMS } from "../src/lib/db/menu-data";

let raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (raw) { try { const u = new URL(raw); u.searchParams.delete("supa"); raw = u.toString(); } catch { /* keep as is */ } }
if (raw && !process.argv.includes("--live")) { console.error("A database URL is set: this is a real database. Re-run with --live if you are sure."); process.exit(1); }

let db: ReturnType<typeof drizzlePglite<typeof s>>, close: () => Promise<void>;
if (raw) {
  const sql = postgres(raw, { prepare: false, ...(/supabase|pooler/.test(raw) ? { ssl: "require" as const } : {}) });
  db = drizzlePg(sql, { schema: s }) as unknown as typeof db; close = () => sql.end(); console.log("Target: live Postgres");
} else {
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data/pglite");
  const pg = new PGlite(dir); db = drizzlePglite(pg, { schema: s }); close = () => pg.close(); console.log("Target: local database", dir);
}

try {
  const [biz] = await db.select().from(s.business).limit(1);
  if (!biz) throw new Error("No business found: start the app once so the database is created.");
  const branches = await db.select().from(s.branches).where(eq(s.branches.businessId, biz.id));
  if (!branches.length) throw new Error("No branch found.");
  const current = await db.select({ name: s.menuItems.name }).from(s.menuItems).where(and(eq(s.menuItems.businessId, biz.id), eq(s.menuItems.isActive, true)));
  const have = new Set(current.map((x) => x.name));
  if (ITEMS.every((i) => have.has(i.name)) && have.size === ITEMS.length && !process.argv.includes("--force")) { console.log(`Menu already up to date (${have.size} items). Nothing changed.`); }
  else { const r = await installMenu(db as never, biz.id, branches.map((b) => b.id)); console.log(`Menu updated: ${r.items} items in ${r.categories} categories.`); }
} catch (e) { console.error("Failed:", e instanceof Error ? e.message : e); await close(); process.exit(1); }
await close();
process.exit(0);
