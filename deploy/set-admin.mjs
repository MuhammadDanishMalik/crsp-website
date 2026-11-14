// Run on the VPS.  Shows the owner accounts; with ADMIN_EMAIL + ADMIN_PASSWORD (+ optional ADMIN_NAME) it resets the owner login.
//   cd /opt/crsp && set -a && . /etc/crsp.env && set +a && node deploy/set-admin.mjs
//   cd /opt/crsp && set -a && . /etc/crsp.env && set +a && ADMIN_EMAIL=you@mail.com ADMIN_PASSWORD='newpass123' ADMIN_NAME='Malik Shoaib Ahmad' node deploy/set-admin.mjs
import postgres from "postgres";
import bcrypt from "bcryptjs";

const u = new URL(process.env.POSTGRES_URL);
u.searchParams.delete("supa");
const sql = postgres(u.toString(), { prepare: false, max: 1, ssl: "require", connect_timeout: 15 });
const owners = "select s.id, s.full_name, s.email, s.is_active from staff s join roles r on r.id = s.role_id where r.key = 'owner'";
console.log("Owner accounts now:", JSON.stringify(await sql.unsafe(owners)));
const { ADMIN_EMAIL: email, ADMIN_PASSWORD: pw, ADMIN_NAME: name } = process.env;
if (email && pw) {
  if (pw.length < 8) { console.log("Password must be 8+ characters."); process.exit(1); }
  const hash = await bcrypt.hash(pw, 10);
  await sql.unsafe("update staff set email = $1, password_hash = $2, is_active = true" + (name ? ", full_name = $3" : "") + " where role_id = (select id from roles where key = 'owner' limit 1)", name ? [email.toLowerCase(), hash, name] : [email.toLowerCase(), hash]);
  console.log("Updated. Owner accounts now:", JSON.stringify(await sql.unsafe(owners)));
}
await sql.end();
