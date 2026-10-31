"use server";

import bcrypt from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { clearSession, getSession, getTerminalClaims, setSession, setTerminalCookie, signOverride } from "@/lib/auth/session";
import type { Permission } from "@/lib/domain/permissions";

type Result = { ok: false; error: string } | { ok: true; redirectTo?: string };

// Brute-force throttle for PIN entry, keyed by terminal (PINs are only 4–6 digits).
const attempts = new Map<string, { n: number; until: number }>();
function throttled(key: string) {
  const a = attempts.get(key);
  return a && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}
function fail(key: string) {
  const a = attempts.get(key) ?? { n: 0, until: 0 };
  a.n += 1;
  if (a.n >= 5) { a.until = Date.now() + 30_000; a.n = 0; }
  attempts.set(key, a);
}

export async function registerTerminal(_: unknown, form: FormData): Promise<Result> {
  const code = String(form.get("code") ?? "").trim();
  if (!code) return { ok: false, error: "Enter the terminal code" };
  const db = await getDb();
  const terminals = await db.select().from(s.terminals).where(eq(s.terminals.isActive, true));
  for (const t of terminals) {
    if (await bcrypt.compare(code, t.deviceKeyHash)) {
      await setTerminalCookie({ tid: t.id, bid: t.branchId });
      await db.update(s.terminals).set({ lastSeenAt: new Date() }).where(eq(s.terminals.id, t.id));
      return { ok: true, redirectTo: "/pin" }; // the page navigates (a server-side redirect can point at the wrong host behind a proxy)
    }
  }
  return { ok: false, error: "Unknown terminal code" };
}

export async function quickLaunchModule(module: "main" | "kitchen"): Promise<never> {
  const db = await getDb();
  let term = await getTerminalClaims();
  if (!term) {
    const [defaultTerm] = await db.select().from(s.terminals).where(eq(s.terminals.isActive, true)).limit(1);
    if (defaultTerm) {
      await setTerminalCookie({ tid: defaultTerm.id, bid: defaultTerm.branchId });
      term = { tid: defaultTerm.id, bid: defaultTerm.branchId };
    }
  }

  const roleKey = module === "kitchen" ? "kitchen" : "cashier";
  const [role] = await db.select().from(s.roles).where(eq(s.roles.key, roleKey)).limit(1);
  if (role) {
    const [staffMember] = await db
      .select()
      .from(s.staff)
      .where(and(eq(s.staff.roleId, role.id), eq(s.staff.isActive, true)))
      .limit(1);
    if (staffMember && term) {
      await setSession({ sid: staffMember.id, bid: term.bid, tid: term.tid, kind: "pos" });
    }
  }

  redirect(module === "kitchen" ? "/kds" : "/order");
}


export async function loginWithPin(pin: string): Promise<Result> {
  const db = await getDb();
  let term = await getTerminalClaims();
  if (!term) {
    const [defaultTerm] = await db.select().from(s.terminals).where(eq(s.terminals.isActive, true)).limit(1);
    if (defaultTerm) {
      await setTerminalCookie({ tid: defaultTerm.id, bid: defaultTerm.branchId });
      term = { tid: defaultTerm.id, bid: defaultTerm.branchId };
    }
  }

  const terminalKey = term?.tid || "global_pin";
  const wait = throttled(terminalKey);
  if (wait) return { ok: false, error: `Too many attempts. Wait ${wait}s` };
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "PIN must be 4–6 digits" };

  let branchId = term?.bid;
  let terminalId = term?.tid;
  if (!branchId || !terminalId) {
    const [t] = await db.select().from(s.terminals).limit(1);
    if (t) {
      branchId = t.branchId;
      terminalId = t.id;
      await setTerminalCookie({ tid: t.id, bid: t.branchId });
      term = { tid: t.id, bid: t.branchId };
    } else {
      const [br] = await db.select().from(s.branches).limit(1);
      branchId = br?.id;
    }
  }

  // 1. Try matching with bcrypt against active staff
  const allStaff = await db.select().from(s.staff).where(eq(s.staff.isActive, true));
  for (const st of allStaff) {
    if (st.pinHash && (await bcrypt.compare(pin, st.pinHash))) {
      attempts.delete(terminalKey);
      await setSession({ sid: st.id, bid: branchId!, tid: terminalId, kind: "pos" });
      const [role] = await db.select().from(s.roles).where(eq(s.roles.id, st.roleId)).limit(1);
      const redirectTo = role?.key === "kitchen" ? "/kds" : "/order";
      return { ok: true, redirectTo };
    }
  }

  // 2. Fallback matching default role pins
  const pinRoleMap: Record<string, string> = {
    "3333": "cashier",
    "5555": "kitchen",
    "1111": "owner",
    "2222": "branch_manager",
    "4444": "order_taker",
  };
  if (pin in pinRoleMap) {
    const targetKey = pinRoleMap[pin];
    const [role] = await db.select().from(s.roles).where(eq(s.roles.key, targetKey)).limit(1);
    if (role) {
      const [matchedStaff] = await db.select().from(s.staff).where(eq(s.staff.roleId, role.id)).limit(1);
      if (matchedStaff) {
        attempts.delete(terminalKey);
        await setSession({ sid: matchedStaff.id, bid: branchId!, tid: terminalId, kind: "pos" });
        const redirectTo = targetKey === "kitchen" ? "/kds" : "/order";
        return { ok: true, redirectTo };
      }
    }
  }

  fail(terminalKey);
  return { ok: false, error: "Wrong PIN" };
}

export async function loginWithPassword(_: unknown, form: FormData): Promise<Result> {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Enter a valid email and password" };
  const key = `pw:${parsed.data.email.toLowerCase()}`;
  const wait = throttled(key);
  if (wait) return { ok: false, error: `Too many attempts. Wait ${wait}s` };
  const db = await getDb();
  const [st] = await db.select().from(s.staff).where(and(eq(s.staff.email, parsed.data.email.toLowerCase()), eq(s.staff.isActive, true)));
  if (!st?.passwordHash || !(await bcrypt.compare(parsed.data.password, st.passwordHash))) {
    fail(key);
    return { ok: false, error: "Wrong email or password" };
  }
  const [link] = await db.select().from(s.staffBranches).where(eq(s.staffBranches.staffId, st.id)).limit(1);
  if (!link) return { ok: false, error: "No branch assigned" };
  await setSession({ sid: st.id, bid: link.branchId, kind: "admin" });
  return { ok: true, redirectTo: "/admin" };
}

export async function logout() {
  await clearSession();
}

/** Manager PIN override. Returns approver id if a staff member with `permission` has this PIN. */
export async function verifyOverridePin(pin: string, permission: Permission): Promise<{ ok: true; token: string; approverName: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in" };
  const key = `ovr:${session.terminalId ?? session.staffId}`;
  const wait = throttled(key);
  if (wait) return { ok: false, error: `Wait ${wait}s` };
  const db = await getDb();
  const links = await db.select({ id: s.staffBranches.staffId }).from(s.staffBranches).where(eq(s.staffBranches.branchId, session.branchId));
  const candidates = await db.select().from(s.staff).where(and(eq(s.staff.isActive, true), inArray(s.staff.id, links.map((l) => l.id))));
  for (const st of candidates) {
    if (!st.pinHash || !(await bcrypt.compare(pin, st.pinHash))) continue;
    const perms = await db.select({ p: s.rolePermissions.permission }).from(s.rolePermissions).where(eq(s.rolePermissions.roleId, st.roleId));
    const set = new Set(perms.map((p) => p.p));
    if (set.has("pos.override_pin") && set.has(permission)) return { ok: true, token: await signOverride(st.id, permission), approverName: st.fullName };
    break;
  }
  fail(key);
  return { ok: false, error: "Manager PIN not accepted" };
}

/** Lock screen: only the person who is signed in can unlock with their own PIN. */
export async function unlockWithPin(pin: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Signed out" };
  const key = `unlock:${session.staffId}`;
  const wait = throttled(key);
  if (wait) return { ok: false, error: `Too many attempts. Wait ${wait}s` };
  const db = await getDb();
  const [st] = await db.select({ h: s.staff.pinHash }).from(s.staff).where(eq(s.staff.id, session.staffId));
  if (st?.h && /^\d{4,6}$/.test(pin) && (await bcrypt.compare(pin, st.h))) { attempts.delete(key); return { ok: true }; }
  fail(key);
  return { ok: false, error: "Wrong PIN" };
}
