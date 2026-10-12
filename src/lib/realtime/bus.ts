import "server-only";

/**
 * In-process event bus fanned out to browsers over SSE (/api/events).
 * Fine for a single Next.js server per site (the normal POS deployment).
 * For multiple instances swap `publish` to Supabase Realtime / Postgres NOTIFY — callers don't change.
 * Clients also poll as a fallback, so a missed event only delays a screen, never loses data.
 */
export type BranchEvent = { type: "order.created" | "order.updated" | "order.voided" | "menu.changed" | "kds.changed"; orderId?: string };
type Listener = (e: BranchEvent) => void;

const g = globalThis as unknown as { __crspBus?: Map<string, Set<Listener>> };
const listeners = (g.__crspBus ??= new Map());

export function publish(branchId: string, event: BranchEvent) {
  for (const l of listeners.get(branchId) ?? []) l(event);
}
export function subscribe(branchId: string, l: Listener) {
  const set = listeners.get(branchId) ?? new Set();
  set.add(l);
  listeners.set(branchId, set);
  return () => { set.delete(l); };
}
