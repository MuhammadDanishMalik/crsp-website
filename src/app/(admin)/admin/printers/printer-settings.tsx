"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removePrinter, saveStation, savePrinter, setCategoryStation } from "@/lib/actions/printers";
import { getTestPrintJob } from "@/lib/actions/print";
import { bridgeAlive, sendToBridge } from "@/lib/adapters/printers/bridge-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

type Printer = { id: string; name: string; role: "receipt" | "kot"; connection: string; address: string; port: number; paperWidthMm: 58 | 80; openDrawer: boolean };
type Station = { id: string; name: string; printerId: string | null; warnMinutes: number; lateMinutes: number };
type Cat = { id: string; name: string; stationId: string | null };
const sel = "min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3";

export function PrinterSettings({ printers, stations, categories }: { printers: Printer[]; stations: Station[]; categories: Cat[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [edit, setEdit] = useState<Partial<Printer> | null>(null);
  const [msg, setMsg] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok = "") => start(async () => { const r = await fn(); setMsg(r.ok ? ok : (r.error ?? "")); router.refresh(); });

  const test = (id: string) => start(async () => {
    const alive = await bridgeAlive();
    if (!alive) return setMsg("Print bridge is not running on this PC. Start it with: npm run bridge");
    const j = await getTestPrintJob(id);
    if (!j.ok) return setMsg(j.error);
    const r = await sendToBridge(j.target, Uint8Array.from(atob(j.data), (c) => c.charCodeAt(0)));
    setMsg(r.ok ? "Test page sent" : `Failed: ${r.error}`);
  });

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold">Printers & kitchen</h1>
      {msg && <p className="rounded-xl bg-accent/20 p-3">{msg}</p>}

      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">Printers</h2><Button onClick={() => setEdit({ role: "kot", connection: "lan", port: 9100, paperWidthMm: 80, openDrawer: false })}>+ Add printer</Button></div>
        {printers.map((p) => (
          <div key={p.id} className="mb-2 flex items-center gap-3 rounded-xl bg-surface p-3">
            <div className="flex-1"><p className="font-semibold">{p.name} <span className="ml-2 rounded bg-surface-2 px-2 py-0.5 text-xs uppercase">{p.role === "kot" ? "Kitchen" : "Receipt"}</span></p>
              <p className="text-sm text-muted">{p.connection.toUpperCase()} {p.address && `${p.address}:${p.port}`} · {p.paperWidthMm}mm{p.openDrawer ? " · opens drawer" : ""}</p></div>
            <Button variant="secondary" onClick={() => test(p.id)}>Test print</Button>
            <Button variant="secondary" onClick={() => setEdit(p)}>Edit</Button>
            <Button variant="ghost" className="text-danger" onClick={() => confirm(`Remove ${p.name}?`) && run(() => removePrinter(p.id))}>Remove</Button>
          </div>
        ))}
        <p className="text-sm text-muted">Only LAN printers work with the local print bridge for now. USB / Bluetooth arrive with the desktop app (Phase 5).</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Kitchen stations</h2>
        {stations.map((st) => <StationRow key={st.id} st={st} printers={printers.filter((p) => p.role === "kot")} onSave={(v) => run(() => saveStation(v), "Saved")} />)}
        <StationRow st={{ id: "", name: "", printerId: null, warnMinutes: 5, lateMinutes: 10 }} isNew printers={printers.filter((p) => p.role === "kot")} onSave={(v) => run(() => saveStation(v), "Station added")} />
        <p className="text-sm text-muted">Ticket timers turn yellow after the warning time and red after the late time.</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Menu category → station</h2>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3"><span className="font-medium">{c.name}</span>
              <select className="min-h-11 rounded-lg border border-border bg-surface-2 px-2" value={c.stationId ?? ""} onChange={(e) => run(() => setCategoryStation(c.id, e.target.value || null), "Routing updated")}>
                <option value="">— none —</option>{stations.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select></label>
          ))}
        </div>
      </section>

      {edit && <PrinterForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); router.refresh(); }} />}
    </div>
  );
}

function StationRow({ st, printers, isNew, onSave }: { st: Station; printers: Printer[]; isNew?: boolean; onSave: (v: unknown) => void }) {
  const [v, setV] = useState({ name: st.name, printerId: st.printerId ?? "", warn: String(st.warnMinutes), late: String(st.lateMinutes) });
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
      <Input className="w-44" placeholder="New station name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      <select className={sel + " w-48"} value={v.printerId} onChange={(e) => setV({ ...v, printerId: e.target.value })}><option value="">No printer (KDS only)</option>{printers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <Input className="w-20" inputMode="decimal" value={v.warn} onChange={(e) => setV({ ...v, warn: e.target.value })} aria-label="Warning minutes" /><span className="text-sm">min warn</span>
      <Input className="w-20" inputMode="decimal" value={v.late} onChange={(e) => setV({ ...v, late: e.target.value })} aria-label="Late minutes" /><span className="text-sm">min late</span>
      <Button onClick={() => { onSave({ id: st.id || undefined, name: v.name, printerId: v.printerId || null, warnMinutes: Number(v.warn), lateMinutes: Number(v.late) }); if (isNew) setV({ ...v, name: "" }); }}>{isNew ? "Add" : "Save"}</Button>
    </div>
  );
}

function PrinterForm({ initial, onClose, onSaved }: { initial: Partial<Printer>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: initial.name ?? "", role: initial.role ?? "kot", connection: initial.connection ?? "lan", address: initial.address ?? "", port: String(initial.port ?? 9100), paper: String(initial.paperWidthMm ?? 80), drawer: initial.openDrawer ?? false });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await savePrinter({ id: initial.id, name: v.name, role: v.role, connection: v.connection, address: v.address || undefined, port: Number(v.port) || 9100, paperWidthMm: Number(v.paper) === 58 ? 58 : 80, openDrawer: v.drawer });
    if (r.ok) onSaved(); else setError(r.error);
  });
  return (
    <Modal title={initial.id ? "Edit printer" : "Add printer"} onClose={onClose} width="max-w-md">
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Use for</Label><select className={sel} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as "kot" | "receipt" })}><option value="receipt">Receipts</option><option value="kot">Kitchen tickets</option></select></div>
          <div><Label>Paper</Label><select className={sel} value={v.paper} onChange={(e) => setV({ ...v, paper: e.target.value })}><option value="80">80 mm</option><option value="58">58 mm</option></select></div>
        </div>
        <div><Label>Connection</Label><select className={sel} value={v.connection} onChange={(e) => setV({ ...v, connection: e.target.value })}><option value="lan">LAN / Wi-Fi (IP)</option><option value="usb">USB</option><option value="bluetooth">Bluetooth</option><option value="serial">Serial</option></select></div>
        {v.connection === "lan" && <div className="grid grid-cols-[1fr_100px] gap-3"><div><Label>IP address</Label><Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} placeholder="192.168.1.50" /></div><div><Label>Port</Label><Input value={v.port} onChange={(e) => setV({ ...v, port: e.target.value })} /></div></div>}
        {v.role === "receipt" && <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={v.drawer} onChange={(e) => setV({ ...v, drawer: e.target.checked })} />Open cash drawer on cash payments</label>}
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={save}>Save</Button>
      </div>
    </Modal>
  );
}
