import { and, asc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { PrinterSettings } from "./printer-settings";

export default async function PrintersPage() {
  const session = await requireSession({ permission: "settings.printers", kind: "admin" });
  const db = await getDb();
  const [printers, stations, cats, items] = await Promise.all([
    db.select().from(s.printers).where(and(eq(s.printers.branchId, session.branchId), eq(s.printers.isActive, true))).orderBy(asc(s.printers.name)),
    db.select().from(s.kitchenStations).where(eq(s.kitchenStations.branchId, session.branchId)).orderBy(asc(s.kitchenStations.name)),
    db.select().from(s.categories).orderBy(asc(s.categories.sortOrder)),
    db.select({ cat: s.menuItems.categoryId, st: s.menuItems.kitchenStationId }).from(s.menuItems).where(eq(s.menuItems.isActive, true)),
  ]);
  return (
    <PrinterSettings
      printers={printers.map((p) => ({ id: p.id, name: p.name, role: p.role as "receipt" | "kot", connection: p.connection, address: p.address ?? "", port: p.port ?? 9100, paperWidthMm: p.paperWidthMm === 58 ? 58 : 80, openDrawer: p.openDrawer }))}
      stations={stations.map((x) => ({ id: x.id, name: x.name, printerId: x.printerId, warnMinutes: x.warnSeconds / 60, lateMinutes: x.lateSeconds / 60 }))}
      categories={cats.map((c) => ({ id: c.id, name: c.name, stationId: items.find((i) => i.cat === c.id)?.st ?? null }))}
    />
  );
}
