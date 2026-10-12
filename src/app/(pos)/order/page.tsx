import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { loadPosMenu } from "@/lib/queries/menu";
import { getOpenShift } from "@/lib/queries/shift";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { PosScreen } from "./pos-screen";
import { OpenShift } from "./open-shift";

export default async function OrderPage() {
  const session = await requireSession({ permission: "order.create", kind: "pos" });
  if (session.kind !== "pos") redirect("/admin");
  const shift = await getOpenShift(session.terminalId, session.staffId);
  if (!shift) return <OpenShift name={session.name} canOpen={session.can("shift.open")} />;
  const menu = await loadPosMenu(session.branchId);
  const db = await getDb();
  const [[term], [biz], [branch], printers, stations] = await Promise.all([
    db.select().from(s.terminals).where(eq(s.terminals.id, session.terminalId!)), db.select().from(s.business).limit(1), db.select().from(s.branches).where(eq(s.branches.id, session.branchId)),
    db.select().from(s.printers).where(and(eq(s.printers.branchId, session.branchId), eq(s.printers.isActive, true))), db.select().from(s.kitchenStations).where(eq(s.kitchenStations.branchId, session.branchId)),
  ]);
  const toTarget = (p: (typeof printers)[number]) => ({ connection: p.connection, address: p.address, port: p.port });
  const rp = printers.find((p) => p.role === "receipt");
  const bizSettings = (biz?.settings ?? {}) as { receiptHeader?: string; receiptFooter?: string; receiptFooterUr?: string };
  const offlineCfg = {
    prefix: term?.orderNoPrefix || "T", shiftId: shift.id, staffId: session.staffId, staffName: session.name, terminalName: session.terminalName ?? "",
    info: { businessName: biz?.name ?? "CRSP", ntn: biz?.ntn ?? null, header: bizSettings.receiptHeader ?? "", footer: bizSettings.receiptFooter ?? "Thank you!", footerUr: bizSettings.receiptFooterUr ?? "", branchName: branch.name, address: branch.address, phone: branch.phone },
    receiptPrinter: rp ? { target: toTarget(rp), paperMm: (rp.paperWidthMm === 58 ? 58 : 80) as 58 | 80, openDrawer: rp.openDrawer } : null,
    kotPrinters: printers.filter((p) => p.role === "kot").map((p) => ({ id: p.id, name: p.name, target: toTarget(p), paperMm: (p.paperWidthMm === 58 ? 58 : 80) as 58 | 80 })),
    stationPrinter: Object.fromEntries(stations.map((x) => [x.id, x.printerId])), stationName: Object.fromEntries(stations.map((x) => [x.id, x.name])),
  };
  return (
    <PosScreen
      menu={menu}
      offline={offlineCfg}
      shiftOpenedAt={shift.openedAt.toISOString()}
      me={{
        name: session.name, branch: session.branchName, terminal: session.terminalName ?? "—",
        discountLimitBps: session.discountLimitBps,
        can: { discount: session.can("discount.apply"), discountAbove: session.can("discount.apply.above_10pct"), split: session.can("payment.split"), noSale: session.can("drawer.open_no_sale"), hold: session.can("order.hold"), deliveryBoard: session.can("delivery.assign") || session.can("delivery.settle"), moveTable: session.can("order.transfer_table"), delivery: session.can("order.delivery.create"), aggregator: session.can("order.aggregator.create"), shift: session.can("shift.close") || session.can("shift.cash_in_out"), admin: session.can("menu.manage") },
      }}
    />
  );
}
