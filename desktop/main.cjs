// CRSP POS for Windows. This window starts a local PostgreSQL database and the POS server on THIS PC, so selling never needs internet.
// Once a day (3 am, or at the next start if the PC was off) it copies the data to the website. Rules: docs/PERFORMANCE.md.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

app.setName("CRSP POS");
const WEB_PORT = 3777, PG_PORT = 5499, SYNC_HOUR = 3;
const BASE = `http://127.0.0.1:${WEB_PORT}`;
const resources = app.isPackaged ? process.resourcesPath : path.join(__dirname, "build");
const serverDir = path.join(resources, "app-server");
// where the database and pictures live (the cashier can pick another folder during setup)
const storeDir = () => cfg.dataFolder || dataDir;
const dbDir = () => path.join(storeDir(), "database");
const pgBin = (name) => path.join(resources, "pgsql", "bin", process.platform === "win32" ? `${name}.exe` : name);

/* ---------- old graphics cards ---------- */
// The shop PC has a 2009 GeForce 210 with drivers that are no longer updated: such cards make screens stutter or hang.
// "Light graphics" (on by default) draws with the processor and switches animations off. It is read before the app starts.
const lightFlag = () => path.join(process.env.CRSP_DESKTOP_DATA || app.getPath("userData"), "use-graphics-card");
const lightGraphics = !fs.existsSync(lightFlag());
if (lightGraphics) { app.disableHardwareAcceleration(); app.commandLine.appendSwitch("force-prefers-reduced-motion"); }

let win, server, cfg, dataDir, quitting = false, syncing = false;

/* ---------- settings kept on this PC ---------- */
const cfgFile = () => path.join(dataDir, "config.json");
const save = () => { fs.writeFileSync(`${cfgFile()}.tmp`, JSON.stringify(cfg, null, 2)); fs.renameSync(`${cfgFile()}.tmp`, cfgFile()); };
function loadConfig() {
  dataDir = process.env.CRSP_DESKTOP_DATA || app.getPath("userData");
  fs.mkdirSync(path.join(dataDir, "logs"), { recursive: true });
  try { cfg = JSON.parse(fs.readFileSync(cfgFile(), "utf8")); } catch { cfg = {}; }
  const secret = () => crypto.randomBytes(32).toString("hex");
  cfg.dbPassword ||= secret(); cfg.sessionSecret ||= secret(); cfg.localToken ||= secret();
  save();
}
const log = (line) => { try { fs.appendFileSync(path.join(dataDir, "logs", "app.log"), `${new Date().toISOString()} ${line}\n`); } catch { /* disk full */ } };

/* ---------- database ---------- */
function startDatabase() {
  const dir = dbDir();
  fs.mkdirSync(storeDir(), { recursive: true });
  if (!fs.existsSync(path.join(dir, "PG_VERSION"))) {
    const pw = path.join(dataDir, "pw.tmp");
    fs.writeFileSync(pw, cfg.dbPassword);
    // UTF8 matters: Windows would otherwise pick a code page that cannot store Urdu
    const r = spawnSync(pgBin("initdb"), ["-D", dir, "-U", "crsp", `--pwfile=${pw}`, "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C"], { encoding: "utf8", windowsHide: true });
    fs.rmSync(pw, { force: true });
    if (r.status !== 0) throw new Error(`Could not create the database: ${r.stderr || r.error?.message}`);
  }
  const ctl = (args) => spawnSync(pgBin("pg_ctl"), ["-D", dir, ...args], { stdio: "ignore", windowsHide: true, timeout: 90_000 }); // "ignore": postgres would hold a pipe open forever
  if (ctl(["status"]).status === 0) return; // still running from before
  // one till on an old PC: a small database server is plenty
  const options = `-p ${PG_PORT} -h 127.0.0.1 -c shared_buffers=48MB -c max_connections=20 -c work_mem=4MB -c maintenance_work_mem=32MB${process.platform === "win32" ? "" : " -k ''"}`;
  const start = () => ctl(["start", "-w", "-t", "60", "-l", path.join(dataDir, "logs", "database.log"), "-o", options]).status === 0;
  if (start()) return;
  fs.rmSync(path.join(dir, "postmaster.pid"), { force: true }); // left behind by a power cut
  if (!start()) throw new Error("The database did not start. See logs\\database.log");
}
const stopDatabase = () => spawnSync(pgBin("pg_ctl"), ["-D", dbDir(), "stop", "-m", "fast", "-w", "-t", "20"], { stdio: "ignore", windowsHide: true, timeout: 30_000 });

/* ---------- POS server ---------- */
function startServer() {
  const out = fs.openSync(path.join(dataDir, "logs", "server.log"), "a");
  server = spawn(process.execPath, ["--max-old-space-size=256", "--max-semi-space-size=2", path.join(serverDir, "server.js")], {
    cwd: serverDir, windowsHide: true, stdio: ["ignore", out, out],
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(WEB_PORT),
      POSTGRES_URL: `postgresql://crsp:${cfg.dbPassword}@127.0.0.1:${PG_PORT}/postgres`, DATABASE_URL: "",
      SESSION_SECRET: cfg.sessionSecret, CRSP_DESKTOP: "1", CRSP_NO_SEED: cfg.demo ? "" : "1", // sample data only when testing
      ...(cfg.demo ? { ADMIN_EMAIL: "admin@crsp.com", ADMIN_PASSWORD: "admin123" } : {}), CRSP_DATA_DIR: path.join(storeDir(), "files"),
      CRSP_LOCAL_TOKEN: cfg.localToken, CRSP_CLOUD_URL: cfg.demo ? "" : cfg.cloudUrl || "", CRSP_SYNC_KEY: cfg.demo ? "" : cfg.syncKey || "",
    },
  });
  const me = server;
  me.on("exit", (code) => { log(`server stopped (${code})`); if (!quitting && server === me) setTimeout(startServer, 1500); }); // never leave the till without a server
}
function stopServer() { const s = server; server = null; if (s) s.kill(); }
async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) })).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("The POS did not start. See logs\\server.log");
}

/* ---------- sync with the website ---------- */
async function sync(mode) {
  const res = await fetch(`${BASE}/api/sync/desktop`, { method: "POST", headers: { "content-type": "application/json", "x-crsp-local": cfg.localToken }, body: JSON.stringify({ mode }) });
  const r = await res.json();
  log(`sync ${mode}: ${JSON.stringify(r)}`);
  return r;
}
const lastDue = () => { const d = new Date(); if (d.getHours() < SYNC_HOUR) d.setDate(d.getDate() - 1); d.setHours(SYNC_HOUR, 0, 0, 0); return d.getTime(); };
async function upload(manual) {
  if (cfg.demo) { if (manual) await dialog.showMessageBox(win, { message: "This is sample data for testing: nothing is uploaded." }); return; }
  if (syncing || !cfg.setupDone) return;
  syncing = true;
  try {
    const r = await sync("push");
    if (r.ok) { cfg.lastSync = Date.now(); cfg.lastError = r.errors.length ? r.errors[0] : ""; } else cfg.lastError = r.error;
    save(); buildMenu();
    if (manual) await dialog.showMessageBox(win, { message: r.ok ? `Uploaded ${r.rows} records.${r.errors.length ? `\n${r.errors.length} could not be copied: ${r.errors[0]}` : ""}` : `Not uploaded: ${r.error}` });
  } catch (e) { log(`sync failed ${e.message}`); } finally { syncing = false; }
}
// checked every 10 minutes: after 3 am, upload once; if there was no internet, keep trying until it works
const scheduleSync = () => setInterval(() => { if ((cfg.lastSync || 0) < lastDue()) void upload(false); }, 10 * 60_000);

/* ---------- window ---------- */
function buildMenu() {
  const last = cfg.lastSync ? new Date(cfg.lastSync).toLocaleString() : "never";
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "POS", submenu: [
      { label: "Till (PIN)", click: () => win.loadURL(`${BASE}/pin`) },
      { label: "Back office", click: () => win.loadURL(`${BASE}/login`) },
      { type: "separator" },
      { label: "Light graphics (for old PCs)", type: "checkbox", checked: lightGraphics, click: () => {
        if (lightGraphics) fs.writeFileSync(lightFlag(), "1"); else fs.rmSync(lightFlag(), { force: true });
        app.relaunch(); app.quit();
      } },
      { type: "separator" }, { role: "reload" }, { role: "togglefullscreen" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" },
      { type: "separator" }, { role: "quit" },
    ] },
    { label: "Online copy", submenu: [
      { label: cfg.demo ? "SAMPLE DATA: nothing is uploaded" : `Last upload: ${last}`, enabled: false },
      ...(cfg.demo ? [{ label: "Delete sample data and set up the real shop", click: () => void removeSample() }] : []),
      ...(cfg.lastError ? [{ label: `Problem: ${String(cfg.lastError).slice(0, 80)}`, enabled: false }] : []),
      { label: "Upload now", click: () => void upload(true) },
      { label: "Open data folder", click: () => void shell.openPath(storeDir()) },
      { label: "Open logs", click: () => void shell.openPath(path.join(dataDir, "logs")) },
    ] },
  ]));
}
async function removeSample() {
  if (!cfg.demo) return; // never delete real shop data
  const { response } = await dialog.showMessageBox(win, { type: "warning", buttons: ["Cancel", "Delete sample data"], defaultId: 0, cancelId: 0, message: "Delete the sample data and start the real shop setup?" });
  if (response !== 1) return;
  quitting = true; stopServer(); stopDatabase();
  fs.rmSync(dbDir(), { recursive: true, force: true });
  cfg.demo = false; cfg.setupDone = false; save();
  app.relaunch(); app.quit();
}
function createWindow() {
  win = new BrowserWindow({ width: 1366, height: 800, show: false, backgroundColor: "#111111", title: "CRSP POS",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  win.once("ready-to-show", () => { win.maximize(); win.show(); });
  const outside = (url) => !url.startsWith(BASE) && !url.startsWith("file:") && !url.startsWith("data:");
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) void shell.openExternal(url); return { action: "deny" }; }); // WhatsApp, maps
  win.webContents.on("will-navigate", (e, url) => { if (outside(url)) { e.preventDefault(); if (/^https?:/.test(url)) void shell.openExternal(url); } });
  win.loadURL("data:text/html,<body style='background:%23111;color:%23fff;font:24px sans-serif;display:flex;height:100vh;align-items:center;justify-content:center'>Starting CRSP POS…</body>");
}

/* ---------- printing: each slip goes straight to the Windows default printer ---------- */
let printQueue = Promise.resolve();
async function printSlip(html, paperMm, heightMm) {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  const file = path.join(dataDir, "slip.html");
  try {
    fs.writeFileSync(file, html.replace("<head>", `<head><base href="${BASE}/">`));
    await w.loadFile(file);
    if (process.env.CRSP_PRINT_TO_FILE) { fs.writeFileSync(process.env.CRSP_PRINT_TO_FILE, await w.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true })); return { ok: true }; } // used by tests
    return await new Promise((resolve) => w.webContents.print(
      { silent: true, printBackground: true, margins: { marginType: "none" }, pageSize: { width: Math.round(paperMm * 1000), height: Math.round(heightMm * 1000) } },
      (ok, reason) => resolve(ok ? { ok: true } : { ok: false, error: `Printing failed: ${reason}` })));
  } catch (e) { return { ok: false, error: e.message }; } finally { w.destroy(); }
}

const fromPos = (e) => e.senderFrame?.url.startsWith(`${BASE}/`);
ipcMain.handle("print", (e, html, paper, height) => {
  if (!fromPos(e) || typeof html !== "string") return { ok: false, error: "Not allowed" };
  const job = printQueue.then(() => printSlip(html, Number(paper) || 80, Number(height) || 200));
  printQueue = job.then(() => {});
  return job;
});
ipcMain.handle("folder", async (e, change) => {
  if (!e.senderFrame?.url.startsWith("file:") || cfg.setupDone) return storeDir();
  if (!change) return storeDir();
  const pick = await dialog.showOpenDialog(win, { title: "Folder for the shop data", properties: ["openDirectory", "createDirectory"] });
  if (pick.canceled || !pick.filePaths[0]) return storeDir();
  const folder = path.join(pick.filePaths[0], "CRSP-POS-data");
  if (/onedrive|dropbox|google ?drive|icloud/i.test(folder) || folder.startsWith("\\\\")) { // a synced or network folder can corrupt a live database
    await dialog.showMessageBox(win, { type: "warning", message: "Choose a normal folder on this PC (not OneDrive, Google Drive, Dropbox or a network drive)." });
    return storeDir();
  }
  const old = cfg.dataFolder;
  quitting = true; stopServer(); stopDatabase(); quitting = false;
  try { cfg.dataFolder = folder; startDatabase(); save(); }
  catch (err) { cfg.dataFolder = old; startDatabase(); await dialog.showMessageBox(win, { type: "error", message: `That folder cannot be used.\n${err.message}` }); }
  startServer(); await waitForServer();
  return storeDir();
});
ipcMain.handle("demo", async (e) => {
  if (!e.senderFrame?.url.startsWith("file:") || cfg.setupDone) return { ok: false, error: "Not allowed" };
  cfg.demo = true; save();
  stopServer(); await new Promise((r) => setTimeout(r, 800)); startServer(); await waitForServer();
  cfg.setupDone = true; save(); buildMenu(); win.setTitle("CRSP POS (sample data)");
  setTimeout(() => win.loadURL(`${BASE}/pin`), 100);
  return { ok: true };
});
ipcMain.handle("setup", async (e, url, key) => {
  if (!e.senderFrame?.url.startsWith("file:")) return { ok: false, error: "Not allowed" };
  if (!/^https:\/\//.test(url) && !/^http:\/\/127\.0\.0\.1/.test(url)) return { ok: false, error: "The website address must start with https://" };
  cfg.cloudUrl = url; cfg.syncKey = key; save();
  stopServer(); await new Promise((r) => setTimeout(r, 800)); startServer(); await waitForServer();
  const r = await sync("pull");
  if (r.ok) { cfg.setupDone = true; cfg.lastSync = Date.now(); save(); buildMenu(); if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true }); setTimeout(() => win.loadURL(`${BASE}/pin`), 100); }
  return r;
});

/* ---------- life cycle ---------- */
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (win) { win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    loadConfig(); createWindow(); buildMenu();
    try {
      startDatabase(); startServer(); await waitForServer();
    } catch (e) { log(e.message); dialog.showErrorBox("CRSP POS could not start", e.message); return app.quit(); }
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!cfg.setupDone && !cfg.demo }); // the till opens by itself after a power cut
    if (cfg.setupDone) { await win.loadURL(`${BASE}/pin`); setTimeout(() => { if ((cfg.lastSync || 0) < lastDue()) void upload(false); }, 60_000); }
    else await win.loadFile(path.join(__dirname, "setup.html"));
    scheduleSync();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => { quitting = true; stopServer(); if (dataDir) stopDatabase(); });
}
