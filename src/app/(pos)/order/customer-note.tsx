"use client";
import { useState, useTransition } from "react";
import { saveCustomerNote } from "@/lib/actions/customers-admin";
import { useCart } from "@/lib/stores/cart";

/** The saved note of a known customer, shown to the cashier when the phone number is typed (and editable right there). */
export function CustomerNoteBox() {
  const cart = useCart();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (!cart.customerId) return null;
  const save = () => start(async () => {
    const r = await saveCustomerNote(cart.customerId, text);
    if (!r.ok) return setMsg(r.error);
    cart.set({ customerNote: text.trim() }); setEditing(false); setMsg("");
  });
  if (editing) {
    return (
      <div className="mt-2 rounded-xl border border-warn/50 bg-warn/10 p-2">
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={2} placeholder="e.g. no onions, call before arriving"
          className="w-full rounded-lg bg-surface p-2 text-sm outline-none" />
        <div className="mt-1 flex items-center gap-2">
          <button type="button" disabled={pending} onClick={save} className="h-9 rounded-lg bg-brand px-4 text-sm font-bold text-brand-fg">{pending ? "Saving…" : "Save note"}</button>
          <button type="button" onClick={() => { setEditing(false); setMsg(""); }} className="h-9 px-3 text-sm text-muted">Cancel</button>
          {msg && <span className="text-sm text-danger">{msg}</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 flex items-start gap-2 rounded-xl border border-warn/50 bg-warn/10 px-3 py-2 text-sm">
      <span>📝</span>
      <p className="min-w-0 flex-1">{cart.customerNote ? <><b>Customer note:</b> {cart.customerNote}</> : <span className="text-muted">No note for this customer</span>}</p>
      <button type="button" onClick={() => { setText(cart.customerNote); setEditing(true); }} className="shrink-0 font-semibold underline">{cart.customerNote ? "Edit" : "Add note"}</button>
    </div>
  );
}
