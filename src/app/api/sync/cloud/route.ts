import { timingSafeEqual } from "node:crypto";
import { runtimeEnv } from "@/lib/env";
import { databaseUrl, getDb } from "@/lib/db/client";
import { connect, exportRows, migrationCount, pushable, tableOrder, upsertRows, type Sql } from "@/lib/sync/tables";

export const dynamic = "force-dynamic";

/**
 * Website side of the shop app's sync. Off unless SYNC_KEY (32+ characters) is set on the server; the key gives full
 * read/write access to the data, so it lives only in the server env file and on the shop PC.
 */
function allowed(req: Request): boolean {
  const key = runtimeEnv("SYNC_KEY") ?? "";
  const got = req.headers.get("x-crsp-sync-key") ?? "";
  if (key.length < 32 || got.length !== key.length || runtimeEnv("CRSP_DESKTOP")) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(key));
}
const no = () => new Response("Not found", { status: 404 });

async function withSql<T>(run: (sql: Sql) => Promise<T>): Promise<T> {
  await getDb();
  const sql = connect(databaseUrl()!);
  try { return await run(sql); } finally { await sql.end(); }
}

export async function GET(req: Request) {
  if (!allowed(req)) return no();
  const q = new URL(req.url).searchParams;
  return withSql(async (sql) => {
    const tables = await tableOrder(sql);
    const table = q.get("table");
    if (!table) return Response.json({ tables, migrations: await migrationCount(sql) });
    if (!tables.includes(table)) return no();
    return Response.json(await exportRows(sql, table, Math.max(0, Number(q.get("offset")) || 0), 300));
  });
}

export async function POST(req: Request) {
  if (!allowed(req)) return no();
  const body = (await req.json()) as { table?: string; rows?: string };
  return withSql(async (sql) => {
    if (!body.table || typeof body.rows !== "string" || !pushable(await tableOrder(sql)).includes(body.table)) return no();
    return Response.json(await upsertRows(sql, body.table, body.rows));
  });
}
