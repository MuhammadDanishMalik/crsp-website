"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Sidebar link that stays highlighted while you are on that section. */
export function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-12 items-center gap-3 rounded-xl border-l-4 px-3 font-medium transition",
        active ? "border-brand bg-surface-2 text-foreground" : "border-transparent text-muted hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <span className={cn(active && "text-brand")}>{icon}</span>
      {label}
    </Link>
  );
}
