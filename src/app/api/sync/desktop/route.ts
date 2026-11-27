import { runtimeEnv } from "@/lib/env";
import { pullAll, pushAll } from "@/lib/sync/client";

export const dynamic = "force-dynamic";
let running = false;

/** Shop app only: the app's own window process asks for a download (first setup) or an upload (3 am). */
export async function POST(req: Request) {
  const token = runtimeEnv("CRSP_LOCAL_TOKEN") ?? "";
  if (!runtimeEnv("CRSP_DESKTOP") || token.length < 32 || req.headers.get("x-crsp-local") !== token) return new Response("Not found", { status: 404 });
  const { mode } = (await req.json()) as { mode?: string };
  if (running) return Response.json({ ok: false, error: "A sync is already running" });
  running = true;
  try {
    return Response.json(mode === "pull" ? await pullAll() : await pushAll());
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? (e.message === "fetch failed" ? "No internet connection" : e.message) : "Sync failed" });
  } finally { running = false; }
}
