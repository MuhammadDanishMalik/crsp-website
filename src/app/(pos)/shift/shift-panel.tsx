"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCashMovement, closeShift } from "@/lib/actions/shift";
import { logout } from "@/lib/actions/auth";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Numpad } from "@/components/pos/numpad";
import { Modal } from "@/components/ui/modal";

type Data = {
  openedAt: string; float: number; orders: { n: number; sales: number; disc: number; tax: number };
  byMethod: { method: string; status: string; total: number; n: number }[]; cashIn: number; cashOut: number; cashSales: number; refunds: number; cashRefunds: number; expected: number | null;
  moves: { type: string; amount: number; reason: string | null; at: string }[];
};

export function ShiftPanel({ data, canCashMove, canClose, canSeeExpected }: { data: Data; canCashMove: boolean; canClose: boolean; canSeeExpected: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "cash_in" | "cash_out" | "close">(null);
  const [digits, setDigits] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<null | { overShort: number; expected: number }>(null);
  const [pending, start] = useTransition();
  const amount = Number(digits || 0) * 100;

  const submit = () =>
    start(async () => {
      setError("");
      if (mode === "close") {
        const r = await closeShift(amount, reason || undefined);
        if (!r.ok) return setError(r.error);
        setResult({ overShort: r.overShort ?? 0, expected: r.expected ?? 0 });
      } else if (mode) {
        const r = await addCashMovement(mode, amount, reason);
        if (!r.ok) return setError(r.error);
        setMode(null); setDigits(""); setReason(""); router.refresh();
      }
    });

  return (
    <main className="scroll-thin mx-auto h-full max-w-3xl overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shift — X report</h1>
        <Button variant="secondary" onClick={() => router.push("/order")}>Back to orders</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Orders" v={String(data.orders.n)} /><Stat label="Sales" v={formatPKR(data.orders.sales)} />
        <Stat label="Refunds/voids" v={formatPKR(data.refunds)} /><Stat label="Tax" v={formatPKR(data.orders.tax)} />
      </div>
      <section className="mt-4 rounded-2xl bg-surface p-4">
        <h2 className="mb-2 font-semibold">Payments</h2>
        {data.byMethod.length === 0 && <p className="text-muted">No payments yet</p>}
        {data.byMethod.map((m) => (
          <div key={m.method + m.status} className="flex justify-between py-1"><span className="capitalize">{m.method.replace("_", " ")} ({m.n}){m.status !== "confirmed" ? ` · ${m.status.replace("_", " ")}` : ""}</span><span className="tabular-nums">{formatPKR(m.total)}</span></div>
        ))}
      </section>
      <section className="mt-4 rounded-2xl bg-surface p-4">
        <h2 className="mb-2 font-semibold">Drawer</h2>
        <Line l="Opening float" v={data.float} /><Line l="Cash sales" v={data.cashSales} /><Line l="Cash in" v={data.cashIn} /><Line l="Cash out" v={-data.cashOut} />{data.cashRefunds > 0 && <Line l="Cash refunds" v={-data.cashRefunds} />}
        {canSeeExpected && data.expected != null && <div className="mt-1 flex justify-between border-t border-border pt-2 font-bold"><span>Expected in drawer</span><span>{formatPKR(data.expected)}</span></div>}
        {data.moves.map((m, i) => <p key={i} className="text-sm text-muted">{m.type === "cash_in" ? "+" : "−"}{formatPKR(m.amount)} · {m.reason}</p>)}
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        {canCashMove && <><Button variant="secondary" size="lg" onClick={() => setMode("cash_in")}>Cash in</Button><Button variant="secondary" size="lg" onClick={() => setMode("cash_out")}>Cash out (e.g. supplier)</Button></>}
        {canClose && <Button variant="danger" size="lg" className="ml-auto" onClick={() => setMode("close")}>Close shift</Button>}
      </div>

      {mode && !result && (
        <Modal title={mode === "close" ? "Close shift — count the drawer" : mode === "cash_in" ? "Cash in" : "Cash out"} onClose={() => setMode(null)} width="max-w-md">
          {mode === "close" && <p className="mb-2 text-muted">Count all cash in the drawer (including the float) and enter the total. The system will compare it afterwards.</p>}
          <div className="mb-3 rounded-2xl bg-surface-2 p-4 text-right text-4xl font-bold tabular-nums">{formatPKR(amount)}</div>
          <Numpad onDigit={(d) => setDigits((v) => (v + d).replace(/^0+(\d)/, "$1").slice(0, 7))} onBackspace={() => setDigits((v) => v.slice(0, -1))} onClear={() => setDigits("")} />
          <Input className="mt-3" placeholder={mode === "close" ? "Note (optional)" : "Reason (required)"} value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <p className="mt-2 text-danger">{error}</p>}
          <Button size="xl" className="mt-3 w-full" disabled={pending || (mode !== "close" && amount === 0)} onClick={submit}>{mode === "close" ? "Submit count & close" : "Save"}</Button>
        </Modal>
      )}
      {result && (
        <Modal title="Shift closed" onClose={() => logout()} width="max-w-md">
          <div className="space-y-2 text-center">
            <p className="text-muted">Expected {formatPKR(result.expected)}</p>
            <p className={`text-4xl font-black ${result.overShort === 0 ? "text-success" : result.overShort > 0 ? "text-accent" : "text-danger"}`}>
              {result.overShort === 0 ? "Balanced" : `${result.overShort > 0 ? "Over" : "Short"} ${formatPKR(Math.abs(result.overShort))}`}
            </p>
            <Button size="xl" className="mt-4 w-full" onClick={() => logout()}>Sign out</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
const Stat = ({ label, v }: { label: string; v: string }) => <div className="rounded-2xl bg-surface p-4"><p className="text-xs uppercase text-muted">{label}</p><p className="text-xl font-bold tabular-nums">{v}</p></div>;
const Line = ({ l, v }: { l: string; v: number }) => <div className="flex justify-between py-0.5"><span>{l}</span><span className="tabular-nums">{formatPKR(v)}</span></div>;
