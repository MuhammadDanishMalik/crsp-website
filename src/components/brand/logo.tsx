import Image from "next/image";
import { cn } from "@/lib/utils";

/** CRSP wordmark (transparent PNG in /public/brand). Height-driven; width follows the 1587×743 aspect. */
export function Logo({ height = 40, className, priority }: { height?: number; className?: string; priority?: boolean }) {
  return <Image src="/brand/crsp-logo.png" alt="CRSP" width={Math.round((height * 1587) / 743)} height={height} priority={priority} className={cn("select-none", className)} style={{ height, width: "auto" }} />;
}
