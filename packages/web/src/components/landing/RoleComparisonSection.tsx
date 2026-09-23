import React, { useState } from "react";
import {
  UserCheck,
  Users,
  Check,
  Crown,
  ShieldCheck,
  Home,
  Smartphone,
  CheckCircle2,
} from "lucide-react";

export const RoleComparisonSection: React.FC = () => {
  return (
    <section
      id="roles"
      className="py-16 md:py-24 bg-slate-50 border-b border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider border border-indigo-200">
            <span>Tailored Perspectives</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Built for Both Primary Leaseholders <br />
            <span className="text-brand-600">& Individual Roommates</span>
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Whether you hold the master lease and pay the landlord, or simply
            want to pay your fair share on time, PropertyFlow gives you clarity.
          </p>
        </div>

        {/* 2-Column Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Card 1: Primary Host / Leaseholder */}
          <div className="bg-white rounded-3xl p-8 border-2 border-brand-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                    <Crown className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                      Lease Administrator
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">
                      For Household Hosts
                    </h3>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-100 text-brand-800">
                  Primary Admin
                </span>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Take the administrative pain out of collecting money. Master
                invoices are entered once, automated math is calculated, and
                payments are reconciled without friction.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  "Input official Meralco, Water, & Rent bills in seconds",
                  "Review and approve GCash/Maya receipts with one tap",
                  "Automatic absence redistribution without manual spreadsheets",
                  "Download monthly settlement audit reports for the landlord",
                  "Post pinned announcements & cleaning reminders",
                  "Support for aircon sub-metering and custom room rent rates",
                ].map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-sm text-slate-700"
                  >
                    <div className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">
                Outcome: Save 3+ hours per month chasing roommates and resolving
                math disagreements.
              </span>
            </div>
          </div>

          {/* Card 2: Roommates & Tenants */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                      Tenant / Roommate
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">
                      For Resident Roommates
                    </h3>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  Payor Member
                </span>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Enjoy 100% financial transparency. Never wonder how a utility
                bill was calculated or if your payment was registered.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  "Clear, itemized bill breakdown down to the exact centavo",
                  "Absence discount when you travel or visit family",
                  "Scan host payment QR code directly in the mobile or web app",
                  "Upload payment screenshot and reference code instantly",
                  "Immediate digital confirmation once host verifies your share",
                  "View house noticeboard, WiFi credentials, and duty rosters",
                ].map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-sm text-slate-700"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">
                Outcome: Complete trust in your bill shares with zero awkward
                money conversations.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
