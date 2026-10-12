"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Numpad } from "@/components/pos/numpad";
import { formatPKR } from "@/lib/domain/money";
import { OverrideDialog } from "./override-dialog";
import { Input } from "@/components/ui/input";
import { previewPromo } from "@/lib/actions/orders";
import type { CartDiscount } from "@/lib/stores/cart";
import type { Me } from "./types";

export function DiscountDialog({ subtotal, me, current, onApply, onClose }: { subtotal: number; me: Me; current: CartDiscount | null; onApply: (d: CartDiscount | null) => void; onClose: () => void }) {
  const [kind, setKind] = useState<"percent" | "fixed">(current?.kind ?? "percent");
  const [digits, setDigits] = useState(current ? String(current.kind === "percent" ? current.value / 100 : current.value / 100) : "");
  const [override, setOverride] = useState(false);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  const applyCode = async () => {
    const r = await previewPromo(code);
    if (!r.ok) return setCodeMsg(r.error);
    onApply({ kind: r.kind, value: r.value, code: code.trim().toUpperCase(), label: r.name });
  };
  const value = kind === "percent" ? Math.round(Number(digits || 0) * 100) : Math.round(Number(digits || 0) * 100);
  const pct = kind === "percent" ? value : Math.round((value / Math.max(subtotal, 1)) * 10_000);
  const tooHigh = pct > 10_000;
  const needsApproval = pct > me.discountLimitBps && !me.can.discountAbove;

  const apply = (token?: string) => onApply(value > 0 ? { kind, value, overrideToken: token } : null);

  return (
    <Modal title="Discount" onClose={onClose} width="max-w-md">
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(["percent", "fixed"] as const).map((k) => (
          <button key={k} onClick={() => { setKind(k); setDigits(""); }} className={`h-14 rounded-xl border-2 font-semibold ${kind === k ? "border-brand bg-brand/15" : "border-border bg-surface-2"}`}>{k === "percent" ? "Percent %" : "Amount Rs"}</button>
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        <Input value={code} onChange={(e) => { setCode(e.target.value); setCodeMsg(""); }} placeholder="Promo / staff-meal code" autoCapitalize="characters" />
        <Button variant="secondary" disabled={!code.trim()} onClick={applyCode}>Use code</Button>
      </div>
      {codeMsg && <p className="mb-2 text-danger">{codeMsg}</p>}
      {current?.label && <p className="mb-2 text-success">Applied: {current.label}</p>}
      {kind === "percent" && (
        <div className="mb-3 grid grid-cols-4 gap-2">{[5, 10, 15, 20].map((p) => <button key={p} onClick={() => setDigits(String(p))} className="h-12 rounded-xl bg-surface-2 font-semibold">{p}%</button>)}</div>
      )}
      <div className="mb-3 rounded-2xl bg-surface-2 p-4 text-right text-3xl font-bold tabular-nums">{digits || "0"}{kind === "percent" ? "%" : ""}</div>
      <Numpad onDigit={(d) => setDigits((v) => (v + d).replace(/^0+(\d)/, "$1").slice(0, 6))} onBackspace={() => setDigits((v) => v.slice(0, -1))} onClear={() => setDigits("")} />
      <p className="mt-3 text-sm text-muted">
        Takes off {formatPKR(kind === "percent" ? Math.round((subtotal * value) / 10_000) : Math.min(value, subtotal))}
        {needsApproval && !tooHigh ? " · needs manager approval" : ""}{tooHigh ? " · cannot exceed 100%" : ""}
      </p>
      <div className="mt-3 flex gap-2">
        {current && <Button variant="secondary" size="lg" onClick={() => onApply(null)}>Remove</Button>}
        <Button size="lg" className="flex-1" disabled={tooHigh || value === 0} onClick={() => (needsApproval ? setOverride(true) : apply())}>Apply</Button>
      </div>
      {override && <OverrideDialog permission="discount.apply.above_10pct" title={`Discount above ${me.discountLimitBps / 100}% needs manager approval`} onClose={() => setOverride(false)} onApproved={(t) => apply(t)} />}
    </Modal>
  );
}
