"use client";
import { useEffect } from "react";

/**
 * Automatically fires two sequential print jobs when the receipt page
 * opens with ?print=1:
 *   1st job → Kitchen Order Ticket only  (data-print-mode="kitchen")
 *   2nd job → Customer Receipt only      (data-print-mode="customer")
 *
 * The two window.print() calls are separated by a delay so the printer
 * has time to cut/feed between the two slips.
 */
export function PrintOnLoad() {
  useEffect(() => {
    const body = document.body;

    // ── Job 1: Kitchen ticket ──────────────────────────────────────────
    body.setAttribute("data-print-mode", "kitchen");
    const t1 = setTimeout(() => {
      window.print();

      // ── Job 2: Customer receipt (after a short pause) ───────────────
      const t2 = setTimeout(() => {
        body.setAttribute("data-print-mode", "customer");
        window.print();
        // Reset so the page displays both slips normally afterwards
        body.removeAttribute("data-print-mode");
      }, 1200); // 1.2 s gap — enough for the printer to cut and the dialog to dismiss

      return () => clearTimeout(t2);
    }, 400); // short wait for the page to render

    return () => clearTimeout(t1);
  }, []);

  return null;
}
