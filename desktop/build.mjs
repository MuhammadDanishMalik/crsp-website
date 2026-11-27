// Puts the web app + database programs into desktop/build.   node desktop/build.mjs [win32|darwin]
import { execSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const target = process.argv[2] ?? "win32";
const arch = target === "win32" ? "x64" : process.arch;
const PG = "17.12.0-beta.19"; // same major version as the website's database
const run = (cmd, cwd = root, env = {}) => execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...env } });

// 1. web app as a self-contained server (Next may stop the first build to print an upgrade notice: run again)
run("npm run build </dev/null || npm run build </dev/null", root, { DESKTOP_BUILD: "1", COMMIT_REF: execSync("git rev-parse HEAD", { cwd: root }).toString().trim() });
const out = path.join(here, "build"), app = path.join(out, "app-server");
rmSync(out, { recursive: true, force: true });
mkdirSync(app, { recursive: true });
cpSync(path.join(root, ".next/standalone"), app, { recursive: true, dereference: true });
cpSync(path.join(root, ".next/static"), path.join(app, ".next/static"), { recursive: true });
cpSync(path.join(root, "public"), path.join(app, "public"), { recursive: true });
cpSync(path.join(root, "drizzle"), path.join(app, "drizzle"), { recursive: true });
// never ship secrets or local data, and no Mac-only image library
for (const f of readdirSync(app)) if (f.startsWith(".env") || ["desktop", ".data", "src-tauri"].includes(f)) rmSync(path.join(app, f), { recursive: true, force: true });
for (const d of ["node_modules/sharp", "node_modules/@img"]) rmSync(path.join(app, d), { recursive: true, force: true });

// Next links some packages with absolute paths on the build computer: they would be broken on the shop PC, so copy the real files in
const standalone = path.join(root, ".next/standalone");
(function unlink(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name), s = lstatSync(p);
    if (s.isSymbolicLink()) {
      const target = path.resolve(dir, readlinkSync(p));
      const inside = target.startsWith(standalone) ? path.join(app, path.relative(standalone, target)) : target;
      rmSync(p, { force: true });
      cpSync(inside, p, { recursive: true, dereference: true });
    } else if (s.isDirectory()) unlink(p);
  }
})(app);

// 2. PostgreSQL programs for the target computer
const pkg = `@embedded-postgres/${target === "win32" ? "windows" : target}-${arch}`;
const tmp = path.join(here, ".pg-download");
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp);
run(`npm pack ${pkg}@${PG} -q && tar -xzf *.tgz`, tmp);
cpSync(path.join(tmp, "package/native"), path.join(out, "pgsql"), { recursive: true, verbatimSymlinks: true });
if (target === "win32") rmSync(path.join(out, "pgsql", "bin", "testplug.dll"), { force: true });
if (target !== "win32" && existsSync(path.join(tmp, "package/scripts/hydrate-symlinks.js"))) run(`cp -R . ${JSON.stringify(path.join(out, "hydrate"))} && cd ${JSON.stringify(path.join(out, "hydrate"))} && node scripts/hydrate-symlinks.js && rm -rf ${JSON.stringify(path.join(out, "pgsql"))} && mv native ${JSON.stringify(path.join(out, "pgsql"))} && cd .. && rm -rf hydrate`, path.join(tmp, "package"));
rmSync(tmp, { recursive: true, force: true });

// 3. icon
mkdirSync(path.join(here, "assets"), { recursive: true });
cpSync(path.join(root, "public/brand/icon-512.png"), path.join(here, "assets/icon.png"));
console.log("desktop/build is ready for", target);
