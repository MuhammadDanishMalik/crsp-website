"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  ShoppingBag,
  Receipt,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Utensils,
  ChevronRight,
  Printer,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatPKR } from "@/lib/domain/money";
import type { loadDashboard } from "@/lib/queries/dashboard";

type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

type Props = {
  name: string;
  data: DashboardData | null;
  date: string;
  today: string;
  branch: string;
  branches: { id: string; name: string }[];
};

const COLORS = ["#f5b301", "#10b981", "#6366f1", "#ec4899", "#8b5cf6", "#06b6d4"];

export function Dashboard({ name, data, date, today, branch, branches }: Props) {
  const router = useRouter();

  if (!data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <AlertCircle size={40} className="mb-3 text-muted" />
        <h3 className="text-lg font-bold">Dashboard Restricted</h3>
        <p className="max-w-md text-sm text-muted">
          Your current account role does not have permission to view high-level business analytics.
        </p>
      </div>
    );
  }

  const salesVsYesterday =
    data.yesterday > 0 ? Math.round(((data.sales - data.yesterday) / data.yesterday) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Date Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-muted">
            Welcome back, <span className="font-semibold text-foreground">{name}</span> · Real-time restaurant performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set("date", e.target.value);
              router.push(url.toString());
            }}
            className="h-10 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-foreground focus:outline-none"
          />

          <Link
            href="/admin/orders"
            className="flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-bold text-brand-fg shadow-sm hover:opacity-95"
          >
            <Receipt size={14} /> Orders Record
          </Link>

          <Link
            href="/order"
            className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:bg-surface-2"
          >
            <ShoppingBag size={14} /> Open POS
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Total Sales</span>
            <div className="rounded-xl bg-brand/10 p-2 text-brand">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black tabular-nums">{formatPKR(data.sales)}</div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            {salesVsYesterday >= 0 ? (
              <span className="flex items-center font-bold text-success">
                <ArrowUpRight size={14} /> +{salesVsYesterday}%
              </span>
            ) : (
              <span className="flex items-center font-bold text-danger">
                <ArrowDownRight size={14} /> {salesVsYesterday}%
              </span>
            )}
            <span>vs yesterday ({formatPKR(data.yesterday)})</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Total Orders</span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500">
              <Receipt size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black tabular-nums">{data.orders}</div>
          <div className="mt-2 text-xs text-muted">
            AOV: <span className="font-semibold text-foreground">{formatPKR(data.aov)}</span> per ticket
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Tax Billed</span>
            <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-500">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black tabular-nums">{formatPKR(data.tax)}</div>
          <div className="mt-2 text-xs text-muted">FBR / PRA compliance tracked</div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Action Alerts</span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-500">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2 text-2xl font-black tabular-nums">
            {data.alerts.pendingPayments + data.alerts.lowStock}
            <span className="text-xs font-normal text-muted">pending items</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            <span>{data.alerts.pendingPayments} unverified pays</span>
            <span>·</span>
            <span>{data.alerts.lowStock} low stock</span>
          </div>
        </div>
      </div>

      {/* Hourly Sales Chart */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold">Hourly Sales & Traffic</h3>
            <p className="text-xs text-muted">Sales distribution throughout operating hours</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-brand">
              <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Sales (PKR)
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.hours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f5b301" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f5b301" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="label" stroke="var(--muted)" fontSize={11} tickLine={false} />
              <YAxis
                stroke="var(--muted)"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `Rs ${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                }}
                formatter={(val: any) => [formatPKR(Number(val)), "Sales"]}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#f5b301"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#salesGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Channels, Payment Methods & Top Items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top Selling Items */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold">Top Performing Menu Items</h3>
              <p className="text-xs text-muted">Most ordered items today</p>
            </div>
            <Link
              href="/admin/menu"
              className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              Manage menu <ChevronRight size={12} />
            </Link>
          </div>

          <div className="space-y-3">
            {data.top.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted">No items sold yet today.</p>
            ) : (
              data.top.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between rounded-xl bg-surface-2/50 p-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface font-mono text-xs font-black text-muted">
                      #{idx + 1}
                    </span>
                    <span className="text-sm font-semibold">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="rounded bg-brand/10 px-2 py-0.5 font-bold text-brand">
                      {item.qty} sold
                    </span>
                    <span className="font-black tabular-nums">{formatPKR(item.revenue)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Order Types & Channels */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="mb-3 font-bold">Order Types</h3>
            <div className="space-y-2.5">
              {data.types.map((t) => (
                <div key={t.name} className="flex items-center justify-between text-xs">
                  <span className="font-medium capitalize text-muted">{t.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{t.orders} orders</span>
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      ({formatPKR(t.value)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="mb-3 font-bold">Payment Methods</h3>
            <div className="space-y-2.5">
              {data.methods.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-xs">
                  <span className="font-medium capitalize text-muted">{m.name}</span>
                  <span className="font-black tabular-nums">{formatPKR(m.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
