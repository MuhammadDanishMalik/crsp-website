/**
 * Sets the owner's back-office email + password in any database (local or live).
 *   ADMIN_EMAIL=admin@crsp.com ADMIN_PASSWORD='…' npm run set:admin                       → local (.data/pglite)
 *   DATABASE_URL=postgres://… ADMIN_EMAIL=… ADMIN_PASSWORD='…' npm run set:admin -- --live → live
 */
import bcrypt from "bcryptjs";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import path from "node:path";

const email = process.env.ADMIN_EMAIL, pw = process.env.ADMIN_PASSWORD, url = process.env.DATABASE_URL;
if (!email || !pw || pw.length < 8) { console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters)."); process.exit(1); }
if (url && !process.argv.includes("--live")) { console.error("DATABASE_URL is set: re-run with --live to change the live database."); process.exit(1); }
const hash = await bcrypt.hash(pw, 10);
const q = "update staff set email = $1, password_hash = $2 where role_id = (select id from roles where key = 'owner' limit 1) returning email";
if (url) { const sql = postgres(url, { prepare: false }); console.log(JSON.stringify(await sql.unsafe(q, [email.toLowerCase(), hash]))); await sql.end(); }
else { const pg = new PGlite(process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data/pglite")); console.log(JSON.stringify((await pg.query(q, [email.toLowerCase(), hash])).rows)); await pg.close(); }
