"use client";
import { useEffect } from "react";

/** Registers the offline service worker in production builds (or when NEXT_PUBLIC_ENABLE_SW=1). Dev builds skip it: it would cache stale code. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_SW !== "1") return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* blocked (private window): the app still works online */ });
  }, []);
  return null;
}
