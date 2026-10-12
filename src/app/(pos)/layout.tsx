import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { IdleLock } from "@/components/pos/idle-lock";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession({ kind: "pos" });
  const [biz] = await (await getDb()).select().from(s.business).limit(1);
  const lockMinutes = Number((biz?.settings as { lockMinutes?: number } | null)?.lockMinutes) || 5;
  return (
    <div className="pos-root h-screen overflow-hidden">
      {children}
      <IdleLock lockMinutes={lockMinutes} name={session.name} />
    </div>
  );
}
