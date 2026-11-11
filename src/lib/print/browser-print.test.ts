import { describe, expect, it } from "vitest";
import { buildSlipDocs } from "./browser-print";
import type { ReceiptData } from "@/lib/queries/receipt";

const base: ReceiptData = {
  business: { name: "CRSP", ntn: null, header: "", footer: "Thank you", footerUr: "" }, branch: { name: "Watta Khail Chowk", address: "Mianwali", phone: "0309 0135353" },
  orderNo: "012", type: "delivery", tableNo: null, cashier: "", terminal: "POS-1", createdAt: "2026-11-11T10:00:00.000Z",
  customer: { name: "Ali Khan", phone: "03001234567" }, deliveryAddress: "House 5, Street 2, Mianwali",
  lines: [{ name: "CRSP (Zinger)", qty: 2, unit: 45000, total: 90000, mods: ["Spicy"], note: null }],
  subtotal: 90000, discount: 0, serviceCharge: 0, deliveryCharge: 0, taxLines: [], total: 90000,
  payments: [{ method: "cash", amount: 90000, tendered: null, change: null, status: "pending", reference: null }], taxInvoiceNo: null, qr: null, taxPending: false,
};

describe("delivery slips", () => {
  it("a delivery sale prints kitchen, customer and rider slips", async () => {
    const docs = await buildSlipDocs(base);
    expect(docs).toHaveLength(3);
    expect(docs[0]).toContain("KITCHEN ORDER");
    expect(docs[1]).toContain("Order #012");
    expect(docs[2]).toContain("RIDER SLIP");
    expect(docs[2]).toContain("Ali Khan");
    expect(docs[2]).toContain("03001234567");
    expect(docs[2]).toContain("House 5, Street 2, Mianwali");
    expect(docs[2]).toContain("COLLECT CASH");
  });
  it("a paid delivery says PAID, and other order types have no rider slip", async () => {
    const paid = await buildSlipDocs({ ...base, payments: [{ ...base.payments[0], status: "confirmed" }] });
    expect(paid[2]).toContain("PAID:");
    expect(await buildSlipDocs({ ...base, type: "takeaway" })).toHaveLength(2);
  });
  it("a reprint (customer only) does not print the rider slip", async () => {
    expect(await buildSlipDocs(base, { kitchen: false })).toHaveLength(1);
  });
});
