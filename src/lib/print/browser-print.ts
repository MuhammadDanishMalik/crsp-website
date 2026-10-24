"use client";
import { formatPKR } from "@/lib/domain/money";
import type { ReceiptData } from "@/lib/queries/receipt";

/**
 * Prints the kitchen slip and the customer receipt through the browser's own print dialog, to whichever printer Windows has as default
 * (USB, network, any driver). Works online and offline because the slips are drawn from the data on this device, no server page needed.
 * Each slip is its own page on an 80 mm roll, so the printer driver cuts after it. For silent printing (no dialog) start Chrome with --kiosk-printing.
 */
const esc = (s: string | null | undefined) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const TYPE: Record<string, string> = { dine_in: "DINE-IN", takeaway: "TAKEAWAY", delivery: "DELIVERY", drive_thru: "DRIVE-THRU", online: "ONLINE" };
const money = (p: number) => formatPKR(p, { symbol: false });

export type PrintSettings = { paper: 80 | 58; widthMm: number; fontPx: number };
const DEFAULTS: Record<80 | 58, PrintSettings> = { 80: { paper: 80, widthMm: 72, fontPx: 12 }, 58: { paper: 58, widthMm: 48, fontPx: 11 } };
/** Per computer. An 80 mm roll normally prints 72 mm wide (the printer cannot reach the edges); 58 mm prints 48 mm. */
export function getPrintSettings(): PrintSettings {
  try {
    const v = JSON.parse(localStorage.getItem("crsp.print") ?? "null") as Partial<PrintSettings> | null;
    const paper = v?.paper === 58 ? 58 : 80;
    return { paper, widthMm: Math.min(paper, Math.max(40, Number(v?.widthMm) || DEFAULTS[paper].widthMm)), fontPx: Math.min(18, Math.max(9, Number(v?.fontPx) || DEFAULTS[paper].fontPx)) };
  } catch { return DEFAULTS[80]; }
}
export function setPrintSettings(s: PrintSettings) { try { localStorage.setItem("crsp.print", JSON.stringify(s)); } catch { /* storage blocked */ } }
export const defaultPrintSettings = (paper: 80 | 58) => DEFAULTS[paper];

const css = (s: PrintSettings) => `@page{size:${s.paper}mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}
body{width:${s.widthMm}mm;margin-left:${Math.max(0, (s.paper - s.widthMm) / 2)}mm;font:${s.fontPx}px/1.35 "Courier New",monospace;overflow-wrap:anywhere}.slip{padding:2mm 1mm 8mm;page-break-after:always}.slip:last-child{page-break-after:auto}.row span:first-child{min-width:0}.rule{border:1px solid #000;padding:2px;margin:4px 0;text-align:center}
.c{text-align:center}.b{font-weight:700}.big{font-size:2.1em;font-weight:900}.hr{border-top:1px dashed #000;margin:5px 0}.row{display:flex;justify-content:space-between;gap:6px}
.tag{background:#000;color:#fff;padding:2px;font-weight:900;letter-spacing:1px}.item{font-size:1.25em;font-weight:700;margin-top:4px}.mod{padding-left:14px}.tot{font-size:1.25em;font-weight:900}svg{width:28mm;height:28mm}`;


const customerBlock = (r: ReceiptData) => [
  r.customer?.name || r.customer?.phone ? `<div>Customer: ${esc(r.customer?.name)} ${esc(r.customer?.phone)}</div>` : "",
  r.deliveryAddress ? `<div>Address: ${esc(r.deliveryAddress)}</div>` : "",
].join("");

function kitchenSlip(r: ReceiptData, changes?: { added: { name: string; qty: number; mods: string[]; note: string | null }[]; removed: { name: string; qty: number }[] }) {
  const when = new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" });
  const items = changes
    ? [...changes.added.map((i) => `<div class="item">+ ${i.qty} x ${esc(i.name)}</div>${i.mods.map((m) => `<div class="mod">+ ${esc(m)}</div>`).join("")}${i.note ? `<div class="mod b">** ${esc(i.note)}</div>` : ""}`),
       ...changes.removed.map((i) => `<div class="item">- ${i.qty} x ${esc(i.name)} (CANCEL)</div>`)].join("")
    : r.lines.map((l) => `<div class="item">${l.qty} x ${esc(l.name)}</div>${l.mods.map((m) => `<div class="mod">+ ${esc(m)}</div>`).join("")}${l.note ? `<div class="mod b">** ${esc(l.note)}</div>` : ""}`).join("");
  return `<section class="slip"><div class="c tag">${changes ? "*** ORDER CHANGED ***" : "*** KITCHEN ORDER ***"}</div>
<div class="c big">#${esc(r.orderNo)}</div><div class="c b">${TYPE[r.type] ?? esc(r.type)}${r.tableNo ? ` - TABLE ${esc(r.tableNo)}` : ""}</div><div class="c">${esc(when)}</div>
<div class="hr"></div>${customerBlock(r)}${items}<div class="hr"></div><div class="c">-- end of kitchen ticket --</div></section>`;
}

function customerSlip(r: ReceiptData, qrSvg: string | null) {
  const when = new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" });
  return `<section class="slip"><div class="c"><div class="b" style="font-size:1.5em">${esc(r.business.name)}</div><div class="b">${esc(r.branch.name)}</div>
${r.branch.address ? `<div>${esc(r.branch.address)}</div>` : ""}${r.branch.phone ? `<div>Tel: ${esc(r.branch.phone)}</div>` : ""}${r.business.ntn ? `<div>NTN: ${esc(r.business.ntn)}</div>` : ""}${r.business.header ? `<div>${esc(r.business.header)}</div>` : ""}</div>
<div class="hr"></div><div class="c b" style="font-size:1.5em">Order #${esc(r.orderNo)}</div><div class="c b">${TYPE[r.type] ?? esc(r.type)}${r.tableNo ? ` - Table ${esc(r.tableNo)}` : ""}</div>
<div>${esc(when)}</div><div>Cashier: ${esc(r.cashier)} - ${esc(r.terminal)}</div>${customerBlock(r)}<div class="hr"></div>
${r.lines.map((l) => `<div class="row b"><span>${l.qty} x ${esc(l.name)}</span><span>${money(l.total)}</span></div>${l.mods.map((m) => `<div class="mod">+ ${esc(m)}</div>`).join("")}${l.note ? `<div class="mod">* ${esc(l.note)}</div>` : ""}`).join("")}
<div class="hr"></div><div class="row"><span>Subtotal</span><span>${money(r.subtotal)}</span></div>
${r.discount ? `<div class="row"><span>Discount</span><span>-${money(r.discount)}</span></div>` : ""}${r.serviceCharge ? `<div class="row"><span>Service charge</span><span>${money(r.serviceCharge)}</span></div>` : ""}${r.deliveryCharge ? `<div class="row"><span>Delivery</span><span>${money(r.deliveryCharge)}</span></div>` : ""}
${r.taxLines.map((t) => `<div class="row"><span>${esc(t.name)} ${t.rateBps / 100}%</span><span>${money(t.amount)}</span></div>`).join("")}
<div class="row tot"><span>TOTAL</span><span>${formatPKR(r.total)}</span></div><div class="hr"></div>
${r.payments.map((p) => `<div class="row"><span style="text-transform:capitalize">${esc(p.method.replace("_", " "))}${p.status === "pending_verification" ? " (pending)" : p.status === "pending" ? " (COD)" : ""}</span><span>${money(p.amount)}</span></div>${p.tendered ? `<div class="row"><span>&nbsp;&nbsp;Tendered</span><span>${money(p.tendered)}</span></div>` : ""}${p.change ? `<div class="row"><span>&nbsp;&nbsp;Change</span><span>${money(p.change)}</span></div>` : ""}${p.reference ? `<div>&nbsp;&nbsp;Ref: ${esc(p.reference)}</div>` : ""}`).join("")}
<div class="hr"></div><div class="c b">${esc(r.business.footer)}</div>${r.business.footerUr ? `<div class="c" dir="rtl">${esc(r.business.footerUr)}</div>` : ""}
${r.taxInvoiceNo ? `<div class="c b">Tax invoice: ${esc(r.taxInvoiceNo)}</div>` : r.taxPending ? `<div class="c">Tax invoice no. pending</div>` : ""}${qrSvg ? `<div class="c">${qrSvg}</div>` : ""}
<div class="c" style="margin-top:6px;font-size:10px">Software powered by Orixto.com</div></section>`;
}

export type SlipOptions = { kitchen?: boolean; customer?: boolean; changes?: Parameters<typeof kitchenSlip>[1]; ruler?: boolean; settings?: PrintSettings };

/** A page of rulers to check that the paper width and the text columns fit this printer. */
function rulerSlip(s: PrintSettings) {
  const cols = Math.floor((s.widthMm * 3.78) / (s.fontPx * 0.62));
  return `<section class="slip"><div class="c b">PRINT TEST - ${s.paper} mm paper</div><div class="rule b">|&lt;--- ${s.widthMm} mm printable width ---&gt;|</div>
<div>${"1234567890".repeat(6).slice(0, cols)}</div><div>${"ABCDEFGHIJ".repeat(6).slice(0, cols)}</div><div class="row"><span>left edge</span><span>right edge</span></div>
<div class="row b"><span>${"Zinger Burger".slice(0, 14)}</span><span>Rs 450</span></div><div class="c">~ ${cols} characters per line ~</div></section>`;
}

export async function buildSlipsHtml(r: ReceiptData, o: SlipOptions = {}): Promise<string> {
  let qr: string | null = null;
  if (r.qr && o.customer !== false) { try { qr = await (await import("qrcode")).toString(r.qr, { type: "svg", margin: 0, width: 120 }); } catch { qr = null; } }
  const s = o.settings ?? getPrintSettings();
  const body = [o.ruler ? rulerSlip(s) : "", o.kitchen !== false || o.changes ? kitchenSlip(r, o.changes) : "", o.customer !== false ? customerSlip(r, qr) : ""].join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Order ${esc(r.orderNo)}</title><style>${css(s)}</style></head><body>${body}</body></html>`;
}

/** Opens the print dialog for the slips without leaving the page. Resolves once the dialog was requested. */
export async function printInBrowser(r: ReceiptData, o: SlipOptions = {}): Promise<void> {
  const html = await buildSlipsHtml(r, o);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  // Off-screen but with a real size: Chrome prints blank pages for 0x0 or hidden frames.
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:80mm;height:1200px;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  await new Promise((res) => setTimeout(res, 300)); // let fonts/QR lay out
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 120_000);
}
