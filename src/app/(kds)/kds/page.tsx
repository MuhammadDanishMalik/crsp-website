import { requireSession } from "@/lib/auth/session";
import { loadKds } from "@/lib/queries/kds";
import { KdsBoard } from "./kds-board";

export default async function KdsPage({ searchParams }: PageProps<"/kds">) {
  const session = await requireSession({ permission: "kds.view", kind: "pos" });
  const sp = await searchParams;
  const station = typeof sp.station === "string" ? sp.station : null;
  const initial = await loadKds(session.branchId, station);
  return <KdsBoard initial={initial} stationId={station} who={session.name} canBump={session.can("kds.bump")} canRecall={session.can("kds.recall")} canPos={session.can("order.create")} />;
}
