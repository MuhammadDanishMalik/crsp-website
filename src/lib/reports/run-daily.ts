import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { sendNotification } from "@/lib/adapters/notifications";
import { businessDate } from "@/lib/domain/dates";
import { buildDailySummary } from "@/lib/reports/daily-summary";

/** Called by the cron route: sends each due subscriber their summary once per day. */
export async function runDailySummaries(): Promise<{ sent: number; failed: number }> {
  const db = await getDb();
  const today = businessDate();
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const due = (await db.select().from(s.scheduledReports).where(and(eq(s.scheduledReports.isActive, true), eq(s.scheduledReports.kind, "daily_summary")))).filter((r) => r.lastSentOn !== today && String(r.sendAt).slice(0, 5) <= hhmm);
  if (!due.length) return { sent: 0, failed: 0 };
  const branches = await db.select().from(s.branches).where(eq(s.branches.isActive, true));
  const msg = await buildDailySummary(branches.map((b) => b.id), "All branches", today);
  let sent = 0, failed = 0;
  for (const r of due) {
    const res = await sendNotification({ channel: r.channel as "email" | "whatsapp", to: r.recipient, ...msg });
    if (res.ok) { sent++; await db.update(s.scheduledReports).set({ lastSentOn: today }).where(eq(s.scheduledReports.id, r.id)); } else failed++;
  }
  return { sent, failed };
}
