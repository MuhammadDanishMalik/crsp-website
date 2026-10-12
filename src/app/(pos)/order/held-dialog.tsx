"use client";
import { useEffect, useState, useTransition } from "react";
import { discardHeld, listHeld, moveTable, recallHeld, type HeldOrder } from "@/lib/actions/hold";
import { useCart, type OrderType } from "@/lib/stores/cart";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { PosMenu } from "@/lib/queries/menu";

/** Held orders: recall one or several (merges into the current cart), move table, or discard. */
export function HeldDialog({ menu, canMove, onClose }: { menu: PosMenu; canMove: boolean; onClose: () => void }) {
  const cart = useCart();
  const [list, setList] = useState<HeldOrder[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const reload = () => listHeld().then(setList);
  useEffect(() => { let on = true; listHeld().then((l) => on && setList(l)); return () => { on = false; }; }, []);

  const recall = () =>
    start(async () => {
      const skipped: string[] = [];
      for (const id of picked) {
        const r = await recallHeld(id);
        if (!r.ok) { setMsg(r.error); continue; }
        const o = r.order;
        for (const l of o.lines) {
          const item = menu.items.find((i) => i.id === l.itemId);
          if (!item || !item.available) { skipped.push(item?.name ?? "an item"); continue; }
          const all = item.groups.flatMap((g) => g.modifiers);
          cart.add({ itemId: item.id, name: item.name, basePrice: item.price, quantity: l.quantity, note: l.note ?? undefined, modifiers: l.modifierIds.map((mid) => all.find((m) => m.id === mid)).filter((m): m is NonNullable<typeof m> => !!m).map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta })) });
        }
        cart.set({ orderType: o.type as OrderType, tableNo: o.tableNo ?? cart.tableNo, customerPhone: o.customerPhone || cart.customerPhone, customerName: o.customerName || cart.customerName, deliveryAddress: o.deliveryAddress || cart.deliveryAddress, deliveryZoneId: o.deliveryZoneId ?? cart.deliveryZoneId, aggregatorName: o.aggregatorName || cart.aggregatorName });
      }
      if (skipped.length) alert(`Not added (sold out or removed): ${skipped.join(", ")}`);
      onClose();
    });

  return (
    <Modal title="Held orders" onClose={onClose} width="max-w-2xl">
      {list === null && <p className="text-muted">Loading…</p>}
      {list?.length === 0 && <p className="py-8 text-center text-muted">No held orders</p>}
      <div className="space-y-2">
        {list?.map((h) => (
          <div key={h.id} className={`rounded-2xl border-2 p-3 ${picked.includes(h.id) ? "border-brand bg-brand/10" : "border-border bg-surface-2"}`}>
            <button className="block w-full text-left" onClick={() => setPicked((p) => (p.includes(h.id) ? p.filter((x) => x !== h.id) : [...p, h.id]))}>
              <div className="flex justify-between font-semibold"><span>{h.ref} · {h.type.replace("_", " ")}{h.tableNo ? ` · Table ${h.tableNo}` : ""}</span><span className="text-sm text-muted">{h.by} · {new Date(h.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <p className="truncate text-sm text-muted">{h.count} items — {h.summary}</p>
            </button>
            <div className="mt-2 flex gap-2">
              {canMove && <Button variant="secondary" className="min-h-12" onClick={() => { const t = prompt("Move to table number"); if (t) start(async () => { const r = await moveTable(h.id, t); setMsg(r.ok ? "" : r.error); await reload(); }); }}>Move table</Button>}
              <Button variant="ghost" className="min-h-12 text-danger" onClick={() => confirm("Discard this held order?") && start(async () => { await discardHeld(h.id); setPicked((p) => p.filter((x) => x !== h.id)); await reload(); })}>Discard</Button>
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="mt-2 text-danger">{msg}</p>}
      <Button size="xl" className="mt-4 w-full" disabled={!picked.length || pending} onClick={recall}>
        {picked.length > 1 ? `Merge & recall ${picked.length} orders` : "Recall order"}
      </Button>
    </Modal>
  );
}
