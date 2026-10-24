"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Search, Plus, Heart, Sparkles, X, Filter } from "lucide-react";
import { useCustomerBucket } from "@/lib/stores/bucket";
import { formatPKR } from "@/lib/domain/money";
import type { PublicMenu, PublicItem } from "@/lib/queries/menu";

// Default descriptions for items
const ITEM_DESCRIPTIONS: Record<string, string> = {
  "Chicken Injected Broast": "Golden crispy fried broast chicken marinated in signature herbs, pressure-fried for maximum crunch and juice.",
  "Chicken Strips": "100% tender chicken breast fillets hand-breaded and golden fried, crisp on the outside and tender inside.",
  "Chicken Popcorn": "Bite-sized seasoned chicken popcorn nuggets fried to a crunchy golden brown, packed with crunch.",
  "Fried Wings": "Crispy seasoned fried chicken wings tossed in fiery crackling coating.",
  "Grill Chicken Wrap": "Tender grilled marinated chicken slices wrapped in a soft tortilla with fresh crunchy lettuce and garlic sauce.",
  "Beef Wrap": "Savory minced beef with crisp shredded lettuce, diced onions, and signature dressing in a toasted wrap.",
  "Zinger Wrap": "Crispy golden zinger fillet sliced with crisp iceberg lettuce, diced tomatoes and creamy garlic mayo.",
  "Chicken Grill Burger": "Succulent flame-grilled chicken breast fillet topped with garden fresh lettuce and mild herb mayo.",
  "Zinger Burger": "Crispy battered juicy fillet layered with crunchy shredded lettuce and spicy garlic sauce in a toasted bun.",
  "Double Zinger Burger": "Double the crunch! Two whole crispy zinger fillets stacked high with cheese slice and spicy dressing.",
  "Beef Grill Burger": "Seasoned ground beef patty grilled juicy with pickles, melted cheese and secret burger relish.",
  "Beef Smash Burger": "Pure beef smash patty with crisp lacey edges, caramelized onions, melted cheddar cheese and house burger sauce.",
  "Fries": "Classic golden salted potato fries, crispy outside and fluffy inside.",
  "Crispy Fries": "Extra crunchy skin-on potato fries dusted with our special herb and spice salt.",
  "Curly Fries": "Spiral cut crispy potatoes with a zesty seasoning blend.",
  "Beef Smash Fries": "Loaded fries topped with savory minced beef, melted warm cheddar cheese sauce, and sliced jalapeños.",
  "Zinger Fries": "Hot fries topped with chopped spicy zinger chicken bits and drizzled with signature garlic sauce.",
  "Coleslaw": "Fresh finely shredded cabbage and carrots tossed in a rich, creamy homestyle dressing.",
  "Potato Wedges": "Thick-cut skin-on potato wedges seasoned with herbs and baked crisp.",
  "Honey Mustard Sauce": "Sweet clover honey blended with tangy Dijon mustard.",
  "Cheese Sauce": "Creamy, velvety melted cheddar cheese dipping sauce.",
  "Garlic Sauce": "Middle Eastern style rich and velvety garlic toum sauce.",
  "Spicy Garlic Sauce": "Our famous garlic sauce kicked up with fiery red chili flakes.",
  "Ranch Sauce": "Creamy buttermilk ranch with fresh dill and garden herbs.",
};

export function KfcMenuCatalog({
  menu,
  selectedCategory,
  onSelectCategory,
}: {
  menu: PublicMenu;
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}) {
  const { openItemModal } = useCustomerBucket();
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Map category ID to image fallback
  const getImageForCategory = (catName: string): string => {
    const lower = catName.toLowerCase();
    if (lower.includes("chicken")) return "/images/broast.jpg";
    if (lower.includes("sando") || lower.includes("burger")) return "/images/burger.jpg";
    if (lower.includes("wrap")) return "/images/wrap.jpg";
    if (lower.includes("side")) return "/images/fries.jpg";
    if (lower.includes("sauce")) return "/images/sauce.jpg";
    return "/images/burger.jpg";
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return menu.items.filter((item) => {
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesUr = item.nameUr?.toLowerCase().includes(q);
        if (!matchesName && !matchesUr) return false;
      }

      // Category filter — "all" shows everything; otherwise match by real DB category ID
      if (selectedCategory === "all") return true;
      return item.categoryId === selectedCategory;
    });
  }, [menu.items, search, selectedCategory]);

  return (
    <section id="menu-catalog" className="py-12 bg-[#0d0d10] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Sticky Filter Bar */}
        <div className="sticky top-20 z-30 bg-black/95 backdrop-blur-md py-4 border-b border-zinc-800 -mx-4 px-4 sm:-mx-6 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar pb-1 md:pb-0">
            <button
              onClick={() => onSelectCategory("all")}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition shrink-0 ${
                selectedCategory === "all"
                  ? "bg-[#e30e1f] text-white shadow-md shadow-red-600/30"
                  : "bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800"
              }`}
            >
              All Items ({menu.items.length})
            </button>
            {menu.categories.map((cat) => {
              const count = menu.items.filter((i) => i.categoryId === cat.id).length;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition shrink-0 ${
                    isActive
                      ? "bg-[#e30e1f] text-white shadow-md shadow-red-600/30"
                      : "bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search burgers, broast, wraps..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e30e1f] transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Results Counter */}
        <div className="mb-6 flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
          <span>Showing {filteredItems.length} delicious items</span>
          {search && <span>Filtered by: &ldquo;{search}&rdquo;</span>}
        </div>

        {/* Grid of Product Cards */}
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center bg-zinc-950 rounded-3xl border border-zinc-800">
            <p className="text-lg font-bold text-zinc-400">No items match your search.</p>
            <button
              onClick={() => { setSearch(""); onSelectCategory("all"); }}
              className="mt-4 px-6 py-2.5 rounded-full bg-[#e30e1f] text-white text-xs font-black uppercase tracking-wider"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => {
              const cat = menu.categories.find((c) => c.id === item.categoryId);
              const catName = cat?.name ?? "Special";
              const imgSrc = getImageForCategory(catName);
              const desc = ITEM_DESCRIPTIONS[item.name] || `${item.name} prepared fresh with top quality ingredients and signature seasonings.`;
              const isFav = !!favorites[item.id];

              const modalItemData = {
                ...item,
                image: imgSrc,
                description: desc,
                categoryName: catName,
              };

              return (
                <div
                  key={item.id}
                  onClick={() => openItemModal(modalItemData)}
                  className="group relative flex flex-col justify-between bg-[#141418] border border-zinc-800/80 hover:border-zinc-700 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-red-950/20 hover:-translate-y-1 cursor-pointer"
                >
                  {/* Food Image */}
                  <div className="relative w-full h-48 sm:h-52 bg-zinc-950 overflow-hidden">
                    <img
                      src={imgSrc}
                      alt={item.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141418] via-transparent to-black/30" />

                    {/* Category Pill */}
                    <span className="absolute top-3.5 left-3.5 bg-black/70 backdrop-blur-md text-zinc-300 border border-zinc-700/60 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full">
                      {catName}
                    </span>

                    {/* Favorite Heart Button */}
                    <button
                      onClick={(e) => toggleFav(item.id, e)}
                      className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md flex items-center justify-center transition border border-zinc-700/60 active:scale-90"
                      aria-label="Add to favorites"
                    >
                      <Heart
                        size={15}
                        className={isFav ? "fill-[#e30e1f] text-[#e30e1f]" : "text-zinc-300"}
                      />
                    </button>
                  </div>

                  {/* Card Info */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base sm:text-lg font-black text-white group-hover:text-[#e30e1f] transition leading-snug">
                          {item.name}
                        </h3>
                      </div>
                      {item.nameUr && (
                        <span dir="rtl" className="block text-xs font-semibold text-zinc-400 mt-0.5">
                          {item.nameUr}
                        </span>
                      )}

                      <p className="mt-2 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {desc}
                      </p>
                    </div>

                    {/* Price & Add Button */}
                    <div className="mt-5 pt-3.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                      <div>
                        <span className="block text-[9px] font-bold uppercase text-zinc-500">
                          Price
                        </span>
                        <span className="text-lg font-black text-white">
                          {formatPKR(item.price)}
                        </span>
                      </div>

                      {/* KFC Add to Bucket button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openItemModal(modalItemData);
                        }}
                        className="bg-[#e30e1f] hover:bg-red-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider px-3.5 py-2 sm:px-4 sm:py-2 rounded-full shadow-lg shadow-red-600/30 transition flex items-center gap-1.5"
                      >
                        <Plus size={15} />
                        <span>Add To Bucket</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
