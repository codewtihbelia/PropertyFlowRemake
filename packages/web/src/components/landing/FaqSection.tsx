import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export const FaqSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "How do I install the Splitzy Android APK published from GitHub?",
      a: "Tap the 'Download Android APK' button or scan the QR code using your phone camera. When the .apk finishes downloading, open it and tap 'Allow installation from this source' if prompted by Android. Splitzy is a signed release package that runs smoothly on Android 8.0 (Oreo) and above without requiring Google Play Store.",
    },
    {
      q: "Is Splitzy completely free to use?",
      a: "Yes! Splitzy is 100% free with no monthly subscription fees, no locked features, and no intrusive banner advertisements. It was created as an open, community-driven tool to solve co-living roommate finance.",
    },
    {
      q: "How does the water utility attendance tracking work?",
      a: "Splitzy tracks presence days on an interactive monthly calendar. When a roommate travels, visits family, or is away on an internship, they mark those days on the calendar. Splitzy automatically divides the total water bill by the total person-days present, so residents only pay for the exact days they consumed water.",
    },
    {
      q: "Can roommates pay with GCash, Maya, or Philippine bank accounts?",
      a: "Yes! Splitzy has native presets for GCash, Maya, BDO, BPI, UnionBank, RCBC, and LandBank. Hosts can upload their QR code or payment details. Roommates tap 'Pay with GCash / Bank', complete the transfer, and Splitzy reconciles the balance with a digital receipt.",
    },
    {
      q: "Why does Splitzy calculate dues down to the exact centavo?",
      a: "Standard calculators divide decimals naively, which causes rounding drift (e.g., ₱800 ÷ 3 = ₱266.6666... leaving a missing centavo). Over 12 months with 5 utility categories, these rounding errors cause disputes. Splitzy uses integer centavo math with fair remainder distribution so ₱800 splits cleanly as ₱266.67, ₱266.67, and ₱266.66.",
    },
    {
      q: "Can I use Splitzy if I live in a dorm room or boarding house with sub-meters?",
      a: "Absolutely. Splitzy is specifically built for Philippine dorms, boarding houses, and apartments. Hosts can input electric sub-meter readings to calculate aircon consumption separately from common area lighting and refrigerators.",
    },
    {
      q: "Is there an iOS version available?",
      a: "Splitzy's mobile codebase is built with React Native & Expo, supporting both Android and iOS. The Android APK is immediately published on GitHub for direct download. An iOS test flight build is planned as part of the community roadmap.",
    },
  ];

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section
      id="faq"
      className="py-20 md:py-28 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-3 mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
            Everything you need to know about setting up your group, downloading
            the APK, and managing shared roommate dues.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 focus:outline-hidden cursor-pointer"
                >
                  <span className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                    {faq.q}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen
                        ? "rotate-180 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900"
                        : "text-slate-400"
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-[20px] text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed border-t border-slate-100 dark:border-slate-800/80 animate-in fade-in duration-200">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
