import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { loadReceipt } from "@/lib/queries/receipt";
import { formatPKR } from "@/lib/domain/money";
import { PrintOnLoad } from "./print-on-load";
import { ReceiptActions } from "./receipt-actions";
import QRCode from "qrcode";

export default async function ReceiptPage({ params, searchParams }: PageProps<"/receipt/[id]">) {
  await requireSession({ kind: "pos" });
  const { id } = await params;
  const sp = await searchParams;
  const r = await loadReceipt(id);
  if (!r) notFound();
  const d = new Date(r.createdAt);
  const formattedDate = d.toLocaleString("en-GB", { timeZone: "Asia/Karachi" });
  const qrSvg = r.qr ? await QRCode.toString(r.qr, { type: "svg", margin: 0, width: 140 }) : null;

  return (
    <div className="min-h-screen bg-surface-2/60 pb-12 pt-2 text-black print:h-auto print:bg-white print:p-0">
      <ReceiptActions orderId={id} />
      {sp.print && <PrintOnLoad />}

      {/* Slip Container */}
      <div className="mx-auto flex flex-col items-center gap-8 print:block print:gap-0">
        {/* ========================================================= */}
        {/* SLIP 1: KITCHEN ORDER TICKET (KOT)                        */}
        {/* ========================================================= */}
        <section
          id="kitchen-slip"
          className="w-[310px] rounded-lg border border-border bg-white p-5 font-mono text-[12px] leading-snug shadow-sm print:w-[302px] print:rounded-none print:border-none print:p-0 print:shadow-none"
        >
          {/* Heavy header — easy to read across a kitchen */}
          <div className="mb-3 rounded bg-black py-2 text-center text-white print:bg-black print:text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.2em]">★ KITCHEN ORDER TICKET ★</p>
          </div>

          <div className="text-center">
            <p className="text-4xl font-black tracking-tight">#{r.orderNo}</p>
            <p className="mt-1 text-base font-black uppercase tracking-wide">
              {r.type.replace("_", " ")}
            </p>
            {r.tableNo && (
              <div className="mt-2 rounded border-2 border-black px-2 py-1">
                <p className="text-xl font-black">TABLE {r.tableNo}</p>
              </div>
            )}
            <p className="mt-1 text-[11px] text-zinc-600 print:text-black">{formattedDate}</p>
          </div>

          <div className="my-2 border-b border-dashed border-black" />

          <div className="text-[11px]">
            <p>Terminal: <span className="font-semibold">{r.terminal || "POS"}</span></p>
            {r.customer?.name && (
              <p>Customer: <span className="font-semibold">{r.customer.name} {r.customer.phone ? `(${r.customer.phone})` : ""}</span></p>
            )}
            {r.deliveryAddress && (
              <p className="mt-0.5">Address: <span className="font-semibold">{r.deliveryAddress}</span></p>
            )}
          </div>

          <div className="my-2 border-b-2 border-black" />

          {/* Items to prepare */}
          <div className="space-y-2 py-1">
            {r.lines.map((l, i) => (
              <div key={i} className="leading-tight">
                <div className="flex items-start justify-between font-bold">
                  <span className="text-[15px]">
                    <span className="inline-block min-w-7 rounded bg-zinc-200 px-1 py-0.5 text-center text-[13px] font-black print:bg-transparent print:border print:border-black">
                      {l.qty}x
                    </span>{" "}
                    {l.name}
                  </span>
                </div>
                {l.mods.map((m) => (
                  <p key={m} className="pl-8 text-[11px] font-medium text-zinc-700 print:text-black">
                    + {m}
                  </p>
                ))}
                {l.note && (
                  <p className="pl-8 text-[11px] font-black text-red-600 print:border print:border-black print:px-1 print:text-black">
                    ★ NOTE: {l.note}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="my-2 border-b-2 border-black" />

          <div className="flex justify-between text-sm font-black">
            <span>TOTAL ITEMS:</span>
            <span>{r.lines.reduce((a, b) => a + b.qty, 0)}</span>
          </div>

          <div className="mt-3 text-center text-[10px] uppercase text-zinc-500 print:text-black">
            -- Kitchen Copy --
          </div>

          {/* Thermal paper feed space so the cutter blade cuts after the text */}
          <div className="hidden print:block print:h-20" aria-hidden="true" />
        </section>

        {/* Paper Tear / Perforation Divider for Screen */}
        <div className="my-2 flex w-[310px] items-center justify-center gap-2 text-xs font-mono text-zinc-400 print:hidden">
          <span>✂ - - - - - - - - - - - - - - - - - - - - - - ✂</span>
        </div>

        {/* ========================================================= */}
        {/* SLIP 2: CUSTOMER RECEIPT                                  */}
        {/* ========================================================= */}
        <section
          id="customer-slip"
          className="w-[310px] rounded-lg border border-border bg-white p-5 font-mono text-[12px] leading-snug shadow-sm print:w-[302px] print:rounded-none print:border-none print:p-0 print:shadow-none print:data-[hidden]:hidden"
        >
          <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 print:text-black">
            *** 2. CUSTOMER RECEIPT ***
          </div>

          <div className="text-center">
            <p className="text-xl font-black">{r.business.name}</p>
            <p className="font-semibold">{r.branch.name}</p>
            {r.branch.address && <p className="text-[11px]">{r.branch.address}</p>}
            {r.branch.phone && <p className="text-[11px]">Tel: {r.branch.phone}</p>}
            {r.business.ntn && <p className="text-[11px]">NTN: {r.business.ntn}</p>}
            {r.business.header && <p className="mt-1 text-[11px] italic">{r.business.header}</p>}
          </div>

          <div className="my-2 border-b border-dashed border-black" />

          <p className="text-center text-xl font-black">Order #{r.orderNo}</p>
          <p className="text-center uppercase font-semibold">
            {r.type.replace("_", " ")}
            {r.tableNo ? ` · Table ${r.tableNo}` : ""}
          </p>
          <p className="text-[11px] text-zinc-600 print:text-black">{formattedDate}</p>
          <p className="text-[11px]">Terminal: {r.terminal}</p>
          {r.customer && <p className="text-[11px]">Customer: {r.customer.name} {r.customer.phone}</p>}
          {r.deliveryAddress && <p className="text-[11px]">Address: {r.deliveryAddress}</p>}

          <div className="my-2 border-b border-dashed border-black" />

          <div className="space-y-1">
            {r.lines.map((l, i) => (
              <div key={i} className="mb-1">
                <div className="flex justify-between font-medium">
                  <span>{l.qty} x {l.name}</span>
                  <span className="tabular-nums font-semibold">{formatPKR(l.total, { symbol: false })}</span>
                </div>
                {l.mods.map((m) => <p key={m} className="pl-3 text-[11px] text-zinc-600 print:text-black">+ {m}</p>)}
                {l.note && <p key={l.note} className="pl-3 text-[11px] italic text-zinc-600 print:text-black">* {l.note}</p>}
              </div>
            ))}
          </div>

          <div className="my-2 border-b border-dashed border-black" />

          <div className="space-y-0.5">
            <Row l="Subtotal" v={r.subtotal} />
            {r.discount > 0 && <Row l="Discount" v={-r.discount} />}
            {r.serviceCharge > 0 && <Row l="Service charge" v={r.serviceCharge} />}
            {r.deliveryCharge > 0 && <Row l="Delivery" v={r.deliveryCharge} />}
            {r.taxLines.map((t) => <Row key={t.name} l={`${t.name} ${t.rateBps / 100}%`} v={t.amount} />)}
            <div className="my-1 border-t border-black pt-1" />
            <div className="flex justify-between text-base font-black">
              <span>TOTAL</span>
              <span className="tabular-nums">{formatPKR(r.total)}</span>
            </div>
          </div>

          <div className="my-2 border-b border-dashed border-black" />

          <div className="space-y-0.5">
            {r.payments.map((p, i) => (
              <div key={i}>
                <Row
                  l={`${p.method.replace("_", " ")}${p.status === "pending_verification" ? " (pending)" : p.status === "pending" ? " (COD)" : ""}`}
                  v={p.amount}
                />
                {p.tendered ? <Row l="  Tendered" v={p.tendered} /> : null}
                {p.change ? <Row l="  Change" v={p.change} /> : null}
                {p.reference && <p className="text-[11px] text-zinc-600 print:text-black">  Ref: {p.reference}</p>}
              </div>
            ))}
          </div>

          <div className="my-2 border-b border-dashed border-black" />

          <div className="text-center text-[11px]">
            <p className="font-semibold">{r.business.footer}</p>
            {r.business.footerUr && <p dir="rtl" className="mt-0.5 text-xs font-urdu">{r.business.footerUr}</p>}
            {r.taxInvoiceNo ? (
              <p className="mt-1 font-bold">Tax invoice: {r.taxInvoiceNo}</p>
            ) : r.taxPending ? (
              <p className="mt-1 text-zinc-500 print:text-black">Tax invoice no. pending</p>
            ) : null}
          </div>

          {qrSvg && (
            <div className="mx-auto mt-2 h-[140px] w-[140px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          )}

          <p className="mt-3 text-center text-[10px] text-zinc-400 print:text-black">
            Software powered by Orixto.com
          </p>

          {/* Thermal paper feed space so the cutter blade cuts after the text */}
          <div className="hidden print:block print:h-24" aria-hidden="true" />
        </section>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: 80mm auto;
            margin: 0mm;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          /* Force page-break and cut point between the 2 slips */
          #kitchen-slip {
            break-after: page !important;
            page-break-after: always !important;
          }
          #customer-slip {
            break-before: page !important;
            page-break-before: always !important;
          }

          /* Mode-specific filtering for independent cutter print jobs */
          body[data-print-mode="kitchen"] #customer-slip {
            display: none !important;
          }
          body[data-print-mode="customer"] #kitchen-slip {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}

const Row = ({ l, v }: { l: string; v: number }) => (
  <div className="flex justify-between capitalize">
    <span>{l}</span>
    <span className="tabular-nums font-semibold">{formatPKR(v, { symbol: false })}</span>
  </div>
);
