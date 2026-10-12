import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getOpenShift, shiftSummary } from "@/lib/queries/shift";
import { ShiftPanel } from "./shift-panel";

export default async function ShiftPage() {
  const session = await requireSession({ kind: "pos" });
  const shift = await getOpenShift(session.terminalId, session.staffId);
  if (!shift) redirect("/order");
  const sum = await shiftSummary(shift.id);
  // X-report. The expected cash figure is withheld from the cashier until the blind count is submitted.
  return (
    <ShiftPanel
      canCashMove={session.can("shift.cash_in_out")} canClose={session.can("shift.close")} canSeeExpected={session.can("shift.close_any")}
      data={{
        openedAt: shift.openedAt.toISOString(), float: shift.openingFloat, orders: sum.orders, byMethod: sum.byMethod,
        cashIn: sum.cashIn, cashOut: sum.cashOut, cashSales: sum.cashSales, refunds: sum.refundTotal, cashRefunds: sum.cashRefunds, expected: session.can("shift.close_any") ? sum.expectedCash : null,
        moves: sum.moves.filter((m) => m.type === "cash_in" || m.type === "cash_out").map((m) => ({ type: m.type, amount: m.amount, reason: m.reason, at: m.createdAt.toISOString() })),
      }}
    />
  );
}
