"use client";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { PosItem } from "@/lib/queries/menu";
import { groupError } from "@/lib/domain/pricing";
import { formatPKR } from "@/lib/domain/money";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ModifierSheet({ item, onAdd, onClose }: { item: PosItem; onAdd: (mods: { id: string; name: string; priceDelta: number }[], qty: number) => void; onClose: () => void }) {
  const [sel, setSel] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(item.groups.map((g) => [g.id, g.modifiers.filter((m) => m.isDefault).map((m) => m.id).slice(0, g.max)])),
  );
  const [qty, setQty] = useState(1);

  const toggle = (gid: string, mid: string, max: number) =>
    setSel((s) => {
      const cur = s[gid] ?? [];
      if (cur.includes(mid)) return { ...s, [gid]: cur.filter((x) => x !== mid) };
      if (max === 1) return { ...s, [gid]: [mid] }; // radio behaviour
      if (cur.length >= max) return s;
      return { ...s, [gid]: [...cur, mid] };
    });

  const picked = useMemo(() => item.groups.flatMap((g) => g.modifiers.filter((m) => sel[g.id]?.includes(m.id))), [item.groups, sel]);
  const errors = item.groups.map((g) => groupError(g.min, g.max, sel[g.id]?.length ?? 0));
  const valid = errors.every((e) => !e);
  const unit = item.price + picked.reduce((a, m) => a + m.priceDelta, 0);

  return (
    <Modal title={item.name} onClose={onClose} width="max-w-2xl">
      <div className="space-y-6">
        {item.groups.map((g, gi) => (
          <section key={g.id}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-lg font-semibold">{g.name}</h3>
              <span className={cn("text-sm", errors[gi] ? "text-warn" : "text-muted")}>{g.min > 0 ? "Required" : "Optional"}{g.max > 1 ? ` · up to ${g.max}` : ""}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {g.modifiers.map((m) => {
                const on = sel[g.id]?.includes(m.id);
                return (
                  <button key={m.id} onClick={() => toggle(g.id, m.id, g.max)}
                    className={cn("relative flex min-h-16 flex-col items-start justify-center rounded-2xl border-2 px-4 py-2 text-left transition", on ? "border-brand bg-brand/15" : "border-border bg-surface-2")}>
                    <span className="font-semibold">{m.name}</span>
                    {m.priceDelta !== 0 && <span className="text-sm text-muted">+{formatPKR(m.priceDelta)}</span>}
                    {on && <Check className="absolute right-3 top-3 h-5 w-5 text-brand" />}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button className="h-14 w-14 rounded-xl bg-surface-2 text-2xl" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span className="w-10 text-center text-2xl font-bold">{qty}</span>
          <button className="h-14 w-14 rounded-xl bg-surface-2 text-2xl" onClick={() => setQty((q) => Math.min(99, q + 1))}>+</button>
        </div>
        <Button size="xl" className="flex-1" disabled={!valid} onClick={() => onAdd(picked.map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta })), qty)}>
          Add · {formatPKR(unit * qty)}
        </Button>
      </div>
    </Modal>
  );
}
