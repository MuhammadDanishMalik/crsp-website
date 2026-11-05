import { cn } from "@/lib/utils";

/** A grey block with a moving shine: placeholder for something that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton-dark rounded-xl", className)} />;
}

/** Placeholder for the item grid of the till (same cell size as a real tile, so nothing jumps when the data arrives). */
export function ItemGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="grid flex-1 auto-rows-[132px] grid-cols-[repeat(auto-fill,minmax(168px,1fr))] content-start gap-3 p-3 pt-0">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-full rounded-2xl" />)}
    </div>
  );
}
