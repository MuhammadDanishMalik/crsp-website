import { requireSession } from "@/lib/auth/session";
import { businessDate } from "@/lib/domain/dates";
import { loadDayEnd, loadPnl } from "@/lib/queries/accounts";
import { AccountsView } from "./accounts-view";

export default async function AccountsPage({ searchParams }: PageProps<"/admin/accounts">) {
  const session = await requireSession({ kind: "admin" });
  const can = { pnl: session.can("report.financial"), deposits: session.can("bank_deposit.manage") };
  if (!can.pnl && !can.deposits) return <p className="text-muted">You do not have access to accounts.</p>;
  const sp = await searchParams;
  const today = businessDate();
  const ok = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const date = ok(sp.date) ?? today, from = ok(sp.from) ?? `${today.slice(0, 7)}-01`, to = ok(sp.to) ?? today;
  const [pnl, day] = await Promise.all([can.pnl ? loadPnl(session.branchId, from, to) : null, loadDayEnd(session.branchId, date)]);
  return <AccountsView {...{ date, from, to, pnl, day, can }} />;
}
