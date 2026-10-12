import { requireSession } from "@/lib/auth/session";
import { businessDate } from "@/lib/domain/dates";
import { resolveBranchIds } from "@/lib/queries/branches";
import { REPORTS } from "@/lib/reports/engine";
import { fmtCell } from "@/lib/reports/export";
import { ReportFilters } from "./report-filters";
import { NavReports } from "./nav-reports";

const ok = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const session = await requireSession({ kind: "admin" });
  const available = REPORTS.filter((r) => session.can(r.permission));
  if (!available.length) return <p className="text-muted">You do not have access to reports.</p>;
  const sp = await searchParams;
  const def = (typeof sp.report === "string" && available.find((r) => r.key === sp.report)) || available[0];
  const today = businessDate();
  const from = ok(sp.from) ?? `${today.slice(0, 7)}-01`, to = ok(sp.to) ?? today;
  const { ids, branches, selected } = await resolveBranchIds(session, typeof sp.branch === "string" ? sp.branch : null);
  const result = await def.run({ branchIds: ids, from, to });
  const qs = `from=${from}&to=${to}&branch=${selected}`;
  const canExport = session.can("report.export");
  return (
    <div className="flex max-w-7xl gap-6">
      <NavReports reports={available.map((r) => ({ key: r.key, title: r.title, group: r.group }))} active={def.key} qs={qs} />
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold">{def.title}</h1>
        <p className="mb-3 text-muted">{def.description}</p>
        <ReportFilters report={def.key} from={from} to={to} branch={selected} branches={branches.map((b) => ({ id: b.id, name: b.name }))} today={today} />
        {canExport && (
          <div className="my-3 flex gap-2">
            {(["xlsx", "pdf", "csv"] as const).map((f) => <a key={f} href={`/api/reports/${def.key}?${qs}&format=${f}`} className="rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold uppercase hover:brightness-125">Export {f === "xlsx" ? "Excel" : f}</a>)}
          </div>
        )}
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2"><tr>{result.columns.map((c) => <th key={c.key} className={`p-3 font-semibold ${c.type === "text" ? "text-left" : "text-right"}`}>{c.label}</th>)}</tr></thead>
            <tbody>
              {result.rows.map((r, i) => <tr key={i} className="border-t border-border">{result.columns.map((c) => <td key={c.key} className={`p-3 ${c.type === "text" ? "" : "text-right tabular-nums"}`}>{fmtCell(c, r[c.key])}</td>)}</tr>)}
              {!result.rows.length && <tr><td colSpan={result.columns.length} className="p-10 text-center text-muted">No data for this range</td></tr>}
              {result.totals && result.rows.length > 0 && <tr className="border-t-2 border-border bg-surface-2 font-bold">{result.columns.map((c) => <td key={c.key} className={`p-3 ${c.type === "text" ? "" : "text-right tabular-nums"}`}>{fmtCell(c, result.totals![c.key])}</td>)}</tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
