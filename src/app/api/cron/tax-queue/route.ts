import { processTaxQueue } from "@/lib/tax/fiscalize";

export const dynamic = "force-dynamic";

/** Call every few minutes: retries invoices the tax authority has not accepted yet. `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = secret ? req.headers.get("authorization") === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
  if (!authed) return new Response("Forbidden", { status: 403 });
  return Response.json(await processTaxQueue());
}
