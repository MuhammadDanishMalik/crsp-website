"use client";

import { useState } from "react";
import { X, CheckCircle2, Bike, Store, CreditCard, Banknote, ShieldCheck, Printer, ArrowRight } from "lucide-react";
import { useCustomerBucket } from "@/lib/stores/bucket";
import { formatPKR } from "@/lib/domain/money";

export function KfcCheckoutModal() {
  const {
    items,
    isCheckoutModalOpen,
    toggleCheckoutModal,
    clearBucket,
    orderType,
  } = useCustomerBucket();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "wallet">("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);

  if (!isCheckoutModalOpen) return null;

  const subtotal = items.reduce((sum, item) => {
    const modTotal = item.modifiers.reduce((mSum, m) => mSum + m.priceDelta, 0);
    return sum + (item.basePrice + modTotal) * item.quantity;
  }, 0);

  const deliveryCharge = orderType === "delivery" ? (subtotal >= 150000 ? 0 : 10000) : 0;
  const grandTotal = subtotal + deliveryCharge;

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || (orderType === "delivery" && !address.trim())) {
      alert("Please fill in all required customer details.");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const orderNo = `CRSP-${Math.floor(100 + Math.random() * 900)}`;
      setConfirmedOrder({
        orderNo,
        name,
        phone,
        address: orderType === "delivery" ? address : "Counter Self Pick-Up",
        orderType,
        paymentMethod,
        items: [...items],
        subtotal,
        deliveryCharge,
        grandTotal,
        placedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      setIsSubmitting(false);
      clearBucket();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={() => !confirmedOrder && toggleCheckoutModal(false)}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-[#141418] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl z-10 text-white flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-[#e30e1f] rounded-sm transform -skew-x-6" />
            <h2 className="text-lg font-black uppercase tracking-tight text-white">
              {confirmedOrder ? "Order Confirmed!" : "Checkout & Delivery"}
            </h2>
          </div>
          <button
            onClick={() => {
              toggleCheckoutModal(false);
              setConfirmedOrder(null);
            }}
            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 no-scrollbar">
          {confirmedOrder ? (
            /* Order Confirmation View */
            <div className="text-center py-4 space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <span className="text-[11px] font-black uppercase text-[#e30e1f] tracking-widest">
                  Thank You, {confirmedOrder.name}!
                </span>
                <h3 className="text-2xl font-black text-white mt-1">
                  Order #{confirmedOrder.orderNo}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Your order has been sent to our kitchen and is being freshly prepared!
                </p>
              </div>

              {/* Order Tracker Banner */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-800">
                  <span className="text-zinc-400">Estimated Delivery:</span>
                  <strong className="text-emerald-400 font-black">30 - 40 Mins</strong>
                </div>
                <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-800">
                  <span className="text-zinc-400">Fulfillment Mode:</span>
                  <span className="font-bold text-white capitalize">{confirmedOrder.orderType}</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-800">
                  <span className="text-zinc-400">Delivery Address:</span>
                  <span className="font-medium text-white max-w-[220px] text-right truncate">
                    {confirmedOrder.address}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-zinc-400">Total Paid (COD):</span>
                  <strong className="text-base text-[#e30e1f] font-black">
                    {formatPKR(confirmedOrder.grandTotal)}
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <button
                onClick={() => {
                  toggleCheckoutModal(false);
                  setConfirmedOrder(null);
                }}
                className="w-full bg-[#e30e1f] hover:bg-red-700 font-black py-3.5 rounded-full text-sm uppercase tracking-wider text-white shadow-xl transition"
              >
                Back to Menu
              </button>
            </div>
          ) : (
            /* Checkout Form */
            <form onSubmit={handlePlaceOrder} className="space-y-5">
              {/* Order mode indicator */}
              <div className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {orderType === "delivery" ? (
                    <Bike size={18} className="text-[#e30e1f]" />
                  ) : (
                    <Store size={18} className="text-[#e30e1f]" />
                  )}
                  <div>
                    <span className="block text-[11px] font-bold text-zinc-400 uppercase">
                      {orderType === "delivery" ? "Home Delivery" : "Self Pick-Up"}
                    </span>
                    <span className="text-xs font-black text-white">
                      CRSP Restaurant
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-[#e30e1f]">
                  {formatPKR(grandTotal)}
                </span>
              </div>

              {/* Customer Info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Danish Awan"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e30e1f]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1.5">
                    Contact Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e30e1f]"
                  />
                </div>

                {orderType === "delivery" && (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1.5">
                      Delivery Address *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="House / Flat #, Street, Block, Area..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e30e1f]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1.5">
                    Nearest Landmark / Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Near PSO Pump, Ring bell twice"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e30e1f]"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="pt-4 border-t border-zinc-800">
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-2.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`p-3 rounded-2xl border text-center transition ${
                      paymentMethod === "cash"
                        ? "border-[#e30e1f] bg-red-950/20 text-white ring-1 ring-[#e30e1f]"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Banknote size={20} className="mx-auto mb-1 text-[#e30e1f]" />
                    <span className="block text-[11px] font-bold">Cash on Delivery</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`p-3 rounded-2xl border text-center transition ${
                      paymentMethod === "card"
                        ? "border-[#e30e1f] bg-red-950/20 text-white ring-1 ring-[#e30e1f]"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <CreditCard size={20} className="mx-auto mb-1 text-[#e30e1f]" />
                    <span className="block text-[11px] font-bold">Card on Delivery</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("wallet")}
                    className={`p-3 rounded-2xl border text-center transition ${
                      paymentMethod === "wallet"
                        ? "border-[#e30e1f] bg-red-950/20 text-white ring-1 ring-[#e30e1f]"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <ShieldCheck size={20} className="mx-auto mb-1 text-[#e30e1f]" />
                    <span className="block text-[11px] font-bold">JazzCash / Raast</span>
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#e30e1f] hover:bg-red-700 active:scale-95 text-white font-black text-sm uppercase tracking-wider py-4 rounded-full shadow-xl shadow-red-600/30 transition flex items-center justify-center gap-2 mt-4"
              >
                <span>{isSubmitting ? "Placing Order..." : `Confirm Order · ${formatPKR(grandTotal)}`}</span>
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
