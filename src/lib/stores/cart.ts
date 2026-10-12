import { create } from "zustand";
import { computeTotals, lineTotal, unitPrice, type CartLine, type TaxRuleInput } from "@/lib/domain/pricing";

export type OrderType = "dine_in" | "takeaway" | "delivery" | "drive_thru" | "online";
export type CartDiscount = { kind: "percent" | "fixed"; value: number; reason?: string; code?: string; label?: string; overrideToken?: string };

type State = {
  lines: CartLine[];
  orderType: OrderType;
  tableNo: string;
  customerPhone: string;
  customerName: string;
  deliveryAddress: string;
  deliveryZoneId: string | null;
  aggregatorName: string;
  customerPoints: number; // loyalty balance of the looked-up customer
  redeem: boolean; // redeem the maximum points on this order
  discount: CartDiscount | null;
  clientId: string; // regenerated per order; doubles as idempotency key
  add: (line: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  setNote: (key: string, note: string) => void;
  remove: (key: string) => void;
  set: (p: Partial<Omit<State, "lines" | "add" | "setQty" | "setNote" | "remove" | "clear" | "set">>) => void;
  clear: () => void;
};

const fresh = () => ({
  lines: [] as CartLine[], tableNo: "", customerPhone: "", customerName: "", deliveryAddress: "", deliveryZoneId: null as string | null,
  aggregatorName: "", customerPoints: 0, redeem: false, discount: null as CartDiscount | null, clientId: crypto.randomUUID(),
});

const sig = (l: Omit<CartLine, "key">) => `${l.itemId}|${l.modifiers.map((m) => m.id).sort().join(",")}|${l.note ?? ""}`;

export const useCart = create<State>((set) => ({
  ...fresh(),
  orderType: "takeaway",
  add: (line) =>
    set((st) => {
      const existing = st.lines.find((l) => sig(l) === sig(line));
      if (existing) return { lines: st.lines.map((l) => (l === existing ? { ...l, quantity: Math.min(99, l.quantity + line.quantity) } : l)) };
      return { lines: [...st.lines, { ...line, key: crypto.randomUUID() }] };
    }),
  setQty: (key, qty) => set((st) => ({ lines: qty <= 0 ? st.lines.filter((l) => l.key !== key) : st.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, qty) } : l)) })),
  setNote: (key, note) => set((st) => ({ lines: st.lines.map((l) => (l.key === key ? { ...l, note } : l)) })),
  remove: (key) => set((st) => ({ lines: st.lines.filter((l) => l.key !== key) })),
  set: (p) => set(p),
  clear: () => set((st) => ({ ...fresh(), orderType: st.orderType })),
}));

export { computeTotals, lineTotal, unitPrice };
export type { TaxRuleInput };
