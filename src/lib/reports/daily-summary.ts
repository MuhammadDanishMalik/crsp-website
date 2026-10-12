import "server-only";
import { formatPKR } from "@/lib/domain/money";
import { loadPnl } from "@/lib/queries/accounts";
import { loadDashboard } from "@/lib/queries/dashboard";

export async function buildDailySummary(branchIds: string[], branchLabel: string, date: string) {
  const [d, p] = await Promise.all([loadDashboard(branchIds, date), Promise.all(branchIds.map((b) => loadPnl(b, date, date)))]);
  const expenses = p.reduce((a, x) => a + x.expenseTotal, 0), foodCost = p.reduce((a, x) => a + x.foodCost, 0), net = p.reduce((a, x) => a + x.net, 0);
  const lines = [
    `CRSP daily summary — ${date}`, branchLabel, "",
    `Sales: ${formatPKR(d.sales)} (${d.orders} orders, avg ${formatPKR(d.aov)})`,
    `Tax collected: ${formatPKR(d.tax)}`, `Food cost: ${formatPKR(foodCost)} · Expenses: ${formatPKR(expenses)}`, `Net profit: ${formatPKR(net)}`, "",
    d.methods.length ? `By payment: ${d.methods.map((m) => `${m.name} ${formatPKR(m.value)}`).join(", ")}` : "No payments recorded.",
    d.top.length ? `Top items: ${d.top.slice(0, 3).map((t) => `${t.name} ×${t.qty}`).join(", ")}` : "",
    d.alerts.lowStock ? `⚠ ${d.alerts.lowStock} ingredients low on stock` : "",
  ];
  return { subject: `CRSP daily summary ${date} — ${formatPKR(d.sales)}`, body: lines.filter((l, i) => l || lines[i - 1]).join("\n") };
}
