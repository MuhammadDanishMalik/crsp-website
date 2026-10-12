import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALES = ["en", "ur"] as const;
export type Locale = (typeof LOCALES)[number];

/** Language is a per-device cookie (cashiers switch on the till); there are no /en /ur URLs. */
export default getRequestConfig(async () => {
  const c = (await cookies()).get("crsp_locale")?.value;
  const locale: Locale = c === "ur" ? "ur" : "en";
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
