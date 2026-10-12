import type { PaymentProvider, PayMethod } from "./types";

/**
 * Stand-in for a real wallet / card gateway so the full flow can be tried without credentials.
 * It approves everything except amounts ending in 13 paisa-rupees (e.g. Rs 113) which it declines — handy for testing the "declined" path.
 * To plug in a real gateway copy this file, keep the same four methods, call the gateway's HTTP API with credentials from env,
 * and register it in ./index.ts. Nothing else in the app changes.
 */
const mem = new Map<string, { amount: number; state: "pending" | "confirmed" | "failed" }>();

export const mockGateway = (id: string, label: string, methods: PayMethod[]): PaymentProvider => ({
  id, label, methods,
  async initiate(r) {
    const ref = `${id.toUpperCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const declined = Math.round(r.amount / 100) % 100 === 13;
    mem.set(ref, { amount: r.amount, state: declined ? "failed" : "pending" });
    return declined ? { state: "failed", providerRef: ref, message: "Declined by the gateway (mock)" } : { state: "pending", providerRef: ref };
  },
  async confirm(ref) {
    const p = mem.get(ref);
    if (p && p.state === "pending") p.state = "confirmed";
    // After a server restart the in-memory record is gone; a real gateway would answer from its own database.
    return { state: p?.state === "failed" ? "failed" : "confirmed" };
  },
  async refund(ref, amount) { return { ok: true, refundRef: `RF-${ref ?? "NA"}-${amount}`, message: "Refund accepted by the mock gateway" }; },
  async getStatus(ref) { return { state: mem.get(ref)?.state ?? "confirmed" }; },
});
