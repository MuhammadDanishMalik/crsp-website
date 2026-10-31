"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { openShift } from "@/lib/actions/shift";
import { LogoutForm } from "@/components/logout-form";
import { Numpad } from "@/components/pos/numpad";
import { Button } from "@/components/ui/button";
import { formatPKR } from "@/lib/domain/money";
import { useTranslations } from "next-intl";

export function OpenShift({ name, canOpen }: { name: string; canOpen: boolean }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useTranslations("shift");
  const amount = Number(digits || 0) * 100;
  return (
    <main className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold">{t("openTitle")}</h1>
        <p className="mb-4 text-muted">{name} — {t("openHint")}</p>
        <div className="mb-4 rounded-2xl bg-surface-2 p-4 text-right text-4xl font-bold tabular-nums">{formatPKR(amount)}</div>
        <Numpad onDigit={(d) => setDigits((v) => (v + d).replace(/^0+/, "").slice(0, 7))} onBackspace={() => setDigits((v) => v.slice(0, -1))} onClear={() => setDigits("")} />
        {error && <p className="mt-3 text-danger">{error}</p>}
        <Button size="xl" className="mt-4 w-full" disabled={pending || !canOpen}
          onClick={() => start(async () => { const r = await openShift(amount); if (r.ok) router.refresh(); else setError(r.error); })}>
          {canOpen ? t("open") : "—"}
        </Button>
        <LogoutForm><Button variant="ghost" className="mt-2 w-full">{t("switchUser")}</Button></LogoutForm>
      </div>
    </main>
  );
}
