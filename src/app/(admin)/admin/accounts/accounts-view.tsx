"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveBankDeposit } from "@/lib/actions/expenses";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { loadDayEnd, loadPnl } from "@/lib/queries/accounts";

type Pnl = Awaited<ReturnType<typeof loadPnl>>;
type Day = Awaited<ReturnType<typeof loadDayEnd>>;
const Row = ({ l, v, b, tone }: { l: string; v: number; b?: boolean; tone?: string }) => <div className={cn("flex justify-between py-1", b && "border-t border-border pt-2 text-lg font-bold", tone)}><span>{l}</span><span className="tabular-nums">{formatPKR(v)}</span></div>;

export function AccountsView({ date, from, to, pnl, day, can }: { date: string; from: string; to: string; pnl: Pnl | null; day: Day; can: { pnl: boolean; deposits: boolean } }) {
  const router = useRouter();
  const [dep, setDep] = useState(false);
  return (
    <div className="max-w-5xl space-y-8">
      <h1 className="text-3xl font-bold">Accounts</h1>
      {pnl && (
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold">Profit & loss</h2>
            <input type="date" value={from} onChange={(e) => router.push(`/admin/accounts?from=${e.target.value}&to=${to}&date=${date}`)} className="h-11 rounded-xl border border-border bg-surface px-3" /><span>to</span>
            <input type="date" value={to} onChange={(e) => router.push(`/admin/accounts?from=${from}&to=${e.target.value}&date=${date}`)} className="h-11 rounded-xl border border-border bg-surface px-3" /></div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-2 text-sm text-muted">{pnl.orders} orders · tax collected {formatPKR(pnl.tax)} (not counted as income) · discounts given {formatPKR(pnl.discount)}</p>
            <Row l="Sales (excluding tax)" v={pnl.gross - pnl.tax} />{pnl.refunded > 0 && <Row l="Refunds" v={-pnl.refunded} tone="text-danger" />}
            <Row l="Net revenue" v={pnl.revenue} b />
            <Row l={`Food cost (${pnl.foodCostPct}% of revenue)`} v={-pnl.foodCost} /><Row l="Gross profit" v={pnl.grossProfit} b />
            {pnl.expenses.map((e) => <Row key={e.name} l={e.name} v={-e.total} tone="text-muted" />)}
            <Row l="Total expenses" v={-pnl.expenseTotal} />
            <Row l="Net profit" v={pnl.net} b tone={pnl.net < 0 ? "text-danger" : "text-success"} />
            <p className="mt-2 text-xs text-muted">Food cost uses recipe cost at the time of sale; items without a recipe count as zero cost.</p>
          </div>
        </section>
      )}
      <section>
        <div className="mb-2 flex items-center gap-3"><h2 className="text-lg font-semibold">Day-end cash summary</h2>
          <input type="date" value={date} onChange={(e) => router.push(`/admin/accounts?from=${from}&to=${to}&date=${e.target.value}`)} className="h-11 rounded-xl border border-border bg-surface px-3" />
          {can.deposits && <Button className="ml-auto" onClick={() => setDep(true)}>+ Bank deposit</Button>}</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5"><h3 className="mb-2 font-semibold">Takings by method</h3>
            {Object.entries(day.byMethod).map(([m, v]) => <Row key={m} l={m.replace("_", " ")} v={v} />)}{!Object.keys(day.byMethod).length && <p className="text-muted">No sales</p>}</div>
          <div className="rounded-2xl border border-border bg-surface p-5"><h3 className="mb-2 font-semibold">Cash position</h3>
            <Row l="Cash sales" v={day.cashSales} /><Row l="Cash refunds" v={-day.cashRefunds} /><Row l="Cash expenses" v={-day.cashExpenses} /><Row l="Supplier payments (cash)" v={-day.cashSuppliers} /><Row l="Banked" v={-day.deposited} />
            <Row l="Cash still to bank" v={day.cashAvailable} b />
            {day.deposits.map((d) => <p key={d.id} className="text-sm text-muted">Deposit {formatPKR(d.amount)} · {d.bankName} {d.reference}</p>)}</div>
        </div>
      </section>
      {dep && <DepositForm date={date} onClose={() => setDep(false)} onDone={() => { setDep(false); router.refresh(); }} />}
    </div>
  );
}

function DepositForm({ date, onClose, onDone }: { date: string; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ date, amount: "", bank: "", ref: "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title="Bank deposit" onClose={onClose} width="max-w-sm">
      <div className="space-y-3"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /><Input inputMode="decimal" placeholder="Amount (Rs)" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} autoFocus />
        <Input placeholder="Bank" value={v.bank} onChange={(e) => setV({ ...v, bank: e.target.value })} /><Input placeholder="Slip / reference no." value={v.ref} onChange={(e) => setV({ ...v, ref: e.target.value })} />
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await saveBankDeposit({ date: v.date, amountRupees: Number(v.amount), bankName: v.bank || undefined, reference: v.ref || undefined }); if (r.ok) onDone(); else setError(r.error); })}>Save deposit</Button></div>
    </Modal>
  );
}
