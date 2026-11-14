import { describe, expect, it } from "vitest";
import { deliveryChargeFor } from "./delivery";

describe("delivery charge", () => {
  it("Rs 100 from Rs 1000, none below, only for delivery", () => {
    expect(deliveryChargeFor("delivery", 99_999)).toBe(0);
    expect(deliveryChargeFor("delivery", 100_000)).toBe(10_000);
    expect(deliveryChargeFor("takeaway", 500_000)).toBe(0);
  });
  it("what the cashier types wins, within Rs 0 to Rs 500", () => {
    expect(deliveryChargeFor("delivery", 50_000, 15_000)).toBe(15_000);
    expect(deliveryChargeFor("delivery", 500_000, 0)).toBe(0);
    expect(deliveryChargeFor("delivery", 500_000, 9_999_999)).toBe(50_000);
  });
});
