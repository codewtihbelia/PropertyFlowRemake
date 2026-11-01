import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  ArrowLeft,
  FileText,
  Shield,
  Search,
  CheckCircle2,
  Printer,
  Copy,
  Check,
  Calendar,
  Lock,
  Calculator,
  Users,
  Receipt,
  HelpCircle,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useMobilePlatformSettings } from "@/services/platformSettingsService";

interface TermsOfServiceViewProps {
  onBack: () => void;
  onNavigateToPrivacy?: () => void;
}

interface Section {
  id: string;
  number: string;
  title: string;
  icon: React.ElementType;
  paragraphs: string[];
  keyHighlights?: string[];
}

const SECTIONS: Section[] = [
  {
    id: "acceptance",
    number: "01",
    title: "Acceptance & Household Formation",
    icon: Shield,
    paragraphs: [
      'By accessing or using the Splitzy platform, web portal, or mobile application (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not access or use the Service.',
      "To establish or administer a household group, you must be of legal age to form a binding contract in your jurisdiction. All profile information, including your full legal or preferred name, email address, and payment credentials, must be true, current, and complete.",
    ],
    keyHighlights: [
      "Binding agreement governing all household participants.",
      "Requires truthful registration and verified email accounts.",
    ],
  },
  {
    id: "scope-platform",
    number: "02",
    title: "Scope of Platform & Utility Coordination",
    icon: Building2,
    paragraphs: [
      "Splitzy operates as a digital ledger, mathematical split engine, and communication coordination tool designed for residential roommates, flatmates, and rental property managers.",
      "Important Notice on Financial Status: Splitzy is not a chartered bank, depository institution, or money services business. We do not hold client deposits, escrow funds, or directly transmit fiat currency between parties. All physical or electronic settlements occur peer-to-peer or via licensed third-party financial institutions (e.g., GCash, Maya, domestic bank wire, or cash).",
    ],
    keyHighlights: [
      "Splitzy calculates shares and maintains transparent ledgers.",
      "Roommates settle balances directly via their preferred payment channels.",
    ],
  },
  {
    id: "roles-responsibilities",
    number: "03",
    title: "Household Roles: Host & Payor Duties",
    icon: Users,
    paragraphs: [
      "Household Host Authority: The designated Host administers the household space. Hosts are responsible for inputting genuine utility invoices (electricity, water, broadband, gas), setting billing cycle dates, recording meter benchmarks, and verifying submitted payment receipts.",
      "Roommate / Payor Responsibilities: Payors are responsible for actively monitoring billing statements, verifying attendance records before cycle finalization, and submitting legitimate proof-of-payment receipts upon settling their balances.",
    ],
    keyHighlights: [
      "Hosts must upload genuine utility receipts and maintain fair accounting.",
      "Payors agree to timely payment and accurate absence submissions.",
    ],
  },
  {
    id: "centavo-algorithm",
    number: "04",
    title: "Exact Centavo Math Engine & Remainder Distribution",
    icon: Calculator,
    paragraphs: [
      "Floating-point rounding errors in standard software frequently cause fractional cent / centavo discrepancies that undermine trust among roommates. Splitzy implements a proprietary integer centavo billing engine.",
      "All monetary values are calculated in integer centavos (or smallest fractional currency units). Any non-divisible fractional centavos remaining after equal distribution are deterministically allocated according to a reproducible fairness rule, ensuring that the sum of all individual payor shares matches the total invoice with zero penny leakage.",
    ],
    keyHighlights: [
      "Zero floating-point rounding errors through integer centavo math.",
      "Completely deterministic remainder allocation algorithm.",
    ],
  },
  {
    id: "attendance-deductions",
    number: "05",
    title: "Attendance Logging & Vacation Adjustments",
    icon: Calendar,
    paragraphs: [
      "Variable Utility Adjustment: Invoices designated as usage-dependent (such as water, electric power, and cooking gas) may be adjusted based on active resident attendance.",
      "Absence Deadlines: Residents must record planned vacations or temporary absences prior to the Host locking and publishing the monthly billing cycle. Retroactive adjustments after statement publication require Host administrative consent.",
      "Fixed Expenses: Baseline costs such as monthly base rent, property management fees, or fiber internet remain equally distributed regardless of individual room vacancy unless explicitly modified in the household charter.",
    ],
    keyHighlights: [
      "Attendance adjustments apply strictly to variable utility categories.",
      "Absences must be logged before cycle statements are finalized.",
    ],
  },
  {
    id: "receipts-verification",
    number: "06",
    title: "Proof of Payment & Receipt Uploads",
    icon: Receipt,
    paragraphs: [
      "Settlement Documentation: Payors settle their obligations by uploading clear, legible transaction confirmation receipts or digital screenshots containing valid transaction IDs.",
      "Fraud Prevention: Uploading forged, tampered, duplicated, or deceptive receipts is grounds for immediate expulsion from the household group and permanent suspension of the user's account.",
      "Host Confirmation: Settlements remain in 'Pending Verification' status until the Host confirms receipt of funds in their external account.",
    ],
    keyHighlights: [
      "Uploaded receipts must reflect genuine, verifiable transactions.",
      "Host confirmation establishes final settlement clearance in the group ledger.",
    ],
  },
  {
    id: "data-cloud-integrity",
    number: "07",
    title: "Cloud Infrastructure & Document Storage",
    icon: Lock,
    paragraphs: [
      "Security Protocols: Splitzy maintains high-availability cloud database infrastructure via Google Firebase Firestore and media asset management via Cloudinary CDN, protected by TLS 256-bit encryption in transit and AES-256 encryption at rest.",
      "Audit Trail Permanence: To prevent financial disputes, historical transaction logs, payment approvals, and meter adjustment records remain immutable in household archives.",
    ],
  },
  {
    id: "disclaimers-liability",
    number: "08",
    title: "Limitation of Liability & Dispute Disclaimer",
    icon: HelpCircle,
    paragraphs: [
      "Good Faith Tool: Splitzy provides accounting and calculation tools in good faith. Splitzy is not a party to lease agreements between tenants and landlords, and does not act as guarantor, collection agency, or legal arbitrator.",
      "Limitation of Damages: To the maximum extent permitted by law, Splitzy shall not be liable for indirect, incidental, or consequential damages resulting from roommate disputes, lease defaults, or external banking outages.",
    ],
  },
  {
    id: "amendments-contact",
    number: "09",
    title: "Modifications, Governing Law & Support",
    icon: FileText,
    paragraphs: [
      "We reserve the right to revise these Terms to reflect legislative changes or new platform features. Notice of material modifications will be posted prominently in the user dashboard.",
      "For legal questions or household mediation inquiries, please contact our support team at legal@splitzy.app or support@splitzy.app.",
    ],
  },
];

export const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({
  onBack,
  onNavigateToPrivacy,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const settings = useMobilePlatformSettings();
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>("acceptance");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY < 60) {
        setIsVisible((prev) => (prev ? prev : true));
      } else if (delta > 8) {
        setIsVisible((prev) => (!prev ? prev : false));
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

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const filteredSections = SECTIONS.filter(
    (sec) =>
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.paragraphs.some((p) =>
        p.toLowerCase().includes(searchQuery.toLowerCase()),
      ) ||
      sec.keyHighlights?.some((h) =>
        h.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-600/20 selection:text-blue-900 dark:selection:text-blue-200 transition-colors">
      {/* 1. Floating Frosted Glass Capsule Bar matching Main Landing Navbar */}
      <header
        className={`fixed top-4 sm:top-6 inset-x-0 z-50 px-3 sm:px-6 pointer-events-none transition-all duration-500 ease-out ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-8 pointer-events-none"
        }`}
      >
        <div className="max-w-6xl mx-auto">
          <div
            className={`pointer-events-auto rounded-full px-5 sm:px-7 py-3 sm:py-3.5 min-h-[64px] sm:min-h-[70px] flex items-center justify-between gap-4 transition-all duration-300 ${
              isScrolled
                ? "bg-white/88 dark:bg-slate-900/88 backdrop-blur-2xl backdrop-saturate-150 border border-slate-200/50 dark:border-white/[0.08] shadow-[0_16px_40px_-10px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_16px_40px_-10px_rgba(0,0,0,0.55),0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "bg-white/82 dark:bg-slate-900/82 backdrop-blur-xl backdrop-saturate-150 border border-slate-200/40 dark:border-white/[0.06] shadow-[0_10px_30px_-6px_rgba(0,0,0,0.08),0_2px_10px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_10px_30px_-6px_rgba(0,0,0,0.45),0_2px_10px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]"
            }`}
          >
            {/* Left: Brand Logo & Wordmark */}
            <button
              onClick={onBack}
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
                  Terms of Service
                </span>
              </div>
            </button>

            {/* Center Navigation: Back to Home & Privacy Switch */}
            <div className="sm:flex hidden items-center gap-2">
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-[#2563EB] dark:hover:text-blue-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Home</span>
              </button>

              {onNavigateToPrivacy && (
                <button
                  onClick={onNavigateToPrivacy}
                  className="hidden md:inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-blue-400 px-3.5 py-1.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Privacy Policy</span>
                </button>
              )}
            </div>

            {/* Right: Theme Switcher & Actions */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
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

              <button
                onClick={handleCopyLink}
                title="Copy link to clipboard"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Copied
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>

              <button
                onClick={handlePrint}
                title="Print document"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 pb-12">
        {/* Document Header Banner */}
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 mb-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#2563EB] dark:text-blue-400 font-semibold mb-2">
                <FileText className="w-4 h-4" />
                <span>Standard Agreement</span>
                <span aria-hidden="true">·</span>
                <span>Version {settings.latestVersion}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Terms of Service
              </h1>
              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
                Rules, calculation transparency standards, and mutual
                responsibilities governing the Splitzy roommate bill management
                system.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span>Last Updated: September 28, 2026</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Status: Effective Immediately</span>
              </div>
            </div>
          </div>

          {/* Quick Search & Summary Callout */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clauses (e.g., centavo, attendance, receipts)..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-[#2563EB] dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 self-start sm:self-center">
              <span>{filteredSections.length} sections documented</span>
            </div>
          </div>
        </div>

        {/* Layout: Sidebar Navigation + Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sticky Table of Contents (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-28 sm:top-32 space-y-4">
            <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                Table of Contents
              </h3>
              <nav className="space-y-1">
                {SECTIONS.map((sec) => {
                  const isActive = activeSectionId === sec.id;
                  return (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      onClick={() => setActiveSectionId(sec.id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                        isActive
                          ? "bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/80"
                      }`}
                    >
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {sec.number}
                      </span>
                      <span className="truncate">{sec.title}</span>
                    </a>
                  );
                })}
              </nav>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Need support?</span>
                <a
                  href="mailto:support@splitzy.app"
                  className="text-[#2563EB] dark:text-blue-400 font-semibold hover:underline"
                >
                  support@splitzy.app
                </a>
              </div>
            </div>
          </aside>

          {/* Main Sections Column */}
          <div className="lg:col-span-8 space-y-6">
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              return (
                <section
                  key={sec.id}
                  id={sec.id}
                  className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs scroll-mt-24 transition-all"
                >
                  {/* Section Title Bar */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/50 flex items-center justify-center text-[#2563EB] dark:text-blue-400 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-mono font-bold text-[#2563EB] dark:text-blue-400 uppercase tracking-wider">
                        Section {sec.number}
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {sec.title}
                      </h2>
                    </div>
                  </div>

                  {/* Body Paragraphs */}
                  <div className="space-y-3 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                    {sec.paragraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>

                  {/* Highlights Box if available */}
                  {sec.keyHighlights && sec.keyHighlights.length > 0 && (
                    <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                        Core Principles:
                      </div>
                      <ul className="space-y-1.5">
                        {sec.keyHighlights.map((highlight, hIdx) => (
                          <li
                            key={hIdx}
                            className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })}

            {filteredSections.length === 0 && (
              <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
                <Search className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No matching sections found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Try searching with terms like "centavo", "host", "attendance",
                  or "receipt".
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 px-4 py-2 bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-300 font-bold text-xs rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
                >
                  Reset Search Filter
                </button>
              </div>
            )}

            {/* Bottom Acknowledgment & Contact Card */}
            <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md border border-slate-800 dark:border-slate-700/80">
              <div>
                <h3 className="text-lg font-bold">
                  Questions Regarding Our Terms?
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-md">
                  Our compliance and customer success team is available to
                  assist with room agreements and dispute policies.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href="mailto:support@splitzy.app"
                  className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shadow-xs cursor-pointer"
                >
                  Contact Support
                </a>
                <button
                  onClick={onBack}
                  className="px-4 py-2.5 rounded-xl bg-blue-900/80 hover:bg-blue-800 text-white font-bold text-xs border border-blue-700 transition cursor-pointer"
                >
                  Return to App
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 py-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            © {new Date().getFullYear()} Splitzy. Designed with ❤️ from Cebu.
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateToPrivacy}
              className="hover:text-[#2563EB] dark:hover:text-blue-400 transition cursor-pointer"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
