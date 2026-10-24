"use client";
import { buildKot, buildOrderSlips } from "@/lib/adapters/printers/escpos";
import { printMode, sendToBridge } from "@/lib/adapters/printers/bridge-client";
import { printInBrowser } from "@/lib/print/browser-print";
import type { CartLine } from "@/lib/domain/pricing";
import type { ReceiptData } from "@/lib/queries/receipt";
import type { PosItem } from "@/lib/queries/menu";
import type { OfflineConfig } from "./types";

/** Print the kitchen tickets and receipt from data held on this device (the print bridge runs on the same PC, so it works offline). */
export async function printOffline(cfg: OfflineConfig, receipt: ReceiptData, lines: CartLine[], items: PosItem[], hasCash: boolean): Promise<string> {
  if (printMode() === "browser") { // default: the browser print dialog, from data on this device (works with no internet)
    try { await printInBrowser(receipt, { kitchen: true }); return "Print window opened: choose the receipt printer and press Print"; } catch { return "Could not open the print window"; }
  }
  const msgs: string[] = [];

  // 1st: Kitchen ticket
  const byPrinter = new Map<string, { name: string; station: string; lines: CartLine[] }>();
  for (const l of lines) {
    const stationId = items.find((i) => i.id === l.itemId)?.stationId;
    const printerId = stationId ? cfg.stationPrinter[stationId] : null;
    if (!stationId || !printerId) continue;
    const g = byPrinter.get(printerId) ?? { name: printerId, station: cfg.stationName[stationId] ?? "Kitchen", lines: [] };
    g.lines.push(l); byPrinter.set(printerId, g);
  }
  // If no kitchen printer was mapped, fallback to receipt printer so kitchen slip is still generated
  if (byPrinter.size === 0 && cfg.receiptPrinter && lines.length) {
    byPrinter.set("receipt-fallback", { name: "Kitchen", station: "Kitchen", lines });
  }

  let failed = 0;
  for (const [printerId, g] of byPrinter) {
    const p = printerId === "receipt-fallback" ? cfg.receiptPrinter : cfg.kotPrinters.find((x) => x.id === printerId);
    if (!p) continue;
    const data = buildKot({ orderNo: receipt.orderNo, type: receipt.type, tableNo: receipt.tableNo, station: g.station, createdAt: receipt.createdAt, items: g.lines.map((l) => ({ qty: l.quantity, name: l.name, mods: l.modifiers.map((m) => m.name), note: l.note ?? null })) }, p.paperMm);
    if (!(await sendToBridge(p.target, data)).ok) failed++;
  }
  if (byPrinter.size) msgs.push(failed ? `${failed} kitchen ticket(s) failed` : "1. Kitchen ticket printed");

  // 2nd: Customer Receipt
  if (cfg.receiptPrinter) {
    const r = await sendToBridge(cfg.receiptPrinter.target, buildOrderSlips(receipt, { paperMm: cfg.receiptPrinter.paperMm, openDrawer: cfg.receiptPrinter.openDrawer && hasCash, kitchen: true }));
    msgs.push(r.ok ? "2. Customer receipt printed" : `Receipt not printed (${r.error})`);
  } else msgs.push("No receipt printer configured");

  return msgs.join(" · ");
}
