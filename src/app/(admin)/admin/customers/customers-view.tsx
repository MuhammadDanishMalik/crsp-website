"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { adjustPoints, saveCustomer } from "@/lib/actions/customers-admin";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

type C = { id: string; name: string; phone: string; notes: string; points: number; isCorporate: boolean; credit: number; orders: number; spend: number; last: string; history: { no: string; date: string; total: number; type: string }[]; addresses: string[]; ledger: { at: string; points: number; reason: string }[] };

export function CustomersView({ customers, q, can }: { customers: C[]; q: string; can: { manage: boolean; adjust: boolean } }) {
  const router = useRouter();
  const [open, setOpen] = useState<C | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-center gap-3"><h1 className="text-3xl font-bold">Customers</h1>
        <form action="/admin/customers" className="ml-4"><Input name="q" defaultValue={q} placeholder="Search name or phone" className="w-64" /></form>
        {can.manage && <Button className="ml-auto" onClick={() => setAdding(true)}><Plus size={18} />Add customer</Button>}</div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {customers.map((c) => (
          <button key={c.id} onClick={() => setOpen(c)} className="flex min-h-16 w-full items-center gap-3 border-b border-border px-4 text-left last:border-0 hover:bg-surface-2">
            <div className="min-w-0 flex-1"><p className="font-semibold">{c.name || "—"} {c.isCorporate && <span className="ml-1 rounded bg-accent/20 px-2 py-0.5 text-xs font-bold">CORPORATE</span>}</p><p className="text-sm text-muted">{c.phone}</p></div>
            <span className="w-16 text-right tabular-nums text-sm">{c.orders} orders</span><span className="w-28 text-right tabular-nums">{formatPKR(c.spend)}</span><span className="w-20 text-right text-sm font-semibold text-accent">{c.points} pts</span>
          </button>
        ))}
        {!customers.length && <p className="p-10 text-center text-muted">No customers found. They are added automatically when an order has a phone number.</p>}
      </div>
      {open && <Detail c={open} can={can} onClose={() => setOpen(null)} onDone={() => { setOpen(null); router.refresh(); }} />}
      {adding && <Edit onClose={() => setAdding(false)} onDone={() => { setAdding(false); router.refresh(); }} />}
    </div>
  );
}

function Detail({ c, can, onClose, onDone }: { c: C; can: { manage: boolean; adjust: boolean }; onClose: () => void; onDone: () => void }) {
  const [pts, setPts] = useState("");
  const [why, setWhy] = useState("");
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (edit) return <Edit c={c} onClose={onClose} onDone={onDone} />;
  return (
    <Modal title={c.name || c.phone} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center"><Stat l="Orders" v={String(c.orders)} /><Stat l="Spend" v={formatPKR(c.spend)} /><Stat l="Points" v={String(c.points)} /></div>
        <p className="text-sm text-muted">{c.phone}{c.last && ` · last order ${c.last}`}</p>
        {c.notes && <p className="rounded-xl bg-surface-2 p-3 text-sm">{c.notes}</p>}
        {c.addresses.length > 0 && <div><p className="mb-1 text-sm font-semibold text-muted">Addresses</p>{c.addresses.map((a) => <p key={a} className="text-sm">{a}</p>)}</div>}
        {c.history.length > 0 && <div><p className="mb-1 text-sm font-semibold text-muted">Recent orders</p>{c.history.map((o) => <p key={o.no + o.date} className="flex justify-between text-sm"><span>{o.date} · #{o.no} · {o.type.replace("_", " ")}</span><span className="tabular-nums">{formatPKR(o.total)}</span></p>)}</div>}
        {c.ledger.length > 0 && <div><p className="mb-1 text-sm font-semibold text-muted">Points history</p>{c.ledger.map((l, i) => <p key={i} className="flex justify-between text-sm"><span>{new Date(l.at).toLocaleDateString("en-GB")} · {l.reason}</span><span className={l.points > 0 ? "text-success" : "text-danger"}>{l.points > 0 ? "+" : ""}{l.points}</span></p>)}</div>}
        {can.adjust && (
          <div className="rounded-2xl border border-border p-3"><p className="mb-2 text-sm font-semibold">Adjust points</p>
            <div className="flex gap-2"><Input className="w-28" inputMode="numeric" placeholder="+50 / -20" value={pts} onChange={(e) => setPts(e.target.value)} /><Input placeholder="Reason" value={why} onChange={(e) => setWhy(e.target.value)} />
              <Button disabled={pending} onClick={() => start(async () => { const r = await adjustPoints(c.id, Number(pts), why); if (r.ok) onDone(); else setError(r.error); })}>Apply</Button></div>
            {error && <p className="mt-2 text-danger">{error}</p>}</div>
        )}
        {can.manage && <Button variant="secondary" className="w-full" onClick={() => setEdit(true)}>Edit details</Button>}
      </div>
    </Modal>
  );
}
const Stat = ({ l, v }: { l: string; v: string }) => <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs uppercase text-muted">{l}</p><p className="text-xl font-bold tabular-nums">{v}</p></div>;

function Edit({ c, onClose, onDone }: { c?: C; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ phone: c?.phone ?? "", name: c?.name ?? "", notes: c?.notes ?? "", corp: c?.isCorporate ?? false, credit: String((c?.credit ?? 0) / 100) });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title={c ? "Edit customer" : "New customer"} onClose={onClose} width="max-w-md">
      <div className="space-y-3">
        <div><Label>Phone</Label><Input inputMode="tel" disabled={!!c} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
        <div><Label>Name</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div><Label>Notes</Label><Input value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={v.corp} onChange={(e) => setV({ ...v, corp: e.target.checked })} />Corporate account</label>
        {v.corp && <div><Label>Credit limit (Rs)</Label><Input inputMode="decimal" value={v.credit} onChange={(e) => setV({ ...v, credit: e.target.value })} /></div>}
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await saveCustomer({ id: c?.id, phone: v.phone, name: v.name || undefined, notes: v.notes || undefined, isCorporate: v.corp, creditLimitRupees: Number(v.credit) || 0 }); if (r.ok) onDone(); else setError(r.error); })}>Save</Button>
      </div>
    </Modal>
  );
}
