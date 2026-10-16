"use client";

import Image from "next/image";
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, Bike, Store } from "lucide-react";
import { useCustomerBucket } from "@/lib/stores/bucket";
import { formatPKR } from "@/lib/domain/money";

export function KfcBucketDrawer() {
  const {
    items,
    isCartOpen,
    toggleCart,
    updateQty,
    removeItem,
    clearBucket,
    orderType,
    setOrderType,
    selectedBranch,
    selectedCity,
    toggleCheckoutModal,
  } = useCustomerBucket();

  if (!isCartOpen) return null;

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => {
    const modTotal = item.modifiers.reduce((mSum, m) => mSum + m.priceDelta, 0);
    return sum + (item.basePrice + modTotal) * item.quantity;
  }, 0);

  // Delivery charge (free above Rs. 1500 = 150000 paisa)
  const deliveryCharge = orderType === "delivery" ? (subtotal >= 150000 ? 0 : 10000) : 0;
  const grandTotal = subtotal + deliveryCharge;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => toggleCart(false)}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 z-10">
        <div className="w-screen max-w-md bg-[#121215] border-l border-zinc-800 text-white flex flex-col justify-between shadow-2xl">
          
          {/* Header */}
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#e30e1f] flex items-center justify-center text-white shadow-md shadow-red-600/30">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-white">
                  Your Bucket
                </h2>
                <span className="text-xs text-zinc-400">
                  {totalItems} {totalItems === 1 ? "item" : "items"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <button
                  onClick={clearBucket}
                  className="text-[11px] font-bold text-zinc-400 hover:text-red-400 px-2 py-1 transition"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => toggleCart(false)}
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition"
                aria-label="Close bucket"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Fulfillment Toggle & Branch */}
          <div className="p-4 bg-zinc-950/70 border-b border-zinc-800/80">
            <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
              <button
                onClick={() => setOrderType("delivery")}
                className={`py-2 rounded-xl text-xs font-black uppercase transition flex items-center justify-center gap-2 ${
                  orderType === "delivery"
                    ? "bg-[#e30e1f] text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Bike size={14} />
                <span>Delivery</span>
              </button>
              <button
                onClick={() => setOrderType("pickup")}
                className={`py-2 rounded-xl text-xs font-black uppercase transition flex items-center justify-center gap-2 ${
                  orderType === "pickup"
                    ? "bg-[#e30e1f] text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Store size={14} />
                <span>Pick Up</span>
              </button>
            </div>

            <div className="mt-2 text-center text-[11px] text-zinc-400">
              <span>Selected Branch: </span>
              <strong className="text-zinc-200">{selectedBranch}, {selectedCity}</strong>
            </div>
          </div>

          {/* Bucket Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-4">
                  <ShoppingBag size={36} />
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Your bucket is empty
                </h3>
                <p className="mt-1 text-xs text-zinc-400 max-w-xs">
                  Hungry? Explore our delicious crispy chicken broast, zinger burgers, and loaded fries!
                </p>
                <button
                  onClick={() => toggleCart(false)}
                  className="mt-5 bg-[#e30e1f] hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-full shadow-lg transition"
                >
                  Explore Menu
                </button>
              </div>
            ) : (
              items.map((item) => {
                const modTotal = item.modifiers.reduce((sum, m) => sum + m.priceDelta, 0);
                const linePrice = (item.basePrice + modTotal) * item.quantity;

                return (
                  <div
                    key={item.key}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3 flex gap-3 group relative transition hover:border-zinc-700"
                  >
                    {/* Item Thumbnail */}
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-zinc-950 shrink-0">
                      <img
                        src={item.image || "/images/burger.jpg"}
                        alt={item.name}
                        className="w-full h-full object-cover object-center"
                      />
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                          {item.name}
                        </h4>
                        <button
                          onClick={() => removeItem(item.key)}
                          className="text-zinc-500 hover:text-red-400 p-1 rounded-md transition"
                          aria-label="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Modifiers List */}
                      {item.modifiers.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.modifiers.map((m, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-md"
                            >
                              {m.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Bottom row: Stepper & Price */}
                      <div className="mt-3 flex items-center justify-between">
                        {/* Stepper */}
                        <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-full p-0.5">
                          <button
                            onClick={() => updateQty(item.key, item.quantity - 1)}
                            className="w-6 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-7 text-center font-bold text-xs text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.key, item.quantity + 1)}
                            className="w-6 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition"
                            aria-label="Increase quantity"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {/* Price */}
                        <span className="font-black text-sm text-white">
                          {formatPKR(linePrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Checkout Summary */}
          {items.length > 0 && (
            <div className="p-5 border-t border-zinc-800 bg-black/60 space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-bold text-white">{formatPKR(subtotal)}</span>
                </div>
                {orderType === "delivery" && (
                  <div className="flex justify-between text-zinc-400">
                    <span>Delivery Fee</span>
                    <span className="font-bold text-white">
                      {deliveryCharge === 0 ? (
                        <span className="text-emerald-400">FREE</span>
                      ) : (
                        formatPKR(deliveryCharge)
                      )}
                    </span>
                  </div>
                )}
                {orderType === "delivery" && subtotal < 150000 && (
                  <p className="text-[10px] text-amber-400">
                    Add {formatPKR(150000 - subtotal)} more for <strong>FREE DELIVERY</strong>!
                  </p>
                )}
                <div className="pt-2 border-t border-zinc-800 flex justify-between text-sm font-black text-white">
                  <span>Grand Total</span>
                  <span className="text-[#e30e1f] text-base">{formatPKR(grandTotal)}</span>
                </div>
              </div>

              {/* Red KFC Checkout CTA */}
              <button
                onClick={() => {
                  toggleCart(false);
                  toggleCheckoutModal(true);
                }}
                className="w-full bg-[#e30e1f] hover:bg-red-700 active:scale-95 text-white font-black text-sm uppercase tracking-wider py-3.5 px-6 rounded-full shadow-xl shadow-red-600/30 transition flex items-center justify-between"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
