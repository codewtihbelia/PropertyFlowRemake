import React, { useState } from "react";
import {
  BookOpen,
  Calendar,
  Zap,
  CreditCard,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Calculator,
} from "lucide-react";

export const SplitzyGuidesSection: React.FC = () => {
  const [activeGuide, setActiveGuide] = useState<number>(0);

  const guides = [
    {
      id: "travel-equation",
      badge: "Guide 01 · Utility Fairness",
      icon: Calendar,
      title: "The Roommate Travel Equation",
      subtitle:
        "How to handle utility bills when someone goes on vacation or visits home",
      tldr: "Fixed costs (Rent, Wi-Fi) stay equally split; variable costs (Water, Electricity) adjust strictly based on days present.",
      scenario:
        "Marco stays in the dorm all 30 days of the month. Rommel visits his family for 16 days and only stayed for 14 days. The total water bill is ₱237.72.",
      theTraditionalMistake:
        "Splitting 50/50: Both pay ₱118.86. Rommel feels resentful because he was gone more than half the month and barely used a drop of water.",
      theSplitzyWay:
        "Daily Attendance Calendar: Marco was present 30 days, Rommel 14 days (44 total person-days). Rate = ₱237.72 ÷ 44 = ₱5.40/day. Rommel pays 14 × ₱5.40 = ₱75.60. Marco pays 30 × ₱5.40 = ₱162.12. Both agree it is 100% fair.",
      actionTakeaways: [
        "Mark attendance daily or let Splitzy auto-lock the month",
        "Wi-Fi and Rent remain equally divided since the room is reserved",
        "Water & electricity attendance credits are applied automatically to the cycle balance",
      ],
    },
    {
      id: "sub-meters",
      badge: "Guide 02 · Electric Sub-Meters",
      icon: Zap,
      title: "Demystifying Electric Sub-Meters",
      subtitle:
        "Calculating aircon, refrigerator, and room sub-meters without quarrels",
      tldr: "Input beginning and ending meter readings, multiply by the Meralco/electric coop effective KWh rate, and auto-deduct from main bill.",
      scenario:
        "Room 1 has an inverter aircon on a separate sub-meter. The household Meralco bill is ₱6,800 for 520 kWh (₱13.08/kWh). Room 1's sub-meter recorded 180 kWh.",
      theTraditionalMistake:
        "Guessing an arbitrary ₱2,000 deduction or splitting the whole ₱6,800 across all 4 rooms, forcing non-aircon rooms to subsidize aircon rooms.",
      theSplitzyWay:
        "Direct Sub-Meter Math: Room 1 pays 180 kWh × ₱13.08 = ₱2,354.40. The remaining ₱4,445.60 is common area power (refrigerator, lights, Wi-Fi) split equally (₱1,111.40 each). Room 1 pays ₱3,465.80; other rooms pay only ₱1,111.40.",
      actionTakeaways: [
        "Hosts snap a photo of the sub-meter on billing cutoff day",
        "Splitzy logs the previous reading so you only enter the new index",
        "The mathematical formula is visible to every roommate in the bill itemization",
      ],
    },
    {
      id: "cashless-settlement",
      badge: "Guide 03 · Cashless Settlements",
      icon: CreditCard,
      title: "Eliminating 'I'll Pay You Later'",
      subtitle:
        "Using integrated GCash & Maya QR settlements to keep roommates friendly",
      tldr: "Settle individual charges as soon as they are posted instead of accumulating a massive end-of-month debt.",
      scenario:
        "Carla paid ₱1,200 for shared drinking water and cleaning supplies. She asks roommates for their share in the group chat, but people forget or reply days later.",
      theTraditionalMistake:
        "Sending manual GCash QR codes into a busy chat where messages get buried under memes, leading to unpaid IOUs and awkward reminders.",
      theSplitzyWay:
        "One-Tap Settlement: Carla posts the expense in Splitzy. Roommates receive a push notification with a direct 'Pay with GCash' button. When they transfer, Splitzy marks the debt as settled and reconciles the card balance.",
      actionTakeaways: [
        "Instant settlement button directs to linked GCash, Maya, or bank account",
        "Payment receipts are archived under the expense with timestamp and reference",
        "No more calculating 'who owes who' across multiple grocery receipts",
      ],
    },
  ];

  const current = guides[activeGuide];
  const CurrentIcon = current.icon;

  return (
    <section
      id="guides"
      className="py-20 md:py-28 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Practical Co-Living Wisdom. <br />
            <span className="text-blue-600 dark:text-blue-400">
              Zero Awkward Conversations.
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
            Living with roommates is great—until money is involved. We wrote
            these field-tested guides to solve the most common shared apartment
            disputes.
          </p>
        </div>

        {/* Guide Selector Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {guides.map((g, idx) => {
            const Icon = g.icon;
            const isSelected = activeGuide === idx;
            return (
              <button
                key={g.id}
                onClick={() => setActiveGuide(idx)}
                className={`p-5 rounded-2xl text-left transition-all border ${
                  isSelected
                    ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-600 dark:border-blue-500 shadow-md ring-2 ring-blue-600/10"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
                    0{idx + 1}
                  </span>
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                  {g.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {g.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        {/* Expanded Active Guide Card */}
        <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 shadow-lg">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Guide Title Lockup */}
            <div className="space-y-3 pb-6 border-b border-slate-200 dark:border-slate-700/80">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                {current.badge}
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {current.title}
              </h3>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
                {current.subtitle}
              </p>

              {/* TL;DR Highlight Banner */}
              <div className="p-4 rounded-xl bg-blue-100/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs sm:text-sm text-blue-900 dark:text-blue-200 font-medium">
                <strong>Rule of Thumb:</strong> {current.tldr}
              </div>
            </div>

            {/* Scenario Breakdown: Traditional vs Splitzy */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                  Real-World Scenario
                </span>
                <p className="text-sm text-slate-800 dark:text-slate-200 mt-1 font-medium">
                  {current.scenario}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    The Common Mistake
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {current.theTraditionalMistake}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    How Splitzy Solves It
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {current.theSplitzyWay}
                  </p>
                </div>
              </div>
            </div>

            {/* Actionable Takeaways */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Actionable House Rules
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {current.actionTakeaways.map((takeaway, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{takeaway}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
