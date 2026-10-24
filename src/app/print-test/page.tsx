"use client";
import { useEffect, useState } from "react";
import { buildSlipsHtml, defaultPrintSettings, getPrintSettings, printInBrowser, setPrintSettings, type PrintSettings } from "@/lib/print/browser-print";
import type { ReceiptData } from "@/lib/queries/receipt";

const SAMPLE: ReceiptData = {
  business: { name: "CRSP", ntn: null, header: "Crispy . Juicy . Spicy", footer: "Thank you for choosing CRSP!", footerUr: "" }, branch: { name: "CRSP Watta Khail Chowk", address: "Watta Khail Chowk, Mianwali", phone: "0459-000000" },
  orderNo: "TEST", type: "takeaway", tableNo: null, cashier: "Cashier", terminal: "POS-1", createdAt: new Date().toISOString(), customer: { name: "Ahmed Khan", phone: "0300-1234567" }, deliveryAddress: "House 12, Street 3, Mianwali",
  lines: [
    { name: "Spicy Injected Broast (Quarter)", qty: 1, unit: 65000, total: 65000, mods: ["Spicy", "Garlic Sauce"], note: null }, { name: "CRSP (Zinger)", qty: 2, unit: 45000, total: 90000, mods: [], note: "no onions" },
    { name: "Soft Drink (Bottle 350 ml)", qty: 2, unit: 10000, total: 20000, mods: [], note: null },
  ],
  subtotal: 175000, discount: 0, serviceCharge: 0, deliveryCharge: 0, taxLines: [{ name: "Sales Tax", rateBps: 1600, amount: 28000 }], total: 203000,
  payments: [{ method: "cash", amount: 203000, tendered: 250000, change: 47000, status: "confirmed", reference: null }], taxInvoiceNo: null, qr: null, taxPending: false,
};

/** Public test page: pick the paper, tune the width, preview exactly what will print, and print a ruler + sample order. Saved on this computer. */
export default function PrintTest() {
  const [s, setS] = useState<PrintSettings>(defaultPrintSettings(80));
  const [html, setHtml] = useState("");
  useEffect(() => { const t = setTimeout(() => setS(getPrintSettings()), 0); return () => clearTimeout(t); }, []);
  useEffect(() => { let on = true; buildSlipsHtml(SAMPLE, { ruler: true, kitchen: true, customer: true, settings: s }).then((h) => on && setHtml(h)); return () => { on = false; }; }, [s]);
  const update = (p: Partial<PrintSettings>) => { const n = { ...s, ...p }; setS(n); setPrintSettings(n); };
  const field = "h-12 w-full rounded-xl border border-border bg-surface-2 px-3";
  return (
    <main className="mx-auto grid max-w-4xl gap-6 p-6 md:grid-cols-[320px_1fr]">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Receipt printer test</h1>
        <p className="text-sm text-muted">Set this once on the till computer. The choice is saved in this browser and used for every order.</p>
        <label className="block text-sm text-muted">Paper roll
          <select className={field} value={s.paper} onChange={(e) => update({ ...defaultPrintSettings(e.target.value === "58" ? 58 : 80) })}><option value={80}>80 mm</option><option value={58}>58 mm</option></select></label>
        <label className="block text-sm text-muted">Printable width: <b className="text-foreground">{s.widthMm} mm</b> (80 mm paper normally prints 72 mm)
          <input type="range" min={40} max={s.paper} value={s.widthMm} onChange={(e) => update({ widthMm: Number(e.target.value) })} className="w-full" /></label>
        <label className="block text-sm text-muted">Text size: <b className="text-foreground">{s.fontPx} px</b>
          <input type="range" min={10} max={22} value={s.fontPx} onChange={(e) => update({ fontPx: Number(e.target.value) })} className="w-full" /></label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-6 w-6" checked={s.bold} onChange={(e) => update({ bold: e.target.checked })} /><span><b>Extra bold text</b> (recommended: thin text prints faint on thermal paper)</span></label>
        <button className="min-h-14 w-full rounded-2xl bg-brand text-lg font-bold text-brand-fg" onClick={() => printInBrowser(SAMPLE, { ruler: true, kitchen: true, customer: true, settings: s })}>Print test (ruler + 2 slips)</button>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>In the print window choose your receipt printer. Paper size: <b>{s.paper} mm</b> (roll / receipt). Margins: <b>None</b>. Scale: <b>100%</b> (Default). Turn off &quot;Headers and footers&quot;.</li>
          <li>If the right edge is cut off, make the width smaller. If there is a wide empty strip, make it bigger.</li>
          <li>Each slip prints as its own page, so the printer cuts after the kitchen slip and after the customer receipt.</li>
        </ul>
      </section>
      <section>
        <p className="mb-2 text-sm font-semibold text-muted">Preview ({s.paper} mm paper)</p>
        <iframe title="preview" srcDoc={html} className="h-[640px] rounded-xl border border-border bg-white" style={{ width: `${Math.round(s.paper * 3.78) + 24}px` }} />
      </section>
    </main>
  );
}
