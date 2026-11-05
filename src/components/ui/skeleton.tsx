import { cn } from "@/lib/utils";

/** A grey block with a moving shine: placeholder for something that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton-dark rounded-xl", className)} />;
}

/** Placeholder for the item grid of the till (same cell size as a real tile, so nothing jumps when the data arrives). */
export function ItemGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="grid flex-1 auto-rows-[132px] grid-cols-[repeat(auto-fill,minmax(168px,1fr))] content-start gap-3 p-3 pt-0">
      {Array.from({ length: count }, (_, i) => <ItemTileSkeleton key={i} />)}
    </div>
  );
}

/** Same box as the till's item tile (rounded-2xl border, flex-col, 132 px row), pulsing while data loads. */
export function ItemTileSkeleton() {
  return (
    <div aria-hidden className="flex animate-pulse flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-3">
      <div className="h-9 w-9 rounded-lg bg-surface-2" />
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded bg-surface-2" />
        <div className="h-4 w-1/3 rounded bg-surface-2" />
      </div>
    </div>
  );
}
