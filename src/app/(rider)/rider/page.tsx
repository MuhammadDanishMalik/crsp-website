import { requireSession } from "@/lib/auth/session";
import { loadDeliveries } from "@/lib/queries/delivery";
import { RiderApp } from "./rider-app";

export default async function RiderPage() {
  const session = await requireSession({ permission: "delivery.view_assigned", kind: "pos" });
  const rows = await loadDeliveries(session.branchId, { riderId: session.staffId });
  return <RiderApp initial={rows} name={session.name} />;
}
