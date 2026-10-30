import { runtimeEnv } from "@/lib/env";
import { sql } from "drizzle-orm";
import { databaseUrl, getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** Is the database reachable? Safe to expose: it reveals only the mode and a short error code, never the connection string. */
export async function GET() {
  const url = databaseUrl();
  const mode = url ? "postgres" : "embedded";
  const seen = { POSTGRES_URL: !!runtimeEnv("POSTGRES_URL"), DATABASE_URL: !!runtimeEnv("DATABASE_URL") }; // only whether they exist, never the value
  // Which variable is in use and where it points (never the password): this is what tells you if an old DATABASE_URL is still winning.
  let where: { source?: string; host?: string; user?: string; port?: string } = {};
  if (url) { try { const u = new URL(url); where = { source: runtimeEnv("DATABASE_URL") ? "DATABASE_URL" : "POSTGRES_URL", host: u.hostname, port: u.port, user: decodeURIComponent(u.username) }; } catch { where = { source: runtimeEnv("DATABASE_URL") ? "DATABASE_URL" : "POSTGRES_URL" }; } }
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, mode, ...where, ...(url ? {} : { envSeen: seen }) });
  } catch (e) {
    const err = e as { code?: string; name?: string; cause?: { code?: string; name?: string } };
    const code = err.cause?.code ?? err.code ?? err.cause?.name ?? err.name ?? "unknown";
    const hints: Record<string, string> = {
      "28P01": "Wrong database password in DATABASE_URL",
      "28000": "Wrong database user or password in DATABASE_URL",
      XX000: "Wrong user (pooler needs postgres.<project-ref>) or the project is paused",
      ENOTFOUND: "Database host name not found: check DATABASE_URL",
      ECONNREFUSED: "Database refused the connection: check the port (6543) and host",
      ETIMEDOUT: "Database did not answer: use the Transaction pooler string, not the direct one",
      "3D000": "Database name wrong (should end with /postgres)",
      ERR_INVALID_URL: "DATABASE_URL is not a valid address: check for special characters in the password or stray brackets [ ]",
    };
    return Response.json({ ok: false, mode, ...where, code, hint: hints[code] ?? "See Vercel → Logs for details" }, { status: 503 });
  }
}
