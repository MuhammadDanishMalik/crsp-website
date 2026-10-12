import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

export type ReceiptData = {
  business: { name: string; ntn: string | null; header: string; footer: string; footerUr: string };
  branch: { name: string; address: string | null; phone: string | null };
  orderNo: string; type: string; tableNo: string | null; cashier: string; terminal: string; createdAt: string;
  customer: { name: string | null; phone: string | null } | null; deliveryAddress: string | null;
  lines: { name: string; qty: number; unit: number; total: number; mods: string[]; note: string | null }[];
  subtotal: number; discount: number; serviceCharge: number; deliveryCharge: number;
  taxLines: { name: string; rateBps: number; amount: number }[]; total: number;
  payments: { method: string; amount: number; tendered: number | null; change: number | null; status: string; reference: string | null }[];
  taxInvoiceNo: string | null; qr: string | null; taxPending: boolean;
};

export async function loadReceipt(orderId: string): Promise<ReceiptData | null> {
  const db = await getDb();
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, orderId));
  if (!o) return null;
  const [[branch], [biz], [cashier], [terminal], items, taxLines, pays, [cust], [inv]] = await Promise.all([
    db.select().from(s.branches).where(eq(s.branches.id, o.branchId)),
    db.select().from(s.business).limit(1),
    db.select().from(s.staff).where(eq(s.staff.id, o.createdBy)),
    db.select().from(s.terminals).where(eq(s.terminals.id, o.terminalId)),
    db.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id)),
    db.select().from(s.orderTaxLines).where(eq(s.orderTaxLines.orderId, o.id)),
    db.select().from(s.payments).where(eq(s.payments.orderId, o.id)).orderBy(asc(s.payments.createdAt)),
    o.customerId ? db.select().from(s.customers).where(eq(s.customers.id, o.customerId)) : Promise.resolve([]),
    db.select().from(s.taxInvoices).where(eq(s.taxInvoices.orderId, o.id)),
  ]);
  const mods = items.length ? await db.select().from(s.orderItemModifiers).where(inArray(s.orderItemModifiers.orderItemId, items.map((i) => i.id))) : [];
  const settings = (biz.settings ?? {}) as { receiptHeader?: string; receiptFooter?: string; receiptFooterUr?: string };
  return {
    business: { name: biz.name, ntn: biz.ntn, header: settings.receiptHeader ?? "", footer: settings.receiptFooter ?? "Thank you!", footerUr: settings.receiptFooterUr ?? "" },
    branch: { name: branch.name, address: branch.address, phone: branch.phone },
    orderNo: o.orderNo, type: o.type, tableNo: o.tableNo, cashier: cashier?.fullName ?? "", terminal: terminal?.name ?? "", createdAt: o.createdAt.toISOString(),
    customer: cust ? { name: cust.name, phone: cust.phone } : null, deliveryAddress: o.deliveryAddress,
    lines: items.filter((i) => !i.isVoided).map((i) => ({
      name: i.nameSnapshot, qty: i.quantity, unit: i.unitPrice, total: i.lineTotal, note: i.note,
      mods: mods.filter((m) => m.orderItemId === i.id).map((m) => m.nameSnapshot),
    })),
    subtotal: o.subtotal, discount: o.discountTotal, serviceCharge: o.serviceCharge, deliveryCharge: o.deliveryCharge,
    taxLines: taxLines.map((t) => ({ name: t.name, rateBps: t.rateBps, amount: t.amount })), total: o.total,
    payments: pays.map((p) => ({ method: p.method, amount: p.amount, tendered: p.tendered, change: p.changeGiven, status: p.status, reference: p.approvalCode ?? p.referenceNo })),
    taxInvoiceNo: inv?.authorityInvoiceNo ?? null, qr: inv?.qrPayload ?? null, taxPending: !!inv && !inv.authorityInvoiceNo,
  };
}
