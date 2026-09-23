import React, { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Sparkles,
  Receipt,
  Users,
  Calendar,
} from "lucide-react";

interface OnboardingViewProps {
  onComplete: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  onComplete,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      badge: "Transparent Household Billing",
      badgeColor: "bg-blue-100 text-blue-800",
      title: "Split expenses the smart, drama-free way.",
      subtitle:
        "Easily track master rent, sub-metered electricity (₱16/kWh), fiber internet, and daily water attendance in one single synchronized hub.",
      icon: Users,
      iconBg: "bg-blue-50 text-blue-600 border-blue-200",
      highlights: [
        "Dedicated roles for Host, Payors, and Non-Payor dependents",
        "Configurable household rates and automated billing cycles",
        "Real-time Firestore sync & Firebase Storage receipt archiving",
      ],
    },
    {
      badge: "Zero Rounding Errors",
      badgeColor: "bg-emerald-100 text-emerald-800",
      title: "Exact centavo balance redistribution.",
      subtitle:
        "When a roommate pays partially or a bill changes, the remainder is redistributed down to the exact centavo across active payors with complete audit trails.",
      icon: Shield,
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
      highlights: [
        "Deterministic remainder algorithm (zero floating-point flaws)",
        "Full itemized payment receipts with GCash and bank tracking",
        "Instant host verification and clearance stamps",
      ],
    },
    {
      badge: "Daily Calendar Stay Tracking",
      badgeColor: "bg-purple-100 text-purple-800",
      title: "Pay only for the days you actually stayed.",
      subtitle:
        "Daily water attendance grid strictly maps to your actual billing cycle calendar dates (Aug 13 – Sep 12). Tap any date to toggle Present / Absent status.",
      icon: Calendar,
      iconBg: "bg-purple-50 text-purple-600 border-purple-200",
      highlights: [
        "Accurate ₱5.00/person/day dynamic water share computation",
        "Exportable monthly breakdown reports & audit history",
        "Available simultaneously across Web & Mobile apps",
      ],
    },
  ];

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col">
        {/* Top Header Bar */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/30">
              S
            </div>
            <div>
              <span className="font-extrabold text-xl text-slate-900 tracking-tight">
                Splitzy
              </span>
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                PropertyFlow
              </span>
            </div>
          </div>

          <button
            onClick={onComplete}
            className="text-xs font-bold text-slate-500 hover:text-slate-900 transition px-3 py-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            Skip to Login
          </button>
        </div>

        {/* Slide Content */}
        <div className="px-8 py-6 flex-1 flex flex-col items-center text-center">
          {/* Hero Icon */}
          <div
            className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 border shadow-xs ${slide.iconBg}`}
          >
            <Icon className="w-12 h-12 stroke-[1.75]" />
          </div>

          {/* Badge */}
          <span
            className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${slide.badgeColor}`}
          >
            {slide.badge}
          </span>

          {/* Title & Description */}
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mb-3">
            {slide.title}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mb-6">
            {slide.subtitle}
          </p>

          {/* Feature Highlights */}
          <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2.5 mb-6">
            {slide.highlights.map((h, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 text-xs text-slate-700 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{h}</span>
              </div>
            ))}
          </div>

          {/* Step Indicator Dots */}
          <div className="flex items-center justify-center gap-2 mb-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  currentSlide === idx
                    ? "w-8 bg-blue-600"
                    : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-8 pb-8 pt-4 bg-white border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition ${
              currentSlide === 0
                ? "opacity-40 cursor-not-allowed text-slate-400"
                : "hover:bg-slate-50 text-slate-700 cursor-pointer"
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 text-xs font-bold px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            {currentSlide === slides.length - 1 ? (
              <>
                Get Started <Sparkles className="w-4 h-4" />
              </>
            ) : (
              <>
                Next <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
