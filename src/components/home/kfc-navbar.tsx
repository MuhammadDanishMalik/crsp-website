"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Menu, X, MapPin, ShoppingBag, ChevronDown, 
  LogIn, User, Phone, Sparkles, UtensilsCrossed, 
  Monitor, LayoutDashboard
} from "lucide-react";
import { useCustomerBucket } from "@/lib/stores/bucket";
import { formatPKR } from "@/lib/domain/money";

export function KfcNavbar() {
  const { 
    items, orderType, setOrderType, selectedBranch, selectedCity,
    toggleCart, toggleLocationModal, toggleLoginModal 
  } = useCustomerBucket();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => {
    const modTotal = item.modifiers.reduce((mSum, m) => mSum + m.priceDelta, 0);
    return sum + (item.basePrice + modTotal) * item.quantity;
  }, 0);

  return (
    <>
      {/* Top micro banner */}
      <div className="bg-[#18181b] text-zinc-300 text-[11px] sm:text-xs py-1.5 px-4 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-white">ORDER ONLINE:</span>
            <span className="hidden sm:inline">Delivering hot & fresh in 30-40 mins | Open till 3:00 AM</span>
            <span className="sm:hidden">Delivering till 3:00 AM</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-zinc-400">Call Us: <strong className="text-white">111-277-777</strong></span>
            <Link 
              href="/start" 
              className="text-[#e30e1f] font-bold hover:underline flex items-center gap-1"
            >
              <Monitor size={12} />
              <span>Staff / POS Launch</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main sticky header */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-zinc-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
          
          {/* Left: Mobile hamburger + CRSP KFC-styled Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
              aria-label="Open menu"
            >
              <Menu size={26} />
            </button>

            <Link href="/" className="flex items-center gap-3 group">
              {/* KFC 3 red stripes emblem badge */}
              <div className="flex items-center gap-1 px-1 py-1">
                <span className="w-1.5 h-8 bg-[#e30e1f] rounded-sm transform -skew-x-6" />
                <span className="w-1.5 h-9 bg-white rounded-sm transform -skew-x-6" />
                <span className="w-1.5 h-8 bg-[#e30e1f] rounded-sm transform -skew-x-6" />
              </div>

              <div className="flex flex-col">
                <span className="text-3xl font-black tracking-tighter text-white uppercase italic leading-none group-hover:text-[#e30e1f] transition">
                  CRSP
                </span>
                <span className="text-[9px] font-bold tracking-widest text-[#e30e1f] uppercase -mt-0.5">
                  CRUNCH & ROAST
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Delivery / Pickup pills & Location Selector */}
          <div className="hidden md:flex items-center gap-4">
            {/* Delivery / Pickup switcher */}
            <div className="bg-zinc-900 p-1 rounded-full border border-zinc-800 flex items-center">
              <button
                onClick={() => setOrderType("delivery")}
                className={`px-4 py-1.5 rounded-full text-xs font-black transition uppercase tracking-wider ${
                  orderType === "delivery"
                    ? "bg-[#e30e1f] text-white shadow-md shadow-red-600/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Delivery
              </button>
              <button
                onClick={() => setOrderType("pickup")}
                className={`px-4 py-1.5 rounded-full text-xs font-black transition uppercase tracking-wider ${
                  orderType === "pickup"
                    ? "bg-[#e30e1f] text-white shadow-md shadow-red-600/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Pick Up
              </button>
            </div>

            {/* Location selector pill */}
            <button
              onClick={() => toggleLocationModal(true)}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-700/80 rounded-full px-4 py-2 text-xs text-zinc-200 transition group"
            >
              <MapPin size={15} className="text-[#e30e1f] group-hover:scale-110 transition" />
              <div className="text-left">
                <span className="block font-bold text-white leading-tight">
                  {selectedBranch}, {selectedCity}
                </span>
              </div>
              <ChevronDown size={14} className="text-zinc-400 ml-1" />
            </button>
          </div>

          {/* Right: Bucket Cart & Login button */}
          <div className="flex items-center gap-3">
            {/* Cart / Bucket button */}
            <button
              onClick={() => toggleCart(true)}
              className="relative flex items-center gap-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl transition group"
              aria-label="View bucket"
            >
              {/* KFC style bucket icon */}
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-[#e30e1f] flex items-center justify-center text-white shadow-md shadow-red-600/30 group-hover:scale-105 transition">
                  <ShoppingBag size={18} />
                </div>
                {totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-white text-[#e30e1f] font-black text-[11px] w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    {totalItems}
                  </span>
                )}
              </div>

              <div className="text-left hidden sm:block">
                <span className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                  Your Bucket
                </span>
                <span className="block text-sm font-black text-white">
                  {totalPrice > 0 ? formatPKR(totalPrice) : "0 Items"}
                </span>
              </div>
            </button>

            {/* Red KFC LOGIN Button */}
            <button
              onClick={() => toggleLoginModal(true)}
              className="bg-[#e30e1f] hover:bg-red-700 active:scale-95 text-white font-black text-xs sm:text-sm uppercase tracking-wider px-5 py-2.5 rounded-full shadow-lg shadow-red-600/30 transition flex items-center gap-1.5"
            >
              <User size={15} />
              <span>Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
          />

          {/* Side Drawer */}
          <div className="fixed inset-y-0 left-0 w-4/5 max-w-sm bg-[#121215] border-r border-zinc-800 p-6 flex flex-col justify-between z-10 shadow-2xl">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-6 bg-[#e30e1f] rounded-sm transform -skew-x-6" />
                    <span className="w-1.5 h-7 bg-white rounded-sm transform -skew-x-6" />
                    <span className="w-1.5 h-6 bg-[#e30e1f] rounded-sm transform -skew-x-6" />
                  </div>
                  <span className="text-2xl font-black text-white tracking-tighter">CRSP</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-900"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Delivery / Pickup in mobile drawer */}
              <div className="mt-6 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 flex items-center">
                <button
                  onClick={() => { setOrderType("delivery"); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition uppercase ${
                    orderType === "delivery" ? "bg-[#e30e1f] text-white" : "text-zinc-400"
                  }`}
                >
                  Delivery
                </button>
                <button
                  onClick={() => { setOrderType("pickup"); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition uppercase ${
                    orderType === "pickup" ? "bg-[#e30e1f] text-white" : "text-zinc-400"
                  }`}
                >
                  Pick Up
                </button>
              </div>

              {/* Location Selector */}
              <button
                onClick={() => { setMobileMenuOpen(false); toggleLocationModal(true); }}
                className="w-full mt-3 flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-2xl text-left"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin size={18} className="text-[#e30e1f]" />
                  <div>
                    <span className="block text-[11px] text-zinc-400">Selected Location</span>
                    <span className="text-xs font-bold text-white">{selectedBranch}, {selectedCity}</span>
                  </div>
                </div>
                <ChevronDown size={14} className="text-zinc-400" />
              </button>

              {/* Navigation Links */}
              <nav className="mt-6 flex flex-col gap-2">
                <a
                  href="#explore-menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-200 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
                >
                  <UtensilsCrossed size={18} className="text-[#e30e1f]" />
                  <span>Explore Menu</span>
                </a>
                <a
                  href="#best-sellers"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-200 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
                >
                  <Sparkles size={18} className="text-[#e30e1f]" />
                  <span>Best Sellers & Deals</span>
                </a>
                <button
                  onClick={() => { setMobileMenuOpen(false); toggleCart(true); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-zinc-200 hover:bg-zinc-900 hover:text-white font-bold text-sm transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingBag size={18} className="text-[#e30e1f]" />
                    <span>View Bucket</span>
                  </div>
                  {totalItems > 0 && (
                    <span className="bg-[#e30e1f] text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      {totalItems}
                    </span>
                  )}
                </button>
              </nav>

              {/* Staff Portal / Management Links */}
              <div className="mt-6 pt-6 border-t border-zinc-800/80">
                <span className="block text-[10px] font-black uppercase text-zinc-500 tracking-wider px-2 mb-2">
                  Staff & Restaurant System
                </span>
                <div className="flex flex-col gap-1.5">
                  <Link
                    href="/order"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white transition"
                  >
                    <Monitor size={15} className="text-[#e30e1f]" />
                    <span>POS Terminal Screen</span>
                  </Link>
                  <Link
                    href="/kds"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white transition"
                  >
                    <UtensilsCrossed size={15} className="text-amber-500" />
                    <span>Kitchen KDS Display</span>
                  </Link>
                  <Link
                    href="/admin"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white transition"
                  >
                    <LayoutDashboard size={15} className="text-blue-500" />
                    <span>Admin Backoffice</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Bottom Login Button */}
            <div className="pt-4 border-t border-zinc-800">
              <button
                onClick={() => { setMobileMenuOpen(false); toggleLoginModal(true); }}
                className="w-full bg-[#e30e1f] text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider shadow-lg shadow-red-600/30"
              >
                <LogIn size={16} />
                <span>Sign In / Register</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
