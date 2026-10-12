"use client";
import { useEffect } from "react";

/** Last-resort screen for an unexpected crash inside any page: keeps the till usable (reload) and reports the error to the server log. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: error.message, digest: error.digest, path: location.pathname }) }).catch(() => {});
  }, [error]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-muted">Your sales are safe. Orders already saved are not affected. Try again; if it keeps happening, tell your manager and note the time.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="h-14 rounded-xl bg-brand px-6 text-lg font-bold text-brand-fg">Try again</button>
        <a href="/start" className="flex h-14 items-center rounded-xl bg-surface-2 px-6 text-lg font-semibold">Start page</a>
      </div>
      {error.digest && <p className="text-xs text-muted">Error code {error.digest}</p>}
    </main>
  );
}
