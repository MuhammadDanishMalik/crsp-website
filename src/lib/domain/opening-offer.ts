import { businessDate } from "./dates";

/** Grand-opening offer: this percentage comes off every order that has no other discount, from start to end (both days included, Asia/Karachi). */
export const OPENING_OFFER = { bps: 1000, start: "2026-10-26", end: "2026-11-01", label: "Opening week 10%" } as const;

/** Offer percentage (basis points) that applies on the given business date, 0 when the offer is not running. */
export function openingOfferBps(date = businessDate()): number {
  return date >= OPENING_OFFER.start && date <= OPENING_OFFER.end ? OPENING_OFFER.bps : 0;
}
