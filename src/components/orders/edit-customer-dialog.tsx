"use client";
import { useState, useTransition } from "react";
import { updateOrderCustomer } from "@/lib/actions/order-edit";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

/** Edit name / phone / address of an order after it was printed, then reprint the receipt. */
export function EditCustomerDialog({ orderId, orderNo, initial, onClose, onSaved }: {
  orderId: string; orderNo: string; initial: { name: string; phone: string; address: string }; onClose: () => void; onSaved: (reprint: boolean) => void;
}) {
  const [v, setV] = useState(initial);
  const [reprint, setReprint] = useState(true);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title={`Customer details · #${orderNo}`} onClose={onClose} width="max-w-md">
      <div className="space-y-3">
        <p className="text-sm text-muted">Optional. Changes only the details shown on the receipt; the items and money stay as they were.</p>
        <div><Label>Name</Label><Input value={v.name} maxLength={80} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></div>
        <div><Label>Phone</Label><Input inputMode="tel" value={v.phone} maxLength={20} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
        <div><Label>Address</Label><Input value={v.address} maxLength={300} onChange={(e) => setV({ ...v, address: e.target.value })} /></div>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={reprint} onChange={(e) => setReprint(e.target.checked)} />Print the customer receipt again</label>
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await updateOrderCustomer(orderId, v); if (r.ok) onSaved(reprint); else setError(r.error); })}>Save</Button>
      </div>
    </Modal>
  );
}
