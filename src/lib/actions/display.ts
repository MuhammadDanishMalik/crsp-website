"use server";

import { getSession, getTerminalClaims } from "@/lib/auth/session";
import { loadStatusBoard } from "@/lib/queries/kds";

/** Order-status TV: authorised by the registered-terminal cookie (no staff login on a wall TV). */
export async function fetchStatusBoard() {
  const term = await getTerminalClaims();
  const branchId = term?.bid ?? (await getSession())?.branchId;
  if (!branchId) return null;
  return loadStatusBoard(branchId);
}
