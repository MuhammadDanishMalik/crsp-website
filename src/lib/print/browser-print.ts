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

const CSS = `@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}
body{width:76mm;font:12px/1.35 "Courier New",monospace}.slip{padding:3mm 2mm 6mm;page-break-after:always}.slip:last-child{page-break-after:auto}
.c{text-align:center}.b{font-weight:700}.big{font-size:26px;font-weight:900}.hr{border-top:1px dashed #000;margin:5px 0}.row{display:flex;justify-content:space-between;gap:6px}
.tag{background:#000;color:#fff;padding:2px;font-weight:900;letter-spacing:1px}.item{font-size:15px;font-weight:700;margin-top:4px}.mod{padding-left:14px}.tot{font-size:15px;font-weight:900}svg{width:120px;height:120px}`;

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
  return `<section class="slip"><div class="c"><div class="b" style="font-size:18px">${esc(r.business.name)}</div><div class="b">${esc(r.branch.name)}</div>
${r.branch.address ? `<div>${esc(r.branch.address)}</div>` : ""}${r.branch.phone ? `<div>Tel: ${esc(r.branch.phone)}</div>` : ""}${r.business.ntn ? `<div>NTN: ${esc(r.business.ntn)}</div>` : ""}${r.business.header ? `<div>${esc(r.business.header)}</div>` : ""}</div>
<div class="hr"></div><div class="c b" style="font-size:18px">Order #${esc(r.orderNo)}</div><div class="c b">${TYPE[r.type] ?? esc(r.type)}${r.tableNo ? ` - Table ${esc(r.tableNo)}` : ""}</div>
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

export type SlipOptions = { kitchen?: boolean; customer?: boolean; changes?: Parameters<typeof kitchenSlip>[1] };

export async function buildSlipsHtml(r: ReceiptData, o: SlipOptions = {}): Promise<string> {
  let qr: string | null = null;
  if (r.qr && o.customer !== false) { try { qr = await (await import("qrcode")).toString(r.qr, { type: "svg", margin: 0, width: 120 }); } catch { qr = null; } }
  const body = [o.kitchen !== false || o.changes ? kitchenSlip(r, o.changes) : "", o.customer !== false ? customerSlip(r, qr) : ""].join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Order ${esc(r.orderNo)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

/** Opens the print dialog for the slips without leaving the page. Resolves once the dialog was requested. */
export async function printInBrowser(r: ReceiptData, o: SlipOptions = {}): Promise<void> {
  const html = await buildSlipsHtml(r, o);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  await new Promise((res) => setTimeout(res, 300)); // let fonts/QR lay out
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 120_000);
}
