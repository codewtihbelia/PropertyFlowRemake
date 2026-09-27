import React, { useState } from "react";

interface CodedOnboarding1PhoneProps {
  onNext?: () => void;
  onSkip?: () => void;
}

/**
 * CodedOnboarding1Phone
 * 100% vector-coded component matching the exact Onboarding 1 design:
 * - Pure CSS/SVG vector illustration (zero cropped bitmaps)
 * - Central blue dollar medallion with luminous halo
 * - Left/Right dashed connection arcs with node beads
 * - Left roommate avatar with facial features
 * - Right roommate avatar with blue cowl
 * - Pair of gold dollar coin transaction indicators
 * - Accurate typography, 3-dot pagination, and royal blue 'Next' CTA
 */
export const CodedOnboarding1Phone: React.FC<CodedOnboarding1PhoneProps> = ({
  onNext,
  onSkip,
}) => {
  const [slideIndex, setSlideIndex] = useState<number>(0);

  const slides = [
    {
      id: 0,
      title: "Split expenses the\nsmart way.",
      desc: "No more confusion or awkward reminders. Manage group bills, track spending, and settle up—fairly and stress-free.",
    },
    {
      id: 1,
      title: "Money made simple\nfor roommates",
      desc: "Whether it's rent, groceries, or weekend plans, keep everyone on the same page. Add, split, and settle with just a tap.",
    },
    {
      id: 2,
      title: "Split expenses the\nsmart way.",
      desc: "No more confusion or awkward reminders. Manage group bills, track spending, and settle up—fairly and stress-free.",
    },
  ];

  const current = slides[slideIndex];

  const handleNextClick = () => {
    if (slideIndex < slides.length - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      setSlideIndex(0);
      onNext?.();
    }
  };

  return (
    <div className="relative mx-auto w-[310px] sm:w-[325px] h-[650px] bg-slate-900 rounded-[44px] p-3 shadow-2xl ring-1 ring-slate-800/80">
      {/* Phone Outer Bezel Reflection */}
      <div className="w-full h-full bg-white rounded-[36px] overflow-hidden flex flex-col justify-between p-5 pt-3 relative shadow-inner select-none">
        
        {/* Top Phone Status & Speaker Bar */}
        <div className="flex items-center justify-between w-full pt-1 pb-2">
          {/* Subtle Time */}
          <span className="text-[11px] font-bold text-slate-800 ml-2">9:41</span>
          
          {/* Dynamic Notch */}
          <div className="w-20 h-3.5 bg-slate-900 rounded-full mx-auto" />

          {/* Skip Button */}
          <button
            onClick={() => {
              setSlideIndex(0);
              onSkip?.();
            }}
            className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-semibold text-xs transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Center Illustration Area */}
        <div className="flex-1 flex flex-col items-center justify-center my-auto">
          {slideIndex === 0 && (
            /* Coded Vector Graphic: Onboarding 1 */
            <div className="relative w-[280px] h-[210px] flex items-center justify-center">
              
              {/* Curved Connection Arcs (Vector SVG) */}
              <svg
                viewBox="0 0 280 210"
                className="absolute inset-0 w-full h-full pointer-events-none z-0"
              >
                {/* Left Arc: Curves from Left Avatar (x:55, y:80) to Center Circle (x:115, y:95) */}
                <path
                  d="M 56 82 C 78 52, 106 62, 120 86"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2.2"
                  strokeDasharray="4.5 4"
                  strokeLinecap="round"
                />
                {/* Left Node Bead */}
                <circle cx="84" cy="62" r="3.2" fill="#0284C7" />

                {/* Right Arc: Curves from Center Circle (x:165, y:95) to Right Avatar (x:224, y:82) */}
                <path
                  d="M 160 86 C 174 62, 202 52, 224 82"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2.2"
                  strokeDasharray="4.5 4"
                  strokeLinecap="round"
                />
                {/* Right Node Bead */}
                <circle cx="196" cy="62" r="3.2" fill="#0284C7" />
              </svg>

              {/* 1. Center Glowing Dollar Medallion */}
              <div className="relative z-10 w-24 h-24 rounded-full bg-white p-1 flex items-center justify-center shadow-[0_12px_28px_rgba(37,99,235,0.38)] ring-4 ring-blue-50">
                <div className="w-[84px] h-[84px] rounded-full bg-blue-600 flex items-center justify-center shadow-inner">
                  <span className="text-white font-extrabold text-4xl leading-none select-none tracking-tight">
                    $
                  </span>
                </div>
              </div>

              {/* 2. Left Roommate Avatar Badge */}
              <div className="absolute left-2 top-[46px] z-10 w-14 h-14 rounded-full bg-blue-50 border-2 border-blue-200 flex flex-col items-center justify-end overflow-hidden shadow-sm">
                {/* Character Head */}
                <div className="w-5 h-5 rounded-full bg-amber-400 flex flex-col items-center justify-center -mb-0.5 z-20">
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-0.5 h-0.5 rounded-full bg-slate-900" />
                    <div className="w-0.5 h-0.5 rounded-full bg-slate-900" />
                  </div>
                  <div className="w-1.5 h-0.5 bg-slate-900 rounded-full mt-0.5" />
                </div>
                {/* Character Shoulders */}
                <div className="w-8 h-3.5 rounded-t-xl bg-blue-400" />
              </div>

              {/* 3. Right Roommate Avatar Badge */}
              <div className="absolute right-2 top-[46px] z-10 w-14 h-14 rounded-full bg-blue-50 border-2 border-blue-200 flex flex-col items-center justify-end overflow-hidden shadow-sm">
                {/* Character Head with Sky-Blue Cowl */}
                <div className="w-6 h-6 rounded-full bg-blue-400 flex items-center justify-center -mb-0.5 z-20">
                  <div className="w-4 h-4 rounded-full bg-amber-400 flex flex-col items-center justify-center">
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <div className="w-0.5 h-0.5 rounded-full bg-slate-900" />
                      <div className="w-0.5 h-0.5 rounded-full bg-slate-900" />
                    </div>
                    <div className="w-1.5 h-0.5 bg-slate-900 rounded-full mt-0.5" />
                  </div>
                </div>
                {/* Character Shoulders */}
                <div className="w-8 h-3.5 rounded-t-xl bg-blue-400" />
              </div>

              {/* 4. Left Gold Indicator: Dash + Coin */}
              <div className="absolute left-4 bottom-5 flex items-center gap-1.5">
                <div className="w-2.5 h-0.5 rounded-full bg-amber-500" />
                <div className="w-5 h-5 rounded-full bg-amber-400 text-amber-900 font-black text-[10px] flex items-center justify-center shadow-xs">
                  $
                </div>
              </div>

              {/* 5. Right Gold Indicator: Coin + Dash */}
              <div className="absolute right-4 bottom-5 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-amber-400 text-amber-900 font-black text-[10px] flex items-center justify-center shadow-xs">
                  $
                </div>
                <div className="w-2.5 h-0.5 rounded-full bg-amber-500" />
              </div>

            </div>
          )}

          {slideIndex === 1 && (
            /* Coded Vector Graphic: Onboarding 2 */
            <div className="relative w-[280px] h-[210px] flex items-center justify-center">
              {/* Orbit Circle */}
              <div className="absolute w-44 h-44 rounded-full border-2 border-dashed border-blue-200" />
              
              {/* Center House Card */}
              <div className="w-28 h-28 rounded-2xl bg-blue-50/80 border border-blue-200 flex flex-col items-center justify-center p-2 shadow-md z-10">
                <svg className="w-8 h-8 text-blue-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  <div className="w-3.5 h-3.5 rounded-full bg-sky-400 flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  <div className="w-3.5 h-3.5 rounded-full bg-indigo-400 flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Orbit Badges */}
              <div className="absolute top-4 left-8 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
                ₱
              </div>
              <div className="absolute top-4 right-8 w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="absolute right-3 top-20 w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="absolute bottom-4 right-8 w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="absolute bottom-4 left-8 w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          )}

          {slideIndex === 2 && (
            /* Coded Vector Graphic: Onboarding 3 */
            <div className="relative w-[280px] h-[210px] flex items-center justify-center">
              {/* Orbit Circle */}
              <div className="absolute w-44 h-44 rounded-full border-2 border-dashed border-sky-300" />
              
              {/* Center Dollar Medallion */}
              <div className="w-24 h-24 rounded-full bg-white p-1 flex items-center justify-center shadow-xl ring-4 ring-blue-50 z-10">
                <div className="w-[84px] h-[84px] rounded-full bg-blue-600 flex items-center justify-center shadow-inner text-white font-extrabold text-4xl">
                  ₱
                </div>
              </div>

              {/* Left Avatar */}
              <div className="absolute left-3 top-16 w-10 h-10 rounded-full bg-blue-100 border border-sky-400 flex items-center justify-center text-blue-600 shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>

              {/* Right Avatar */}
              <div className="absolute right-3 top-16 w-10 h-10 rounded-full bg-rose-100 border border-rose-400 flex items-center justify-center text-rose-600 shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          )}

          {/* Typography Content */}
          <div className="text-center mt-6 px-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight whitespace-pre-line">
              {current.title}
            </h3>
            <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed mt-2.5 max-w-[260px] mx-auto">
              {current.desc}
            </p>
          </div>
        </div>

        {/* Bottom Section: Dots, CTA Button, Home Indicator */}
        <div className="w-full space-y-4 pt-2">
          {/* Pagination Indicators */}
          <div className="flex items-center justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIndex(i)}
                className={`transition-all ${
                  slideIndex === i
                    ? "w-6 h-1.5 rounded-full bg-slate-900"
                    : "w-1.5 h-1.5 rounded-full bg-slate-200 hover:bg-slate-300"
                }`}
              />
            ))}
          </div>

          {/* CTA Next Button */}
          <button
            onClick={handleNextClick}
            className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-[0_6px_20px_rgba(37,99,235,0.32)] transition-all flex items-center justify-center"
          >
            {slideIndex === slides.length - 1 ? "Get Started" : "Next"}
          </button>
        </div>

      </div>
    </div>
  );
};
