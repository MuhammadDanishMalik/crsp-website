import { computeTotals, unitPrice, lineTotal, type CartLine, type TaxRuleInput } from "@/lib/domain/pricing";
import type { ReceiptData } from "@/lib/queries/receipt";
import type { OfflineConfig } from "./types";

/** Build the receipt for an order rung offline (the server never saw it). Mirrors what loadReceipt returns. */
export function localReceipt(a: {
  cfg: OfflineConfig; localNo: string; createdAt: string; type: string; tableNo: string | null; lines: CartLine[]; taxRules: TaxRuleInput[];
  serviceChargeBps: number; payments: { method: string; amount: number; tendered?: number; approvalCode?: string; referenceNo?: string }[];
}): { receipt: ReceiptData; total: number; change: number } {
  const dominant = [...a.payments].sort((x, y) => y.amount - x.amount)[0]?.method ?? "cash";
  const t = computeTotals({ lines: a.lines, orderType: a.type, paymentMethod: dominant, taxRules: a.taxRules, serviceChargeBps: a.serviceChargeBps });
  const cash = a.payments.filter((p) => p.method === "cash"), nonCash = a.payments.filter((p) => p.method !== "cash").reduce((s, p) => s + p.amount, 0);
  const cashDue = t.total - nonCash;
  const tendered = cash.reduce((s, p) => s + (p.tendered ?? p.amount), 0);
  const change = cash.length ? Math.max(0, tendered - cashDue) : 0;
  const receipt: ReceiptData = {
    business: { name: a.cfg.info.businessName, ntn: a.cfg.info.ntn, header: a.cfg.info.header, footer: a.cfg.info.footer, footerUr: a.cfg.info.footerUr },
    branch: { name: a.cfg.info.branchName, address: a.cfg.info.address, phone: a.cfg.info.phone },
    orderNo: a.localNo, type: a.type, tableNo: a.tableNo, cashier: a.cfg.staffName, terminal: a.cfg.terminalName, createdAt: a.createdAt, customer: null, deliveryAddress: null,
    lines: a.lines.map((l) => ({ name: l.name, qty: l.quantity, unit: unitPrice(l), total: lineTotal(l), mods: l.modifiers.map((m) => m.name), note: l.note ?? null })),
    subtotal: t.subtotal, discount: t.discountTotal, serviceCharge: t.serviceCharge, deliveryCharge: t.deliveryCharge,
    taxLines: t.taxLines.map((x) => ({ name: x.name, rateBps: x.rateBps, amount: x.amount })), total: t.total,
    payments: a.payments.map((p) => ({ method: p.method, amount: p.method === "cash" ? Math.min(p.amount, cashDue) : p.amount, tendered: p.method === "cash" ? (p.tendered ?? p.amount) : null, change: p.method === "cash" ? change : null, status: p.method === "cash" ? "confirmed" : "pending_verification", reference: p.approvalCode ?? p.referenceNo ?? null })),
    taxInvoiceNo: null, qr: null, taxPending: true,
  };
  return { receipt, total: t.total, change };
}
