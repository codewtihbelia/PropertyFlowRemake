import React, { useState } from "react";
import { 
  Smartphone, 
  Sparkles, 
  CheckCircle2, 
  ZoomIn, 
  ShieldCheck, 
  ArrowRight, 
  Layers, 
  Bell, 
  DollarSign, 
  Calendar,
  Receipt,
  Users,
  Code
} from "lucide-react";
import { CodedOnboarding1Phone } from "./CodedOnboarding1Phone";
import { CodedAuthScreenPhone } from "./CodedAuthScreenPhone";

export const MobileAppShowcase: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);

  const showcaseItems = [
    {
      title: "Mobile Auth Screen",
      subtitle: "Two-tone card with Splitzy branding, segmented Sign In/Up, and Google + Apple OAuth",
      image: "/auth-screen.png",
      badge: "Coded Auth UI",
      features: [
        "Splitzy dual-color typography & modern geometric icon",
        "Segmented control toggling Sign In and Sign Up effortlessly",
        "Clean input fields with @ and lock prefix icons & show/hide toggle",
        "Curved royal blue footer with Google and Apple sign-in buttons",
      ],
    },
    {
      title: "Onboarding Screens (1, 2, 3)",
      subtitle: "Smart expense sharing, roommate transparency, and stress-free settlement flow",
      image: "/onboarding-flow.png",
      badge: "Onboarding UI",
      features: [
        "Smart expense sharing with clean orbit graphics",
        "Clear value proposition for roommate utility & rent splitting",
        "Seamless horizontal swipe navigation with dark pill pagination",
        "Fast skip directly to account registration & login",
      ],
    },
    {
      title: "All-Screen Mobile Flow",
      subtitle: "Complete mobile architecture across authentication, active cycle, and settlements",
      image: "/proposed-all-screens.webp",
      badge: "Full Experience",
      features: [
        "Consistent typography & warm neutral theme",
        "Optimized 44px+ touch targets for fast logging",
        "Offline-capable data caching with Firebase",
        "Intuitive bottom navigation & fast status cards",
      ],
    },
    {
      title: "Home Dashboard & Quick Bar",
      subtitle: "Effortlessly add expenses, initiate dues settlement, and review active cycle total",
      image: "/mobile-screen-1.webp",
      badge: "Daily Hub",
      features: [
        "One-tap '+ Add Expense' modal for fast receipt capture",
        "'Settle Dues' shortcut with instant wallet QR display",
        "Recent activity feed with transparent roommate names",
        "Active billing cycle countdown and status chips",
      ],
    },
    {
      title: "Transparent Member Breakdown",
      subtitle: "Clean itemized shares showing exact centavos, attendance, and proof verification",
      image: "/mobile-screen-2.webp",
      badge: "Zero Ambiguity",
      features: [
        "Itemized bill lines: Rent, Power, Water, Internet, Essentials",
        "Absence credits highlighted with green badges",
        "Direct proof-of-payment upload via camera or photo library",
        "Host review and approval confirmation with audit stamps",
      ],
    },
  ];

  return (
    <section id="mobile-app" className="py-16 md:py-24 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase tracking-wider border border-brand-200">
            <Smartphone className="w-3.5 h-3.5 text-brand-600" />
            <span>Mobile App Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Crafted for Smooth Daily Use <br />
            <span className="text-brand-600">On iOS & Android</span>
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Inspect the proposed mobile application screens designed for quick utility logging, daily attendance check-ins, and frictionless roommate settlements.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {showcaseItems.map((item, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === index
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span>{item.title}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === index ? "bg-brand-500 text-white" : "bg-white text-slate-600"
              }`}>
                {item.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Showcase Display Area */}
        <div className="bg-slate-50 rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left: Key Screen Features */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                  {showcaseItems[activeTab].badge}
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {showcaseItems[activeTab].title}
                </h3>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  {showcaseItems[activeTab].subtitle}
                </p>
              </div>

              {/* Feature Points */}
              <div className="space-y-3 pt-2">
                {showcaseItems[activeTab].features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Action */}
              <div className="pt-4">
                <button
                  onClick={() => setSelectedImage(showcaseItems[activeTab].image)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-xs transition-all"
                >
                  <ZoomIn className="w-4 h-4 text-brand-600" />
                  <span>Inspect High-Resolution Preview</span>
                </button>
              </div>
            </div>

            {/* Right: Screen Graphic Mockup */}
            <div className="lg:col-span-7 flex justify-center">
              {activeTab === 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                    <Code className="w-3.5 h-3.5" />
                    <span>100% Coded Vector UI • Auth Screen</span>
                  </div>
                  <CodedAuthScreenPhone />
                </div>
              ) : activeTab === 1 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                    <Code className="w-3.5 h-3.5" />
                    <span>100% Coded Vector UI • Onboarding Simulation</span>
                  </div>
                  <CodedOnboarding1Phone />
                </div>
              ) : (
                <div 
                  onClick={() => setSelectedImage(showcaseItems[activeTab].image)}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border-4 border-white shadow-2xl bg-slate-900 max-h-[540px] w-full flex items-center justify-center transition-transform hover:scale-[1.01]"
                >
                  <img
                    src={showcaseItems[activeTab].image}
                    alt={showcaseItems[activeTab].title}
                    className="w-full h-full object-contain max-h-[500px] p-2"
                  />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-lg">
                      <ZoomIn className="w-4 h-4 text-brand-600" />
                      <span>Click to Enlarge</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Modal Lightbox */}
        {selectedImage && (
          <div 
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-fadeIn"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-5xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden p-2 shadow-2xl border border-slate-700"
            >
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-slate-800/90 text-white flex items-center justify-center hover:bg-slate-700 text-sm font-bold shadow-md"
              >
                ✕
              </button>
              <img
                src={selectedImage}
                alt="Enlarged preview"
                className="w-full h-auto max-h-[82vh] object-contain rounded-lg"
              />
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
