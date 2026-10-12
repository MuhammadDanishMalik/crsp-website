import Link from "next/link";
import { ChefHat, ShoppingBag, ArrowRight, ShieldCheck, Tv } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function Start() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-12">
      {/* Brand Header */}
      <div className="mb-10 text-center">
        <Logo height={100} className="mx-auto mb-3" priority />
        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          CRSP Food System
        </h1>
        <p className="mt-1 text-sm font-medium text-muted">
          Select a module to launch
        </p>
      </div>

      {/* The 2 Primary Modules */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Module 1: Main Display */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-border bg-surface p-7 shadow-sm transition hover:border-brand hover:shadow-md">
          <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-brand/10 transition group-hover:scale-125" />
          
          <div>
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15 text-brand">
              <ShoppingBag size={28} />
            </div>
            <h2 className="text-2xl font-black text-foreground">1. Main Display</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brand">
              Cashier & POS Terminal
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Take customer orders, process cash/cards, generate dual slips (Kitchen KOT + Customer receipt), and access orders history.
            </p>
          </div>

          <div className="mt-6">
            <a
              href="/api/launch?module=main"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-brand-fg shadow-sm transition hover:opacity-95"
            >
              Open Main Display <ArrowRight size={18} />
            </a>
          </div>
        </div>

        {/* Module 2: Kitchen Display */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-border bg-surface p-7 shadow-sm transition hover:border-emerald-500 hover:shadow-md">
          <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-emerald-500/15 text-emerald-500">
            <ChefHat size={28} />
          </div>

          <div>
            <h2 className="text-2xl font-black text-foreground">2. Kitchen Display</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-500">
              Kitchen Display System (KDS)
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Live orders display for kitchen chefs. Shows incoming food tickets with item notes, timers, and bump/recall completion controls.
            </p>
          </div>

          <div className="mt-6">
            <a
              href="/api/launch?module=kitchen"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-sm transition hover:bg-emerald-500"
            >
              Open Kitchen Display <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </div>

      {/* Secondary Quick Links */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted">
        <Link href="/login" className="flex items-center gap-1.5 hover:text-foreground hover:underline">
          <ShieldCheck size={14} /> Back Office Admin Login
        </Link>
        <span>•</span>
        <Link href="/status" className="flex items-center gap-1.5 hover:text-foreground hover:underline">
          <Tv size={14} /> Customer Status TV Screen
        </Link>
      </div>
    </main>
  );
}
