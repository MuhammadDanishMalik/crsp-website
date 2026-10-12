/** Mirrors the live cart to a second window on the same PC (customer-facing display). No server round-trip. */
export type CartBroadcast = {
  lines: { name: string; qty: number; mods: string[]; total: number }[];
  subtotal: number; discount: number; tax: number; total: number; status: "idle" | "ordering" | "paid"; orderNo?: string; change?: number;
};
export const CART_CHANNEL = "crsp-cart";
export function broadcastCart(msg: CartBroadcast) {
  try { const ch = new BroadcastChannel(CART_CHANNEL); ch.postMessage(msg); ch.close(); } catch { /* unsupported */ }
}
