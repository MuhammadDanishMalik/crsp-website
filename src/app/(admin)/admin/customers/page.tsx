import { desc, inArray, notInArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { CustomersView } from "./customers-view";

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const session = await requireSession({ permission: "customer.view", kind: "admin" });
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const db = await getDb();
  const [all, orders] = await Promise.all([db.select().from(s.customers).orderBy(desc(s.customers.createdAt)), db.select({ id: s.orders.id, c: s.orders.customerId, total: s.orders.total, date: s.orders.businessDate, no: s.orders.orderNo, type: s.orders.type, status: s.orders.status, addr: s.orders.deliveryAddress }).from(s.orders).where(notInArray(s.orders.status, ["voided", "refunded", "held"])).orderBy(desc(s.orders.createdAt)).limit(5000)]);
  const live = orders.filter((o) => o.c);
  const count = new Map<string, { n: number; spend: number }>();
  for (const o of live) { const x = count.get(o.c!) ?? { n: 0, spend: 0 }; x.n++; x.spend += o.total; count.set(o.c!, x); }
  const repeatCount = all.filter((c) => (count.get(c.id)?.n ?? 0) >= 2).length;
  // Opens on the customers who keep coming back; a search looks through everybody.
  const view = sp.view === "all" || q ? "all" : "repeat";
  let pool = all.filter((c) => !q || (c.name ?? "").toLowerCase().includes(q) || c.phone.includes(q));
  if (view === "repeat") pool = pool.filter((c) => (count.get(c.id)?.n ?? 0) >= 2).sort((a, b) => (count.get(b.id)!.n - count.get(a.id)!.n) || (count.get(b.id)!.spend - count.get(a.id)!.spend));
  const list = pool.slice(0, 200);
  const ids = list.map((c) => c.id);
  const [addrs, ledger] = ids.length ? await Promise.all([db.select().from(s.customerAddresses).where(inArray(s.customerAddresses.customerId, ids)), db.select().from(s.loyaltyTransactions).where(inArray(s.loyaltyTransactions.customerId, ids)).orderBy(desc(s.loyaltyTransactions.createdAt))]) : [[], []];
  return (
    <CustomersView q={q} view={view} totals={{ all: all.length, repeat: repeatCount }} can={{ manage: session.can("customer.manage"), adjust: session.can("loyalty.adjust") }}
      customers={list.map((c) => {
        const mine = live.filter((o) => o.c === c.id);
        return {
          id: c.id, name: c.name ?? "", phone: c.phone, notes: c.notes ?? "", points: c.loyaltyPoints, isCorporate: c.isCorporate, credit: c.creditLimit,
          orders: mine.length, spend: mine.reduce((a, o) => a + o.total, 0), last: mine.map((o) => o.date).sort().at(-1) ?? "",
          history: mine.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((o) => ({ no: o.no, date: o.date, total: o.total, type: o.type })),
          address: addrs.filter((a) => a.customerId === c.id).sort((a, b) => (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0))[0]?.address ?? mine.find((o) => o.addr)?.addr ?? "",
          addresses: [...new Set(addrs.filter((a) => a.customerId === c.id).map((a) => a.address))].slice(0, 5),
          ledger: ledger.filter((l) => l.customerId === c.id).slice(0, 15).map((l) => ({ at: l.createdAt.toISOString(), points: l.points, reason: l.reason })),
        };
      })}
    />
  );
}
