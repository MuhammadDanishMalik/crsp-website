"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Crown, Medal, Plus, Award } from "lucide-react";
import { adjustPoints, saveCustomer, saveCustomerNote } from "@/lib/actions/customers-admin";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

type C = { address: string; id: string; name: string; phone: string; notes: string; points: number; isCorporate: boolean; credit: number; orders: number; spend: number; last: string; history: { no: string; date: string; total: number; type: string }[]; addresses: string[]; ledger: { at: string; points: number; reason: string }[] };

/** Three loyalty levels from the number of orders. */
const LEVELS = [
  { min: 10, name: "Gold VIP", range: "10+ orders", Icon: Crown, pill: "bg-gradient-to-r from-yellow-300 to-amber-400 text-black", card: "border-amber-400/60", avatar: "bg-amber-400/20 text-amber-300", b1: "#422006", b2: "#ffffff" },
  { min: 5, name: "Silver Regular", range: "5–9 orders", Icon: Medal, pill: "bg-gradient-to-r from-slate-200 to-slate-400 text-slate-900", card: "border-slate-400/50", avatar: "bg-slate-400/20 text-slate-200", b1: "#0f172a", b2: "#ffffff" },
  { min: 2, name: "Bronze Friend", range: "2–4 orders", Icon: Award, pill: "bg-gradient-to-r from-orange-500 to-amber-700 text-white", card: "border-orange-500/40", avatar: "bg-orange-500/20 text-orange-300", b1: "#ffffff", b2: "#451a03" },
] as const;
const levelOf = (n: number) => LEVELS.find((l) => n >= l.min) ?? null;

export function CustomersView({ customers, q, view, totals, can }: { customers: C[]; q: string; view: "all" | "repeat"; totals: { all: number; repeat: number }; can: { manage: boolean; adjust: boolean } }) {
  const router = useRouter();
  const [open, setOpen] = useState<C | null>(null);
  const [adding, setAdding] = useState(false);
  const [noteFor, setNoteFor] = useState<C | null>(null);
  return (
    <div className="max-w-[1500px]">
      <div className="mb-4 flex items-center gap-3"><h1 className="text-3xl font-bold">Customers</h1>
        <form action="/admin/customers" className="ml-4"><Input name="q" defaultValue={q} placeholder="Search name or phone" className="w-64" /></form>
        {can.manage && <Button className="ml-auto" onClick={() => setAdding(true)}><Plus size={18} />Add customer</Button>}</div>
      <div className="mb-3 flex flex-wrap gap-2">
        {([["repeat", `Repeat customers (${totals.repeat})`], ["all", `All customers (${totals.all})`]] as const).map(([k, label]) => (
          <a key={k} href={`/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), view: k })}`}
            className={`flex h-11 items-center rounded-xl px-4 font-semibold ${view === k ? "bg-brand text-brand-fg" : "border border-border bg-surface hover:bg-surface-2"}`}>{label}</a>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {[...LEVELS].reverse().map((l) => <span key={l.name} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${l.pill}`}><l.Icon size={13} /><span className={l.min >= 10 ? "badge-text" : ""} style={{ "--b1": l.b1, "--b2": l.b2 } as React.CSSProperties}>{l.name}</span> <span className="font-semibold opacity-80">· {l.range}</span></span>)}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-3">
        {customers.map((c) => {
          const lv = levelOf(c.orders);
          return (
            <div key={c.id} className={`flex flex-col rounded-2xl border bg-surface p-3.5 ${lv ? lv.card : "border-border"}`}>
              <button onClick={() => setOpen(c)} className="flex min-w-0 items-start gap-3 text-left">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-black ${lv ? lv.avatar : "bg-brand/15 text-brand"}`}>{(c.name || c.phone).trim().charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold leading-tight">{c.name || "—"}</p>
                  <p className="text-sm text-muted">{c.phone}</p>
                </div>
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {lv && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ${lv.pill}`}><lv.Icon size={12} /><span className={lv.min >= 10 ? "badge-text" : ""} style={{ "--b1": lv.b1, "--b2": lv.b2 } as React.CSSProperties}>{lv.name}</span></span>}
                {c.isCorporate && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold">CORPORATE</span>}
              </div>
              {c.address && <p className="mt-2 line-clamp-2 text-sm text-muted">📍 {c.address}</p>}
              {c.last && <p className="mt-1 text-xs text-muted">Last order {c.last}</p>}
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 py-2 text-center">
                <Metric l="Orders" v={String(c.orders)} /><Metric l="Spent" v={formatPKR(c.spend)} /><Metric l="Points" v={String(c.points)} cls="text-accent" />
              </div>
              <div className="mt-auto pt-3">
                {c.notes && <p className="mb-2 line-clamp-2 rounded-lg bg-warn/10 px-2.5 py-1.5 text-sm">📝 {c.notes}</p>}
                {can.manage && <button onClick={() => setNoteFor(c)} className="h-9 w-full rounded-lg border border-border text-sm font-semibold hover:bg-surface-2">{c.notes ? "Edit note" : "+ Note"}</button>}
              </div>
            </div>
          );
        })}
        {!customers.length && <p className="col-span-full rounded-2xl border border-border bg-surface p-10 text-center text-muted">{view === "repeat" ? "No repeat customers yet (customers with 2 or more orders appear here)." : "No customers found. They are added automatically when an order has a phone number."}</p>}
      </div>
      {noteFor && <NoteDialog c={noteFor} onClose={() => setNoteFor(null)} onDone={() => { setNoteFor(null); router.refresh(); }} />}
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

const Metric = ({ l, v, cls = "" }: { l: string; v: string; cls?: string }) => (
  <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{l}</p><p className={`text-sm font-bold tabular-nums ${cls}`}>{v}</p></div>
);

/** Quick note on a customer: it shows on the till the next time this phone number is entered. */
function NoteDialog({ c, onClose, onDone }: { c: C; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState(c.notes);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title={`Note · ${c.name || c.phone}`} onClose={onClose} width="max-w-md">
      <p className="mb-2 text-sm text-muted">This note appears on the POS whenever this customer orders again.</p>
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={4} placeholder="e.g. no onions, extra spicy, call before arriving"
        className="w-full rounded-xl border border-border bg-surface-2 p-3 outline-none focus:border-brand" />
      {err && <p className="mt-1 text-danger">{err}</p>}
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" disabled={pending} onClick={() => start(async () => { const r = await saveCustomerNote(c.id, text); if (r.ok) onDone(); else setErr(r.error); })}>{pending ? "Saving…" : "Save note"}</Button>
        {c.notes && <Button variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await saveCustomerNote(c.id, ""); if (r.ok) onDone(); else setErr(r.error); })}>Remove note</Button>}
      </div>
    </Modal>
  );
}
