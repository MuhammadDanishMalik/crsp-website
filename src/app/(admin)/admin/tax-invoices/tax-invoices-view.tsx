"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retryAllInvoices, retryInvoice } from "@/lib/actions/tax-queue";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Row = { orderId: string; no: string; date: string; total: number; state: string; invoiceNo: string; attempts: number; error: string; next: string };
const TONE: Record<string, string> = { sent: "bg-success/20 text-success", pending: "bg-warn/20 text-warn", failed: "bg-danger/20 text-danger" };

export function TaxInvoicesView({ rows, authority, mock }: { rows: Row[]; authority: string; mock: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();
  const waiting = rows.filter((r) => r.state !== "sent").length;
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? (r.message ?? "") : (r.error ?? "")); router.refresh(); });
  return (
    <div className="max-w-5xl">
      <div className="mb-2 flex items-center gap-3"><h1 className="text-3xl font-bold">Tax invoices</h1><span className="rounded bg-surface-2 px-2 py-1 text-xs font-bold uppercase">{authority}</span>
        {waiting > 0 && <Button className="ml-auto" onClick={() => run(retryAllInvoices)}>Retry all ({waiting})</Button>}</div>
      <p className="mb-3 text-sm text-muted">Every sale at a branch that reports to FBR/PRA gets an invoice number and QR from the authority. If the authority is down the sale still completes and the invoice waits here, retrying automatically.</p>
      {authority === "none" && <p className="mb-3 rounded-xl bg-surface p-3 text-muted">This branch is not set to report to an authority. Change it in Branches.</p>}
      {mock && authority !== "none" && <p className="mb-3 rounded-xl bg-warn/10 p-3 text-warn">No authority credentials are configured, so invoices use a <b>mock</b> numbering for testing. They are not filed with FBR/PRA.</p>}
      {msg && <p className="mb-3 rounded-xl bg-accent/20 p-3">{msg}</p>}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {rows.map((r) => (
          <div key={r.orderId} className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-sm last:border-0">
            <span className="w-24 text-muted">{r.date}</span><b className="w-16">#{r.no}</b><span className="w-24 text-right tabular-nums">{formatPKR(r.total)}</span>
            <span className={cn("rounded-lg px-2 py-1 text-xs font-bold uppercase", TONE[r.state])}>{r.state}</span>
            <span className="min-w-0 flex-1 truncate">{r.invoiceNo || <span className="text-muted">{r.error || "waiting"}{r.attempts ? ` · ${r.attempts} tries` : ""}</span>}</span>
            {r.state !== "sent" && <Button variant="secondary" className="min-h-10" onClick={() => run(() => retryInvoice(r.orderId))}>Retry</Button>}
          </div>
        ))}
        {!rows.length && <p className="p-10 text-center text-muted">No invoices yet.</p>}
      </div>
    </div>
  );
}
