"use client";

import Link from "next/link";
import { Monitor, UtensilsCrossed, Phone, Mail, MapPin } from "lucide-react";

export function KfcFooter() {
  return (
    <footer className="bg-black text-white border-t border-zinc-800/80 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Top brand row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-12 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            {/* KFC 3 Red Stripes Emblem */}
            <div className="flex items-center gap-1">
              <span className="w-2 h-10 bg-[#e30e1f] rounded-sm transform -skew-x-6" />
              <span className="w-2 h-12 bg-white rounded-sm transform -skew-x-6" />
              <span className="w-2 h-10 bg-[#e30e1f] rounded-sm transform -skew-x-6" />
            </div>

            <div>
              <span className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none block">
                CRSP
              </span>
              <span className="text-[10px] font-bold tracking-widest text-[#e30e1f] uppercase">
                PEAK CRUNCH & JUICINESS IN EVERY BITE
              </span>
            </div>
          </div>

          {/* Contact Numbers */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-[#e30e1f]" />
              <span>Helpline: <strong className="text-white">111-277-777</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-[#e30e1f]" />
              <span>customercare@crsp.com.pk</span>
            </div>
          </div>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-b border-zinc-800">
          {/* Col 1: Information */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-4">
              Information
            </h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li><a href="#explore-menu" className="hover:text-white transition">About Us</a></li>
              <li><a href="#explore-menu" className="hover:text-white transition">Store Locator</a></li>
              <li><a href="#explore-menu" className="hover:text-white transition">Careers</a></li>
              <li><a href="#explore-menu" className="hover:text-white transition">Nutrition & Quality</a></li>
            </ul>
          </div>

          {/* Col 2: Food & Offers */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-4">
              Explore Food
            </h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li><a href="#best-sellers" className="hover:text-white transition">Best Sellers</a></li>
              <li><a href="#explore-menu" className="hover:text-white transition">Signature Boxes</a></li>
              <li><a href="#explore-menu" className="hover:text-white transition">Chicken Broast</a></li>
              <li><a href="#explore-menu" className="hover:text-white transition">Zinger Burgers</a></li>
              <li><a href="#explore-menu" className="hover:text-white transition">Loaded Fries</a></li>
            </ul>
          </div>

          {/* Col 3: Customer Care */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-4">
              Customer Care
            </h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li><a href="#explore-menu" className="hover:text-white transition">Track Order</a></li>
              <li><a href="#explore-menu" className="hover:text-white transition">Delivery Guidelines</a></li>
              <li><a href="#explore-menu" className="hover:text-white transition">Terms & Conditions</a></li>
              <li><a href="#explore-menu" className="hover:text-white transition">Privacy Policy</a></li>
            </ul>
          </div>

          {/* Col 4: Staff & Apps */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-4">
              Restaurant System
            </h4>
            <ul className="space-y-2.5 text-xs text-zinc-400">
              <li>
                <Link href="/pin" className="hover:text-white flex items-center gap-1.5 transition">
                  <Monitor size={14} className="text-[#e30e1f]" />
                  <span>Cashier POS Login</span>
                </Link>
              </li>
              <li>
                <Link href="/kds" className="hover:text-white flex items-center gap-1.5 transition">
                  <UtensilsCrossed size={14} className="text-amber-500" />
                  <span>Kitchen Screen (KDS)</span>
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-white flex items-center gap-1.5 transition">
                  <span>Admin Backoffice</span>
                </Link>
              </li>
              <li>
                <Link href="/start" className="hover:text-white flex items-center gap-1.5 transition">
                  <span>Module Selector Hub</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© 2026 CRSP Pakistan. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-zinc-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-zinc-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-zinc-400 cursor-pointer">Security</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
