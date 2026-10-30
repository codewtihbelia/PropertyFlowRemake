import React from "react";
import {
  Calculator,
  Droplets,
  Wallet,
  Repeat,
  Users,
  Video,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export const FeaturesBentoGrid: React.FC = () => {
  return (
    <section
      id="features"
      className="py-20 md:py-28 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Engineered for Fairness. <br />
            <span className="text-blue-600 dark:text-blue-400">
              Zero Math Friction.
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
            Traditional calculators divide numbers blindly. Splitzy understands
            that humans live together, travel, have sub-meters, and pay with
            GCash.
          </p>
        </div>

        {/* Asymmetric Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Bento Card 1: Centavo Math Engine (Col-span 7) */}
          <div className="md:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-8 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Calculator className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                Exact Centavo Mathematical Engine
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
                Dividing ₱800 by 3 payors yields ₱266.6666... In Splitzy, our
                mathematical floor division allocates ₱266.67 to two payors and
                ₱266.66 to the third. The sum always matches the exact bill down
                to the last centavo, eliminating disappearing change.
              </p>
            </div>

            {/* Visual Formula Simulation */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                <span>TOTAL BILL: ₱800.00</span>
                <span>3 PAYORS</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">
                    Roomie 1
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                    ₱266.67
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">
                    Roomie 2
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                    ₱266.67
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">
                    Roomie 3
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                    ₱266.66
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium text-center pt-1">
                ✓ Exact Reconciliation: 266.67 + 266.67 + 266.66 = ₱800.00
              </div>
            </div>
          </div>

          {/* Bento Card 2: Water Attendance (Col-span 5) */}
          <div className="md:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-8 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <Droplets className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                Presence-Based Water Billing
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                Why pay for water when you were out of town for 2 weeks? Track
                presence days on an interactive monthly calendar. The app
                dynamically redistributes absence shares among present
                residents.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span>Active Cycle Rate:</span>
                <span className="font-mono text-cyan-700 dark:text-cyan-300">
                  ₱5.66 / day
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Present 14 Days:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  ₱79.24 Due
                </span>
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 pt-1">
                ✓ Non-payor water shares automatically absorbed fairly
              </div>
            </div>
          </div>

          {/* Bento Card 3: Splitzy Digital Wallet & Cards (Col-span 4) */}
          <div className="md:col-span-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-7 shadow-sm space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Splitzy Wallet & Cards
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Store available balance, link GCash, Maya, and local bank cards,
              and simulate everyday coffee, lunch, and grocery expenses with
              auto-deduction.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                GCash QR
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Maya Wallet
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                PH Bank Cards
              </span>
            </div>
          </div>

          {/* Bento Card 4: Subscriptions & Roomie IOUs (Col-span 4) */}
          <div className="md:col-span-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-7 shadow-sm space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Repeat className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Subscriptions & IOUs
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Track shared Netflix, Spotify, ChatGPT, and Wi-Fi services. Keep
              informal roommate loans recorded with a clean 1-tap settlement
              button.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Netflix & Spotify
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Personal IOUs
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                1-Tap Settlement
              </span>
            </div>
          </div>

          {/* Bento Card 5: Social Feeds, Reels & WebRTC Calling (Col-span 4) */}
          <div className="md:col-span-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-7 shadow-sm space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Community & Messenger
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Co-living is social. Splitzy includes community discussions,
              vertical reels, and direct encrypted chat with two-way WebRTC
              voice and video calls.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                WebRTC Calls
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Roomie Reels
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                House Bulletins
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
