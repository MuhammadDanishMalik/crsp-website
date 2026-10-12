import { eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { BranchesView } from "./branches-view";

export default async function BranchesPage() {
  const session = await requireSession({ permission: "branch.manage", kind: "admin" });
  const db = await getDb();
  const branches = await db.select().from(s.branches);
  const [links, terms] = await Promise.all([db.select().from(s.staffBranches).where(inArray(s.staffBranches.branchId, branches.map((b) => b.id))), db.select().from(s.terminals).where(eq(s.terminals.isActive, true))]);
  return (
    <BranchesView current={session.branchId}
      branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name, address: b.address ?? "", city: b.city ?? "", phone: b.phone ?? "", taxAuthority: b.taxAuthority, taxRegistrationNo: b.taxRegistrationNo ?? "", posId: b.posId ?? "", isActive: b.isActive, staff: links.filter((l) => l.branchId === b.id).length, terminals: terms.filter((t) => t.branchId === b.id).length }))} />
  );
}
