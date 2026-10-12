import { getSession, getTerminalClaims } from "@/lib/auth/session";
import { subscribe } from "@/lib/realtime/bus";

export const dynamic = "force-dynamic";

/** Server-sent events for the caller's branch. Auth: staff session, or a registered terminal (TV / customer displays). */
export async function GET(req: Request) {
  const session = await getSession();
  const term = session ? null : await getTerminalClaims();
  const branchId = session?.branchId ?? term?.bid;
  if (!branchId) return new Response("Unauthorized", { status: 401 });

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (s: string) => { try { controller.enqueue(enc.encode(s)); } catch { cleanup(); } };
      send("retry: 3000\n\n");
      const unsub = subscribe(branchId, (e) => send(`data: ${JSON.stringify(e)}\n\n`));
      const ping = setInterval(() => send(": ping\n\n"), 20_000);
      cleanup = () => { clearInterval(ping); unsub(); try { controller.close(); } catch { /* already closed */ } };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
