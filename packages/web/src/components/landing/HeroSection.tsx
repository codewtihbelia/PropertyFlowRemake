import React, { useState, useEffect } from "react";
import {
  Download,
  Smartphone,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  QrCode,
  Droplets,
  Receipt,
  Wallet,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

interface HeroSectionProps {
  onOpenDownloadModal: () => void;
  onScrollToShowcase: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenDownloadModal,
  onScrollToShowcase,
}) => {
  const { isDark } = useTheme();
  const [heroTheme, setHeroTheme] = useState<"dark" | "light">(() =>
    isDark ? "dark" : "light",
  );

  // Sync hero mockup when user flips light/dark page theme
  useEffect(() => {
    setHeroTheme((prev) => {
      const next = isDark ? "dark" : "light";
      return prev === next ? prev : next;
    });
  }, [isDark]);

  const heroImage =
    heroTheme === "dark"
      ? "/assets/HomeScreenDark.png"
      : "/assets/HomeScreenLight.png";

  return (
    <section
      id="overview"
      className="relative pt-28 pb-20 sm:pt-32 md:pt-36 md:pb-28 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
    >
      {/* Background Subtle Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/10 dark:bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Value Proposition & Copy */}
          <div className="lg:col-span-7 text-left space-y-6">
            {/* Top Unboxed Tagline */}
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span className="text-slate-500 dark:text-slate-400 font-normal">
                Open Source on GitHub
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.12]">
              Sharing a home without <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
                money stress.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 font-normal leading-relaxed max-w-2xl">
              Splitzy makes sharing a home and splitting expenses easier. From
              rent and water bills to electricity sub-meter readings and shared
              groceries, it keeps track of everything and makes sure everyone
              pays their fair share down to the last centavo.
            </p>

            {/* Key Value Proof List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Only pay for the water you actually used</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Every centavo counts</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Pay the way you prefer</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>More than just roommates</span>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-3">
              <button
                onClick={onOpenDownloadModal}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Android APK</span>
              </button>

              <button
                onClick={onScrollToShowcase}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Guides & Showcase ↓</span>
              </button>
            </div>

            {/* Trust Markers */}
            <div className="flex items-center gap-4 pt-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>VirusTotal Verified APK</span>
              </div>
              <span aria-hidden="true">·</span>
              <span>Android 8.0+</span>
              <span aria-hidden="true">·</span>
              <span>100% Free & Open Source</span>
            </div>
          </div>

          {/* Right Column: Hero Smartphone Preview */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative">
              {/* Theme Mini Toggle above Phone */}
              <div className="flex items-center justify-between gap-3 mb-3 px-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Screen Preview
                </span>
                <button
                  onClick={() =>
                    setHeroTheme(heroTheme === "dark" ? "light" : "dark")
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {heroTheme === "dark" ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-blue-500" />
                    </>
                  )}
                </button>
              </div>

              {/* Smartphone Chassis Frame */}
              <div className="relative w-[280px] sm:w-[310px] h-[580px] sm:h-[640px] bg-slate-950 rounded-[44px] p-2.5 shadow-2xl shadow-blue-900/30 border-[3.5px] border-slate-800 ring-1 ring-white/10">
                {/* Screen Viewport */}
                <div className="relative w-full h-full rounded-[36px] overflow-hidden bg-black flex flex-col">
                  {/* Dynamic Island Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-slate-900 ring-1 ring-slate-800" />
                  </div>

                  {/* Screenshot Image */}
                  <img
                    key={heroTheme}
                    src={heroImage}
                    alt="Splitzy Mobile Home Screen"
                    className="w-full h-full object-cover object-top animate-in fade-in duration-300"
                    loading="eager"
                  />

                  {/* Gloss Effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />

                  {/* Home Bar */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/40 rounded-full z-20 pointer-events-none" />
                </div>
              </div>

              {/* Floating Quick Feature Badge */}
              <div
                onClick={onOpenDownloadModal}
                className="absolute -bottom-4 -left-6 sm:-left-10 p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl flex items-center gap-3 cursor-pointer hover:scale-105 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Scan to Install
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Direct phone camera QR
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
