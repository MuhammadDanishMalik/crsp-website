import "server-only";
import { and, asc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { getTaxAdapter, retryDelayMinutes, type InvoicePayload } from "@/lib/adapters/tax-authority";

const MAX_ATTEMPTS = 12;

async function buildPayload(orderId: string): Promise<{ payload: InvoicePayload; authority: "fbr" | "pra" | "none" } | null> {
  const db = await getDb();
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, orderId));
  if (!o) return null;
  const [[branch], [biz], items, taxLines, pays] = await Promise.all([
    db.select().from(s.branches).where(eq(s.branches.id, o.branchId)), db.select().from(s.business).limit(1),
    db.select().from(s.orderItems).where(and(eq(s.orderItems.orderId, o.id), eq(s.orderItems.isVoided, false))),
    db.select().from(s.orderTaxLines).where(eq(s.orderTaxLines.orderId, o.id)), db.select().from(s.payments).where(eq(s.payments.orderId, o.id)),
  ]);
  return {
    authority: branch.taxAuthority,
    payload: {
      invoiceRef: o.id, orderNo: o.orderNo, issuedAt: o.createdAt.toISOString(),
      branch: { code: branch.code, name: branch.name, posId: branch.posId, taxRegistrationNo: branch.taxRegistrationNo, ntn: biz?.ntn ?? null },
      items: items.map((i) => ({ name: i.nameSnapshot, qty: i.quantity, unitPrice: i.unitPrice, total: i.lineTotal })),
      subtotal: o.subtotal, discount: o.discountTotal, serviceCharge: o.serviceCharge, deliveryCharge: o.deliveryCharge,
      taxLines: taxLines.map((t) => ({ name: t.name, rateBps: t.rateBps, amount: t.amount })), taxTotal: o.taxTotal, total: o.total, paymentMethods: [...new Set(pays.map((p) => p.method))],
    },
  };
}

/** Make sure an order has a queued invoice row if its branch reports to an authority. */
export async function enqueueInvoice(orderId: string, branchId: string) {
  const db = await getDb();
  const [b] = await db.select({ a: s.branches.taxAuthority }).from(s.branches).where(eq(s.branches.id, branchId));
  if (!b || b.a === "none") return false;
  await db.insert(s.taxInvoices).values({ orderId, branchId, authority: b.a, state: "pending" }).onConflictDoNothing();
  return true;
}

/** One attempt for one order. Never throws: failures are recorded and retried later by the queue. */
export async function submitInvoice(orderId: string): Promise<"sent" | "queued" | "skipped"> {
  const db = await getDb();
  const [row] = await db.select().from(s.taxInvoices).where(eq(s.taxInvoices.orderId, orderId));
  if (!row) return "skipped";
  if (row.state === "sent") return "sent";
  const built = await buildPayload(orderId);
  const adapter = built ? getTaxAdapter(built.authority) : null;
  const attempts = row.attempts + 1;
  if (!built || !adapter) {
    await db.update(s.taxInvoices).set({ state: "pending", lastError: "Authority credentials are not configured", nextRetryAt: new Date(Date.now() + 15 * 60_000) }).where(eq(s.taxInvoices.id, row.id));
    return "queued";
  }
  try {
    const r = await adapter.submit(built.payload);
    await db.update(s.taxInvoices).set({ state: "sent", attempts, authorityInvoiceNo: r.invoiceNo, qrPayload: r.qrPayload, sentAt: new Date(), lastError: null, nextRetryAt: null, requestPayload: built.payload, responsePayload: (r.raw ?? null) as never }).where(eq(s.taxInvoices.id, row.id));
    return "sent";
  } catch (e) {
    await db.update(s.taxInvoices).set({ state: "failed", attempts, lastError: e instanceof Error ? e.message.slice(0, 300) : "failed", nextRetryAt: new Date(Date.now() + retryDelayMinutes(attempts) * 60_000), requestPayload: built.payload }).where(eq(s.taxInvoices.id, row.id));
    return "queued";
  }
}

/** Retry everything that is due (cron route and the admin "retry now" button). */
export async function processTaxQueue(opts: { limit?: number; force?: boolean } = {}) {
  const db = await getDb();
  const due = await db.select().from(s.taxInvoices)
    .where(and(inArray(s.taxInvoices.state, ["pending", "failed"]), lt(s.taxInvoices.attempts, MAX_ATTEMPTS), opts.force ? undefined : or(isNull(s.taxInvoices.nextRetryAt), lte(s.taxInvoices.nextRetryAt, new Date()))))
    .orderBy(asc(s.taxInvoices.createdAt)).limit(opts.limit ?? 25);
  let sent = 0, queued = 0;
  for (const r of due) {
    if ((await submitInvoice(r.orderId)) === "sent") sent++;
    else queued++;
  }
  return { tried: due.length, sent, queued };
}

/** Attempt an order's invoice with a short wait so the receipt can usually carry the number; otherwise it stays queued. */
export async function fiscalizeNow(orderId: string, branchId: string, waitMs = 3500) {
  if (!(await enqueueInvoice(orderId, branchId))) return;
  await Promise.race([submitInvoice(orderId), new Promise((r) => setTimeout(r, waitMs))]);
}

/** Void after filing: tell the authority (best effort). The row keeps the trail either way. */
export async function cancelInvoiceFor(orderId: string, reason: string) {
  const db = await getDb();
  const [row] = await db.select().from(s.taxInvoices).where(eq(s.taxInvoices.orderId, orderId));
  if (!row?.authorityInvoiceNo) return;
  try { await getTaxAdapter(row.authority)?.cancel(row.authorityInvoiceNo, reason); await db.update(s.taxInvoices).set({ lastError: `Cancelled with authority: ${reason}` }).where(eq(s.taxInvoices.id, row.id)); }
  catch (e) { await db.update(s.taxInvoices).set({ lastError: `Cancel NOT confirmed by authority: ${e instanceof Error ? e.message : "failed"} — issue a credit note manually` }).where(eq(s.taxInvoices.id, row.id)); }
}
