import { formatPKR } from "@/lib/domain/money";
import type { ReceiptData } from "@/lib/queries/receipt";

/** Minimal ESC/POS builder (CP437-safe ASCII; Urdu goes through the browser-print fallback). */
const ESC = 0x1b, GS = 0x1d, LF = 0x0a;

export class EscPos {
  private buf: number[] = [];
  constructor(public cols: 32 | 42 | 48 = 48) {}
  init() { this.buf.push(ESC, 0x40); return this; }
  align(a: "left" | "center" | "right") { this.buf.push(ESC, 0x61, { left: 0, center: 1, right: 2 }[a]); return this; }
  bold(on: boolean) { this.buf.push(ESC, 0x45, on ? 1 : 0); return this; }
  size(w: 1 | 2, h: 1 | 2) { this.buf.push(GS, 0x21, ((w - 1) << 4) | (h - 1)); return this; }
  text(t: string) { for (const ch of t.normalize("NFKD").replace(/[^\x20-\x7e\n]/g, "")) this.buf.push(ch.charCodeAt(0)); return this; }
  line(t = "") { return this.text(t).feed(1); }
  feed(n = 1) { for (let i = 0; i < n; i++) this.buf.push(LF); return this; }
  rule(ch = "-") { return this.line(ch.repeat(this.cols)); }
  row(left: string, right: string) {
    const gap = Math.max(1, this.cols - left.length - right.length);
    return this.line(left.slice(0, this.cols - right.length - 1) + " ".repeat(gap) + right);
  }
  /** Native printer QR code (ESC/POS GS ( k). Size 1–16 dots per module. */
  qr(data: string, size = 6) {
    const bytes = [...new TextEncoder().encode(data)]; // browser-safe (the offline POS builds receipts client-side)
    const len = bytes.length + 3;
    this.buf.push(GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0); // model 2
    this.buf.push(GS, 0x28, 0x6b, 3, 0, 49, 67, Math.max(1, Math.min(16, size))); // module size
    this.buf.push(GS, 0x28, 0x6b, 3, 0, 49, 69, 49); // error correction M
    this.buf.push(GS, 0x28, 0x6b, len & 0xff, len >> 8, 49, 80, 48, ...bytes); // store
    this.buf.push(GS, 0x28, 0x6b, 3, 0, 49, 81, 48); // print
    return this;
  }
  cut() { this.buf.push(GS, 0x56, 0x42, 0x00); return this; }
  /** Pulse drawer pin 2 (works through the printer's DK port). */
  openDrawer() { this.buf.push(ESC, 0x70, 0x00, 0x19, 0xfa); return this; }
  bytes() { return Uint8Array.from(this.buf); }
}

const TYPE_LABEL: Record<string, string> = { dine_in: "DINE-IN", takeaway: "TAKEAWAY", delivery: "DELIVERY", drive_thru: "DRIVE-THRU", online: "ONLINE" };
const METHOD_LABEL: Record<string, string> = { cash: "Cash", card: "Card", jazzcash: "JazzCash", easypaisa: "Easypaisa", raast: "Raast", bank_transfer: "Bank transfer" };

export function buildReceipt(r: ReceiptData, opts: { paperMm: 58 | 80; openDrawer: boolean }): Uint8Array {
  const p = new EscPos(opts.paperMm === 58 ? 32 : 48).init();
  p.align("center").bold(true).size(2, 2).line(r.business.name).size(1, 1).bold(false);
  p.line(r.branch.name);
  if (r.branch.address) p.line(r.branch.address);
  if (r.branch.phone) p.line(`Tel: ${r.branch.phone}`);
  if (r.business.ntn) p.line(`NTN: ${r.business.ntn}`);
  if (r.business.header) p.line(r.business.header);
  p.rule().bold(true).size(2, 2).line(`Order #${r.orderNo}`).size(1, 1).line(TYPE_LABEL[r.type] ?? r.type).bold(false);
  p.align("left");
  if (r.tableNo) p.line(`Table: ${r.tableNo}`);
  const d = new Date(r.createdAt);
  p.row(d.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }), d.toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }));
  p.row(`Cashier: ${r.cashier}`, r.terminal);
  if (r.customer) p.line(`Customer: ${r.customer.name ?? ""} ${r.customer.phone ?? ""}`);
  if (r.deliveryAddress) p.line(`Addr: ${r.deliveryAddress}`);
  p.rule();
  for (const l of r.lines) {
    p.row(`${l.qty} x ${l.name}`, formatPKR(l.total, { symbol: false }));
    for (const m of l.mods) p.line(`   + ${m}`);
    if (l.note) p.line(`   * ${l.note}`);
  }
  p.rule();
  p.row("Subtotal", formatPKR(r.subtotal, { symbol: false }));
  if (r.discount) p.row("Discount", `-${formatPKR(r.discount, { symbol: false })}`);
  if (r.serviceCharge) p.row("Service charge", formatPKR(r.serviceCharge, { symbol: false }));
  if (r.deliveryCharge) p.row("Delivery", formatPKR(r.deliveryCharge, { symbol: false }));
  for (const t of r.taxLines) p.row(`${t.name} ${(t.rateBps / 100).toFixed(t.rateBps % 100 ? 1 : 0)}%`, formatPKR(t.amount, { symbol: false }));
  p.bold(true).size(1, 2).row("TOTAL", formatPKR(r.total)).size(1, 1).bold(false).rule();
  for (const pay of r.payments) {
    p.row(METHOD_LABEL[pay.method] ?? pay.method, formatPKR(pay.amount, { symbol: false }) + (pay.status === "pending_verification" ? " (pending)" : pay.status === "pending" ? " (COD)" : ""));
    if (pay.tendered != null && pay.tendered > pay.amount) p.row("  Tendered", formatPKR(pay.tendered, { symbol: false }));
    if (pay.change) p.row("  Change", formatPKR(pay.change, { symbol: false }));
    if (pay.reference) p.line(`  Ref: ${pay.reference}`);
  }
  p.rule().align("center");
  if (r.taxInvoiceNo) p.line(`Tax invoice: ${r.taxInvoiceNo}`);
  else if (r.taxPending) p.line("Tax invoice no. pending");
  if (r.qr) p.feed(1).qr(r.qr, opts.paperMm === 58 ? 5 : 6).feed(1);
  p.line(r.business.footer).feed(4).cut();
  if (opts.openDrawer) p.openDrawer();
  return p.bytes();
}

export function drawerKick(): Uint8Array {
  return new EscPos().init().openDrawer().bytes();
}

export type KotData = { orderNo: string; type: string; tableNo: string | null; station: string; createdAt: string; items: { qty: number; name: string; mods: string[]; note: string | null }[] };

/** Kitchen order ticket: big order number, no prices. */
export function buildKot(k: KotData, paperMm: 58 | 80): Uint8Array {
  const p = new EscPos(paperMm === 58 ? 32 : 48).init().align("center");
  p.bold(true).size(2, 2).line(`#${k.orderNo}`).size(1, 1).line(`${TYPE_LABEL[k.type] ?? k.type}${k.tableNo ? ` - TABLE ${k.tableNo}` : ""}`).bold(false);
  p.line(`${k.station} - ${new Date(k.createdAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" })}`).rule().align("left");
  for (const i of k.items) {
    p.bold(true).size(1, 2).line(`${i.qty} x ${i.name}`).size(1, 1).bold(false);
    for (const m of i.mods) p.line(`   + ${m}`);
    if (i.note) p.bold(true).line(`   ** ${i.note}`).bold(false);
  }
  p.rule().feed(3).cut();
  return p.bytes();
}
