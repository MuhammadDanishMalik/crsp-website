"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addPayrollAdjustment } from "@/lib/actions/staff";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

type P = { staffId: string; name: string; role: string; salaryType: string; daysWorked: number; minutesWorked: number; lateCount: number; absentCount: number; gross: number; bonuses?: number; advances: number; deductions: number; net: number };
type Perf = { staffId: string; name: string; orders: number; sales: number; voids: number; voidValue: number; discounts: number; avgMinutes: number | null };
const th = "p-3 text-right font-semibold first:text-left";
const td = "p-3 text-right tabular-nums first:text-left";

export function PayrollView({ month, from, to, payroll, perf, can }: { month: string; from: string; to: string; payroll: P[]; perf: Perf[]; can: { payroll: boolean; export: boolean; adjust: boolean; perf: boolean } }) {
  const router = useRouter();
  const [adj, setAdj] = useState<P | null>(null);
  return (
    <div className="space-y-8">
      {can.payroll && (
        <section>
          <div className="mb-2 flex items-center gap-3"><h2 className="text-lg font-semibold">Payroll summary</h2>
            <input type="month" value={month} onChange={(e) => router.push(`/admin/payroll?month=${e.target.value}&from=${from}&to=${to}`)} className="h-11 rounded-xl border border-border bg-surface px-3" />
            {can.export && <a href={`/api/export/payroll?month=${month}`} className="ml-auto rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold">Download CSV</a>}</div>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm"><thead className="bg-surface-2"><tr><th className={th}>Staff</th><th className={th}>Days</th><th className={th}>Hours</th><th className={th}>Late</th><th className={th}>Absent</th><th className={th}>Gross</th><th className={th}>Advances</th><th className={th}>Deductions</th><th className={th}>Net</th><th /></tr></thead>
              <tbody>{payroll.map((p) => (
                <tr key={p.staffId} className="border-t border-border"><td className={td}>{p.name}<span className="block text-xs text-muted">{p.role}</span></td><td className={td}>{p.daysWorked}</td><td className={td}>{(p.minutesWorked / 60).toFixed(1)}</td><td className={td}>{p.lateCount}</td><td className={td}>{p.absentCount}</td>
                  <td className={td}>{formatPKR(p.gross)}</td><td className={td}>{formatPKR(p.advances)}</td><td className={td}>{formatPKR(p.deductions)}</td><td className={`${td} font-bold`}>{formatPKR(p.net)}</td>
                  <td className="p-2">{can.adjust && <Button variant="secondary" className="min-h-10" onClick={() => setAdj(p)}>+ Advance / deduction</Button>}</td></tr>
              ))}</tbody></table>
          </div>
        </section>
      )}
      {can.perf && (
        <section>
          <div className="mb-2 flex items-center gap-3"><h2 className="text-lg font-semibold">Staff performance</h2>
            <input type="date" value={from} onChange={(e) => router.push(`/admin/payroll?month=${month}&from=${e.target.value}&to=${to}`)} className="h-11 rounded-xl border border-border bg-surface px-3" />
            <span>to</span><input type="date" value={to} onChange={(e) => router.push(`/admin/payroll?month=${month}&from=${from}&to=${e.target.value}`)} className="h-11 rounded-xl border border-border bg-surface px-3" /></div>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm"><thead className="bg-surface-2"><tr><th className={th}>Cashier</th><th className={th}>Orders</th><th className={th}>Sales</th><th className={th}>Voids</th><th className={th}>Void value</th><th className={th}>Discounts</th><th className={th}>Avg prep (min)</th></tr></thead>
              <tbody>{perf.map((p) => <tr key={p.staffId} className="border-t border-border"><td className={td}>{p.name}</td><td className={td}>{p.orders}</td><td className={td}>{formatPKR(p.sales)}</td><td className={td}>{p.voids}</td><td className={td}>{formatPKR(p.voidValue)}</td><td className={td}>{formatPKR(p.discounts)}</td><td className={td}>{p.avgMinutes ?? "—"}</td></tr>)}
                {!perf.length && <tr><td className="p-6 text-center text-muted" colSpan={7}>No orders in this range</td></tr>}</tbody></table>
          </div>
        </section>
      )}
      {adj && <AdjustForm p={adj} month={month} onClose={() => setAdj(null)} onSaved={() => { setAdj(null); router.refresh(); }} />}
    </div>
  );
}

function AdjustForm({ p, month, onClose, onSaved }: { p: P; month: string; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<"advance" | "deduction" | "bonus">("advance");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title={`${p.name} · ${month}`} onClose={onClose} width="max-w-sm">
      <div className="space-y-3">
        <div className="flex gap-2">{(["advance", "deduction", "bonus"] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={`h-12 flex-1 rounded-xl border-2 font-semibold capitalize ${kind === k ? "border-brand bg-brand/15" : "border-border bg-surface-2"}`}>{k}</button>)}</div>
        <Input inputMode="decimal" placeholder="Amount (Rs)" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        <Input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await addPayrollAdjustment({ staffId: p.staffId, kind, amountRupees: Number(amount), month, note: note || undefined }); if (r.ok) onSaved(); else setError(r.error); })}>Save</Button>
      </div>
    </Modal>
  );
}
