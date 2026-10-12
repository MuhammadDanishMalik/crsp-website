import { cn } from "@/lib/utils";

export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn("min-h-12 w-full rounded-xl border border-border bg-surface-2 px-4 text-base outline-none focus:border-brand", className)} />;
}
export function Label({ children, className, htmlFor }: { children: React.ReactNode; className?: string; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className={cn("mb-1 block text-sm font-medium text-muted", className)}>{children}</label>;
}
