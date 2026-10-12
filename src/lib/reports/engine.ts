import "server-only";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { businessDate } from "@/lib/domain/dates";
import type { Permission } from "@/lib/domain/permissions";

export type ColType = "text" | "money" | "int" | "pct" | "num";
export type Col = { key: string; label: string; type: ColType };
export type Row = Record<string, string | number | null>;
export type ReportResult = { columns: Col[]; rows: Row[]; totals?: Row };
export type Ctx = { branchIds: string[]; from: string; to: string };
export type ReportDef = { key: string; title: string; group: string; description: string; permission: Permission; run: (ctx: Ctx) => Promise<ReportResult> };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const day = (d: Date | null) => (d ? businessDate(d) : "");
const time = (d: Date | null) => (d ? d.toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" }) : "");
const start = (d: string) => new Date(`${d}T00:00:00+05:00`);
const end = (d: string) => new Date(`${d}T23:59:59.999+05:00`);

async function names() {
  const db = await getDb();
  const [st, br] = await Promise.all([db.select({ id: s.staff.id, n: s.staff.fullName }).from(s.staff), db.select({ id: s.branches.id, n: s.branches.name }).from(s.branches)]);
  return { staff: (id: string | null) => st.find((x) => x.id === id)?.n ?? "", branch: (id: string) => br.find((x) => x.id === id)?.n ?? "" };
}

async function orders(ctx: Ctx, opts: { voided?: boolean } = {}) {
  const db = await getDb();
  const rows = await db.select().from(s.orders).where(and(inArray(s.orders.branchId, ctx.branchIds), gte(s.orders.businessDate, ctx.from), lte(s.orders.businessDate, ctx.to), ne(s.orders.status, "held")));
  return rows.filter((o) => (opts.voided ? o.status === "voided" : o.status !== "voided"));
}

async function itemFacts(ctx: Ctx) {
  const db = await getDb();
  const os = await orders(ctx);
  const items = os.length ? await db.select().from(s.orderItems).where(and(inArray(s.orderItems.orderId, os.map((o) => o.id)), eq(s.orderItems.isVoided, false))) : [];
  const [menu, cats] = await Promise.all([db.select().from(s.menuItems), db.select().from(s.categories)]);
  return { orders: os, items, menu, cats };
}

export const REPORTS: ReportDef[] = [
  {
    key: "sales-summary", title: "Sales summary", group: "Sales", permission: "report.sales", description: "Daily orders, sales, discounts and tax.",
    async run(ctx) {
      const os = await orders(ctx);
      const days = [...new Set(os.map((o) => o.businessDate))].sort();
      const rows = days.map((d) => {
        const m = os.filter((o) => o.businessDate === d);
        const total = sum(m.map((o) => o.total)), tax = sum(m.map((o) => o.taxTotal));
        return { date: d, orders: m.length, gross: sum(m.map((o) => o.subtotal)), discounts: sum(m.map((o) => o.discountTotal)), tax, net: total - tax, total, avg: m.length ? Math.round(total / m.length) : 0 };
      });
      const total = sum(rows.map((r) => r.total));
      return {
        columns: [{ key: "date", label: "Date", type: "text" }, { key: "orders", label: "Orders", type: "int" }, { key: "gross", label: "Items total", type: "money" }, { key: "discounts", label: "Discounts", type: "money" }, { key: "tax", label: "Tax", type: "money" }, { key: "net", label: "Net sales (ex tax)", type: "money" }, { key: "total", label: "Total billed", type: "money" }, { key: "avg", label: "Avg order", type: "money" }],
        rows, totals: { date: "Total", orders: sum(rows.map((r) => r.orders)), gross: sum(rows.map((r) => r.gross)), discounts: sum(rows.map((r) => r.discounts)), tax: sum(rows.map((r) => r.tax)), net: sum(rows.map((r) => r.net)), total, avg: rows.length ? Math.round(total / Math.max(1, sum(rows.map((r) => r.orders)))) : 0 },
      };
    },
  },
  {
    key: "item-sales", title: "Item-wise sales", group: "Sales", permission: "report.sales", description: "Units, revenue and margin per menu item.",
    async run(ctx) {
      const f = await itemFacts(ctx);
      const rows = [...new Set(f.items.map((i) => i.itemId))].map((id) => {
        const m = f.items.filter((i) => i.itemId === id), mi = f.menu.find((x) => x.id === id);
        const rev = sum(m.map((i) => i.lineTotal)), cost = sum(m.map((i) => i.costSnapshot * i.quantity));
        return { item: mi?.name ?? m[0].nameSnapshot, category: f.cats.find((c) => c.id === mi?.categoryId)?.name ?? "", qty: sum(m.map((i) => i.quantity)), revenue: rev, cost, margin: rev - cost, foodCost: pct(cost, rev) };
      }).sort((a, b) => b.revenue - a.revenue);
      const rev = sum(rows.map((r) => r.revenue)), cost = sum(rows.map((r) => r.cost));
      return {
        columns: [{ key: "item", label: "Item", type: "text" }, { key: "category", label: "Category", type: "text" }, { key: "qty", label: "Units", type: "int" }, { key: "revenue", label: "Revenue", type: "money" }, { key: "cost", label: "Recipe cost", type: "money" }, { key: "margin", label: "Margin", type: "money" }, { key: "foodCost", label: "Food cost %", type: "pct" }],
        rows, totals: { item: "Total", category: "", qty: sum(rows.map((r) => r.qty)), revenue: rev, cost, margin: rev - cost, foodCost: pct(cost, rev) },
      };
    },
  },
  {
    key: "category-sales", title: "Category sales", group: "Sales", permission: "report.sales", description: "Units and revenue by menu category.",
    async run(ctx) {
      const f = await itemFacts(ctx);
      const catOf = (id: string) => f.cats.find((c) => c.id === f.menu.find((m) => m.id === id)?.categoryId)?.name ?? "Other";
      const rows = [...new Set(f.items.map((i) => catOf(i.itemId)))].map((c) => {
        const m = f.items.filter((i) => catOf(i.itemId) === c);
        return { category: c, qty: sum(m.map((i) => i.quantity)), revenue: sum(m.map((i) => i.lineTotal)) };
      }).sort((a, b) => b.revenue - a.revenue);
      const total = sum(rows.map((r) => r.revenue));
      return { columns: [{ key: "category", label: "Category", type: "text" }, { key: "qty", label: "Units", type: "int" }, { key: "revenue", label: "Revenue", type: "money" }, { key: "share", label: "Share", type: "pct" }], rows: rows.map((r) => ({ ...r, share: pct(r.revenue, total) })), totals: { category: "Total", qty: sum(rows.map((r) => r.qty)), revenue: total, share: 100 } };
    },
  },
  {
    key: "modifier-sales", title: "Modifier sales", group: "Sales", permission: "report.sales", description: "How often each option / add-on was chosen.",
    async run(ctx) {
      const db = await getDb();
      const f = await itemFacts(ctx);
      const mods = f.items.length ? await db.select().from(s.orderItemModifiers).where(inArray(s.orderItemModifiers.orderItemId, f.items.map((i) => i.id))) : [];
      const rows = [...new Set(mods.map((m) => m.nameSnapshot))].map((n) => {
        const m = mods.filter((x) => x.nameSnapshot === n);
        const qty = sum(m.map((x) => f.items.find((i) => i.id === x.orderItemId)?.quantity ?? 1));
        return { modifier: n, count: qty, revenue: sum(m.map((x) => x.priceDelta * (f.items.find((i) => i.id === x.orderItemId)?.quantity ?? 1))) };
      }).sort((a, b) => b.count - a.count);
      return { columns: [{ key: "modifier", label: "Option", type: "text" }, { key: "count", label: "Times chosen", type: "int" }, { key: "revenue", label: "Extra revenue", type: "money" }], rows, totals: { modifier: "Total", count: sum(rows.map((r) => r.count)), revenue: sum(rows.map((r) => r.revenue)) } };
    },
  },
  {
    key: "discounts", title: "Discounts", group: "Financial", permission: "report.financial", description: "Every discounted order, who gave it and who approved it.",
    async run(ctx) {
      const db = await getDb(); const n = await names();
      const os = (await orders(ctx)).filter((o) => o.discountTotal > 0);
      const ds = os.length ? await db.select().from(s.orderDiscounts).where(inArray(s.orderDiscounts.orderId, os.map((o) => o.id))) : [];
      const rows = os.map((o) => { const d = ds.find((x) => x.orderId === o.id); return { date: o.businessDate, branch: n.branch(o.branchId), order: o.orderNo, subtotal: o.subtotal, discount: o.discountTotal, pct: pct(o.discountTotal, o.subtotal), by: n.staff(d?.appliedBy ?? o.createdBy), approved: n.staff(d?.approvedBy ?? null), reason: d?.reason ?? (o.loyaltyPointsRedeemed ? "Loyalty points" : "") }; });
      return { columns: [{ key: "date", label: "Date", type: "text" }, { key: "branch", label: "Branch", type: "text" }, { key: "order", label: "Order", type: "text" }, { key: "subtotal", label: "Subtotal", type: "money" }, { key: "discount", label: "Discount", type: "money" }, { key: "pct", label: "%", type: "pct" }, { key: "by", label: "Given by", type: "text" }, { key: "approved", label: "Approved by", type: "text" }, { key: "reason", label: "Reason", type: "text" }], rows, totals: { date: "Total", branch: "", order: "", subtotal: sum(rows.map((r) => r.subtotal)), discount: sum(rows.map((r) => r.discount)), pct: 0, by: "", approved: "", reason: "" } };
    },
  },
  {
    key: "voids-refunds", title: "Voids & refunds", group: "Financial", permission: "report.financial", description: "Voided orders and refunds with reasons and approvers.",
    async run(ctx) {
      const db = await getDb(); const n = await names();
      const os = await orders(ctx, { voided: true });
      const all = await db.select().from(s.orders).where(and(inArray(s.orders.branchId, ctx.branchIds), gte(s.orders.businessDate, ctx.from), lte(s.orders.businessDate, ctx.to)));
      const rf = all.length ? await db.select().from(s.refunds).where(and(inArray(s.refunds.orderId, all.map((o) => o.id)), eq(s.refunds.kind, "refund"))) : [];
      const rows: Row[] = [
        ...os.map((o) => ({ date: o.businessDate, branch: n.branch(o.branchId), order: o.orderNo, kind: "Void", method: "", amount: o.total, reason: o.voidReason ?? "", by: n.staff(o.voidedBy), approved: "" })),
        ...rf.map((r) => ({ date: day(r.createdAt), branch: n.branch(r.branchId), order: all.find((o) => o.id === r.orderId)?.orderNo ?? "", kind: "Refund", method: r.method ?? "", amount: r.amount, reason: r.reasonCode, by: n.staff(r.requestedBy), approved: n.staff(r.approvedBy) })),
      ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return { columns: [{ key: "date", label: "Date", type: "text" }, { key: "branch", label: "Branch", type: "text" }, { key: "order", label: "Order", type: "text" }, { key: "kind", label: "Type", type: "text" }, { key: "method", label: "Method", type: "text" }, { key: "amount", label: "Amount", type: "money" }, { key: "reason", label: "Reason", type: "text" }, { key: "by", label: "By", type: "text" }, { key: "approved", label: "Approved by", type: "text" }], rows, totals: { date: "Total", branch: "", order: "", kind: "", method: "", amount: sum(rows.map((r) => Number(r.amount))), reason: "", by: "", approved: "" } };
    },
  },
  {
    key: "tax", title: "Tax report", group: "Financial", permission: "report.financial", description: "Tax collected per day and tax line, for filing.",
    async run(ctx) {
      const db = await getDb();
      const os = await orders(ctx);
      const lines = os.length ? await db.select().from(s.orderTaxLines).where(inArray(s.orderTaxLines.orderId, os.map((o) => o.id))) : [];
      const keys = [...new Set(lines.map((l) => `${os.find((o) => o.id === l.orderId)!.businessDate}|${l.name}|${l.rateBps}`))].sort();
      const rows = keys.map((k) => {
        const [date, name, rate] = k.split("|");
        const m = lines.filter((l) => os.find((o) => o.id === l.orderId)!.businessDate === date && l.name === name && l.rateBps === Number(rate));
        const orderIds = new Set(m.map((l) => l.orderId));
        const taxable = sum([...orderIds].map((id) => { const o = os.find((x) => x.id === id)!; return o.subtotal - o.discountTotal; }));
        return { date, tax: name, rate: Number(rate) / 100, orders: orderIds.size, taxable, amount: sum(m.map((l) => l.amount)) };
      });
      return { columns: [{ key: "date", label: "Date", type: "text" }, { key: "tax", label: "Tax", type: "text" }, { key: "rate", label: "Rate %", type: "num" }, { key: "orders", label: "Orders", type: "int" }, { key: "taxable", label: "Taxable sales", type: "money" }, { key: "amount", label: "Tax collected", type: "money" }], rows, totals: { date: "Total", tax: "", rate: null, orders: sum(rows.map((r) => r.orders)), taxable: sum(rows.map((r) => r.taxable)), amount: sum(rows.map((r) => r.amount)) } };
    },
  },
  {
    key: "cashier", title: "Cashier report", group: "Staff", permission: "report.staff", description: "Sales, discounts and voids per cashier.",
    async run(ctx) {
      const n = await names();
      const live = await orders(ctx), voided = await orders(ctx, { voided: true });
      const ids = [...new Set([...live, ...voided].map((o) => o.createdBy))];
      const rows = ids.map((id) => { const l = live.filter((o) => o.createdBy === id), v = voided.filter((o) => o.createdBy === id); return { cashier: n.staff(id), orders: l.length, sales: sum(l.map((o) => o.total)), discounts: sum(l.map((o) => o.discountTotal)), voids: v.length, voidValue: sum(v.map((o) => o.total)), avg: l.length ? Math.round(sum(l.map((o) => o.total)) / l.length) : 0 }; }).sort((a, b) => b.sales - a.sales);
      return { columns: [{ key: "cashier", label: "Cashier", type: "text" }, { key: "orders", label: "Orders", type: "int" }, { key: "sales", label: "Sales", type: "money" }, { key: "discounts", label: "Discounts", type: "money" }, { key: "voids", label: "Voids", type: "int" }, { key: "voidValue", label: "Void value", type: "money" }, { key: "avg", label: "Avg order", type: "money" }], rows, totals: { cashier: "Total", orders: sum(rows.map((r) => r.orders)), sales: sum(rows.map((r) => r.sales)), discounts: sum(rows.map((r) => r.discounts)), voids: sum(rows.map((r) => r.voids)), voidValue: sum(rows.map((r) => r.voidValue)), avg: 0 } };
    },
  },
  {
    key: "shifts", title: "Shift reports", group: "Staff", permission: "report.staff", description: "Every shift: float, expected cash, counted cash, over/short.",
    async run(ctx) {
      const db = await getDb(); const n = await names();
      const sh = await db.select().from(s.shifts).where(and(inArray(s.shifts.branchId, ctx.branchIds), gte(s.shifts.openedAt, start(ctx.from)), lte(s.shifts.openedAt, end(ctx.to))));
      const terms = await db.select().from(s.terminals);
      const rows = sh.map((x) => ({ opened: time(x.openedAt), closed: time(x.closedAt), branch: n.branch(x.branchId), terminal: terms.find((t) => t.id === x.terminalId)?.name ?? "", cashier: n.staff(x.staffId), float: x.openingFloat, expected: x.expectedCash, counted: x.countedCash, over: x.overShort, status: x.status })).sort((a, b) => String(a.opened).localeCompare(String(b.opened)));
      return { columns: [{ key: "opened", label: "Opened", type: "text" }, { key: "closed", label: "Closed", type: "text" }, { key: "branch", label: "Branch", type: "text" }, { key: "terminal", label: "Terminal", type: "text" }, { key: "cashier", label: "Cashier", type: "text" }, { key: "float", label: "Float", type: "money" }, { key: "expected", label: "Expected", type: "money" }, { key: "counted", label: "Counted", type: "money" }, { key: "over", label: "Over / short", type: "money" }, { key: "status", label: "Status", type: "text" }], rows, totals: { opened: "Total", closed: "", branch: "", terminal: "", cashier: "", float: sum(rows.map((r) => r.float)), expected: sum(rows.map((r) => r.expected ?? 0)), counted: sum(rows.map((r) => r.counted ?? 0)), over: sum(rows.map((r) => r.over ?? 0)), status: "" } };
    },
  },
  {
    key: "inventory-valuation", title: "Inventory valuation", group: "Inventory", permission: "report.inventory", description: "Stock on hand today at average cost.",
    async run(ctx) {
      const db = await getDb(); const n = await names();
      const [stock, ings, units] = await Promise.all([db.select().from(s.ingredientStock).where(inArray(s.ingredientStock.branchId, ctx.branchIds)), db.select().from(s.ingredients), db.select().from(s.units)]);
      const rows = stock.map((x) => { const i = ings.find((g) => g.id === x.ingredientId)!; const q = Number(x.quantity); return { branch: n.branch(x.branchId), ingredient: i.name, qty: Math.round(q * 100) / 100, unit: units.find((u) => u.id === i.baseUnitId)?.code ?? "", cost: i.avgCost, value: Math.round(q * i.avgCost) }; }).sort((a, b) => b.value - a.value);
      return { columns: [{ key: "branch", label: "Branch", type: "text" }, { key: "ingredient", label: "Ingredient", type: "text" }, { key: "qty", label: "On hand", type: "num" }, { key: "unit", label: "Unit", type: "text" }, { key: "cost", label: "Avg cost / unit", type: "money" }, { key: "value", label: "Value", type: "money" }], rows, totals: { branch: "Total", ingredient: "", qty: null, unit: "", cost: null, value: sum(rows.map((r) => r.value)) } };
    },
  },
  {
    key: "wastage", title: "Wastage", group: "Inventory", permission: "report.inventory", description: "Stock written off, with reason and cost.",
    async run(ctx) {
      const db = await getDb(); const n = await names();
      const mv = await db.select().from(s.stockMovements).where(and(inArray(s.stockMovements.branchId, ctx.branchIds), eq(s.stockMovements.type, "wastage"), gte(s.stockMovements.createdAt, start(ctx.from)), lte(s.stockMovements.createdAt, end(ctx.to))));
      const [ings, units, reasons] = await Promise.all([db.select().from(s.ingredients), db.select().from(s.units), db.select().from(s.reasonCodes)]);
      const rows = mv.map((m) => { const i = ings.find((g) => g.id === m.ingredientId)!; const q = Math.abs(Number(m.quantity)); return { date: day(m.createdAt), branch: n.branch(m.branchId), ingredient: i.name, qty: Math.round(q * 100) / 100, unit: units.find((u) => u.id === i.baseUnitId)?.code ?? "", cost: Math.round(q * m.unitCost), reason: reasons.find((r) => r.id === m.reasonCodeId)?.label ?? "", by: n.staff(m.createdBy) }; });
      return { columns: [{ key: "date", label: "Date", type: "text" }, { key: "branch", label: "Branch", type: "text" }, { key: "ingredient", label: "Ingredient", type: "text" }, { key: "qty", label: "Qty", type: "num" }, { key: "unit", label: "Unit", type: "text" }, { key: "cost", label: "Cost", type: "money" }, { key: "reason", label: "Reason", type: "text" }, { key: "by", label: "By", type: "text" }], rows, totals: { date: "Total", branch: "", ingredient: "", qty: null, unit: "", cost: sum(rows.map((r) => r.cost)), reason: "", by: "" } };
    },
  },
  {
    key: "food-cost", title: "Food cost", group: "Inventory", permission: "report.inventory", description: "Recipe cost against price for what was sold, worst first.",
    async run(ctx) {
      const r = await REPORTS.find((x) => x.key === "item-sales")!.run(ctx);
      const rows = r.rows.filter((x) => Number(x.cost) > 0).sort((a, b) => Number(b.foodCost) - Number(a.foodCost));
      return { ...r, rows, columns: r.columns.filter((c) => c.key !== "margin") };
    },
  },
  {
    key: "delivery", title: "Delivery & riders", group: "Delivery", permission: "report.sales", description: "Per rider: deliveries, speed, cash collected and settlement.",
    async run(ctx) {
      const db = await getDb(); const n = await names();
      const ds = await db.select().from(s.deliveries).where(and(inArray(s.deliveries.branchId, ctx.branchIds), gte(s.deliveries.assignedAt, start(ctx.from)), lte(s.deliveries.assignedAt, end(ctx.to))));
      const st = await db.select().from(s.riderSettlements).where(and(inArray(s.riderSettlements.branchId, ctx.branchIds), gte(s.riderSettlements.createdAt, start(ctx.from)), lte(s.riderSettlements.createdAt, end(ctx.to))));
      const ids = [...new Set(ds.map((d) => d.riderId).filter((x): x is string => !!x))];
      const rows = ids.map((id) => {
        const m = ds.filter((d) => d.riderId === id), ok = m.filter((d) => d.status === "delivered");
        const mins = ok.filter((d) => d.assignedAt && d.deliveredAt).map((d) => (d.deliveredAt!.getTime() - d.assignedAt!.getTime()) / 60000);
        const sx = st.filter((x) => x.riderId === id);
        return { rider: n.staff(id), assigned: m.length, delivered: ok.length, failed: m.filter((d) => d.status === "failed").length, avgMin: mins.length ? Math.round(sum(mins) / mins.length) : null, collected: sum(ok.map((d) => d.cashCollected ?? 0)), settled: sum(sx.map((x) => x.receivedCash)), diff: sum(sx.map((x) => x.receivedCash - x.expectedCash)) };
      });
      return { columns: [{ key: "rider", label: "Rider", type: "text" }, { key: "assigned", label: "Assigned", type: "int" }, { key: "delivered", label: "Delivered", type: "int" }, { key: "failed", label: "Failed", type: "int" }, { key: "avgMin", label: "Avg minutes", type: "int" }, { key: "collected", label: "Cash collected", type: "money" }, { key: "settled", label: "Handed over", type: "money" }, { key: "diff", label: "Over / short", type: "money" }], rows, totals: { rider: "Total", assigned: sum(rows.map((r) => r.assigned)), delivered: sum(rows.map((r) => r.delivered)), failed: sum(rows.map((r) => r.failed)), avgMin: null, collected: sum(rows.map((r) => r.collected)), settled: sum(rows.map((r) => r.settled)), diff: sum(rows.map((r) => r.diff)) } };
    },
  },
  {
    key: "customers", title: "Customers", group: "Customers", permission: "report.sales", description: "Who ordered, how often and how much.",
    async run(ctx) {
      const db = await getDb();
      const os = (await orders(ctx)).filter((o) => o.customerId);
      const cs = os.length ? await db.select().from(s.customers).where(inArray(s.customers.id, [...new Set(os.map((o) => o.customerId!))])) : [];
      const rows = cs.map((c) => { const m = os.filter((o) => o.customerId === c.id); const total = sum(m.map((o) => o.total)); return { name: c.name ?? "", phone: c.phone, orders: m.length, spend: total, avg: Math.round(total / m.length), last: m.map((o) => o.businessDate).sort().at(-1) ?? "", points: c.loyaltyPoints }; }).sort((a, b) => b.spend - a.spend);
      return { columns: [{ key: "name", label: "Customer", type: "text" }, { key: "phone", label: "Phone", type: "text" }, { key: "orders", label: "Orders", type: "int" }, { key: "spend", label: "Spend", type: "money" }, { key: "avg", label: "Avg order", type: "money" }, { key: "last", label: "Last order", type: "text" }, { key: "points", label: "Points", type: "int" }], rows, totals: { name: "Total", phone: "", orders: sum(rows.map((r) => r.orders)), spend: sum(rows.map((r) => r.spend)), avg: null, last: "", points: null } };
    },
  },
];

export const reportByKey = (k: string) => REPORTS.find((r) => r.key === k);
