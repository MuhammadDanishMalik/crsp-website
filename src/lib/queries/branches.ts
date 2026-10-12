import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import type { Session } from "@/lib/auth/session";

/** Branches this person may look at: everything with `branch.switch`, otherwise only their own. */
export async function accessibleBranches(session: Session) {
  const db = await getDb();
  if (session.can("branch.switch")) return db.select().from(s.branches).where(eq(s.branches.isActive, true));
  const links = await db.select().from(s.staffBranches).where(eq(s.staffBranches.staffId, session.staffId));
  return links.length ? db.select().from(s.branches).where(and(inArray(s.branches.id, links.map((l) => l.branchId)), eq(s.branches.isActive, true))) : [];
}

/** "all" or a branch id from the URL → ids the person is allowed to see (never more). */
export async function resolveBranchIds(session: Session, param: string | null | undefined) {
  const allowed = await accessibleBranches(session);
  const ids = allowed.map((b) => b.id);
  if (param === "all") return { ids, branches: allowed, selected: "all" };
  const pick = param && ids.includes(param) ? param : ids.includes(session.branchId) ? session.branchId : ids[0];
  return { ids: pick ? [pick] : [], branches: allowed, selected: pick ?? "" };
}
