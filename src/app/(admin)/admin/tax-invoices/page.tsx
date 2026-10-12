import { desc, eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { TaxInvoicesView } from "./tax-invoices-view";

export default async function TaxInvoicesPage() {
  const session = await requireSession({ permission: "settings.tax_authority", kind: "admin" });
  const db = await getDb();
  const rows = await db.select().from(s.taxInvoices).where(eq(s.taxInvoices.branchId, session.branchId)).orderBy(desc(s.taxInvoices.createdAt)).limit(150);
  const orders = rows.length ? await db.select({ id: s.orders.id, no: s.orders.orderNo, total: s.orders.total, date: s.orders.businessDate }).from(s.orders).where(inArray(s.orders.id, rows.map((r) => r.orderId))) : [];
  const [branch] = await db.select().from(s.branches).where(eq(s.branches.id, session.branchId));
  return (
    <TaxInvoicesView authority={branch.taxAuthority} mock={!process.env.FBR_API_URL && !process.env.PRA_API_URL}
      rows={rows.map((r) => ({ orderId: r.orderId, no: orders.find((o) => o.id === r.orderId)?.no ?? "", date: orders.find((o) => o.id === r.orderId)?.date ?? "", total: orders.find((o) => o.id === r.orderId)?.total ?? 0, state: r.state, invoiceNo: r.authorityInvoiceNo ?? "", attempts: r.attempts, error: r.lastError ?? "", next: r.nextRetryAt?.toISOString() ?? "" }))} />
  );
}
