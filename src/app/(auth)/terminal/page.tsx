"use client";
import { useActionState } from "react";
import { registerTerminal } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AuthShell } from "../shell";

export default function TerminalPage() {
  const [state, action, pending] = useActionState(registerTerminal, null);
  return (
    <AuthShell title="Register this terminal" subtitle="Enter the terminal code from Admin → Settings → Terminals">
      <form action={action} className="space-y-4">
        <div>
          <Label>Terminal code</Label>
          <Input name="code" autoFocus placeholder="e.g. POS1-DEV" autoCapitalize="characters" />
        </div>
        {state && !state.ok && <p className="text-danger">{state.error}</p>}
        <Button size="lg" className="w-full" disabled={pending}>Register</Button>
      </form>
    </AuthShell>
  );
}
