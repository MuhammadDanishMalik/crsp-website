"use client";

import { useState } from "react";
import Link from "next/link";
import { X, LogIn, Monitor, UtensilsCrossed, LayoutDashboard, KeyRound, Sparkles, ArrowRight } from "lucide-react";
import { useCustomerBucket } from "@/lib/stores/bucket";

export function KfcLoginModal() {
  const { isLoginModalOpen, toggleLoginModal } = useCustomerBucket();
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  if (!isLoginModalOpen) return null;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setStep("otp");
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoggedIn(true);
    setTimeout(() => {
      toggleLoginModal(false);
      setLoggedIn(false);
      setStep("phone");
      setPhone("");
      setOtp("");
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={() => toggleLoginModal(false)}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-[#141418] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl z-10 text-white flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-[#e30e1f] rounded-sm transform -skew-x-6" />
            <h2 className="text-lg font-black uppercase tracking-tight text-white">
              Sign In to CRSP
            </h2>
          </div>
          <button
            onClick={() => toggleLoginModal(false)}
            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loggedIn ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-black text-white">Welcome Back!</h3>
              <p className="text-xs text-zinc-400 mt-1">Logged in successfully to CRSP Rewards.</p>
            </div>
          ) : step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1.5">
                  Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                    +92
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="300 1234567"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-14 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e30e1f]"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1.5">
                  We will send a 4-digit code to verify your mobile number.
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-[#e30e1f] hover:bg-red-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider py-3.5 rounded-full shadow-xl shadow-red-600/30 transition flex items-center justify-center gap-2"
              >
                <span>Send Verification Code</span>
                <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1.5">
                  Enter 4-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="1234"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-center text-lg font-black tracking-widest text-white placeholder-zinc-500 focus:outline-none focus:border-[#e30e1f]"
                />
                <p className="text-[10px] text-zinc-400 text-center mt-1.5">
                  Code sent to +92 {phone}
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-[#e30e1f] hover:bg-red-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider py-3.5 rounded-full shadow-xl shadow-red-600/30 transition"
              >
                Verify & Log In
              </button>
            </form>
          )}

          {/* Staff Access Shortcuts */}
          <div className="pt-5 border-t border-zinc-800">
            <span className="block text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-2.5">
              Staff & Management Logins
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/pin"
                onClick={() => toggleLoginModal(false)}
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-2.5 rounded-xl text-xs font-bold text-zinc-200 transition"
              >
                <KeyRound size={15} className="text-[#e30e1f]" />
                <span>Cashier PIN</span>
              </Link>

              <Link
                href="/admin"
                onClick={() => toggleLoginModal(false)}
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-2.5 rounded-xl text-xs font-bold text-zinc-200 transition"
              >
                <LayoutDashboard size={15} className="text-blue-400" />
                <span>Backoffice</span>
              </Link>

              <Link
                href="/order"
                onClick={() => toggleLoginModal(false)}
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-2.5 rounded-xl text-xs font-bold text-zinc-200 transition"
              >
                <Monitor size={15} className="text-emerald-400" />
                <span>POS Screen</span>
              </Link>

              <Link
                href="/start"
                onClick={() => toggleLoginModal(false)}
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-2.5 rounded-xl text-xs font-bold text-zinc-200 transition"
              >
                <UtensilsCrossed size={15} className="text-amber-400" />
                <span>Module Hub</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
