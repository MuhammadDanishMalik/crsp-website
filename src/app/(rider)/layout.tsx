import { requireSession } from "@/lib/auth/session";

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  await requireSession({ permission: "delivery.view_assigned", kind: "pos" });
  return <div className="pos-root min-h-screen bg-background">{children}</div>;
}
