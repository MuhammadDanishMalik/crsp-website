"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordSadqaGiven, removeSadqaRule, saveSadqaRule } from "@/lib/actions/sadqa";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

type Day = { date: string; units: number; sales: number; amount: number; byItem: { name: string; qty: number; amount: number }[] };
type Rule = { id: string; itemId: string; name: string; price: number; percent: number; active: boolean };
type Props = {
  from: string; to: string; today: string; todaySet: number; canManage: boolean; items: { id: string; name: string }[]; rules: Rule[];
  range: { days: Day[]; given: { id: string; date: string; amount: number; note: string }[]; totalSet: number; totalGiven: number }; balance: { set: number; given: number; owed: number };
};

export function SadqaView({ from, to, today, todaySet, range, balance, rules, items, canManage }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [give, setGive] = useState(false);
  const [newItem, setNewItem] = useState(items[0]?.id ?? "");
  const [newPct, setNewPct] = useState("5");
  const [, start] = useTransition();
  const go = (f: string, t: string) => router.push(`/admin/sadqa?from=${f}&to=${t}`);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? "" : (r.error ?? "")); router.refresh(); });
  const field = "h-12 rounded-xl border border-border bg-surface px-3";
  const unruled = items.filter((i) => !rules.some((r) => r.itemId === i.id));
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold">Daily sadqa</h1>
        {canManage && <Button className="ml-auto" onClick={() => setGive(true)}>Record sadqa given</Button>}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card l="Set aside today" v={formatPKR(todaySet)} /><Card l="Set aside (selected dates)" v={formatPKR(range.totalSet)} />
        <Card l="Given (selected dates)" v={formatPKR(range.totalGiven)} /><Card l="Still to give (all time)" v={formatPKR(balance.owed)} tone={balance.owed > 0 ? "text-accent" : ""} />
      </div>
      {msg && <p className="rounded-xl bg-danger/15 p-3 text-danger">{msg}</p>}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold">Sadqa rules</h2>
        <p className="mb-3 text-sm text-muted">A percentage of the item&apos;s price (before tax) is set aside for every one sold. Changing a percentage affects only future sales.</p>
        {rules.map((r) => <RuleRow key={r.id} r={r} canManage={canManage} onSave={(p) => run(() => saveSadqaRule(r.itemId, p, r.active))} onRemove={() => run(() => removeSadqaRule(r.itemId))} />)}
        {!rules.length && <p className="text-muted">No rules yet.</p>}
        {canManage && unruled.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <select className={field} value={newItem} onChange={(e) => setNewItem(e.target.value)} aria-label="Item">{unruled.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
            <Input className="w-24" inputMode="decimal" value={newPct} onChange={(e) => setNewPct(e.target.value)} aria-label="Percent" /><span>%</span>
            <Button variant="secondary" onClick={() => run(() => saveSadqaRule(newItem || unruled[0].id, Number(newPct)))}>Add rule</Button>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="font-semibold">Day by day</h2>
          <input type="date" className={field} value={from} onChange={(e) => go(e.target.value, to)} aria-label="From" /><span>to</span>
          <input type="date" className={field} value={to} onChange={(e) => go(from, e.target.value)} aria-label="To" /></div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex gap-3 bg-surface-2 px-4 py-2 text-xs uppercase text-muted"><span className="w-28">Date</span><span className="flex-1">Items</span><span className="w-16 text-right">Units</span><span className="w-28 text-right">Sales</span><span className="w-28 text-right">Sadqa</span></div>
          {range.days.map((d) => (
            <div key={d.date} className="flex gap-3 border-t border-border px-4 py-3 text-sm">
              <span className="w-28 font-medium">{d.date}{d.date === today && <span className="ml-1 text-xs text-accent">today</span>}</span>
              <span className="flex-1 text-muted">{d.byItem.map((b) => `${b.name.replace("Chicken Injected Broast ", "")} ×${b.qty}`).join(" · ")}</span>
              <span className="w-16 text-right tabular-nums">{d.units}</span><span className="w-28 text-right tabular-nums">{formatPKR(d.sales)}</span><span className="w-28 text-right font-bold tabular-nums">{formatPKR(d.amount)}</span>
            </div>
          ))}
          {!range.days.length && <p className="p-8 text-center text-muted">No sadqa items sold in these dates.</p>}
        </div>
      </section>

      {range.given.length > 0 && (
        <section><h2 className="mb-2 font-semibold">Given out</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">{range.given.map((g) => <div key={g.id} className="flex gap-3 border-b border-border px-4 py-2 text-sm last:border-0"><span className="w-28">{g.date}</span><span className="flex-1 text-muted">{g.note}</span><span className="tabular-nums">{formatPKR(g.amount)}</span></div>)}</div></section>
      )}
      {give && <GiveForm today={today} owed={balance.owed} onClose={() => setGive(false)} onDone={() => { setGive(false); router.refresh(); }} />}
    </div>
  );
}

const Card = ({ l, v, tone = "" }: { l: string; v: string; tone?: string }) => <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className={`text-2xl font-black tabular-nums ${tone}`}>{v}</p></div>;

function RuleRow({ r, canManage, onSave, onRemove }: { r: Rule; canManage: boolean; onSave: (p: number) => void; onRemove: () => void }) {
  const [p, setP] = useState(String(r.percent));
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl bg-surface-2 p-3">
      <span className="flex-1 font-medium">{r.name}</span><span className="text-sm text-muted">Rs {r.price / 100} → <b className="text-foreground">Rs {Math.round((r.price * (Number(p) || 0)) / 100) / 100}</b> per item</span>
      <Input className="w-20" inputMode="decimal" disabled={!canManage} value={p} onChange={(e) => setP(e.target.value)} aria-label={`${r.name} percent`} /><span>%</span>
      {canManage && <><Button className="min-h-11" onClick={() => onSave(Number(p))}>Save</Button><Button variant="ghost" className="min-h-11 text-danger" onClick={onRemove}>Remove</Button></>}
    </div>
  );
}

function GiveForm({ today, owed, onClose, onDone }: { today: string; owed: number; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ date: today, amount: String(Math.max(0, owed) / 100), note: "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title="Record sadqa given" onClose={onClose} width="max-w-sm">
      <div className="space-y-3">
        <Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        <Input inputMode="decimal" placeholder="Amount (Rs)" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} autoFocus />
        <Input placeholder="Note (to whom / where)" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await recordSadqaGiven({ date: v.date, amountRupees: Number(v.amount), note: v.note || undefined }); if (r.ok) onDone(); else setError(r.error); })}>Save</Button>
      </div>
    </Modal>
  );
}
