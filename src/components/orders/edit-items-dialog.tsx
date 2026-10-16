"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { applyOrderEdit, loadOrderForEdit, previewOrderEdit, type EditChanges, type EditLine, type EditPreview } from "@/lib/actions/order-items-edit";
import { formatPKR } from "@/lib/domain/money";
import type { PosItem, PosMenu } from "@/lib/queries/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ModifierSheet } from "@/app/(pos)/order/modifier-sheet";
import { OverrideDialog } from "@/app/(pos)/order/override-dialog";
import { cn } from "@/lib/utils";

type NewLine = { key: string; itemId: string; name: string; unit: number; quantity: number; modifierIds: string[]; mods: string[] };
type PayMethod = "cash" | "card" | "jazzcash" | "easypaisa";

/** Change what is on an order that was already rung and printed: add items, change quantities, remove items. */
export function EditItemsDialog({ orderId, onClose, onDone }: { orderId: string; onClose: () => void; onDone: (r: { changes: EditChanges }) => void }) {
  const [data, setData] = useState<null | { orderNo: string; status: string; lines: EditLine[]; menu: PosMenu; blocked: string | null }>(null);
  const [loadErr, setLoadErr] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [added, setAdded] = useState<NewLine[]>([]);
  const [cat, setCat] = useState("");
  const [sheet, setSheet] = useState<PosItem | null>(null);
  const [preview, setPreview] = useState<EditPreview | null>(null);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [needManager, setNeedManager] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let on = true;
    loadOrderForEdit(orderId).then((r) => {
      if (!on) return;
      if (!r.ok) return setLoadErr(r.error);
      setData(r); setQty(Object.fromEntries(r.lines.map((l) => [l.orderItemId, l.quantity]))); setCat(r.menu.categories[0]?.id ?? "");
    });
    return () => { on = false; };
  }, [orderId]);

  const payload = useMemo(() => data ? ({
    keep: data.lines.map((l) => ({ orderItemId: l.orderItemId, quantity: qty[l.orderItemId] ?? l.quantity })),
    add: added.map((a) => ({ itemId: a.itemId, quantity: a.quantity, modifierIds: a.modifierIds })),
  }) : null, [data, qty, added]);

  useEffect(() => {
    if (!payload || data?.blocked) return;
    let on = true;
    const t = setTimeout(() => { previewOrderEdit(orderId, payload).then((r) => on && setPreview(r)); }, 250);
    return () => { on = false; clearTimeout(t); };
  }, [payload, orderId, data?.blocked]);

  const changed = !!data && (added.length > 0 || data.lines.some((l) => (qty[l.orderItemId] ?? l.quantity) !== l.quantity));
  const diff = preview?.ok ? preview.diff : 0;

  const apply = (token?: string) => start(async () => {
    if (!payload) return;
    setError("");
    const pay = diff > 0 ? { method, tendered: method === "cash" ? Math.round(Number(tendered || diff / 100) * 100) : undefined, approvalCode: method === "cash" ? undefined : code.trim() || undefined } : undefined;
    const r = await applyOrderEdit(orderId, payload, pay, token);
    if (r.ok) return onDone({ changes: r.changes ?? { added: [], removed: [] } });
    if (r.error === "Manager approval required") return setNeedManager(true);
    setError(r.error);
  });

  if (loadErr) return <Modal title="Edit items" onClose={onClose} width="max-w-md"><p className="text-danger">{loadErr}</p></Modal>;
  if (!data) return <Modal title="Edit items" onClose={onClose} width="max-w-md"><p className="text-muted">Loading…</p></Modal>;
  const items = data.menu.items.filter((i) => i.categoryId === cat);

  return (
    <Modal title={`Edit items · #${data.orderNo}`} onClose={onClose} width="max-w-5xl">
      {data.blocked ? <p className="rounded-xl bg-warn/15 p-4 text-warn">{data.blocked}</p> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div>
            <h3 className="mb-2 font-semibold">On this order</h3>
            <div className="space-y-2">
              {data.lines.map((l) => {
                const q = qty[l.orderItemId] ?? l.quantity;
                return (
                  <div key={l.orderItemId} className={cn("rounded-xl bg-surface-2 p-3", q === 0 && "opacity-50")}>
                    <div className="flex justify-between"><span className={cn("font-semibold", q === 0 && "line-through")}>{l.name}</span><span className="tabular-nums">{formatPKR(l.unitPrice * q)}</span></div>
                    {l.mods.map((m) => <p key={m} className="ml-3 text-xs text-muted">+ {m}</p>)}
                    <div className="mt-2 flex items-center gap-2">
                      <button aria-label="Less" className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface" onClick={() => setQty({ ...qty, [l.orderItemId]: Math.max(0, q - 1) })}><Minus size={16} /></button>
                      <span className="w-8 text-center text-lg font-bold">{q}</span>
                      <button aria-label="More" className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface" onClick={() => setQty({ ...qty, [l.orderItemId]: Math.min(99, q + 1) })}><Plus size={16} /></button>
                      <button aria-label="Remove item" className="ml-auto flex h-11 items-center gap-1 rounded-lg px-3 text-danger hover:bg-surface" onClick={() => setQty({ ...qty, [l.orderItemId]: 0 })}><Trash2 size={16} />Remove</button>
                    </div>
                  </div>
                );
              })}
              {added.map((a) => (
                <div key={a.key} className="rounded-xl border border-success/40 bg-success/10 p-3">
                  <div className="flex justify-between"><span className="font-semibold">+ {a.name}</span><span className="tabular-nums">{formatPKR(a.unit * a.quantity)}</span></div>
                  {a.mods.map((m) => <p key={m} className="ml-3 text-xs text-muted">+ {m}</p>)}
                  <div className="mt-2 flex items-center gap-2">
                    <button aria-label="Less" className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface" onClick={() => setAdded(added.map((x) => x.key === a.key ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}><Minus size={16} /></button>
                    <span className="w-8 text-center text-lg font-bold">{a.quantity}</span>
                    <button aria-label="More" className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface" onClick={() => setAdded(added.map((x) => x.key === a.key ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x))}><Plus size={16} /></button>
                    <button className="ml-auto flex h-11 items-center gap-1 rounded-lg px-3 text-danger hover:bg-surface" onClick={() => setAdded(added.filter((x) => x.key !== a.key))}><Trash2 size={16} />Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Add items</h3>
            <div className="mb-2 flex flex-wrap gap-1">{data.menu.categories.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={cn("h-11 rounded-xl px-3 text-sm font-semibold", cat === c.id ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted")}>{c.name}</button>)}</div>
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
              {items.map((i) => (
                <button key={i.id} disabled={!i.available} onClick={() => i.groups.length ? setSheet(i) : setAdded([...added, { key: crypto.randomUUID(), itemId: i.id, name: i.name, unit: i.price, quantity: 1, modifierIds: [], mods: [] }])}
                  className="min-h-16 rounded-xl border border-border bg-surface p-2 text-left disabled:opacity-40"><span className="block text-sm font-semibold leading-tight">{i.name}</span><span className="text-sm font-bold text-accent">{formatPKR(i.price)}</span></button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-surface-2 p-4">
              {preview && !preview.ok && <p className="text-danger">{preview.error}</p>}
              {preview?.ok && (<>
                <div className="flex justify-between text-sm text-muted"><span>Was</span><span className="tabular-nums">{formatPKR(preview.oldTotal)}</span></div>
                <div className="flex justify-between text-lg font-black"><span>New total</span><span className="tabular-nums">{formatPKR(preview.newTotal)}</span></div>
                {preview.cod ? <p className="mt-1 text-sm text-muted">Cash on delivery: the rider will collect the new total.</p>
                  : diff > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="font-bold text-accent">Customer pays {formatPKR(diff)} more</p>
                      <div className="flex gap-1">{(["cash", "card", "jazzcash", "easypaisa"] as const).map((m) => <button key={m} onClick={() => setMethod(m)} className={cn("h-11 flex-1 rounded-lg border-2 text-sm font-semibold capitalize", method === m ? "border-brand bg-brand/15" : "border-border")}>{m}</button>)}</div>
                      {method === "cash" ? <Input inputMode="decimal" placeholder={`Cash received (Rs ${diff / 100})`} value={tendered} onChange={(e) => setTendered(e.target.value)} /> : <Input placeholder="Terminal approval / transaction ID" value={code} onChange={(e) => setCode(e.target.value)} />}
                    </div>
                  ) : diff < 0 ? <p className="mt-2 font-bold text-success">Give back {formatPKR(-diff)} to the customer ({preview.refundMethod?.replace("_", " ")})</p>
                  : <p className="mt-2 text-sm text-muted">No change in the amount.</p>}
              </>)}
              {error && <p className="mt-2 text-danger">{error}</p>}
              <Button size="xl" className="mt-3 w-full" disabled={pending || !changed || !preview?.ok} onClick={() => apply()}>{pending ? "Saving…" : preview?.ok && preview.needsApproval ? "Save changes (manager PIN)" : "Save changes"}</Button>
              <p className="mt-2 text-xs text-muted">The kitchen gets a change slip (what to add / stop) and the customer receipt prints again.</p>
            </div>
          </div>
        </div>
      )}
      {sheet && <ModifierSheet item={sheet} onClose={() => setSheet(null)} onAdd={(mods, q) => { setAdded([...added, { key: crypto.randomUUID(), itemId: sheet.id, name: sheet.name, unit: sheet.price + mods.reduce((a, m) => a + m.priceDelta, 0), quantity: q, modifierIds: mods.map((m) => m.id), mods: mods.map((m) => m.name) }]); setSheet(null); }} />}
      {needManager && <OverrideDialog permission="order.edit_sent" title="Changing a printed order needs manager approval" onClose={() => setNeedManager(false)} onApproved={(t) => { setNeedManager(false); apply(t); }} />}
    </Modal>
  );
}
