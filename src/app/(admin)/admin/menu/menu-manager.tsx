"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { setBranchPrice } from "@/lib/actions/branches";
import { installCrspMenu, deactivateItem, saveCategory, saveItem, saveModifierGroup, setAvailability } from "@/lib/actions/menu";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string; nameUr: string; categoryId: string; price: number; emoji: string; barcode: string; isFavourite: boolean; available: boolean; branchPrice: number | null; groupIds: string[] };
type Group = { id: string; name: string; min: number; max: number; options: { name: string; price: number; isDefault: boolean }[] };
type Props = { can: { manage: boolean; availability: boolean; price: boolean; owner: boolean }; categories: { id: string; name: string }[]; items: Item[]; groups: Group[] };

export function MenuManager({ can, categories, items, groups }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"items" | "groups">("items");
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [editGroup, setEditGroup] = useState<Group | "new" | null>(null);
  const [, start] = useTransition();
  const [note, setNote] = useState("");
  const refresh = () => router.refresh();

  const toggle = (i: Item) => start(async () => { await setAvailability(i.id, !i.available); refresh(); });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-3xl font-bold">Menu</h1>
        <div className="ml-4 flex gap-1 rounded-xl bg-surface p-1">
          {(["items", "groups"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("h-10 rounded-lg px-4 font-semibold", tab === t ? "bg-brand text-brand-fg" : "text-muted")}>{t === "items" ? "Items" : "Modifier groups"}</button>)}
        </div>
        {can.manage && tab === "items" && (
          <div className="ml-auto flex gap-2">
            {can.owner && <Button variant="ghost" className="text-danger" onClick={() => confirm("Replace the WHOLE menu with the CRSP menu card (Broast, Burgers, Wraps, Wings, Nuggets, Fries, Beverages, Extras, Deals 1–10)?\n\nPrices or options you edited by hand will be replaced. Orders, staff and stock are kept.") && start(async () => { const r = await installCrspMenu(); setNote(r.ok ? (r.message ?? "Menu replaced") : r.error); refresh(); })}>Load CRSP menu card</Button>}
            <Button variant="secondary" onClick={() => { const n = prompt("New category name"); if (n) start(async () => { await saveCategory(n); refresh(); }); }}>+ Category</Button>
            <Button onClick={() => setEditing({ categoryId: categories[0]?.id, groupIds: [], isFavourite: false, price: 0 })}><Plus size={18} />Add item</Button>
          </div>
        )}
        {can.manage && tab === "groups" && <Button className="ml-auto" onClick={() => setEditGroup("new")}><Plus size={18} />Add group</Button>}
      </div>

      {note && <p className="mb-3 rounded-xl bg-accent/20 p-3">{note}</p>}
      {tab === "items" && categories.map((c) => {
        const list = items.filter((i) => i.categoryId === c.id);
        if (!list.length) return null;
        return (
          <section key={c.id} className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-muted">{c.name}</h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              {list.map((i) => (
                <div key={i.id} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-0">
                  <span className="w-8 text-2xl">{i.emoji || "🍽️"}</span>
                  <span className="flex-1 font-medium">{i.name}{i.isFavourite && <span className="ml-2 text-xs text-accent">★ best seller</span>}</span>
                  <span className="w-28 text-right tabular-nums">{formatPKR(i.branchPrice ?? i.price)}{i.branchPrice != null && i.branchPrice !== i.price && <span className="block text-[10px] uppercase text-accent">branch price</span>}</span>
                  {can.price && <button className="h-10 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-surface-2" title="Set a different price for this branch" onClick={() => { const v = prompt(`Price for this branch in Rs (base ${i.price / 100}). Leave empty to use the base price.`, i.branchPrice != null ? String(i.branchPrice / 100) : ""); if (v !== null) start(async () => { await setBranchPrice(i.id, v.trim() === "" ? null : Number(v)); refresh(); }); }}>Branch price</button>}
                  <button disabled={!can.availability} onClick={() => toggle(i)} className={cn("h-10 w-28 rounded-lg text-sm font-semibold", i.available ? "bg-success/20 text-success" : "bg-danger/20 text-danger")}>{i.available ? "Available" : "Sold out"}</button>
                  {can.manage && <button aria-label="Edit" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-2" onClick={() => setEditing(i)}><Pencil size={16} /></button>}
                  {can.manage && <button aria-label="Remove" className="flex h-10 w-10 items-center justify-center rounded-lg text-danger hover:bg-surface-2" onClick={() => confirm(`Remove ${i.name}?`) && start(async () => { await deactivateItem(i.id); refresh(); })}><Trash2 size={16} /></button>}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {tab === "groups" && (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between"><h3 className="font-semibold">{g.name}</h3>{can.manage && <button className="text-sm underline" onClick={() => setEditGroup(g)}>Edit</button>}</div>
              <p className="text-sm text-muted">{g.min > 0 ? "Required" : "Optional"} · choose {g.min === g.max ? g.max : `${g.min}–${g.max}`}</p>
              <p className="mt-2 text-sm">{g.options.map((o) => o.name + (o.price ? ` (+${o.price / 100})` : "")).join(" · ")}</p>
            </div>
          ))}
        </div>
      )}

      {editing && <ItemForm initial={editing} categories={categories} groups={groups} canPrice={can.price} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {editGroup && <GroupForm initial={editGroup === "new" ? null : editGroup} onClose={() => setEditGroup(null)} onSaved={() => { setEditGroup(null); refresh(); }} />}
    </div>
  );
}

function ItemForm({ initial, categories, groups, canPrice, onClose, onSaved }: { initial: Partial<Item>; categories: Props["categories"]; groups: Group[]; canPrice: boolean; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: initial.name ?? "", nameUr: initial.nameUr ?? "", categoryId: initial.categoryId ?? "", price: String((initial.price ?? 0) / 100), emoji: initial.emoji ?? "", barcode: initial.barcode ?? "", isFavourite: initial.isFavourite ?? false, groupIds: initial.groupIds ?? [] });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveItem({ id: initial.id, name: v.name, nameUr: v.nameUr || undefined, categoryId: v.categoryId, priceRupees: Number(v.price), emoji: v.emoji || undefined, barcode: v.barcode || undefined, isFavourite: v.isFavourite, groupIds: v.groupIds });
    if (r.ok) onSaved(); else setError(r.error);
  });
  return (
    <Modal title={initial.id ? "Edit item" : "New item"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Label>Name</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></div>
        <div><Label>Urdu name</Label><Input dir="rtl" value={v.nameUr} onChange={(e) => setV({ ...v, nameUr: e.target.value })} /></div>
        <div><Label>Price (Rs)</Label><Input inputMode="decimal" disabled={!canPrice} value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /></div>
        <div><Label>Category</Label><select className="min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><Label>Emoji / icon</Label><Input value={v.emoji} onChange={(e) => setV({ ...v, emoji: e.target.value })} maxLength={4} /></div>
        <div><Label>Barcode</Label><Input value={v.barcode} onChange={(e) => setV({ ...v, barcode: e.target.value })} /></div>
        <label className="col-span-2 flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={v.isFavourite} onChange={(e) => setV({ ...v, isFavourite: e.target.checked })} />Show in best sellers</label>
        <div className="col-span-2"><Label>Modifier groups</Label>
          <div className="flex flex-wrap gap-2">{groups.map((g) => {
            const on = v.groupIds.includes(g.id);
            return <button key={g.id} type="button" onClick={() => setV({ ...v, groupIds: on ? v.groupIds.filter((x) => x !== g.id) : [...v.groupIds, g.id] })} className={cn("h-11 rounded-xl border-2 px-4 text-sm font-semibold", on ? "border-brand bg-brand/15" : "border-border bg-surface-2")}>{g.name}</button>;
          })}</div>
        </div>
      </div>
      {error && <p className="mt-3 text-danger">{error}</p>}
      <Button size="lg" className="mt-4 w-full" disabled={pending} onClick={save}>Save</Button>
    </Modal>
  );
}

function GroupForm({ initial, onClose, onSaved }: { initial: Group | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [min, setMin] = useState(String(initial?.min ?? 0));
  const [max, setMax] = useState(String(initial?.max ?? 1));
  const [opts, setOpts] = useState(initial?.options.map((o) => ({ name: o.name, price: String(o.price / 100), isDefault: o.isDefault })) ?? [{ name: "", price: "0", isDefault: false }]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveModifierGroup({ id: initial?.id, name, minSelect: Number(min), maxSelect: Number(max), options: opts.filter((o) => o.name.trim()).map((o) => ({ name: o.name, priceRupees: Number(o.price) || 0, isDefault: o.isDefault })) });
    if (r.ok) onSaved(); else setError(r.error);
  });
  return (
    <Modal title={initial ? "Edit modifier group" : "New modifier group"} onClose={onClose}>
      <div className="space-y-4">
        <div><Label>Group name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-4"><div><Label>Min choices (0 = optional)</Label><Input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></div><div><Label>Max choices</Label><Input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} /></div></div>
        <div><Label>Options</Label>
          {opts.map((o, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <Input placeholder="Option name" value={o.name} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input className="w-28" inputMode="decimal" placeholder="+Rs" value={o.price} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" className="h-5 w-5" checked={o.isDefault} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, isDefault: e.target.checked } : x)))} />Default</label>
              <button className="px-2 text-danger" onClick={() => setOpts(opts.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setOpts([...opts, { name: "", price: "0", isDefault: false }])}>+ Option</Button>
        </div>
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={save}>Save</Button>
      </div>
    </Modal>
  );
}
