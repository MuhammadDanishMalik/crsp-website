import { getSession } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { businessDate } from "@/lib/domain/dates";
import { resolveBranchIds } from "@/lib/queries/branches";
import { reportByKey } from "@/lib/reports/engine";
import { toCsv, toPdf, toXlsx } from "@/lib/reports/export";

const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const def = reportByKey((await params).key);
  if (!def) return new Response("Unknown report", { status: 404 });
  if (!session.can(def.permission) || !session.can("report.export")) return new Response("Forbidden", { status: 403 });
  const q = new URL(req.url).searchParams;
  const today = businessDate();
  const from = isDate(q.get("from")) ? q.get("from")! : today, to = isDate(q.get("to")) ? q.get("to")! : today;
  const format = q.get("format") ?? "xlsx";
  const { ids, branches, selected } = await resolveBranchIds(session, q.get("branch"));
  const result = await def.run({ branchIds: ids, from, to });
  const sub = `${from} to ${to} · ${selected === "all" ? "All branches" : branches.find((b) => b.id === selected)?.name ?? ""} · generated ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}`;
  const file = `crsp-${def.key}-${from}_${to}`;
  await audit(session, { action: "report.export", entity: "report", entityId: def.key, after: { format, from, to } });
  if (format === "csv") return new Response(toCsv(result), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"` } });
  if (format === "pdf") return new Response(new Uint8Array(await toPdf(def.title, sub, result)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}.pdf"` } });
  return new Response(new Uint8Array(await toXlsx(def.title, sub, result)), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${file}.xlsx"` } });
}
