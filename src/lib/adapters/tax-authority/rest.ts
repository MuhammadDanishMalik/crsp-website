import type { InvoicePayload, InvoiceResult, TaxAuthorityAdapter } from "./types";

/**
 * Generic REST adapter used for both FBR and PRA until the exact request format is supplied.
 * It POSTs our neutral JSON to `<PREFIX>_API_URL` with `Authorization: Bearer <PREFIX>_TOKEN` and reads the invoice
 * number / QR text from configurable response fields. A real integration normally needs a mapping step
 * (their field names, HS codes, seller NTN…) — add it in `toAuthorityBody` once you have the authority's spec.
 *
 *   FBR_API_URL, FBR_TOKEN, FBR_INVOICE_FIELD (default "invoiceNo"), FBR_QR_FIELD (default "qr")
 *   PRA_API_URL, PRA_TOKEN, PRA_INVOICE_FIELD, PRA_QR_FIELD
 */
export function restAdapter(prefix: "FBR" | "PRA"): TaxAuthorityAdapter | null {
  const url = process.env[`${prefix}_API_URL`];
  if (!url) return null;
  const token = process.env[`${prefix}_TOKEN`];
  const invField = process.env[`${prefix}_INVOICE_FIELD`] ?? "invoiceNo";
  const qrField = process.env[`${prefix}_QR_FIELD`] ?? "qr";
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const toAuthorityBody = (p: InvoicePayload) => p; // ← map to the authority's format here

  const pick = (o: unknown, path: string) => path.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), o);
  return {
    id: prefix.toLowerCase(),
    async submit(p) {
      const res = await fetch(`${url.replace(/\/$/, "")}/invoices`, { method: "POST", headers, body: JSON.stringify(toAuthorityBody(p)), signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`${prefix} responded ${res.status}`);
      const raw = await res.json().catch(() => ({}));
      const invoiceNo = pick(raw, invField);
      if (typeof invoiceNo !== "string" || !invoiceNo) throw new Error(`${prefix} response had no "${invField}" field`);
      const qr = pick(raw, qrField);
      return { invoiceNo, qrPayload: typeof qr === "string" && qr ? qr : invoiceNo, raw } satisfies InvoiceResult;
    },
    async cancel(invoiceNo, reason) {
      const res = await fetch(`${url.replace(/\/$/, "")}/invoices/${encodeURIComponent(invoiceNo)}/cancel`, { method: "POST", headers, body: JSON.stringify({ reason }), signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`${prefix} cancel responded ${res.status}`);
    },
  };
}
