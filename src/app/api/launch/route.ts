import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { getTerminalClaims, setSession, setTerminalCookie } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mod = searchParams.get("module") ?? "main";
  const redirectTarget = mod === "kitchen" ? "/kds" : "/order";

  try {
    const db = await getDb();
    let term = await getTerminalClaims();
    if (!term) {
      const [defaultTerm] = await db.select().from(s.terminals).where(eq(s.terminals.isActive, true)).limit(1);
      if (defaultTerm) {
        await setTerminalCookie({ tid: defaultTerm.id, bid: defaultTerm.branchId });
        term = { tid: defaultTerm.id, bid: defaultTerm.branchId };
      }
    }

    const roleKey = mod === "kitchen" ? "kitchen" : "cashier";
    const [role] = await db.select().from(s.roles).where(eq(s.roles.key, roleKey)).limit(1);
    if (role && term) {
      const [staffMember] = await db
        .select()
        .from(s.staff)
        .where(and(eq(s.staff.roleId, role.id), eq(s.staff.isActive, true)))
        .limit(1);
      if (staffMember) {
        await setSession({ sid: staffMember.id, bid: term.bid, tid: term.tid, kind: "pos" });
      }
    }
  } catch (err) {
    console.error("Auto-launch error:", err);
  }

  return NextResponse.redirect(new URL(redirectTarget, req.url));
}
