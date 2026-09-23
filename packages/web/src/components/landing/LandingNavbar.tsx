import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  Calculator,
  Smartphone,
  Sparkles,
  Menu,
  X,
  ArrowRight,
  ShieldCheck,
  LayoutDashboard,
  LogIn,
  LogOut,
  UserCheck,
  ChevronDown,
  Workflow,
  Users,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface LandingNavbarProps {
  onOpenApp: () => void;
  onOpenAuth?: (mode?: "signin" | "register") => void;
  onScrollTo: (sectionId: string) => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  onOpenApp,
  onOpenAuth,
  onScrollTo,
}) => {
  const { currentUser, isAuthenticated, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle outside click and Escape key for More dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(event.target as Node)
      ) {
        setMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const primaryNavItems = [
    { label: "Features", target: "features" },
    { label: "Split Calculator", target: "calculator" },
    { label: "Mobile App", target: "mobile-app" },
  ];

  const moreNavItems = [
    {
      label: "How It Works",
      target: "how-it-works",
      description: "4-step automated household split cycle",
      icon: Workflow,
      iconColor:
        "text-blue-600 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white",
    },
    {
      label: "Roles & Permissions",
      target: "roles",
      description: "Host dashboard vs Resident roommate experience",
      icon: Users,
      iconColor:
        "text-emerald-600 bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white",
    },
    {
      label: "FAQ",
      target: "faq",
      description: "Absence math, payments, and security policies",
      icon: HelpCircle,
      iconColor:
        "text-purple-600 bg-purple-50 group-hover:bg-purple-600 group-hover:text-white",
    },
  ];

  const handleNavClick = (target: string) => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
    onScrollTo(target);
  };

  const handleSignInClick = () => {
    if (onOpenAuth) {
      onOpenAuth("signin");
    } else {
      onOpenApp();
    }
  };

  const handleRegisterClick = () => {
    if (onOpenAuth) {
      onOpenAuth("register");
    } else {
      onOpenApp();
    }
  };

  return (
    <header
      id="landing-navbar"
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/80 py-3"
          : "bg-white/80 backdrop-blur-sm border-b border-slate-100 py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                Property<span className="text-brand-600">Flow</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                Splitzy
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium -mt-0.5 hidden xs:block">
              Roommate Bill & Attendance Platform
            </span>
          </div>
        </div>

        {/* Desktop Nav Items with Spacious Breathing Room */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-3">
          {primaryNavItems.map((item) => (
            <button
              key={item.target}
              onClick={() => handleNavClick(item.target)}
              className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {item.label}
            </button>
          ))}

          {/* "More" Dropdown Menu Container */}
          <div className="relative" ref={moreDropdownRef}>
            <button
              id="nav-more-dropdown-btn"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                moreMenuOpen
                  ? "text-brand-600 bg-brand-50 shadow-xs"
                  : "text-slate-600 hover:text-brand-600 hover:bg-slate-50"
              }`}
              aria-haspopup="true"
              aria-expanded={moreMenuOpen}
            >
              <span>More</span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  moreMenuOpen ? "rotate-180 text-brand-600" : ""
                }`}
              />
            </button>

            {/* Dropdown Panel */}
            {moreMenuOpen && (
              <div
                id="nav-more-dropdown-menu"
                className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Platform Sections
                </div>

                <div className="space-y-1">
                  {moreNavItems.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.target}
                        onClick={() => handleNavClick(item.target)}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 flex items-start gap-3 transition group cursor-pointer"
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${item.iconColor}`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-800 group-hover:text-brand-600 transition-colors">
                            {item.label}
                          </div>
                          <div className="text-xs text-slate-500 leading-snug">
                            {item.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Highlighted Interactive Simulator inside More Dropdown */}
                <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                  <button
                    onClick={() => handleNavClick("calculator")}
                    className="w-full p-2.5 rounded-xl bg-gradient-to-r from-brand-50 via-indigo-50/50 to-brand-50 hover:from-brand-100 hover:to-indigo-100/80 border border-brand-200/70 flex items-center justify-between transition group text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Calculator className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 group-hover:text-brand-700 flex items-center gap-1.5">
                          <span>Interactive Simulator</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-600 text-white leading-none">
                            Live
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          Centavo-accurate split preview
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-brand-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right CTA Actions (Desktop md+) */}
        <div className="hidden md:flex items-center gap-2.5 lg:gap-3 shrink-0">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                <div className="w-5 h-5 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-[10px]">
                  {currentUser.displayName?.charAt(0) || "U"}
                </div>
                <span className="font-semibold text-slate-800 max-w-[110px] truncate">
                  {currentUser.displayName || "Resident"}
                </span>
              </div>

              <button
                id="nav-portal-btn"
                onClick={onOpenApp}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-all hover:shadow hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => signOut()}
                title="Sign Out"
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                id="nav-signin-btn"
                onClick={handleSignInClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold text-slate-700 hover:text-brand-600 transition cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-4 h-4 text-slate-500" />
                <span>Sign In</span>
              </button>

              <button
                id="nav-register-btn"
                onClick={handleRegisterClick}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all hover:shadow hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-brand-400" />
                <span>Get Started</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile & Tablet Header Controls (< md) */}
        <div className="flex md:hidden items-center gap-2">
          {isAuthenticated ? (
            <button
              onClick={onOpenApp}
              className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs flex items-center gap-1.5"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
          ) : (
            <button
              onClick={handleSignInClick}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5 text-brand-400" />
              <span>Sign In</span>
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200/80 transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Drawer Menu (< md) */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/98 backdrop-blur-md border-b border-slate-200 px-4 pt-3 pb-6 space-y-4 shadow-xl animate-fadeIn">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
              Core Pages
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
              {primaryNavItems.map((item) => (
                <button
                  key={item.target}
                  onClick={() => handleNavClick(item.target)}
                  className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-brand-50 hover:text-brand-700 rounded-xl transition-colors flex items-center justify-between"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
              More Platform Tools
            </div>
            <div className="space-y-1">
              {moreNavItems.map((item) => (
                <button
                  key={item.target}
                  onClick={() => handleNavClick(item.target)}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700 rounded-xl transition-colors flex items-center justify-between"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
            <button
              onClick={() => handleNavClick("calculator")}
              className="w-full py-3 px-4 text-sm font-semibold text-center text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl border border-brand-200 flex items-center justify-center gap-2"
            >
              <Calculator className="w-4 h-4 text-brand-600" />
              <span>Interactive Split Calculator</span>
            </button>

            {isAuthenticated ? (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenApp();
                  }}
                  className="w-full py-3 px-4 text-sm font-bold text-center text-white bg-brand-600 hover:bg-brand-700 rounded-xl flex items-center justify-center gap-2 shadow-sm"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Open Application Dashboard</span>
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-center text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>
                    Sign Out ({currentUser.displayName || "Resident"})
                  </span>
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignInClick();
                  }}
                  className="py-2.5 px-3 text-sm font-bold text-center text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleRegisterClick();
                  }}
                  className="py-2.5 px-3 text-sm font-bold text-center text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center justify-center gap-2 shadow-sm"
                >
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  <span>Get Started</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
