"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Sparkles, Award, ArrowRight } from "lucide-react";
import { useCustomerBucket } from "@/lib/stores/bucket";

const SLIDES = [
  {
    id: 1,
    badge: "MEGA FEAST COMBO",
    title: "Zingers, Strips N' Dips",
    description: "4 Crispy Zingers, 8 Tender Strips, 3 Signature Gourmet Dips and a chilled 1.5L drink combo meal.",
    price: 2490,
    cta: "ORDER NOW",
    image: "/images/hero-banner.jpg",
    accent: "from-red-900/40 to-black",
  },
  {
    id: 2,
    badge: "CHEF'S SIGNATURE",
    title: "Crispy Injected Broast",
    description: "Succulent fresh chicken marinated with 11 secret herbs and spices, pressure-fried for supreme crunch.",
    price: 1650,
    cta: "FEAST NOW",
    image: "/images/broast.jpg",
    accent: "from-amber-950/40 to-black",
  },
  {
    id: 3,
    badge: "HOT & SPICY",
    title: "Double Zinger Tower",
    description: "Two crunchy spicy fillets stacked with double cheddar cheese, jalapeños, and signature garlic relish.",
    price: 780,
    cta: "GRAB DEAL",
    image: "/images/burger.jpg",
    accent: "from-rose-950/40 to-black",
  },
];

export function KfcHeroSlider() {
  const [current, setCurrent] = useState(0);
  const { toggleCart, toggleLoginModal } = useCustomerBucket();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[current];

  return (
    <section className="relative overflow-hidden bg-black text-white">
      {/* Background glow effects */}
      <div className="absolute inset-0 bg-radial-gradient from-red-950/30 via-black to-black pointer-events-none" />
      
      {/* Main Banner Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-10 relative">
        <div className="relative w-full h-[360px] sm:h-[440px] md:h-[480px] lg:h-[520px] rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-950 group">
          
          {/* Background Hero Image */}
          <div className="absolute inset-0">
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover object-center filter brightness-[0.88] contrast-[1.05] transition-transform duration-1000 ease-out group-hover:scale-105"
            />
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/10 md:bg-gradient-to-r md:from-black/90 md:via-black/50 md:to-transparent" />
          </div>

          {/* Floating CRSP Rewards badge (matching screenshot) */}
          <div className="absolute top-6 left-6 z-20 hidden sm:flex items-center gap-3 bg-black/85 backdrop-blur-md border border-zinc-700/80 rounded-2xl p-3 shadow-xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black shadow-md shadow-amber-500/20">
              <Award size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-[#e30e1f] tracking-widest">
                  CRSP REWARDS
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <button 
                onClick={() => toggleLoginModal(true)}
                className="text-xs font-bold text-white hover:text-amber-400 flex items-center gap-1 transition"
              >
                <span>SIGN UP & EARN POINTS</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Banner Content (Headline, Description, CTA) */}
          <div className="absolute inset-0 z-10 flex flex-col justify-end md:justify-center p-6 sm:p-10 md:p-14 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e30e1f]/90 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest w-fit mb-3 shadow-lg shadow-red-600/30">
              <Sparkles size={13} />
              <span>{slide.badge}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-none drop-shadow-md">
              {slide.title}
            </h1>

            <p className="mt-3 text-sm sm:text-base text-zinc-300 font-medium max-w-lg leading-relaxed drop-shadow">
              {slide.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <a
                href="#menu-catalog"
                className="bg-[#e30e1f] hover:bg-red-700 active:scale-95 text-white font-black text-sm sm:text-base uppercase tracking-wider px-8 py-3.5 rounded-full shadow-xl shadow-red-600/40 transition flex items-center gap-2 group/btn"
              >
                <span>{slide.cta}</span>
                <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition" />
              </a>

              <a
                href="#explore-menu"
                className="bg-black/60 hover:bg-black/90 backdrop-blur-md border border-zinc-700 text-white font-bold text-sm uppercase tracking-wider px-6 py-3.5 rounded-full transition"
              >
                View Full Menu
              </a>
            </div>
          </div>

          {/* Arrow Controls */}
          <button
            onClick={() => setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white border border-zinc-700 backdrop-blur-md flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            aria-label="Previous slide"
          >
            <ChevronLeft size={24} />
          </button>

          <button
            onClick={() => setCurrent((prev) => (prev + 1) % SLIDES.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white border border-zinc-700 backdrop-blur-md flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            aria-label="Next slide"
          >
            <ChevronRight size={24} />
          </button>

          {/* Pagination Dots */}
          <div className="absolute bottom-5 right-6 z-20 flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current ? "w-8 bg-[#e30e1f]" : "w-2 bg-zinc-600 hover:bg-zinc-400"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
