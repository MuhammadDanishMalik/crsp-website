"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Clock, LogOut, Search, Settings2, Star, Wifi, WifiOff, Wallet } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { useBranchEvents } from "@/lib/realtime/use-events";
import { useCart, type OrderType } from "@/lib/stores/cart";
import { formatPKR } from "@/lib/domain/money";
import { CategoryIcon } from "@/components/pos/icons";
import { cn } from "@/lib/utils";
import type { PosItem } from "@/lib/queries/menu";
import { CartPanel } from "./cart-panel";
import { ModifierSheet } from "./modifier-sheet";
import { PayDialog } from "./pay-dialog";
import { DiscountDialog } from "./discount-dialog";
import { OrderFieldsDialog } from "./order-fields";
import { HeldDialog } from "./held-dialog";
import { WebsiteTab } from "./website-orders";
import { SyncStatus } from "./sync-status";
import { holdOrder, listHeld } from "@/lib/actions/hold";
import type { PosProps } from "./types";
import { Logo } from "@/components/brand/logo";
import { useLocale, useTranslations } from "next-intl";
import { LocaleToggle } from "@/components/locale-toggle";

const TYPES: { id: OrderType }[] = [{ id: "dine_in" }, { id: "takeaway" }, { id: "delivery" }, { id: "drive_thru" }]; // website orders have their own tab (see WebsiteTab)
const FAV = "__fav";

export function PosScreen({ menu, me, shiftOpenedAt, offline }: PosProps) {
  const cart = useCart();
  const router = useRouter();
  const t = useTranslations();
  const ur = useLocale() === "ur";
  const [cat, setCat] = useState<string>(FAV);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<PosItem | null>(null);
  const [paying, setPaying] = useState(false);
  const [discounting, setDiscounting] = useState(false);
  const [details, setDetails] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const online = useOnline();
  // Instant sold-out / menu edits from the back office
  useBranchEvents((type) => {
    if (type === "menu.changed") router.refresh();
    if (me.can.hold) void listHeld().then((l) => setHeldCount(l.length));
  }, 30_000);
  useEffect(() => { if (me.can.hold) void listHeld().then((l) => setHeldCount(l.length)); }, [me.can.hold]);

  const hold = async () => {
    const r = await holdOrder({
      type: cart.orderType, tableNo: cart.tableNo || undefined, customerPhone: cart.customerPhone || undefined, customerName: cart.customerName || undefined,
      deliveryAddress: cart.deliveryAddress || undefined, deliveryZoneId: cart.deliveryZoneId ?? undefined, aggregatorName: cart.aggregatorName || undefined,
      lines: cart.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, modifierIds: l.modifiers.map((m) => m.id), note: l.note || undefined })),
    });
    setToast(r.ok ? `Held as ${r.ref}` : r.error);
    if (r.ok) { cart.clear(); setHeldCount((n) => n + 1); }
    setTimeout(() => setToast(""), 3000);
  };

  const types = TYPES.filter((x) => (x.id !== "delivery" || me.can.delivery));
  const favs = useMemo(() => menu.items.filter((i) => i.isFavourite), [menu.items]);
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term) return menu.items.filter((i) => i.name.toLowerCase().includes(term) || i.barcode === term);
    if (cat === FAV) return favs;
    return menu.items.filter((i) => i.categoryId === cat);
  }, [menu.items, cat, q, favs]);

  const pick = (item: PosItem) => {
    if (!item.available) return;
    if (item.groups.length) return setSheet(item);
    cart.add({ itemId: item.id, name: item.name, basePrice: item.price, quantity: 1, modifiers: [] });
  };

  // Barcode scanner (keyboard wedge): digits + Enter in the search box adds the matching item.
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const hit = menu.items.find((i) => i.barcode && i.barcode === q.trim());
    if (hit) { pick(hit); setQ(""); }
  };

  // Shortcuts: F2 search, F4 pay, F8 discount
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F4" && cart.lines.length) { e.preventDefault(); setPaying(true); }
      if (e.key === "F8" && me.can.discount && cart.lines.length) { e.preventDefault(); setDiscounting(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cart.lines.length, me.can.discount]);

  const subtotal = cart.lines.reduce((a, l) => a + (l.basePrice + l.modifiers.reduce((x, m) => x + m.priceDelta, 0)) * l.quantity, 0);
  const needsDetails = cart.orderType === "dine_in" || cart.orderType === "online"; // delivery works like takeaway: its address is typed in the pay window
  const detailsOk = cart.orderType === "dine_in" ? !!cart.tableNo : true;
  const startPay = () => (needsDetails && !detailsOk ? setDetails(true) : setPaying(true));

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-4">
        <Logo height={34} />
        <div className="leading-tight"><p className="font-bold">{me.branch}</p><p className="text-xs text-muted">{me.terminal}</p></div>
        <ShiftTimer since={shiftOpenedAt} />
        <div className="mx-auto flex gap-1 rounded-2xl bg-surface-2 p-1">
          {types.map((tp) => (
            <button key={tp.id} onClick={() => cart.set({ orderType: tp.id })}
              className={cn("h-12 rounded-xl px-4 font-semibold transition", cart.orderType === tp.id ? "bg-brand text-brand-fg" : "text-muted hover:text-foreground")}>{t(`types.${tp.id}`)}</button>
          ))}
          <WebsiteTab />
        </div>
        {needsDetails && (
          <button onClick={() => setDetails(true)} className={cn("h-12 rounded-xl border px-4 text-sm font-semibold", detailsOk ? "border-border" : "border-warn text-warn")}>
            {cart.orderType === "dine_in" ? (cart.tableNo ? `${t("pos.table")} ${cart.tableNo}` : t("pos.setTable")) : cart.orderType === "delivery" ? (detailsOk ? t("pos.deliverySet") : t("pos.addAddress")) : t("pos.platform")}
          </button>
        )}
        <SyncStatus online={online} onSynced={(n) => { setToast(`${n} ${t("sync.uploaded")}`); setTimeout(() => setToast(""), 4000); router.refresh(); }} />
        <span className={cn("flex items-center gap-1 text-sm", online ? "text-success" : "text-danger")}>{online ? <Wifi size={18} /> : <WifiOff size={18} />}{online ? t("pos.online") : t("pos.offline")}</span>
        {me.can.hold && <button onClick={() => setHeldOpen(true)} className="flex h-12 items-center gap-2 rounded-xl px-3 hover:bg-surface-2">{t("pos.held")}{heldCount > 0 && <span className="rounded-full bg-accent px-2 text-sm font-bold text-black">{heldCount}</span>}</button>}
        {me.can.deliveryBoard && <button onClick={() => router.push("/delivery")} className="flex h-12 items-center gap-2 rounded-xl px-3 hover:bg-surface-2">{t("pos.deliveries")}</button>}
        <button onClick={() => router.push("/orders")} className="flex h-12 items-center gap-2 rounded-xl px-3 hover:bg-surface-2">{t("pos.orders")}</button>
        {me.can.shift && <button onClick={() => router.push("/shift")} className="flex h-12 items-center gap-2 rounded-xl px-3 hover:bg-surface-2"><Wallet size={20} />{t("shift.shift")}</button>}
        {me.can.admin && <button onClick={() => router.push("/admin")} aria-label="Back office" className="flex h-12 w-12 items-center justify-center rounded-xl hover:bg-surface-2"><Settings2 size={20} /></button>}
        <LocaleToggle />
        <form action={logout}><button aria-label={t("common.signOut")} className="flex h-12 w-12 items-center justify-center rounded-xl hover:bg-surface-2"><LogOut size={20} /></button></form>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="scroll-thin flex w-28 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border bg-surface p-2">
          <RailBtn active={cat === FAV && !q} onClick={() => { setCat(FAV); setQ(""); }} label={t("pos.bestSellers")} icon={<Star />} />
          {menu.categories.map((c) => (
            <RailBtn key={c.id} active={cat === c.id && !q} onClick={() => { setCat(c.id); setQ(""); }} label={ur && c.nameUr ? c.nameUr : c.name} icon={<CategoryIcon name={c.icon} />} />
          ))}
        </nav>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} placeholder={t("pos.search")}
                className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-4 text-lg outline-none focus:border-brand" />
            </div>
          </div>
          <div className="scroll-thin grid flex-1 auto-rows-[132px] grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3 overflow-y-auto p-3 pt-0 content-start">
            {visible.map((i) => <ItemTile key={i.id} item={i} ur={ur} soldOut={t("pos.soldOut")} onPick={() => pick(i)} />)}
            {!visible.length && <p className="col-span-full mt-16 text-center text-muted">{t("pos.nothing")}</p>}
          </div>
        </main>

        <CartPanel
          menu={menu}
          me={{ ...me, can: { ...me.can, discount: me.can.discount && online } }}
          onPay={startPay}
          onDiscount={() => setDiscounting(true)}
          onHold={hold}
          onPickItem={pick}
        />
      </div>

      {sheet && (
        <ModifierSheet item={sheet} onClose={() => setSheet(null)}
          onAdd={(mods, qty) => { cart.add({ itemId: sheet.id, name: sheet.name, basePrice: sheet.price, quantity: qty, modifiers: mods }); setSheet(null); }} />
      )}
      {paying && <PayDialog menu={menu} me={me} offline={offline} online={online} onClose={() => setPaying(false)} onFinished={() => { setPaying(false); if (navigator.onLine) router.refresh(); /* offline: a refresh would fail and reload the page */ }} />}
      {discounting && <DiscountDialog subtotal={subtotal} me={me} current={cart.discount} onClose={() => setDiscounting(false)} onApply={(d) => { cart.set({ discount: d }); setDiscounting(false); }} />}
      {heldOpen && <HeldDialog menu={menu} canMove={me.can.moveTable} onClose={() => { setHeldOpen(false); void listHeld().then((l) => setHeldCount(l.length)); }} />}
      {toast && <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-surface-2 px-6 py-3 text-lg font-semibold shadow-xl">{toast}</div>}
      {details && <OrderFieldsDialog menu={menu} onClose={() => setDetails(false)} />}
    </div>
  );
}

function RailBtn({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-semibold transition [&_svg]:h-7 [&_svg]:w-7", active ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted hover:text-foreground")}>
      {icon}<span className="text-center leading-tight">{label}</span>
    </button>
  );
}

function ItemTile({ item, ur, soldOut, onPick }: { item: PosItem; ur: boolean; soldOut: string; onPick: () => void }) {
  const emoji = item.image?.startsWith("emoji:") ? item.image.slice(6) : null;
  return (
    <button onClick={onPick} disabled={!item.available}
      className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-3 text-left transition active:scale-[.97] hover:border-brand">
      <span className="text-4xl leading-none">{emoji ?? "🍽️"}</span>
      <span>
        <span dir="auto" className="block text-[15px] font-semibold leading-tight">{ur && item.nameUr ? item.nameUr : item.name}</span>
        <span className="text-sm font-bold text-accent">{formatPKR(item.price)}</span>
        {item.nutrition && <span className="block text-[11px] leading-tight text-muted">{item.nutrition.kcal} kcal · {item.nutrition.protein}g protein</span>}
      </span>
      {!item.available && <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-lg font-black tracking-wide text-danger">{soldOut}</span>}
    </button>
  );
}

function ShiftTimer({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const m = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000));
  return <span suppressHydrationWarning className="flex items-center gap-1 text-sm text-muted"><Clock size={16} />{Math.floor(m / 60)}h {String(m % 60).padStart(2, "0")}m</span>;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb); window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}
function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
