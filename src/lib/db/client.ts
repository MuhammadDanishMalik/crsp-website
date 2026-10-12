import "server-only";
import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * With DATABASE_URL set (Supabase/Postgres) we use postgres-js.
 * Without it we fall back to an embedded Postgres (PGlite) persisted in .data/,
 * so the app runs locally with zero setup. Same schema, same migrations.
 */
export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

const migrationsFolder = path.join(process.cwd(), "drizzle");

const g = globalThis as unknown as { __crspDb?: Promise<Db>; __crspPglite?: PGlite };

/** The embedded database handle (undefined when DATABASE_URL points at a real Postgres). Used by the backup job. */
export const getPglite = () => g.__crspPglite;

/** Demo data on an empty database (idempotent). Skipped when CRSP_NO_SEED=1 for a clean production start. */
async function seedFirstRun(db: Db) {
  if (process.env.CRSP_NO_SEED === "1") return;
  const { seedIfEmpty } = await import("./seed");
  await seedIfEmpty(db);
}

async function init(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const db = drizzlePg(postgres(url, { prepare: false }), { schema });
    await migratePg(db, { migrationsFolder });
    await seedFirstRun(db as unknown as Db);
    return db as unknown as Db;
  }
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data/pglite");
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  g.__crspPglite = client;
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  await seedFirstRun(db);
  return db;
}

export function getDb(): Promise<Db> {
  return (g.__crspDb ??= init().catch((e) => {
    g.__crspDb = undefined; // allow retry
    console.error("DB init failed:", e?.cause ?? e);
    throw e;
  }));
}
