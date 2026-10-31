import { NextResponse } from "next/server";

/** A redirect with a RELATIVE Location. NextResponse.redirect needs an absolute URL built from req.url, which behind a proxy points at localhost:3000. */
const redirectTo = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path } });
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import {
  createToken,
  SESSION,
  TERMINAL,
  cookieOpts,
} from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";

/**
 * One-click sign-in for development ONLY. On a public site this would let anybody walk in as the owner, so in production it is
 * off: the buttons that point here simply land on the normal sign-in page. (To force it on a private network: ALLOW_QUICK_LAUNCH=1. Not recommended.)
 */
const QUICK_LAUNCH = process.env.NODE_ENV !== "production" || process.env.ALLOW_QUICK_LAUNCH === "1";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (!QUICK_LAUNCH) return redirectTo(searchParams.get("module") === "admin" ? "/login" : "/pin");
  const mod = searchParams.get("module") ?? "counter";
  const isAdmin = mod === "admin";
  const redirectTarget = isAdmin ? "/admin" : "/order";
  const response = redirectTo(redirectTarget);

  try {
    const db = await getDb();

    // 1. Terminal resolution
    let [defaultTerm] = await db
      .select()
      .from(s.terminals)
      .where(eq(s.terminals.isActive, true))
      .limit(1);

    if (!defaultTerm) {
      const [branch] = await db.select().from(s.branches).limit(1);
      if (branch) {
        const [createdTerm] = await db
          .insert(s.terminals)
          .values({
            branchId: branch.id,
            name: "POS-1",
            orderNoPrefix: "A",
            deviceKeyHash: "$2a$08$exampleHashPlaceholder",
          })
          .returning();
        defaultTerm = createdTerm;
      }
    }

    if (defaultTerm) {
      const termToken = await createToken(
        { tid: defaultTerm.id, bid: defaultTerm.branchId },
        "3650d"
      );
      response.cookies.set(TERMINAL, termToken, {
        ...cookieOpts,
        maxAge: 3650 * 86400,
      });

      // 2. Staff resolution (Only 2 user roles: Admin or Counter)
      const targetRoleKey = isAdmin ? "owner" : "cashier";
      const [role] = await db
        .select()
        .from(s.roles)
        .where(eq(s.roles.key, targetRoleKey))
        .limit(1);

      let staffMember = role
        ? (
            await db
              .select()
              .from(s.staff)
              .where(
                and(
                  eq(s.staff.roleId, role.id),
                  eq(s.staff.isActive, true)
                )
              )
              .limit(1)
          )[0]
        : null;

      if (!staffMember) {
        const [anyStaff] = await db
          .select()
          .from(s.staff)
          .where(eq(s.staff.isActive, true))
          .limit(1);
        staffMember = anyStaff;
      }

      if (staffMember) {
        const sessionToken = await createToken(
          {
            sid: staffMember.id,
            bid: defaultTerm.branchId,
            tid: defaultTerm.id,
            kind: isAdmin ? "admin" : "pos",
            role: targetRoleKey,
          },
          isAdmin ? "8h" : "12h"
        );
        response.cookies.set(SESSION, sessionToken, {
          ...cookieOpts,
          maxAge: (isAdmin ? 8 : 12) * 3600,
        });

        // 3. For Counter POS: Ensure an open shift exists so cashier goes straight to taking orders
        if (!isAdmin) {
          const [existingShift] = await db
            .select()
            .from(s.shifts)
            .where(
              and(
                eq(s.shifts.terminalId, defaultTerm.id),
                eq(s.shifts.staffId, staffMember.id),
                eq(s.shifts.status, "open")
              )
            )
            .limit(1);

          if (!existingShift) {
            await db.insert(s.shifts).values({
              branchId: defaultTerm.branchId,
              terminalId: defaultTerm.id,
              staffId: staffMember.id,
              openedAt: new Date(),
              openingFloat: 500000,
              status: "open",
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("Auto-launch error:", err);
  }

  return response;
}
