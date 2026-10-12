import { and, desc, eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { loadStock, loadUnits } from "@/lib/queries/inventory";
import { PurchasingView } from "./purchasing-view";

export default async function PurchasingPage() {
  const session = await requireSession({ kind: "admin" });
  if (!session.can("purchasing.manage") && !session.can("purchasing.pay_supplier")) return <p className="text-muted">You do not have access to purchasing.</p>;
  const db = await getDb();
  const [suppliers, pos, stock, { units, conv }] = await Promise.all([
    db.select().from(s.suppliers).where(eq(s.suppliers.isActive, true)),
    db.select().from(s.purchaseOrders).where(eq(s.purchaseOrders.branchId, session.branchId)).orderBy(desc(s.purchaseOrders.createdAt)).limit(50),
    loadStock(session.branchId), loadUnits(),
  ]);
  const lines = pos.length ? await db.select().from(s.purchaseOrderLines).where(inArray(s.purchaseOrderLines.poId, pos.map((p) => p.id))) : [];
  const pays = await db.select().from(s.supplierPayments).where(and(eq(s.supplierPayments.branchId, session.branchId))).orderBy(desc(s.supplierPayments.createdAt)).limit(30);
  return (
    <PurchasingView
      can={{ manage: session.can("purchasing.manage"), pay: session.can("purchasing.pay_supplier") }}
      suppliers={suppliers.map((x) => ({ id: x.id, name: x.name, phone: x.phone ?? "", address: x.address ?? "", isImporter: x.isImporter, balance: x.balance }))}
      orders={pos.map((p) => ({ id: p.id, no: p.poNo, supplier: suppliers.find((x) => x.id === p.supplierId)?.name ?? "", status: p.status, total: p.total, at: p.createdAt.toISOString(),
        lines: lines.filter((l) => l.poId === p.id).map((l) => { const ing = stock.find((i) => i.id === l.ingredientId); return { id: l.id, name: ing?.name ?? "", imported: !!ing?.isImported, qty: Number(l.quantity), unit: ing?.unit ?? "", unitCost: l.unitCost }; }) }))}
      payments={pays.map((p) => ({ id: p.id, supplier: suppliers.find((x) => x.id === p.supplierId)?.name ?? "", amount: p.amount, method: p.method, at: p.createdAt.toISOString(), ref: p.reference ?? "" }))}
      ingredients={stock.map((i) => ({ id: i.id, name: i.name, baseUnitId: i.baseUnitId, imported: i.isImported }))} units={units} conv={conv}
    />
  );
}
