"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { recordWastage, saveIngredient, stockCount, transferStock } from "@/lib/actions/inventory";
import { formatPKR } from "@/lib/domain/money";
import { convertQty, type Conversion } from "@/lib/domain/inventory";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Row = { id: string; name: string; baseUnitId: string; unit: string; qty: number; reorder: number; avgCost: number; isImported: boolean; origin: string; low: boolean; negative: boolean; batches: { id: string; no: string; expiry: string; remaining: number; landed: number | null; expiringSoon: boolean }[] };
type Unit = { id: string; code: string };
type Mv = { id: string; at: string; name: string; type: string; qty: number; note: string };
type Props = { stock: Row[]; movements: Mv[]; units: Unit[]; conv: Conversion[]; branches: { id: string; name: string }[]; reasons: { id: string; label: string }[]; can: { adjust: boolean; waste: boolean; transfer: boolean; cost: boolean } };
const sel = "min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3";
const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : String(Math.round(n * 100) / 100));

/** Units a quantity can be entered in for an ingredient: its base unit plus anything convertible to it. */
export function unitsFor(base: string, units: Unit[], conv: Conversion[]) {
  return units.filter((u) => { try { convertQty(1, u.id, base, conv); return true; } catch { return false; } });
}

export function InventoryView({ stock, movements, units, conv, branches, reasons, can }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"stock" | "log">("stock");
  const [act, setAct] = useState<null | { kind: "count" | "waste" | "transfer"; row: Row }>(null);
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const low = useMemo(() => stock.filter((r) => r.low), [stock]);
  const expiring = useMemo(() => stock.flatMap((r) => r.batches.filter((b) => b.expiringSoon).map((b) => ({ ...b, name: r.name }))), [stock]);
  return (
    <div className="max-w-6xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <div className="ml-4 flex gap-1 rounded-xl bg-surface p-1">{(["stock", "log"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("h-10 rounded-lg px-4 font-semibold", tab === t ? "bg-brand text-brand-fg" : "text-muted")}>{t === "stock" ? "Stock" : "Movement log"}</button>)}</div>
        {can.adjust && <Button className="ml-auto" onClick={() => setEdit({ baseUnitId: units[0]?.id, avgCost: 0, reorder: 0 })}><Plus size={18} />Ingredient</Button>}
      </div>
      {(low.length > 0 || expiring.length > 0) && (
        <div className="mb-4 space-y-1 rounded-2xl border border-warn/50 bg-warn/10 p-4">
          {low.length > 0 && <p className="flex items-center gap-2 font-semibold text-warn"><AlertTriangle size={18} />Low stock: {low.map((r) => `${r.name} (${fmt(r.qty)} ${r.unit})`).join(", ")}</p>}
          {expiring.length > 0 && <p className="flex items-center gap-2 font-semibold text-warn"><AlertTriangle size={18} />Expiring within 30 days: {expiring.map((b) => `${b.name} batch ${b.no || "—"} (${b.expiry})`).join(", ")}</p>}
        </div>
      )}
      {tab === "stock" && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2"><tr><th className="p-3 text-left">Ingredient</th><th className="p-3 text-right">On hand</th><th className="p-3 text-right">Reorder at</th>{can.cost && <th className="p-3 text-right">Avg cost / unit</th>}<th className="p-3" /></tr></thead>
            <tbody>
              {stock.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="p-3"><span className="font-semibold">{r.name}</span>{r.isImported && <span className="ml-2 rounded bg-accent/20 px-2 py-0.5 text-xs font-bold">IMPORTED · {r.origin}</span>}
                    {r.batches.map((b) => <p key={b.id} className={cn("text-xs", b.expiringSoon ? "text-warn" : "text-muted")}>Batch {b.no || "—"} · {fmt(b.remaining)} {r.unit} · exp {b.expiry || "—"}{can.cost && b.landed ? ` · landed ${formatPKR(b.landed)}/${r.unit}` : ""}</p>)}</td>
                  <td className={cn("p-3 text-right font-bold tabular-nums", r.negative ? "text-danger" : r.low ? "text-warn" : "")}>{fmt(r.qty)} {r.unit}</td>
                  <td className="p-3 text-right tabular-nums text-muted">{fmt(r.reorder)} {r.unit}</td>
                  {can.cost && <td className="p-3 text-right tabular-nums">{formatPKR(r.avgCost)}</td>}
                  <td className="p-2"><div className="flex justify-end gap-1">
                    {can.adjust && <Button variant="secondary" className="min-h-10" onClick={() => setAct({ kind: "count", row: r })}>Count</Button>}
                    {can.waste && <Button variant="secondary" className="min-h-10" onClick={() => setAct({ kind: "waste", row: r })}>Waste</Button>}
                    {can.transfer && branches.length > 0 && <Button variant="secondary" className="min-h-10" onClick={() => setAct({ kind: "transfer", row: r })}>Transfer</Button>}
                    {can.adjust && <Button variant="ghost" className="min-h-10" onClick={() => setEdit(r)}>Edit</Button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "log" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {movements.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border-b border-border px-4 py-2 text-sm last:border-0">
              <span className="w-40 text-muted">{new Date(m.at).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" })}</span>
              <span className="flex-1 font-medium">{m.name}</span><span className="w-28 rounded bg-surface-2 px-2 py-0.5 text-center text-xs uppercase">{m.type.replace("_", " ")}</span>
              <span className={cn("w-24 text-right tabular-nums", m.qty < 0 ? "text-danger" : "text-success")}>{m.qty > 0 ? "+" : ""}{fmt(m.qty)}</span><span className="w-48 truncate text-muted">{m.note}</span>
            </div>
          ))}
        </div>
      )}
      {act && <ActionForm {...act} {...{ units, conv, branches, reasons }} onClose={() => setAct(null)} onDone={() => { setAct(null); router.refresh(); }} />}
      {edit && <IngredientForm initial={edit} units={units} onClose={() => setEdit(null)} onDone={() => { setEdit(null); router.refresh(); }} />}
    </div>
  );
}

function ActionForm({ kind, row, units, conv, branches, reasons, onClose, onDone }: { kind: "count" | "waste" | "transfer"; row: Row; units: Unit[]; conv: Conversion[]; branches: Props["branches"]; reasons: Props["reasons"]; onClose: () => void; onDone: () => void }) {
  const opts = unitsFor(row.baseUnitId, units, conv);
  const [qty, setQty] = useState("");
  const [unitId, setUnitId] = useState(row.baseUnitId);
  const [reason, setReason] = useState(reasons[0]?.id ?? "");
  const [to, setTo] = useState(branches[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    const q = Number(qty);
    const r = kind === "count" ? await stockCount(row.id, q, unitId, note || undefined) : kind === "waste" ? await recordWastage({ ingredientId: row.id, qty: q, unitId, reasonCodeId: reason, note: note || undefined }) : await transferStock(row.id, to, q, unitId);
    if (r.ok) onDone(); else setError(r.error);
  });
  return (
    <Modal title={`${kind === "count" ? "Stock count" : kind === "waste" ? "Record wastage" : "Transfer"} · ${row.name}`} onClose={onClose} width="max-w-md">
      <div className="space-y-3">
        <p className="text-sm text-muted">On hand: {fmt(row.qty)} {row.unit}</p>
        <div className="grid grid-cols-[1fr_110px] gap-2"><Input inputMode="decimal" placeholder={kind === "count" ? "Counted quantity" : "Quantity"} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          <select className={sel} value={unitId} onChange={(e) => setUnitId(e.target.value)}>{opts.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</select></div>
        {kind === "waste" && <div><Label>Reason</Label><select className={sel} value={reason} onChange={(e) => setReason(e.target.value)}>{reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>}
        {kind === "transfer" && <div><Label>To branch</Label><select className={sel} value={to} onChange={(e) => setTo(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
        {kind !== "transfer" && <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />}
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending || !qty} onClick={go}>Save</Button>
      </div>
    </Modal>
  );
}

function IngredientForm({ initial, units, onClose, onDone }: { initial: Partial<Row>; units: Unit[]; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ name: initial.name ?? "", unit: initial.baseUnitId ?? units[0]?.id ?? "", cost: String((initial.avgCost ?? 0) / 100), reorder: String(initial.reorder ?? 0), imported: initial.isImported ?? false, origin: initial.origin ?? "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title={initial.id ? "Edit ingredient" : "New ingredient"} onClose={onClose} width="max-w-md">
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Base unit</Label><select className={sel} value={v.unit} disabled={!!initial.id} onChange={(e) => setV({ ...v, unit: e.target.value })}>{units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</select></div>
          <div><Label>Reorder level</Label><Input inputMode="decimal" value={v.reorder} onChange={(e) => setV({ ...v, reorder: e.target.value })} /></div>
        </div>
        <div><Label>Cost per base unit (Rs)</Label><Input inputMode="decimal" value={v.cost} onChange={(e) => setV({ ...v, cost: e.target.value })} /><p className="mt-1 text-xs text-muted">Updated automatically by purchases (weighted average).</p></div>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={v.imported} onChange={(e) => setV({ ...v, imported: e.target.checked })} />Imported (track batch, expiry, landed cost)</label>
        {v.imported && <Input placeholder="Country of origin" value={v.origin} onChange={(e) => setV({ ...v, origin: e.target.value })} />}
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await saveIngredient({ id: initial.id, name: v.name, baseUnitId: v.unit, isImported: v.imported, originCountry: v.origin || undefined, costPerUnitPaisa: (Number(v.cost) || 0) * 100, reorderLevel: Number(v.reorder) || 0 }); if (r.ok) onDone(); else setError(r.error); })}>Save</Button>
      </div>
    </Modal>
  );
}
