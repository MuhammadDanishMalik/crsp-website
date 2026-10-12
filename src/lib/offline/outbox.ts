"use client";
import { useSyncExternalStore } from "react";
import { localDb } from "./db";
import type { OutboxRow } from "./types";

type Snapshot = { queued: number; failed: number; rows: OutboxRow[] };
const EMPTY: Snapshot = { queued: 0, failed: 0, rows: [] };
let snap: Snapshot = EMPTY;
const listeners = new Set<() => void>();

async function refresh() {
  try {
    const rows = await localDb().outbox.orderBy("createdAt").toArray();
    snap = { queued: rows.filter((r) => r.status === "queued").length, failed: rows.filter((r) => r.status === "failed").length, rows };
  } catch { snap = EMPTY; } // IndexedDB blocked (private window): behave as if nothing is queued
  listeners.forEach((l) => l());
}

export function useOutbox(): Snapshot {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); void refresh(); return () => listeners.delete(cb); },
    () => snap, () => EMPTY,
  );
}

export async function enqueue(row: OutboxRow) { await localDb().outbox.put(row); await refresh(); }
export async function removeFromOutbox(clientId: string) { await localDb().outbox.delete(clientId); await refresh(); }
export async function markFailed(clientId: string, error: string) {
  const r = await localDb().outbox.get(clientId);
  if (r) await localDb().outbox.put({ ...r, status: "failed", error, attempts: r.attempts + 1 });
  await refresh();
}
export async function requeue(clientId: string) {
  const r = await localDb().outbox.get(clientId);
  if (r) await localDb().outbox.put({ ...r, status: "queued", error: "" });
  await refresh();
}
export const refreshOutbox = refresh;

/** Offline order numbers: terminal prefix + a per-day counter kept on this device (e.g. A007). Unique across terminals thanks to the prefix. */
export async function nextLocalNo(prefix: string, businessDate: string): Promise<string> {
  const db = localDb();
  return db.transaction("rw", db.meta, async () => {
    const key = `seq:${prefix}:${businessDate}`;
    const n = ((await db.meta.get(key))?.value ?? 0) + 1;
    await db.meta.put({ key, value: n });
    return `${prefix}${String(n).padStart(3, "0")}`;
  });
}
