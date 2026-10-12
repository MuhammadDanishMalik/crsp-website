import { requireSession } from "@/lib/auth/session";
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

export default async function PosOrdersPage() {
  const session = await requireSession({ kind: "pos" });
  const orders = await loadManageableOrders(session.branchId, 250);

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <OrdersManager
        orders={orders}
        can={{
          void: session.can("order.void"),
          refund: session.can("refund.create"),
          reprint: session.can("order.reprint"),
        }}
        reasons={{
          void: VOID_REASONS,
          refund: REFUND_REASONS,
        }}
        context="pos"
      />
    </div>
  );
}
