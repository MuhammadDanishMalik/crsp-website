"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { logout, unlockWithPin } from "@/lib/actions/auth";
import { Numpad } from "./numpad";

/**
 * Locks the screen after `lockMinutes` without touching it (the cart stays as it is) and signs the person out after
 * `signOutMinutes` in total. Orders already saved offline stay on the device and upload at the next login.
 */
export function IdleLock({ lockMinutes, name }: { lockMinutes: number; name: string }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const last = useRef(0);
  const signOutMs = Math.max(lockMinutes * 4, 20) * 60_000;

  const touch = useCallback(() => { last.current = Date.now(); }, []);
  useEffect(() => {
    touch();
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle > signOutMs) void logout();
      else if (idle > lockMinutes * 60_000) setLocked(true);
    }, 5000);
    return () => { events.forEach((e) => window.removeEventListener(e, touch)); clearInterval(timer); };
  }, [lockMinutes, signOutMs, touch]);

  const submit = (value: string) => start(async () => {
    const r = await unlockWithPin(value);
    if (r.ok) { setLocked(false); setPin(""); setError(""); touch(); } else { setError(r.error); setPin(""); }
  });
  if (!locked) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8 text-center shadow-2xl">
        <Lock className="mx-auto mb-2 text-brand" size={36} />
        <h2 className="text-xl font-bold">Screen locked</h2><p className="mb-3 text-sm text-muted">{name}, enter your PIN</p>
        <div className="mb-2 flex justify-center gap-3">{Array.from({ length: 6 }, (_, i) => <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? "border-brand bg-brand" : "border-border"}`} />)}</div>
        <p className="mb-2 h-6 text-danger">{error}</p>
        <Numpad onDigit={(d) => { if (pending || pin.length >= 6) return; setError(""); const n = pin + d; setPin(n); if (n.length === 6) submit(n); }} onBackspace={() => setPin((p) => p.slice(0, -1))} onClear={() => setPin("")} />
        <button disabled={pin.length < 4 || pending} onClick={() => submit(pin)} className="mt-3 h-14 w-full rounded-2xl bg-brand text-lg font-bold text-brand-fg">Unlock</button>
        <button onClick={() => logout()} className="mt-3 text-sm text-muted underline">Sign out instead</button>
      </div>
    </div>
  );
}
