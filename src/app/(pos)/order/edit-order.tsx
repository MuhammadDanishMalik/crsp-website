"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { applyOrderEdit, previewOrderEdit, type EditPreview } from "@/lib/actions/order-items-edit";
import { useCart } from "@/lib/stores/cart";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OverrideDialog } from "./override-dialog";
import { printReceipt } from "./pay-dialog";
import { cn } from "@/lib/utils";

type PayMethod = "cash" | "card" | "jazzcash" | "easypaisa";

/** The order being edited: its existing lines, listed above the items added now (those use the normal menu + cart). */
export function EditLines() {
  const cart = useCart();
  const e = cart.edit;
  if (!e) return null;
  return (
    <>
      <p className="px-1 pt-1 text-xs font-bold uppercase tracking-wider text-muted">On order #{e.orderNo}</p>
      {e.lines.map((l) => {
        const q = e.qty[l.orderItemId] ?? l.quantity;
        return (
          <div key={l.orderItemId} className={cn("rounded-2xl bg-surface-2 p-3", q === 0 && "opacity-50")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p dir="auto" className={cn("font-semibold leading-tight", q === 0 && "line-through")}>{l.name}</p>
                {l.mods.map((m) => <p key={m} className="ml-3 text-sm text-muted">+ {m}</p>)}
                {l.note && <p className="ml-3 text-sm italic text-accent">“{l.note}”</p>}
              </div>
              <p className="font-bold tabular-nums">{formatPKR(l.unitPrice * q)}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button aria-label="Decrease" className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface" onClick={() => cart.setEditQty(l.orderItemId, q - 1)}><Minus size={18} /></button>
              <span className="w-8 text-center text-lg font-bold">{q}</span>
              <button aria-label="Increase" className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface" onClick={() => cart.setEditQty(l.orderItemId, q + 1)}><Plus size={18} /></button>
              {q > 0 && <button className="ml-auto h-12 rounded-xl px-3 text-sm text-danger hover:bg-surface" onClick={() => cart.setEditQty(l.orderItemId, 0)}>Remove</button>}
            </div>
          </div>
        );
      })}
      {cart.lines.length > 0 && <p className="px-1 pt-2 text-xs font-bold uppercase tracking-wider text-success">Added now</p>}
    </>
  );
}

/** Totals + "Update order" for an order being edited. Same rules as the old edit window: the kitchen gets a change slip, extra money is collected, a smaller bill gives money back. */
export function EditFooter({ onDone }: { onDone: (msg: string) => void }) {
  const cart = useCart();
  const router = useRouter();
  const e = cart.edit!;
  const [preview, setPreview] = useState<EditPreview | null>(null);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [needManager, setNeedManager] = useState(false);
  const [pending, start] = useTransition();

  const payload = useMemo(() => ({
    keep: e.lines.map((l) => ({ orderItemId: l.orderItemId, quantity: e.qty[l.orderItemId] ?? l.quantity })),
    add: cart.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, modifierIds: l.modifiers.map((m) => m.id), note: l.note || undefined })),
  }), [e.lines, e.qty, cart.lines]);
  const changed = cart.lines.length > 0 || e.lines.some((l) => (e.qty[l.orderItemId] ?? l.quantity) !== l.quantity);

  useEffect(() => {
    let on = true;
    const t = setTimeout(() => { previewOrderEdit(e.orderId, payload).then((r) => on && setPreview(r)); }, 250);
    return () => { on = false; clearTimeout(t); };
  }, [payload, e.orderId]);

  const diff = preview?.ok ? preview.diff : 0;
  const apply = (token?: string) => start(async () => {
    setError("");
    const pay = diff > 0 ? { method, tendered: method === "cash" ? Math.round(Number(tendered || diff / 100) * 100) : undefined, approvalCode: method === "cash" ? undefined : code.trim() || undefined } : undefined;
    const r = await applyOrderEdit(e.orderId, payload, pay, token);
    if (!r.ok) { if (r.error === "Manager approval required") return setNeedManager(true); return setError(r.error); }
    let msg = `Order #${e.orderNo} updated`;
    try { const pm = await printReceipt(e.orderId, false, r.changes ?? { added: [], removed: [] }); if (pm) msg = pm; } catch { msg += " (printing failed)"; }
    cart.clear(); router.refresh(); onDone(msg);
  });

  return (
    <div className="space-y-1 border-t border-border p-4 pb-14 text-base">
      {preview && !preview.ok && <p className="text-danger">{preview.error}</p>}
      {preview?.ok && (<>
        <div className="flex justify-between text-sm text-muted"><span>Was</span><span className="tabular-nums">{formatPKR(preview.oldTotal)}</span></div>
        <div className="flex items-center justify-between text-2xl font-black"><span>New total</span><span className="tabular-nums">{formatPKR(preview.newTotal)}</span></div>
        {preview.cod ? <p className="text-sm text-muted">Cash on delivery: the rider collects the new total.</p>
          : diff > 0 ? (
            <div className="space-y-2 pt-1">
              <p className="font-bold text-accent">Customer pays {formatPKR(diff)} more</p>
              <div className="flex gap-1">{(["cash", "card", "jazzcash", "easypaisa"] as const).map((m) => <button key={m} onClick={() => setMethod(m)} className={cn("h-11 flex-1 rounded-lg border-2 text-xs font-semibold capitalize", method === m ? "border-brand bg-brand/15" : "border-border bg-surface-2")}>{m}</button>)}</div>
              {method === "cash" ? <Input inputMode="decimal" placeholder={`Cash received (Rs ${diff / 100})`} value={tendered} onChange={(x) => setTendered(x.target.value)} /> : <Input placeholder="Terminal approval / transaction ID" value={code} onChange={(x) => setCode(x.target.value)} />}
            </div>
          ) : diff < 0 ? <p className="font-bold text-success">Give back {formatPKR(-diff)} ({preview.refundMethod?.replace("_", " ")})</p>
          : <p className="text-sm text-muted">No change in the amount.</p>}
      </>)}
      {error && <p className="text-danger">{error}</p>}
      <Button variant="success" size="xl" className="mt-2 w-full text-xl" disabled={pending || !changed || !preview?.ok} onClick={() => apply()}>
        {pending ? "Saving…" : preview?.ok && preview.needsApproval ? "Update order (manager PIN)" : "Update order"}
      </Button>
      <p className="text-xs text-muted">The kitchen gets a change slip (what to add / stop) and the receipt prints again.</p>
      {needManager && <OverrideDialog permission="order.edit_sent" title="Changing a printed order needs manager approval" onClose={() => setNeedManager(false)} onApproved={(t) => { setNeedManager(false); apply(t); }} />}
    </div>
  );
}
