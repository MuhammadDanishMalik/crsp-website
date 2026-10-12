"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { saveBranch } from "@/lib/actions/branches";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type B = { id: string; code: string; name: string; address: string; city: string; phone: string; taxAuthority: string; taxRegistrationNo: string; posId: string; isActive: boolean; staff: number; terminals: number };

export function BranchesView({ branches, current }: { branches: B[]; current: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Partial<B> | null>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center"><h1 className="text-3xl font-bold">Branches</h1><Button className="ml-auto" onClick={() => setEdit({ taxAuthority: "pra", isActive: true })}><Plus size={18} />Add branch</Button></div>
      {msg && <p className="mb-3 rounded-xl bg-accent/20 p-3">{msg}</p>}
      <p className="mb-3 text-sm text-muted">Menu items, recipes, roles and tax rules are shared. Prices (Menu → Branch price), stock, staff, printers, terminals and shifts are per branch. Use the branch switcher in the sidebar to work inside another branch.</p>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {branches.map((b) => (
          <div key={b.id} className={cn("flex min-h-16 items-center gap-3 border-b border-border px-4 last:border-0", !b.isActive && "opacity-50")}>
            <span className="w-14 rounded bg-surface-2 px-2 py-1 text-center font-mono text-sm font-bold">{b.code}</span>
            <div className="flex-1"><p className="font-semibold">{b.name}{b.id === current && <span className="ml-2 rounded bg-brand/20 px-2 py-0.5 text-xs font-bold text-brand">CURRENT</span>}</p><p className="text-sm text-muted">{b.address || "No address"} · {b.staff} staff · {b.terminals} terminals · tax: {b.taxAuthority.toUpperCase()}</p></div>
            <Button variant="secondary" className="min-h-11" onClick={() => setEdit(b)}>Edit</Button>
          </div>
        ))}
      </div>
      {edit && <Form initial={edit} onClose={() => setEdit(null)} onDone={(m) => { setEdit(null); setMsg(m); router.refresh(); }} />}
    </div>
  );
}

function Form({ initial, onClose, onDone }: { initial: Partial<B>; onClose: () => void; onDone: (msg: string) => void }) {
  const [v, setV] = useState({ code: initial.code ?? "", name: initial.name ?? "", address: initial.address ?? "", city: initial.city ?? "", phone: initial.phone ?? "", taxAuthority: initial.taxAuthority ?? "pra", reg: initial.taxRegistrationNo ?? "", posId: initial.posId ?? "", active: initial.isActive ?? true });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const sel = "min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3";
  return (
    <Modal title={initial.id ? "Edit branch" : "New branch"} onClose={onClose} width="max-w-lg">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Code</Label><Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="MW3" /></div>
        <div><Label>Name</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div className="col-span-2"><Label>Address</Label><Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></div>
        <div><Label>City</Label><Input value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
        <div><Label>Tax authority</Label><select className={sel} value={v.taxAuthority} onChange={(e) => setV({ ...v, taxAuthority: e.target.value })}><option value="pra">PRA (Punjab)</option><option value="fbr">FBR</option><option value="none">None</option></select></div>
        <div><Label>Tax registration no.</Label><Input value={v.reg} onChange={(e) => setV({ ...v, reg: e.target.value })} /></div>
        <div><Label>Authority POS ID</Label><Input value={v.posId} onChange={(e) => setV({ ...v, posId: e.target.value })} /></div>
        {initial.id && <label className="flex items-end gap-3 pb-3"><input type="checkbox" className="h-6 w-6" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Active</label>}
      </div>
      {error && <p className="mt-3 text-danger">{error}</p>}
      <Button size="lg" className="mt-4 w-full" disabled={pending} onClick={() => start(async () => { const r = await saveBranch({ id: initial.id, code: v.code, name: v.name, address: v.address || undefined, city: v.city || undefined, phone: v.phone || undefined, taxAuthority: v.taxAuthority, taxRegistrationNo: v.reg || undefined, posId: v.posId || undefined, isActive: v.active }); if (r.ok) onDone(r.message ?? ""); else setError(r.error); })}>Save</Button>
    </Modal>
  );
}
