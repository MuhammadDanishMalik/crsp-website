"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Plus, Minus, Check, Flame, Sparkles } from "lucide-react";
import { useCustomerBucket, type BucketModifier } from "@/lib/stores/bucket";
import { formatPKR } from "@/lib/domain/money";

const EXTRA_SAUCES = [
  { id: "mod-garlic", name: "Garlic Toum Dip", priceDelta: 5000 },
  { id: "mod-spicy-garlic", name: "Spicy Garlic Sauce", priceDelta: 5000 },
  { id: "mod-cheese", name: "Warm Melted Cheese Dip", priceDelta: 5000 },
  { id: "mod-honey-mustard", name: "Honey Mustard Dip", priceDelta: 5000 },
  { id: "mod-ranch", name: "Buttermilk Ranch Dip", priceDelta: 5000 },
];

export function KfcItemModal() {
  const { activeItemModal, closeItemModal, addItem } = useCustomerBucket();

  const [quantity, setQuantity] = useState(1);
  const [spiceLevel, setSpiceLevel] = useState<"regular" | "spicy">("regular");
  const [selectedMods, setSelectedMods] = useState<BucketModifier[]>([]);
  const [note, setNote] = useState("");

  if (!activeItemModal) return null;

  const item = activeItemModal;
  const basePrice = item.price || item.basePrice || 50000;

  // Toggle extra dip
  const toggleMod = (mod: { id: string; name: string; priceDelta: number }) => {
    if (selectedMods.some((m) => m.id === mod.id)) {
      setSelectedMods(selectedMods.filter((m) => m.id !== mod.id));
    } else {
      setSelectedMods([...selectedMods, mod]);
    }
  };

  const modsTotal = selectedMods.reduce((sum, m) => sum + m.priceDelta, 0);
  const unitTotal = basePrice + modsTotal;
  const finalTotal = unitTotal * quantity;

  const handleAddToBucket = () => {
    const finalModifiers: BucketModifier[] = [
      {
        id: `spice-${spiceLevel}`,
        name: spiceLevel === "spicy" ? "Spicy 🌶️" : "Regular",
        priceDelta: 0,
      },
      ...selectedMods,
    ];

    addItem({
      itemId: item.id,
      name: item.name,
      nameUr: item.nameUr,
      basePrice,
      image: item.image,
      quantity,
      modifiers: finalModifiers,
      note: note.trim() || undefined,
    });

    closeItemModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={closeItemModal}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" 
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-[#141418] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh]">
        
        {/* Header / Hero Image */}
        <div className="relative w-full h-56 sm:h-64 bg-zinc-950 shrink-0">
          <img
            src={item.image || "/images/burger.jpg"}
            alt={item.name}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141418] via-transparent to-black/40" />

          {/* Close button */}
          <button
            onClick={closeItemModal}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-zinc-700/60 transition"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>

          {/* Base Price pill */}
          <div className="absolute bottom-4 left-6 bg-[#e30e1f] text-white px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
            {formatPKR(basePrice)}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-white no-scrollbar">
          {/* Title & Desc */}
          <div>
            <h2 className="text-2xl font-black text-white">{item.name}</h2>
            {item.nameUr && (
              <span dir="rtl" className="block text-sm font-semibold text-zinc-400 mt-0.5">
                {item.nameUr}
              </span>
            )}
            <p className="mt-2 text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Spice Level Selection */}
          <div className="pt-4 border-t border-zinc-800">
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-3">
              Select Spice Preference (Required)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSpiceLevel("regular")}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition text-left ${
                  spiceLevel === "regular"
                    ? "border-[#e30e1f] bg-red-950/20 text-white ring-1 ring-[#e30e1f]"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
                }`}
              >
                <div>
                  <span className="block text-sm font-bold">Regular</span>
                  <span className="text-[11px] text-zinc-400">Classic mild flavor</span>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  spiceLevel === "regular" ? "border-[#e30e1f] bg-[#e30e1f]" : "border-zinc-700"
                }`}>
                  {spiceLevel === "regular" && <Check size={12} className="text-white" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSpiceLevel("spicy")}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition text-left ${
                  spiceLevel === "spicy"
                    ? "border-[#e30e1f] bg-red-950/20 text-white ring-1 ring-[#e30e1f]"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
                }`}
              >
                <div>
                  <span className="block text-sm font-bold flex items-center gap-1">
                    <span>Spicy</span>
                    <Flame size={14} className="text-[#e30e1f]" />
                  </span>
                  <span className="text-[11px] text-zinc-400">Extra chili kick</span>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  spiceLevel === "spicy" ? "border-[#e30e1f] bg-[#e30e1f]" : "border-zinc-700"
                }`}>
                  {spiceLevel === "spicy" && <Check size={12} className="text-white" />}
                </div>
              </button>
            </div>
          </div>

          {/* Add-on Dips & Sauces */}
          <div className="pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-300">
                Add Extra Signature Dips (Optional)
              </label>
              <span className="text-[10px] font-bold text-zinc-400">+Rs 50 each</span>
            </div>

            <div className="space-y-2">
              {EXTRA_SAUCES.map((sauce) => {
                const isSelected = selectedMods.some((m) => m.id === sauce.id);
                return (
                  <button
                    key={sauce.id}
                    type="button"
                    onClick={() => toggleMod(sauce)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition ${
                      isSelected
                        ? "border-[#e30e1f] bg-red-950/20 text-white"
                        : "border-zinc-800/80 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    <span className="text-xs font-bold">{sauce.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">
                        +{formatPKR(sauce.priceDelta)}
                      </span>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected ? "border-[#e30e1f] bg-[#e30e1f]" : "border-zinc-700"
                      }`}>
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Special Instructions */}
          <div className="pt-4 border-t border-zinc-800">
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-2">
              Special Instructions
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Extra napkins, no pickles..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e30e1f]"
            />
          </div>
        </div>

        {/* Modal Footer with Quantity & Add to Bucket Button */}
        <div className="p-5 border-t border-zinc-800 bg-[#0d0d10] flex items-center justify-between gap-4">
          {/* Stepper */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-full p-1 shrink-0">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition disabled:opacity-40"
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus size={14} />
            </button>
            <span className="w-9 text-center font-black text-sm text-white">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition"
              aria-label="Increase quantity"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddToBucket}
            className="flex-1 bg-[#e30e1f] hover:bg-red-700 active:scale-95 text-white font-black text-xs sm:text-sm uppercase tracking-wider py-3.5 px-6 rounded-full shadow-xl shadow-red-600/30 transition flex items-center justify-between"
          >
            <span>Add to Bucket</span>
            <span>{formatPKR(finalTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
