import { ItemGridSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while a till page (order, orders, deliveries…) is being prepared on the server. */
export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-4"><Skeleton className="h-9 w-28" /><Skeleton className="h-9 w-48" /><Skeleton className="ml-auto h-9 w-64" /></div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-28 shrink-0 flex-col gap-2 border-r border-border bg-surface p-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[84px]" />)}</div>
        <div className="flex min-w-0 flex-1 flex-col"><div className="p-3"><Skeleton className="h-14 rounded-2xl" /></div><ItemGridSkeleton /></div>
        <div className="w-[380px] shrink-0 border-l border-border bg-surface p-4"><Skeleton className="mb-3 h-8 w-32" /><Skeleton className="h-24" /></div>
      </div>
    </div>
  );
}
