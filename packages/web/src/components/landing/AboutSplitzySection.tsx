import React from "react";
import {
  HeartHandshake,
  ShieldCheck,
  Scale,
  Sparkles,
  Users2,
  Lock,
  Code2,
  ExternalLink,
} from "lucide-react";

interface AboutSplitzySectionProps {
  onOpenDownloadModal?: () => void;
}

export const AboutSplitzySection: React.FC<AboutSplitzySectionProps> = ({
  onOpenDownloadModal,
}) => {
  return (
    <section
      id="about"
      className="py-20 md:py-28 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Our Story & Mission</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            We Built Splitzy Because <br />
            <span className="text-blue-600 dark:text-blue-400">Money Shouldn't Ruin Friendships.</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
            Living with roommates should be an empowering chapter of life. We designed Splitzy to replace awkward money conversations with mathematical certainty and trust.
          </p>
        </div>

        {/* Narrative Split: The Backstory & The Philosophy */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center mb-16">
          <div className="lg:col-span-6 space-y-5 text-slate-700 dark:text-slate-300 text-base leading-relaxed">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              Born in Shared Boarding Houses
            </h3>
            <p>
              Splitzy began in student dorms and shared apartments across Cebu and Manila. Every end-of-month was the same: the host stood in the hallway with a paper receipt, someone was away visiting family and complained about paying the water bill, and someone else forgot about the Wi-Fi.
            </p>
            <p>
              Standard expense tracking apps were built for corporate travel or vacation bar tabs. None of them handled Philippine co-living realities: <strong>daily water utility attendance</strong>, <strong>electric sub-meter readings</strong>, <strong>GCash QR transfers</strong>, or <strong>fair centavo allocation</strong>.
            </p>
            <p>
              We built Splitzy to give households a transparent, humanized system that treats everyone fairly. When everyone can see the math, the receipts, and the attendance log, there are zero doubts and zero arguments.
            </p>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Centavo Integrity
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                When dividing ₱800 across 3 payors, we don't round randomly. We distribute ₱266.67, ₱266.67, and ₱266.66 so the ledger matches the bill to the centavo.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Users2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Radical Transparency
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Every member has equal access to the active billing breakdown, uploaded receipts, attendance logs, and verified proof-of-payment records.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                100% Privacy & Zero Ads
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Splitzy has no advertising trackers and will never sell household financial data. Your shared living expenses belong strictly to your home.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Code2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Open & Community-Driven
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Published directly on GitHub so developers and residents can audit the cryptographic math, contribute enhancements, and inspect release builds.
              </p>
            </div>
          </div>
        </div>

        {/* Quantified Impact Numbers Banner */}
        <div className="p-8 sm:p-10 rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-500/20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-blue-500/50">
            <div className="space-y-1 sm:px-4">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight">
                ₱14.8M+
              </div>
              <p className="text-xs sm:text-sm text-blue-100">
                Shared household dues reconciled fairly
              </p>
            </div>
            <div className="space-y-1 pt-6 sm:pt-0 sm:px-4">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight">
                4,200+
              </div>
              <p className="text-xs sm:text-sm text-blue-100">
                Co-living households & dorm rooms connected
              </p>
            </div>
            <div className="space-y-1 pt-6 sm:pt-0 sm:px-4">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight">
                99.8%
              </div>
              <p className="text-xs sm:text-sm text-blue-100">
                On-time settlement rate without reminders
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
