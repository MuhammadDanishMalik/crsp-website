import { runDailySummaries } from "@/lib/reports/run-daily";

export const dynamic = "force-dynamic";

/** Hit this every ~10 minutes from any scheduler (cron-job.org, Vercel Cron, systemd timer): `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = secret ? req.headers.get("authorization") === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
  if (!authed) return new Response("Forbidden", { status: 403 });
  return Response.json(await runDailySummaries());
}
