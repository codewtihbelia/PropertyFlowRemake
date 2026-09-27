import React from "react";
import { 
  Calculator, 
  Droplets, 
  Receipt, 
  ShieldCheck, 
  Users, 
  FileText, 
  Sparkles, 
  Lock, 
  QrCode, 
  BellRing,
  Clock,
  Layers
} from "lucide-react";

export const FeaturesBentoGrid: React.FC = () => {
  return (
    <section id="features" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-700 text-xs font-bold uppercase tracking-wider">
            <span>Engineered for Shared Living</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Everything Required to Run <br />
            <span className="text-brand-600">A Stress-Free Household</span>
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            From daily drinking water refills to complex end-of-lease reconciliations, PropertyFlow gives every roommate transparency and peace of mind.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Centavo Math (Span 2 on MD) */}
          <div className="md:col-span-2 bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="max-w-md space-y-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <Calculator className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                Financial Foundation
              </span>
              <h3 className="text-2xl font-bold text-slate-900">
                Integer Centavo Math Engine
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Standard splitting apps perform floating-point arithmetic, causing 1-centavo drifts that sow distrust in shared apartments. PropertyFlow handles every calculation in exact integer centavos (1 PHP = 100 cents), distributing remainder cents deterministically so the sum always matches the bill exactly.
              </p>
            </div>
            
            {/* Visual accent badge */}
            <div className="mt-6 inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>∑(Individual Roommate Splits) ≡ 100.00% of Utility Invoice</span>
            </div>
          </div>

          {/* Card 2: Attendance Redistribution */}
          <div className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Droplets className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Fair Living
            </span>
            <h3 className="text-xl font-bold text-slate-900">
              Vacation & Absence Tracking
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              When a roommate travels for vacation or work, water and variable utilities are automatically recalibrated so they never pay for showers or aircon they didn't use.
            </p>
          </div>

          {/* Card 3: Receipt Vault */}
          <div className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Verification
            </span>
            <h3 className="text-xl font-bold text-slate-900">
              Receipt Vault & Reference Tags
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Attach high-resolution photos of Meralco electric bills, Manila Water invoices, and GCash confirmation screenshots directly to the billing cycle for immediate review.
            </p>
          </div>

          {/* Card 4: Multi-Role Management (Span 2) */}
          <div className="md:col-span-2 bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Role-Based Access
              </span>
              <h3 className="text-2xl font-bold text-slate-900">
                Hosts, Roommates & Co-Living Managers
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                Every household member gets a tailored interface: Primary leaseholders (Hosts) manage cycles and approve receipts; tenants and roommates see their personal dues and make one-tap settlements; property managers can oversee multiple apartments.
              </p>
            </div>

            {/* Role Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-900">Household Host</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Leaseholder, billing admin, settlement verification</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-900">Resident Payor</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Roommates splitting rent & monthly utilities</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-900">Non-Payor Guest</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Subtenants or family with zero financial liability</p>
              </div>
            </div>
          </div>

          {/* Card 5: House Notices */}
          <div className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <BellRing className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Communication
            </span>
            <h3 className="text-xl font-bold text-slate-900">
              Household Noticeboard
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Post maintenance updates, pest control alerts, cleaning duty rosters, and WiFi passwords in a centralized shared feed without getting lost in chat spam.
            </p>
          </div>

          {/* Card 6: PDF Statements & Reports */}
          <div className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
              Audit Ready
            </span>
            <h3 className="text-xl font-bold text-slate-900">
              Downloadable Reports
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Export month-end settlement statements and annual ledger logs in CSV or print-ready PDF formats to present to your landlord or property manager.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
};
