"use client";
import { useEffect, useRef } from "react";

/**
 * Live updates for a screen. See docs/PERFORMANCE.md before changing.
 * ONE EventSource and ONE timer per browser tab, shared by every screen part that listens:
 *  - server events arrive at once, bursts are merged into one call
 *  - the fallback poll pauses while the tab is hidden
 *  - a listener that is still busy is never started again on top of itself
 */
type Result = void | Promise<unknown>;
type Sub = { run: (type?: string) => Result; pollMs: number; last: number; busy: boolean; types: Set<string | undefined> };

const subs = new Set<Sub>();
let source: EventSource | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let burst: ReturnType<typeof setTimeout> | null = null;

async function fire(sub: Sub) {
  if (sub.busy || !subs.has(sub)) return;
  sub.busy = true;
  const type = sub.types.has("menu.changed") ? "menu.changed" : [...sub.types].at(-1);
  sub.types.clear();
  sub.last = Date.now();
  try { await sub.run(type); } catch { /* offline or deploying: the next round tries again */ }
  sub.busy = false;
}
function onServerEvent(type?: string) {
  subs.forEach((s) => s.types.add(type));
  if (!burst) burst = setTimeout(() => { burst = null; subs.forEach((s) => { if (s.types.size) void fire(s); }); }, 700);
}
function tick() {
  const hidden = document.hidden;
  const now = Date.now();
  subs.forEach((s) => { if (s.types.size || (!hidden && now - s.last >= s.pollMs)) void fire(s); });
}
function start() {
  source = new EventSource("/api/events");
  source.onmessage = (m) => { try { onServerEvent(JSON.parse(m.data).type); } catch { onServerEvent(); } };
  ticker = setInterval(tick, 5_000);
  document.addEventListener("visibilitychange", tick);
}
function stop() {
  source?.close(); source = null;
  if (ticker) clearInterval(ticker);
  if (burst) clearTimeout(burst);
  ticker = null; burst = null;
  document.removeEventListener("visibilitychange", tick);
}

/** `onEvent` fires on server events and, as a fallback, every `pollMs`. Return the promise of your work so calls never pile up. */
export function useBranchEvents(onEvent: (type?: string) => Result, pollMs = 30_000) {
  const ref = useRef(onEvent);
  useEffect(() => { ref.current = onEvent; });
  useEffect(() => {
    const sub: Sub = { run: (t) => ref.current(t), pollMs, last: Date.now(), busy: false, types: new Set() };
    subs.add(sub);
    if (!source) start();
    return () => { subs.delete(sub); if (!subs.size) stop(); };
  }, [pollMs]);
}
