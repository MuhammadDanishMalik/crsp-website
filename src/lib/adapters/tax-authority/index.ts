import { mockAdapter } from "./mock";
import { restAdapter } from "./rest";
import type { TaxAuthorityAdapter } from "./types";

export * from "./types";

/**
 * Pick the adapter for a branch's authority. With no credentials: development falls back to the mock so the whole flow
 * can be tried; production returns null, which keeps invoices queued ("credentials missing") instead of faking numbers.
 */
export function getTaxAdapter(authority: "fbr" | "pra" | "none"): TaxAuthorityAdapter | null {
  if (authority === "none") return null;
  const real = restAdapter(authority === "fbr" ? "FBR" : "PRA");
  if (real) return real;
  return process.env.NODE_ENV !== "production" || process.env.TAX_AUTHORITY_MOCK === "1" ? mockAdapter : null;
}

/** Backoff for the retry queue: 1, 2, 4, … capped at 60 minutes. */
export const retryDelayMinutes = (attempts: number) => Math.min(60, 2 ** Math.max(0, attempts - 1));
