import "server-only";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import type { Session } from "./session";

export async function audit(
  session: Session,
  e: { action: string; entity: string; entityId?: string; before?: unknown; after?: unknown; reason?: string; approverId?: string },
) {
  const db = await getDb();
  const [b] = await db.select({ businessId: s.branches.businessId }).from(s.branches);
  await db.insert(s.auditLogs).values({
    businessId: b.businessId, branchId: session.branchId, terminalId: session.terminalId, actorId: session.staffId,
    approverId: e.approverId, action: e.action, entity: e.entity, entityId: e.entityId, before: e.before, after: e.after, reason: e.reason,
  });
}
