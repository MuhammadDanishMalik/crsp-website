"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/lib/actions/locale";
import { cn } from "@/lib/utils";

/** English ⇄ اردو. Changes only this device. */
export function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await setLocale(locale === "ur" ? "en" : "ur"); router.refresh(); })}
      className={cn("flex h-12 min-w-12 items-center justify-center rounded-xl px-3 text-sm font-semibold hover:bg-surface-2", className)}>{t("language")}</button>
  );
}
