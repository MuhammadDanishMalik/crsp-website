/** Receives browser-side crashes so they show up in the server log (hook Sentry/Logtail here when you have an account). */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { message?: string; digest?: string; path?: string };
    console.error(`[client-error] ${String(b.path ?? "").slice(0, 100)} · ${String(b.message ?? "").slice(0, 300)} · ${String(b.digest ?? "").slice(0, 40)}`);
  } catch { /* ignore garbage */ }
  return new Response(null, { status: 204 });
}
