import React from "react";
import { 
  ArrowRight, 
  Smartphone, 
  LayoutDashboard, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles,
  QrCode
} from "lucide-react";

interface DownloadCtaSectionProps {
  onOpenApp: () => void;
  onOpenCalculator: () => void;
}

export const DownloadCtaSection: React.FC<DownloadCtaSectionProps> = ({
  onOpenApp,
  onOpenCalculator,
}) => {
  return (
    <section id="cta" className="py-16 md:py-24 bg-gradient-to-tr from-slate-900 via-brand-950 to-slate-900 text-white relative overflow-hidden">
      {/* Subtle Glow Circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>Start Your Harmonious Living Experience</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
          Ready to Make Roommate Bills <br />
          <span className="bg-gradient-to-r from-brand-400 to-indigo-300 bg-clip-text text-transparent">
            Fair, Accurate, & Stress-Free?
          </span>
        </h2>

        <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Join thousands of shared apartments, condos, and student dormitories who trust PropertyFlow to handle their household finances down to the exact centavo.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={onOpenApp}
            className="px-7 py-4 text-base font-extrabold text-slate-950 bg-white hover:bg-slate-100 rounded-xl shadow-xl transition-all hover:scale-105 flex items-center gap-2.5"
          >
            <LayoutDashboard className="w-5 h-5 text-brand-600" />
            <span>Launch App Portal Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenCalculator}
            className="px-6 py-4 text-base font-bold text-white bg-brand-600 hover:bg-brand-500 border border-brand-400/40 rounded-xl transition-all hover:scale-105 flex items-center gap-2"
          >
            <span>Simulate a Split</span>
          </button>
        </div>

        {/* Badges / Trust points */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Zero Setup Fees</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Cloud Sync with Firebase</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>GCash, Maya & Bank Ready</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Native iOS & Android Mobile Suite</span>
          </div>
        </div>

      </div>
    </section>
  );
};
