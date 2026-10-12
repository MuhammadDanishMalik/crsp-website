/* CRSP POS service worker — lets the cashier screen open and keep selling with no internet.
 *  - static files (JS/CSS/fonts/logo): cache first
 *  - the POS pages themselves: network first (3 s), fall back to the last copy we saw
 *  - never touches /api, server actions (POST) or anything outside this site
 * Bump VERSION to force every device to drop its old cache. */
const VERSION = "crsp-v1";
const PAGES = ["/order", "/pin", "/terminal", "/start", "/kds", "/status", "/customer", "/rider", "/shift", "/orders"];
const isPage = (url) => PAGES.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"));

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 3000))]);
    if (res && res.status === 200 && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreVary: true });
    if (hit) return hit;
    const fetched = await fetch(req).catch(() => null); // slow network but not offline: wait for the real answer
    return fetched || new Response("Offline and this page was never opened on this device.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.status === 200) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname === "/icon.png") return void e.respondWith(cacheFirst(req));
  if (isPage(url)) return void e.respondWith(networkFirst(req));
});
