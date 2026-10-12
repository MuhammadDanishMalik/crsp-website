import { asc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/domain/permissions";
import { RoleMatrix } from "./role-matrix";

export default async function RolesPage() {
  await requireSession({ permission: "role.manage", kind: "admin" });
  const db = await getDb();
  const [roles, perms] = await Promise.all([db.select().from(s.roles).orderBy(asc(s.roles.createdAt)), db.select().from(s.rolePermissions)]);
  const groups: Record<string, [string, string][]> = {};
  for (const [k, label] of Object.entries(PERMISSIONS)) (groups[k.split(".")[0]] ??= []).push([k, label]);
  return (
    <RoleMatrix
      roles={roles.map((r) => ({ id: r.id, key: r.key, name: r.name, discountLimit: r.discountLimitBps / 100, granted: perms.filter((p) => p.roleId === r.id).map((p) => p.permission) }))}
      groups={groups}
    />
  );
}
