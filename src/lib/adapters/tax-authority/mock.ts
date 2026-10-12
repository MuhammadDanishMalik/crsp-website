import type { InvoicePayload, InvoiceResult, TaxAuthorityAdapter } from "./types";

/** Offline stand-in used in development: invents a plausible invoice number and QR text. Never use for real filing. */
export const mockAdapter: TaxAuthorityAdapter = {
  id: "mock",
  async submit(p: InvoicePayload): Promise<InvoiceResult> {
    const day = p.issuedAt.slice(0, 10).replace(/-/g, "");
    const invoiceNo = `MOCK-${p.branch.code}-${day}-${p.orderNo}`;
    return { invoiceNo, qrPayload: `CRSP|${invoiceNo}|${(p.total / 100).toFixed(2)}|${p.issuedAt}` };
  },
  async cancel() { /* nothing to cancel */ },
};
