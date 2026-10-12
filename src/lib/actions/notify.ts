"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { sendNotification } from "@/lib/adapters/notifications";
import { businessDate } from "@/lib/domain/dates";
import { buildDailySummary } from "@/lib/reports/daily-summary";
import { guard, UserError, type R } from "./_guard";

export async function saveScheduledReport(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.business");
    const v = z.object({ channel: z.enum(["email", "whatsapp"]), recipient: z.string().trim().min(5, "Enter the recipient"), sendAt: z.string().regex(/^\d{2}:\d{2}$/) }).parse(raw);
    if (v.channel === "email" && !/^\S+@\S+\.\S+$/.test(v.recipient)) throw new UserError("Email looks wrong");
    if (v.channel === "whatsapp" && v.recipient.replace(/\D/g, "").length < 10) throw new UserError("Phone number looks wrong (include country code, e.g. 923001234567)");
    const db = await getDb();
    const [b] = await db.select().from(s.business).limit(1);
    await db.insert(s.scheduledReports).values({ businessId: b.id, channel: v.channel, recipient: v.recipient, sendAt: v.sendAt });
    await audit(session, { action: "settings.scheduled_report.create", entity: "scheduled_report", after: v });
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}

export async function removeScheduledReport(id: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("settings.business");
    const db = await getDb();
    await db.delete(s.scheduledReports).where(eq(s.scheduledReports.id, id));
    await audit(session, { action: "settings.scheduled_report.remove", entity: "scheduled_report", entityId: id });
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}

/** Send today's summary to one subscriber right now (also used to test credentials). */
export async function sendSummaryNow(id: string): Promise<R> {
  return guard(async () => {
    await requirePermission("settings.business");
    const db = await getDb();
    const [r] = await db.select().from(s.scheduledReports).where(eq(s.scheduledReports.id, id));
    if (!r) throw new UserError("Not found");
    const branches = await db.select().from(s.branches).where(eq(s.branches.isActive, true));
    const msg = await buildDailySummary(branches.map((b) => b.id), "All branches", businessDate());
    const res = await sendNotification({ channel: r.channel as "email" | "whatsapp", to: r.recipient, ...msg });
    return res.ok ? { ok: true, message: res.provider === "mock" ? "Logged only — add email/WhatsApp credentials to send for real" : `Sent via ${res.provider}` } : { ok: false, error: res.error ?? "Send failed" };
  });
}
