"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, Plus, Sparkles, Star, Flame } from "lucide-react";
import { useCustomerBucket } from "@/lib/stores/bucket";
import { formatPKR } from "@/lib/domain/money";

export type DealItem = {
  id: string;
  name: string;
  nameUr?: string | null;
  description: string;
  price: number;
  image: string;
  badge?: string;
  isSpicy?: boolean;
  category: string;
};

export const FEATURED_DEALS: DealItem[] = [
  {
    id: "deal-zinger",
    name: "Zinger Burger",
    nameUr: "زنگر برگر",
    description: "The legendary crispy crunchy chicken breast fillet topped with spicy mayo and fresh crisp lettuce inside a sesame seed bun.",
    price: 52000,
    image: "/images/burger.jpg",
    badge: "BEST SELLER",
    isSpicy: true,
    category: "sando",
  },
  {
    id: "deal-broast",
    name: "Chicken Injected Broast",
    nameUr: "چکن انجیکٹڈ بروسٹ",
    description: "Golden fried juicy broast chicken infused with proprietary spicy marinade for peak crunch and succulent flavor in every bite.",
    price: 65000,
    image: "/images/broast.jpg",
    badge: "POPULAR",
    isSpicy: true,
    category: "chicken",
  },
  {
    id: "deal-double-zinger",
    name: "Double Zinger Burger",
    nameUr: "ڈبل زنگر برگر",
    description: "Two layers of thick crispy zinger fillets with melted cheddar cheese slice, fresh crunchy greens and signature garlic mayonnaise.",
    price: 78000,
    image: "/images/burger.jpg",
    badge: "TOP DEAL",
    isSpicy: true,
    category: "sando",
  },
  {
    id: "deal-wrap",
    name: "Zinger Wrap",
    nameUr: "زنگر ریپ",
    description: "Tender crispy zinger chicken strips folded in a grilled soft tortilla wrap with shredded lettuce, diced tomato and creamy dip.",
    price: 48000,
    image: "/images/wrap.jpg",
    badge: "VALUE PACK",
    isSpicy: true,
    category: "wraps",
  },
  {
    id: "deal-smash",
    name: "Beef Smash Burger",
    nameUr: "بیف سمیش برگر",
    description: "Hand-smashed 100% prime beef patty with crispy seared edges, caramelized onions, melted American cheese and house secret sauce.",
    price: 62000,
    image: "/images/burger.jpg",
    badge: "CHEF'S PICK",
    category: "sando",
  },
  {
    id: "deal-fries",
    name: "Beef Smash Fries",
    nameUr: "بیف سمیش فرائز",
    description: "Crispy golden potato fries smothered in seasoned minced beef, warm melted cheese sauce and sliced zesty jalapeños.",
    price: 42000,
    image: "/images/fries.jpg",
    badge: "MUST TRY",
    category: "sides",
  },
];

export function KfcTopDeals() {
  const { openItemModal, addItem } = useCustomerBucket();
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section id="best-sellers" className="py-12 bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="flex items-end justify-between mb-8 pb-3 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <Flame size={24} className="text-[#e30e1f]" />
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                BEST SELLERS
              </h2>
            </div>
            <div className="w-16 h-1 bg-[#e30e1f] rounded-full mt-2" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-zinc-400">
            Most Ordered Right Now
          </span>
        </div>

        {/* Deals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURED_DEALS.map((deal) => {
            const isFav = !!favorites[deal.id];
            return (
              <div
                key={deal.id}
                onClick={() => openItemModal(deal)}
                className="group relative flex flex-col justify-between bg-[#141418] border border-zinc-800/90 hover:border-zinc-700 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-red-950/20 hover:-translate-y-1 cursor-pointer"
              >
                {/* Top Badge & Favorite Button */}
                <div className="relative w-full h-56 sm:h-64 bg-zinc-950 overflow-hidden">
                  <img
                    src={deal.image}
                    alt={deal.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Subtle gradient vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141418] via-transparent to-black/30" />

                  {/* Badge */}
                  {deal.badge && (
                    <span className="absolute top-4 left-4 bg-[#e30e1f] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-lg tracking-wider">
                      {deal.badge}
                    </span>
                  )}

                  {/* Favorite Heart Button */}
                  <button
                    onClick={(e) => toggleFav(deal.id, e)}
                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md flex items-center justify-center transition border border-zinc-700/60 active:scale-90"
                    aria-label="Add to favorites"
                  >
                    <Heart
                      size={18}
                      className={isFav ? "fill-[#e30e1f] text-[#e30e1f]" : "text-zinc-300"}
                    />
                  </button>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-black text-white group-hover:text-[#e30e1f] transition">
                        {deal.name}
                      </h3>
                      {deal.isSpicy && (
                        <span className="text-xs bg-red-950/70 text-red-400 border border-red-900/50 px-2 py-0.5 rounded-md font-bold shrink-0">
                          Spicy 🌶️
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-xs sm:text-sm text-zinc-400 line-clamp-2 leading-relaxed">
                      {deal.description}
                    </p>
                  </div>

                  {/* Bottom Row: Price & + Add to Bucket */}
                  <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-zinc-500">
                        Price
                      </span>
                      <span className="text-xl font-black text-white">
                        {formatPKR(deal.price)}
                      </span>
                    </div>

                    {/* Red KFC Add to Bucket button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openItemModal(deal);
                      }}
                      className="bg-[#e30e1f] hover:bg-red-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-full shadow-lg shadow-red-600/30 transition flex items-center gap-1.5"
                    >
                      <Plus size={16} />
                      <span>Add To Bucket</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
