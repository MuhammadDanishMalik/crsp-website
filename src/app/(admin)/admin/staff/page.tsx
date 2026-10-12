import { asc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { StaffManager } from "./staff-manager";

export default async function StaffPage() {
  const session = await requireSession({ permission: "staff.view", kind: "admin" });
  const db = await getDb();
  const [staff, roles, branches, links] = await Promise.all([
    db.select().from(s.staff).orderBy(asc(s.staff.fullName)), db.select().from(s.roles).orderBy(asc(s.roles.createdAt)),
    db.select().from(s.branches).where(eq(s.branches.isActive, true)), db.select().from(s.staffBranches),
  ]);
  const salary = session.can("staff.salary_view");
  return (
    <StaffManager
      can={{ manage: session.can("staff.manage"), setPin: session.can("staff.set_pin"), salary, ownerRole: session.roleKey === "owner" }}
      roles={roles.filter((r) => r.key !== "owner" || session.roleKey === "owner").map((r) => ({ id: r.id, name: r.name }))}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      staff={staff.map((x) => ({
        id: x.id, fullName: x.fullName, roleId: x.roleId, roleName: roles.find((r) => r.id === x.roleId)?.name ?? "", phone: x.phone ?? "", cnic: x.cnic ?? "", email: x.email ?? "",
        photoUrl: x.photoUrl ?? "", active: x.isActive, hasPin: !!x.pinHash, salaryType: x.salaryType, salaryRupees: salary ? x.salaryAmount / 100 : 0,
        branchIds: links.filter((l) => l.staffId === x.id).map((l) => l.branchId),
      }))}
    />
  );
}
