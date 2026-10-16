import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import type { ManageableOrder, OrderItemDetail } from "@/components/orders/orders-manager";

export async function loadManageableOrders(branchIds: string | string[], limit = 200): Promise<ManageableOrder[]> {
  const db = await getDb();
  const branches = Array.isArray(branchIds) ? branchIds : [branchIds];
  if (!branches.length) return [];

  const orders = await db
    .select()
    .from(s.orders)
    .where(inArray(s.orders.branchId, branches))
    .orderBy(desc(s.orders.createdAt))
    .limit(limit);

  if (!orders.length) return [];

  const orderIds = orders.map((o) => o.id);
  const staffIds = [...new Set(orders.map((o) => o.createdBy).filter(Boolean))];
  const terminalIds = [...new Set(orders.map((o) => o.terminalId).filter(Boolean))];
  const customerIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean) as string[])];

  const [items, taxLines, payments, staffList, terminalsList, customersList] = await Promise.all([
    db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, orderIds)),
    db.select().from(s.orderTaxLines).where(inArray(s.orderTaxLines.orderId, orderIds)),
    db.select().from(s.payments).where(inArray(s.payments.orderId, orderIds)),
    staffIds.length ? db.select().from(s.staff).where(inArray(s.staff.id, staffIds)) : Promise.resolve([]),
    terminalIds.length ? db.select().from(s.terminals).where(inArray(s.terminals.id, terminalIds)) : Promise.resolve([]),
    customerIds.length ? db.select().from(s.customers).where(inArray(s.customers.id, customerIds)) : Promise.resolve([]),
  ]);

  const itemIds = items.map((i) => i.id);
  const mods = itemIds.length
    ? await db.select().from(s.orderItemModifiers).where(inArray(s.orderItemModifiers.orderItemId, itemIds))
    : [];

  const staffMap = new Map(staffList.map((st) => [st.id, st.fullName]));
  const termMap = new Map(terminalsList.map((t) => [t.id, t.name]));
  const custMap = new Map(customersList.map((c) => [c.id, c]));

  return orders.map((o) => {
    const orderItems = items.filter((i) => i.orderId === o.id);
    const orderPayments = payments.filter((p) => p.orderId === o.id);
    const cust = o.customerId ? custMap.get(o.customerId) : null;

    const formattedItems: OrderItemDetail[] = orderItems.map((it) => ({
      id: it.id,
      name: it.nameSnapshot,
      sizeName: null,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      lineTotal: it.lineTotal,
      note: it.note ?? null,
      isVoided: it.isVoided,
      modifiers: mods.filter((m) => m.orderItemId === it.id).map((m) => m.nameSnapshot),
    }));

    const refunded = orderPayments
      .filter((p) => p.status === "refunded")
      .reduce((sum, p) => sum + p.amount, 0);

    const isPending = orderPayments.some(
      (p) => p.status === "pending_verification" || p.status === "pending"
    );

    return {
      id: o.id,
      no: o.orderNo,
      type: o.type,
      status: o.status,
      total: o.total,
      subtotal: o.subtotal,
      taxTotal: o.taxTotal,
      discountTotal: o.discountTotal,
      deliveryCharge: o.deliveryCharge,
      at: o.createdAt.toISOString(),
      table: o.tableNo ?? null,
      guestCount: null,
      customerName: o.customerName ?? cust?.name ?? null,
      customerPhone: cust?.phone ?? null,
      deliveryAddress: o.deliveryAddress ?? null,
      cashierName: staffMap.get(o.createdBy) ?? null,
      terminalName: termMap.get(o.terminalId) ?? null,
      methods: [...new Set(orderPayments.map((p) => p.method))],
      pending: isPending,
      refunded,
      items: formattedItems,
    };
  });
}
