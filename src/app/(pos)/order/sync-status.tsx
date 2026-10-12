"use client";
import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { refreshOutbox, removeFromOutbox, requeue, useOutbox } from "@/lib/offline/outbox";
import { syncOutbox } from "@/lib/offline/sync";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/** Keeps the offline outbox flowing and shows its state. Renders nothing when everything is in sync. */
export function SyncStatus({ online, onSynced }: { online: boolean; onSynced: (n: number) => void }) {
  const box = useOutbox();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const r = await syncOutbox();
    setBusy(false);
    if (r.synced) onSynced(r.synced);
  };
  useEffect(() => {
    if (!online) return;
    void refreshOutbox().then(() => run());
    const t = setInterval(() => { if (navigator.onLine) void run(); }, 20_000);
    const onOnline = () => void run();
    window.addEventListener("online", onOnline);
    return () => { clearInterval(t); window.removeEventListener("online", onOnline); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  if (online && !box.queued && !box.failed) return null;
  const tone = box.failed ? "border-danger text-danger" : "border-warn text-warn";
  return (
    <>
      <button onClick={() => setOpen(true)} className={`flex h-12 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${tone}`}>
        {online ? <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> : <CloudOff size={16} />}
        {!online && "Offline · "}{box.queued} waiting{box.failed > 0 && ` · ${box.failed} need attention`}
      </button>
      {open && (
        <Modal title="Orders saved on this device" onClose={() => setOpen(false)} width="max-w-2xl">
          <p className="mb-3 text-sm text-muted">These sales were rung without internet. They upload automatically; nothing is lost if you close the screen.</p>
          <div className="space-y-2">
            {box.rows.map((r) => (
              <div key={r.clientId} className={`rounded-xl p-3 ${r.status === "failed" ? "bg-danger/10" : "bg-surface-2"}`}>
                <div className="flex items-center justify-between"><b>#{r.localNo}</b><span className="tabular-nums">{formatPKR(r.total)}</span></div>
                <p className="truncate text-sm text-muted">{r.summary}</p>
                {r.status === "failed" && <p className="mt-1 text-sm text-danger">Could not upload: {r.error}. Ask a manager. The receipt already printed, so this sale must be entered by hand if it is discarded.</p>}
                {r.status === "failed" && (
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" className="min-h-11" onClick={async () => { await requeue(r.clientId); await run(); }}>Try again</Button>
                    <Button variant="secondary" className="min-h-11" onClick={() => navigator.clipboard?.writeText(JSON.stringify(r, null, 2))}>Copy details</Button>
                    <Button variant="ghost" className="min-h-11 text-danger" onClick={() => confirm(`Discard order #${r.localNo}? This cannot be undone.`) && removeFromOutbox(r.clientId)}>Discard</Button>
                  </div>
                )}
              </div>
            ))}
            {!box.rows.length && <p className="py-6 text-center text-muted">Nothing waiting.</p>}
          </div>
          {online && box.queued > 0 && <Button size="lg" className="mt-4 w-full" disabled={busy} onClick={run}>{busy ? "Uploading…" : "Upload now"}</Button>}
        </Modal>
      )}
    </>
  );
}
