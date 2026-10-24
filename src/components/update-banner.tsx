"use client";
import { useEffect, useRef, useState } from "react";

/** Tells an open till when a new version was deployed, so it never keeps running old code that the server no longer understands. */
export function UpdateBanner() {
  const first = useRef<string | null>(null);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const check = async () => {
      try {
        const id = ((await (await fetch("/api/version", { cache: "no-store" })).json()) as { id: string }).id;
        if (first.current === null) first.current = id;
        else if (id !== first.current) setStale(true);
      } catch { /* offline: try again later */ }
    };
    void check();
    const t = setInterval(check, 120_000);
    window.addEventListener("focus", check);
    return () => { clearInterval(t); window.removeEventListener("focus", check); };
  }, []);
  if (!stale) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[200] flex items-center justify-center gap-3 bg-brand px-4 py-3 text-brand-fg shadow-2xl">
      <span className="font-semibold">A new version of CRSP POS is ready.</span>
      <button onClick={() => reloadClean()} className="min-h-11 rounded-xl bg-white px-4 font-bold text-black">Reload now</button>
    </div>
  );
}

/** Drop cached copies and load the page fresh. */
export async function reloadClean() {
  try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* no cache API */ }
  location.reload();
}
