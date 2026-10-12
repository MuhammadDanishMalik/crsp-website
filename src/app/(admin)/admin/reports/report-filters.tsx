"use client";
import { useRouter } from "next/navigation";

const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export function ReportFilters({ report, from, to, branch, branches, today }: { report: string; from: string; to: string; branch: string; branches: { id: string; name: string }[]; today: string }) {
  const router = useRouter();
  const go = (p: { from?: string; to?: string; branch?: string }) => router.push(`/admin/reports?report=${report}&from=${p.from ?? from}&to=${p.to ?? to}&branch=${p.branch ?? branch}`);
  const quick = [
    ["Today", today, today], ["Yesterday", addDays(today, -1), addDays(today, -1)], ["Last 7 days", addDays(today, -6), today], ["This month", `${today.slice(0, 7)}-01`, today], ["Last 30 days", addDays(today, -29), today],
  ] as const;
  const field = "h-12 rounded-xl border border-border bg-surface px-3";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" className={field} value={from} onChange={(e) => go({ from: e.target.value })} aria-label="From" />
      <span className="text-muted">to</span>
      <input type="date" className={field} value={to} onChange={(e) => go({ to: e.target.value })} aria-label="To" />
      {branches.length > 1 && (
        <select className={field} value={branch} onChange={(e) => go({ branch: e.target.value })} aria-label="Branch">
          <option value="all">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      <div className="flex flex-wrap gap-1">{quick.map(([l, f, t]) => <button key={l} onClick={() => go({ from: f, to: t })} className="h-12 rounded-xl bg-surface-2 px-3 text-sm font-semibold hover:brightness-125">{l}</button>)}</div>
    </div>
  );
}
