import Link from "next/link";
import { cn } from "@/lib/utils";

export function NavReports({ reports, active, qs }: { reports: { key: string; title: string; group: string }[]; active: string; qs: string }) {
  const groups = [...new Set(reports.map((r) => r.group))];
  return (
    <nav className="w-52 shrink-0 space-y-4">
      {groups.map((g) => (
        <div key={g}><p className="mb-1 px-2 text-xs font-bold uppercase tracking-wide text-muted">{g}</p>
          {reports.filter((r) => r.group === g).map((r) => <Link key={r.key} href={`/admin/reports?report=${r.key}&${qs}`} className={cn("flex min-h-11 items-center rounded-xl px-3 text-sm font-medium", r.key === active ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2")}>{r.title}</Link>)}</div>
      ))}
    </nav>
  );
}
