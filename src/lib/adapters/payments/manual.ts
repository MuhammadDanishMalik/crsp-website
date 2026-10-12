import type { PaymentProvider, PayMethod } from "./types";

const ALL: PayMethod[] = ["cash", "card", "jazzcash", "easypaisa", "raast", "bank_transfer"];

/** Phase-1 behaviour: the human is the integration. Card/wallet need the approval code; transfers wait for verification. */
export const manualProvider: PaymentProvider = {
  id: "manual", label: "Manual (cashier enters the approval code)", methods: ALL,
  async initiate(r) {
    if (r.method === "cash") return { state: "confirmed" };
    if (r.method === "raast" || r.method === "bank_transfer") return { state: r.referenceNo ? "pending_verification" : "failed", providerRef: r.referenceNo, message: r.referenceNo ? undefined : "Enter the transfer reference number" };
    if (!r.approvalCode) return { state: "failed", message: "Enter the terminal approval / transaction ID" };
    return { state: "confirmed", providerRef: r.approvalCode };
  },
  async confirm() { return { state: "confirmed" }; },
  async refund() { return { ok: true, message: "Return the money manually (card terminal / wallet app / cash)" }; },
  async getStatus() { return { state: "confirmed" }; },
};
