import { asc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { loadMovements, loadStock, loadUnits } from "@/lib/queries/inventory";
import { InventoryView } from "./inventory-view";

export default async function InventoryPage() {
  const session = await requireSession({ permission: "inventory.view", kind: "admin" });
  const db = await getDb();
  const [stock, movements, { units, conv }, branches, reasons] = await Promise.all([
    loadStock(session.branchId), loadMovements(session.branchId), loadUnits(),
    db.select().from(s.branches).where(eq(s.branches.isActive, true)),
    db.select().from(s.reasonCodes).where(eq(s.reasonCodes.kind, "wastage")).orderBy(asc(s.reasonCodes.label)),
  ]);
  return (
    <InventoryView stock={stock} movements={movements} units={units} conv={conv}
      branches={branches.filter((b) => b.id !== session.branchId).map((b) => ({ id: b.id, name: b.name }))} reasons={reasons.map((r) => ({ id: r.id, label: r.label }))}
      can={{ adjust: session.can("inventory.adjust"), waste: session.can("inventory.wastage"), transfer: session.can("inventory.transfer"), cost: session.can("report.inventory") || session.can("inventory.recipes") }} />
  );
}
