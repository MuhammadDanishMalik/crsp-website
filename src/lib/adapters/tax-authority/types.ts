/** Neutral invoice description we hand to an authority adapter. Each adapter maps it to its authority's own format. */
export type InvoicePayload = {
  invoiceRef: string; // our order id (idempotency key)
  orderNo: string;
  issuedAt: string; // ISO
  branch: { code: string; name: string; posId: string | null; taxRegistrationNo: string | null; ntn: string | null };
  items: { name: string; qty: number; unitPrice: number; total: number }[]; // paisa
  subtotal: number; discount: number; serviceCharge: number; deliveryCharge: number;
  taxLines: { name: string; rateBps: number; amount: number }[];
  taxTotal: number; total: number; paymentMethods: string[];
};
export type InvoiceResult = { invoiceNo: string; qrPayload: string; raw?: unknown };

export interface TaxAuthorityAdapter {
  readonly id: string;
  submit(p: InvoicePayload): Promise<InvoiceResult>;
  /** Best-effort cancellation (void). Authorities usually require a credit note — see README. */
  cancel(invoiceNo: string, reason: string): Promise<void>;
}
