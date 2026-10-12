"use client";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

/** Touch numpad. Keys are 64px+. */
export function Numpad({ onDigit, onBackspace, onClear, extra }: { onDigit: (d: string) => void; onBackspace: () => void; onClear?: () => void; extra?: React.ReactNode }) {
  const key = "flex h-16 items-center justify-center rounded-2xl bg-surface-2 text-2xl font-semibold active:scale-95 active:bg-border transition";
  return (
    <div className="grid grid-cols-3 gap-3">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" className={key} onClick={() => onDigit(d)}>{d}</button>
      ))}
      <button type="button" className={cn(key, "text-base text-muted")} onClick={onClear}>{extra ?? "Clear"}</button>
      <button type="button" className={key} onClick={() => onDigit("0")}>0</button>
      <button type="button" className={key} onClick={onBackspace} aria-label="Backspace"><Delete /></button>
    </div>
  );
}
