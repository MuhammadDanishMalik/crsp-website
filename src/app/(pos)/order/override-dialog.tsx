"use client";
import { useState, useTransition } from "react";
import { verifyOverridePin } from "@/lib/actions/auth";
import type { Permission } from "@/lib/domain/permissions";
import { Numpad } from "@/components/pos/numpad";
import { Modal } from "@/components/ui/modal";

/** Manager PIN override popup. Calls back with a short-lived signed token. */
export function OverrideDialog({ permission, title, onApproved, onClose }: { permission: Permission; title: string; onApproved: (token: string, by: string) => void; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const r = await verifyOverridePin(pin, permission);
      if (r.ok) onApproved(r.token, r.approverName);
      else { setError(r.error); setPin(""); }
    });
  return (
    <Modal title="Manager approval" onClose={onClose} width="max-w-sm">
      <p className="mb-3 text-muted">{title}</p>
      <div className="mb-2 flex justify-center gap-3">
        {Array.from({ length: 6 }, (_, i) => <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? "border-brand bg-brand" : "border-border"}`} />)}
      </div>
      <p className="mb-2 h-6 text-center text-danger">{error}</p>
      <Numpad onDigit={(d) => { setError(""); setPin((p) => (p + d).slice(0, 6)); }} onBackspace={() => setPin((p) => p.slice(0, -1))} onClear={() => setPin("")} />
      <button disabled={pin.length < 4 || pending} onClick={submit} className="mt-3 h-14 w-full rounded-2xl bg-brand text-lg font-bold text-brand-fg">Approve</button>
    </Modal>
  );
}
