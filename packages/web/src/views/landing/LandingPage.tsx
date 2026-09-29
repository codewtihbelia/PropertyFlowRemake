import React from "react";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { HeroSection } from "../../components/landing/HeroSection";
import { ProblemsAndSolutions } from "../../components/landing/ProblemsAndSolutions";
import { LiveSplitCalculator } from "../../components/landing/LiveSplitCalculator";
import { MobileAppShowcase } from "../../components/landing/MobileAppShowcase";
import { FeaturesBentoGrid } from "../../components/landing/FeaturesBentoGrid";
import { HowItWorksSection } from "../../components/landing/HowItWorksSection";
import { RoleComparisonSection } from "../../components/landing/RoleComparisonSection";
import { FaqSection } from "../../components/landing/FaqSection";
import { DownloadCtaSection } from "../../components/landing/DownloadCtaSection";
import { LandingFooter } from "../../components/landing/LandingFooter";

interface LandingPageProps {
  onOpenApp: () => void;
  onOpenAuth?: (mode?: "signin" | "register") => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenApp,
  onOpenAuth,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  const handleScrollTo = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-500 selection:text-white">
      {/* Sticky Top Navigation */}
      <LandingNavbar
        onOpenApp={onOpenApp}
        onOpenAuth={onOpenAuth}
        onScrollTo={handleScrollTo}
      />

      <main>
        {/* 1. Hero Section with Interactive Mobile Mockup */}
        <HeroSection
          onOpenCalculator={() => handleScrollTo("calculator")}
          onOpenMobileShowcase={() => handleScrollTo("mobile-app")}
          onOpenApp={onOpenApp}
        />

        {/* 2. Roommate Friction Points & Solutions */}
        <ProblemsAndSolutions />

        {/* 3. Interactive Live Bill Split & Absence Simulator */}
        <LiveSplitCalculator />

        {/* 4. Proposed Mobile App Deep Dive (Showcasing /proposedUI) */}
        <MobileAppShowcase />

        {/* 5. Architectural Features Bento Grid */}
        <FeaturesBentoGrid />

        {/* 6. 4-Step How It Works Workflow */}
        <HowItWorksSection />

        {/* 7. Perspectives: Household Hosts vs Resident Roommates */}
        <RoleComparisonSection />

        {/* 8. Frequently Asked Questions */}
        <FaqSection />

        {/* 9. High-Conversion Closing Call To Action */}
        <DownloadCtaSection
          onOpenApp={onOpenApp}
          onOpenCalculator={() => handleScrollTo("calculator")}
        />
      </main>

      {/* Footer */}
      <LandingFooter
        onScrollTo={handleScrollTo}
        onOpenApp={onOpenApp}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
      />
    </div>
  );
};
