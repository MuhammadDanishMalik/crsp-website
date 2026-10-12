#!/usr/bin/env node
// CRSP local print bridge — run on each POS machine:  node print-bridge/server.mjs
// POST /print {connection:"lan", address, port, data:<base64 ESC/POS>}  →  raw TCP to the printer (port 9100).
// Env: PORT (9101), ALLOWED_ORIGINS (comma list; default http://localhost:3000), ALLOW_HOSTS (optional printer IP allowlist)
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.PORT ?? 9101);
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000,https://www.crspofficial.com,https://crspofficial.com").split(",");
const HOSTS = process.env.ALLOW_HOSTS?.split(",").filter(Boolean);

function sendTcp(host, port, buf) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port, timeout: 3000 }, () => sock.end(buf));
    sock.on("close", () => resolve());
    sock.on("timeout", () => { sock.destroy(); reject(new Error("Printer timed out")); });
    sock.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const allowed = origin && ORIGINS.includes(origin);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  const json = (code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.method === "OPTIONS") return json(204, {});
  if (req.url === "/health") return json(200, { ok: true });
  if (req.method === "POST" && req.url === "/print") {
    if (origin && !allowed) return json(403, { ok: false, error: "Origin not allowed" });
    let body = "";
    for await (const c of req) { body += c; if (body.length > 2_000_000) return json(413, { ok: false, error: "Too large" }); }
    try {
      const { connection, address, port, data } = JSON.parse(body);
      if (connection !== "lan") return json(400, { ok: false, error: `Connection "${connection}" is not supported by this bridge yet (use LAN)` });
      if (HOSTS && !HOSTS.includes(address)) return json(403, { ok: false, error: "Printer host not allowed" });
      await sendTcp(address, port || 9100, Buffer.from(data, "base64"));
      return json(200, { ok: true });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }
  json(404, { ok: false });
});
server.listen(PORT, "127.0.0.1", () => console.log(`CRSP print bridge on http://127.0.0.1:${PORT}`));
