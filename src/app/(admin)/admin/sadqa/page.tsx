import { requireSession } from "@/lib/auth/session";
import { businessDate } from "@/lib/domain/dates";
import { resolveBranchIds } from "@/lib/queries/branches";
import { loadSadqa, loadSadqaRules, sadqaBalance } from "@/lib/queries/sadqa";
import { SadqaView } from "./sadqa-view";

const ok = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export default async function SadqaPage({ searchParams }: PageProps<"/admin/sadqa">) {
  const session = await requireSession({ permission: "sadqa.view", kind: "admin" });
  const sp = await searchParams;
  const today = businessDate();
  const from = ok(sp.from) ?? `${today.slice(0, 7)}-01`, to = ok(sp.to) ?? today;
  const { ids } = await resolveBranchIds(session, typeof sp.branch === "string" ? sp.branch : null);
  const [range, balance, rules, todayData] = await Promise.all([loadSadqa(ids, from, to), sadqaBalance(ids), loadSadqaRules(), loadSadqa(ids, today, today)]);
  return <SadqaView from={from} to={to} today={today} range={range} balance={balance} todaySet={todayData.totalSet} rules={rules.rules} items={rules.items} canManage={session.can("sadqa.manage")} />;
}
