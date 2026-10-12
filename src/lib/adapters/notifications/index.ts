import "server-only";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

export type Message = { channel: "email" | "whatsapp"; to: string; subject: string; body: string };
export type SendResult = { ok: boolean; provider: string; error?: string };

/**
 * Pluggable notifier. Real providers activate when their credentials are in the environment, otherwise the
 * message is only logged (provider "mock") so the rest of the flow can be tested end to end.
 *   email:    RESEND_API_KEY + MAIL_FROM            (https://resend.com)
 *   whatsapp: WHATSAPP_TOKEN + WHATSAPP_PHONE_ID    (Meta WhatsApp Cloud API; free-form text only works inside the
 *             24-hour customer window — for a daily owner summary create an approved template and switch to it)
 * The real calls below are written to the providers' documented APIs but have NOT been run against live accounts.
 */
async function send(m: Message): Promise<SendResult> {
  if (m.channel === "email" && process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.body }) });
    return r.ok ? { ok: true, provider: "resend" } : { ok: false, provider: "resend", error: `HTTP ${r.status}` };
  }
  if (m.channel === "whatsapp" && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    const r = await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: m.to.replace(/[^\d]/g, ""), type: "text", text: { body: `${m.subject}\n\n${m.body}` } }) });
    return r.ok ? { ok: true, provider: "whatsapp-cloud" } : { ok: false, provider: "whatsapp-cloud", error: `HTTP ${r.status}` };
  }
  console.log(`[notify:mock] ${m.channel} → ${m.to}\n${m.subject}\n${m.body}`);
  return { ok: true, provider: "mock" };
}

export async function sendNotification(m: Message, template = "daily_summary"): Promise<SendResult> {
  let result: SendResult;
  try { result = await send(m); } catch (e) { result = { ok: false, provider: "error", error: e instanceof Error ? e.message : "failed" }; }
  const db = await getDb();
  await db.insert(s.notificationLog).values({ channel: m.channel, recipient: m.to, template, payload: { subject: m.subject, provider: result.provider }, state: result.ok ? "sent" : "failed", error: result.error ?? (result.provider === "mock" ? "mock provider (no credentials configured)" : null) });
  return result;
}
