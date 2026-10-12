"use client";
import { useEffect } from "react";
import { Minus, Plus, Percent, Trash2 } from "lucide-react";
import { broadcastCart } from "@/lib/stores/cart-channel";
import { useCart } from "@/lib/stores/cart";
import { computeTotals, unitPrice, lineTotal } from "@/lib/domain/pricing";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import type { PosMenu } from "@/lib/queries/menu";
import type { Me } from "./types";
import { useLocale, useTranslations } from "next-intl";

export function CartPanel({ menu, me, onPay, onDiscount, onHold }: { menu: PosMenu; me: Me; onPay: () => void; onDiscount: () => void; onHold: () => void }) {
  const cart = useCart();
  const t = useTranslations();
  const ur = useLocale() === "ur";
  const zone = menu.zones.find((z) => z.id === cart.deliveryZoneId);
  const tot = computeTotals({
    lines: cart.lines, discount: cart.discount, orderType: cart.orderType, paymentMethod: "cash", taxRules: menu.taxRules,
    serviceChargeBps: menu.serviceChargeBps, deliveryCharge: zone?.charge ?? 0,
  });
  const nLines = cart.lines.length;
  useEffect(() => {
    broadcastCart({
      lines: cart.lines.map((l) => ({ name: l.name, qty: l.quantity, mods: l.modifiers.map((m) => m.name), total: lineTotal(l) })),
      subtotal: tot.subtotal, discount: tot.discountTotal, tax: tot.taxTotal, total: tot.total, status: nLines ? "ordering" : "idle",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.lines, cart.discount, cart.orderType, tot.total]);
  return (
    <aside className="flex h-full w-[390px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-bold">{t("pos.currentOrder")}</h2>
        <button disabled={!cart.lines.length} onClick={() => cart.clear()} className="flex h-12 items-center gap-1 rounded-xl px-3 text-danger hover:bg-surface-2"><Trash2 size={18} /> {t("pos.clearOrder")}</button>
      </div>
      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-3">
        {!cart.lines.length && <p className="mt-16 text-center text-muted">{t("pos.tapToStart")}</p>}
        {cart.lines.map((l) => (
          <div key={l.key} className="rounded-2xl bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p dir="auto" className="font-semibold leading-tight">{ur ? (menu.items.find((i) => i.id === l.itemId)?.nameUr ?? l.name) : l.name}</p>
                {l.modifiers.map((m) => <p key={m.id} className="ml-3 text-sm text-muted">+ {m.name}{m.priceDelta ? ` (${formatPKR(m.priceDelta)})` : ""}</p>)}
                {l.note && <p className="ml-3 text-sm italic text-accent">“{l.note}”</p>}
              </div>
              <p className="font-bold tabular-nums">{formatPKR(lineTotal(l))}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button aria-label="Decrease" className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface" onClick={() => cart.setQty(l.key, l.quantity - 1)}><Minus size={18} /></button>
              <span className="w-8 text-center text-lg font-bold">{l.quantity}</span>
              <button aria-label="Increase" className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface" onClick={() => cart.setQty(l.key, l.quantity + 1)}><Plus size={18} /></button>
              <input
                placeholder={t("pos.note")} value={l.note ?? ""} onChange={(e) => cart.setNote(l.key, e.target.value)} maxLength={80}
                className="ml-1 h-12 min-w-0 flex-1 rounded-xl bg-surface px-3 text-sm outline-none"
              />
              <span className="hidden text-xs text-muted">{formatPKR(unitPrice(l))}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-border p-4 text-base">
        <Row label={t("pos.subtotal")} v={tot.subtotal} />
        {tot.discountTotal > 0 && <Row label={t("pos.discount")} v={-tot.discountTotal} cls="text-success" />}
        {tot.serviceCharge > 0 && <Row label={t("pos.service")} v={tot.serviceCharge} />}
        {tot.deliveryCharge > 0 && <Row label={t("pos.delivery")} v={tot.deliveryCharge} />}
        {tot.taxLines.map((x) => <Row key={x.ruleId} label={`${x.name} ${x.rateBps / 100}%`} v={x.amount} cls="text-muted" />)}
        <div className="flex items-center justify-between pt-2 text-2xl font-black"><span>{t("pos.total")}</span><span className="tabular-nums">{formatPKR(tot.total)}</span></div>
        <div className="flex gap-2 pt-2">
          {me.can.discount && (
            <Button variant="secondary" size="lg" disabled={!cart.lines.length} onClick={onDiscount} aria-label="Discount"><Percent size={22} /></Button>
          )}
          {me.can.hold && <Button variant="secondary" size="lg" disabled={!cart.lines.length} onClick={onHold}>{t("pos.hold")}</Button>}
          <Button variant="success" size="xl" className="flex-1 text-2xl tracking-wide" disabled={!cart.lines.length} onClick={onPay}>{t("pos.pay")}</Button>
        </div>
      </div>
    </aside>
  );
}
const Row = ({ label, v, cls = "" }: { label: string; v: number; cls?: string }) => (
  <div className={`flex justify-between ${cls}`}><span>{label}</span><span className="tabular-nums">{formatPKR(v)}</span></div>
);
