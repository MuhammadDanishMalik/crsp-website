import fs from "node:fs/promises";
import path from "node:path";
import { getDb, getPglite } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const KEEP = 14;

/**
 * Daily database backup. Call once a day with `Authorization: Bearer $CRON_SECRET`.
 *  - embedded database (no DATABASE_URL): writes .data/backups/crsp-YYYY-MM-DD.tar.gz and keeps the last 14
 *  - Supabase / Postgres: use the provider's backups (Supabase → Database → Backups) or `pg_dump` — this route reports that and does nothing
 * Copy the backup folder off the machine (USB / cloud drive) too: a backup on the same disk does not survive a dead disk.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = secret ? req.headers.get("authorization") === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
  if (!authed) return new Response("Forbidden", { status: 403 });
  await getDb();
  const pg = getPglite();
  if (!pg) return Response.json({ ok: true, skipped: "Using an external Postgres: rely on its own backups or pg_dump." });
  const dir = path.join(process.cwd(), ".data/backups");
  await fs.mkdir(dir, { recursive: true });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
  const file = path.join(dir, `crsp-${day}.tar.gz`);
  const dump = await pg.dumpDataDir("gzip");
  await fs.writeFile(file, Buffer.from(await dump.arrayBuffer()));
  const all = (await fs.readdir(dir)).filter((f) => /^crsp-\d{4}-\d{2}-\d{2}\.tar\.gz$/.test(f)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) await fs.unlink(path.join(dir, old));
  const size = (await fs.stat(file)).size;
  return Response.json({ ok: true, file: path.relative(process.cwd(), file), bytes: size, kept: Math.min(all.length, KEEP) });
}
