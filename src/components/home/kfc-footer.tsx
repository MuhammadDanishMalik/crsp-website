"use client";

import Link from "next/link";
import { Monitor, LayoutDashboard, Phone, Mail } from "lucide-react";

export function KfcFooter() {
  return (
    <footer className="bg-black text-white border-t border-zinc-800/80 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Top brand row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-12 border-b border-zinc-800">
          {/* Real CRSP logo */}
          <img
            src="/brand/crsp-logo.png"
            alt="CRSP"
            className="h-12 w-auto object-contain select-none"
          />

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

          {/* Col 4: Staff Access */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-4">
              Staff Portals (2 Users)
            </h4>
            <ul className="space-y-3 text-xs text-zinc-400">
              <li>
                <a href="/api/launch?module=admin" className="hover:text-white flex items-center gap-2 transition group">
                  <span className="w-6 h-6 rounded-lg bg-zinc-800 group-hover:bg-blue-600 flex items-center justify-center transition">
                    <LayoutDashboard size={13} className="text-blue-400 group-hover:text-white" />
                  </span>
                  <span>1. Main Admin (Dishes &amp; Store)</span>
                </a>
              </li>
              <li>
                <a href="/api/launch?module=counter" className="hover:text-white flex items-center gap-2 transition group">
                  <span className="w-6 h-6 rounded-lg bg-zinc-800 group-hover:bg-[#e30e1f] flex items-center justify-center transition">
                    <Monitor size={13} className="text-[#e30e1f] group-hover:text-white" />
                  </span>
                  <span>2. Counter (Cashier POS)</span>
                </a>
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
