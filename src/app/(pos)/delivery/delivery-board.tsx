"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Phone } from "lucide-react";
import { assignRider, fetchDeliveries, settleRider, updateDelivery } from "@/lib/actions/delivery";
import { useBranchEvents } from "@/lib/realtime/use-events";
import { formatPKR } from "@/lib/domain/money";
import type { DeliveryRow } from "@/lib/queries/delivery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Numpad } from "@/components/pos/numpad";
import { cn } from "@/lib/utils";

type Rider = { id: string; name: string; deliveries: number; holding: number };
type Data = { rows: DeliveryRow[]; riders: Rider[] };
const COLS: { key: string; label: string; tone: string }[] = [
  { key: "unassigned", label: "Unassigned", tone: "text-danger" }, { key: "assigned", label: "Assigned", tone: "text-warn" },
  { key: "picked", label: "On the way", tone: "text-accent" }, { key: "delivered", label: "Delivered", tone: "text-success" },
];

export function DeliveryBoard({ initial, can }: { initial: Data; can: { assign: boolean; settle: boolean } }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [msg, setMsg] = useState("");
  const [settle, setSettle] = useState<Rider | null>(null);
  const [, start] = useTransition();
  const refresh = useCallback(async () => { const d = await fetchDeliveries("board"); if (d) setData(d); }, []);
  useBranchEvents(() => { void refresh(); }, 10_000);
  const riders = data.riders;
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? "" : (r.error ?? "")); await refresh(); });
  const today = data.rows.filter((r) => r.status !== "cancelled" && (r.status !== "delivered" || !r.settled));

  return (
    <main className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-3"><h1 className="text-2xl font-bold">Deliveries</h1>{msg && <span className="text-danger">{msg}</span>}<Button variant="secondary" className="ml-auto" onClick={() => router.push("/order")}>Back to orders</Button></div>
      {can.settle && riders.some((r) => r.holding > 0) && (
        <div className="mb-3 flex flex-wrap gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-3">
          <span className="w-full text-sm font-semibold">Riders holding cash</span>
          {riders.filter((r) => r.holding > 0).map((r) => <Button key={r.id} variant="secondary" onClick={() => setSettle(r)}>{r.name} · {formatPKR(r.holding)} ({r.deliveries}) → Receive</Button>)}
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-3">
        {COLS.map((c) => (
          <section key={c.key} className="flex min-h-0 flex-col rounded-2xl bg-surface p-2">
            <h2 className={cn("px-2 py-1 font-bold uppercase", c.tone)}>{c.label} <span className="text-muted">({today.filter((r) => r.status === c.key).length})</span></h2>
            <div className="scroll-thin flex-1 space-y-2 overflow-y-auto">
              {today.filter((r) => r.status === c.key).map((r) => (
                <div key={r.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                  <div className="flex justify-between"><b className="text-lg">#{r.orderNo}</b><span className="font-semibold">{r.cashToCollect ? `COD ${formatPKR(r.cashToCollect)}` : "Paid"}</span></div>
                  <p>{r.customerName || "Customer"} {r.customerPhone && <a className="ml-1 inline-flex items-center gap-1 underline" href={`tel:${r.customerPhone}`}><Phone size={12} />{r.customerPhone}</a>}</p>
                  <p className="text-muted">{r.address}</p><p className="truncate text-muted">{r.items}</p>
                  {r.riderName && <p className="mt-1 font-semibold">🛵 {r.riderName}</p>}
                  {r.status === "delivered" && <p className="text-muted">Collected {formatPKR(r.cashCollected ?? 0)}{r.settled ? " · settled" : " · with rider"}</p>}
                  {can.assign && (r.status === "unassigned" || r.status === "assigned") && (
                    <select className="mt-2 min-h-12 w-full rounded-lg border border-border bg-surface px-2" value={r.riderId ?? ""} onChange={(e) => act(() => assignRider(r.id, e.target.value || null))}>
                      <option value="">Assign rider…</option>{riders.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  )}
                  {can.assign && r.status === "picked" && <Button variant="secondary" className="mt-2 min-h-11 w-full" onClick={() => act(() => updateDelivery(r.id, "delivered"))}>Mark delivered (cash as expected)</Button>}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {settle && <SettleDialog rider={settle} onClose={() => setSettle(null)} onDone={() => { setSettle(null); void refresh(); }} />}
    </main>
  );
}

function SettleDialog({ rider, onClose, onDone }: { rider: Rider; onClose: () => void; onDone: () => void }) {
  const [digits, setDigits] = useState(String(rider.holding / 100));
  const [result, setResult] = useState<null | { diff: number }>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title={`Receive cash from ${rider.name}`} onClose={onClose} width="max-w-md">
      {result ? (
        <div className="space-y-3 text-center"><p className={cn("text-3xl font-black", result.diff === 0 ? "text-success" : "text-danger")}>{result.diff === 0 ? "Exact" : `${result.diff > 0 ? "Over" : "Short"} ${formatPKR(Math.abs(result.diff))}`}</p><Button size="lg" className="w-full" onClick={onDone}>Done</Button></div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted">Expected {formatPKR(rider.holding)} from {rider.deliveries} deliveries. Count the cash and enter what you received.</p>
          <Input readOnly className="text-right text-3xl font-bold" value={`Rs ${digits || 0}`} />
          <Numpad onDigit={(d) => setDigits((v) => (v + d).replace(/^0+(\d)/, "$1").slice(0, 7))} onBackspace={() => setDigits((v) => v.slice(0, -1))} onClear={() => setDigits("")} />
          {error && <p className="text-danger">{error}</p>}
          <Button size="xl" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await settleRider(rider.id, Math.round(Number(digits || 0) * 100)); if (r.ok) setResult({ diff: r.diff ?? 0 }); else setError(r.error); })}>Confirm received</Button>
        </div>
      )}
    </Modal>
  );
}
