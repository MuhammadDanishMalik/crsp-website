import { runtimeEnv } from "@/lib/env";
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
 * Without it we fall back to an embedded Postgres (PGlite) persisted in /tmp or .data/,
 * so the app runs everywhere with zero setup. Same schema, same migrations.
 */
export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

const migrationsFolder = path.join(process.cwd(), "drizzle");

const g = globalThis as unknown as { __crspDb?: Promise<Db>; __crspPglite?: PGlite };

/** The embedded database handle (undefined when DATABASE_URL points at a real Postgres). Used by the backup job. */
export const getPglite = () => g.__crspPglite;

/** Demo data on an empty database (idempotent). Skipped when CRSP_NO_SEED=1 for a clean production start. */
async function seedFirstRun(db: Db) {
  if (process.env.CRSP_NO_SEED === "1") return;
  try {
    const { seedIfEmpty } = await import("./seed");
    await seedIfEmpty(db);
  } catch (err) {
    console.warn("Seeding warning:", err);
  }
}

/**
 * The Postgres address: DATABASE_URL, or POSTGRES_URL which the Supabase ↔ Vercel integration adds on its own.
 * The integration's pooled URL carries a `supa=base-pooler.x` marker that the pooler rejects as a startup parameter, so it is removed.
 */
export function databaseUrl(): string | undefined {
  const raw = runtimeEnv("DATABASE_URL") || runtimeEnv("POSTGRES_URL");
  if (!raw) return undefined;
  try { const u = new URL(raw); u.searchParams.delete("supa"); return u.toString(); } catch { return raw; }
}

async function init(): Promise<Db> {
  const url = databaseUrl();
  if (url) {
    const db = drizzlePg(postgres(url, { prepare: false, ...(/supabase|pooler/.test(url) ? { ssl: "require" as const } : {}) }), { schema }); // Supabase only accepts encrypted connections
    if (fs.existsSync(migrationsFolder)) {
      try {
        await migratePg(db, { migrationsFolder });
      } catch (e) {
        console.warn("Postgres migration warning:", e);
      }
    }
    await seedFirstRun(db as unknown as Db);
    return db as unknown as Db;
  }

  // Embedded PGlite fallback: safe for local and serverless (Vercel uses /tmp)
  let client: PGlite;
  try {
    const serverless = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME; // read-only disk except /tmp
    const defaultDir = serverless ? "/tmp/pglite" : path.join(process.cwd(), ".data/pglite");
    const dir = process.env.PGLITE_DIR ?? defaultDir;
    fs.mkdirSync(dir, { recursive: true });
    client = new PGlite(dir);
  } catch (e) {
    console.warn("Could not create persistent PGlite dir, using in-memory:", e);
    client = new PGlite();
  }

  g.__crspPglite = client;
  const db = drizzlePglite(client, { schema });

  if (fs.existsSync(migrationsFolder)) {
    try {
      await migratePglite(db, { migrationsFolder });
    } catch (e) {
      console.warn("PGlite migration warning:", e);
    }
  }

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
