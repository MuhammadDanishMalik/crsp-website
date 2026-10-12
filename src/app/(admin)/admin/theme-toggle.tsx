"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

const root = () => document.documentElement;

export function ThemeToggle() {
  // Restore the saved theme (DOM only, no state).
  useEffect(() => { try { const v = localStorage.getItem("crsp-theme"); if (v) root().classList.toggle("dark", v === "dark"); } catch { /* storage blocked */ } }, []);
  const toggle = () => {
    const dark = !root().classList.contains("dark");
    root().classList.toggle("dark", dark);
    try { localStorage.setItem("crsp-theme", dark ? "dark" : "light"); } catch { /* storage blocked */ }
  };
  return (
    <button onClick={toggle} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-surface-2 text-sm font-semibold">
      <Sun size={16} className="hidden dark:block" /><Moon size={16} className="dark:hidden" />Switch theme
    </button>
  );
}
