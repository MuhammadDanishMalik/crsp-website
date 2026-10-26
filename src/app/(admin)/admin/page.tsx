import { requireSession } from "@/lib/auth/session";
import { businessDate } from "@/lib/domain/dates";
import { resolveBranchIds } from "@/lib/queries/branches";
import { loadDashboard } from "@/lib/queries/dashboard";
import { Dashboard } from "./dashboard";

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const session = await requireSession({ kind: "admin" });
  const sp = await searchParams;
  const { ids, branches, selected } = await resolveBranchIds(session, typeof sp.branch === "string" ? sp.branch : null);
  const date = sp.date === "all" ? "all" : typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : businessDate();
  const canSee = session.can("dashboard.view");
  const data = canSee ? await loadDashboard(ids, date) : null;
  return <Dashboard name={session.name} data={data} date={date} today={businessDate()} branch={selected} branches={branches.map((b) => ({ id: b.id, name: b.name }))} />;
}
