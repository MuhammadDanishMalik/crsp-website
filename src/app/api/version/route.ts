export const dynamic = "force-dynamic";

/** Which deployment is live. Open tills compare it with the one they loaded and offer a reload when it changed. */
export function GET() {
  return Response.json({ id: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 10) ?? "dev" }, { headers: { "Cache-Control": "no-store" } });
}
