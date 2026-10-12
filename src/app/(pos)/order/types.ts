import type { PosMenu } from "@/lib/queries/menu";
import type { OfflineConfig } from "@/lib/offline/types";

export type Me = {
  name: string; branch: string; terminal: string; discountLimitBps: number;
  can: { discount: boolean; discountAbove: boolean; split: boolean; noSale: boolean; hold: boolean; deliveryBoard: boolean; moveTable: boolean; delivery: boolean; aggregator: boolean; shift: boolean; admin: boolean };
};
export type PosProps = { menu: PosMenu; me: Me; shiftOpenedAt: string; offline: OfflineConfig };
