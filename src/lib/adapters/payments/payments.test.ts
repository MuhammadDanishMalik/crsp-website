import { describe, expect, it } from "vitest";
import { getProvider, providersFor } from "./index";

describe("payment providers", () => {
  it("manual: card needs an approval code, transfer waits for verification", async () => {
    const m = getProvider("manual");
    expect((await m.initiate({ orderId: "o", method: "card", amount: 100 })).state).toBe("failed");
    expect((await m.initiate({ orderId: "o", method: "card", amount: 100, approvalCode: "123456" })).state).toBe("confirmed");
    expect((await m.initiate({ orderId: "o", method: "raast", amount: 100, referenceNo: "R1" })).state).toBe("pending_verification");
  });
  it("mock gateway: initiate → confirm, declines Rs …13", async () => {
    const g = getProvider("mock-wallet");
    const ok = await g.initiate({ orderId: "o", method: "jazzcash", amount: 50_000 });
    expect(ok.state).toBe("pending");
    expect((await g.confirm(ok.providerRef!)).state).toBe("confirmed");
    expect((await g.initiate({ orderId: "o", method: "jazzcash", amount: 11_300 })).state).toBe("failed");
  });
  it("unknown provider falls back to manual; only matching providers are offered per method", () => {
    expect(getProvider("nope").id).toBe("manual");
    expect(providersFor("card").map((p) => p.id)).toEqual(["manual", "mock-card"]);
  });
});
