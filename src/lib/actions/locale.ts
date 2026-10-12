"use server";

import { cookies } from "next/headers";

export async function setLocale(locale: "en" | "ur") {
  (await cookies()).set("crsp_locale", locale === "ur" ? "ur" : "en", { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
}
