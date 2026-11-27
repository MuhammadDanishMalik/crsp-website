import "server-only";
import { runtimeEnv } from "@/lib/env";
import { databaseUrl, getDb } from "@/lib/db/client";
import { clearMenuCache } from "@/lib/realtime/menu-cache";
import { connect, exportRows, migrationCount, pushable, tableOrder, upsertRows, type Sql } from "./tables";

/** Runs INSIDE the installed shop app: copies data from (first setup) or to (nightly) the website. */
export type SyncResult = { ok: true; tables: number; rows: number; errors: string[] } | { ok: false; error: string };
const PAGE = 300;

async function cloud(query: string, body?: unknown): Promise<Record<string, unknown>> {
  const base = runtimeEnv("CRSP_CLOUD_URL"), key = runtimeEnv("CRSP_SYNC_KEY");
  if (!base || !key) throw new Error("Website address or sync key is not set");
  const res = await fetch(`${base.replace(/\/$/, "")}/api/sync/cloud${query}`, {
    method: body ? "POST" : "GET", body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(60_000),
    headers: { "x-crsp-sync-key": key, "content-type": "application/json" },
  });
  if (res.status === 404 || res.status === 401) throw new Error("The website refused the sync key");
  if (!res.ok) throw new Error(`The website answered ${res.status}`);
  return res.json();
}

async function withLocal<T>(run: (sql: Sql) => Promise<T>): Promise<T> {
  await getDb(); // makes sure the local tables exist (migrations)
  const sql = connect(databaseUrl()!);
  try { return await run(sql); } finally { await sql.end(); }
}

async function checkSameVersion(sql: Sql) {
  const info = (await cloud("")) as { tables: string[]; migrations: number };
  if (info.migrations !== (await migrationCount(sql))) throw new Error("The app and the website are different versions: update the app (or the website) first");
  return info;
}

/** First setup only: fill an EMPTY shop database with everything the website has. */
export async function pullAll(): Promise<SyncResult> {
  return withLocal(async (sql) => {
    const [{ n }] = await sql`select count(*)::int n from orders`;
    if (n > 0) return { ok: false as const, error: "This PC already has orders: downloading again would erase them" };
    await checkSameVersion(sql);
    const order = await tableOrder(sql);
    const data = new Map<string, string[]>();
    let rows = 0;
    for (const t of order) {
      const pages: string[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const p = (await cloud(`?table=${encodeURIComponent(t)}&offset=${offset}`)) as { rows: string; count: number };
        if (p.count) pages.push(p.rows);
        rows += p.count;
        if (p.count < PAGE) break;
      }
      data.set(t, pages);
    }
    const errors: string[] = [];
    // all or nothing: a download that dies half way leaves the PC exactly as it was
    await sql.begin(async (tx) => {
      await tx.unsafe(`truncate ${order.map((t) => `public."${t}"`).join(", ")} cascade`);
      for (const t of order) for (const page of data.get(t)!) {
        await tx.unsafe(`insert into public."${t}" select * from jsonb_populate_recordset(null::public."${t}", $1::text::jsonb)`, [page]);
      }
    });
    clearMenuCache();
    return { ok: true as const, tables: order.length, rows, errors };
  });
}

/** Nightly: send everything this PC knows to the website (new rows added, changed rows updated). */
export async function pushAll(): Promise<SyncResult> {
  return withLocal(async (sql) => {
    await checkSameVersion(sql);
    const order = pushable(await tableOrder(sql));
    let rows = 0; const errors: string[] = [];
    for (const t of order) {
      for (let offset = 0; ; offset += PAGE) {
        const p = await exportRows(sql, t, offset, PAGE);
        if (p.count) {
          const r = (await cloud("", { table: t, rows: p.rows })) as unknown as Awaited<ReturnType<typeof upsertRows>>;
          rows += r.ok; errors.push(...r.errors);
        }
        if (p.count < PAGE) break;
      }
    }
    return { ok: true as const, tables: order.length, rows, errors: errors.slice(0, 20) };
  });
}
