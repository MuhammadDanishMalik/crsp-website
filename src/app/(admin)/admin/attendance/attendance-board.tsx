"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { editAttendance, saveSchedule } from "@/lib/actions/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Rec = { id: string; status: string; clockIn: string; clockOut: string; minutes: number | null; note: string };
type Row = { staffId: string; name: string; scheduled: string; expected: boolean; records: Rec[] };
type Sched = Record<string, { weekday: number; start: string; end: string }[]>;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TONE: Record<string, string> = { present: "bg-success/20 text-success", late: "bg-warn/20 text-warn", absent: "bg-danger/20 text-danger", leave: "bg-surface-2 text-muted" };

export function AttendanceBoard({ date, rows, schedules }: { date: string; rows: Row[]; schedules: Sched }) {
  const router = useRouter();
  const [tab, setTab] = useState<"day" | "schedule">("day");
  const [edit, setEdit] = useState<null | { row: Row; rec?: Rec }>(null);
  const [sched, setSched] = useState<Row | null>(null);
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-surface p-1">{(["day", "schedule"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("h-10 rounded-lg px-4 font-semibold", tab === t ? "bg-brand text-brand-fg" : "text-muted")}>{t === "day" ? "Daily" : "Weekly schedules"}</button>)}</div>
        {tab === "day" && <input type="date" value={date} onChange={(e) => router.push(`/admin/attendance?date=${e.target.value}`)} className="h-12 rounded-xl border border-border bg-surface px-3" />}
      </div>
      {tab === "day" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((r) => {
            const absent = r.expected && !r.records.length;
            return (
              <div key={r.staffId} className="flex min-h-16 flex-wrap items-center gap-3 border-b border-border px-4 py-2 last:border-0">
                <div className="min-w-40 flex-1"><p className="font-semibold">{r.name}</p><p className="text-sm text-muted">{r.scheduled ? `Scheduled ${r.scheduled}` : "Not scheduled"}</p></div>
                {absent && <span className={cn("rounded-lg px-2 py-1 text-xs font-bold uppercase", TONE.absent)}>no record</span>}
                {r.records.map((rec) => (
                  <button key={rec.id} onClick={() => setEdit({ row: r, rec })} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    <span className={cn("rounded px-2 py-0.5 text-xs font-bold uppercase", TONE[rec.status])}>{rec.status}</span>
                    {rec.clockIn || "—"} → {rec.clockOut || "open"}{rec.minutes != null && ` · ${Math.floor(rec.minutes / 60)}h ${rec.minutes % 60}m`}
                  </button>
                ))}
                <Button variant="secondary" className="min-h-11" onClick={() => setEdit({ row: r })}>{absent ? "Mark / add" : "Add record"}</Button>
              </div>
            );
          })}
        </div>
      )}
      {tab === "schedule" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((r) => (
            <div key={r.staffId} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-0">
              <span className="w-48 font-semibold">{r.name}</span>
              <span className="flex-1 text-sm text-muted">{(schedules[r.staffId] ?? []).length ? (schedules[r.staffId] ?? []).map((d) => `${DAYS[d.weekday]} ${d.start}–${d.end}`).join(" · ") : "No schedule"}</span>
              <Button variant="secondary" className="min-h-11" onClick={() => setSched(r)}>Edit</Button>
            </div>
          ))}
        </div>
      )}
      {edit && <AttendanceForm date={date} {...edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); router.refresh(); }} />}
      {sched && <ScheduleForm row={sched} initial={schedules[sched.staffId] ?? []} onClose={() => setSched(null)} onSaved={() => { setSched(null); router.refresh(); }} />}
    </div>
  );
}

function AttendanceForm({ row, rec, date, onClose, onSaved }: { row: Row; rec?: Rec; date: string; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ status: rec?.status ?? (row.expected ? "absent" : "present"), cin: rec?.clockIn ?? "", cout: rec?.clockOut ?? "", note: rec?.note ?? "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await editAttendance({ id: rec?.id, staffId: row.staffId, date, status: v.status, clockIn: v.cin || undefined, clockOut: v.cout || undefined, note: v.note || undefined });
    if (r.ok) onSaved(); else setError(r.error);
  });
  return (
    <Modal title={`${row.name} · ${date}`} onClose={onClose} width="max-w-md">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">{["present", "late", "absent", "leave"].map((s) => <button key={s} onClick={() => setV({ ...v, status: s })} className={cn("h-12 flex-1 rounded-xl border-2 font-semibold capitalize", v.status === s ? "border-brand bg-brand/15" : "border-border bg-surface-2")}>{s}</button>)}</div>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm text-muted">Clock in<Input type="time" value={v.cin} onChange={(e) => setV({ ...v, cin: e.target.value })} /></label><label className="text-sm text-muted">Clock out<Input type="time" value={v.cout} onChange={(e) => setV({ ...v, cout: e.target.value })} /></label></div>
        <Input placeholder="Note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={save}>Save</Button>
      </div>
    </Modal>
  );
}

function ScheduleForm({ row, initial, onClose, onSaved }: { row: Row; initial: { weekday: number; start: string; end: string }[]; onClose: () => void; onSaved: () => void }) {
  const [days, setDays] = useState(() => DAYS.map((_, i) => { const d = initial.find((x) => x.weekday === i); return { on: !!d, start: d?.start ?? "10:00", end: d?.end ?? "22:00" }; }));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveSchedule(row.staffId, days.map((d, weekday) => ({ ...d, weekday })).filter((d) => d.on).map((d) => ({ weekday: d.weekday, start: d.start, end: d.end })));
    if (r.ok) onSaved(); else setError(r.error);
  });
  return (
    <Modal title={`Schedule · ${row.name}`} onClose={onClose} width="max-w-md">
      <div className="space-y-2">
        {days.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="flex w-20 items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={d.on} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />{DAYS[i]}</label>
            <Input type="time" disabled={!d.on} value={d.start} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
            <Input type="time" disabled={!d.on} value={d.end} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
          </div>
        ))}
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={save}>Save schedule</Button>
      </div>
    </Modal>
  );
}
