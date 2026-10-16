"use client";

import { useState } from "react";
import { X, MapPin, Check, ChevronRight } from "lucide-react";
import { useCustomerBucket } from "@/lib/stores/bucket";

const CITIES: Record<string, string[]> = {
  Lahore: ["DHA Phase 5", "Gulberg Main Blvd", "Johar Town", "Mall Road", "Bahria Town"],
  Islamabad: ["F-6 Super Market", "F-10 Markaz", "Blue Area", "I-8 Markaz", "G-11 Markaz"],
  Rawalpindi: ["Saddar", "Commercial Market", "Bahria Phase 7", "Peshawar Road"],
  Karachi: ["Clifton Block 4", "DHA Phase 6", "Gulshan-e-Iqbal", "SMCHS", "North Nazimabad"],
};

export function KfcLocationModal() {
  const {
    isLocationModalOpen,
    toggleLocationModal,
    selectedCity,
    selectedBranch,
    setLocation,
  } = useCustomerBucket();

  const [activeCity, setActiveCity] = useState(selectedCity);

  if (!isLocationModalOpen) return null;

  const branches = CITIES[activeCity] || CITIES["Lahore"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={() => toggleLocationModal(false)}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-[#141418] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl z-10 text-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-[#e30e1f]" />
            <h2 className="text-lg font-black uppercase tracking-tight text-white">
              Select Your Location
            </h2>
          </div>
          <button
            onClick={() => toggleLocationModal(false)}
            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 no-scrollbar">
          {/* City Selection */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2.5">
              Select City
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(CITIES).map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setActiveCity(city)}
                  className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition ${
                    activeCity === city
                      ? "bg-[#e30e1f] text-white shadow-md shadow-red-600/30"
                      : "bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-800"
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* Branch Selection */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2.5">
              Select Nearby Branch in {activeCity}
            </label>
            <div className="space-y-2">
              {branches.map((branch) => {
                const isSelected = selectedCity === activeCity && selectedBranch === branch;
                return (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => {
                      setLocation(activeCity, branch);
                      toggleLocationModal(false);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition text-left ${
                      isSelected
                        ? "border-[#e30e1f] bg-red-950/20 text-white ring-1 ring-[#e30e1f]"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                    }`}
                  >
                    <div>
                      <span className="block text-sm font-bold">{branch}</span>
                      <span className="text-[11px] text-zinc-400">
                        {activeCity} · Delivery & Pick Up Available
                      </span>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected ? "border-[#e30e1f] bg-[#e30e1f]" : "border-zinc-700"
                    }`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
