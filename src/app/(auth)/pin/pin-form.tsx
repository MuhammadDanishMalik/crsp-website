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
      if (r.ok) router.replace("/");
      else { setError(r.error); setPin(""); }
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
      <button
        type="button" disabled={pin.length < 4 || pending} onClick={() => submit(pin)}
        className="mt-3 h-16 w-full rounded-2xl bg-brand text-xl font-bold text-brand-fg"
      >
        {tc("ok")}
      </button>
      <button type="button" onClick={() => { setClock((c) => !c); setPin(""); setError(""); setInfo(""); }} className="mt-4 block w-full text-center text-sm text-muted underline">{clock ? t("backToSignIn") : t("clock")}</button>
      <a href="/start" className="mt-2 block text-center text-sm text-muted underline">{t("entrances")}</a>
      <a href="/login" className="mt-2 block text-center text-sm text-muted underline">{t("backOffice")}</a>
      <div className="mt-3 flex justify-center"><LocaleToggle /></div>
    </AuthShell>
  );
}
