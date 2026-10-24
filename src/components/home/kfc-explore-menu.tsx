"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicMenu } from "@/lib/queries/menu";

function getImageForCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("chicken") || lower.includes("broast")) return "/images/broast.jpg";
  if (lower.includes("sando") || lower.includes("burger")) return "/images/burger.jpg";
  if (lower.includes("wrap")) return "/images/wrap.jpg";
  if (lower.includes("side") || lower.includes("fries")) return "/images/fries.jpg";
  if (lower.includes("sauce") || lower.includes("dip")) return "/images/sauce.jpg";
  return "/images/hero-banner.jpg";
}

export function KfcExploreMenu({
  menu,
  selectedCategory,
  onSelectCategory,
}: {
  menu: PublicMenu;
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const scrollAmount = clientWidth * 0.75;
    scrollRef.current.scrollTo({
      left: direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section id="explore-menu" className="py-10 bg-[#0d0d10] border-y border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header (Matching KFC screenshot) */}
        <div className="flex items-end justify-between mb-8 pb-3 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                EXPLORE MENU
              </h2>
            </div>
            {/* Signature KFC Red underline bar */}
            <div className="w-16 h-1 bg-[#e30e1f] rounded-full mt-2" />
          </div>

          <a
            href="#menu-catalog"
            onClick={() => onSelectCategory("all")}
            className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-300 hover:text-[#e30e1f] transition flex items-center gap-1 group"
          >
            <span>VIEW ALL</span>
            <ChevronRight size={16} className="group-hover:translate-x-1 transition" />
          </a>
        </div>

        {/* Carousel Container */}
        <div className="relative group/carousel">
          {/* Scroll Left Button */}
          <button
            onClick={() => scroll("left")}
            className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-zinc-900/90 hover:bg-[#e30e1f] text-white border border-zinc-700 flex items-center justify-center shadow-xl transition active:scale-95"
            aria-label="Scroll categories left"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Categories Horizontal Scroll */}
          <div
            ref={scrollRef}
            className="flex items-center gap-6 sm:gap-8 overflow-x-auto scroll-smooth py-4 px-2 no-scrollbar"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* All Items first */}
            <button
              key="all"
              onClick={() => {
                onSelectCategory("all");
                const catalogEl = document.getElementById("menu-catalog");
                if (catalogEl) catalogEl.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex flex-col items-center flex-shrink-0 group focus:outline-none"
            >
              <div className="relative mb-3">
                <div
                  className={`w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-white border-2 transition-all duration-300 relative p-1 shadow-lg ${
                    selectedCategory === "all"
                      ? "border-[#e30e1f] ring-4 ring-red-600/30 scale-105"
                      : "border-zinc-700/80 group-hover:border-[#e30e1f] group-hover:scale-105"
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden relative bg-white flex items-center justify-center">
                    <img
                      src="/images/hero-banner.jpg"
                      alt="All Items"
                      className="w-full h-full object-cover object-center group-hover:scale-110 transition duration-500"
                    />
                  </div>
                </div>
              </div>
              <div className={`h-0.5 rounded-full transition-all duration-300 mb-1.5 ${
                selectedCategory === "all" ? "w-8 bg-[#e30e1f]" : "w-0 group-hover:w-6 group-hover:bg-[#e30e1f]"
              }`} />
              <span className={`text-xs sm:text-sm font-bold text-center max-w-[120px] transition line-clamp-1 ${
                selectedCategory === "all" ? "text-[#e30e1f] font-black" : "text-zinc-300 group-hover:text-white"
              }`}>
                All Items
              </span>
            </button>

            {menu.categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const image = getImageForCategory(cat.name);
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    onSelectCategory(cat.id);
                    const catalogEl = document.getElementById("menu-catalog");
                    if (catalogEl) {
                      catalogEl.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className="flex flex-col items-center flex-shrink-0 group focus:outline-none"
                >
                  {/* Circular Item Container */}
                  <div className="relative mb-3">
                    <div
                      className={`w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-white border-2 transition-all duration-300 relative p-1 shadow-lg ${
                        isActive
                          ? "border-[#e30e1f] ring-4 ring-red-600/30 scale-105"
                          : "border-zinc-700/80 group-hover:border-[#e30e1f] group-hover:scale-105"
                      }`}
                    >
                      <div className="w-full h-full rounded-full overflow-hidden relative bg-white flex items-center justify-center">
                        <img
                          src={image}
                          alt={cat.name}
                          className="w-full h-full object-cover object-center group-hover:scale-110 transition duration-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Red category line under circle */}
                  <div
                    className={`h-0.5 rounded-full transition-all duration-300 mb-1.5 ${
                      isActive ? "w-8 bg-[#e30e1f]" : "w-0 group-hover:w-6 group-hover:bg-[#e30e1f]"
                    }`}
                  />

                  {/* Category Name Label */}
                  <span
                    className={`text-xs sm:text-sm font-bold text-center max-w-[120px] transition line-clamp-1 ${
                      isActive ? "text-[#e30e1f] font-black" : "text-zinc-300 group-hover:text-white"
                    }`}
                  >
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => scroll("right")}
            className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-zinc-900/90 hover:bg-[#e30e1f] text-white border border-zinc-700 flex items-center justify-center shadow-xl transition active:scale-95"
            aria-label="Scroll categories right"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
