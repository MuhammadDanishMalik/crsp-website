"use client";
import { useActionState, useState } from "react";
import { loginWithPassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AuthShell } from "../shell";
import Link from "next/link";
import { LayoutDashboard, Monitor } from "lucide-react";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginWithPassword, null);
  const [email, setEmail] = useState(""); // never prefill credentials: this page is public
  const [password, setPassword] = useState("");

  return (
    <AuthShell title="Main Admin Sign-in" subtitle="Sign in to add/edit dishes and manage CRSP store">
      {/* 2 Fast Access Portals */}
      <div className="mb-6 grid grid-cols-2 gap-2">
        <a
          href="/api/launch?module=admin"
          className="flex flex-col items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-center transition hover:bg-blue-500/20"
        >
          <LayoutDashboard size={18} className="text-blue-500 mb-1" />
          <span className="text-xs font-bold text-foreground">1. Main Admin</span>
          <span className="text-[10px] text-muted">1-Click Launch</span>
        </a>
        <a
          href="/api/launch?module=counter"
          className="flex flex-col items-center justify-center rounded-xl border border-brand/30 bg-brand/10 p-3 text-center transition hover:bg-brand/20"
        >
          <Monitor size={18} className="text-brand mb-1" />
          <span className="text-xs font-bold text-foreground">2. Counter POS</span>
          <span className="text-[10px] text-muted">1-Click Launch</span>
        </a>
      </div>

      <div className="relative mb-5 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <span className="relative bg-surface px-3 text-[11px] font-semibold uppercase text-muted">Or Password Sign In</span>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {state && !state.ok && <p className="text-danger text-xs">{state.error}</p>}
        <Button size="lg" className="w-full" disabled={pending}>
          Sign in as Admin
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <Link href="/pin" className="hover:underline">Cashier PIN Login</Link>
        <Link href="/" className="hover:underline">Back to Website</Link>
      </div>
    </AuthShell>
  );
}
