import React from "react";
import { Building2, Heart, Shield, Terminal, ArrowUp } from "lucide-react";

interface LandingFooterProps {
  onScrollTo: (id: string) => void;
  onOpenApp: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onScrollTo, onOpenApp }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-slate-950 text-slate-400 text-sm border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          
          {/* Col 1: Brand & Bio */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                Property<span className="text-brand-500">Flow</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-900/60 text-brand-300 border border-brand-800">
                Splitzy
              </span>
            </div>

            <p className="text-slate-400 text-sm leading-relaxed max-w-md">
              The modern roommate bill management platform. Automates monthly utility splits, vacation attendance adjustments, and payment reconciliations with exact integer centavo precision.
            </p>

            <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
              <span>Optimized for React Native mobile & modern web</span>
              <span>•</span>
              <span>Firebase Cloud Sync</span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Product Features</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => onScrollTo("calculator")}
                  className="hover:text-white transition-colors"
                >
                  Live Split Calculator
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("mobile-app")}
                  className="hover:text-white transition-colors"
                >
                  Proposed Mobile UI
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("features")}
                  className="hover:text-white transition-colors"
                >
                  Centavo Math Engine
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("how-it-works")}
                  className="hover:text-white transition-colors"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("roles")}
                  className="hover:text-white transition-colors"
                >
                  Host & Roommate Roles
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Portal Access & Utilities */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Application Access</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={onOpenApp}
                  className="text-brand-400 hover:text-brand-300 font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span>Launch Web Portal</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("faq")}
                  className="hover:text-white transition-colors"
                >
                  Frequently Asked Questions
                </button>
              </li>
              <li>
                <button
                  onClick={scrollToTop}
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <span>Back to Top</span>
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} PropertyFlow (Splitzy). All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Roommate Harmony Guaranteed</span>
            <span>•</span>
            <span>Integer Centavo Math</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
