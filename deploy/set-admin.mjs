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
const { NEW_EMAIL: email, NEW_PASSWORD: pw, NEW_NAME: name } = process.env;
if (email && pw) {
  if (pw.length < 8) { console.log("Password must be 8+ characters."); process.exit(1); }
  const hash = await bcrypt.hash(pw, 10);
  const r = await sql.unsafe("update staff set email = $1, password_hash = $2, is_active = true" + (name ? ", full_name = $3" : "") + " where role_id = (select id from roles where key = 'owner' limit 1) returning id", name ? [email.toLowerCase(), hash, name] : [email.toLowerCase(), hash]);
  console.log("Rows updated:", r.length);
  await show();
}
await sql.end();
