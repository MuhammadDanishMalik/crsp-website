// CRSP POS for Windows. This window starts a local PostgreSQL database and the POS server on THIS PC, so selling never needs internet.
// Every 2 hours, when there is internet, it copies what changed to the website and fetches new customers. Rules: docs/PERFORMANCE.md.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

app.setName("CRSP POS");
const WEB_PORT = 3777, PG_PORT = 5499;
const SYNC_EVERY = 2 * 60 * 60_000; // copy to the website every 2 hours (and shortly after start)
const RECEIPT_DAYS = 30;
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
  cfg.paperMode ||= "driver"; cfg.scale ||= 100; cfg.dbPassword ||= secret(); cfg.sessionSecret ||= secret(); cfg.localToken ||= secret();
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
async function upload(manual) {
  if (cfg.demo) { if (manual) await dialog.showMessageBox(win, { message: "This is sample data for testing: nothing is uploaded." }); return; }
  if (syncing || !cfg.setupDone) return;
  syncing = true;
  try {
    const r = await sync("push");
    if (r.ok) { cfg.lastSync = Date.now(); cfg.lastError = r.errors.length ? r.errors[0] : ""; } else cfg.lastError = r.error;
    save(); buildMenu();
    if (manual) await dialog.showMessageBox(win, { message: r.ok ? `Online copy is up to date.\nSent: ${r.rows} records. New customers received: ${r.received || 0}.${r.errors.length ? `\n${r.errors.length} could not be copied: ${r.errors[0]}` : ""}` : `Not uploaded: ${r.error}\nThe sales are safe on this PC and will be sent later.` });
  } catch (e) { log(`sync failed ${e.message}`); } finally { syncing = false; }
}
// looked at every 5 minutes: when 2 hours have passed since the last good copy, copy again; with no internet it keeps trying
const scheduleSync = () => {
  const due = () => { if (Date.now() - (cfg.lastSync || 0) >= SYNC_EVERY - 60_000) void upload(false); };
  setTimeout(due, 60_000);
  setInterval(due, 5 * 60_000);
};

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
      { type: "separator" }, { label: "Reload screen", accelerator: "CmdOrCtrl+Shift+R", click: () => win.reload() }, { role: "togglefullscreen" }, // zoom keys are not bound: Ctrl + number belongs to the POS
      { label: "Bigger text", click: () => win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5) }, { label: "Smaller text", click: () => win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5) },
      { type: "separator" }, { label: "Close CRSP POS", click: () => app.quit() },
    ] },
    { label: "Printer", submenu: [
      { label: "Receipt printer (automatic)", type: "radio", checked: !cfg.printer, click: () => { cfg.printer = ""; save(); buildMenu(); } },
      ...printers.map((p) => ({ label: p.displayName || p.name, type: "radio", checked: cfg.printer === p.name, click: () => { cfg.printer = p.name; save(); buildMenu(); } })),
      { type: "separator" },
      { label: "Print TEST slip (check size)", id: "print-test", click: () => void printTest() },
      { type: "separator" },
      { label: "Paper: printer's own size (recommended)", type: "radio", checked: cfg.paperMode !== "exact", click: () => { cfg.paperMode = "driver"; save(); buildMenu(); } },
      { label: "Paper: exact slip size", type: "radio", checked: cfg.paperMode === "exact", click: () => { cfg.paperMode = "exact"; save(); buildMenu(); } },
      { label: "Size of print", submenu: [80, 85, 90, 95, 100, 105, 110].map((n) => ({ label: `${n}%${n === 100 ? " (normal)" : ""}`, type: "radio", checked: (cfg.scale || 100) === n, click: () => { cfg.scale = n; save(); buildMenu(); } })) },
      { type: "separator" },
      { label: "Refresh printer list", click: () => void refreshPrinters() },
      { label: "Open saved receipts", click: () => { const d = path.join(storeDir(), "receipts"); fs.mkdirSync(d, { recursive: true }); void shell.openPath(d); } },
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
  win.loadFile(path.join(__dirname, "splash.html"));
}

/* ---------- printing ----------
   A copy of every slip is saved in the data folder ("receipts"), so a receipt is never lost. Then it goes straight to the receipt printer. */
let printQueue = Promise.resolve();
let printers = [];
const VIRTUAL = /pdf|xps|onenote|fax|document writer|send to/i;
const THERMAL = /thermal|receipt|pos|80 ?mm|58 ?mm|xp-|tm-|bixolon|blackcopper|black copper|bc-|rongta|rp-|zj-|gprinter/i;
async function refreshPrinters() {
  try { printers = await win.webContents.getPrintersAsync(); } catch (e) { log(`printers: ${e.message}`); printers = []; }
  buildMenu();
}
function receiptPrinter() {
  const real = printers.filter((p) => !VIRTUAL.test(p.name));
  return real.find((p) => p.name === cfg.printer) || real.find((p) => THERMAL.test(p.name)) || real[0] || null;
}
async function saveCopy(w) {
  const now = new Date(), day = now.toLocaleDateString("en-CA");
  const dir = path.join(storeDir(), "receipts", day);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${now.toTimeString().slice(0, 8).replace(/:/g, "-")}-${now.getMilliseconds()}.pdf`);
  fs.writeFileSync(file, await w.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true }));
  return file;
}
function cleanReceipts() {
  const root = path.join(storeDir(), "receipts"), limit = Date.now() - RECEIPT_DAYS * 86_400_000;
  try { for (const d of fs.readdirSync(root)) if (new Date(d).getTime() < limit) fs.rmSync(path.join(root, d), { recursive: true, force: true }); } catch { /* none yet */ }
}
const send = (w, options) => new Promise((resolve) => w.webContents.print(options, (ok, reason) => resolve(ok ? "" : reason || "failed")));
async function printSlip(html, paperMm, heightMm) {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  const file = path.join(dataDir, "slip.html");
  try {
    fs.writeFileSync(file, html.replace("<head>", `<head><meta charset="utf-8"><base href="${BASE}/">`));
    await w.loadFile(file);
    let saved = "";
    try { saved = await saveCopy(w); } catch (e) { log(`receipt copy: ${e.message}`); }
    if (process.env.CRSP_PRINT_TO_FILE && saved) { fs.copyFileSync(saved, process.env.CRSP_PRINT_TO_FILE); return { ok: true, note: "Saved (test)" }; } // used by tests
    if (!printers.length) await refreshPrinters();
    const printer = receiptPrinter();
    if (!printer) return saved ? { ok: true, note: "No receipt printer found: the slip is saved (Printer menu > Open saved receipts)" } : { ok: false, error: "No receipt printer found" };
    // Default: the printer's OWN paper (an 80 mm roll). Thermal drivers often ignore or mis-scale a custom size, which gives cut-off / tiny / huge slips.
    const base = { silent: true, printBackground: true, margins: { marginType: "none" }, deviceName: printer.name, scaleFactor: cfg.scale || 100 };
    const exact = { ...base, pageSize: { width: Math.round(paperMm * 1000), height: Math.round(heightMm * 1000) } };
    const [first, second] = cfg.paperMode === "exact" ? [exact, base] : [base, exact];
    log(`print on "${printer.name}" mode=${cfg.paperMode || "driver"} scale=${base.scaleFactor}`);
    let problem = await send(w, first);
    if (problem) problem = await send(w, second);
    if (problem) { log(`print ${printer.name}: ${problem}`); return { ok: false, error: `The printer "${printer.name}" did not print. The slip is saved; check the printer and press Print again.` }; }
    return { ok: true, note: `Sent to ${printer.displayName || printer.name}` };
  } catch (e) { log(`print: ${e.message}`); return { ok: false, error: e.message }; } finally { w.destroy(); }
}

/* The sync key is copied to the shop PC as a small file; the app finds it so the operator only has to choose a folder. */
function findSyncKey() {
  const places = [];
  for (const n of ["desktop", "downloads", "documents"]) { try { const d = app.getPath(n); places.push(d, path.join(d, "CRSP-POS-Windows")); } catch { /* no such folder */ } }
  if (process.platform === "win32") for (const drive of "DEFGHIJ") places.push(`${drive}:\\`, `${drive}:\\CRSP-POS-Windows`);
  for (const dir of places) for (const name of ["sync-key.txt", "crsp-sync-key.txt", "sync-key.txt.txt"]) {
    try { const key = fs.readFileSync(path.join(dir, name), "utf8").trim(); if (/^[A-Za-z0-9]{32,128}$/.test(key)) return key; } catch { /* not here */ }
  }
  return "";
}
ipcMain.handle("hasKey", (e) => !!e.senderFrame?.url.startsWith("file:") && !!findSyncKey());

/* A test slip with rulers: shows at a glance whether the paper width, the print width and the size are right. */
async function printTest() {
  const p = receiptPrinter();
  const marks = Array.from({ length: 9 }, (_, i) => `<span style="position:absolute;left:${i * 10}mm;top:0;border-left:1px solid #000;height:${i % 5 === 0 ? 7 : 4}mm;font:8px Arial;padding-left:1px">${i * 10 ? i : ""}</span>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:0}body{margin:0;width:80mm;font:700 15px/1.3 Arial;color:#000}
    .box{border:2px solid #000;margin:2mm 0;padding:1mm;text-align:center}.ruler{position:relative;height:9mm;width:80mm;border-bottom:1px solid #000}</style></head><body>
    <div style="text-align:center;font-size:18px">PRINT TEST</div><div style="text-align:center;font-size:12px">${(p ? p.displayName || p.name : "no printer").replace(/</g, "")}</div>
    <div class="ruler">${marks}</div><div style="font-size:10px">cm marks: 0 ... 8 (the full 80 mm paper)</div>
    <div class="box" style="width:72mm;margin-left:4mm">72 mm box: both lines must show</div>
    <div>1234567890123456789012345678</div><div>ABCDEFGHIJKLMNOPQRSTUVWXYZAB</div>
    <div style="display:flex;justify-content:space-between;padding:0 4mm"><span>left</span><span>Rs 450</span><span>right</span></div>
    <div style="text-align:center;font-size:11px;margin-top:3mm">If the box is cut or the slip is small/large:<br>Printer menu > Size of print, or change Paper mode</div><div style="height:8mm"></div></body></html>`;
  const r = await printSlip(html, 80, 120);
  await dialog.showMessageBox(win, { message: r.ok ? `Test slip: ${r.note}` : `Test slip failed: ${r.error}` });
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
  key = key || findSyncKey();
  if (!key) return { ok: false, error: "Sync key not found. Copy sync-key.txt to the Desktop, or paste the key." };
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
    if (cfg.setupDone) await win.loadURL(`${BASE}/pin`);
    else await win.loadFile(path.join(__dirname, "setup.html"));
    await refreshPrinters();
    cleanReceipts();
    scheduleSync();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => { quitting = true; stopServer(); if (dataDir) stopDatabase(); });
}
