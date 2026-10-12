import Link from "next/link";
import { ChefHat, Monitor, ShoppingBag, Tv, Settings } from "lucide-react";
import { getTerminalClaims } from "@/lib/auth/session";
import { Logo } from "@/components/brand/logo";

const dev = process.env.NODE_ENV !== "production";

export default async function Start() {
  const registered = !!(await getTerminalClaims());
  const tiles = [
    { href: registered ? "/pin" : "/terminal", title: "POS / Cashier", desc: registered ? "Sign in with your PIN" : "Register this device first", icon: ShoppingBag },
    { href: registered ? "/pin" : "/terminal", title: "Kitchen display", desc: "Sign in with the kitchen PIN", icon: ChefHat },
    { href: "/login", title: "Back office", desc: "Menu, staff, inventory, accounts", icon: Settings },
    { href: "/status", title: "Order status TV", desc: "Preparing / Ready board", icon: Tv },
    { href: "/customer", title: "Customer display", desc: "Second screen at the counter", icon: Monitor },
  ];
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center p-6">
      <div className="mb-8 text-center"><Logo height={110} className="mx-auto mb-2" priority /><h1 className="text-2xl font-bold">Point of Sale</h1><p className="text-muted">Crispy · Juicy · Spicy</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link key={t.title} href={t.href} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-brand">
            <t.icon className="text-brand" size={32} /><div><p className="text-lg font-semibold">{t.title}</p><p className="text-sm text-muted">{t.desc}</p></div>
          </Link>
        ))}
      </div>
      {dev && (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-5 text-sm">
          <p className="mb-2 font-semibold">Demo logins (development only — shown because this is not a production build)</p>
          <p>Terminal code: <b className="font-mono">POS1-DEV</b></p>
          <p>PINs: owner 1111 · manager 2222 · cashier 3333 · order taker 4444 · kitchen 5555 · rider 6666 · accountant 7777</p>
          <p>Back office: <b className="font-mono">owner@crsp.test</b> / <b className="font-mono">admin123</b> (also manager@, cashier@, accountant@crsp.test)</p>
        </div>
      )}
    </main>
  );
}
