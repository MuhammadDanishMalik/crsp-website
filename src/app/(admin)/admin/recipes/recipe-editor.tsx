"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { saveItemNutrition, saveRecipe } from "@/lib/actions/inventory";
import { formatPKR } from "@/lib/domain/money";
import { recipeNutrition, roundN } from "@/lib/domain/nutrition";
import type { Conversion } from "@/lib/domain/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { unitsFor } from "../inventory/inventory-view";

type N = { kcal: number; protein: number; carbs: number; fat: number };
type Item = { nutrition: N | null; nutritionManual: boolean; id: string; name: string; emoji: string; price: number; lines: { ingredientId: string; qty: number; unitId: string }[]; cost: number; pct: number | null };
type Ing = { id: string; name: string; baseUnitId: string; unitCode: string; per: N };
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
            <span className="w-36 text-right text-xs tabular-nums text-muted">{i.nutrition ? `${i.nutrition.kcal} kcal · ${i.nutrition.protein}g protein` : "no nutrition"}</span>
            <span className="w-24 text-right tabular-nums">{formatPKR(i.price)}</span>
            <span className="w-24 text-right tabular-nums text-muted">{i.lines.length ? formatPKR(i.cost) : "—"}</span>
            <span className={cn("w-16 text-right font-bold tabular-nums", i.pct == null ? "text-muted" : i.pct > 40 ? "text-danger" : i.pct > 33 ? "text-warn" : "text-success")}>{i.pct == null ? "no recipe" : `${i.pct}%`}</span>
            <Button variant="secondary" className="min-h-11" onClick={() => setEdit(i)}>{canEdit ? "Edit" : "View"}</Button>
          </div>
        ))}
        <div className="flex gap-3 bg-surface-2 px-4 py-2 text-xs uppercase text-muted"><span className="flex-1">Item</span><span className="w-36 text-right">Nutrition</span><span className="w-24 text-right">Price</span><span className="w-24 text-right">Cost</span><span className="w-16 text-right">Food cost</span><span className="w-24" /></div>
      </div>
      {edit && <Form item={edit} {...{ ingredients, units, conv, canEdit }} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); router.refresh(); }} />}
    </div>
  );
}

function Form({ item, ingredients, units, conv, canEdit, onClose, onSaved }: { item: Item; ingredients: Ing[]; units: Unit[]; conv: Conversion[]; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const [lines, setLines] = useState(item.lines.map((l) => ({ ...l, qty: String(l.qty) })));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const ingMap = new Map(ingredients.map((i) => [i.id, { baseUnitId: i.baseUnitId, unitCode: i.unitCode, per: i.per }]));
  const calc = roundN(recipeNutrition(lines.filter((l) => Number(l.qty) > 0).map((l) => ({ ingredientId: l.ingredientId, qty: Number(l.qty), unitId: l.unitId })), ingMap, conv));
  const [manual, setManual] = useState(item.nutritionManual && item.nutrition ? { kcal: String(item.nutrition.kcal), protein: String(item.nutrition.protein), carbs: String(item.nutrition.carbs), fat: String(item.nutrition.fat) } : null);
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
        <div className="rounded-2xl border border-border bg-surface-2 p-4">
          <div className="mb-2 flex items-center justify-between"><p className="font-semibold">Nutrition per portion</p>
            {canEdit && <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" className="h-5 w-5" checked={!!manual} onChange={(e) => setManual(e.target.checked ? { kcal: String(calc.kcal), protein: String(calc.protein), carbs: String(calc.carbs), fat: String(calc.fat) } : null)} />Type values myself</label>}</div>
          {manual ? (
            <div className="grid grid-cols-4 gap-2">{(["kcal", "protein", "carbs", "fat"] as const).map((k) => <label key={k} className="text-xs text-muted">{k === "kcal" ? "Calories" : k + " g"}<Input inputMode="decimal" value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} /></label>)}</div>
          ) : (
            <div className="grid grid-cols-4 gap-2 text-center">
              {([["Calories", calc.kcal, "kcal"], ["Protein", calc.protein, "g"], ["Carbs", calc.carbs, "g"], ["Fat", calc.fat, "g"]] as const).map(([l, v, u]) => <div key={l} className="rounded-xl bg-surface p-2"><p className="text-xs text-muted">{l}</p><p className="text-xl font-bold tabular-nums">{v}<span className="ml-0.5 text-xs font-normal text-muted">{u}</span></p></div>)}
            </div>
          )}
          <p className="mt-2 text-xs text-muted">{manual ? "These typed values are shown on the menu." : "Calculated live from the ingredients above using each ingredient's nutrition (Inventory → edit ingredient). An estimate: frying oil counts only the share absorbed."}</p>
        </div>
        {error && <p className="text-danger">{error}</p>}
        {canEdit && <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await saveRecipe(item.id, lines.filter((l) => l.qty).map((l) => ({ ingredientId: l.ingredientId, qty: Number(l.qty), unitId: l.unitId }))); if (!r.ok) return setError(r.error); const n = await saveItemNutrition(item.id, manual ? { kcal: Number(manual.kcal) || 0, protein: Number(manual.protein) || 0, carbs: Number(manual.carbs) || 0, fat: Number(manual.fat) || 0 } : null); if (n.ok) onSaved(); else setError(n.error); })}>Save recipe</Button>}
      </div>
    </Modal>
  );
}
