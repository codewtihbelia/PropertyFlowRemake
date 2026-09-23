import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export const FaqSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does absence redistribution work if a roommate goes on vacation?",
      a: "PropertyFlow distinguishes between fixed costs and variable consumption. Fixed commitments like Rent and Internet remain constant, while variable utilities like Water and Electricity can be attendance-weighted. When a roommate marks 10 days away, their utility share is reduced proportionally to their days present, and the remainder is shared across other occupants. No manual spreadsheet formulas needed.",
    },
    {
      q: "What if our bedrooms have different rental values or en-suite bathrooms?",
      a: "PropertyFlow allows the household host to set individual room rental rates (e.g., Master En-Suite at ₱14,000, Bedroom 2 at ₱11,000) or choose an equal division. The system automatically preserves these room rent baselines while dynamically calculating the month's changing utility invoices.",
    },
    {
      q: "How do roommates pay and verify their dues?",
      a: "The host configures their preferred payment method (GCash, Maya, or bank account QR). When a billing cycle opens, roommates tap 'Settle Dues', scan the QR, and upload their transfer confirmation screenshot with the reference number. The host reviews and marks it verified with a single click.",
    },
    {
      q: "Why does PropertyFlow emphasize 'Integer Centavo Math'?",
      a: "In standard calculators, dividing numbers like ₱1,000.00 by 3 results in ₱333.3333333. If you sum 333.33 x 3, you get ₱999.99, leaving a missing centavo. Over 12 months with 5 utility categories, these rounding errors compound and cause roommate friction. PropertyFlow computes all balances in pure integer centavos and deterministically assigns any remainder centavo, ensuring the sum always equals 100.00% of the invoice.",
    },
    {
      q: "Is there both a mobile app and a web portal?",
      a: "Yes! PropertyFlow features a companion mobile application (React Native / Expo) designed for quick on-the-go receipt uploads and check-ins, alongside this comprehensive web portal for in-depth billing management and reports. Both synchronize instantly via our secure cloud backend.",
    },
    {
      q: "Can I download reports for our landlord or accounting records?",
      a: "Yes! Every closed billing cycle can be exported as a clean statement or CSV ledger. This provides an indisputable record of when rent was gathered, what utility bills were paid, and proof of payment for your leaseholder records.",
    },
  ];

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section
      id="faq"
      className="py-16 md:py-24 bg-white border-b border-slate-200/80"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-3 mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Everything you need to know about setting up your household,
            splitting bills, and managing roommate dues.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="bg-slate-50 rounded-2xl border border-slate-200/90 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 focus:outline-hidden"
                >
                  <span className="font-bold text-slate-900 text-base sm:text-lg">
                    {faq.q}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen
                        ? "rotate-180 text-brand-600 border-brand-200"
                        : "text-slate-400"
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-slate-600 text-sm sm:text-base leading-relaxed border-t border-slate-100 animate-fadeIn">
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
