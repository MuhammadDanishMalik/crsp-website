"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { PermissionError, requirePermission } from "@/lib/auth/session";
import { getOpenShift, shiftSummary } from "@/lib/queries/shift";

type R = { ok: true } | { ok: false; error: string };
const wrap = async (fn: () => Promise<R>): Promise<R> => {
  try { return await fn(); } catch (e) {
    if (e instanceof PermissionError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
};

export async function openShift(openingFloatPaisa: number): Promise<R> {
  return wrap(async () => {
    const session = await requirePermission("shift.open");
    const float = z.number().int().min(0).parse(openingFloatPaisa);
    if (!session.terminalId) return { ok: false, error: "No terminal" };
    if (await getOpenShift(session.terminalId, session.staffId)) return { ok: false, error: "A shift is already open" };
    const db = await getDb();
    const [sh] = await db.insert(s.shifts).values({ branchId: session.branchId, terminalId: session.terminalId, staffId: session.staffId, openingFloat: float }).returning();
    await db.insert(s.cashMovements).values({ shiftId: sh.id, branchId: session.branchId, type: "float", amount: float, createdBy: session.staffId });
    await audit(session, { action: "shift.open", entity: "shift", entityId: sh.id, after: { float } });
    return { ok: true };
  });
}

export async function addCashMovement(type: "cash_in" | "cash_out", amountPaisa: number, reason: string): Promise<R> {
  return wrap(async () => {
    const session = await requirePermission("shift.cash_in_out");
    const amount = z.number().int().min(1).parse(amountPaisa);
    if (!reason.trim()) return { ok: false, error: "Enter a reason" };
    const sh = await getOpenShift(session.terminalId, session.staffId);
    if (!sh) return { ok: false, error: "No open shift" };
    const db = await getDb();
    await db.insert(s.cashMovements).values({ shiftId: sh.id, branchId: session.branchId, type, amount, reason: reason.trim(), createdBy: session.staffId });
    await audit(session, { action: `shift.${type}`, entity: "shift", entityId: sh.id, after: { amount, reason } });
    return { ok: true };
  });
}

/** Blind close: the cashier enters the counted cash without seeing the expected figure first. */
export async function closeShift(countedCashPaisa: number, note?: string): Promise<R & { overShort?: number; expected?: number }> {
  try {
    const session = await requirePermission("shift.close");
    const counted = z.number().int().min(0).parse(countedCashPaisa);
    const sh = await getOpenShift(session.terminalId, session.staffId);
    if (!sh) return { ok: false, error: "No open shift" };
    const sum = await shiftSummary(sh.id);
    const overShort = counted - sum.expectedCash;
    const db = await getDb();
    await db.update(s.shifts).set({ status: "closed", closedAt: new Date(), countedCash: counted, expectedCash: sum.expectedCash, overShort, closeNote: note }).where(eq(s.shifts.id, sh.id));
    await audit(session, { action: "shift.close", entity: "shift", entityId: sh.id, after: { counted, expected: sum.expectedCash, overShort } });
    return { ok: true, overShort, expected: sum.expectedCash };
  } catch (e) {
    if (e instanceof PermissionError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}
