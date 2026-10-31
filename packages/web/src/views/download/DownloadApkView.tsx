import React, { useState, useEffect } from "react";
import {
  Download,
  Smartphone,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  FileCheck,
  ArrowLeft,
  Sparkles,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Clock,
  Shield,
  SmartphoneNfc,
} from "lucide-react";
import {
  listenToMobilePlatformSettings,
  MobilePlatformSettings,
  DEFAULT_PLATFORM_SETTINGS,
} from "../../services/platformSettingsService";
import { useTheme } from "../../contexts/ThemeContext";

interface DownloadApkViewProps {
  onBackToHome: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

export const DownloadApkView: React.FC<DownloadApkViewProps> = ({
  onBackToHome,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<MobilePlatformSettings>(
    DEFAULT_PLATFORM_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloadMode, setDownloadMode] = useState<"direct" | "qr">("direct");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = React.useRef(0);

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo({ top: 0, behavior: "instant" });

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY < 60) {
        setIsVisible(true);
      } else if (delta > 8) {
        setIsVisible(false);
      } else if (delta < -8) {
        setIsVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
      setIsScrolled(currentScrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    const unsubscribe = listenToMobilePlatformSettings((newSettings) => {
      setSettings(newSettings);
      setLoading(false);
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      unsubscribe();
    };
  }, []);

  const apkUrl =
    settings.apkDownloadUrl?.trim() ||
    DEFAULT_PLATFORM_SETTINGS.apkDownloadUrl ||
    "https://github.com/Splitzy/Splitzy-Mobile/releases/download/v2.9.5/Splitzy.apk";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(apkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // SVG QR Code API encoding the real APK download link
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    apkUrl,
  )}&color=0f172a&bgcolor=ffffff&margin=1`;

  // Parse release notes lines safely
  const rawNotes =
    settings.releaseNotes || DEFAULT_PLATFORM_SETTINGS.releaseNotes || "";
  const releaseLines = rawNotes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[•\-\*]\s*/, ""));

  const formattedUpdateDate = (() => {
    if (!settings.updatedAt) return "October 2026";
    try {
      const d = new Date(settings.updatedAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {}
    return "October 2026";
  })();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-600 selection:text-white transition-colors pb-16">
      {/* 1. Floating Frosted Glass Capsule Bar matching Main Landing Navbar */}
      <header
        className={`fixed top-4 sm:top-6 inset-x-0 z-50 px-3 sm:px-6 pointer-events-none transition-all duration-500 ease-out ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-8 pointer-events-none"
        }`}
      >
        <div className="max-w-6xl mx-auto">
          {/* Floating Frosted Glass Capsule Bar */}
          <div
            className={`pointer-events-auto rounded-full px-5 sm:px-7 py-3 sm:py-3.5 min-h-[64px] sm:min-h-[70px] flex items-center justify-between gap-4 transition-all duration-300 ${
              isScrolled
                ? "bg-white/88 dark:bg-slate-900/88 backdrop-blur-2xl backdrop-saturate-150 border border-slate-200/50 dark:border-white/[0.08] shadow-[0_16px_40px_-10px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_16px_40px_-10px_rgba(0,0,0,0.55),0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "bg-white/82 dark:bg-slate-900/82 backdrop-blur-xl backdrop-saturate-150 border border-slate-200/40 dark:border-white/[0.06] shadow-[0_10px_30px_-6px_rgba(0,0,0,0.08),0_2px_10px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_10px_30px_-6px_rgba(0,0,0,0.45),0_2px_10px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]"
            }`}
          >
            {/* Left: Brand Logo & Icon Mark */}
            <button
              onClick={onBackToHome}
              className="flex items-center gap-1 text-left cursor-pointer focus:outline-hidden group"
            >
              {/* Custom stylized house emblem with Splitzy #2563EB palette */}
              <div className="rounded-xl p-1.5 flex flex-col justify-end items-center relative overflow-hidden shadow-xs">
                <img
                  src="../../favicon.png"
                  alt="Splitzy Logo"
                  className="w-10 h-10 sm:w-11 sm:h-11 resize-cover"
                />
              </div>

              <div className="sm:flex hidden flex-col">
                <div className="flex flex-row">
                  <span className="text-base sm:text-lg font-black tracking-tight text-[#1b2b3f] dark:text-white leading-none">
                    SPLIT
                  </span>
                  <span className="text-base sm:text-lg font-black tracking-tight text-[#2563EB] leading-none">
                    ZY
                  </span>
                </div>
                <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider leading-tight mt-0.5">
                  Download
                </span>
              </div>
            </button>

            {/* Center: Return to Home Navigation */}
            <div className="sm:flex hidden items-center gap-2">
              <button
                onClick={onBackToHome}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-[#2563EB] dark:hover:text-blue-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Home</span>
              </button>
            </div>

            {/* Right: Theme Switcher & Floating Download APK Pill Button */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
              </button>

              <a
                href={apkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1d4ed8] active:bg-[#1e40af] rounded-full shadow-[0_6px_20px_-4px_rgba(37,99,235,0.45)] hover:shadow-[0_8px_24px_-4px_rgba(37,99,235,0.55)] transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Download APK</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container (with proper padding to sit below floating bar) */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 pb-16 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
            Install Splitzy on Your Mobile Device
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Manage shared co-living expenses, track water and electricity
            presence, split rent with exact centavo precision, and settle
            balances seamlessly.
          </p>

          {/* Unboxed Metadata Kicker (Zero-Pill Discipline) */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400 pt-1">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              Version {settings.latestVersion}
            </span>
            <span aria-hidden="true">·</span>
            <span>Updated {formattedUpdateDate}</span>
            <span aria-hidden="true">·</span>
            <span>Android 8.0</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              VirusTotal Verified
            </span>
          </div>
        </div>

        {/* 3. Primary Download Actions Bento (Direct APK + Camera QR Code) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Direct APK Download & File Info (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                    Package Size
                  </span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    ~48.2 MB
                  </p>
                </div>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Direct Android APK Package
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Download the universal release binary directly to your Android
                  phone or tablet. Compatible with all modern ARM64, ARMv7, and
                  x86 devices.
                </p>
              </div>

              {/* Verified Features Checklist */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Real-time WebRTC audio & video calls</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Splitzy Wallet & offline ledger cache</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Community Reels & encrypted chat</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Over-the-air silent updates enabled</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <a
                href={apkUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-blue-500/25 transition-all text-center"
              >
                <Download className="w-5 h-5" />
                <span>Download Splitzy APK (v{settings.latestVersion})</span>
              </a>

              {/* Copy URL Input Box */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={apkUrl}
                  className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700/80 focus:outline-hidden select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                  title="Copy direct download link"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Copied!
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Scan with Phone Camera (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center text-center justify-between space-y-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <QrCode className="w-4 h-4" />
                <span>Phone Camera Sideload</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Scan with Your Phone
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                Open your smartphone camera or QR reader to instantly open and
                download the APK without cables.
              </p>
            </div>

            {/* High-Contrast Crisp QR Code Container */}
            <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-inner">
              <img
                src={qrSvgUrl}
                alt={`Scan QR code with your mobile camera to download Splitzy version ${settings.latestVersion}`}
                className="w-48 h-48 rounded-lg"
                loading="eager"
              />
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <SmartphoneNfc className="w-3.5 h-3.5 text-slate-400" />
              <span>Direct HTTPS signed package stream</span>
            </div>
          </div>
        </div>

        {/* 4. Real Version Settings & Changes Section (Declared by Super Admin) */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Released: {formattedUpdateDate}</span>
            </div>
          </div>

          {/* Release Changes List */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Key Changes & Improvements Declared by Admin
            </h3>

            {releaseLines.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {releaseLines.map((change, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3"
                  >
                    <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono">
                      {idx + 1}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {change}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                General stability improvements, social chat enhancements, and
                payment reconciliation updates.
              </p>
            )}
          </div>

          {/* Technical Specs Footer in Release Log */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            {settings.minSupportedVersion && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>
                  Minimum Supported Version: v{settings.minSupportedVersion}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 5. Google Play Store & Apple App Store "Coming Soon" Section */}
        <section className="bg-gradient-to-b from-slate-100/80 to-white dark:from-slate-900/60 dark:to-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Coming Soon to Official App Stores
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              We are finalizing store reviews and developer registry
              certification for both platforms. Splitzy will be publicly
              available on Google Play and Apple App Store in the coming
              releases.
            </p>
          </div>

          {/* Store Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto pt-2">
            {/* Google Play Store Badge Card */}
            <div className="relative group p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                {/* Official Style Google Play Badge */}
                <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white border border-slate-800 dark:border-slate-700 shadow-xs">
                  {/* Google Play Vector Icon */}
                  <svg className="w-6 h-6 shrink-0" viewBox="0 0 512 512">
                    <path
                      d="M48.7 13.9C42.8 20.3 39.4 30.6 39.4 43.6v424.8c0 13 3.4 23.3 9.3 29.7l1.6 1.5 237.9-238v-5.6L50.3 12.4l-1.6 1.5z"
                      fill="#00E676"
                    />
                    <path
                      d="M367.6 324.9l-79.4-79.3v-5.6l79.4-79.3 1.8 1 94.1 53.5c26.9 15.3 26.9 40.2 0 55.5l-94.1 53.7-1.8 1z"
                      fill="#FFD600"
                    />
                    <path
                      d="M288.2 245.6L50.3 483.5c8.8 9.3 23.2 10.5 39.5 1.3l279.6-158.9-81.2-80.3z"
                      fill="#FF1744"
                    />
                    <path
                      d="M288.2 266.4l81.2-80.3L89.8 27.2c-16.3-9.3-30.7-8-39.5 1.3l237.9 237.9z"
                      fill="#00B0FF"
                    />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] tracking-wider uppercase leading-none text-slate-400">
                      GET IT ON
                    </div>
                    <div className="text-sm font-bold tracking-tight text-white leading-tight">
                      Google Play
                    </div>
                  </div>
                </div>

                {/* Coming Soon Status Tag */}
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/80 dark:border-amber-800/80">
                  Coming Soon
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Google Play Store
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Targeted release for Android devices worldwide via Google Play
                  console. You can immediately install via APK above today!
                </p>
              </div>

              <div className="pt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span>Store Listing Staging & Policy Review</span>
              </div>
            </div>

            {/* Apple App Store Badge Card */}
            <div className="relative group p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                {/* Official Style Apple App Store Badge */}
                <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white border border-slate-800 dark:border-slate-700 shadow-xs">
                  {/* Apple Vector Icon */}
                  <svg
                    className="w-6 h-6 shrink-0 fill-current text-white"
                    viewBox="0 0 170 170"
                  >
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-6.3-9.61-11.05-20.2-14.25-31.78-3.21-11.59-4.81-22.38-4.81-32.39 0-14.28 3.59-26.04 10.78-35.29 7.18-9.25 16.39-13.97 27.61-14.16 4.35 0 9.29 1.14 14.82 3.42 5.53 2.28 9.29 3.48 11.28 3.6 2.45-.36 6.36-1.63 11.75-3.83 5.38-2.19 10.05-3.17 14.02-2.92 10.36.52 19.06 4.47 26.11 11.83-9.35 5.66-13.93 13.68-13.73 24.08.2 8.35 3.42 15.28 9.67 20.81 6.25 5.53 13.78 8.78 22.58 9.77-1.96 5.88-4.35 12.01-7.18 18.39zM119.22 31.84c0-6.73 2.45-13.11 7.35-19.14 4.9-6.03 11.08-9.84 18.54-11.43.2 1.43.29 2.75.29 3.96 0 6.64-2.58 13.06-7.75 19.27-5.16 6.2-11.45 9.94-18.86 11.23-.27-1.29-.4-2.59-.4-3.89z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] tracking-wider uppercase leading-none text-slate-400">
                      Download on the
                    </div>
                    <div className="text-sm font-bold tracking-tight text-white leading-tight">
                      App Store
                    </div>
                  </div>
                </div>

                {/* Coming Soon Status Tag */}
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-200/80 dark:border-blue-800/80">
                  Coming Soon
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Apple App Store (iOS)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dedicated iOS & iPadOS native client preparing for Apple
                  TestFlight beta and public App Store launch.
                </p>
              </div>

              <div className="pt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                <span>TestFlight Closed Beta Preparation</span>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Step-by-Step Sideloading Walkthrough */}
        <section className="space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              How to Install Splitzy APK on Android
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Installing an APK takes less than 60 seconds on any Android phone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-mono font-bold text-sm">
                01
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Download the APK
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Tap the "Download Splitzy APK" button above or scan the QR code
                using your Android camera. Your browser will save the file to
                your Downloads folder.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-mono font-bold text-sm">
                02
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Allow Unknown Sources
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                When prompted by Android or Chrome, tap "Settings" and toggle
                "Allow from this source". This standard Android security step
                allows installing verified direct packages.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-mono font-bold text-sm">
                03
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Install
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Tap "Install" on the package dialog. Once finished, open
                Splitzy, create or join your household, and start managing bills
                and water attendance!
              </p>
            </div>
          </div>
        </section>

        {/* 7. Security Guarantee & Return CTA */}
        <div className="p-6 rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-500 shrink-0" />
            <div className="text-left">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Clean, Secure & Trusted
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Built with React Native Expo, Node.js & Python
              </p>
            </div>
          </div>

          <button
            onClick={onBackToHome}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
          >
            ← Return to Landing Page
          </button>
        </div>
      </main>

      {/* 8. Quiet Footer */}
      <footer className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          © {new Date().getFullYear()} Splitzy. Fair co-living expense
          splitting.
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={onOpenTerms}
            className="hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Terms of Service
          </button>
          <button
            onClick={onOpenPrivacy}
            className="hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Privacy Policy
          </button>
          <button
            onClick={onBackToHome}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Home
          </button>
        </div>
      </footer>
    </div>
  );
};
