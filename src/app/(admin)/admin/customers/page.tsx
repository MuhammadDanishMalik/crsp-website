import { desc, eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { CustomersView } from "./customers-view";

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const session = await requireSession({ permission: "customer.view", kind: "admin" });
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const db = await getDb();
  const [all, orders] = await Promise.all([db.select().from(s.customers).orderBy(desc(s.customers.createdAt)), db.select({ id: s.orders.id, c: s.orders.customerId, total: s.orders.total, date: s.orders.businessDate, no: s.orders.orderNo, type: s.orders.type, status: s.orders.status }).from(s.orders).where(eq(s.orders.status, "completed")).limit(5000)]);
  const live = orders.filter((o) => o.c);
  const list = all.filter((c) => !q || (c.name ?? "").toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 200);
  const ids = list.map((c) => c.id);
  const [addrs, ledger] = ids.length ? await Promise.all([db.select().from(s.customerAddresses).where(inArray(s.customerAddresses.customerId, ids)), db.select().from(s.loyaltyTransactions).where(inArray(s.loyaltyTransactions.customerId, ids)).orderBy(desc(s.loyaltyTransactions.createdAt))]) : [[], []];
  return (
    <CustomersView q={q} can={{ manage: session.can("customer.manage"), adjust: session.can("loyalty.adjust") }}
      customers={list.map((c) => {
        const mine = live.filter((o) => o.c === c.id);
        return {
          id: c.id, name: c.name ?? "", phone: c.phone, notes: c.notes ?? "", points: c.loyaltyPoints, isCorporate: c.isCorporate, credit: c.creditLimit,
          orders: mine.length, spend: mine.reduce((a, o) => a + o.total, 0), last: mine.map((o) => o.date).sort().at(-1) ?? "",
          history: mine.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((o) => ({ no: o.no, date: o.date, total: o.total, type: o.type })),
          addresses: [...new Set(addrs.filter((a) => a.customerId === c.id).map((a) => a.address))].slice(0, 5),
          ledger: ledger.filter((l) => l.customerId === c.id).slice(0, 15).map((l) => ({ at: l.createdAt.toISOString(), points: l.points, reason: l.reason })),
        };
      })}
    />
  );
}
