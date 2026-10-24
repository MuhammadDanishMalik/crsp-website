"use client";

import { useState } from "react";
import { getReceiptData } from "@/lib/actions/print";
import { printInBrowser } from "@/lib/print/browser-print";
import Link from "next/link";
import { Printer, ChefHat, Receipt, ArrowLeft, ShoppingBag } from "lucide-react";

export function ReceiptActions({ orderId }: { orderId: string }) {
  const [filter, setFilter] = useState<"both" | "kitchen" | "customer">("both");

  const handlePrint = async (mode: "both" | "kitchen" | "customer") => {
    setFilter(mode);
    try {
      const data = await getReceiptData(orderId);
      if (data) await printInBrowser(data, { kitchen: mode !== "customer", customer: mode !== "kitchen" });
    } catch { /* print window blocked */ }
  };


  return (
    <div className="print:hidden sticky top-0 z-30 mb-6 border-b border-border bg-surface/95 backdrop-blur px-4 py-3 shadow-sm">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/order"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface hover:text-brand"
          >
            <ArrowLeft size={14} /> Back to POS
          </Link>
          <Link
            href="/orders"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface hover:text-brand"
          >
            <ShoppingBag size={14} /> Orders Record
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrint("both")}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-brand-fg shadow hover:opacity-90"
            title="Print both slips (Kitchen slip first, then Customer slip)"
          >
            <Printer size={14} /> Print Both Slips
          </button>
          <button
            onClick={() => handlePrint("kitchen")}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-2"
            title="Print only the Kitchen slip"
          >
            <ChefHat size={14} /> Kitchen Only
          </button>
          <button
            onClick={() => handlePrint("customer")}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-2"
            title="Print only the Customer receipt"
          >
            <Receipt size={14} /> Customer Only
          </button>
        </div>
      </div>
      <div className="mx-auto mt-2 max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-center text-xs text-amber-700 dark:text-amber-300">
        💡 <b>Windows Printing Tip:</b> In the print window, change <b>Destination</b> from <i>&quot;Save as PDF&quot;</i> to your physical printer (e.g. <b>POS-80 / Xprinter</b>).
      </div>
    </div>
  );
}
