"use client";
import { useCallback, useState, useTransition } from "react";
import { LogOut, MapPin, Phone } from "lucide-react";
import { fetchDeliveries, updateDelivery } from "@/lib/actions/delivery";
import { logout } from "@/lib/actions/auth";
import { useBranchEvents } from "@/lib/realtime/use-events";
import { formatPKR } from "@/lib/domain/money";
import type { DeliveryRow } from "@/lib/queries/delivery";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

/** Mobile-first rider view: my deliveries, call/map, picked → delivered with cash collected. */
export function RiderApp({ initial, name }: { initial: DeliveryRow[]; name: string }) {
  const [rows, setRows] = useState(initial);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<DeliveryRow | null>(null);
  const [failed, setFailed] = useState<DeliveryRow | null>(null);
  const [, start] = useTransition();
  const refresh = useCallback(async () => { const d = await fetchDeliveries("mine"); if (d) setRows(d.rows); }, []);
  useBranchEvents(() => { void refresh(); }, 15_000);
  const active = rows.filter((r) => r.status === "assigned" || r.status === "picked");
  const holding = rows.filter((r) => r.status === "delivered" && !r.settled).reduce((a, r) => a + (r.cashCollected ?? 0), 0);
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? "" : (r.error ?? "")); await refresh(); });

  return (
    <main className="mx-auto max-w-md p-4">
      <header className="mb-4 flex items-center gap-3"><Logo height={36} /><div className="ml-auto text-right leading-tight"><p className="font-semibold">{name}</p><p className="text-xs text-muted">Rider</p></div>
        <form action={logout}><button aria-label="Sign out" className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2"><LogOut size={18} /></button></form></header>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface p-4"><p className="text-xs uppercase text-muted">To deliver</p><p className="text-3xl font-black">{active.length}</p></div>
        <div className="rounded-2xl bg-surface p-4"><p className="text-xs uppercase text-muted">Cash with me</p><p className="text-2xl font-black">{formatPKR(holding)}</p></div>
      </div>
      {msg && <p className="mb-3 rounded-xl bg-danger/15 p-3 text-danger">{msg}</p>}
      <div className="space-y-3">
        {active.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between"><b className="text-2xl">#{r.orderNo}</b><span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold uppercase">{r.status === "picked" ? "On the way" : "Ready to pick"}</span></div>
            <p className="mt-2 font-semibold">{r.customerName || "Customer"}</p>
            <p className="flex items-start gap-1 text-muted"><MapPin size={16} className="mt-1 shrink-0" />{r.address}</p>
            <p className="mt-1 text-sm text-muted">{r.items}</p>
            <p className="mt-2 text-lg font-bold">{r.cashToCollect ? `Collect ${formatPKR(r.cashToCollect)}` : "Already paid"}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {r.customerPhone && <a href={`tel:${r.customerPhone}`} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-surface-2 font-semibold"><Phone size={18} />Call</a>}
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address + " Mianwali")}`} target="_blank" rel="noreferrer" className="flex h-14 items-center justify-center gap-2 rounded-xl bg-surface-2 font-semibold"><MapPin size={18} />Map</a>
              {r.status === "assigned" && <Button size="lg" className="col-span-2" onClick={() => act(() => updateDelivery(r.id, "picked"))}>Picked up</Button>}
              {r.status === "picked" && <><Button variant="success" size="lg" onClick={() => setDone(r)}>Delivered</Button><Button variant="secondary" size="lg" onClick={() => setFailed(r)}>Couldn&apos;t deliver</Button></>}
            </div>
          </div>
        ))}
        {!active.length && <p className="py-16 text-center text-muted">No deliveries assigned. This screen updates by itself.</p>}
      </div>
      {done && <CollectDialog row={done} onClose={() => setDone(null)} onConfirm={(paisa) => { act(() => updateDelivery(done.id, "delivered", { cashCollectedPaisa: paisa })); setDone(null); }} />}
      {failed && <FailDialog onClose={() => setFailed(null)} onConfirm={(reason) => { act(() => updateDelivery(failed.id, "failed", { reason })); setFailed(null); }} />}
    </main>
  );
}

function CollectDialog({ row, onClose, onConfirm }: { row: DeliveryRow; onClose: () => void; onConfirm: (paisa: number) => void }) {
  const [v, setV] = useState(String(row.cashToCollect / 100));
  return (
    <Modal title={`Delivered #${row.orderNo}`} onClose={onClose} width="max-w-sm">
      <div className="space-y-3">
        {row.cashToCollect > 0 ? (<><p className="text-muted">Cash received from the customer (Rs)</p><Input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} className="text-2xl font-bold" /></>) : <p>Already paid — nothing to collect.</p>}
        <Button variant="success" size="xl" className="w-full" onClick={() => onConfirm(row.cashToCollect > 0 ? Math.round(Number(v) * 100) : 0)}>Confirm delivered</Button>
      </div>
    </Modal>
  );
}

function FailDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal title="Couldn't deliver" onClose={onClose} width="max-w-sm">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">{["Customer not answering", "Wrong address", "Customer refused", "Other"].map((r) => <button key={r} onClick={() => setReason(r)} className={`min-h-12 rounded-xl border-2 px-3 text-sm font-semibold ${reason === r ? "border-brand bg-brand/15" : "border-border bg-surface-2"}`}>{r}</button>)}</div>
        <Button variant="danger" size="xl" className="w-full" disabled={!reason} onClick={() => onConfirm(reason)}>Report problem</Button>
      </div>
    </Modal>
  );
}
