import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import type { Permission } from "@/lib/domain/permissions";

const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-only-secret-change-me-please-32chars");
const SESSION = "crsp_session";
const TERMINAL = "crsp_terminal";

type SessionClaims = { sid: string; bid: string; tid?: string; kind: "pos" | "admin" };
type TerminalClaims = { tid: string; bid: string };

async function sign(claims: object, ttl: string) {
  return new SignJWT({ ...claims }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(ttl).sign(secret);
}
async function verify<T>(token?: string): Promise<T | null> {
  if (!token) return null;
  try {
    return (await jwtVerify(token, secret)).payload as unknown as T;
  } catch {
    return null;
  }
}

const cookieOpts = { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" } as const;

export async function setSession(c: SessionClaims) {
  const ttl = c.kind === "pos" ? "12h" : "8h";
  (await cookies()).set(SESSION, await sign(c, ttl), { ...cookieOpts, maxAge: c.kind === "pos" ? 12 * 3600 : 8 * 3600 });
}
export async function clearSession() {
  (await cookies()).delete(SESSION);
}
export async function setTerminalCookie(c: TerminalClaims) {
  (await cookies()).set(TERMINAL, await sign(c, "3650d"), { ...cookieOpts, maxAge: 3650 * 86400 });
}
export const getTerminalClaims = cache(async () => verify<TerminalClaims>((await cookies()).get(TERMINAL)?.value));

export type Session = {
  staffId: string;
  name: string;
  roleKey: string;
  roleName: string;
  discountLimitBps: number;
  branchId: string;
  branchName: string;
  terminalId: string | null;
  terminalName: string | null;
  kind: "pos" | "admin";
  permissions: Set<Permission>;
  can: (p: Permission) => boolean;
};

export const getSession = cache(async (): Promise<Session | null> => {
  const claims = await verify<SessionClaims>((await cookies()).get(SESSION)?.value);
  if (!claims) return null;
  const db = await getDb();
  const [row] = await db
    .select({ staff: s.staff, role: s.roles, branch: s.branches })
    .from(s.staff)
    .innerJoin(s.roles, eq(s.roles.id, s.staff.roleId))
    .innerJoin(s.branches, eq(s.branches.id, claims.bid))
    .where(eq(s.staff.id, claims.sid));
  if (!row || !row.staff.isActive) return null;
  const perms = await db.select({ p: s.rolePermissions.permission }).from(s.rolePermissions).where(eq(s.rolePermissions.roleId, row.role.id));
  const permissions = new Set(perms.map((x) => x.p as Permission));
  let terminalName: string | null = null;
  if (claims.tid) {
    const [t] = await db.select({ name: s.terminals.name }).from(s.terminals).where(eq(s.terminals.id, claims.tid));
    terminalName = t?.name ?? null;
  }
  return {
    staffId: row.staff.id, name: row.staff.fullName, roleKey: row.role.key, roleName: row.role.name,
    discountLimitBps: row.role.discountLimitBps, branchId: row.branch.id, branchName: row.branch.name,
    terminalId: claims.tid ?? null, terminalName, kind: claims.kind, permissions, can: (p) => permissions.has(p),
  };
});

/** For pages/layouts: redirect when not signed in or missing permission. */
export async function requireSession(opts: { permission?: Permission; kind?: "pos" | "admin" } = {}) {
  const session = await getSession();
  if (!session) redirect(opts.kind === "admin" ? "/login" : "/pin");
  if (opts.permission && !session.can(opts.permission)) redirect("/forbidden");
  return session;
}

/** For server actions: throw instead of redirect. */
export class PermissionError extends Error {}
export async function requirePermission(p: Permission) {
  const session = await getSession();
  if (!session) throw new PermissionError("Not signed in");
  if (!session.can(p)) throw new PermissionError(`Missing permission: ${p}`);
  return session;
}

/** Short-lived proof that a manager approved one permission (manager PIN override). */
export async function signOverride(approverId: string, permission: Permission) {
  return sign({ aid: approverId, perm: permission }, "3m");
}
export async function readOverride(token: string | undefined | null, permission: Permission): Promise<string | null> {
  const c = await verify<{ aid: string; perm: string }>(token ?? undefined);
  return c && c.perm === permission ? c.aid : null;
}
