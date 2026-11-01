import React, { useState, useEffect } from "react";
import { Rocket, Download, Menu, X, Sun, Moon, Home } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

interface LandingNavbarProps {
  onOpenDownloadModal: () => void;
  onScrollTo: (sectionId: string) => void;
  currentLang?: "EN" | "TL";
  onToggleLang?: (lang: "EN" | "TL") => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  onOpenDownloadModal,
  onScrollTo,
  currentLang = "EN",
  onToggleLang,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [selectedLang, setSelectedLang] = useState<"EN" | "TL">(currentLang);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = React.useRef(0);

  // Monitor scroll position to highlight active section and track scroll direction
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      // Active section highlight
      const sections = [
        "overview",
        "features",
        "showcase",
        "guides",
        "about",
        "faq",
      ];
      const scrollY = currentScrollY + 160;

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollY) {
          const targetSection = sections[i];
          setActiveSection((prev) =>
            prev === targetSection ? prev : targetSection,
          );
          break;
        }
      }

      // Smooth hide on scroll-down, reveal on scroll-up
      if (currentScrollY < 60) {
        setIsVisible((prev) => (prev ? prev : true));
      } else if (delta > 8) {
        setIsVisible((prev) => (!prev ? prev : false));
        setMobileMenuOpen(false);
      } else if (delta < -8) {
        setIsVisible((prev) => (prev ? prev : true));
      }

      lastScrollYRef.current = currentScrollY;
      setIsScrolled((prev) => {
        const next = currentScrollY > 20;
        return prev === next ? prev : next;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Home", target: "overview" },
    { label: "Features", target: "features" },
    { label: "Showcase", target: "showcase" },
    { label: "Guides", target: "guides" },
    { label: "About", target: "about" },
    { label: "FAQ", target: "faq" },
  ];

  const handleNavClick = (target: string) => {
    setActiveSection(target);
    setMobileMenuOpen(false);
    onScrollTo(target);
  };

  const handleLangToggle = (lang: "EN" | "TL") => {
    setSelectedLang(lang);
    if (onToggleLang) {
      onToggleLang(lang);
    }
  };

  return (
    <header
      className={`fixed top-4 sm:top-6 inset-x-0 z-50 px-3 sm:px-6 pointer-events-none transition-all duration-500 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-8 pointer-events-none"
      }`}
    >
      <div className="max-w-6xl mx-auto">
        {/* Floating Frosted Glass Capsule Bar with comfortable height and softened border */}
        <div
          className={`pointer-events-auto rounded-full px-5 sm:px-7 py-3 sm:py-3.5 min-h-[64px] sm:min-h-[70px] flex items-center justify-between gap-4 transition-all duration-300 ${
            isScrolled
              ? "bg-white/88 dark:bg-slate-900/88 backdrop-blur-2xl backdrop-saturate-150 border border-slate-200/50 dark:border-white/[0.08] shadow-[0_16px_40px_-10px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_16px_40px_-10px_rgba(0,0,0,0.55),0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]"
              : "bg-white/82 dark:bg-slate-900/82 backdrop-blur-xl backdrop-saturate-150 border border-slate-200/40 dark:border-white/[0.06] shadow-[0_10px_30px_-6px_rgba(0,0,0,0.08),0_2px_10px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_10px_30px_-6px_rgba(0,0,0,0.45),0_2px_10px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]"
          }`}
        >
          {/* Left: Brand Logo & Icon Mark styled with #2563EB blue theme */}
          <button
            onClick={() => handleNavClick("overview")}
            className="flex items-center gap-1 text-left cursor-pointer focus:outline-hidden group"
          >
            {/* Custom stylized house emblem with Splitzy #2563EB palette */}
            <div className="rounded-xl p-1.5 flex flex-col justify-end items-center relative overflow-hidden shadow-xs">
              <img
                src="/favicon.png"
                alt="Splitzy Logo"
                className="w-10 h-10 sm:w-11 sm:h-11 object-contain"
              />
            </div>

            <div className="sm:flex flex-col hidden">
              <div className="flex flex-row">
                <span className="text-base sm:text-lg font-black tracking-tight text-[#1b2b3f] dark:text-white leading-none">
                  SPLIT
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight text-[#2563EB] leading-none">
                  ZY
                </span>
              </div>
              <span className="text-[8px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider leading-tight mt-0.5">
                Better Living
              </span>
            </div>
          </button>

          {/* Center: Frosted navigation links with crisp contrast */}
          <nav className="hidden lg:flex items-center gap-2 xl:gap-3 text-sm font-semibold">
            {navLinks.map((link) => {
              const isActive = activeSection === link.target;
              return (
                <button
                  key={link.target}
                  onClick={() => handleNavClick(link.target)}
                  className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "text-[#2563EB] dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/70 shadow-2xs"
                      : "text-slate-800 dark:text-slate-200 hover:text-[#2563EB] dark:hover:text-blue-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Right: Language Pill, Theme Switcher & Floating #2563EB Download APK Button */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Dark/Light mode toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Primary Download APK Pill Button with #2563EB theme */}
            <button
              onClick={onOpenDownloadModal}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1d4ed8] active:bg-[#1e40af] rounded-full shadow-[0_6px_20px_-4px_rgba(37,99,235,0.45)] hover:shadow-[0_8px_24px_-4px_rgba(37,99,235,0.55)] transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Download APK</span>
            </button>

            {/* Mobile Hamburger toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Frosted Glass Card */}
        {mobileMenuOpen && (
          <div className="pointer-events-auto mt-2 p-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl backdrop-saturate-150 rounded-3xl border border-white/70 dark:border-white/10 shadow-[0_24px_50px_-10px_rgba(0,0,0,0.22),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_24px_50px_-10px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.12)] space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="grid grid-cols-2 gap-2">
              {navLinks.map((link) => {
                const isActive = activeSection === link.target;
                return (
                  <button
                    key={link.target}
                    onClick={() => handleNavClick(link.target)}
                    className={`text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 font-bold"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Theme:
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {isDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>White / Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-blue-500" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            </div>

            {/* <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Language / Wika:
              </span>
              <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                <button
                  onClick={() => handleLangToggle("EN")}
                  className={`px-3 py-1 rounded-full ${
                    selectedLang === "EN"
                      ? "bg-[#1E3048] text-white"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => handleLangToggle("TL")}
                  className={`px-3 py-1 rounded-full ${
                    selectedLang === "TL"
                      ? "bg-[#1E3048] text-white"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  TL
                </button>
              </div>
            </div> */}

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenDownloadModal();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold text-sm shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Download Splitzy APK</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
