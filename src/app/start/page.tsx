import Link from "next/link";
import { LayoutDashboard, ShoppingBag, ShieldCheck, Monitor } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function Start() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-12">
      {/* Brand Header */}
      <div className="mb-10 text-center">
        <Logo height={90} className="mx-auto mb-3" priority />
        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          CRSP Portals
        </h1>
        <p className="mt-1 text-sm font-medium text-muted">
          Select portal to continue
        </p>
      </div>

      {/* The 2 Primary Users / Modules */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User 1: Main Admin */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-border bg-surface p-7 shadow-sm transition hover:border-blue-500 hover:shadow-md">
          <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-blue-500/10 transition group-hover:scale-125" />

          <div>
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-500">
              <LayoutDashboard size={28} />
            </div>
            <h2 className="text-2xl font-black text-foreground">1. Main Admin</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-blue-500">
              Dishes &amp; Store Management
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Full control for the owner &amp; manager: add/edit dishes, update menu items, modify prices, view daily sales reports, and manage recipes &amp; stock.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <a
              href="/api/launch?module=admin"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white shadow-sm transition hover:bg-blue-500"
            >
              Open Main Admin ↗
            </a>
          </div>
        </div>

        {/* User 2: Counter / Cashier */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-border bg-surface p-7 shadow-sm transition hover:border-brand hover:shadow-md">
          <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-brand/10 transition group-hover:scale-125" />

          <div>
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15 text-brand">
              <ShoppingBag size={28} />
            </div>
            <h2 className="text-2xl font-black text-foreground">2. Counter (POS)</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brand">
              Cashier &amp; Order Punching
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Fast counter screen for taking customer orders, handling payments, and automatically printing dual receipts (Kitchen Slip with Table # + Customer Receipt).
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <a
              href="/api/launch?module=counter"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-brand-fg shadow-sm transition hover:opacity-95"
            >
              Open Counter ↗
            </a>
          </div>
        </div>
      </div>

      {/* Direct links info */}
      <div className="mt-10 rounded-2xl border border-border bg-surface/50 p-4 text-center text-xs text-muted">
        <p>
          Direct Links: <Link href="/admin" className="font-semibold text-blue-500 hover:underline">/admin</Link> (Main Admin) &nbsp;•&nbsp; <Link href="/order" className="font-semibold text-brand hover:underline">/order</Link> (Counter)
        </p>
      </div>
    </main>
  );
}
