export type PayMethod = "cash" | "card" | "jazzcash" | "easypaisa" | "raast" | "bank_transfer";
export type PayState = "pending" | "pending_verification" | "confirmed" | "failed";

export type InitiateRequest = { orderId: string; method: PayMethod; amount: number; approvalCode?: string; referenceNo?: string; cardBrand?: string; customerPhone?: string };
export type InitiateResult = { state: PayState; providerRef?: string; message?: string };

/**
 * One interface for every way of taking non-cash money. `manual` (cashier types the terminal approval / transaction id)
 * is the default; gateway adapters implement the same four calls so the order flow never changes.
 */
export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  readonly methods: PayMethod[];
  initiate(req: InitiateRequest): Promise<InitiateResult>;
  confirm(providerRef: string, input?: { approvalCode?: string }): Promise<{ state: PayState; message?: string }>;
  refund(providerRef: string | null, amount: number, reason: string): Promise<{ ok: boolean; refundRef?: string; message?: string }>;
  getStatus(providerRef: string): Promise<{ state: PayState }>;
}
