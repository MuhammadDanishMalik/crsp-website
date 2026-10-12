import { requireSession } from "@/lib/auth/session";

export default async function KdsLayout({ children }: { children: React.ReactNode }) {
  await requireSession({ permission: "kds.view", kind: "pos" });
  return <div className="pos-root h-screen overflow-hidden">{children}</div>;
}
