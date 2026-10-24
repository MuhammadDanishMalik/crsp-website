"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loginWithPin } from "@/lib/actions/auth";
import { clockWithPin } from "@/lib/actions/attendance";
import { Numpad } from "@/components/pos/numpad";
import { AuthShell } from "../shell";
import { useTranslations } from "next-intl";
import { LocaleToggle } from "@/components/locale-toggle";

export function PinForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(false); // clock in/out mode: identifies by PIN but starts no session
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useTranslations("pin");
  const tc = useTranslations("common");

  const submit = (value: string) =>
    start(async () => {
      if (clock) {
        const r = await clockWithPin(value);
        if (r.ok) { setInfo(r.message); setError(""); setTimeout(() => setInfo(""), 6000); } else setError(r.error);
        return setPin("");
      }
      const r = await loginWithPin(value);
      if (r.ok) {
        window.location.href = r.redirectTo || "/order";
      } else {
        setError(r.error);
        setPin("");
      }
    });

  const push = (d: string) => {
    if (pending || pin.length >= 6) return;
    setError("");
    const next = pin + d;
    setPin(next);
    if (next.length === 6) submit(next);
  };

  return (
    <AuthShell title={clock ? t("clockTitle") : t("title")} subtitle={clock ? t("clockHint") : t("hint")}>
      <div className="mb-4 flex justify-center gap-3" aria-label="PIN entry">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? "border-brand bg-brand" : "border-border"}`} />
        ))}
      </div>
      <p className="mb-3 min-h-6 text-center text-danger">{error}{info && <span className="text-success">{info}</span>}</p>
      <Numpad onDigit={push} onBackspace={() => setPin((p) => p.slice(0, -1))} onClear={() => setPin("")} />
      {process.env.NODE_ENV !== "production" && ( // demo shortcuts: development only, the PINs are public
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("1111")}
          className="flex h-11 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/10 text-xs font-bold text-blue-500 hover:bg-blue-500/20"
        >
          👑 Admin (1111)
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("3333")}
          className="flex h-11 items-center justify-center rounded-xl border border-brand/40 bg-brand/10 text-xs font-bold text-brand hover:bg-brand/20"
        >
          🖥️ Counter (3333)
        </button>
      </div>
      )}

      <button
        type="button" disabled={pin.length < 4 || pending} onClick={() => submit(pin)}
        className="mt-3 h-16 w-full rounded-2xl bg-brand text-xl font-bold text-brand-fg"
      >
        {tc("ok")}
      </button>
      <a href="/login" className="mt-4 block text-center text-sm text-muted underline">Admin Email Login</a>
      <a href="/start" className="mt-2 block text-center text-sm text-muted underline">Back to Portals</a>
      <div className="mt-3 flex justify-center"><LocaleToggle /></div>
    </AuthShell>
  );
}
