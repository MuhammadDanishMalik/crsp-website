import { describe, expect, it } from "vitest";
import { openingOfferBps } from "./opening-offer";

describe("opening offer", () => {
  it("runs from the first to the last day inclusive", () => {
    expect(openingOfferBps("2026-10-25")).toBe(0);
    expect(openingOfferBps("2026-10-26")).toBe(1000);
    expect(openingOfferBps("2026-11-01")).toBe(1000);
    expect(openingOfferBps("2026-11-02")).toBe(0);
  });
});
