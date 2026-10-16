import { sql } from "drizzle-orm";
import { databaseUrl, getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** Is the database reachable? Safe to expose: it reveals only the mode and a short error code, never the connection string. */
export async function GET() {
  const mode = databaseUrl() ? "postgres" : "embedded";
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, mode });
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
    return Response.json({ ok: false, mode, code, hint: hints[code] ?? "See Vercel → Logs for details" }, { status: 503 });
  }
}
