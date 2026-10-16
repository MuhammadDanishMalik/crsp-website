import { describe, expect, it } from "vitest";
import { buildOrderSlips } from "./escpos";
import type { ReceiptData } from "@/lib/queries/receipt";

const r: ReceiptData = {
  business: { name: "CRSP", ntn: null, header: "", footer: "Thank you!", footerUr: "" }, branch: { name: "Watta Khail Chowk", address: null, phone: null },
  orderNo: "012", type: "takeaway", tableNo: null, cashier: "Bilal", terminal: "POS-1", createdAt: "2026-10-16T10:00:00.000Z", customer: null, deliveryAddress: null,
  lines: [{ name: "Zinger Burger", qty: 2, unit: 52000, total: 104000, mods: ["Spicy"], note: null }], subtotal: 104000, discount: 0, serviceCharge: 0, deliveryCharge: 0,
  taxLines: [], total: 104000, payments: [{ method: "cash", amount: 104000, tendered: 104000, change: 0, status: "confirmed", reference: null }], taxInvoiceNo: null, qr: null, taxPending: false,
};
const text = (b: Uint8Array) => new TextDecoder("latin1").decode(b);
const cuts = (b: Uint8Array) => { let n = 0; for (let i = 0; i < b.length - 3; i++) if (b[i] === 0x1d && b[i + 1] === 0x56 && b[i + 2] === 0x42) n++; return n; };

describe("order slips", () => {
  it("prints kitchen slip then customer receipt, each followed by a cut", () => {
    const b = buildOrderSlips(r, { paperMm: 80, openDrawer: false, kitchen: true });
    const t = text(b);
    expect(cuts(b)).toBe(2);
    expect(t.indexOf("KITCHEN ORDER")).toBeGreaterThanOrEqual(0);
    expect(t.indexOf("KITCHEN ORDER")).toBeLessThan(t.indexOf("TOTAL"));
    expect(t.slice(0, t.indexOf("TOTAL"))).not.toContain("52,000"); // no prices on the kitchen slip
    expect(t).toContain("Software powered by Orixto.com");
  });
  it("reprint sends only the customer receipt", () => {
    const b = buildOrderSlips(r, { paperMm: 80, openDrawer: false, kitchen: false });
    expect(cuts(b)).toBe(1);
    expect(text(b)).not.toContain("KITCHEN ORDER");
  });
});
