import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Smartphone,
  Sun,
  Moon,
  Home,
  Receipt,
  Droplets,
  Wallet,
  Repeat,
  Users,
  MessageCircle,
  Settings,
  CheckCircle2,
  Download,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { useMobilePlatformSettings } from "../../services/platformSettingsService";

import { useTheme } from "../../contexts/ThemeContext";

interface MobileAppShowcaseProps {
  onOpenDownloadModal: () => void;
}

type ScreenCategory =
  | "home"
  | "bills"
  | "attendance"
  | "wallet"
  | "subscriptions"
  | "community"
  | "messages"
  | "profile";

export const MobileAppShowcase: React.FC<MobileAppShowcaseProps> = ({
  onOpenDownloadModal,
}) => {
  const { isDark } = useTheme();
  const [deviceTheme, setDeviceTheme] = useState<"dark" | "light">(() =>
    isDark ? "dark" : "light",
  );
  const settings = useMobilePlatformSettings();
  const [activeScreen, setActiveScreen] = useState<ScreenCategory>("home");

  // Sync mobile device preview theme when page theme flips
  useEffect(() => {
    setDeviceTheme((prev) => {
      const target = isDark ? "dark" : "light";
      return prev === target ? prev : target;
    });
  }, [isDark]);

  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    if (!tabsRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
    // Allow small 2px threshold for rounding
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [checkScroll]);

  const scrollTabs = (direction: "left" | "right") => {
    if (!tabsRef.current) return;
    const scrollAmount = 260;
    tabsRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    // Check state shortly after initiating smooth scroll
    setTimeout(checkScroll, 150);
    setTimeout(checkScroll, 350);
  };

  const handleSelectTab = (
    key: ScreenCategory,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    setActiveScreen(key);
    e.currentTarget.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
    setTimeout(checkScroll, 350);
  };

  const screensConfig: Record<
    ScreenCategory,
    {
      id: ScreenCategory;
      label: string;
      shortTitle: string;
      icon: React.ElementType;
      tagline: string;
      darkImg: string;
      lightImg: string;
      humanProblem: string;
      splitzySolution: string;
      keyHighlights: string[];
    }
  > = {
    home: {
      id: "home",
      label: "Home Hub",
      shortTitle: "Splitzy Dashboard",
      icon: Home,
      tagline:
        "Your active billing cycle, groups, wallet balance & quick actions at a glance.",
      darkImg: "/assets/HomeScreenDark.png",
      lightImg: "/assets/HomeScreenLight.png",
      humanProblem:
        "Roommates never know what the current running total is until the electric bill arrives in the door.",
      splitzySolution:
        "Real-time overview of the active cycle, upcoming dues, recent updates, and roommate group cards in one glance.",
      keyHighlights: [
        "Live Splitzy Wallet balance indicator with fast Cash In access",
        "Recent updates feed showing exactly who added what bill and your share",
        "One-tap 'Settle Now' shortcut without calculating or switching apps",
        "Household group avatars with active member count and total expenses",
      ],
    },
    bills: {
      id: "bills",
      label: "Bills & Dues",
      shortTitle: "Bills Screen",
      icon: Receipt,
      tagline:
        "No more guessing. Just fair, accurate splits down to the last centavo.",
      darkImg: "/assets/BillsScreenDark.png",
      lightImg: "/assets/BillsScreenLight.png",
      humanProblem:
        "Splitting ₱8,319.24 across 3 roommates leads to rounding disputes, awkward reminders, and lost receipts.",
      splitzySolution:
        "Itemizes every utility (Electricity, Wi-Fi, Rent, Water Attendance) with fair remainder allocation.",
      keyHighlights: [
        "Total Remaining Due card clearly stating total household vs your share",
        "Individual itemized charges showing who added it and settlement count",
        "Centavo-accurate floor division with fair remainder allocation (e.g. ₱266.67)",
        "Direct 'Pay with GCash / Bank' one-tap checkout",
      ],
    },
    attendance: {
      id: "attendance",
      label: "Water Attendance",
      shortTitle: "Attendance Screen",
      icon: Droplets,
      tagline:
        "Never pay for water when you were on vacation or visiting family.",
      darkImg: "/assets/AttendanceScreenDark.png",
      lightImg: "/assets/AttendanceScreenLight.png",
      humanProblem:
        "Why should a roommate who spent 2 weeks visiting home pay the same water utility as someone who was home every day?",
      splitzySolution:
        "Interactive calendar tracking exact days present vs absent, automatically computing fair daily water rates.",
      keyHighlights: [
        "Interactive monthly calendar with tap-to-toggle presence days",
        "Transparent billing rate (e.g. ₱5.66 / day / person)",
        "Automatic calculation: 14 days present vs 17 absent = exact ₱79.24 due",
        "Attendance lock mechanism once host finalizes billing to prevent disputes",
      ],
    },
    wallet: {
      id: "wallet",
      label: "Digital Wallet",
      shortTitle: "Integrated Wallet & Cards",
      icon: Wallet,
      tagline:
        "Personal funds, simulated everyday expenses, and Philippine bank cards.",
      darkImg: "/assets/WalletScreenDark.png",
      lightImg: "/assets/WalletScreenLight.png",
      humanProblem:
        "Transferring funds between banking apps and asking for screenshots creates friction and distrust.",
      splitzySolution:
        "Built-in digital wallet holding available balances, linked GCash/Maya cards, and simulated daily expense circles.",
      keyHighlights: [
        "Available Balance card with instant Cash In, Pay, and Settle controls",
        "Quick Actions: Send, Split, Internal Transfer, and QR Code scanner",
        "Quick Everyday Expense presets (Coffee ₱150, Lunch ₱220, Commute ₱65)",
        "Integrated Philippine card management with GCash, Maya & local bank support",
      ],
    },
    subscriptions: {
      id: "subscriptions",
      label: "Subscriptions & IOUs",
      shortTitle: "Recurring & Debts Tracker",
      icon: Repeat,
      tagline:
        "Track Netflix, Spotify, shared Wi-Fi, and informal roommate loans.",
      darkImg: "/assets/WalletScreenSubscriptionDark.png",
      lightImg: "/assets/WalletScreenSubscriptionLight.png",
      humanProblem:
        "'Can you pay for the takeout, I'll pay you back tomorrow' — and then it's forgotten forever.",
      splitzySolution:
        "Double-entry IOU ledger tracking 'I Owe' vs 'Owed to Me' with 1-tap settlement and subscription monitors.",
      keyHighlights: [
        "Dedicated Subscriptions hub for Netflix, Spotify, ChatGPT, and cloud tools",
        "Visual Debts & IOUs cards with color-coded liability indicators",
        "One-tap debt settlement that credits the payee and updates ledger instantly",
        "Positive 'You don't owe anyone!' zero-state encouragement",
      ],
    },
    community: {
      id: "community",
      label: "Community & Reels",
      shortTitle: "Feed, Reels & People",
      icon: Users,
      tagline:
        "Short video reels, house announcements, and roommate tips in one feed.",
      darkImg: "/assets/CommunityScreenDark.png",
      lightImg: "/assets/CommunityScreenLight.png",
      humanProblem:
        "Important apartment notices get drowned out in cluttered WhatsApp or Messenger group chats.",
      splitzySolution:
        "Dedicated social feed with categories for General Chat, Roomie Life Hacks, and vertical video reels.",
      keyHighlights: [
        "Community feed categorized by topics (General Chat, Roomie Life Hacks)",
        "Integrated video reels showcasing co-living clips and cooking tips",
        "Reactions, comments, and member recognition badges",
        "Quick post creation modal for house announcements",
      ],
    },
    messages: {
      id: "messages",
      label: "Roomie Messenger",
      shortTitle: "Encrypted Chat & Calls",
      icon: MessageCircle,
      tagline:
        "Direct messaging, voice calls, and video calls built right into the app.",
      darkImg: "/assets/MessagesScreenDark.png",
      lightImg: "/assets/MessagesScreenLight.png",
      humanProblem:
        "Mixing personal social media with apartment bills and maintenance requests feels intrusive.",
      splitzySolution:
        "In-app peer-to-peer messaging with WebRTC voice and video calling, keeping co-living communication organized.",
      keyHighlights: [
        "Real-time direct messaging with presence status (e.g. Active 23h ago)",
        "One-tap voice and video calling without sharing personal phone numbers",
        "Slide-to-reply and Messenger-grade floating emoji reactions",
        "Clean, minimalist layout in both dark obsidian and light modes",
      ],
    },
    profile: {
      id: "profile",
      label: "Profile & Settings",
      shortTitle: "Settings",
      icon: Settings,
      tagline:
        "Manage your personal credentials, payment methods, and host controls.",
      darkImg: "/assets/SettingsScreenDark.png",
      lightImg: "/assets/SettingsScreenLight.png",
      humanProblem:
        "Users don't know where their payment proof goes or how to adjust their personal details.",
      splitzySolution:
        "Clear profile hub showing settlement percentage (47%), active groups, linked cards, and security PIN setup.",
      keyHighlights: [
        "Settlement statistics card: Groups Active, Total Paid, and % Settled",
        "Direct link to public Community Profile & roomie posts",
        "Payment Methods manager for linked Visa, GCash & Maya accounts",
        "Fast switch between Dark Mode and Light Mode with instant preview",
      ],
    },
  };

  const current = screensConfig[activeScreen];
  const activeImage =
    deviceTheme === "dark" ? current.darkImg : current.lightImg;

  return (
    <section
      id="showcase"
      className="py-20 md:py-28 bg-slate-100/70 dark:bg-slate-900 text-slate-900 dark:text-white relative overflow-hidden transition-colors border-b border-slate-200/80 dark:border-slate-800"
    >
      {/* Decorative Atmospheric Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-blue-600/5 dark:bg-blue-600/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Come On In and Explore. <br />
            <span className="text-blue-600 dark:text-blue-400">
              Flip Themes & Switch Screens.
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
            Take a look inside Splitzy! Explore real app screens, switch between
            Light and Dark mode, and see how everything works.
          </p>
        </div>

        {/* Global Showcase Toolbar: Theme Flip & Category Tabs */}
        <div className="flex flex-col items-center gap-6 mb-12">
          {/* Theme Toggle Pill */}
          <div className="inline-flex items-center p-1 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-md">
            <button
              onClick={() => setDeviceTheme("dark")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                deviceTheme === "dark"
                  ? "bg-slate-900 text-white shadow-md border border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Moon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <span>Dark Theme</span>
            </button>
            <button
              onClick={() => setDeviceTheme("light")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                deviceTheme === "light"
                  ? "bg-white text-slate-900 shadow-md border border-slate-300"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Light Theme</span>
            </button>
          </div>

          {/* Horizontal Scrollable Tabs with Chevron Controls */}
          <div className="w-full max-w-5xl relative flex items-center justify-center px-1">
            {/* Left Chevron Button */}
            <button
              type="button"
              onClick={() => scrollTabs("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll tabs left"
              className={`shrink-0 z-10 w-9 h-9 mr-1.5 sm:mr-2 rounded-xl flex items-center justify-center transition-all duration-200 ${
                canScrollLeft
                  ? "bg-white dark:bg-slate-800/95 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 shadow-md shadow-black/5 dark:shadow-black/20 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                  : "bg-slate-100 dark:bg-slate-800/30 text-slate-400 dark:text-slate-600 border border-slate-200/60 dark:border-slate-800/40 cursor-not-allowed opacity-30 pointer-events-none"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Scrollable Tabs Wrapper */}
            <div
              ref={tabsRef}
              onScroll={checkScroll}
              className="flex-1 overflow-x-auto py-1.5 no-scrollbar scroll-smooth select-none min-w-0"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <div className="flex items-center gap-2 w-max mx-auto px-1">
                {(Object.keys(screensConfig) as ScreenCategory[]).map((key) => {
                  const item = screensConfig[key];
                  const Icon = item.icon;
                  const isActive = activeScreen === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => handleSelectTab(key, e)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]"
                          : "bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/50 shadow-2xs"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Chevron Button */}
            <button
              type="button"
              onClick={() => scrollTabs("right")}
              disabled={!canScrollRight}
              aria-label="Scroll tabs right"
              className={`shrink-0 z-10 w-9 h-9 ml-1.5 sm:mr-2 rounded-xl flex items-center justify-center transition-all duration-200 ${
                canScrollRight
                  ? "bg-white dark:bg-slate-800/95 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 shadow-md shadow-black/5 dark:shadow-black/20 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                  : "bg-slate-100 dark:bg-slate-800/30 text-slate-400 dark:text-slate-600 border border-slate-200/60 dark:border-slate-800/40 cursor-not-allowed opacity-30 pointer-events-none"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2-Column Split: Interactive Phone Mockup on Left, Human Feature Story on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Phone Mockup Column */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group perspective-1000">
              {/* Phone Outer Chassis (Realistic Titanium Frame) */}
              <div className="relative w-[295px] sm:w-[325px] h-[610px] sm:h-[670px] bg-slate-900 dark:bg-slate-950 rounded-[48px] p-3 shadow-2xl shadow-slate-400/20 dark:shadow-blue-950/40 border-[4px] border-slate-400/60 dark:border-slate-700/80 ring-1 ring-black/10 dark:ring-white/10">
                {/* Side Buttons Simulation */}
                <div className="absolute -left-[7px] top-32 w-[3px] h-12 bg-slate-500 rounded-l-sm" />
                <div className="absolute -left-[7px] top-48 w-[3px] h-12 bg-slate-500 rounded-l-sm" />
                <div className="absolute -right-[7px] top-36 w-[3px] h-16 bg-slate-500 rounded-r-sm" />

                {/* Inner Screen Viewport */}
                <div className="relative w-full h-full rounded-[38px] overflow-hidden bg-black flex flex-col">
                  {/* Dynamic Island / Speaker Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-between px-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-900 ring-1 ring-slate-800" />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                  </div>

                  {/* Screen Image with smooth transition */}
                  <div className="relative w-full h-full overflow-hidden">
                    <img
                      key={`${activeScreen}-${deviceTheme}`}
                      src={activeImage}
                      alt={`Splitzy ${current.label} screen in ${deviceTheme} mode`}
                      className="w-full h-full object-cover object-top animate-in fade-in duration-300"
                      loading="eager"
                      referrerPolicy="no-referrer"
                    />

                    {/* Gradient Gloss Reflection Scrim */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
                  </div>

                  {/* Home Indicator Bar */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/40 rounded-full z-30 pointer-events-none" />
                </div>
              </div>

              {/* Interactive Phone Footer Hint */}
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500 dark:text-slate-400">
                <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Splitzy v{settings.latestVersion}</span>
              </div>
            </div>
          </div>

          {/* Feature Breakdown & Human Story Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Screen Header Info */}
            <div className="space-y-2">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {current.shortTitle}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
                {current.tagline}
              </p>
            </div>

            {/* Before & After: The Human Friction vs The Splitzy Solution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 space-y-2">
                <span className="text-xs font-bold tracking-wider text-rose-600 dark:text-rose-400">
                  The Everyday Roommate Struggles
                </span>
                <p className="text-xs sm:text-sm text-rose-950/80 dark:text-slate-300 leading-relaxed">
                  {current.humanProblem}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-2">
                <span className="text-xs font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                  How Splitzy Makes Things Easier
                </span>
                <p className="text-xs sm:text-sm text-emerald-950/80 dark:text-slate-300 leading-relaxed">
                  {current.splitzySolution}
                </p>
              </div>
            </div>

            {/* Key Screen Highlights */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                What You See on Screen
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {current.keyHighlights.map((highlight, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Row */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onOpenDownloadModal}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download APK to Experience This</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
