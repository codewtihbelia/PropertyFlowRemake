import React from "react";
import {
  Building,
  Receipt,
  CalendarDays,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      stepNumber: "01",
      icon: Building,
      title: "Set Up Household & Rooms",
      description:
        "Name your shared apartment or dorm. Configure fixed room rents or equal splits, and invite your roommates via invite code or email.",
      highlight: "Takes under 2 minutes",
    },
    {
      stepNumber: "02",
      icon: Receipt,
      title: "Log Bills & Upload Proofs",
      description:
        "When Meralco, Manila Water, or WiFi invoices arrive, add the amounts and snap a photo. Invoices are stored in the household vault.",
      highlight: "Automatic categorization",
    },
    {
      stepNumber: "03",
      icon: CalendarDays,
      title: "Track Absence & Attendance",
      description:
        "Roommates mark days away on vacation or break. The mathematical engine discounts their utilities and shares the difference fairly.",
      highlight: "Vacation-aware math",
    },
    {
      stepNumber: "04",
      icon: CheckCircle,
      title: "Settle Dues with 1-Tap Proof",
      description:
        "Roommates pay via GCash, Maya, or bank transfer and attach their reference. The host verifies with a single tap, closing the cycle cleanly.",
      highlight: "Zero awkward follow-ups",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-16 md:py-24 bg-white border-b border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase tracking-wider border border-brand-200">
            <span>Simple 4-Step Workflow</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How PropertyFlow Works <br />
            <span className="text-brand-600">From Move-In to Settlement</span>
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Designed to integrate seamlessly into busy roommate routines without
            friction or steep learning curves.
          </p>
        </div>

        {/* 4 Steps Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="relative bg-slate-50 rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-brand-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black text-slate-300 tracking-tight font-mono">
                      {s.stepNumber}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-brand-600 flex items-center justify-center shadow-xs">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    {s.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {s.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200/60">
                  <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                    {s.highlight}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
