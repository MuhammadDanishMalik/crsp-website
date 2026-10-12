import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "success"; size?: "md" | "lg" | "xl" };

const variants = {
  primary: "bg-brand text-brand-fg hover:brightness-110",
  secondary: "bg-surface-2 text-foreground hover:brightness-110 border border-border",
  ghost: "bg-transparent text-foreground hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
  success: "bg-success text-white hover:brightness-110",
};
const sizes = { md: "min-h-12 px-4 text-base", lg: "min-h-14 px-5 text-lg", xl: "min-h-16 px-6 text-xl" };

export function Button({ variant = "primary", size = "md", className, ...p }: Props) {
  return (
    <button
      {...p}
      className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98]", variants[variant], sizes[size], className)}
    />
  );
}
