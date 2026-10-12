"use client";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function Modal({ title, onClose, children, width = "max-w-lg" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label={title} className={cn("flex max-h-[94vh] w-full flex-col rounded-3xl border border-border bg-surface shadow-2xl", width)}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-12 w-12 items-center justify-center rounded-xl hover:bg-surface-2"><X /></button>
        </div>
        <div className="scroll-thin overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
