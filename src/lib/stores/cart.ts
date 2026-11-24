import { create } from "zustand";
import type { EditLine } from "@/lib/actions/order-items-edit";
import { computeTotals, lineTotal, unitPrice, type CartLine, type TaxRuleInput } from "@/lib/domain/pricing";

export type OrderType = "dine_in" | "takeaway" | "delivery" | "drive_thru" | "online";
export type CartDiscount = { kind: "percent" | "fixed"; value: number; reason?: string; code?: string; label?: string; overrideToken?: string };

/** Set while an already-rung order is being changed on the till: its existing lines (with the quantities now chosen) — new items live in `lines`. */
export type EditSession = { orderId: string; orderNo: string; lines: EditLine[]; qty: Record<string, number> };

type State = {
  edit: EditSession | null;
  startEdit: (e: { orderId: string; orderNo: string; lines: EditLine[] }) => void;
  setEditQty: (orderItemId: string, qty: number) => void;
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
  deliveryCharge: number | null; // paisa typed by the cashier; null = the automatic rule
  clientId: string; // regenerated per order; doubles as idempotency key
  add: (line: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  setNote: (key: string, note: string) => void;
  remove: (key: string) => void;
  set: (p: Partial<Omit<State, "lines" | "add" | "setQty" | "setNote" | "remove" | "clear" | "set" | "edit" | "startEdit" | "setEditQty">>) => void;
  clear: () => void;
};

const fresh = () => ({
  edit: null as EditSession | null,
  lines: [] as CartLine[], tableNo: "", customerPhone: "", customerName: "", deliveryAddress: "", deliveryZoneId: null as string | null,
  aggregatorName: "", customerPoints: 0, redeem: false, discount: null as CartDiscount | null, deliveryCharge: null as number | null, clientId: crypto.randomUUID(),
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
  startEdit: (e) => set(() => ({ ...fresh(), edit: { orderId: e.orderId, orderNo: e.orderNo, lines: e.lines, qty: Object.fromEntries(e.lines.map((l) => [l.orderItemId, l.quantity])) } })),
  setEditQty: (id, qty) => set((st) => (st.edit ? { edit: { ...st.edit, qty: { ...st.edit.qty, [id]: Math.max(0, Math.min(99, qty)) } } } : {})),
  set: (p) => set(p),
  clear: () => set((st) => ({ ...fresh(), orderType: st.orderType })),
}));

export { computeTotals, lineTotal, unitPrice };
export type { TaxRuleInput };
