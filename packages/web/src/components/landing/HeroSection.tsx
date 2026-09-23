import React, { useState } from "react";
import {
  CheckCircle2,
  ArrowRight,
  Calculator,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Users,
  Receipt,
  Droplets,
  Zap,
  Eye,
} from "lucide-react";

interface HeroSectionProps {
  onOpenCalculator: () => void;
  onOpenMobileShowcase: () => void;
  onOpenApp: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenCalculator,
  onOpenMobileShowcase,
  onOpenApp,
}) => {
  const [activeScreenIndex, setActiveScreenIndex] = useState<number>(0);

  const screens = [
    {
      id: "screen1",
      title: "Home & Balance Hub",
      subtitle: "Instant summary of active cycle, balance & quick actions",
      image: "/mobile-screen-1.webp",
      tag: "Proposed Mobile UI",
    },
    {
      id: "screen2",
      title: "Member Breakdown & Dues",
      subtitle: "Transparent breakdown per roommate with payment status",
      image: "/mobile-screen-2.webp",
      tag: "Centavo Accurate",
    },
    {
      id: "screen3",
      title: "Full Mobile Design Suite",
      subtitle: "All 15+ mobile screens crafted for seamless iOS & Android",
      image: "/proposed-all-screens.webp",
      tag: "Complete Ecosystem",
    },
  ];

  return (
    <section
      id="hero"
      className="relative pt-8 pb-20 md:pt-14 md:pb-28 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50"
    >
      {/* Background Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f015_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f015_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Value Proposition & Copy */}
          <div className="lg:col-span-7 text-left space-y-6">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs sm:text-sm font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>Tailored for Co-living, Condos & Dormitories</span>
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-brand-500" />
              <span className="hidden sm:inline-block text-slate-500 font-normal">
                iOS • Android • Web
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
              Split Roommate Bills Fairly. <br />
              <span className="bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 bg-clip-text text-transparent">
                Down to the Exact Centavo.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-lg sm:text-xl text-slate-600 font-normal leading-relaxed max-w-2xl">
              Eliminate awkward group chats and messy spreadsheets. Track rent,
              electricity, water attendance, and household essentials in
              real-time with automatic absence redistribution and instant
              payment reconciliation.
            </p>

            {/* Key Value Bullets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2.5 text-slate-700 text-sm font-medium">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>Fair absence & vacation redistribution</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 text-sm font-medium">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>Zero rounding errors (Integer Centavo Math)</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 text-sm font-medium">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>1-Tap GCash, Maya & Bank proof upload</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 text-sm font-medium">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>Audit trail with receipt archives & PDF export</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
              <button
                id="hero-calc-cta"
                onClick={onOpenCalculator}
                className="w-full sm:w-auto px-5 sm:px-6 py-3.5 text-base font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Calculator className="w-5 h-5 text-brand-200" />
                <span>Try Live Split Calculator</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="hero-mobile-cta"
                onClick={onOpenMobileShowcase}
                className="w-full sm:w-auto px-4 sm:px-5 py-3.5 text-base font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-all hover:border-slate-400 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-5 h-5 text-slate-600" />
                <span>See Proposed Mobile App</span>
              </button>

              <button
                id="hero-portal-cta"
                onClick={onOpenApp}
                className="w-full sm:w-auto px-4 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 underline-offset-4 hover:underline cursor-pointer"
              >
                <span>Launch Web Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Micro Social Proof / Household Metrics */}
            <div className="pt-6 border-t border-slate-200/80 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-4 sm:gap-8">
              <div>
                <p className="text-2xl font-black text-slate-900">₱0.00</p>
                <p className="text-xs text-slate-500 font-medium">
                  Rounding Drift
                </p>
              </div>
              <div className="hidden sm:block h-8 w-px bg-slate-200" />
              <div>
                <p className="text-2xl font-black text-slate-900">100%</p>
                <p className="text-xs text-slate-500 font-medium">
                  Attendance Precision
                </p>
              </div>
              <div className="hidden sm:block h-8 w-px bg-slate-200" />
              <div>
                <p className="text-2xl font-black text-slate-900">1-Tap</p>
                <p className="text-xs text-slate-500 font-medium">
                  Payment Verification
                </p>
              </div>
              <div className="hidden sm:block h-8 w-px bg-slate-200" />
              <div>
                <p className="text-2xl font-black text-slate-900">Cloud</p>
                <p className="text-xs text-slate-500 font-medium">
                  Multi-Device Sync
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Proposed Mobile UI Showcase */}
          <div className="lg:col-span-5 relative flex flex-col items-center">
            {/* Screen Selector Tabs */}
            <div className="w-full max-w-sm mb-4 bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 shadow-inner">
              {screens.map((scr, idx) => (
                <button
                  key={scr.id}
                  onClick={() => setActiveScreenIndex(idx)}
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all ${
                    activeScreenIndex === idx
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {scr.title.split(" ")[0]}
                </button>
              ))}
            </div>

            {/* Smartphone Container Mockup */}
            <div className="relative w-full max-w-[320px] sm:max-w-[340px] bg-slate-900 rounded-[44px] p-3.5 shadow-2xl border-4 border-slate-800 ring-1 ring-white/20">
              {/* Phone Speaker & Dynamic Island Notch */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-950 rounded-full z-30 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-slate-900 mr-2" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
              </div>

              {/* Phone Screen Glass */}
              <div className="relative overflow-hidden rounded-[36px] bg-slate-100 aspect-[9/18.5] shadow-inner flex flex-col">
                {/* Proposed UI Image render */}
                <div className="relative w-full h-full bg-slate-50 flex items-center justify-center overflow-hidden">
                  <img
                    src={screens[activeScreenIndex].image}
                    alt={screens[activeScreenIndex].title}
                    className="w-full h-full object-cover object-top transition-all duration-300 hover:scale-105"
                  />

                  {/* Subtle Gradient Overlay at bottom for caption */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent p-4 text-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-500/80 backdrop-blur-xs">
                        {screens[activeScreenIndex].tag}
                      </span>
                      <span className="text-[10px] text-slate-300">
                        Proposed Mobile App
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white">
                      {screens[activeScreenIndex].title}
                    </p>
                    <p className="text-[10px] text-slate-300 line-clamp-1">
                      {screens[activeScreenIndex].subtitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating Highlight Card 1: Attendance Saver */}
              <div className="absolute -left-6 top-28 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-200/80 max-w-[190px] hidden sm:block animate-float">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Absence Engine
                    </p>
                    <p className="text-xs font-bold text-emerald-600">
                      -₱480.00 Credit
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Alex away for 12 days; utilities auto-redistributed.
                </p>
              </div>

              {/* Floating Highlight Card 2: Instant GCash Settle */}
              <div className="absolute -right-6 bottom-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-200/80 max-w-[180px] hidden sm:block animate-float-delay">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Payment
                    </p>
                    <p className="text-xs font-bold text-slate-900">
                      ₱4,250.00 Verified
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  GCash receipt auto-matched and receipt archived.
                </p>
              </div>
            </div>

            {/* Quick Caption under phone */}
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-brand-600" />
                <span>
                  Native React Native & Expo mobile client ready for deployment
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
