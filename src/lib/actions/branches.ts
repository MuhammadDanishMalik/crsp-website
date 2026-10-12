"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { getSession, PermissionError, requirePermission, setSession } from "@/lib/auth/session";
import { accessibleBranches } from "@/lib/queries/branches";
import { guard, UserError, type R } from "./_guard";

/** Back-office only: look at another branch you have access to. POS sessions stay with their terminal's branch. */
export async function switchBranch(branchId: string): Promise<R> {
  return guard(async () => {
    const session = await getSession();
    if (!session) throw new PermissionError("Not signed in");
    if (session.kind !== "admin") throw new UserError("A POS terminal belongs to one branch");
    const allowed = await accessibleBranches(session);
    if (!allowed.some((b) => b.id === branchId)) throw new PermissionError("You do not have access to that branch");
    await setSession({ sid: session.staffId, bid: branchId, kind: "admin" });
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function saveBranch(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("branch.manage");
    const v = z.object({
      id: z.string().uuid().optional(), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/, "Code is 2–6 letters or digits"), name: z.string().trim().min(2, "Enter a name").max(80),
      address: z.string().trim().max(200).optional(), city: z.string().trim().max(60).optional(), phone: z.string().trim().max(30).optional(),
      taxAuthority: z.enum(["fbr", "pra", "none"]), taxRegistrationNo: z.string().trim().max(40).optional(), posId: z.string().trim().max(40).optional(), isActive: z.boolean(),
    }).parse(raw);
    const db = await getDb();
    const values = { code: v.code, name: v.name, address: v.address || null, city: v.city || null, phone: v.phone || null, taxAuthority: v.taxAuthority, taxRegistrationNo: v.taxRegistrationNo || null, posId: v.posId || null, isActive: v.isActive };
    const [b] = await db.select().from(s.business).limit(1);
    const [dup] = await db.select({ id: s.branches.id }).from(s.branches).where(and(eq(s.branches.businessId, b.id), eq(s.branches.code, v.code)));
    if (dup && dup.id !== v.id) throw new UserError("That branch code is already used");
    if (v.id) {
      if (!v.isActive && v.id === session.branchId) throw new UserError("Switch to another branch before deactivating this one");
      await db.update(s.branches).set(values).where(eq(s.branches.id, v.id));
      await audit(session, { action: "branch.update", entity: "branch", entityId: v.id, after: values });
      revalidatePath("/admin/branches");
      return { ok: true };
    }
    // New branch: sensible defaults so it can trade on day one. Menu, recipes and tax rules are shared across the business.
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join("");
    const created = await db.transaction(async (tx) => {
      const [nb] = await tx.insert(s.branches).values({ ...values, businessId: b.id }).returning();
      await tx.insert(s.paymentMethodSettings).values((["cash", "card", "jazzcash", "easypaisa", "raast", "bank_transfer"] as const).map((method) => ({ branchId: nb.id, method, isEnabled: true })));
      await tx.insert(s.deliveryZones).values({ branchId: nb.id, name: "City", charge: 10000 });
      const taken = new Set((await tx.select({ p: s.terminals.orderNoPrefix }).from(s.terminals)).map((x) => x.p));
      const prefix = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("").find((c) => !taken.has(c)) ?? "Z";
      await tx.insert(s.terminals).values({ branchId: nb.id, name: "POS-1", orderNoPrefix: prefix, deviceKeyHash: await bcrypt.hash(code, 10) });
      const owners = await tx.select({ id: s.staff.id }).from(s.staff).innerJoin(s.roles, eq(s.roles.id, s.staff.roleId)).where(eq(s.roles.key, "owner"));
      if (owners.length) await tx.insert(s.staffBranches).values(owners.map((o) => ({ staffId: o.id, branchId: nb.id })));
      return nb;
    });
    await audit(session, { action: "branch.create", entity: "branch", entityId: created.id, after: values });
    revalidatePath("/admin/branches");
    return { ok: true, message: `Branch created. Terminal "POS-1" code: ${code} (shown once). Next: add staff to this branch, set printers, and opening stock.` };
  });
}

/** Per-branch price for one item. null removes the override (back to the base price). */
export async function setBranchPrice(itemId: string, priceRupees: number | null): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("menu.price");
    const price = priceRupees === null ? null : Math.round(z.number().min(0).max(1_000_000).parse(priceRupees) * 100);
    const db = await getDb();
    await db.insert(s.branchMenuItems).values({ branchId: session.branchId, itemId, price })
      .onConflictDoUpdate({ target: [s.branchMenuItems.branchId, s.branchMenuItems.itemId], set: { price, updatedAt: new Date() } });
    await audit(session, { action: "menu.branch_price", entity: "menu_item", entityId: itemId, after: { branchId: session.branchId, price } });
    revalidatePath("/admin/menu");
    return { ok: true };
  });
}
