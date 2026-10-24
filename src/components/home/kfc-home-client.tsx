"use client";

import { useState } from "react";
import { KfcNavbar } from "./kfc-navbar";
import { KfcHeroSlider } from "./kfc-hero-slider";
import { KfcExploreMenu } from "./kfc-explore-menu";
import { KfcTopDeals } from "./kfc-top-deals";
import { KfcMenuCatalog } from "./kfc-menu-catalog";
import { KfcItemModal } from "./kfc-item-modal";
import { KfcBucketDrawer } from "./kfc-bucket-drawer";
import { KfcCheckoutModal } from "./kfc-checkout-modal";
import { KfcFooter } from "./kfc-footer";
import type { PublicMenu } from "@/lib/queries/menu";

export function KfcHomeClient({ menu }: { menu: PublicMenu }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-[#e30e1f] selection:text-white">
      {/* KFC Header Navbar */}
      <KfcNavbar />

      {/* Main Content */}
      <main className="flex-1">
        {/* Cinematic Hero Promotional Slider */}
        <KfcHeroSlider />

        {/* Explore Menu Circular Carousel — real DB categories */}
        <KfcExploreMenu
          menu={menu}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Best Sellers & Top Deals Cards */}
        <KfcTopDeals />

        {/* Complete Menu Catalog with Sticky Category Tabs & Real-Time Search */}
        <KfcMenuCatalog
          menu={menu}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </main>

      {/* KFC Footer */}
      <KfcFooter />

      {/* Interactive Drawers & Modals */}
      <KfcItemModal />
      <KfcBucketDrawer />
      <KfcCheckoutModal />
    </div>
  );
}
