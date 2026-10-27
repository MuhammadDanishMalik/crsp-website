"use client";
import { useEffect, useMemo, useState } from "react";
import { LocateFixed, Plane, MapPin, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { formatPKR } from "@/lib/domain/money";
import { computeTotals } from "@/lib/domain/pricing";
import { markNoDiscount } from "@/lib/domain/discount-scope";
import { openingOfferBps, OPENING_OFFER } from "@/lib/domain/opening-offer";
import { placeWebsiteOrder } from "@/lib/actions/orders";
import type { PublicMenu, PosItem } from "@/lib/queries/menu";

const PHONE = "0309 0135353";

type Line = { key: string; itemId: string; name: string; price: number; qty: number; mods: { id: string; name: string; priceDelta: number }[] };

/** Clean photo of a deal from the menu card (Deal 1–9). */
const dealImage = (name: string) => { const m = /^deal\s*(\d+)/i.exec(name); return m && Number(m[1]) <= 9 ? `/deals/deal-${m[1]}.jpg` : null; };
/** Clean product photos: deals use the menu-card photos, the rest are matched by category / name. */
const FOOD: [RegExp, string][] = [
  [/bottle 1(\.5)? l/i, "cola-big"], [/soft drink/i, "cola-bottle"],
  [/^chicken piece$/i, "chicken"],
];
const CATEGORY_FOOD: Record<string, string> = { Burgers: "burger", Wraps: "wrap", Wings: "wings", Fries: "fries", Broast: "chicken", "Nuggets & Strips": "chicken" };
const imageOf = (i: PosItem, category?: string) => {
  const d = dealImage(i.name);
  if (d) return d;
  const byName = FOOD.find(([re]) => re.test(i.name));
  const f = byName?.[1] ?? (category ? CATEGORY_FOOD[category] : undefined);
  return f ? `/site/food/${f}.png` : null;
};

export function SiteHome({ menu }: { menu: PublicMenu }) {
  const [cat, setCat] = useState<string>("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [pick, setPick] = useState<PosItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [done, setDone] = useState<null | { orderNo: string; total: number }>(null);

  useEffect(() => { try { const raw = localStorage.getItem("crsp.site.cart"); if (raw) setLines(JSON.parse(raw)); } catch { /* private mode */ } }, []);
  useEffect(() => { try { localStorage.setItem("crsp.site.cart", JSON.stringify(lines)); } catch { /* private mode */ } }, [lines]);

  const catName = useMemo(() => { const c = new Map(menu.categories.map((x) => [x.id, x.name])); const i = new Map(menu.items.map((x) => [x.id, c.get(x.categoryId)])); return (id: string) => i.get(id); }, [menu]);
  const totals = useMemo(() => {
    const cl = lines.map((l) => ({ key: l.key, itemId: l.itemId, name: l.name, basePrice: l.price, quantity: l.qty, modifiers: l.mods }));
    const bps = openingOfferBps();
    return computeTotals({ lines: markNoDiscount(cl, catName), discount: bps ? { kind: "percent", value: bps } : null, orderType: "delivery", taxRules: [] });
  }, [lines, catName]);
  const count = lines.reduce((a, l) => a + l.qty, 0);

  const add = (item: PosItem, mods: Line["mods"], qty = 1) => setLines((ls) => {
    const sig = `${item.id}|${mods.map((m) => m.id).sort().join(",")}`;
    const hit = ls.find((l) => l.key === sig);
    if (hit) return ls.map((l) => (l.key === sig ? { ...l, qty: Math.min(20, l.qty + qty) } : l));
    return [...ls, { key: sig, itemId: item.id, name: item.name, price: item.price, qty, mods }];
  });
  const change = (key: string, d: number) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0));

  const qtyOf = (i: PosItem) => lines.find((l) => l.key === `${i.id}|`)?.qty ?? 0;
  const visibleCats = menu.categories.filter((c) => menu.items.some((i) => i.categoryId === c.id && i.available));
  const sections = visibleCats.filter((c) => cat === "all" || c.id === cat);
  const deals = menu.items.filter((i) => catName(i.id) === "Deals" && i.available);

  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Logo height={36} priority />
          <div className="flex items-center gap-2">
            <a href={`tel:${PHONE.replace(/\s/g, "")}`} className="hidden rounded-full px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 sm:block">Call {PHONE}</a>
            <button onClick={() => setCartOpen(true)} className="btn-shine relative flex h-11 items-center gap-2 rounded-full bg-[#d62828] px-4 text-sm font-bold text-white shadow-sm active:scale-95">
              <ShoppingBag size={18} /> My order
              {count > 0 && <span className="rounded-full bg-white px-2 text-xs font-black text-[#d62828]">{count}</span>}
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-zinc-100 bg-gradient-to-b from-red-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:py-14">
          <p className="text-sm font-bold uppercase tracking-widest text-[#d62828]">CRSP Watta Khail Chowk · Mianwali</p>
          <Tagline />
          <FlightRoute />
          {openingOfferBps() > 0 && (
            <div className="mx-auto mt-8 max-w-xl drop-shadow-[0_8px_18px_rgba(214,40,40,.22)]">
              <div className="ticket flex items-stretch">
                <div className="flex w-[7.5rem] shrink-0 items-center justify-center p-2 sm:w-44">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/site/offer.png" alt="" width={176} height={176} className="anim-bob h-28 w-28 object-contain sm:h-36 sm:w-36" style={{ animation: "crsp-bob 3s ease-in-out infinite" }} />
                </div>
                <div className="flex-1 border-l-2 border-dashed border-red-200 p-4 text-left sm:p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Opening offer</p>
                  <p className="text-shimmer text-2xl font-black leading-tight sm:text-3xl">{OPENING_OFFER.bps / 100}% off</p>
                  <p className="mt-1 text-sm font-semibold">On your whole order <span className="font-normal text-zinc-500">(cold drinks excluded)</span></p>
                  <Countdown />
                </div>
              </div>
            </div>
          )}
          <div className="mt-6"><a href="#menu" className="btn-shine inline-block rounded-full bg-zinc-900 px-6 py-3 font-bold text-white hover:bg-zinc-700">See the menu</a></div>
        </div>
      </section>

      {deals.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-10">
          <h2 className="text-2xl font-black">Deals</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d) => <ItemCard key={d.id} item={d} category="Deals" qty={qtyOf(d)} onChange={(n) => change(`${d.id}|`, n)} onAdd={() => (d.groups.length ? setPick(d) : add(d, []))} />)}
          </div>
        </section>
      )}

      <section id="menu" className="mx-auto max-w-6xl px-4 pt-10">
        <div className="sticky top-16 z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur">
          {[{ id: "all", name: "All" }, ...visibleCats].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${cat === c.id ? "border-[#d62828] bg-[#d62828] text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}>{c.name}</button>
          ))}
        </div>
        {sections.filter((c) => c.name !== "Deals" || cat !== "all").map((c) => (
          <div key={c.id} className="pt-8">
            <h2 className="text-2xl font-black">{c.name}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {menu.items.filter((i) => i.categoryId === c.id).map((i) => <ItemCard key={i.id} item={i} category={c.name} qty={qtyOf(i)} onChange={(n) => change(`${i.id}|`, n)} onAdd={() => (i.groups.length ? setPick(i) : add(i, []))} />)}
            </div>
          </div>
        ))}
      </section>

      <footer className="mt-16 border-t border-zinc-200 bg-zinc-50 py-8 text-center text-sm text-zinc-500">
        <p className="font-semibold text-zinc-700">CRSP · Watta Khail Chowk, Mianwali</p>
        <p className="mt-1">Call {PHONE}</p>
        <p className="mt-3">Developed by <a href="https://orixto.com" target="_blank" rel="noreferrer" className="font-bold text-[#d62828] underline-offset-2 hover:underline">Orixto</a></p>
        <p className="mt-2"><a href="/?portal=1" className="text-xs text-zinc-400 hover:text-zinc-600">Staff login</a></p>
      </footer>

      {pick && <PickModal item={pick} onClose={() => setPick(null)} onAdd={(mods, qty) => { add(pick, mods, qty); setPick(null); setCartOpen(true); }} />}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && setCartOpen(false)}>
          <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 p-4"><h2 className="text-xl font-black">My order</h2><button onClick={() => setCartOpen(false)} aria-label="Close" className="rounded-full p-2 hover:bg-zinc-100"><X /></button></div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {!lines.length && <p className="py-16 text-center text-zinc-500">Your order is empty</p>}
              {lines.map((l) => (
                <div key={l.key} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3">
                  <div className="min-w-0"><p className="font-bold">{l.name}</p>{l.mods.length > 0 && <p className="text-xs text-zinc-500">{l.mods.map((m) => m.name).join(", ")}</p>}<p className="text-sm font-semibold text-[#d62828]">{formatPKR((l.price + l.mods.reduce((a, m) => a + m.priceDelta, 0)) * l.qty)}</p></div>
                  <div className="flex items-center gap-2"><button onClick={() => change(l.key, -1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300"><Minus size={16} /></button><span className="w-5 text-center font-bold">{l.qty}</span><button onClick={() => change(l.key, 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300"><Plus size={16} /></button></div>
                </div>
              ))}
            </div>
            {lines.length > 0 && (
              <div className="space-y-1 border-t border-zinc-200 p-4 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatPKR(totals.subtotal)}</span></div>
                {totals.discountTotal > 0 && <div className="flex justify-between text-emerald-700"><span>Opening offer {OPENING_OFFER.bps / 100}%</span><span>− {formatPKR(totals.discountTotal)}</span></div>}
                <div className="flex justify-between text-lg font-black"><span>Total (cash on delivery)</span><span>{formatPKR(totals.total)}</span></div>
                <button onClick={() => { setCartOpen(false); setCheckout(true); }} className="btn-shine mt-3 h-12 w-full rounded-full bg-[#d62828] font-bold text-white active:scale-[.99]">Checkout</button>
              </div>
            )}
          </aside>
        </div>
      )}
      {checkout && <Checkout lines={lines} total={totals.total} onClose={() => setCheckout(false)} onDone={(o) => { setCheckout(false); setLines([]); setDone(o); }} />}
      {done && (
        <Overlay onClose={() => setDone(null)}>
          <div className="p-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/thankyou.png" alt="Thank you" width={420} height={358} className="mx-auto h-auto w-full max-w-sm object-contain" />
            <h2 className="mt-4 text-2xl font-black">Order #{done.orderNo} received!</h2>
            <p className="mt-2 text-zinc-600">Our kitchen will confirm your order shortly and call or WhatsApp you. Please keep your phone nearby.</p>
            <p className="mt-4 text-lg font-bold">Pay {formatPKR(done.total)} cash on delivery</p>
            <button onClick={() => setDone(null)} className="mt-6 h-12 w-full rounded-full bg-zinc-900 font-bold text-white">Done</button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

const WORDS = [
  { w: "Crispy.", line: "Golden crunch in every bite." },
  { w: "Juicy.", line: "Spice injected deep inside the meat." },
  { w: "Spicy.", line: "Real Saudi-style heat — pick your level." },
];

/** The three headline words: they take turns lighting up, and tapping one pops it and shows what it means. */
function Tagline() {
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const [pop, setPop] = useState(0);
  useEffect(() => { if (touched) return; const t = setInterval(() => setActive((a) => (a + 1) % WORDS.length), 2200); return () => clearInterval(t); }, [touched]);
  return (
    <div className="mt-2">
      <h1 className="flex flex-wrap items-center justify-center gap-x-3 text-4xl font-black tracking-tight sm:text-6xl">
        {WORDS.map((x, i) => (
          <button key={`${x.w}-${active === i ? pop : 0}`} onClick={() => { setTouched(true); setActive(i); setPop((n) => n + 1); }} onMouseEnter={() => { setActive(i); setTouched(true); }}
            className={`inline-block rounded-xl px-1 transition-colors ${active === i ? "text-shimmer" : "text-zinc-900"}`} style={active === i ? { animation: `crsp-sweep 2.4s linear infinite${touched ? `, crsp-pop .45s ease-out` : ""}` } : undefined}>
            {x.w}
          </button>
        ))}
      </h1>
      <p key={active} className="mx-auto mt-3 h-6 text-base font-semibold text-zinc-600" style={{ animation: "crsp-rise .4s ease-out" }}>{WORDS[active].line}</p>
    </div>
  );
}

/** "Straight from Saudi Arabia to Mianwali": a plane flies along a dashed route, over and over. */
function FlightRoute() {
  return (
    <div className="mx-auto mt-5 flex max-w-xl items-center gap-3 text-xs font-bold sm:text-sm">
      <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-white">Saudi Arabia</span>
      <div className="relative h-8 flex-1">
        <div className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-zinc-300" />
        <Plane className="anim-fly absolute top-1/2 -translate-y-1/2 text-[#d62828]" style={{ animation: "crsp-fly 4s ease-in-out infinite" }} size={26} />
      </div>
      <span className="shrink-0 rounded-full bg-[#d62828] px-3 py-1.5 text-white">Mianwali</span>
    </div>
  );
}

/** "Offer ends in 5 days 4 h 12 m 30 s", ticking every second. */
function Countdown() {
  const end = useMemo(() => new Date(`${OPENING_OFFER.end}T23:59:59+05:00`).getTime(), []); // end of the last day, Pakistan time
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now === null) return <span className="skeleton mt-2 block h-5 w-48 rounded" />;
  if (end <= now) return null;
  const sec = Math.floor((end - now) / 1000);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
  return <span className="mt-1 block font-black tabular-nums text-zinc-900">Offer ends in {d > 0 ? `${d} day${d === 1 ? "" : "s"} ` : ""}{h} h {m} m {x} s</span>;
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">{children}</div>
    </div>
  );
}

function ItemCard({ item, category, qty, onAdd, onChange }: { item: PosItem; category?: string; qty: number; onAdd: () => void; onChange: (d: number) => void }) {
  const img = imageOf(item, category);
  const isDeal = !!dealImage(item.name);
  const simple = item.groups.length === 0;
  const control = simple && qty > 0 ? (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onChange(-1)} aria-label="Less" className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 active:scale-95"><Minus size={16} /></button>
      <span className="w-6 text-center font-black">{qty}</span>
      <button onClick={() => onChange(1)} aria-label="More" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d62828] text-white active:scale-95"><Plus size={16} /></button>
    </div>
  ) : (
    <button onClick={onAdd} className="btn-shine h-10 rounded-full bg-[#d62828] px-5 text-sm font-bold text-white active:scale-95">{isDeal ? "Add to order" : "Add"}</button>
  );
  return isDeal && img ? (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={item.name} loading="lazy" className="aspect-[2/1] w-full bg-white object-contain" />
      <div className="flex items-end justify-between gap-3 p-4 pt-1">
        <div className="min-w-0"><p className="font-bold leading-tight">{item.name}</p>{item.description && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{item.description}</p>}<p className="mt-1 text-lg font-black text-[#d62828]">{formatPKR(item.price)}</p></div>
        {control}
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" loading="lazy" width={96} height={96} className="h-24 w-24 shrink-0 object-contain" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight">{item.name}</p>
        {item.description && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{item.description}</p>}
        <div className="mt-2 flex items-center justify-between gap-2"><p className="font-black text-[#d62828]">{formatPKR(item.price)}</p>{control}</div>
      </div>
    </div>
  );
}

function PickModal({ item, onClose, onAdd }: { item: PosItem; onClose: () => void; onAdd: (mods: Line["mods"], qty: number) => void }) {
  const [chosen, setChosen] = useState<Record<string, string[]>>(() => Object.fromEntries(item.groups.map((g) => [g.id, g.modifiers.filter((m) => m.isDefault).map((m) => m.id)])));
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState("");
  const toggle = (gid: string, mid: string, max: number) => setChosen((c) => {
    const cur = c[gid] ?? [];
    if (cur.includes(mid)) return { ...c, [gid]: cur.filter((x) => x !== mid) };
    return { ...c, [gid]: max === 1 ? [mid] : cur.length >= max ? cur : [...cur, mid] };
  });
  const mods = item.groups.flatMap((g) => g.modifiers.filter((m) => (chosen[g.id] ?? []).includes(m.id)).map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta })));
  const unit = item.price + mods.reduce((a, m) => a + m.priceDelta, 0);
  const submit = () => {
    for (const g of item.groups) { const n = (chosen[g.id] ?? []).length; if (n < g.min) return setErr(`${g.name}: choose ${g.min === 1 ? "one" : g.min}`); }
    onAdd(mods, qty);
  };
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-zinc-200 p-4"><h2 className="text-xl font-black">{item.name}</h2><button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-zinc-100"><X /></button></div>
      <div className="space-y-5 p-4">
        {item.description && <p className="text-sm text-zinc-600">{item.description}</p>}
        {item.groups.map((g) => (
          <div key={g.id}>
            <p className="font-bold">{g.name} <span className="text-xs font-normal text-zinc-500">{g.min > 0 ? "(required)" : `(up to ${g.max})`}</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.modifiers.map((m) => { const on = (chosen[g.id] ?? []).includes(m.id); return (
                <button key={m.id} onClick={() => toggle(g.id, m.id, g.max)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${on ? "border-[#d62828] bg-red-50 text-[#d62828]" : "border-zinc-200"}`}>{m.name}{m.priceDelta > 0 ? ` +${formatPKR(m.priceDelta)}` : ""}</button>
              ); })}
            </div>
          </div>
        ))}
        {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300"><Minus size={16} /></button><span className="w-6 text-center text-lg font-bold">{qty}</span><button onClick={() => setQty((q) => Math.min(20, q + 1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300"><Plus size={16} /></button></div>
          <button onClick={submit} className="btn-shine h-12 flex-1 rounded-full bg-[#d62828] font-bold text-white">Add · {formatPKR(unit * qty)}</button>
        </div>
      </div>
    </Overlay>
  );
}

function Checkout({ lines, total, onClose, onDone }: { lines: Line[]; total: number; onClose: () => void; onDone: (o: { orderNo: string; total: number }) => void }) {
  const [f, setF] = useState({ name: "", phone: "", whatsapp: "", address: "", note: "", company: "" });
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locMsg, setLocMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [clientId] = useState(() => crypto.randomUUID());
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const locate = () => {
    if (!navigator.geolocation) return setLocMsg("Your browser cannot share location. Please type your address.");
    setLocMsg("Finding your location…");
    navigator.geolocation.getCurrentPosition(async (p) => {
      const { latitude: lat, longitude: lng } = p.coords;
      setLoc({ lat, lng });
      setLocMsg("Location saved ✓ — please check the address below");
      try { // turn the coordinates into a readable address (OpenStreetMap), only when the customer asked for their location
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const j = (await r.json()) as { display_name?: string };
        if (j.display_name) setF((x) => ({ ...x, address: x.address || j.display_name! }));
      } catch { /* the typed address is enough */ }
    }, () => setLocMsg("Could not get your location. Please type your address."), { enableHighAccuracy: true, timeout: 15000 });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await placeWebsiteOrder({
      clientId, name: f.name, phone: f.phone, whatsapp: f.whatsapp || undefined, address: f.address, note: f.note || undefined, company: f.company || undefined,
      lat: loc?.lat, lng: loc?.lng, lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.qty, modifierIds: l.mods.map((m) => m.id) })),
    });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onDone({ orderNo: r.orderNo, total: r.total });
  };
  const input = "h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 outline-none focus:border-[#d62828]";
  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit}>
        <div className="relative border-b border-zinc-200 bg-gradient-to-b from-red-50 to-white px-4 pb-4 pt-5 text-center">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full p-2 hover:bg-zinc-100"><X /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/map.png" alt="" width={200} height={200} className="mx-auto h-48 w-48 object-contain sm:h-56 sm:w-56" />
          <h2 className="mt-1 text-2xl font-black">Delivery details</h2>
          <p className="text-sm text-zinc-500">Tell us where to bring your order</p>
        </div>
        <div className="space-y-3 p-4">
          <input className={input} placeholder="Your name" value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} autoComplete="name" />
          <input className={input} placeholder="Phone number (03xx xxxxxxx)" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} required maxLength={20} autoComplete="tel" />
          <input className={input} placeholder="WhatsApp number (if different)" inputMode="tel" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} maxLength={20} />
          <button type="button" onClick={locate} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#d62828] font-bold text-[#d62828]"><LocateFixed size={18} />Use my current location</button>
          {locMsg && <p className="flex items-center gap-1.5 text-sm text-zinc-600"><MapPin size={14} />{locMsg}</p>}
          <textarea className={`${input} h-24 py-2`} placeholder="Full delivery address (street, house no., landmark)" value={f.address} onChange={(e) => set("address", e.target.value)} required maxLength={300} />
          <input className={input} placeholder="Note for the kitchen (optional)" value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={200} />
          <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.company} onChange={(e) => set("company", e.target.value)} />
          {err && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{err}</p>}
          <button disabled={busy} className={`h-12 w-full rounded-full bg-[#d62828] font-bold text-white ${busy ? "shimmer-busy" : "btn-shine"}`}>{busy ? "Placing order…" : `Place order · ${formatPKR(total)} cash on delivery`}</button>
          <p className="text-center text-xs text-zinc-500">The final amount is confirmed by our kitchen.</p>
        </div>
      </form>
    </Overlay>
  );
}
