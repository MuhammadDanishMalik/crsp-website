import { Skeleton } from "@/components/ui/skeleton";

/** Shown the instant an admin tab is clicked, while the page's data is read on the server. */
export default function Loading() {
  return (
    <div className="max-w-6xl" aria-busy="true">
      <Skeleton className="mb-5 h-9 w-64" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
    </div>
  );
}
