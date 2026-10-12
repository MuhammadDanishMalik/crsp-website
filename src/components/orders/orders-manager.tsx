"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BarChart3,
  RefreshCw,
  Printer,
  ChefHat,
  XCircle,
  Eye,
  Clock,
  CheckCircle2,
  ShoppingBag,
  UtensilsCrossed,
  Bike,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronDown,
  ChevronUp,
  X,
  ArrowLeft,
  LayoutGrid,
  List,
  Sparkles,
  TrendingUp,
  Receipt,
  User,
  Phone,
  MapPin,
  Flame,
} from "lucide-react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { voidOrder, refundOrder } from "@/lib/actions/refunds";
import { getKotJobs } from "@/lib/actions/print";
import { sendToBridge } from "@/lib/adapters/printers/bridge-client";
import { printReceipt } from "@/app/(pos)/order/pay-dialog";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { OverrideDialog } from "@/app/(pos)/order/override-dialog";
import { useBranchEvents } from "@/lib/realtime/use-events";
import { cn } from "@/lib/utils";

export type OrderItemDetail = {
  id: string;
  name: string;
  sizeName: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note: string | null;
  isVoided: boolean;
  modifiers: string[];
};

export type ManageableOrder = {
  id: string;
  no: string;
  type: string; // dine_in | takeaway | delivery
  status: string; // open | paid | preparing | ready | completed | voided | refunded
  total: number;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  deliveryCharge: number;
  at: string;
  table: string | null;
  guestCount: number | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  cashierName: string | null;
  terminalName: string | null;
  methods: string[];
  pending: boolean;
  refunded: number;
  items: OrderItemDetail[];
};

type Props = {
  orders: ManageableOrder[];
  can: { void: boolean; refund: boolean; reprint: boolean };
  reasons: { void: string[]; refund: string[] };
  context?: "pos" | "admin";
};

const CHANNEL_COLORS = {
  dine_in: "#10b981", // Emerald
  takeaway: "#f59e0b", // Amber
  delivery: "#6366f1", // Indigo
};

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  cash: <Banknote size={14} className="text-emerald-500" />,
  card: <CreditCard size={14} className="text-blue-500" />,
  jazzcash: <Smartphone size={14} className="text-amber-500" />,
  easypaisa: <Smartphone size={14} className="text-green-500" />,
  raast: <Smartphone size={14} className="text-purple-500" />,
  bank_transfer: <CreditCard size={14} className="text-cyan-500" />,
};

function formatTimeAgo(isoString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

export function OrdersManager({ orders, can, reasons, context = "pos" }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "active" | "completed" | "delivery" | "pending" | "voided">("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [chartMetric, setChartMetric] = useState<"revenue" | "volume">("revenue");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [selectedOrder, setSelectedOrder] = useState<ManageableOrder | null>(null);
  const [action, setAction] = useState<null | { kind: "void" | "refund"; order: ManageableOrder }>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [pendingTransition, startTransition] = useTransition();

  // Real-time synchronization
  useBranchEvents(() => {
    router.refresh();
  }, 12_000);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleReprintReceipt = (orderId: string) => {
    startTransition(async () => {
      try {
        const msg = await printReceipt(orderId, true);
        showToast(msg || "Receipt reprint requested", "success");
      } catch {
        showToast("Failed to print receipt", "error");
      }
    });
  };

  const handleReprintKOT = (orderId: string) => {
    startTransition(async () => {
      try {
        const r = await getKotJobs(orderId);
        if (!r.ok) {
          showToast(r.error, "error");
          return;
        }
        for (const j of r.jobs) {
          await sendToBridge(j.target, Uint8Array.from(atob(j.data), (c) => c.charCodeAt(0)));
        }
        showToast(r.jobs.length ? "Kitchen ticket reprinted" : "No kitchen printer configured", "success");
      } catch {
        showToast("KOT reprint failed", "error");
      }
    });
  };

  // Calculations: KPI summaries
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.status === "completed" || o.status === "paid");
    const activeOrders = orders.filter((o) => ["open", "preparing", "ready"].includes(o.status));
    const pendingVerification = orders.filter((o) => o.pending);
    const voidedOrRefunded = orders.filter((o) => o.status === "voided" || o.refunded > 0 || o.status === "refunded");
    const deliveryOrders = orders.filter((o) => o.type === "delivery");

    const grossSales = orders.filter((o) => o.status !== "voided").reduce((acc, o) => acc + o.total, 0);
    const totalRefunds = orders.reduce((acc, o) => acc + o.refunded, 0);
    const netRevenue = grossSales - totalRefunds;
    const aov = completedOrders.length > 0 ? Math.round(grossSales / completedOrders.length) : 0;

    return {
      totalOrders,
      completedCount: completedOrders.length,
      activeCount: activeOrders.length,
      pendingCount: pendingVerification.length,
      voidedCount: voidedOrRefunded.length,
      deliveryCount: deliveryOrders.length,
      netRevenue,
      aov,
    };
  }, [orders]);

  // Hourly Chart Data (9 AM to 11 PM or active bounds)
  const hourlyData = useMemo(() => {
    const buckets: Record<number, { hour: number; label: string; revenue: number; orders: number; dineIn: number; takeaway: number; delivery: number }> = {};
    for (let h = 9; h <= 23; h++) {
      const label = `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
      buckets[h] = { hour: h, label, revenue: 0, orders: 0, dineIn: 0, takeaway: 0, delivery: 0 };
    }

    orders.forEach((o) => {
      const orderDate = new Date(o.at);
      const h = orderDate.getHours();
      if (!buckets[h]) {
        const label = `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
        buckets[h] = { hour: h, label, revenue: 0, orders: 0, dineIn: 0, takeaway: 0, delivery: 0 };
      }
      if (o.status !== "voided") {
        buckets[h].revenue += Math.max(0, o.total - o.refunded) / 100;
        buckets[h].orders += 1;
        if (o.type === "dine_in") buckets[h].dineIn += 1;
        else if (o.type === "delivery") buckets[h].delivery += 1;
        else buckets[h].takeaway += 1;
      }
    });

    return Object.values(buckets).sort((a, b) => a.hour - b.hour);
  }, [orders]);

  // Channel distribution
  const channelData = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "voided");
    const dineIn = valid.filter((o) => o.type === "dine_in").length;
    const takeaway = valid.filter((o) => o.type === "takeaway").length;
    const delivery = valid.filter((o) => o.type === "delivery").length;
    return [
      { name: "Dine In", value: dineIn, color: CHANNEL_COLORS.dine_in },
      { name: "Takeaway", value: takeaway, color: CHANNEL_COLORS.takeaway },
      { name: "Delivery", value: delivery, color: CHANNEL_COLORS.delivery },
    ].filter((c) => c.value > 0);
  }, [orders]);

  // Payment methods distribution
  const paymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders
      .filter((o) => o.status !== "voided")
      .forEach((o) => {
        o.methods.forEach((m) => {
          counts[m] = (counts[m] || 0) + o.total / 100;
        });
      });
    return Object.entries(counts).map(([name, amount]) => ({
      name: name.replace("_", " "),
      amount: Math.round(amount),
    }));
  }, [orders]);

  // Filtered & Sorted Orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        // Status filter
        if (statusTab === "active") {
          if (!["open", "preparing", "ready"].includes(o.status)) return false;
        } else if (statusTab === "completed") {
          if (!["completed", "paid"].includes(o.status)) return false;
        } else if (statusTab === "delivery") {
          if (o.type !== "delivery") return false;
        } else if (statusTab === "pending") {
          if (!o.pending) return false;
        } else if (statusTab === "voided") {
          if (o.status !== "voided" && o.status !== "refunded" && o.refunded <= 0) return false;
        }

        // Channel filter
        if (channelFilter !== "all" && o.type !== channelFilter) return false;

        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchesNo = o.no.toLowerCase().includes(q);
          const matchesTable = o.table ? `t${o.table}`.toLowerCase().includes(q) : false;
          const matchesCust = (o.customerName && o.customerName.toLowerCase().includes(q)) || (o.customerPhone && o.customerPhone.includes(q));
          const matchesMethod = o.methods.some((m) => m.toLowerCase().includes(q));
          const matchesItem = o.items.some((i) => i.name.toLowerCase().includes(q));
          if (!matchesNo && !matchesTable && !matchesCust && !matchesMethod && !matchesItem) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.at).getTime() - new Date(a.at).getTime();
        if (sortBy === "oldest") return new Date(a.at).getTime() - new Date(b.at).getTime();
        if (sortBy === "highest") return b.total - a.total;
        if (sortBy === "lowest") return a.total - b.total;
        return 0;
      });
  }, [orders, statusTab, channelFilter, search, sortBy]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {/* Top Header Bar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          {context === "pos" ? (
            <Button
              variant="secondary"
              size="md"
              className="flex items-center gap-2 rounded-xl text-sm font-semibold shadow-xs"
              onClick={() => router.push("/order")}
            >
              <ArrowLeft size={16} /> Back to POS
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted">
              <Sparkles size={14} className="text-brand" /> Admin Console
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">Live Orders Manager</h1>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                Live Sync
              </span>
            </div>
            <p className="text-xs text-muted">Real-time order lifecycle, kitchen status & financial settlement</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            className={cn(
              "flex items-center gap-2 rounded-xl text-sm transition-all",
              showAnalytics && "border-brand/40 bg-brand/10 font-bold text-brand shadow-xs"
            )}
            onClick={() => setShowAnalytics((v) => !v)}
          >
            <BarChart3 size={16} />
            <span>{showAnalytics ? "Hide Graphs" : "Show Graphs"}</span>
            {showAnalytics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="rounded-xl px-3 text-muted hover:text-foreground"
            title="Refresh order queue"
            onClick={() => {
              startTransition(() => {
                router.refresh();
                showToast("Orders refreshed", "info");
              });
            }}
          >
            <RefreshCw size={16} className={cn(pendingTransition && "animate-spin text-brand")} />
          </Button>
        </div>
      </header>

      {/* Main Body */}
      <div className="scroll-thin flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          {/* Toast Notification */}
          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-md",
                  feedback.type === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  feedback.type === "error" && "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
                  feedback.type === "info" && "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                )}
              >
                <span>{feedback.message}</span>
                <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* KPI Summary Ribbon */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-xs transition hover:border-brand/40">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-semibold uppercase tracking-wider">Today&apos;s Revenue</span>
                <TrendingUp size={16} className="text-emerald-500" />
              </div>
              <p className="mt-1 text-2xl font-black tracking-tight tabular-nums sm:text-3xl">
                {formatPKR(stats.netRevenue)}
              </p>
              <p className="mt-1 text-xs text-muted">Net after voids & refunds</p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-xs transition hover:border-brand/40">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-semibold uppercase tracking-wider">Kitchen Queue</span>
                <Flame size={16} className="text-amber-500" />
              </div>
              <p className="mt-1 text-2xl font-black tracking-tight tabular-nums sm:text-3xl text-amber-600 dark:text-amber-400">
                {stats.activeCount} <span className="text-sm font-normal text-muted">active</span>
              </p>
              <p className="mt-1 text-xs text-muted">Preparing & waiting on line</p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-xs transition hover:border-brand/40">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-semibold uppercase tracking-wider">Completed Orders</span>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <p className="mt-1 text-2xl font-black tracking-tight tabular-nums sm:text-3xl">
                {stats.completedCount} <span className="text-sm font-normal text-muted">/ {stats.totalOrders}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {stats.totalOrders > 0 ? Math.round((stats.completedCount / stats.totalOrders) * 100) : 0}% fulfillment rate
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-xs transition hover:border-brand/40">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-semibold uppercase tracking-wider">Avg Order Value</span>
                <Receipt size={16} className="text-indigo-500" />
              </div>
              <p className="mt-1 text-2xl font-black tracking-tight tabular-nums sm:text-3xl">
                {formatPKR(stats.aov)}
              </p>
              <p className="mt-1 text-xs text-muted">Per completed customer order</p>
            </div>
          </div>

          {/* Interactive Modern Graphs Panel */}
          <AnimatePresence>
            {showAnalytics && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  {/* Primary Chart: Hourly Revenue & Volume */}
                  <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs lg:col-span-2">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold">Hourly Order Pacing & Revenue</h2>
                        <p className="text-xs text-muted">Peak rush hours and cashflow trends today</p>
                      </div>
                      <div className="flex rounded-xl border border-border bg-surface-2 p-1 text-xs">
                        <button
                          onClick={() => setChartMetric("revenue")}
                          className={cn(
                            "rounded-lg px-3 py-1 font-semibold transition",
                            chartMetric === "revenue" ? "bg-surface shadow-xs text-brand font-bold" : "text-muted hover:text-foreground"
                          )}
                        >
                          Revenue (PKR)
                        </button>
                        <button
                          onClick={() => setChartMetric("volume")}
                          className={cn(
                            "rounded-lg px-3 py-1 font-semibold transition",
                            chartMetric === "volume" ? "bg-surface shadow-xs text-brand font-bold" : "text-muted hover:text-foreground"
                          )}
                        >
                          Order Count
                        </button>
                      </div>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="var(--brand)" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="areaOrders" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--grid)" opacity={0.6} />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "var(--muted)", fontSize: 11 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "var(--muted)", fontSize: 11 }}
                            tickFormatter={(v: number) =>
                              chartMetric === "revenue" ? (v >= 1000 ? `${v / 1000}k` : `${v}`) : `${v}`
                            }
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="rounded-xl border border-border bg-surface/95 p-3 text-xs shadow-xl backdrop-blur-md">
                                  <p className="font-bold text-foreground">{d.label} Window</p>
                                  <p className="mt-1 text-brand font-semibold">
                                    Revenue: {formatPKR(Math.round(d.revenue * 100))}
                                  </p>
                                  <p className="text-muted">Total Orders: {d.orders}</p>
                                  <div className="mt-1 flex gap-2 border-t border-border/50 pt-1 text-[10px] text-muted">
                                    <span>Dine-in: {d.dineIn}</span>
                                    <span>Takeaway: {d.takeaway}</span>
                                    <span>Delivery: {d.delivery}</span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey={chartMetric === "revenue" ? "revenue" : "orders"}
                            stroke={chartMetric === "revenue" ? "var(--brand)" : "#3b82f6"}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill={chartMetric === "revenue" ? "url(#areaRevenue)" : "url(#areaOrders)"}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Secondary Chart: Channel Breakdown & Mix */}
                  <div className="flex flex-col justify-between rounded-3xl border border-border bg-surface p-5 shadow-xs">
                    <div>
                      <h2 className="text-base font-bold">Channels & Fulfillments</h2>
                      <p className="text-xs text-muted">Order distribution across service points</p>
                    </div>

                    <div className="relative my-2 flex h-48 items-center justify-center">
                      {channelData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={channelData}
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={72}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {channelData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload;
                                return (
                                  <div className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs shadow-lg">
                                    <span className="font-bold">{d.name}:</span> {d.value} orders
                                  </div>
                                );
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-xs text-muted">No completed orders yet</p>
                      )}
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black">{stats.totalOrders}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted">Total</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-border pt-3">
                      {channelData.map((c) => (
                        <div key={c.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                            <span>{c.name}</span>
                          </span>
                          <span className="font-semibold tabular-nums">
                            {c.value} ({stats.totalOrders > 0 ? Math.round((c.value / stats.totalOrders) * 100) : 0}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filtering, Search & Control Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs">
            {/* Search + Action Tools */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-64 flex-1">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by order #, table, customer phone, dish name..."
                  className="pl-10 pr-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Channel Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="h-12 rounded-xl border border-border bg-surface-2 px-3 text-sm font-semibold capitalize text-foreground"
                >
                  <option value="all">All Channels</option>
                  <option value="dine_in">Dine In</option>
                  <option value="takeaway">Takeaway</option>
                  <option value="delivery">Delivery</option>
                </select>

                {/* Sort Order */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "highest" | "lowest")}
                  className="h-12 rounded-xl border border-border bg-surface-2 px-3 text-sm font-semibold text-foreground"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Amount</option>
                  <option value="lowest">Lowest Amount</option>
                </select>

                {/* View Switcher */}
                <div className="flex rounded-xl border border-border bg-surface-2 p-1">
                  <button
                    onClick={() => setViewMode("cards")}
                    title="Card View"
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition",
                      viewMode === "cards" ? "bg-surface shadow-xs text-brand" : "text-muted hover:text-foreground"
                    )}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    title="Dense List View"
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition",
                      viewMode === "table" ? "bg-surface shadow-xs text-brand" : "text-muted hover:text-foreground"
                    )}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="scroll-thin flex items-center gap-1.5 overflow-x-auto border-t border-border pt-3">
              {[
                { id: "all", label: "All Orders", count: stats.totalOrders },
                { id: "active", label: "Active Kitchen", count: stats.activeCount },
                { id: "completed", label: "Completed", count: stats.completedCount },
                { id: "delivery", label: "Deliveries", count: stats.deliveryCount },
                { id: "pending", label: "Needs Verification", count: stats.pendingCount },
                { id: "voided", label: "Voided / Refunded", count: stats.voidedCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusTab(tab.id as "all" | "active" | "completed" | "delivery" | "pending" | "voided")}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                    statusTab === tab.id
                      ? "bg-brand text-brand-fg shadow-xs"
                      : "bg-surface-2 text-muted hover:bg-surface-2/80 hover:text-foreground"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      statusTab === tab.id ? "bg-white/20 text-white" : "bg-border text-muted"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Orders Content Section */}
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-20 text-center">
              <ShoppingBag size={48} className="text-muted/40" />
              <h3 className="mt-4 text-lg font-bold">No orders found</h3>
              <p className="mt-1 text-sm text-muted">
                {search ? "No orders match your search criteria" : "No orders recorded in this category today"}
              </p>
              {search && (
                <Button variant="secondary" size="md" className="mt-4" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              )}
            </div>
          ) : viewMode === "cards" ? (
            /* Cards View */
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map((o) => {
                const isClosed = o.status === "voided" || o.status === "refunded";
                const isPreparing = ["open", "preparing"].includes(o.status);

                return (
                  <motion.div
                    key={o.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-2xl border bg-surface p-4 shadow-xs transition hover:border-brand/50 hover:shadow-md",
                      isClosed
                        ? "border-rose-500/20 bg-rose-500/5 opacity-80"
                        : isPreparing
                          ? "border-amber-500/30"
                          : "border-border"
                    )}
                  >
                    <div>
                      {/* Card Header: Order No & Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-10 items-center justify-center rounded-xl bg-surface-2 px-2.5 font-mono text-lg font-black tracking-tight text-foreground">
                            #{o.no}
                          </span>
                          <div>
                            <span className="flex items-center gap-1 text-xs font-bold capitalize text-foreground">
                              {o.type === "dine_in" && <UtensilsCrossed size={13} className="text-emerald-500" />}
                              {o.type === "takeaway" && <ShoppingBag size={13} className="text-amber-500" />}
                              {o.type === "delivery" && <Bike size={13} className="text-indigo-500" />}
                              {o.type.replace("_", " ")}
                              {o.table && <span className="text-brand">· T{o.table}</span>}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-muted">
                              <Clock size={11} /> {formatTimeAgo(o.at)}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isClosed ? (
                            <span className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                              {o.status}
                            </span>
                          ) : o.pending ? (
                            <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                              Pending Verify
                            </span>
                          ) : isPreparing ? (
                            <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                              Kitchen
                            </span>
                          ) : (
                            <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              {o.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="mt-3 space-y-1 rounded-xl bg-surface-2/60 p-2.5 text-xs">
                        {o.items.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex justify-between text-foreground">
                            <span className="truncate">
                              <b className="font-semibold text-brand">{item.quantity}x</b> {item.name}
                              {item.sizeName ? ` (${item.sizeName})` : ""}
                            </span>
                            <span className="tabular-nums text-muted">{formatPKR(item.lineTotal)}</span>
                          </div>
                        ))}
                        {o.items.length > 3 && (
                          <p className="text-[11px] font-medium text-muted">+{o.items.length - 3} more items...</p>
                        )}
                        {o.items.length === 0 && <p className="text-muted">No items recorded</p>}
                      </div>

                      {/* Customer / Payment Tags */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                        {o.customerName && (
                          <span className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                            <User size={11} /> {o.customerName}
                          </span>
                        )}
                        {o.methods.map((m) => (
                          <span
                            key={m}
                            className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] capitalize text-muted"
                          >
                            {PAYMENT_ICONS[m] || <Banknote size={11} />}
                            {m.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Card Footer: Total & Actions */}
                    <div className="mt-4 border-t border-border pt-3">
                      <div className="mb-3 flex items-baseline justify-between">
                        <span className="text-xs text-muted">Total Payable</span>
                        <div className="text-right">
                          <span className="text-xl font-black tracking-tight tabular-nums">
                            {formatPKR(o.total)}
                          </span>
                          {o.refunded > 0 && (
                            <span className="block text-xs font-semibold text-rose-600 dark:text-rose-400">
                              −{formatPKR(o.refunded)} (refunded)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-4 gap-1.5">
                        <Button
                          variant="secondary"
                          size="md"
                          className="h-10 px-2 text-xs font-bold"
                          title="View order details"
                          onClick={() => setSelectedOrder(o)}
                        >
                          <Eye size={14} className="mr-1" /> View
                        </Button>

                        {can.reprint && (
                          <Button
                            variant="secondary"
                            size="md"
                            className="h-10 px-2 text-xs font-bold"
                            title="Reprint receipt"
                            onClick={() => handleReprintReceipt(o.id)}
                          >
                            <Printer size={14} />
                          </Button>
                        )}

                        {can.reprint && (
                          <Button
                            variant="secondary"
                            size="md"
                            className="h-10 px-2 text-xs font-bold"
                            title="Reprint Kitchen Order Ticket (KOT)"
                            onClick={() => handleReprintKOT(o.id)}
                          >
                            <ChefHat size={14} />
                          </Button>
                        )}

                        {!isClosed && can.void ? (
                          <Button
                            variant="secondary"
                            size="md"
                            className="h-10 px-2 text-xs font-bold text-rose-600 hover:border-rose-500/40 hover:bg-rose-500/10 dark:text-rose-400"
                            title="Void whole order"
                            onClick={() => setAction({ kind: "void", order: o })}
                          >
                            Void
                          </Button>
                        ) : !isClosed && can.refund ? (
                          <Button
                            variant="secondary"
                            size="md"
                            className="h-10 px-2 text-xs font-bold text-amber-600 hover:border-amber-500/40 hover:bg-amber-500/10 dark:text-amber-400"
                            title="Issue partial or full refund"
                            onClick={() => setAction({ kind: "refund", order: o })}
                          >
                            Refund
                          </Button>
                        ) : (
                          <div />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Dense Table View */
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-4 py-3.5">Order</th>
                      <th className="px-4 py-3.5">Channel</th>
                      <th className="px-4 py-3.5">Time</th>
                      <th className="px-4 py-3.5">Items Preview</th>
                      <th className="px-4 py-3.5">Payment</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">Total</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map((o) => {
                      const isClosed = o.status === "voided" || o.status === "refunded";
                      return (
                        <tr key={o.id} className="transition hover:bg-surface-2/40">
                          <td className="whitespace-nowrap px-4 py-3 font-mono font-bold">#{o.no}</td>
                          <td className="whitespace-nowrap px-4 py-3 capitalize">
                            {o.type.replace("_", " ")}
                            {o.table && <span className="text-brand"> · T{o.table}</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                            {new Date(o.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-xs">
                            {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ") || "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs capitalize text-muted">
                            {o.methods.join(", ").replace("_", " ")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-xs font-bold uppercase",
                                isClosed
                                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                                  : o.pending
                                    ? "bg-amber-500/20 text-amber-600"
                                    : "bg-emerald-500/20 text-emerald-600"
                              )}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">
                            {formatPKR(o.total)}
                            {o.refunded > 0 && <span className="block text-xs text-rose-500">−{formatPKR(o.refunded)}</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedOrder(o)}
                                className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"
                                title="Inspect order details"
                              >
                                <Eye size={16} />
                              </button>
                              {can.reprint && (
                                <button
                                  onClick={() => handleReprintReceipt(o.id)}
                                  className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"
                                  title="Reprint receipt"
                                >
                                  <Printer size={16} />
                                </button>
                              )}
                              {!isClosed && can.void && (
                                <button
                                  onClick={() => setAction({ kind: "void", order: o })}
                                  className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"
                                  title="Void order"
                                >
                                  <XCircle size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order Details Slide-Over / Modal Inspector */}
      {selectedOrder && (
        <Modal
          title={`Order Details #${selectedOrder.no}`}
          onClose={() => setSelectedOrder(null)}
          width="max-w-2xl"
        >
          <div className="space-y-5">
            {/* Metadata Header */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-2 p-3 text-xs sm:grid-cols-4">
              <div>
                <span className="text-muted">Channel:</span>
                <p className="font-bold capitalize">{selectedOrder.type.replace("_", " ")}</p>
              </div>
              <div>
                <span className="text-muted">Table / Seat:</span>
                <p className="font-bold">{selectedOrder.table ? `Table ${selectedOrder.table}` : "Counter"}</p>
              </div>
              <div>
                <span className="text-muted">Timestamp:</span>
                <p className="font-bold">
                  {new Date(selectedOrder.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div>
                <span className="text-muted">Cashier:</span>
                <p className="font-bold">{selectedOrder.cashierName ?? "Staff"}</p>
              </div>
            </div>

            {/* Customer Information (if any) */}
            {(selectedOrder.customerName || selectedOrder.customerPhone || selectedOrder.deliveryAddress) && (
              <div className="rounded-2xl border border-border bg-surface p-3 text-xs">
                <span className="font-bold uppercase tracking-wider text-muted">Customer Details</span>
                <div className="mt-1 flex flex-wrap gap-4 text-foreground">
                  {selectedOrder.customerName && (
                    <span className="flex items-center gap-1">
                      <User size={13} className="text-brand" /> {selectedOrder.customerName}
                    </span>
                  )}
                  {selectedOrder.customerPhone && (
                    <span className="flex items-center gap-1">
                      <Phone size={13} className="text-brand" /> {selectedOrder.customerPhone}
                    </span>
                  )}
                  {selectedOrder.deliveryAddress && (
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-brand" /> {selectedOrder.deliveryAddress}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Itemized Bill Table */}
            <div>
              <h4 className="mb-2 text-sm font-bold">Itemized Bill Breakdown</h4>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 uppercase tracking-wider text-muted">
                    <tr>
                      <th className="p-2.5">Item & Options</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Price</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-2/40">
                        <td className="p-2.5">
                          <p className="font-bold text-foreground">
                            {item.name}
                            {item.sizeName ? ` (${item.sizeName})` : ""}
                          </p>
                          {item.modifiers.length > 0 && (
                            <p className="text-[11px] text-muted">
                              + {item.modifiers.join(", ")}
                            </p>
                          )}
                          {item.note && (
                            <p className="text-[11px] italic text-amber-600 dark:text-amber-400">Note: {item.note}</p>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-bold tabular-nums">{item.quantity}</td>
                        <td className="p-2.5 text-right tabular-nums text-muted">{formatPKR(item.unitPrice)}</td>
                        <td className="p-2.5 text-right font-bold tabular-nums">{formatPKR(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="rounded-2xl bg-surface-2 p-4 text-sm">
              <div className="space-y-1.5 text-xs text-muted">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-semibold text-foreground">{formatPKR(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discountTotal > 0 && (
                  <div className="flex justify-between text-brand">
                    <span>Discounts Applied</span>
                    <span className="tabular-nums font-semibold">−{formatPKR(selectedOrder.discountTotal)}</span>
                  </div>
                )}
                {selectedOrder.taxTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Tax (PRA / FBR)</span>
                    <span className="tabular-nums font-semibold text-foreground">{formatPKR(selectedOrder.taxTotal)}</span>
                  </div>
                )}
                {selectedOrder.deliveryCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Charge</span>
                    <span className="tabular-nums font-semibold text-foreground">{formatPKR(selectedOrder.deliveryCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-base font-black text-foreground">
                  <span>Grand Total</span>
                  <span className="tabular-nums">{formatPKR(selectedOrder.total)}</span>
                </div>
                {selectedOrder.refunded > 0 && (
                  <div className="flex justify-between text-rose-500 font-bold">
                    <span>Refunded Amount</span>
                    <span className="tabular-nums">−{formatPKR(selectedOrder.refunded)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Footer in Drawer */}
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {can.reprint && (
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1 text-xs font-bold"
                  onClick={() => {
                    handleReprintReceipt(selectedOrder.id);
                  }}
                >
                  <Printer size={15} /> Print Receipt
                </Button>
              )}
              {can.reprint && (
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1 text-xs font-bold"
                  onClick={() => {
                    handleReprintKOT(selectedOrder.id);
                  }}
                >
                  <ChefHat size={15} /> Print KOT
                </Button>
              )}
              {selectedOrder.status !== "voided" && selectedOrder.status !== "refunded" && (
                <>
                  {can.void && (
                    <Button
                      variant="danger"
                      size="md"
                      className="text-xs font-bold"
                      onClick={() => {
                        const o = selectedOrder;
                        setSelectedOrder(null);
                        setAction({ kind: "void", order: o });
                      }}
                    >
                      Void Order
                    </Button>
                  )}
                  {can.refund && (
                    <Button
                      variant="secondary"
                      size="md"
                      className="text-xs font-bold text-amber-600 hover:bg-amber-500/10"
                      onClick={() => {
                        const o = selectedOrder;
                        setSelectedOrder(null);
                        setAction({ kind: "refund", order: o });
                      }}
                    >
                      Refund
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Void & Refund Modal Dialog */}
      {action && (
        <ActionDialog
          {...action}
          reasons={reasons}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            router.refresh();
            showToast(
              action.kind === "void" ? "Order voided successfully" : "Refund processed successfully",
              "success"
            );
          }}
        />
      )}
    </div>
  );
}

function ActionDialog({
  kind,
  order,
  reasons,
  onClose,
  onDone,
}: {
  kind: "void" | "refund";
  order: ManageableOrder;
  reasons: Props["reasons"];
  onClose: () => void;
  onDone: () => void;
}) {
  const list = reasons[kind] || [];
  const [reason, setReason] = useState(list[0] ?? "");
  const [amount, setAmount] = useState(String((order.total - order.refunded) / 100));
  const [method, setMethod] = useState(order.methods[0] ?? "cash");
  const [error, setError] = useState("");
  const [needManager, setNeedManager] = useState(false);
  const [pending, start] = useTransition();

  const run = (token?: string) =>
    start(async () => {
      const r =
        kind === "void"
          ? await voidOrder(order.id, reason, token)
          : await refundOrder(order.id, Math.round(Number(amount) * 100), method, reason, token);
      if (r.ok) return onDone();
      if (r.error === "Manager approval required") return setNeedManager(true);
      setError(r.error);
    });

  return (
    <Modal
      title={kind === "void" ? `Void Order #${order.no}` : `Refund Order #${order.no}`}
      onClose={onClose}
      width="max-w-md"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {kind === "void"
            ? "Cancels the entire order, reverses recorded payments and restocks inventory."
            : "Issues cash or digital reversal to the customer. Specify reason and amount."}
        </p>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-muted">Select Reason</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {list.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  reason === r
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-border bg-surface-2 text-foreground hover:border-brand/40"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Input
            placeholder="Or type custom reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {kind === "refund" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-muted">Amount (PKR)</label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-muted">Refund via</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-xs capitalize font-semibold"
              >
                {order.methods.map((m) => (
                  <option key={m} value={m}>
                    {m.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && <p className="text-xs font-bold text-rose-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            className="flex-1"
            disabled={pending || !reason}
            onClick={() => run()}
          >
            {pending ? "Processing..." : kind === "void" ? "Confirm Void" : "Confirm Refund"}
          </Button>
        </div>
      </div>

      {needManager && (
        <OverrideDialog
          permission={kind === "void" ? "order.void" : "refund.approve"}
          title={`${kind === "void" ? "Voiding" : "Refunds"} require manager approval`}
          onClose={() => setNeedManager(false)}
          onApproved={(token) => {
            setNeedManager(false);
            run(token);
          }}
        />
      )}
    </Modal>
  );
}
