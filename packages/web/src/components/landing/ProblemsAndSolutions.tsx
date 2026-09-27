import React from "react";
import { 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  Receipt, 
  Scale, 
  Users, 
  TrendingDown, 
  MessageSquareX, 
  ShieldAlert
} from "lucide-react";

export const ProblemsAndSolutions: React.FC = () => {
  const comparisons = [
    {
      problemIcon: Calendar,
      problemTitle: "Unfair Utility Bills When Away",
      problemDesc:
        "Roommates away on vacation, internship, or family visits still get billed for water and daily shared electricity they never consumed.",
      solutionIcon: CheckCircle2,
      solutionTitle: "Smart Absence Redistribution",
      solutionDesc:
        "Mark days away in the calendar. The math engine automatically discounts absent roommates and recalibrates remaining shares to the exact centavo.",
      badge: "Absence Engine",
    },
    {
      problemIcon: MessageSquareX,
      problemTitle: "Awkward End-of-Month Reminders",
      problemDesc:
        "The uncomfortable dynamic of one roommate playing debt collector, chasing down proof of payments, and sifting through deleted chat screenshots.",
      solutionIcon: CheckCircle2,
      solutionTitle: "One-Tap Settle & Auto-Verification",
      solutionDesc:
        "Roommates upload GCash, Maya, or bank receipts with reference codes. Hosts approve with one tap, and all parties receive live receipts.",
      badge: "Zero Friction",
    },
    {
      problemIcon: ShieldAlert,
      problemTitle: "Lost Receipts & Audit Disputes",
      problemDesc:
        "Paper receipts fade, water meter notes get thrown away, and at the end of the year no one knows what was actually paid to the landlord.",
      solutionIcon: CheckCircle2,
      solutionTitle: "Immutable Audit Vault & PDF Exports",
      solutionDesc:
        "Every billing cycle is archived with high-res receipt attachments, timestamped logs, and downloadable summary statements for landlords or roommates.",
      badge: "Audit Proof",
    },
    {
      problemIcon: Scale,
      problemTitle: "Spreadsheet Rounding Errors",
      problemDesc:
        "Generic apps divide decimals naively, leaving floating point drift (₱0.33 vs ₱0.34) that causes mistrust and confusion in roommate groups.",
      solutionIcon: CheckCircle2,
      solutionTitle: "Strict Integer Centavo Math",
      solutionDesc:
        "Built on a deterministic integer math algorithm. The sum of all individual splits mathematically equals 100.00% of the invoice with zero rounding loss.",
      badge: "Centavo Precision",
    },
  ];

  return (
    <section id="why-splitzy" className="py-16 md:py-24 bg-white border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
            <span>The Shared Living Solution</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Stop Fighting Over Bills. <br />
            <span className="text-brand-600">Start Living Harmoniously.</span>
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            Shared housing should bring people together, not strain relationships over utility bills and late reminders. Here is how PropertyFlow fixes common household friction.
          </p>
        </div>

        {/* 2x2 Problem vs Solution Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {comparisons.map((item, idx) => {
            const ProblemIcon = item.problemIcon;
            const SolutionIcon = item.solutionIcon;
            return (
              <div
                key={idx}
                className="bg-slate-50 rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition-shadow"
              >
                {/* Card Top: Problem Section (Red/Gray Tone) */}
                <div className="p-6 bg-slate-100/70 border-b border-slate-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <ProblemIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
                        Common Roommate Dilemma
                      </span>
                      <h3 className="text-base font-bold text-slate-900">
                        {item.problemTitle}
                      </h3>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 pl-11">
                    {item.problemDesc}
                  </p>
                </div>

                {/* Card Bottom: Solution Section (Emerald/Brand Tone) */}
                <div className="p-6 bg-white space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <SolutionIcon className="w-4 h-4" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900">
                        {item.solutionTitle}
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 pl-9">
                    {item.solutionDesc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
