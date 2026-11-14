// Run on the VPS. Shows roles + staff (read-only). With NEW_EMAIL + NEW_PASSWORD (+ NEW_NAME) it resets the owner login.
//   cd /opt/crsp && git pull && set -a && . /etc/crsp.env && set +a && node deploy/set-admin.mjs
import postgres from "postgres";
import bcrypt from "bcryptjs";

const u = new URL(process.env.POSTGRES_URL);
u.searchParams.delete("supa");
const sql = postgres(u.toString(), { prepare: false, max: 1, ssl: "require", connect_timeout: 15 });
const show = async () => {
  console.log("ROLES:", JSON.stringify(await sql.unsafe("select id, key, name from roles order by key")));
  console.log("STAFF:", JSON.stringify(await sql.unsafe("select s.full_name, s.email, s.is_active, r.key as role from staff s left join roles r on r.id = s.role_id order by r.key")));
};
await show();
const { NEW_EMAIL: email, NEW_PASSWORD: pw, NEW_NAME: name, FROM_EMAIL: from = "admin@crsp.com" } = process.env;
if (pw) {
  if (pw.length < 8) { console.log("Password must be 8+ characters."); process.exit(1); }
  const hash = await bcrypt.hash(pw, 10);
  // the account that becomes the owner: the current owner if there is one, else the staff row whose e-mail is FROM_EMAIL (default admin@crsp.com)
  const [owner] = await sql.unsafe("select s.id from staff s join roles r on r.id = s.role_id where r.key = 'owner' limit 1");
  const [byMail] = owner ? [owner] : await sql.unsafe("select id from staff where email = $1 limit 1", [from.toLowerCase()]);
  if (!byMail) { console.log("No staff row with e-mail", from); process.exit(1); }
  const r = await sql.unsafe(
    "update staff set role_id = (select id from roles where key = 'owner' limit 1), password_hash = $2, is_active = true, email = coalesce($3, email), full_name = coalesce($4, full_name) where id = $1 returning id",
    [byMail.id, hash, email ? email.toLowerCase() : null, name ?? null]);
  console.log("Rows updated:", r.length);
  await show();
}
await sql.end();
