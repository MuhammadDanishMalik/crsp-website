"use client";
import { useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";

/** Small key hint drawn on a button, so the operator learns the keys while working. */
export const Key = ({ k, className = "" }: { k: string; className?: string }) => (
  <kbd aria-hidden className={`pointer-events-none rounded border border-current/25 px-1 font-sans text-[9px] font-bold leading-[13px] opacity-60 ${className}`}>{k}</kbd>
);

/** True while the operator is typing in a field (digits belong to the field then). */
export const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "TEXTAREA" || t.tagName === "SELECT" || (t instanceof HTMLInputElement && !["checkbox", "radio", "button"].includes(t.type)));

/** The digit key pressed (1..9, 0), from the physical key so Shift or the number pad work the same. */
export const digitOf = (e: KeyboardEvent): string | null => /^(?:Digit|Numpad)([0-9])$/.exec(e.code)?.[1] ?? null;
/** 1→0, 2→1 … 9→8, 0→9 */
export const slotOf = (d: string) => (d === "0" ? 9 : Number(d) - 1);
export const slotKey = (i: number) => (i < 9 ? String(i + 1) : i === 9 ? "0" : "");

/** One window keydown listener that always sees the latest handler. */
export function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    const h = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
}

const HELP: [string, [string, string][]][] = [
  ["Order screen", [["Ctrl + 1…9, 0", "Open a menu tab (left side)"], ["Ctrl + ↑ / ↓", "Next / previous tab"], ["1…9, 0", "Add that item"], ["Shift + 1…0", "Items 11 to 20"], ["+  /  −", "Quantity of the last item"], ["Delete", "Remove the last item"], ["Ctrl + Delete", "Clear the whole order"], ["Enter  or  F4", "Pay"], ["F2", "Search (type, then Enter)"], ["F7 / F9 / F6 / F3", "Takeaway / Delivery / Dine-in / Drive-thru"], ["F8", "Discount"], ["Ctrl + H", "Hold the order"]]],
  ["Item options", [["1…9, 0", "Choose an option"], ["+  /  −", "Quantity"], ["Enter", "Add to order"], ["Esc", "Cancel"]]],
  ["Pay window", [["0…9, Backspace", "Type the cash received"], ["Enter", "Complete the order (skip customer details)"], ["Tab", "Go to phone, then name, then address"], ["Esc", "Back to the order"]]],
  ["After payment", [["Enter", "New order"], ["P", "Print the slips again"]]],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width="max-w-3xl">
      <div className="grid gap-5 sm:grid-cols-2">
        {HELP.map(([title, rows]) => (
          <section key={title}>
            <h3 className="mb-2 font-bold text-accent">{title}</h3>
            {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-border py-1 text-sm"><span className="whitespace-nowrap font-bold">{k}</span><span className="text-right text-muted">{v}</span></div>)}
          </section>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted">Open or close this list any time with <b>Ctrl + ?</b> or <b>F1</b></p>
    </Modal>
  );
}
