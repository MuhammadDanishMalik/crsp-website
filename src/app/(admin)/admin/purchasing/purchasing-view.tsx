"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cancelPurchaseOrder, createPurchase, paySupplier, receivePurchaseOrder, saveSupplier } from "@/lib/actions/purchasing";
import { formatPKR } from "@/lib/domain/money";
import type { Conversion } from "@/lib/domain/inventory";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { unitsFor } from "../inventory/inventory-view";

type Sup = { id: string; name: string; phone: string; address: string; isImporter: boolean; balance: number };
type PO = { id: string; no: string; supplier: string; status: string; total: number; at: string; lines: { id: string; name: string; imported: boolean; qty: number; unit: string; unitCost: number }[] };
type Props = {
  can: { manage: boolean; pay: boolean }; suppliers: Sup[]; orders: PO[]; payments: { id: string; supplier: string; amount: number; method: string; at: string; ref: string }[];
  ingredients: { id: string; name: string; baseUnitId: string; imported: boolean }[]; units: { id: string; code: string }[]; conv: Conversion[];
};
const sel = "min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3";
const STATUS: Record<string, string> = { ordered: "bg-warn/20 text-warn", received: "bg-success/20 text-success", cancelled: "bg-danger/20 text-danger", draft: "bg-surface-2 text-muted", partial: "bg-warn/20 text-warn" };

export function PurchasingView(p: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<null | { k: "purchase" } | { k: "supplier"; s?: Sup } | { k: "pay"; s: Sup } | { k: "receive"; po: PO }>(null);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();
  const done = () => { setModal(null); router.refresh(); };
  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-center gap-3"><h1 className="text-3xl font-bold">Purchasing</h1>
        {p.can.manage && <Button className="ml-auto" onClick={() => setModal({ k: "purchase" })}><Plus size={18} />New purchase</Button>}</div>
      {msg && <p className="rounded-xl bg-danger/15 p-3 text-danger">{msg}</p>}

      <section>
        <div className="mb-2 flex items-center"><h2 className="text-lg font-semibold">Suppliers</h2>{p.can.manage && <Button variant="secondary" className="ml-auto min-h-11" onClick={() => setModal({ k: "supplier" })}>+ Supplier</Button>}</div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {p.suppliers.map((s) => (
            <div key={s.id} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-0">
              <div className="flex-1"><p className="font-semibold">{s.name}{s.isImporter && <span className="ml-2 rounded bg-accent/20 px-2 py-0.5 text-xs font-bold">IMPORTER</span>}</p><p className="text-sm text-muted">{s.phone}</p></div>
              <div className="text-right"><p className="text-xs uppercase text-muted">We owe</p><p className={cn("font-bold tabular-nums", s.balance > 0 && "text-warn")}>{formatPKR(s.balance)}</p></div>
              {p.can.pay && <Button variant="secondary" className="min-h-11" onClick={() => setModal({ k: "pay", s })}>Pay</Button>}
              {p.can.manage && <Button variant="ghost" className="min-h-11" onClick={() => setModal({ k: "supplier", s })}>Edit</Button>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Purchase orders</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {p.orders.map((o) => (
            <div key={o.id} className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border px-4 py-2 last:border-0">
              <span className="w-24 font-mono font-bold">{o.no}</span><div className="min-w-40 flex-1"><p className="font-medium">{o.supplier}</p><p className="text-sm text-muted">{o.lines.map((l) => l.name).join(", ")}</p></div>
              <span className={cn("rounded-lg px-2 py-1 text-xs font-bold uppercase", STATUS[o.status])}>{o.status}</span><span className="w-28 text-right font-bold tabular-nums">{formatPKR(o.total)}</span>
              {o.status === "ordered" && p.can.manage && <><Button className="min-h-11" onClick={() => setModal({ k: "receive", po: o })}>Receive</Button><Button variant="ghost" className="min-h-11 text-danger" onClick={() => start(async () => { const r = await cancelPurchaseOrder(o.id); setMsg(r.ok ? "" : r.error); router.refresh(); })}>Cancel</Button></>}
            </div>
          ))}
          {!p.orders.length && <p className="p-8 text-center text-muted">No purchase orders yet</p>}
        </div>
      </section>

      {p.payments.length > 0 && (
        <section><h2 className="mb-2 text-lg font-semibold">Recent supplier payments</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">{p.payments.map((x) => <div key={x.id} className="flex gap-3 border-b border-border px-4 py-2 text-sm last:border-0"><span className="w-36 text-muted">{new Date(x.at).toLocaleDateString("en-GB")}</span><span className="flex-1">{x.supplier} · {x.method}{x.ref && ` · ${x.ref}`}</span><span className="tabular-nums">{formatPKR(x.amount)}</span></div>)}</div></section>
      )}

      {modal?.k === "purchase" && <PurchaseForm {...p} onClose={() => setModal(null)} onDone={done} />}
      {modal?.k === "supplier" && <SupplierForm initial={modal.s} onClose={() => setModal(null)} onDone={done} />}
      {modal?.k === "pay" && <PayForm sup={modal.s} onClose={() => setModal(null)} onDone={done} />}
      {modal?.k === "receive" && <ReceiveForm po={modal.po} onClose={() => setModal(null)} onDone={done} />}
    </div>
  );
}

function PurchaseForm({ suppliers, ingredients, units, conv, onClose, onDone }: Props & { onClose: () => void; onDone: () => void }) {
  type L = { ingredientId: string; qty: string; unitId: string; total: string; batch: string; expiry: string; freight: string; duty: string };
  const blank = (): L => ({ ingredientId: ingredients[0]?.id ?? "", qty: "", unitId: ingredients[0]?.baseUnitId ?? "", total: "", batch: "", expiry: "", freight: "", duty: "" });
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [receiveNow, setReceiveNow] = useState(true);
  const [lines, setLines] = useState<L[]>([blank()]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<L>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const num = (x: string) => (x ? Number(x) : 0);
  return (
    <Modal title="New purchase" onClose={onClose} width="max-w-3xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div><Label>Supplier</Label><select className={sel} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <label className="flex items-end gap-3 pb-3"><input type="checkbox" className="h-6 w-6" checked={receiveNow} onChange={(e) => setReceiveNow(e.target.checked)} />Goods received now (adds to stock)</label></div>
        {lines.map((l, i) => {
          const ing = ingredients.find((x) => x.id === l.ingredientId)!;
          const showBatch = receiveNow && (ing?.imported || l.batch || l.expiry);
          return (
            <div key={i} className="space-y-2 rounded-2xl bg-surface-2 p-3">
              <div className="flex gap-2">
                <select className={cn(sel, "flex-1")} value={l.ingredientId} onChange={(e) => { const n = ingredients.find((x) => x.id === e.target.value)!; set(i, { ingredientId: n.id, unitId: n.baseUnitId }); }}>{ingredients.map((x) => <option key={x.id} value={x.id}>{x.name}{x.imported ? " (imported)" : ""}</option>)}</select>
                <Input className="w-24" inputMode="decimal" placeholder="Qty" value={l.qty} onChange={(e) => set(i, { qty: e.target.value })} />
                <select className={cn(sel, "w-24")} value={l.unitId} onChange={(e) => set(i, { unitId: e.target.value })}>{unitsFor(ing.baseUnitId, units, conv).map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</select>
                <Input className="w-32" inputMode="decimal" placeholder="Total Rs" value={l.total} onChange={(e) => set(i, { total: e.target.value })} />
                {lines.length > 1 && <button className="px-2 text-danger" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={18} /></button>}
              </div>
              {receiveNow && ing?.imported && (
                <div className="grid grid-cols-4 gap-2"><Input placeholder="Batch no." value={l.batch} onChange={(e) => set(i, { batch: e.target.value })} /><Input type="date" value={l.expiry} onChange={(e) => set(i, { expiry: e.target.value })} aria-label="Expiry" />
                  <Input inputMode="decimal" placeholder="Freight Rs" value={l.freight} onChange={(e) => set(i, { freight: e.target.value })} /><Input inputMode="decimal" placeholder="Duty/customs Rs" value={l.duty} onChange={(e) => set(i, { duty: e.target.value })} /></div>
              )}
              {showBatch && !ing?.imported && <div className="grid grid-cols-2 gap-2"><Input placeholder="Batch no." value={l.batch} onChange={(e) => set(i, { batch: e.target.value })} /><Input type="date" value={l.expiry} onChange={(e) => set(i, { expiry: e.target.value })} /></div>}
            </div>
          );
        })}
        <Button variant="secondary" onClick={() => setLines([...lines, blank()])}>+ Line</Button>
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => {
          const r = await createPurchase({ supplierId, receiveNow, lines: lines.map((l) => ({ ingredientId: l.ingredientId, qty: num(l.qty), unitId: l.unitId, totalRupees: num(l.total), batchNo: l.batch || undefined, expiry: l.expiry || undefined, freightRupees: num(l.freight) || undefined, dutyRupees: num(l.duty) || undefined })) });
          if (r.ok) onDone(); else setError(r.error);
        })}>{receiveNow ? "Save & add to stock" : "Create order"}</Button>
      </div>
    </Modal>
  );
}

function ReceiveForm({ po, onClose, onDone }: { po: PO; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState<Record<string, { batchNo: string; expiry: string; freight: string; duty: string }>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const g = (id: string) => v[id] ?? { batchNo: "", expiry: "", freight: "", duty: "" };
  return (
    <Modal title={`Receive ${po.no}`} onClose={onClose} width="max-w-2xl">
      <div className="space-y-3">
        {po.lines.map((l) => (
          <div key={l.id} className="rounded-2xl bg-surface-2 p-3"><p className="mb-2 font-semibold">{l.name} · {l.qty} {l.unit} @ {formatPKR(l.unitCost)}/{l.unit}</p>
            <div className="grid grid-cols-4 gap-2"><Input placeholder={l.imported ? "Batch no. *" : "Batch no."} value={g(l.id).batchNo} onChange={(e) => setV({ ...v, [l.id]: { ...g(l.id), batchNo: e.target.value } })} />
              <Input type="date" value={g(l.id).expiry} onChange={(e) => setV({ ...v, [l.id]: { ...g(l.id), expiry: e.target.value } })} aria-label="Expiry" />
              <Input inputMode="decimal" placeholder="Freight Rs" value={g(l.id).freight} onChange={(e) => setV({ ...v, [l.id]: { ...g(l.id), freight: e.target.value } })} /><Input inputMode="decimal" placeholder="Duty Rs" value={g(l.id).duty} onChange={(e) => setV({ ...v, [l.id]: { ...g(l.id), duty: e.target.value } })} /></div></div>
        ))}
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => {
          const payload = Object.fromEntries(po.lines.map((l) => { const x = g(l.id); return [l.id, { batchNo: x.batchNo || undefined, expiry: x.expiry || undefined, freightRupees: Number(x.freight) || undefined, dutyRupees: Number(x.duty) || undefined }]; }));
          const r = await receivePurchaseOrder(po.id, payload);
          if (r.ok) onDone(); else setError(r.error);
        })}>Receive all & add to stock</Button>
      </div>
    </Modal>
  );
}

function SupplierForm({ initial, onClose, onDone }: { initial?: Sup; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ name: initial?.name ?? "", phone: initial?.phone ?? "", address: initial?.address ?? "", imp: initial?.isImporter ?? false });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title={initial ? "Edit supplier" : "New supplier"} onClose={onClose} width="max-w-md">
      <div className="space-y-3"><Input placeholder="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /><Input placeholder="Phone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /><Input placeholder="Address" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={v.imp} onChange={(e) => setV({ ...v, imp: e.target.checked })} />Importer</label>
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await saveSupplier({ id: initial?.id, name: v.name, phone: v.phone || undefined, address: v.address || undefined, isImporter: v.imp }); if (r.ok) onDone(); else setError(r.error); })}>Save</Button></div>
    </Modal>
  );
}

function PayForm({ sup, onClose, onDone }: { sup: Sup; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(Math.max(0, sup.balance) / 100));
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title={`Pay ${sup.name}`} onClose={onClose} width="max-w-md">
      <div className="space-y-3"><p className="text-sm text-muted">Balance owed: {formatPKR(sup.balance)}</p>
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        <select className={sel} value={method} onChange={(e) => setMethod(e.target.value)}>{["cash", "bank", "jazzcash", "easypaisa", "cheque"].map((m) => <option key={m} value={m}>{m}</option>)}</select>
        <Input placeholder="Reference / cheque no." value={ref} onChange={(e) => setRef(e.target.value)} />
        {method === "cash" && <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={drawer} onChange={(e) => setDrawer(e.target.checked)} />Paid from the till (needs your open POS shift)</label>}
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await paySupplier({ supplierId: sup.id, amountRupees: Number(amount), method, reference: ref || undefined, fromDrawer: drawer && method === "cash" }); if (r.ok) onDone(); else setError(r.error); })}>Record payment</Button></div>
    </Modal>
  );
}
