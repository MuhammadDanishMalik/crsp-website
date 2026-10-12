"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { saveStaff, setStaffActive } from "@/lib/actions/staff";
import { uploadImage } from "@/lib/actions/uploads";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Staff = { id: string; fullName: string; roleId: string; roleName: string; phone: string; cnic: string; email: string; photoUrl: string; active: boolean; hasPin: boolean; salaryType: "monthly" | "hourly"; salaryRupees: number; branchIds: string[] };
type Props = { staff: Staff[]; roles: { id: string; name: string }[]; branches: { id: string; name: string }[]; can: { manage: boolean; setPin: boolean; salary: boolean; ownerRole: boolean } };
const sel = "min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3";

export function StaffManager({ staff, roles, branches, can }: Props) {
  const router = useRouter();
  const [edit, setEdit] = useState<Partial<Staff> | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();
  const list = staff.filter((x) => x.active || showInactive);
  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-3xl font-bold">Staff</h1>
        <label className="ml-4 flex items-center gap-2 text-sm text-muted"><input type="checkbox" className="h-5 w-5" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Show inactive</label>
        {can.manage && <Button className="ml-auto" onClick={() => setEdit({ salaryType: "monthly", salaryRupees: 0, branchIds: branches.slice(0, 1).map((b) => b.id), roleId: roles.find((r) => r.name === "Cashier")?.id })}><Plus size={18} />Add staff</Button>}
      </div>
      {msg && <p className="mb-3 rounded-xl bg-danger/15 p-3 text-danger">{msg}</p>}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {list.map((x) => (
          <div key={x.id} className={cn("flex min-h-16 items-center gap-3 border-b border-border px-4 last:border-0", !x.active && "opacity-50")}>
            <Avatar url={x.photoUrl} name={x.fullName} size={44} />
            <div className="min-w-0 flex-1"><p className="font-semibold">{x.fullName}</p><p className="text-sm text-muted">{x.roleName} · {x.phone || "no phone"}{x.hasPin ? " · PIN set" : " · no PIN"}</p></div>
            {can.salary && <span className="text-sm text-muted">Rs {x.salaryRupees.toLocaleString()} /{x.salaryType === "monthly" ? "mo" : "hr"}</span>}
            {can.manage && <Button variant="secondary" className="min-h-11" onClick={() => setEdit(x)}>Edit</Button>}
            {can.manage && <Button variant="ghost" className={cn("min-h-11", x.active && "text-danger")} onClick={() => start(async () => { const r = await setStaffActive(x.id, !x.active); setMsg(r.ok ? "" : r.error); router.refresh(); })}>{x.active ? "Deactivate" : "Reactivate"}</Button>}
          </div>
        ))}
      </div>
      {edit && <StaffForm initial={edit} {...{ roles, branches, can }} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); router.refresh(); }} />}
    </div>
  );
}

function StaffForm({ initial, roles, branches, can, onClose, onSaved }: { initial: Partial<Staff>; roles: Props["roles"]; branches: Props["branches"]; can: Props["can"]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ fullName: initial.fullName ?? "", roleId: initial.roleId ?? roles[0]?.id ?? "", phone: initial.phone ?? "", cnic: initial.cnic ?? "", email: initial.email ?? "", password: "", pin: "", photoUrl: initial.photoUrl ?? "", salaryType: initial.salaryType ?? "monthly", salary: String(initial.salaryRupees ?? 0), branchIds: initial.branchIds ?? [] });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const upload = async (f: File | undefined) => {
    if (!f) return;
    const fd = new FormData(); fd.set("file", f);
    const r = await uploadImage(fd);
    if (r.ok) setV((x) => ({ ...x, photoUrl: r.url })); else setError(r.error);
  };
  const save = () => start(async () => {
    const r = await saveStaff({ id: initial.id, fullName: v.fullName, roleId: v.roleId, phone: v.phone || undefined, cnic: v.cnic || undefined, email: v.email || undefined, password: v.password || undefined, pin: v.pin || undefined, photoUrl: v.photoUrl || undefined, salaryType: v.salaryType, salaryRupees: Number(v.salary) || 0, branchIds: v.branchIds });
    if (r.ok) onSaved(); else setError(r.error);
  });
  return (
    <Modal title={initial.id ? "Edit staff" : "New staff"} onClose={onClose} width="max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex items-center gap-3">
          <Avatar url={v.photoUrl} name={v.fullName || "?"} size={64} />
          <label className="cursor-pointer rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold">Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
        </div>
        <div className="col-span-2"><Label>Full name</Label><Input aria-label="Full name" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} autoFocus /></div>
        <div><Label>Role</Label><select className={sel} value={v.roleId} onChange={(e) => setV({ ...v, roleId: e.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div><Label>Phone</Label><Input inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
        <div><Label>CNIC</Label><Input value={v.cnic} onChange={(e) => setV({ ...v, cnic: e.target.value })} placeholder="XXXXX-XXXXXXX-X" /></div>
        <div><Label>POS PIN {initial.id ? "(leave blank to keep)" : "(4–6 digits)"}</Label><Input aria-label="POS PIN" inputMode="numeric" value={v.pin} disabled={!!initial.id && !can.setPin} onChange={(e) => setV({ ...v, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></div>
        <div><Label>Back-office email (optional)</Label><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
        <div><Label>Password {initial.id ? "(leave blank to keep)" : ""}</Label><Input type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></div>
        {can.salary && (<>
          <div><Label>Pay type</Label><select className={sel} value={v.salaryType} onChange={(e) => setV({ ...v, salaryType: e.target.value as "monthly" | "hourly" })}><option value="monthly">Monthly salary</option><option value="hourly">Hourly</option></select></div>
          <div><Label>{v.salaryType === "monthly" ? "Monthly salary (Rs)" : "Hourly rate (Rs)"}</Label><Input inputMode="decimal" value={v.salary} onChange={(e) => setV({ ...v, salary: e.target.value })} /></div>
        </>)}
        <div className="col-span-2"><Label>Branches</Label>
          <div className="flex flex-wrap gap-2">{branches.map((b) => { const on = v.branchIds.includes(b.id); return <button key={b.id} type="button" onClick={() => setV({ ...v, branchIds: on ? v.branchIds.filter((x) => x !== b.id) : [...v.branchIds, b.id] })} className={cn("h-11 rounded-xl border-2 px-4 text-sm font-semibold", on ? "border-brand bg-brand/15" : "border-border bg-surface-2")}>{b.name}</button>; })}</div></div>
      </div>
      {error && <p className="mt-3 text-danger">{error}</p>}
      <Button size="lg" className="mt-4 w-full" disabled={pending} onClick={save}>Save</Button>
    </Modal>
  );
}

function Avatar({ url, name, size }: { url: string; name: string; size: number }) {
  // Photos are small uploads served by our own API; next/image optimisation is not needed.
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return <div className="flex items-center justify-center rounded-full bg-surface-2 font-bold" style={{ width: size, height: size }}>{name[0]}</div>;
}
