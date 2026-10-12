"use client";
import { useState, useTransition } from "react";
import { lookupCustomer } from "@/lib/actions/customers";
import { useCart } from "@/lib/stores/cart";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { PosMenu } from "@/lib/queries/menu";
import { formatPKR } from "@/lib/domain/money";

/** Extra details required by the order type (table, delivery address, aggregator…). */
export function OrderFieldsDialog({ menu, onClose }: { menu: PosMenu; onClose: () => void }) {
  const cart = useCart();
  const [pending, start] = useTransition();
  const [hint, setHint] = useState("");
  const type = cart.orderType;
  const lookup = () =>
    start(async () => {
      const c = await lookupCustomer(cart.customerPhone);
      if (!c) { cart.set({ customerPoints: 0, redeem: false }); return setHint("New customer"); }
      cart.set({ customerName: c.name, deliveryAddress: cart.deliveryAddress || c.address, deliveryZoneId: cart.deliveryZoneId ?? c.zoneId, customerPoints: c.points });
      setHint(`Found ${c.name || "customer"} · ${c.points} pts`);
    });
  return (
    <Modal title="Order details" onClose={onClose} width="max-w-md">
      <div className="space-y-4">
        {type === "dine_in" && <div><Label>Table number</Label><Input value={cart.tableNo} onChange={(e) => cart.set({ tableNo: e.target.value })} inputMode="numeric" autoFocus /></div>}
        {type === "online" && <div><Label>Platform (e.g. Foodpanda)</Label><Input value={cart.aggregatorName} onChange={(e) => cart.set({ aggregatorName: e.target.value })} /></div>}
        {(type === "delivery" || type === "takeaway") && (
          <>
            <div>
              <Label>Customer phone</Label>
              <div className="flex gap-2">
                <Input value={cart.customerPhone} inputMode="tel" onChange={(e) => cart.set({ customerPhone: e.target.value })} onBlur={() => cart.customerPhone.length >= 7 && lookup()} placeholder="03xx-xxxxxxx" />
                <Button variant="secondary" onClick={lookup} disabled={pending}>Find</Button>
              </div>
              {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
            </div>
            <div><Label>Name</Label><Input value={cart.customerName} onChange={(e) => cart.set({ customerName: e.target.value })} /></div>
          </>
        )}
        {type === "delivery" && (
          <>
            <div><Label>Address</Label><Input value={cart.deliveryAddress} onChange={(e) => cart.set({ deliveryAddress: e.target.value })} /></div>
            <div>
              <Label>Delivery zone</Label>
              <div className="grid grid-cols-2 gap-2">
                {menu.zones.map((z) => (
                  <button key={z.id} onClick={() => cart.set({ deliveryZoneId: z.id })} className={`min-h-14 rounded-xl border-2 px-3 text-left ${cart.deliveryZoneId === z.id ? "border-brand bg-brand/15" : "border-border bg-surface-2"}`}>
                    <div className="font-semibold">{z.name}</div><div className="text-sm text-muted">{formatPKR(z.charge)}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {type === "drive_thru" && <p className="text-muted">No extra details needed.</p>}
        <Button size="lg" className="w-full" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
