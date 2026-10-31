"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { registerTerminal } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AuthShell } from "../shell";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function TerminalPage() {
  const [state, action, pending] = useActionState(registerTerminal, null);
  useEffect(() => { if (state?.ok && state.redirectTo) window.location.assign(state.redirectTo); }, [state]);
  const [code, setCode] = useState("POS1-DEV");

  return (
    <AuthShell title="Register this terminal" subtitle="Enter your terminal code or use one-click registration">
      <form action={action} className="space-y-4">
        <div>
          <Label>Terminal code</Label>
          <Input
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            placeholder="e.g. POS1-DEV"
            autoCapitalize="characters"
          />
        </div>
        {state && !state.ok && <p className="text-danger text-sm">{state.error}</p>}
        
        <Button size="lg" className="w-full font-bold" disabled={pending}>
          Register Terminal
        </Button>

        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            setCode("POS1-DEV");
            e.currentTarget.form?.requestSubmit();
          }}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand/10 text-xs font-bold text-brand hover:bg-brand/20"
        >
          <Sparkles size={14} /> One-Click Quick Register (POS-1)
        </button>

        <div className="pt-2 text-center">
          <Link href="/start" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
            <ArrowLeft size={13} /> Back to Module Selection
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
