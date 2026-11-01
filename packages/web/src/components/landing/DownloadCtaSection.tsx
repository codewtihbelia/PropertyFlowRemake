<<<<<<< HEAD
import React from "react";
=======
import React, { useState, useEffect } from "react";
>>>>>>> cfb5e4d7c49ba50c9437e1a33c8b1ceca90a69ad
import {
  Download,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  Sparkles,
} from "lucide-react";
import { useMobilePlatformSettings } from "../../services/platformSettingsService";

interface DownloadCtaSectionProps {
  onOpenDownloadModal: () => void;
}

export const DownloadCtaSection: React.FC<DownloadCtaSectionProps> = ({
  onOpenDownloadModal,
}) => {
<<<<<<< HEAD
  const settings = useMobilePlatformSettings();
=======
  const [settings, setSettings] = useState<MobilePlatformSettings>(
    DEFAULT_PLATFORM_SETTINGS,
  );

  useEffect(() => {
    const unsubscribe = listenToMobilePlatformSettings((newSettings) => {
      setSettings(newSettings);
    });
    return () => unsubscribe();
  }, []);
>>>>>>> cfb5e4d7c49ba50c9437e1a33c8b1ceca90a69ad

  return (
    <section
      id="download"
      className="py-20 md:py-28 bg-gradient-to-tr from-slate-950 via-slate-900 to-blue-950 text-white relative overflow-hidden"
    >
      {/* Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
          Ready to Make Roommate Bills <br />
          <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
            Fair, Accurate & Stress-Free?
          </span>
        </h2>

        <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Join co-living households, dormers, and apartment hosts who trust
          Splitzy to manage their shared expenses down to the exact centavo.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={onOpenDownloadModal}
            className="px-8 py-4 text-base font-bold text-slate-950 bg-white hover:bg-slate-100 rounded-2xl shadow-xl shadow-white/10 transition-all hover:scale-105 flex items-center gap-2.5 cursor-pointer"
          >
            <Download className="w-5 h-5 text-blue-600" />
            <span>Download Android APK {settings.latestVersion}</span>
          </button>

          <button
            onClick={onOpenDownloadModal}
            className="px-6 py-4 text-base font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/25 transition-all hover:scale-105 flex items-center gap-2 cursor-pointer border border-blue-400/30"
          >
            <QrCode className="w-5 h-5" />
            <span>Scan QR Code</span>
          </button>
        </div>

        {/* Trust Badges */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>100% Free & Open Source</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>VirusTotal Clean & Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Direct GitHub Releases</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>Android 8.0</span>
          </div>
        </div>
      </div>
    </section>
  );
};
