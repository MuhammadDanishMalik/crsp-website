import { requireSession } from "@/lib/auth/session";
import { resolveBranchIds } from "@/lib/queries/branches";
import { loadManageableOrders } from "@/lib/queries/orders";
import { OrdersManager } from "@/components/orders/orders-manager";

const VOID_REASONS = [
  "Customer changed mind",
  "Wrong items entered",
  "Kitchen unable to prepare",
  "Accidental duplicate order",
  "Cashier test entry",
];

const REFUND_REASONS = [
  "Food quality issue",
  "Incorrect order received",
  "Long delay / cancelled",
  "Customer complaint",
  "Overcharged by cashier",
];

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const session = await requireSession({ kind: "admin" });
  const sp = await searchParams;
  const { ids } = await resolveBranchIds(session, typeof sp.branch === "string" ? sp.branch : null);
  const orders = await loadManageableOrders(ids, 500);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Orders Record & History</h1>
        <p className="text-sm text-muted">
          Real-time order audit trail, Kitchen tickets (KOT), customer receipts, item voids, and refunds.
        </p>
      </div>

      <OrdersManager
        orders={orders}
        can={{
          void: session.can("order.void"),
          refund: session.can("refund.create") || session.can("refund.approve"),
          reprint: session.can("order.reprint"),
        }}
        reasons={{
          void: VOID_REASONS,
          refund: REFUND_REASONS,
        }}
        context="admin"
      />
    </div>
  );
}
