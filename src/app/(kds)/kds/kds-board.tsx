"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, RotateCcw, LogOut, CheckCircle2 } from "lucide-react";
import { bumpItem, bumpOrder, fetchKds, recallLast, startTicket } from "@/lib/actions/kds";
import { LogoutForm } from "@/components/logout-form";
import { useBranchEvents } from "@/lib/realtime/use-events";
import type { KdsData, KdsTicket } from "@/lib/queries/kds";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

const TYPE: Record<string, string> = { dine_in: "DINE-IN", takeaway: "TAKEAWAY", delivery: "DELIVERY", drive_thru: "DRIVE-THRU", online: "ONLINE" };

function beep() {
  try {
    const ctx = new AudioContext();
    [880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.18); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.16);
      o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.17);
    });
  } catch { /* audio blocked until first tap */ }
}

export function KdsBoard({ initial, stationId, who, canBump, canRecall, canPos }: { initial: KdsData; stationId: string | null; who: string; canBump: boolean; canRecall: boolean; canPos: boolean }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [skew] = useState(() => initial.serverNow - Date.now()); // server-vs-browser clock difference
  const seen = useRef(new Set(initial.tickets.map((t) => t.orderId)));
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  const refresh = useCallback(async () => {
    const d = await fetchKds(stationId);
    if (!d) return;
    const fresh = d.tickets.filter((t) => !seen.current.has(t.orderId));
    fresh.forEach((t) => seen.current.add(t.orderId));
    if (fresh.length && soundRef.current) beep();
    setData(d);
  }, [stationId]);
  useBranchEvents(() => { void refresh(); }, 10_000);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const station = data.stations.find((s) => s.id === stationId);
  const warn = station?.warnSeconds ?? 300, late = station?.lateSeconds ?? 600;
  const act = async (fn: () => Promise<unknown>) => { await fn(); await refresh(); };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <Logo height={32} />
        <h1 className="mr-2 text-lg font-bold">Kitchen</h1>
        <div className="flex gap-1 rounded-2xl bg-surface-2 p-1">
          <button onClick={() => router.push("/kds")} className={cn("h-12 rounded-xl px-4 font-semibold", !stationId ? "bg-brand text-brand-fg" : "text-muted")}>All</button>
          {data.stations.map((s) => (
            <button key={s.id} onClick={() => router.push(`/kds?station=${s.id}`)} className={cn("h-12 rounded-xl px-4 font-semibold", stationId === s.id ? "bg-brand text-brand-fg" : "text-muted")}>{s.name}</button>
          ))}
        </div>
        <span className="ml-auto text-muted">{data.tickets.length} open</span>
        {canRecall && (
          <button disabled={!data.lastBumped} onClick={() => act(recallLast)} className="flex h-12 items-center gap-2 rounded-xl bg-surface-2 px-4 font-semibold">
            <RotateCcw size={18} />Recall {data.lastBumped ? `#${data.lastBumped.orderNo}` : ""}
          </button>
        )}
        <button onClick={() => { setSound((v) => !v); if (!sound) beep(); }} className={cn("flex h-12 items-center gap-2 rounded-xl px-4 font-semibold", sound ? "bg-success/20 text-success" : "bg-surface-2")}>
          {sound ? <Bell size={18} /> : <BellOff size={18} />}{sound ? "Sound on" : "Sound off"}
        </button>
        {canPos && <button onClick={() => router.push("/order")} className="h-12 rounded-xl px-3 text-muted">POS</button>}
        <span className="text-sm text-muted">{who}</span>
        <LogoutForm><button aria-label="Sign out" className="flex h-12 w-12 items-center justify-center rounded-xl hover:bg-surface-2"><LogOut size={20} /></button></LogoutForm>
      </header>
      <div className="scroll-thin grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(280px,1fr))] content-start gap-3 overflow-y-auto p-3">
        {data.tickets.map((t) => (
          <Ticket key={t.orderId} t={t} elapsed={Math.max(0, Math.floor((now + skew - new Date(t.createdAt).getTime()) / 1000))} warn={warn} late={late} canBump={canBump}
            onStart={() => act(() => startTicket(t.orderId))} onBumpItem={(id) => act(() => bumpItem(id))} onBumpOrder={() => act(() => bumpOrder(t.orderId, stationId))} />
        ))}
        {!data.tickets.length && <p className="col-span-full mt-24 text-center text-2xl text-muted">All caught up 🎉</p>}
      </div>
    </div>
  );
}

function Ticket({ t, elapsed, warn, late, canBump, onStart, onBumpItem, onBumpOrder }: { t: KdsTicket; elapsed: number; warn: number; late: number; canBump: boolean; onStart: () => void; onBumpItem: (id: string) => void; onBumpOrder: () => void }) {
  const level = elapsed >= late ? "late" : elapsed >= warn ? "warn" : "ok";
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const [busy, setBusy] = useState(false);
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border-2 bg-surface", level === "late" ? "border-danger" : level === "warn" ? "border-warn" : "border-border")}>
      <button onClick={onStart} disabled={!canBump || t.started} className={cn("flex items-center justify-between px-4 py-3 text-left", level === "late" ? "bg-danger text-white" : level === "warn" ? "bg-warn text-black" : "bg-surface-2")}>
        <span><span className="text-2xl font-black">#{t.orderNo}</span><span className="ml-2 text-xs font-bold opacity-80">{TYPE[t.type] ?? t.type}{t.tableNo ? ` · T${t.tableNo}` : ""}</span></span>
        <span className="text-xl font-bold tabular-nums">{mm}</span>
      </button>
      <div className="flex-1 divide-y divide-border">
        {t.items.map((i) => {
          const done = i.status === "bumped";
          return (
            <button key={i.id} disabled={!canBump || done} onClick={() => onBumpItem(i.id)} className={cn("block min-h-14 w-full px-4 py-2 text-left", done && "opacity-40 line-through")}>
              <span className="text-lg font-bold">{i.qty}× {i.name}</span>
              {i.mods.map((m) => <span key={m} className="block pl-4 text-sm text-muted">+ {m}</span>)}
              {i.note && <span className="block pl-4 text-sm font-semibold text-accent">“{i.note}”</span>}
            </button>
          );
        })}
      </div>
      {canBump && (
        <button disabled={busy} onClick={() => { setBusy(true); onBumpOrder(); }} className="flex h-20 items-center justify-center gap-3 bg-success text-2xl font-black text-white active:brightness-90 disabled:opacity-60">
          <CheckCircle2 size={32} />{busy ? "COMPLETING…" : "DONE"}
        </button>
      )}
    </div>
  );
}
