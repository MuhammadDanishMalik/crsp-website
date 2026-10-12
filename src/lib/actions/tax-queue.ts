"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { processTaxQueue, submitInvoice } from "@/lib/tax/fiscalize";
import { guard, type R } from "./_guard";

export async function retryInvoice(orderId: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.tax_authority");
    const r = await submitInvoice(orderId);
    await audit(session, { action: "tax.retry", entity: "order", entityId: orderId, after: { result: r } });
    revalidatePath("/admin/tax-invoices");
    return r === "sent" ? { ok: true, message: "Invoice accepted" } : { ok: false, error: "Still queued — see the error column" };
  });
}

export async function retryAllInvoices(): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.tax_authority");
    const r = await processTaxQueue({ force: true, limit: 100 });
    await audit(session, { action: "tax.retry_all", entity: "tax_invoices", after: r });
    revalidatePath("/admin/tax-invoices");
    return { ok: true, message: `Tried ${r.tried}: ${r.sent} accepted, ${r.queued} still queued` };
  });
}
