import React from "react";
import { ArrowUp, Github, Heart, ShieldCheck } from "lucide-react";
import { useMobilePlatformSettings } from "../../services/platformSettingsService";

interface LandingFooterProps {
  onScrollTo: (id: string) => void;
  onOpenDownloadModal?: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onScrollTo,
  onOpenDownloadModal,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  const settings = useMobilePlatformSettings();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-slate-100/80 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-sm border-t border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          {/* Col 1: Brand & Tagline */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight">
              <img
                src="../../favicon.png"
                alt="Splitzy Logo"
                className="w-10 h-10"
              />
              <div className="flex flex-row">
                <span className="text-slate-900 dark:text-white">Split</span>
                <span className="text-[#2563EB]">zy</span>
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed max-w-sm">
              The smart co-living finance app for roommates, dormers, and
              apartment hosts in the Philippines. Fair water attendance, exact
              centavo splitting, and digital wallet settlements.
            </p>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-500 pt-1">
              <span>Android Build v{settings.latestVersion}</span>
              <span aria-hidden="true">·</span>
              <span>Open Source</span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Explore Splitzy
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onScrollTo("overview")}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Overview
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("showcase")}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Interactive 3D Showcase
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("features")}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Core Features
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("guides")}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Co-Living Guides
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("about")}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Our Story & Mission
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("faq")}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Frequently Asked Questions
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Co-Living Guides */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Featured Guides
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onScrollTo("guides")}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors text-left cursor-pointer"
                >
                  The Roommate Vacation Equation
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("guides")}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors text-left cursor-pointer"
                >
                  Demystifying Electric Sub-Meters
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("guides")}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors text-left cursor-pointer"
                >
                  Eliminating "I'll Pay You Later"
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollTo("why-splitzy")}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors text-left cursor-pointer"
                >
                  Common Roommate Dilemmas
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Download & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Distribution & Legal
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={onOpenDownloadModal}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Download Android APK</span>
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/Splitzy/Splitzy-Mobile"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </li>
              {onOpenPrivacy && (
                <li>
                  <button
                    onClick={onOpenPrivacy}
                    className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
              )}
              {onOpenTerms && (
                <li>
                  <button
                    onClick={onOpenTerms}
                    className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Terms of Service
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-10 mt-10 border-t border-slate-200 dark:border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} Splitzy. Designed for harmonious
            co-living in the Philippines.
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={scrollToTop}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              <span>Back to top</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
