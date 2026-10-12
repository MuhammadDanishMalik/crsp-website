import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { loadDeliveries, loadRiderCash } from "@/lib/queries/delivery";
import { DeliveryBoard } from "./delivery-board";

export default async function DeliveryPage() {
  const session = await requireSession({ kind: "pos" });
  if (!session.can("delivery.assign") && !session.can("delivery.settle")) redirect("/forbidden");
  const [rows, riders] = await Promise.all([loadDeliveries(session.branchId), loadRiderCash(session.branchId)]);
  return <DeliveryBoard initial={{ rows, riders }} can={{ assign: session.can("delivery.assign"), settle: session.can("delivery.settle") }} />;
}
