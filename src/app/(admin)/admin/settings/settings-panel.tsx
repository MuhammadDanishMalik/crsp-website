"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTerminal, saveTaxRule, setPaymentMethodEnabled, setPaymentMethodProvider } from "@/lib/actions/settings";
import { saveBusiness, saveReceiptText, setWebsiteOrdering } from "@/lib/actions/settings";
import { saveLoyaltyRules } from "@/lib/actions/customers-admin";
import { removeScheduledReport, saveScheduledReport, sendSummaryNow } from "@/lib/actions/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tax = { id: string; name: string; ratePercent: number; orderTypes: string[]; paymentMethods: string[]; isInclusive: boolean; isActive: boolean };
const LABEL: Record<string, string> = { cash: "Cash", card: "Card", jazzcash: "JazzCash", easypaisa: "Easypaisa", raast: "Raast QR", bank_transfer: "Bank transfer" };

type Loyalty = { earnPer100: number; pointValueRupees: number; minRedeem: number; active: boolean };
type Rep = { id: string; channel: string; recipient: string; sendAt: string; lastSentOn: string };

type Biz = { name: string; ntn: string; strn: string; serviceChargePercent: number; lockMinutes: number };
type Rcpt = { header: string; footer: string; footerUr: string };

export function SettingsPanel({ can, methods, taxes, terminals, loyalty, reports, business, receipt, website }: { can: { payments: boolean; tax: boolean; terminals: boolean; loyalty: boolean; business: boolean }; methods: { method: string; enabled: boolean; provider: string; options: { id: string; label: string }[] }[]; taxes: Tax[]; terminals: { id: string; name: string; lastSeen: string | null }[]; loyalty: Loyalty; reports: Rep[]; business: Biz | null; receipt: Rcpt | null; website: { open: boolean; message: string } | null }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [termName, setTermName] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, ok = "") => start(async () => { const r = await fn(); setMsg(r.ok ? (r.message ?? ok) : (r.error ?? "")); router.refresh(); });
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>
      {msg && <p className="rounded-xl bg-accent/20 p-3">{msg}</p>}
      {website && <WebsiteSection value={website} onSave={(v) => run(() => setWebsiteOrdering(v))} />}
      {business && <BusinessSection value={business} onSave={(v) => run(() => saveBusiness(v), "Business details saved")} />}
      {receipt && <ReceiptSection value={receipt} onSave={(v) => run(() => saveReceiptText(v), "Receipt text saved")} />}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Payment methods</h2>
        <div className="grid grid-cols-2 gap-2">
          {methods.map((m) => (
            <div key={m.method} className="rounded-xl border border-border bg-surface p-3">
              <label className="flex h-9 items-center justify-between"><span className="font-medium">{LABEL[m.method] ?? m.method}</span>
                <input type="checkbox" className="h-6 w-6" checked={m.enabled} disabled={!can.payments} onChange={(e) => run(() => setPaymentMethodEnabled(m.method, e.target.checked))} /></label>
              {m.options.length > 1 && (
                <select aria-label={`${LABEL[m.method] ?? m.method} provider`} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface-2 px-2 text-sm" disabled={!can.payments} value={m.provider} onChange={(e) => run(() => setPaymentMethodProvider(m.method, e.target.value), "Provider updated")}>
                  {m.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Tax rules</h2>
        <p className="mb-2 text-sm text-muted">Leave order types / payment methods empty to apply to all. Rates here are placeholders — enter current FBR / PRA rates.</p>
        {taxes.map((t) => <TaxRow key={t.id} tax={t} disabled={!can.tax} onSave={(v) => run(() => saveTaxRule(v))} />)}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Terminals</h2>
        {terminals.map((t) => <div key={t.id} className="mb-1 flex justify-between rounded-xl bg-surface p-3"><span className="font-medium">{t.name}</span><span className="text-sm text-muted">{t.lastSeen ? `last seen ${new Date(t.lastSeen).toLocaleString()}` : "never connected"}</span></div>)}
        {can.terminals && (
          <div className="mt-2 flex gap-2"><Input placeholder="New terminal name" value={termName} onChange={(e) => setTermName(e.target.value)} /><Button onClick={() => run(async () => { const r = await createTerminal(termName); setTermName(""); return r; })}>Register</Button></div>
        )}
      </section>

      {can.loyalty && <LoyaltySection value={loyalty} onSave={(v) => run(() => saveLoyaltyRules(v), "Loyalty rules saved")} />}
      {can.business && <ReportsSection reports={reports} run={run} />}
    </div>
  );
}

function LoyaltySection({ value, onSave }: { value: Loyalty; onSave: (v: Loyalty) => void }) {
  const [v, setV] = useState({ earn: String(value.earnPer100), val: String(value.pointValueRupees), min: String(value.minRedeem), active: value.active });
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Loyalty points</h2>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3">
        <label className="flex items-center gap-2 text-sm">Earn <Input className="w-20" inputMode="decimal" value={v.earn} onChange={(e) => setV({ ...v, earn: e.target.value })} /> points per Rs 100</label>
        <label className="flex items-center gap-2 text-sm">1 point = Rs <Input className="w-20" inputMode="decimal" value={v.val} onChange={(e) => setV({ ...v, val: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm">Redeem from <Input className="w-24" inputMode="numeric" value={v.min} onChange={(e) => setV({ ...v, min: e.target.value })} /> points</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Active</label>
        <Button onClick={() => onSave({ earnPer100: Number(v.earn), pointValueRupees: Number(v.val), minRedeem: Number(v.min), active: v.active })}>Save</Button>
      </div>
    </section>
  );
}

function ReportsSection({ reports, run }: { reports: Rep[]; run: (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, ok?: string) => void }) {
  const [v, setV] = useState({ channel: "email", recipient: "", sendAt: "23:30" });
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Daily summary to the owner</h2>
      <p className="mb-2 text-sm text-muted">Sent once a day after the chosen time. Needs a scheduler calling <code>/api/cron/daily-summary</code> every few minutes (see README). Without email/WhatsApp credentials messages are only logged.</p>
      {reports.map((r) => (
        <div key={r.id} className="mb-2 flex items-center gap-3 rounded-xl bg-surface p-3">
          <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-bold uppercase">{r.channel}</span><span className="flex-1 font-medium">{r.recipient}</span><span className="text-sm text-muted">at {r.sendAt}{r.lastSentOn && ` · last ${r.lastSentOn}`}</span>
          <Button variant="secondary" className="min-h-10" onClick={() => run(() => sendSummaryNow(r.id))}>Send now</Button>
          <Button variant="ghost" className="min-h-10 text-danger" onClick={() => run(() => removeScheduledReport(r.id))}>Remove</Button>
        </div>
      ))}
      <div className="flex gap-2">
        <select className="min-h-12 rounded-xl border border-border bg-surface-2 px-3" value={v.channel} onChange={(e) => setV({ ...v, channel: e.target.value })}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select>
        <Input placeholder={v.channel === "email" ? "owner@example.com" : "923001234567"} value={v.recipient} onChange={(e) => setV({ ...v, recipient: e.target.value })} />
        <Input type="time" className="w-32" value={v.sendAt} onChange={(e) => setV({ ...v, sendAt: e.target.value })} />
        <Button onClick={() => { run(() => saveScheduledReport(v), "Added"); setV({ ...v, recipient: "" }); }}>Add</Button>
      </div>
    </section>
  );
}

function TaxRow({ tax, disabled, onSave }: { tax: Tax; disabled: boolean; onSave: (v: Tax) => void }) {
  const [rate, setRate] = useState(String(tax.ratePercent));
  const [active, setActive] = useState(tax.isActive);
  const [inclusive, setInclusive] = useState(tax.isInclusive);
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl bg-surface p-3">
      <span className="flex-1 font-medium">{tax.name}</span>
      <Input className="w-24" inputMode="decimal" value={rate} disabled={disabled} onChange={(e) => setRate(e.target.value)} /><span>%</span>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" className="h-5 w-5" checked={inclusive} disabled={disabled} onChange={(e) => setInclusive(e.target.checked)} />Inclusive</label>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" className="h-5 w-5" checked={active} disabled={disabled} onChange={(e) => setActive(e.target.checked)} />Active</label>
      <Button disabled={disabled} onClick={() => onSave({ ...tax, ratePercent: Number(rate), isActive: active, isInclusive: inclusive })}>Save</Button>
    </div>
  );
}

function BusinessSection({ value, onSave }: { value: Biz; onSave: (v: unknown) => void }) {
  const [v, setV] = useState({ name: value.name, ntn: value.ntn, strn: value.strn, sc: String(value.serviceChargePercent), lock: String(value.lockMinutes) });
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Business</h2>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-3">
        <label className="text-sm text-muted">Business name<Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <label className="text-sm text-muted">NTN<Input value={v.ntn} onChange={(e) => setV({ ...v, ntn: e.target.value })} /></label>
        <label className="text-sm text-muted">Sales tax reg. no. (STRN)<Input value={v.strn} onChange={(e) => setV({ ...v, strn: e.target.value })} /></label>
        <label className="text-sm text-muted">Dine-in service charge %<Input inputMode="decimal" value={v.sc} onChange={(e) => setV({ ...v, sc: e.target.value })} /></label>
        <label className="text-sm text-muted">Lock the till screen after (minutes)<Input inputMode="numeric" value={v.lock} onChange={(e) => setV({ ...v, lock: e.target.value })} /></label>
        <div className="flex items-end"><Button onClick={() => onSave({ name: v.name, ntn: v.ntn || undefined, strn: v.strn || undefined, serviceChargePercent: Number(v.sc) || 0, lockMinutes: Number(v.lock) || 5 })}>Save</Button></div>
      </div>
    </section>
  );
}

function ReceiptSection({ value, onSave }: { value: Rcpt; onSave: (v: unknown) => void }) {
  const [v, setV] = useState(value);
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Receipt text</h2>
      <p className="mb-2 text-sm text-muted">Printed on every receipt. The Urdu line shows on the on-screen/browser receipt; thermal printers print English only.</p>
      <div className="space-y-2 rounded-xl bg-surface p-3">
        <label className="block text-sm text-muted">Line under the address (optional)<Input value={v.header} onChange={(e) => setV({ ...v, header: e.target.value })} /></label>
        <label className="block text-sm text-muted">Thank-you message (English)<Input value={v.footer} onChange={(e) => setV({ ...v, footer: e.target.value })} /></label>
        <label className="block text-sm text-muted">Thank-you message (Urdu)<Input dir="rtl" value={v.footerUr} onChange={(e) => setV({ ...v, footerUr: e.target.value })} /></label>
        <Button onClick={() => onSave(v)}>Save</Button>
      </div>
    </section>
  );
}

function WebsiteSection({ value, onSave }: { value: { open: boolean; message: string }; onSave: (v: { open: boolean; message: string }) => void }) {
  const [message, setMessage] = useState(value.message);
  return (
    <section className={`rounded-2xl border-2 p-4 ${value.open ? "border-success/50" : "border-danger/50"}`}>
      <h2 className="text-lg font-semibold">Website orders</h2>
      <p className="mt-1 text-sm">{value.open ? "The website is taking orders." : "The website is NOT taking orders. Visitors can read the menu only."}</p>
      <label className="mt-3 block text-sm font-medium">Message shown to visitors while orders are off</label>
      <Input value={message} maxLength={240} placeholder="We are not taking website orders right now. Takeaway only." onChange={(e) => setMessage(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <Button variant={value.open ? "danger" : "success"} onClick={() => onSave({ open: !value.open, message })}>{value.open ? "Stop taking website orders" : "Start taking website orders"}</Button>
        {!value.open && <Button variant="secondary" onClick={() => onSave({ open: false, message })}>Save message</Button>}
      </div>
    </section>
  );
}
