"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BellRing, MapPin, Phone, Printer, User } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { decideWebsiteOrder, listWebsiteOrders, type WebsiteOrderRow } from "@/lib/actions/website-orders";
import { useBranchEvents } from "@/lib/realtime/use-events";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatPKR } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import { printReceipt } from "./pay-dialog";

function beep() {
  try {
    const ctx = new AudioContext();
    [880, 1175, 880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.22); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
      o.start(ctx.currentTime + i * 0.22); o.stop(ctx.currentTime + i * 0.22 + 0.21);
    });
  } catch { /* audio is blocked until the first tap */ }
}

const phoneForWa = (p: string) => { const d = p.replace(/\D/g, ""); return d.startsWith("92") ? d : d.startsWith("0") ? `92${d.slice(1)}` : d; };

/** POS "Website" tab: orders from the website wait here until the kitchen accepts them; a sound rings for every new one. */
export function WebsiteTab() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<WebsiteOrderRow[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [error, setError] = useState("");
  const [busy, startBusy] = useTransition();
  const [msg, setMsg] = useState("");
  const lastNew = useRef(0);

  const refresh = useCallback(async () => {
    const r = await listWebsiteOrders();
    if (!r.ok) return setError(r.error);
    setError(""); setRows(r.rows); setNewCount(r.newCount);
    if (r.newCount > lastNew.current) beep();
    lastNew.current = r.newCount;
  }, []);
  useBranchEvents(() => { void refresh(); }, 8_000);
  useEffect(() => { void refresh(); }, [refresh]);
  // keep ringing every 20 s while an order is still waiting
  useEffect(() => { if (!newCount) return; const t = setInterval(beep, 20_000); return () => clearInterval(t); }, [newCount]);

  const decide = (id: string, d: "accept" | "reject") => startBusy(async () => {
    const r = await decideWebsiteOrder(id, d);
    setMsg(r.ok ? (d === "accept" ? "Accepted: it is now on the kitchen screen" : "Order rejected") : r.error);
    await refresh();
  });
  const print = (id: string) => startBusy(async () => { setMsg((await printReceipt(id, true)) || "Printing…"); });

  return (
    <>
      <button onClick={() => { setOpen(true); beep(); }} className={cn("relative flex h-12 items-center gap-2 rounded-xl px-4 font-semibold transition", newCount ? "animate-pulse bg-danger text-white" : "text-muted hover:text-foreground")}>
        <BellRing size={18} />Website
        {newCount > 0 && <span className="rounded-full bg-white px-2 text-sm font-black text-danger">{newCount}</span>}
      </button>
      {open && (
        <Modal title="Website orders" onClose={() => setOpen(false)} width="max-w-3xl">
          {error && <p className="mb-3 text-danger">{error}</p>}
          {msg && <p className="mb-3 rounded-xl bg-accent/15 p-3 text-sm font-semibold">{msg}</p>}
          {!rows.length && <p className="py-12 text-center text-lg text-muted">No website orders in the last 24 hours</p>}
          <div className="space-y-4">
            {rows.map((o) => (
              <div key={o.orderId} className={cn("rounded-2xl border-2 p-4", o.state === "new" ? "border-danger bg-danger/5" : o.state === "accepted" ? "border-success/50" : "border-border opacity-60")}>
                <div className="flex items-center justify-between gap-3">
                  <div><span className="text-2xl font-black">#{o.orderNo}</span><span className="ml-2 text-sm text-muted">{new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
                  <span className={cn("rounded-lg px-2.5 py-1 text-xs font-bold uppercase", o.state === "new" ? "bg-danger text-white" : o.state === "accepted" ? "bg-success/20 text-success" : "bg-surface-2 text-muted")}>{o.state === "new" ? "New — waiting" : o.state}</span>
                  <span className="text-xl font-black tabular-nums">{formatPKR(o.total)}</span>
                </div>
                <ul className="mt-3 space-y-1">
                  {o.items.map((i, k) => (
                    <li key={k}><span className="font-bold">{i.qty}× {i.name}</span>{i.mods.length > 0 && <span className="text-sm text-muted"> — {i.mods.join(", ")}</span>}{i.note && <span className="block pl-4 text-sm font-semibold text-accent">“{i.note}”</span>}</li>
                  ))}
                </ul>
                <div className="mt-3 space-y-2 rounded-xl bg-surface-2 p-3 text-sm">
                  <p className="flex items-center gap-1.5 text-base"><User size={16} className="shrink-0" /><b>{o.customerName || "Name not saved"}</b></p>
                  <p className="flex items-start gap-1.5"><MapPin size={16} className="mt-0.5 shrink-0" />{o.address || "Address not saved"}</p>
                  {o.mapsUrl && <a href={o.mapsUrl} target="_blank" rel="noreferrer" className="inline-block font-semibold text-brand underline">Open customer location on map</a>}
                  {o.note && <p className="text-muted">Note: {o.note}</p>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <a href={`tel:${o.phone}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-surface font-semibold"><Phone size={18} />Call {o.phone}</a>
                    <a href={`https://wa.me/${phoneForWa(o.whatsapp)}?text=${encodeURIComponent(`Assalam o Alaikum ${o.customerName || ""}, CRSP se aap ka website order #${o.orderNo} mila hai.`)}`} target="_blank" rel="noreferrer"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-white"><WhatsAppIcon size={22} />Chat on WhatsApp · {o.whatsapp}</a>
                  </div>
                </div>
                {o.state === "new" && (
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <Button variant="success" size="lg" disabled={busy} onClick={() => decide(o.orderId, "accept")}>Accept order</Button>
                    <Button variant="danger" size="lg" disabled={busy} onClick={() => { if (confirm(`Reject website order #${o.orderNo}?`)) decide(o.orderId, "reject"); }}>Reject</Button>
                  </div>
                )}
                {o.state === "accepted" && <Button variant="secondary" size="lg" className="mt-3 w-full" disabled={busy} onClick={() => print(o.orderId)}><Printer size={18} />Print delivery receipt</Button>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
