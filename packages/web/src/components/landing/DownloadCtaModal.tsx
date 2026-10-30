import React, { useState } from "react";
import {
  X,
  Download,
  Smartphone,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  FileCheck,
  Sparkles,
} from "lucide-react";

interface DownloadCtaModalProps {
  isOpen: boolean;
  onClose: () => void;
  githubReleaseUrl?: string;
}

export const DownloadCtaModal: React.FC<DownloadCtaModalProps> = ({
  isOpen,
  onClose,
  githubReleaseUrl = "https://github.com/Splitzy/Splitzy-Mobile/releases/latest",
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"qr" | "direct">("qr");

  if (!isOpen) return null;

  // Direct APK download link from GitHub releases
  const apkDownloadUrl = `${githubReleaseUrl.replace(/\/$/, "")}/download/Splitzy.apk`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(apkDownloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // SVG QR Code generator representation for phone camera scanning
  // Encodes the direct APK download URL
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    apkDownloadUrl,
  )}&color=0f172a&bgcolor=ffffff&margin=1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Get Splitzy for Android
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Release v2.9.5 · Verified Signed APK
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher: Scan Phone vs Direct Download */}
          <div className="flex items-center gap-1 mt-4 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              onClick={() => setActiveTab("qr")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "qr"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan with Phone</span>
            </button>
            <button
              onClick={() => setActiveTab("direct")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "direct"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Direct APK Download</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {activeTab === "qr" ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 shadow-inner">
                <img
                  src={qrSvgUrl}
                  alt="Scan QR code with your mobile camera to download Splitzy"
                  className="w-48 h-48 rounded-lg"
                  loading="lazy"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Point your phone's camera at the QR code
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                  Your device will automatically open the download link to install the Splitzy Android APK package.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                    <FileCheck className="w-4 h-4 text-emerald-500" />
                    <span>Splitzy-v2.9.5-release.apk</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">~48 MB</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Universal Android binary compatible with Android 8.0 (Oreo) and above. Includes full real-time WebRTC calling, Splitzy Wallet, and offline sync.
                </p>
                <a
                  href={apkDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download APK File Now</span>
                </a>
              </div>

              {/* Copy Direct Link */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={apkDownloadUrl}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Sideloading Quick Walkthrough */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              How to Install (3 Quick Steps)
            </h4>
            <div className="grid grid-cols-3 gap-2 text-left">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="inline-block text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mb-1">
                  Step 01
                </span>
                <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                  Tap download or scan to save the APK.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="inline-block text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mb-1">
                  Step 02
                </span>
                <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                  Allow "Install from Unknown Sources".
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="inline-block text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mb-1">
                  Step 03
                </span>
                <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                  Open Splitzy, sign up and invite roomies!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Open Source & VirusTotal Verified</span>
          </div>
          <a
            href={githubReleaseUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>GitHub Releases</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
