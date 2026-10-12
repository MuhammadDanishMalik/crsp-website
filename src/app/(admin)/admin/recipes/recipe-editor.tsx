"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { saveRecipe } from "@/lib/actions/inventory";
import { formatPKR } from "@/lib/domain/money";
import type { Conversion } from "@/lib/domain/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { unitsFor } from "../inventory/inventory-view";

type Item = { id: string; name: string; emoji: string; price: number; lines: { ingredientId: string; qty: number; unitId: string }[]; cost: number; pct: number | null };
type Ing = { id: string; name: string; baseUnitId: string };
type Unit = { id: string; code: string };
const sel = "min-h-12 rounded-xl border border-border bg-surface-2 px-3";

export function RecipeEditor({ items, ingredients, units, conv, canEdit }: { items: Item[]; ingredients: Ing[]; units: Unit[]; conv: Conversion[]; canEdit: boolean }) {
  const [edit, setEdit] = useState<Item | null>(null);
  const router = useRouter();
  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-3xl font-bold">Recipes & food cost</h1>
      <p className="mb-4 text-muted">Each sale deducts these quantities from stock. Food cost uses the current average ingredient cost.</p>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {items.map((i) => (
          <div key={i.id} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-0">
            <span className="w-8 text-2xl">{i.emoji || "🍽️"}</span><span className="flex-1 font-medium">{i.name}</span>
            <span className="w-20 text-right text-sm text-muted">{i.lines.length} items</span>
            <span className="w-24 text-right tabular-nums">{formatPKR(i.price)}</span>
            <span className="w-24 text-right tabular-nums text-muted">{i.lines.length ? formatPKR(i.cost) : "—"}</span>
            <span className={cn("w-16 text-right font-bold tabular-nums", i.pct == null ? "text-muted" : i.pct > 40 ? "text-danger" : i.pct > 33 ? "text-warn" : "text-success")}>{i.pct == null ? "no recipe" : `${i.pct}%`}</span>
            <Button variant="secondary" className="min-h-11" onClick={() => setEdit(i)}>{canEdit ? "Edit" : "View"}</Button>
          </div>
        ))}
        <div className="flex gap-3 bg-surface-2 px-4 py-2 text-xs uppercase text-muted"><span className="flex-1">Item</span><span className="w-24 text-right">Price</span><span className="w-24 text-right">Cost</span><span className="w-16 text-right">Food cost</span><span className="w-24" /></div>
      </div>
      {edit && <Form item={edit} {...{ ingredients, units, conv, canEdit }} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); router.refresh(); }} />}
    </div>
  );
}

function Form({ item, ingredients, units, conv, canEdit, onClose, onSaved }: { item: Item; ingredients: Ing[]; units: Unit[]; conv: Conversion[]; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const [lines, setLines] = useState(item.lines.map((l) => ({ ...l, qty: String(l.qty) })));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const add = () => { const i = ingredients[0]; if (i) setLines([...lines, { ingredientId: i.id, qty: "", unitId: i.baseUnitId }]); };
  return (
    <Modal title={`Recipe · ${item.name}`} onClose={onClose} width="max-w-2xl">
      <div className="space-y-2">
        {lines.map((l, idx) => {
          const ing = ingredients.find((i) => i.id === l.ingredientId)!;
          return (
            <div key={idx} className="flex gap-2">
              <select className={cn(sel, "flex-1")} disabled={!canEdit} value={l.ingredientId} onChange={(e) => { const n = ingredients.find((i) => i.id === e.target.value)!; setLines(lines.map((x, j) => (j === idx ? { ...x, ingredientId: n.id, unitId: n.baseUnitId } : x))); }}>{ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
              <Input className="w-28" inputMode="decimal" disabled={!canEdit} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === idx ? { ...x, qty: e.target.value } : x)))} />
              <select className={cn(sel, "w-24")} disabled={!canEdit} value={l.unitId} onChange={(e) => setLines(lines.map((x, j) => (j === idx ? { ...x, unitId: e.target.value } : x)))}>{unitsFor(ing.baseUnitId, units, conv).map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</select>
              {canEdit && <button className="px-2 text-danger" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== idx))}><Trash2 size={18} /></button>}
            </div>
          );
        })}
        {canEdit && <Button variant="secondary" onClick={add}>+ Ingredient</Button>}
        {error && <p className="text-danger">{error}</p>}
        {canEdit && <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await saveRecipe(item.id, lines.filter((l) => l.qty).map((l) => ({ ingredientId: l.ingredientId, qty: Number(l.qty), unitId: l.unitId }))); if (r.ok) onSaved(); else setError(r.error); })}>Save recipe</Button>}
      </div>
    </Modal>
  );
}
