"use client";
import { createOrder } from "@/lib/actions/orders";
import { markFailed, refreshOutbox, removeFromOutbox } from "./outbox";
import { localDb } from "./db";

let running = false;
export type SyncResult = { synced: number; failed: number; stopped: "offline" | "login" | null };

/**
 * Push queued orders to the server, oldest first. Safe to call often: it is single-flight and every order carries its
 * own id, so a retry after a half-finished request can never create a duplicate.
 *  - network error  → stop, keep everything queued
 *  - not signed in  → stop, keep queued (they sync after the next PIN login)
 *  - business error → mark that order "failed" (needs a manager) and continue with the next
 */
export async function syncOutbox(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, stopped: null };
  if (running || typeof navigator === "undefined" || !navigator.onLine) return { ...result, stopped: "offline" };
  running = true;
  try {
    const rows = (await localDb().outbox.where("status").equals("queued").sortBy("createdAt"));
    for (const row of rows) {
      let r: Awaited<ReturnType<typeof createOrder>>;
      try { r = await createOrder(row.payload); } catch { result.stopped = "offline"; break; }
      if (r.ok) { await removeFromOutbox(row.clientId); result.synced++; continue; }
      if (/not signed in|missing permission/i.test(r.error)) { result.stopped = "login"; break; }
      await markFailed(row.clientId, r.error); result.failed++;
    }
  } finally { running = false; await refreshOutbox(); }
  return result;
}
