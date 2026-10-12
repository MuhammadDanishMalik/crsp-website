"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { PermissionError, requirePermission } from "@/lib/auth/session";

type R = { ok: true } | { ok: false; error: string };
async function guard(fn: () => Promise<R>): Promise<R> {
  try { return await fn(); } catch (e) {
    if (e instanceof PermissionError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}

const printerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(50),
  role: z.enum(["receipt", "kot"]),
  connection: z.enum(["lan", "usb", "bluetooth", "serial"]),
  address: z.string().trim().max(100).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  paperWidthMm: z.union([z.literal(58), z.literal(80)]),
  openDrawer: z.boolean(),
}).refine((p) => p.connection !== "lan" || !!p.address, { message: "Enter the printer IP address" });

export async function savePrinter(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.printers");
    const v = printerSchema.parse(raw);
    const db = await getDb();
    const values = { name: v.name, role: v.role, connection: v.connection, address: v.address || null, port: v.port ?? 9100, paperWidthMm: v.paperWidthMm, openDrawer: v.role === "receipt" && v.openDrawer };
    if (v.id) await db.update(s.printers).set(values).where(and(eq(s.printers.id, v.id), eq(s.printers.branchId, session.branchId)));
    else await db.insert(s.printers).values({ ...values, branchId: session.branchId });
    await audit(session, { action: v.id ? "settings.printer.update" : "settings.printer.create", entity: "printer", entityId: v.id, after: values });
    revalidatePath("/admin/printers");
    return { ok: true };
  });
}

export async function removePrinter(id: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.printers");
    const db = await getDb();
    await db.update(s.printers).set({ isActive: false }).where(and(eq(s.printers.id, id), eq(s.printers.branchId, session.branchId)));
    await db.update(s.kitchenStations).set({ printerId: null }).where(and(eq(s.kitchenStations.printerId, id), eq(s.kitchenStations.branchId, session.branchId)));
    await audit(session, { action: "settings.printer.remove", entity: "printer", entityId: id });
    revalidatePath("/admin/printers");
    return { ok: true };
  });
}

export async function saveStation(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.printers");
    const v = z.object({
      id: z.string().uuid().optional(), name: z.string().trim().min(1, "Station name is required").max(40), printerId: z.string().uuid().nullable(),
      warnMinutes: z.number().min(1).max(120), lateMinutes: z.number().min(1).max(240),
    }).refine((x) => x.lateMinutes > x.warnMinutes, { message: "Late threshold must be longer than warning" }).parse(raw);
    const db = await getDb();
    const values = { name: v.name, printerId: v.printerId, warnSeconds: Math.round(v.warnMinutes * 60), lateSeconds: Math.round(v.lateMinutes * 60) };
    if (v.id) await db.update(s.kitchenStations).set(values).where(and(eq(s.kitchenStations.id, v.id), eq(s.kitchenStations.branchId, session.branchId)));
    else await db.insert(s.kitchenStations).values({ ...values, branchId: session.branchId });
    await audit(session, { action: "settings.station.save", entity: "kitchen_station", entityId: v.id, after: values });
    revalidatePath("/admin/printers");
    return { ok: true };
  });
}

/** Route a whole category to a station (items inherit it on new orders). */
export async function setCategoryStation(categoryId: string, stationId: string | null): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.printers");
    const db = await getDb();
    await db.update(s.menuItems).set({ kitchenStationId: stationId }).where(eq(s.menuItems.categoryId, categoryId));
    await audit(session, { action: "settings.category_station", entity: "category", entityId: categoryId, after: { stationId } });
    revalidatePath("/admin/printers");
    return { ok: true };
  });
}
