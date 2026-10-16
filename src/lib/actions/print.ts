"use server";

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { getSession, requirePermission } from "@/lib/auth/session";
import { buildKot, buildOrderSlips, drawerKick } from "@/lib/adapters/printers/escpos";
import { loadReceipt } from "@/lib/queries/receipt";

async function receiptPrinter(branchId: string) {
  const db = await getDb();
  const [p] = await db.select().from(s.printers).where(and(eq(s.printers.branchId, branchId), eq(s.printers.role, "receipt"), eq(s.printers.isActive, true))).limit(1);
  return p ?? null;
}
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");

export async function getReceiptPrintJob(orderId: string, reprint = false, changes?: { added: { name: string; qty: number; mods: string[]; note: string | null }[]; removed: { name: string; qty: number }[] }) {
  const session = reprint ? await requirePermission("order.reprint") : await getSession();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const [receipt, printer] = await Promise.all([loadReceipt(orderId), receiptPrinter(session.branchId)]);
  if (!receipt) return { ok: false as const, error: "Order not found" };
  if (!printer) return { ok: false as const, error: "No receipt printer configured" };
  const hasCash = receipt.payments.some((p) => p.method === "cash");
  const data = buildOrderSlips(receipt, { paperMm: printer.paperWidthMm === 58 ? 58 : 80, openDrawer: printer.openDrawer && hasCash && !reprint, kitchen: !reprint, changeSlip: changes ? { orderNo: receipt.orderNo, type: receipt.type, tableNo: receipt.tableNo, added: changes.added, removed: changes.removed } : undefined });
  if (reprint) await audit(session, { action: "order.reprint", entity: "order", entityId: orderId });
  return { ok: true as const, data: b64(data), target: { connection: printer.connection, address: printer.address, port: printer.port } };
}

/** "No sale": requires permission and is always audited. */
export async function getNoSaleJob(reason: string) {
  const session = await requirePermission("drawer.open_no_sale");
  const printer = await receiptPrinter(session.branchId);
  if (!printer) return { ok: false as const, error: "No receipt printer configured" };
  await audit(session, { action: "drawer.no_sale", entity: "drawer", reason });
  return { ok: true as const, data: b64(drawerKick()), target: { connection: printer.connection, address: printer.address, port: printer.port } };
}

/**
 * One KOT per kitchen printer. Items route by: print_routes (item → category) first, then the station's printer.
 * Items without a route are skipped here (they still show on the KDS).
 */
export async function getKotJobs(orderId: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const db = await getDb();
  const [o] = await db.select().from(s.orders).where(and(eq(s.orders.id, orderId), eq(s.orders.branchId, session.branchId)));
  if (!o) return { ok: false as const, error: "Order not found" };
  const [items, stations, printers, routes] = await Promise.all([
    db.select().from(s.orderItems).where(and(eq(s.orderItems.orderId, orderId), eq(s.orderItems.isVoided, false))),
    db.select().from(s.kitchenStations).where(eq(s.kitchenStations.branchId, session.branchId)),
    db.select().from(s.printers).where(and(eq(s.printers.branchId, session.branchId), eq(s.printers.isActive, true))),
    db.select().from(s.printRoutes).where(eq(s.printRoutes.branchId, session.branchId)),
  ]);
  const mods = items.length ? await db.select().from(s.orderItemModifiers).where(inArray(s.orderItemModifiers.orderItemId, items.map((i) => i.id))) : [];
  const menu = items.length ? await db.select({ id: s.menuItems.id, categoryId: s.menuItems.categoryId }).from(s.menuItems).where(inArray(s.menuItems.id, items.map((i) => i.itemId))) : [];

  const groups = new Map<string, { printer: (typeof printers)[number]; station: string; items: KotItem[]; copies: number }>();
  for (const it of items) {
    const catId = menu.find((m) => m.id === it.itemId)?.categoryId;
    const route = routes.find((r) => (r.itemId === it.itemId || (!r.itemId && r.categoryId === catId)) && (!r.orderType || r.orderType === o.type));
    const station = stations.find((x) => x.id === it.stationId);
    const printerId = route?.printerId ?? station?.printerId;
    const printer = printers.find((p) => p.id === printerId);
    if (!printer) continue;
    const g = groups.get(printer.id) ?? { printer, station: station?.name ?? printer.name, items: [], copies: route?.copies ?? 1 };
    g.items.push({ qty: it.quantity, name: it.nameSnapshot, note: it.note, mods: mods.filter((m) => m.orderItemId === it.id).map((m) => m.nameSnapshot) });
    groups.set(printer.id, g);
  }
  if (groups.size === 0 && items.length > 0) {
    const fallbackPrinter = printers.find((p) => p.role === "receipt") ?? printers[0];
    if (fallbackPrinter) {
      groups.set(fallbackPrinter.id, {
        printer: fallbackPrinter,
        station: "Kitchen",
        items: items.map((it) => ({
          qty: it.quantity,
          name: it.nameSnapshot,
          note: it.note,
          mods: mods.filter((m) => m.orderItemId === it.id).map((m) => m.nameSnapshot),
        })),
        copies: 1,
      });
    }
  }
  const jobs = [...groups.values()].map((g) => ({
    printerName: g.printer.name, target: { connection: g.printer.connection, address: g.printer.address, port: g.printer.port }, copies: g.copies,
    data: b64(buildKot({ orderNo: o.orderNo, type: o.type, tableNo: o.tableNo, station: g.station, createdAt: o.createdAt.toISOString(), items: g.items }, g.printer.paperWidthMm === 58 ? 58 : 80)),
  }));
  return { ok: true as const, jobs };
}
type KotItem = { qty: number; name: string; note: string | null; mods: string[] };

/** Test print for the printer settings page. */
export async function getTestPrintJob(printerId: string) {
  const session = await requirePermission("settings.printers");
  const db = await getDb();
  const [p] = await db.select().from(s.printers).where(and(eq(s.printers.id, printerId), eq(s.printers.branchId, session.branchId)));
  if (!p) return { ok: false as const, error: "Printer not found" };
  const { EscPos } = await import("@/lib/adapters/printers/escpos");
  const data = new EscPos(p.paperWidthMm === 58 ? 32 : 48).init().align("center").bold(true).size(2, 2).line("CRSP").size(1, 1).bold(false)
    .line(`Test print - ${p.name}`).line(new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" })).feed(4).cut().bytes();
  return { ok: true as const, data: b64(data), target: { connection: p.connection, address: p.address, port: p.port } };
}
