import "server-only";
import postgres from "postgres";

/**
 * Table-by-table copy between two CRSP databases (shop PC <-> website). Rows travel as the JSON text Postgres produced,
 * never parsed in JavaScript, so money and timestamps keep every digit. Rows are matched by primary key.
 */
export type Sql = ReturnType<typeof postgres>;
/** Kept by each side for itself: never copied in either direction. */
const NEVER_PUSH = new Set(["website_orders"]); // website orders are born online; the shop copy must not overwrite them

export const connect = (url: string): Sql => postgres(url, { max: 1, prepare: false, onnotice: () => {} });

const ident = (name: string) => `"${name.replace(/"/g, "")}"`;

/** All tables, parents before children (so foreign keys are satisfied while inserting). */
export async function tableOrder(sql: Sql): Promise<string[]> {
  const tables = (await sql`select tablename t from pg_tables where schemaname = 'public' order by 1`).map((r) => r.t as string);
  const fks = await sql`select c.relname child, p.relname parent from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_class p on p.oid = k.confrelid
    join pg_namespace n on n.oid = c.relnamespace where k.contype = 'f' and n.nspname = 'public'`;
  const done = new Set<string>(), out: string[] = [];
  const visit = (t: string, path: Set<string>) => {
    if (done.has(t) || path.has(t)) return;
    path.add(t);
    for (const f of fks) if (f.child === t && f.parent !== t) visit(f.parent as string, path);
    path.delete(t); done.add(t); out.push(t);
  };
  tables.forEach((t) => visit(t, new Set()));
  return out;
}
export const pushable = (tables: string[]) => tables.filter((t) => !NEVER_PUSH.has(t));

export async function migrationCount(sql: Sql): Promise<number> {
  return (await sql`select count(*)::int n from drizzle.__drizzle_migrations`)[0].n as number;
}

export async function primaryKey(sql: Sql, table: string): Promise<string[]> {
  return (await sql`select a.attname c from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = ${`public.${ident(table)}`}::regclass and i.indisprimary`).map((r) => r.c as string);
}

/** A page of rows as one JSON array (text), in primary-key order. */
export async function exportRows(sql: Sql, table: string, offset: number, limit: number): Promise<{ rows: string; count: number }> {
  const order = (await primaryKey(sql, table)).map(ident).join(", ");
  const [r] = await sql.unsafe(
    `select coalesce(jsonb_agg(x.j), '[]'::jsonb)::text rows, count(*)::int count from (select to_jsonb(t) j from public.${ident(table)} t order by ${order} limit $1 offset $2) x`,
    [limit, offset]);
  return { rows: r.rows as string, count: r.count as number };
}

/** Insert new rows and update changed ones. A row that clashes with something else is reported, not forced. */
export async function upsertRows(sql: Sql, table: string, rows: string): Promise<{ ok: number; errors: string[] }> {
  const pk = await primaryKey(sql, table);
  const cols = (await sql`select column_name c from information_schema.columns where table_schema = 'public' and table_name = ${table} order by ordinal_position`).map((r) => r.c as string);
  const rest = cols.filter((c) => !pk.includes(c));
  const action = rest.length
    ? `do update set ${rest.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ")}`
    : "do nothing";
  const q = (source: string) => `insert into public.${ident(table)} select * from jsonb_populate_recordset(null::public.${ident(table)}, ${source}) on conflict (${pk.map(ident).join(", ")}) ${action}`;
  try {
    const r = await sql.unsafe(q("$1::text::jsonb"), [rows]);
    return { ok: r.count, errors: [] };
  } catch {
    // one bad row must not block the rest of the day's sales: go row by row and collect the failures
    const list = await sql.unsafe("select e::text row from jsonb_array_elements($1::text::jsonb) e", [rows]);
    let ok = 0; const errors: string[] = [];
    for (const { row } of list) {
      try { await sql.unsafe(q("jsonb_build_array($1::text::jsonb)"), [row as string]); ok++; }
      catch (e) { if (errors.length < 5) errors.push(`${table}: ${e instanceof Error ? e.message : "failed"}`); }
    }
    return { ok, errors };
  }
}

/* ───── what the website already has (kept on the shop PC only, outside "public" so it is never copied) ───── */
export async function ensureLedger(sql: Sql) {
  await sql.unsafe("create schema if not exists local_sync; create table if not exists local_sync.sent (tbl text not null, id text not null, h text not null, primary key (tbl, id))");
}
const keyed = async (sql: Sql, table: string) => {
  const key = (await primaryKey(sql, table)).map((c) => `t.${ident(c)}`).join(", ");
  return `select jsonb_build_array(${key})::text id, to_jsonb(t)::text row, md5(to_jsonb(t)::text) h from public.${ident(table)} t`;
};
/** Rows that are new or different since they were last sent. */
export async function changedRows(sql: Sql, table: string): Promise<{ id: string; row: string; h: string }[]> {
  return (await sql.unsafe(`select x.id, x.row, x.h from (${await keyed(sql, table)}) x left join local_sync.sent s on s.tbl = $1 and s.id = x.id where s.h is distinct from x.h`, [table])) as unknown as { id: string; row: string; h: string }[];
}
export async function markSent(sql: Sql, table: string, rows: { id: string; h: string }[]) {
  await sql.unsafe(`insert into local_sync.sent (tbl, id, h) select $1, e->>0, e->>1 from jsonb_array_elements($2::text::jsonb) e on conflict (tbl, id) do update set h = excluded.h`,
    [table, JSON.stringify(rows.map((r) => [r.id, r.h]))]);
}
/** After the first download the website and the PC are identical: nothing needs sending yet. */
export async function markAllSent(sql: Sql, tables: string[]) {
  for (const t of tables) await sql.unsafe(`insert into local_sync.sent (tbl, id, h) select $1, x.id, x.h from (${await keyed(sql, t)}) x on conflict (tbl, id) do update set h = excluded.h`, [t]);
}
/** Add rows that do not exist here yet; anything already known (same id or same phone) is left exactly as it is. */
export async function insertNew(sql: Sql, table: "customers" | "customer_addresses", rows: string): Promise<number> {
  const where = table === "customer_addresses" ? "where exists (select 1 from public.customers c where c.id = r.customer_id)" : "";
  const r = await sql.unsafe(`insert into public.${ident(table)} select r.* from jsonb_populate_recordset(null::public.${ident(table)}, $1::text::jsonb) r ${where} on conflict do nothing`, [rows]);
  return r.count;
}
