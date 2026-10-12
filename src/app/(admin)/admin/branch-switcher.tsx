"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchBranch } from "@/lib/actions/branches";

export function BranchSwitcher({ branches, current }: { branches: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (branches.length < 2) return <p className="mt-1 text-xs text-muted">{branches.find((b) => b.id === current)?.name}</p>;
  return (
    <select aria-label="Branch" disabled={pending} value={current} onChange={(e) => start(async () => { await switchBranch(e.target.value); router.refresh(); })} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface-2 px-2 text-sm font-semibold">
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}
