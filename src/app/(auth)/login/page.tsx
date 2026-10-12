"use client";
import { useActionState } from "react";
import { loginWithPassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AuthShell } from "../shell";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginWithPassword, null);
  return (
    <AuthShell title="Back office" subtitle="Sign in with your email and password">
      <form action={action} className="space-y-4">
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="username" autoFocus /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" /></div>
        {state && !state.ok && <p className="text-danger">{state.error}</p>}
        <Button size="lg" className="w-full" disabled={pending}>Sign in</Button>
        <a href="/pin" className="block text-center text-sm text-muted underline">Cashier PIN login</a>
      </form>
    </AuthShell>
  );
}
