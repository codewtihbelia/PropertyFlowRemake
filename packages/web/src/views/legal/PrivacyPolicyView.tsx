import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  ArrowLeft,
  Shield,
  Search,
  CheckCircle2,
  Printer,
  Copy,
  Check,
  Calendar,
  Lock,
  FileText,
  Eye,
  Server,
  UserCheck,
  Trash2,
  Database,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

interface PrivacyPolicyViewProps {
  onBack: () => void;
  onNavigateToTerms?: () => void;
}

interface Section {
  id: string;
  number: string;
  title: string;
  icon: React.ElementType;
  paragraphs: string[];
  keyHighlights?: string[];
}

const PRIVACY_SECTIONS: Section[] = [
  {
    id: "commitment",
    number: "01",
    title: "Our Privacy Pledge & Core Principles",
    icon: Shield,
    paragraphs: [
      "At Splitzy, we understand that household living arrangements and utility bills involve sensitive personal and financial data. We operate under a strict privacy-first principle: we will never monetize, sell, trade, or lease your personal records, billing statements, or payment proofs to third-party advertising networks or commercial data brokers.",
      "This Privacy Policy outlines the specific data categories we collect, our lawful bases for processing, how your data is protected through isolated cloud boundaries, and your rights to inspect, export, or permanently erase your data.",
    ],
    keyHighlights: [
      "Zero commercial data selling: Your records are never monetized.",
      "Strict data isolation: Household records are walled from other users.",
    ],
  },
  {
    id: "information-collected",
    number: "02",
    title: "Categories of Information We Collect",
    icon: Database,
    paragraphs: [
      "We collect only the minimal data strictly necessary to calculate and reconcile roommate expenses:",
      "1. Account Credentials: Full name, verified email address, optional contact telephone number, and profile picture avatar. Passwords are cryptographically salted and hashed via Google Firebase Authentication.",
      "2. Household Operations: Group title, room and unit identifiers, invite secret tokens, member lists, and role assignments (Host, Roommate/Payor, Super Admin).",
      "3. Utility Bills & Receipts: Invoice amounts, utility providers (power, water, internet, gas), invoice issue and due dates, meter reading photographs, and payment proof screenshots.",
      "4. Attendance Records: Check-in timestamps, recorded vacation periods, and absence logs used exclusively for utility subtraction calculations.",
      "5. Technical Diagnostics: Device types, operating systems, and push notification tokens (Expo Push Services) to deliver urgent bill notices.",
    ],
    keyHighlights: [
      "Collection is strictly restricted to operational necessity.",
      "All authentication credentials are encrypted using industry standards.",
    ],
  },
  {
    id: "processing-purposes",
    number: "03",
    title: "How We Process & Use Your Data",
    icon: Server,
    paragraphs: [
      "Every piece of data collected is processed strictly for functional household management:",
      "• Mathematical Allocation: Executing the exact integer centavo math engine to apportion utility invoices according to active group rules.",
      "• Attendance-Based Reductions: Calculating day-by-day fractional shares so residents who were away on documented vacation do not pay for shared variable utilities.",
      "• Ledger Audit Trails: Maintaining transparent, timestamped logs showing who submitted an expense, who settled their share, and who confirmed the payment.",
      "• Notification Delivery: Alerting roommates of newly posted invoices, upcoming payment deadlines, and confirmed settlements.",
    ],
  },
  {
    id: "boundary-isolation",
    number: "04",
    title: "Household Boundary Isolation",
    icon: Lock,
    paragraphs: [
      "Your household's financial ledger is completely isolated behind authenticated security rules. Only registered roommates who have entered your specific household invite code and been authorized can see your bills, payment statuses, and vacation dates.",
      "Users belonging to other households, landlords of other properties, or anonymous visitors cannot query, view, or search any part of your private household transactions.",
    ],
    keyHighlights: [
      "Granular Firestore security rules restrict cross-household reads.",
      "No public directory or indexation of your household financial data.",
    ],
  },
  {
    id: "security-measures",
    number: "05",
    title: "Cloud Infrastructure & Security Architecture",
    icon: Eye,
    paragraphs: [
      "We employ state-of-the-art cloud security controls to ensure data integrity:",
      "• Transit Encryption: All network communication is encrypted with TLS 1.3 / HTTPS with modern cipher suites.",
      "• Storage Encryption: Database documents and uploaded media files are encrypted at rest using AES-256 via Google Cloud and Cloudinary CDN.",
      "• Role-Based Access Control (RBAC): Server-side security rules validate that only authorized group hosts can approve payments or alter billing cycle dates.",
    ],
    keyHighlights: [
      "TLS 1.3 encryption in transit and AES-256 encryption at rest.",
      "Server-enforced role access controls on all database collections.",
    ],
  },
  {
    id: "user-rights",
    number: "06",
    title: "Your Rights: Access, Export & Erasure (GDPR & CCPA)",
    icon: UserCheck,
    paragraphs: [
      "Regardless of your location, Splitzy grants you comprehensive data privacy rights:",
      "• Right of Access & Portability: You may view your complete billing and payment history at any time and export your records in standard formats.",
      "• Right of Rectification: You may correct your profile information, contact email, and phone number directly within Settings.",
      "• Right of Erasure: You may request complete deletion of your account. Personal identifiers are removed from our active systems. Anonymized transaction line items remain in household archives solely to preserve the integrity of past reconciled tax and roommate balances.",
    ],
    keyHighlights: [
      "Full data portability for tax and rental accounting records.",
      "Complete account erasure workflow respecting accounting ledger rules.",
    ],
  },
  {
    id: "third-parties",
    number: "07",
    title: "Third-Party Service Providers (Subprocessors)",
    icon: Building2,
    paragraphs: [
      "We partner only with industry-leading infrastructure providers that maintain SOC 2, ISO 27001, and GDPR compliance:",
      "• Google Cloud & Firebase: Cloud database (Firestore), user authentication, and web hosting.",
      "• Cloudinary Ltd.: Encrypted cloud storage and optimized image delivery for meter photos and payment receipts.",
      "• Expo / Apple Push Notification Services (APNs): Real-time delivery of bill reminder alerts.",
    ],
  },
  {
    id: "cookies-retention",
    number: "08",
    title: "Cookies & Local Storage",
    icon: FileText,
    paragraphs: [
      "Splitzy uses only essential, functional cookies and browser local storage to maintain your authenticated login session and local dashboard UI preferences (such as collapsed sidebar states and active household selection).",
      "We do not employ third-party tracking pixels, cross-site behavioral cookies, or affiliate marketing trackers.",
    ],
  },
  {
    id: "contact-dpo",
    number: "09",
    title: "Contact Our Data Protection Officer",
    icon: Trash2,
    paragraphs: [
      "If you have questions regarding this Privacy Policy, wish to report a security vulnerability, or seek to exercise your legal data privacy rights, please contact our Data Protection Officer at privacy@splitzy.app.",
      "All inquiries are investigated and answered within thirty (30) calendar days.",
    ],
  },
];

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({
  onBack,
  onNavigateToTerms,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>("commitment");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
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

  const filteredSections = PRIVACY_SECTIONS.filter(
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-600/20 selection:text-emerald-900 transition-colors">
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
                  Privacy Policy
                </span>
              </div>
            </button>

            {/* Center Navigation: Back to Home & Terms Switch */}
            <div className="sm:flex hidden items-center gap-2">
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Home</span>
              </button>

              {onNavigateToTerms && (
                <button
                  onClick={onNavigateToTerms}
                  className="hidden md:inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 px-3.5 py-1.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Terms of Service</span>
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 mb-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mb-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>Data Protection Commitment</span>
                <span aria-hidden="true">·</span>
                <span>GDPR & CCPA Compliant</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-slate-600 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
                Clear disclosure of how your roommate financial data, utility
                invoices, and attendance logs are secured and maintained.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Last Updated: September 28, 2026</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Security: Isolated Cloud Storage</span>
              </div>
            </div>
          </div>

          {/* Quick Search */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search privacy topics (e.g., receipts, deletion, cookies)..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 self-start sm:self-center">
              <span>{filteredSections.length} privacy clauses verified</span>
            </div>
          </div>
        </div>

        {/* Layout: Sidebar Navigation + Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sticky Table of Contents (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-28 sm:top-32 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                Privacy Topics
              </h3>
              <nav className="space-y-1">
                {PRIVACY_SECTIONS.map((sec) => {
                  const isActive = activeSectionId === sec.id;
                  return (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      onClick={() => setActiveSectionId(sec.id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                        isActive
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
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

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Privacy Officer:</span>
                <a
                  href="mailto:privacy@splitzy.app"
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  privacy@splitzy.app
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
                  className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs scroll-mt-24 transition-all"
                >
                  {/* Section Title Bar */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-mono font-bold text-emerald-700 uppercase tracking-wider">
                        Topic {sec.number}
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                        {sec.title}
                      </h2>
                    </div>
                  </div>

                  {/* Body Paragraphs */}
                  <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                    {sec.paragraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>

                  {/* Highlights Box if available */}
                  {sec.keyHighlights && sec.keyHighlights.length > 0 && (
                    <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Privacy Guarantees:
                      </div>
                      <ul className="space-y-1.5">
                        {sec.keyHighlights.map((highlight, hIdx) => (
                          <li
                            key={hIdx}
                            className="flex items-start gap-2 text-xs text-slate-700 font-medium"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <Search className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900">
                  No matching privacy topics found
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Try searching with keywords like "retention", "export",
                  "security", or "cloud".
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 px-4 py-2 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl hover:bg-emerald-100 transition cursor-pointer"
                >
                  Reset Search Filter
                </button>
              </div>
            )}

            {/* Bottom Contact Card */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
              <div>
                <h3 className="text-lg font-bold">
                  Have Specific Data Concerns?
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-md">
                  Our Data Protection Officer handles privacy verification,
                  erasure requests, and ledger export support.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href="mailto:privacy@splitzy.app"
                  className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shadow-xs cursor-pointer"
                >
                  Email Privacy Officer
                </a>
                <button
                  onClick={onBack}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition cursor-pointer"
                >
                  Return to App
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            © {new Date().getFullYear()} PropertyFlow (Splitzy). All rights
            reserved.
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateToTerms}
              className="hover:text-emerald-700 transition cursor-pointer"
            >
              Terms of Service
            </button>
            <span aria-hidden="true">·</span>
            <span>Zero Third-Party Data Sales</span>
            <span aria-hidden="true">·</span>
            <span>Encrypted Cloud Storage</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
