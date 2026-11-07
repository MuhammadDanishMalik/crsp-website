import { businessDate } from "./dates";

/**
 * Iqbal Day offer: 9% off every order (cold drinks excluded) on 9 November 2026, Asia/Karachi calendar day.
 * It switches itself on at 00:00 on the 9th and off at 00:00 on the 10th: nothing to do by hand.
 * (Name kept from the earlier opening-week offer so the rest of the code did not have to change.)
 */
export const OPENING_OFFER = { bps: 900, start: "2026-11-09", end: "2026-11-09", label: "Iqbal Day 9%", title: "Iqbal Day offer", endsAt: "2026-11-09T23:59:59+05:00" } as const;

/** Offer percentage (basis points) that applies on the given business date, 0 when the offer is not running. */
export function openingOfferBps(date = businessDate()): number {
  return date >= OPENING_OFFER.start && date <= OPENING_OFFER.end ? OPENING_OFFER.bps : 0;
}

/** Announcement printed at the bottom of receipts: in advance until the day, then on the day itself. */
export function receiptNotice(date = businessDate()): string | null {
  if (date < OPENING_OFFER.start) return "IQBAL DAY SPECIAL: 9% OFF on all orders on 9 Nov! Sponsored by CRSP";
  if (date === OPENING_OFFER.start) return "IQBAL DAY: 9% OFF applied on today's orders (cold drinks excluded)";
  return null;
}
