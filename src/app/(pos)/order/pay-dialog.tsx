"use client";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Banknote, CreditCard, Landmark, Smartphone, QrCode, Printer } from "lucide-react";
import { createOrder } from "@/lib/actions/orders";
import { getKotJobs, getReceiptPrintJob } from "@/lib/actions/print";
import { sendToBridge } from "@/lib/adapters/printers/bridge-client";
import { computeTotals } from "@/lib/domain/pricing";
import { formatPKR } from "@/lib/domain/money";
import { quickCashOptions, splitEqually } from "@/lib/domain/payments";
import { maxRedeemablePoints, redeemValue } from "@/lib/domain/loyalty";
import { lineTotal } from "@/lib/domain/pricing";
import { useCart } from "@/lib/stores/cart";
import { broadcastCart } from "@/lib/stores/cart-channel";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Numpad } from "@/components/pos/numpad";
import type { OfflineConfig } from "@/lib/offline/types";
import { enqueue, nextLocalNo } from "@/lib/offline/outbox";
import { localReceipt } from "@/lib/offline/local-receipt";
import { printOffline } from "@/lib/offline/print-local";
import { businessDate } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import type { PosMenu } from "@/lib/queries/menu";
import type { Me } from "./types";

type Method = "cash" | "card" | "jazzcash" | "easypaisa" | "raast" | "bank_transfer";
type Entry = { method: Method; amount: number; tendered?: number; approvalCode?: string; cardBrand?: "visa" | "mastercard" | "unionpay" | "paypak"; referenceNo?: string };

const METHODS: { id: Method; label: string; icon: React.ReactNode }[] = [
  { id: "cash", label: "cash", icon: <Banknote /> }, { id: "card", label: "card", icon: <CreditCard /> },
  { id: "jazzcash", label: "JazzCash", icon: <Smartphone /> }, { id: "easypaisa", label: "Easypaisa", icon: <Smartphone /> },
  { id: "raast", label: "Raast QR", icon: <QrCode /> }, { id: "bank_transfer", label: "Bank transfer", icon: <Landmark /> },
];
const BRANDS = ["visa", "mastercard", "unionpay", "paypak"] as const;

export function PayDialog({ menu, me, offline, online, onClose, onFinished }: { menu: PosMenu; me: Me; offline: OfflineConfig; online: boolean; onClose: () => void; onFinished: () => void }) {
  const cart = useCart();
  const t = useTranslations("pay");
  // Offline: cash, plus card/wallet/transfer entered with a typed code (gateways need the internet).
  const available = METHODS.filter((m) => menu.paymentMethods.includes(m.id) && (online || m.id === "cash" || (menu.paymentProviders[m.id] ?? "manual") === "manual"));
  const [method, setMethod] = useState<Method>(available[0]?.id ?? "cash");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [brand, setBrand] = useState<(typeof BRANDS)[number]>("visa");
  const [error, setError] = useState("");
  const [split, setSplit] = useState<null | { mode: "equal"; n: number } | { mode: "items" }>(null);
  const [itemTarget, setItemTarget] = useState<number | null>(null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [pending, start] = useTransition();
  const [done, setDone] = useState<null | { orderId: string; orderNo: string; change: number; printMsg: string; offline?: boolean }>(null);

  const zone = menu.zones.find((z) => z.id === cart.deliveryZoneId);
  const dominant = entries.length ? [...entries].sort((a, b) => b.amount - a.amount)[0].method : method;
  const redeem = useMemo(() => {
    if (!cart.redeem || !menu.loyalty) return { points: 0, value: 0 };
    const base = computeTotals({ lines: cart.lines, discount: cart.discount, orderType: cart.orderType, taxRules: [] });
    const payable = base.subtotal - base.discountTotal;
    const points = maxRedeemablePoints(cart.customerPoints, payable, menu.loyalty);
    return { points, value: redeemValue(points, payable, menu.loyalty) };
  }, [cart.redeem, cart.lines, cart.discount, cart.orderType, cart.customerPoints, menu.loyalty]);
  const totals = useMemo(
    () => computeTotals({ lines: cart.lines, discount: cart.discount, orderType: cart.orderType, paymentMethod: dominant, taxRules: menu.taxRules, serviceChargeBps: menu.serviceChargeBps, deliveryCharge: zone?.charge ?? 0, loyaltyDiscount: redeem.value }),
    [cart.lines, cart.discount, cart.orderType, dominant, menu, zone, redeem.value],
  );
  const canRedeem = !!menu.loyalty && cart.customerPoints >= menu.loyalty.minRedeemPoints;
  const paid = entries.reduce((a, e) => a + e.amount, 0);
  const remaining = Math.max(0, totals.total - paid);
  const typed = digits ? Math.round(Number(digits) * 100) : 0; // rounded: 603.2 * 100 is not an integer in floating point

  // What the current payer owes: whole remainder, or their share when splitting the bill.
  const target = (() => {
    if (split?.mode === "equal") {
      const shares = splitEqually(totals.total, split.n);
      return entries.length >= shares.length - 1 ? remaining : Math.min(shares[entries.length], remaining);
    }
    if (split?.mode === "items" && itemTarget) return Math.min(itemTarget, remaining);
    return remaining;
  })();

  const current: Entry | null = (() => {
    if (remaining === 0) return null;
    if (method === "cash") {
      const tendered = typed || target;
      return { method, tendered, amount: Math.min(tendered, target) };
    }
    const amount = Math.min(typed || target, remaining);
    return { method, amount, approvalCode: code.trim() || undefined, referenceNo: code.trim() || undefined, cardBrand: method === "card" ? brand : undefined };
  })();
  const viaGateway = method !== "cash" && (menu.paymentProviders[method] ?? "manual") !== "manual";
  const needsCode = method !== "cash" && !viaGateway;
  const currentValid = !current || !needsCode || code.trim().length >= 3;
  const currentCovers = !!current && current.amount >= remaining;

  const addPartial = () => {
    if (!current || !currentValid) return setError(needsCode ? "Enter the approval / reference number" : "");
    if (current.amount >= remaining) return;
    setEntries((e) => [...e, current]); setDigits(""); setCode(""); setError(""); setItemTarget(null); setPicked({});
  };

  const complete = (cod = false) => {
    const all = cod ? [] : current ? [...entries, current] : entries;
    if (!cod && current && !currentValid) return setError("Enter the approval / reference number");
    setError("");
    const payload = {
      clientId: cart.clientId, type: cart.orderType, tableNo: cart.tableNo || undefined, customerPhone: cart.customerPhone || undefined,
      customerName: cart.customerName || undefined, deliveryAddress: cart.deliveryAddress || undefined, deliveryZoneId: cart.deliveryZoneId ?? undefined,
      aggregatorName: cart.aggregatorName || undefined, cod: cod || undefined, redeemPoints: redeem.points || undefined,
      lines: cart.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, modifierIds: l.modifiers.map((m) => m.id), note: l.note || undefined })),
      discount: cart.discount ? { kind: cart.discount.kind, value: cart.discount.value, reason: cart.discount.reason, code: cart.discount.code, overrideToken: cart.discount.overrideToken } : null,
      payments: all.map((e) => ({ method: e.method, amount: e.amount, tendered: e.tendered, approvalCode: e.approvalCode, cardBrand: e.cardBrand, referenceNo: e.method === "raast" || e.method === "bank_transfer" ? e.referenceNo : undefined })),
    };
    const saveOffline = async () => {
      if (cart.discount || cod || redeem.points) return setError("Discounts, points and cash-on-delivery need the internet. Remove them to continue offline.");
      const createdAt = new Date().toISOString();
      const localNo = await nextLocalNo(offline.prefix, businessDate());
      const lr = localReceipt({ cfg: offline, localNo, createdAt, type: cart.orderType, tableNo: cart.tableNo || null, lines: cart.lines, taxRules: menu.taxRules, serviceChargeBps: menu.serviceChargeBps, payments: all });
      const offlinePayload = { ...payload, offline: { localNo, createdAt, shiftId: offline.shiftId, staffId: offline.staffId, staffName: offline.staffName, lines: cart.lines.map((l) => ({ itemId: l.itemId, basePrice: l.basePrice, modifiers: l.modifiers.map((m) => ({ id: m.id, priceDelta: m.priceDelta })) })) } };
      await enqueue({ clientId: cart.clientId, localNo, createdAt, status: "queued", error: "", attempts: 0, payload: offlinePayload, total: lr.total, summary: cart.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ") });
      const printMsg = await printOffline(offline, lr.receipt, cart.lines, menu.items, all.some((e) => e.method === "cash"));
      broadcastCart({ lines: [], subtotal: 0, discount: 0, tax: 0, total: lr.total, status: "paid", orderNo: localNo, change: lr.change });
      setDone({ orderId: cart.clientId, orderNo: localNo, change: lr.change, printMsg, offline: true });
    };
    start(async () => {
      if (!navigator.onLine) return saveOffline();
      let r: Awaited<ReturnType<typeof createOrder>>;
      try { r = await createOrder(payload); } catch { return saveOffline(); } // the request never reached the server: keep the sale on this device
      if (!r.ok) return setError(r.error);
      const printMsg = await printReceipt(r.orderId);
      broadcastCart({ lines: [], subtotal: 0, discount: 0, tax: 0, total: totals.total, status: "paid", orderNo: r.orderNo, change: r.change });
      setDone({ orderId: r.orderId, orderNo: r.orderNo, change: r.change, printMsg });
    });
  };

  if (done) {
    return (
      <Modal title={`${t("order")} #${done.orderNo} ${done.offline ? t("savedOffline") : t("paid")}`} onClose={() => { cart.clear(); onFinished(); }} width="max-w-md">
        <div className="space-y-4 text-center">
          {done.change > 0 && (
            <div className="rounded-2xl bg-accent/20 p-5"><p className="text-sm uppercase tracking-wide text-muted">{t("changeDue")}</p><p className="text-5xl font-black tabular-nums">{formatPKR(done.change)}</p></div>
          )}
          {done.offline && <p className="rounded-xl bg-warn/15 p-3 text-sm text-warn">No internet. This sale is saved on this device and will upload by itself when the connection returns. Card/wallet payments stay “pending verification” until a manager checks them.</p>}
          <p className="text-muted">{done.printMsg}</p>
          {!done.offline && <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={async () => setDone({ ...done, printMsg: await printReceipt(done.orderId, true) })}><Printer size={20} /> {t("reprint")}</Button>
            <a href={`/receipt/${done.orderId}?print=1`} target="_blank" className="flex min-h-14 flex-1 items-center justify-center rounded-xl border border-border bg-surface-2 font-semibold text-sm">{t("browserPrint")} (2 Slips)</a>
          </div>}
          <div className="flex gap-2">
            <a href="/orders" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border bg-surface-2 text-sm font-semibold text-foreground hover:bg-surface">View Orders Record</a>
            <Button size="xl" className="flex-[2]" onClick={() => { cart.clear(); onFinished(); }}>{t("newOrder")}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`${t("title")} · ${formatPKR(totals.total)}`} onClose={onClose} width="max-w-4xl">
      <div className="grid grid-cols-[220px_1fr] gap-6">
        <div className="space-y-2">
          {available.map((m) => (
            <button key={m.id} onClick={() => { setMethod(m.id); setDigits(""); setCode(""); setError(""); }}
              className={cn("flex h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 font-semibold", method === m.id ? "border-brand bg-brand/15" : "border-border bg-surface-2")}>
              {m.icon}{m.label === "cash" || m.label === "card" ? t(m.label) : m.label}
            </button>
          ))}
          {me.can.split && !entries.length && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-muted">{t("splitBill")}</p>
              <div className="flex gap-1">
                {[2, 3, 4].map((n) => <button key={n} onClick={() => setSplit(split?.mode === "equal" && split.n === n ? null : { mode: "equal", n })} className={cn("h-12 flex-1 rounded-xl border-2 font-semibold", split?.mode === "equal" && split.n === n ? "border-brand bg-brand/15" : "border-border bg-surface-2")}>÷{n}</button>)}
              </div>
              <button onClick={() => setSplit(split?.mode === "items" ? null : { mode: "items" })} className={cn("h-12 w-full rounded-xl border-2 font-semibold", split?.mode === "items" ? "border-brand bg-brand/15" : "border-border bg-surface-2")}>{t("byItems")}</button>
            </div>
          )}
          {entries.length > 0 && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="font-semibold text-muted">Added</p>
              {entries.map((e, i) => (
                <button key={i} onClick={() => setEntries((x) => x.filter((_, j) => j !== i))} className="flex min-h-12 w-full justify-between rounded-lg bg-surface-2 px-3 py-2" title="Tap to remove">
                  <span className="capitalize">{e.method.replace("_", " ")}</span><span>{formatPKR(e.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface-2 p-3"><p className="text-xs uppercase text-muted">{t("stillDue")}</p><p className="text-3xl font-black tabular-nums">{formatPKR(remaining)}</p></div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="text-xs uppercase text-muted">{split && target < remaining ? `${t("takePayer")} ${entries.length + 1}` : method === "cash" ? t("cashReceived") : t("amount")}</p>
              <p className="text-3xl font-black tabular-nums">{formatPKR(typed || target)}</p>
            </div>
          </div>
          {method === "cash" && current && (
            <>
              <div className="mb-3 flex gap-2">
                <button className="h-14 flex-1 rounded-xl bg-accent/20 font-bold" onClick={() => setDigits(String(target / 100))}>{t("exact")}</button>
                {[500, 1000, 5000].map((n) => <button key={n} className="h-14 flex-1 rounded-xl bg-surface-2 font-bold" onClick={() => setDigits(String(n))}>Rs {n}</button>)}
              </div>
              <p className="mb-2 text-sm text-muted">{t("change")}: <b className="text-foreground">{formatPKR(Math.max(0, (current.tendered ?? 0) - current.amount))}</b>
                {quickCashOptions(target).length > 0 && <span className="ml-2">Suggested: {quickCashOptions(target).map((q) => formatPKR(q)).join(" · ")}</span>}</p>
            </>
          )}
          {method === "card" && (
            <div className="mb-3 flex gap-2">{BRANDS.map((b) => <button key={b} onClick={() => setBrand(b)} className={cn("h-12 flex-1 rounded-xl border-2 text-sm font-semibold capitalize", brand === b ? "border-brand bg-brand/15" : "border-border bg-surface-2")}>{b}</button>)}</div>
          )}
          {viaGateway && <p className="mb-3 rounded-xl bg-accent/15 p-3 text-sm">The payment gateway confirms this payment automatically — no code to type.</p>}
          {needsCode && (
            <div className="mb-3">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={method === "card" ? "Terminal approval code" : method === "raast" || method === "bank_transfer" ? "Transfer reference number" : "Transaction ID"} />
              {(method === "raast" || method === "bank_transfer") && <p className="mt-1 text-sm text-warn">Will be marked “pending verification” until a manager confirms the transfer.</p>}
            </div>
          )}
          {split?.mode === "items" && (
            <div className="mb-3 rounded-2xl bg-surface-2 p-3">
              <p className="mb-2 text-sm text-muted">Tap items this payer is paying for (share of tax and discounts included)</p>
              <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                {cart.lines.map((l) => {
                  const n = picked[l.key] ?? 0;
                  return <button key={l.key} onClick={() => { const next = { ...picked, [l.key]: n >= l.quantity ? 0 : n + 1 }; setPicked(next); const sub = cart.lines.reduce((a, x) => a + (lineTotal({ ...x, quantity: next[x.key] ?? 0 })), 0); const all = cart.lines.reduce((a, x) => a + lineTotal(x), 0); setItemTarget(Math.round((sub * totals.total) / Math.max(all, 1)) || null); setDigits(""); }} className={cn("flex min-h-11 items-center justify-between rounded-lg px-3", n ? "bg-brand/20" : "bg-surface")}><span>{n}/{l.quantity} {l.name}</span><span>{formatPKR(lineTotal(l))}</span></button>;
                })}
              </div>
            </div>
          )}
          <Numpad onDigit={(d) => setDigits((v) => (v + d).replace(/^0+(\d)/, "$1").slice(0, 7))} onBackspace={() => setDigits((v) => v.slice(0, -1))} onClear={() => setDigits("")} />
          {online && canRedeem && (
            <label className="mt-3 flex items-center gap-3 rounded-xl bg-accent/15 p-3 text-sm font-semibold">
              <input type="checkbox" className="h-6 w-6" checked={cart.redeem} onChange={(e) => cart.set({ redeem: e.target.checked })} />
              Redeem points ({cart.customerPoints} available){redeem.points > 0 && ` — using ${redeem.points} = ${formatPKR(redeem.value)} off`}
            </label>
          )}
          {online && cart.orderType === "delivery" && entries.length === 0 && (
            <Button variant="secondary" size="lg" className="mt-3 w-full" disabled={pending || !cart.customerPhone} onClick={() => complete(true)}>
              Cash on delivery — rider collects {formatPKR(totals.total)}{!cart.customerPhone && " (add phone first)"}
            </Button>
          )}
          {error && <p className="mt-3 rounded-xl bg-danger/15 p-3 text-danger">{error}</p>}
          <div className="mt-3 flex gap-2">
            {me.can.split && remaining > 0 && <Button variant="secondary" size="xl" disabled={!current || currentCovers || (method === "cash" ? (current.tendered ?? 0) < current.amount : false)} onClick={addPartial}>{split ? `${t("takePayer")} ${entries.length + 1}` : t("addPart")}</Button>}
            <Button variant="success" size="xl" className="flex-1" disabled={pending || (remaining > 0 && !currentCovers)} onClick={() => complete()}>
              {pending ? t("saving") : t("complete")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export async function printReceipt(orderId: string, reprint = false): Promise<string> {
  const msgs: string[] = [];
  
  // 1st SLIP: Kitchen Order Ticket (KOT)
  if (!reprint) {
    const kots = await getKotJobs(orderId);
    if (kots.ok) {
      let failed = 0;
      for (const k of kots.jobs) for (let c = 0; c < k.copies; c++) {
        const r = await sendToBridge(k.target, Uint8Array.from(atob(k.data), (ch) => ch.charCodeAt(0)));
        if (!r.ok) failed++;
      }
      if (kots.jobs.length) msgs.push(failed ? `${failed} kitchen ticket(s) failed — kitchen sees it on the KDS` : "1. Kitchen ticket printed");
    }
  }

  // 2nd SLIP: Customer Receipt
  const job = await getReceiptPrintJob(orderId, reprint);
  if (job.ok) {
    const r = await sendToBridge(job.target, Uint8Array.from(atob(job.data), (c) => c.charCodeAt(0)));
    msgs.push(r.ok ? (reprint ? "Receipt reprinted" : "2. Customer receipt printed") : `Receipt not printed (${r.error})`);
  } else msgs.push(`Receipt not printed: ${job.error}`);

  return msgs.join(" · ");
}
