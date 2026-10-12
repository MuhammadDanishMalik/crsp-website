import { describe, expect, it } from "vitest";
import { retryDelayMinutes } from "@/lib/adapters/tax-authority";
import { mockAdapter } from "@/lib/adapters/tax-authority/mock";

describe("tax authority module", () => {
  it("backs off exponentially and caps at an hour", () => {
    expect([1, 2, 3, 4, 7, 12].map(retryDelayMinutes)).toEqual([1, 2, 4, 8, 60, 60]);
  });
  it("mock adapter returns a stable invoice number and QR text", async () => {
    const r = await mockAdapter.submit({ invoiceRef: "x", orderNo: "012", issuedAt: "2026-10-07T10:00:00.000Z", branch: { code: "MWL", name: "A", posId: null, taxRegistrationNo: null, ntn: null }, items: [], subtotal: 100, discount: 0, serviceCharge: 0, deliveryCharge: 0, taxLines: [], taxTotal: 16, total: 11600, paymentMethods: ["cash"] });
    expect(r.invoiceNo).toBe("MOCK-MWL-20261007-012");
    expect(r.qrPayload).toContain("116.00");
  });
});
