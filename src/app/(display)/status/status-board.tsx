"use client";
import { useCallback, useState } from "react";
import { fetchStatusBoard } from "@/lib/actions/display";
import { useBranchEvents } from "@/lib/realtime/use-events";

type Board = { preparing: string[]; ready: string[] };

export function StatusBoard({ initial }: { initial: Board }) {
  const [b, setB] = useState(initial);
  const refresh = useCallback(async () => { const d = await fetchStatusBoard(); if (d) setB(d); }, []);
  useBranchEvents(() => { void refresh(); }, 8000);
  return (
    <div className="grid h-full grid-cols-2">
      <Column title="Preparing" nums={b.preparing} tone="text-warn" />
      <Column title="Ready" nums={b.ready} tone="text-success" bg="bg-success/10" />
    </div>
  );
}

function Column({ title, nums, tone, bg = "" }: { title: string; nums: string[]; tone: string; bg?: string }) {
  return (
    <section className={`flex flex-col border-r border-border p-8 last:border-0 ${bg}`}>
      <h1 className={`mb-6 text-center text-6xl font-black uppercase tracking-wide ${tone}`}>{title}</h1>
      <div className="flex flex-wrap content-start justify-center gap-5">
        {nums.map((n) => <span key={n} className="min-w-40 rounded-3xl bg-surface px-6 py-4 text-center text-7xl font-black tabular-nums">{n}</span>)}
      </div>
    </section>
  );
}
