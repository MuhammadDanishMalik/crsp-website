import "server-only";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

export type DeliveryRow = {
  id: string; orderId: string; orderNo: string; status: string; address: string; customerName: string; customerPhone: string; total: number;
  cashToCollect: number; cashCollected: number | null; riderId: string | null; riderName: string; items: string; createdAt: string; assignedAt: string | null; deliveredAt: string | null; settled: boolean; note: string;
};

export async function loadDeliveries(branchId: string, opts: { riderId?: string; onlyOpen?: boolean; sinceDays?: number } = {}): Promise<DeliveryRow[]> {
  const db = await getDb();
  const conds = [eq(s.deliveries.branchId, branchId)];
  if (opts.riderId) conds.push(eq(s.deliveries.riderId, opts.riderId));
  if (opts.onlyOpen) conds.push(inArray(s.deliveries.status, ["unassigned", "assigned", "picked"]));
  const rows = await db.select().from(s.deliveries).where(and(...conds)).orderBy(desc(s.deliveries.assignedAt)).limit(200);
  if (!rows.length) return [];
  const [orders, items, riders] = await Promise.all([
    db.select().from(s.orders).where(inArray(s.orders.id, rows.map((r) => r.orderId))),
    db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, rows.map((r) => r.orderId))),
    db.select({ id: s.staff.id, n: s.staff.fullName }).from(s.staff),
  ]);
  const custIds = orders.map((o) => o.customerId).filter((x): x is string => !!x);
  const custs = custIds.length ? await db.select().from(s.customers).where(inArray(s.customers.id, custIds)) : [];
  return rows.map((d) => {
    const o = orders.find((x) => x.id === d.orderId)!;
    const c = custs.find((x) => x.id === o.customerId);
    return {
      id: d.id, orderId: d.orderId, orderNo: o.orderNo, status: d.status, address: o.deliveryAddress ?? "", customerName: c?.name ?? "", customerPhone: c?.phone ?? "", total: o.total,
      cashToCollect: d.cashToCollect, cashCollected: d.cashCollected, riderId: d.riderId, riderName: riders.find((r) => r.id === d.riderId)?.n ?? "",
      items: items.filter((i) => i.orderId === o.id && !i.isVoided).map((i) => `${i.quantity}× ${i.nameSnapshot}`).join(", "), createdAt: o.createdAt.toISOString(),
      assignedAt: d.assignedAt?.toISOString() ?? null, deliveredAt: d.deliveredAt?.toISOString() ?? null, settled: !!d.settlementId, note: d.failureReason ?? "",
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Riders at a branch with the cash they are holding (delivered, not yet handed over). */
export async function loadRiderCash(branchId: string) {
  const db = await getDb();
  const links = await db.select().from(s.staffBranches).where(eq(s.staffBranches.branchId, branchId));
  const staff = links.length ? await db.select().from(s.staff).where(and(inArray(s.staff.id, links.map((l) => l.staffId)), eq(s.staff.isActive, true))) : [];
  const perms = await db.select().from(s.rolePermissions).where(eq(s.rolePermissions.permission, "delivery.view_assigned"));
  const riders = staff.filter((st) => perms.some((p) => p.roleId === st.roleId));
  const pending = await db.select().from(s.deliveries).where(and(eq(s.deliveries.branchId, branchId), eq(s.deliveries.status, "delivered"), isNull(s.deliveries.settlementId), ne(s.deliveries.cashToCollect, 0)));
  return riders.map((r) => {
    const mine = pending.filter((d) => d.riderId === r.id);
    return { id: r.id, name: r.fullName, deliveries: mine.length, holding: mine.reduce((a, d) => a + (d.cashCollected ?? 0), 0) };
  });
}
