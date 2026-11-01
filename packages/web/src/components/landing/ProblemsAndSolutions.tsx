import React from "react";
import {
  Calendar,
  Receipt,
  Scale,
  Users,
  MessageSquareX,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";

export const ProblemsAndSolutions: React.FC = () => {
  const comparisons = [
    {
      problemTitle: "Paying Full Water When Away",
      problemDesc:
        "Roommates away for 2 weeks on holiday, work, or family visits still get billed for the entire month's water utility they never consumed.",
      solutionTitle: "Daily Water Attendance Tracking",
      solutionDesc:
        "Mark days away on the interactive calendar. Splitzy automatically recalculates the rate per day and discounts your share fairly.",
    },
    {
      problemTitle: "Awkward End-of-Month Reminders",
      problemDesc:
        "The uncomfortable feeling of one roommate playing debt collector in the group chat, chasing down proof of payments and missing receipts.",
      solutionTitle: "One-Tap Settle & Double-Entry Ledger",
      solutionDesc:
        "Roommates settle dues with one tap using linked GCash, Maya, or bank cards. Both parties immediately receive an itemized digital receipt.",
    },
    {
      problemTitle: "Lost Receipts & Messy Chat Screenshots",
      problemDesc:
        "Paper receipts fade, water meter photos get buried under hundreds of chat messages, and no one knows what was actually paid to the landlord.",
      solutionTitle: "Cloud-Synced Household Vault",
      solutionDesc:
        "Every billing cycle is archived with receipt attachments, timestamped logs, and transparent itemized shares accessible to all roommates.",
    },
    {
      problemTitle: "Centavo Rounding Drift",
      problemDesc:
        "Dividing ₱800 across 3 roommates with decimals results in ₱266.6666... leaving missing centavos that cause confusion and mistrust.",
      solutionTitle: "Integer Floor Division & Fair Remainder",
      solutionDesc:
        "Mathematical floor division allocates ₱266.67, ₱266.67, and ₱266.66. The total sum always equals 100.00% of the invoice to the exact centavo.",
    },
  ];

  return (
    <section
      id="why-splitzy"
      className="py-20 md:py-28 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Less Stress About Bills. <br />
            <span className="text-blue-600 dark:text-blue-400">
              More Joy in Living Together.
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Sharing a home should be fun, not stressful. Splitzy keeps bills
            organized, payments clear, and roommate life a little easier.
          </p>
        </div>

        {/* 2x2 Problem vs Solution Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {comparisons.map((item, idx) => (
            <div
              key={idx}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 overflow-hidden shadow-xs hover:shadow-md transition-shadow"
            >
              {/* Problem Part (Top) */}
              <div className="p-6 bg-rose-50/50 dark:bg-rose-950/20 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2.5 mb-2">
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    Common Roommate Dilemma
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">
                  {item.problemTitle}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.problemDesc}
                </p>
              </div>

              {/* Solution Part (Bottom) */}
              <div className="p-6 bg-white dark:bg-slate-900/60">
                <div className="flex items-center gap-2.5 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    The Splitzy Solution
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">
                  {item.solutionTitle}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.solutionDesc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
