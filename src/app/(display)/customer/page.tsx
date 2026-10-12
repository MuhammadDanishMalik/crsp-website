"use client";
import { useEffect, useState } from "react";
import { CART_CHANNEL, type CartBroadcast } from "@/lib/stores/cart-channel";
import { formatPKR } from "@/lib/domain/money";
import { Logo } from "@/components/brand/logo";

const IDLE: CartBroadcast = { lines: [], subtotal: 0, discount: 0, tax: 0, total: 0, status: "idle" };

export default function CustomerDisplay() {
  const [c, setC] = useState<CartBroadcast>(IDLE);
  useEffect(() => {
    const ch = new BroadcastChannel(CART_CHANNEL);
    ch.onmessage = (e) => setC(e.data as CartBroadcast);
    return () => ch.close();
  }, []);
  if (c.status === "idle" || (!c.lines.length && c.status !== "paid")) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-brand text-brand-fg">
        <div className="rounded-[3rem] bg-[#fdf6e3] px-16 py-10"><Logo height={220} priority /></div><p className="text-3xl font-semibold">Crispy · Juicy · Spicy</p><p className="text-xl opacity-80">Welcome! خوش آمدید</p>
      </div>
    );
  }
  if (c.status === "paid") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-5xl font-black text-success">Thank you! شکریہ</p>
        <p className="text-3xl">Your order number</p><p className="text-9xl font-black">#{c.orderNo}</p>
        {!!c.change && <p className="text-3xl">Change: <b>{formatPKR(c.change)}</b></p>}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col p-10">
      <h1 className="mb-4 text-3xl font-bold">Your order</h1>
      <div className="flex-1 space-y-2 overflow-y-auto text-2xl">
        {c.lines.map((l, i) => (
          <div key={i}><div className="flex justify-between"><span>{l.qty} × {l.name}</span><span className="tabular-nums">{formatPKR(l.total)}</span></div>
            {l.mods.map((m) => <p key={m} className="pl-8 text-lg text-muted">+ {m}</p>)}</div>
        ))}
      </div>
      <div className="mt-4 space-y-1 border-t border-border pt-4 text-2xl">
        {c.discount > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>-{formatPKR(c.discount)}</span></div>}
        {c.tax > 0 && <div className="flex justify-between text-muted"><span>Tax</span><span>{formatPKR(c.tax)}</span></div>}
        <div className="flex justify-between text-6xl font-black"><span>Total</span><span className="tabular-nums">{formatPKR(c.total)}</span></div>
      </div>
    </div>
  );
}
