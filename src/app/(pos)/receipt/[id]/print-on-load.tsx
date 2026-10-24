"use client";
import { useEffect } from "react";
import { getReceiptData } from "@/lib/actions/print";
import { printInBrowser } from "@/lib/print/browser-print";

/** Opened with ?print=1: print the kitchen slip, then the customer receipt, each as its own correctly sized job. */
export function PrintOnLoad({ orderId }: { orderId: string }) {
  useEffect(() => {
    let on = true;
    void (async () => { try { const d = await getReceiptData(orderId); if (d && on) await printInBrowser(d, { kitchen: true }); } catch { /* print window blocked */ } })();
    return () => { on = false; };
  }, [orderId]);
  return null;
}
