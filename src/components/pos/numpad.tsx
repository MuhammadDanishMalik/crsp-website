"use client";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

/** Touch numpad. Keys are 64px+. */
export function Numpad({ onDigit, onBackspace, onClear, extra, compact }: { compact?: boolean; onDigit: (d: string) => void; onBackspace: () => void; onClear?: () => void; extra?: React.ReactNode }) {
  const key = cn(compact ? "h-9 text-lg" : "h-16 text-2xl", "flex items-center justify-center rounded-2xl bg-surface-2 font-semibold active:scale-95 active:bg-border transition");
  return (
    <div className={cn("grid grid-cols-3", compact ? "gap-1.5" : "gap-3")}>
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" className={key} onClick={() => onDigit(d)}>{d}</button>
      ))}
      <button type="button" className={cn(key, "text-base text-muted")} onClick={onClear}>{extra ?? "Clear"}</button>
      <button type="button" className={key} onClick={() => onDigit("0")}>0</button>
      <button type="button" className={key} onClick={onBackspace} aria-label="Backspace"><Delete /></button>
    </div>
  );
}
