import { z } from "zod";
import { PermissionError } from "@/lib/auth/session";

export type R = { ok: true; message?: string } | { ok: false; error: string };
export class UserError extends Error {}

/** Shared wrapper for server actions: turns expected failures into `{ ok:false, error }`. */
export async function guard(fn: () => Promise<R>): Promise<R> {
  try { return await fn(); } catch (e) {
    if (e instanceof PermissionError || e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}
