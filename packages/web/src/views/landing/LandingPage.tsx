import React from "react";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { HeroSection } from "../../components/landing/HeroSection";
import { ProblemsAndSolutions } from "../../components/landing/ProblemsAndSolutions";
import { MobileAppShowcase } from "../../components/landing/MobileAppShowcase";
import { FeaturesBentoGrid } from "../../components/landing/FeaturesBentoGrid";
import { SplitzyGuidesSection } from "../../components/landing/SplitzyGuidesSection";
import { AboutSplitzySection } from "../../components/landing/AboutSplitzySection";
import { FaqSection } from "../../components/landing/FaqSection";
import { DownloadCtaSection } from "../../components/landing/DownloadCtaSection";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { ScrollReveal } from "../../components/landing/ScrollReveal";

interface LandingPageProps {
  onOpenApp?: () => void;
  onOpenAuth?: (mode?: "signin" | "register") => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  onNavigateToDownload?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenApp,
  onOpenAuth,
  onOpenTerms,
  onOpenPrivacy,
  onNavigateToDownload,
}) => {
  const handleDownloadClick = () => {
    if (onNavigateToDownload) {
      onNavigateToDownload();
    }
  };

  const handleScrollTo = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-600 selection:text-white transition-colors">
      {/* 1. Sticky Navigation (Strict Top Bar Contract) */}
      <LandingNavbar
        onOpenDownloadModal={handleDownloadClick}
        onScrollTo={handleScrollTo}
      />

      <main>
        {/* 2. Hero Section with Live Splitzy Preview */}
        <HeroSection
          onOpenDownloadModal={handleDownloadClick}
          onScrollToShowcase={() => handleScrollTo("showcase")}
        />

        {/* 3. Interactive 3D Device Showcase (Flip Dark & Light with 18 real screenshots) */}
        <ScrollReveal delay={100}>
          <MobileAppShowcase
            onOpenDownloadModal={handleDownloadClick}
          />
        </ScrollReveal>

        {/* 4. The Human Problem & Co-Living Friction */}
        <ScrollReveal delay={100}>
          <ProblemsAndSolutions />
        </ScrollReveal>

        {/* 5. Core Architectural Bento Grid */}
        <ScrollReveal delay={100}>
          <FeaturesBentoGrid />
        </ScrollReveal>

        {/* 6. Co-Living Practical Guides & Calculation Wisdom */}
        <ScrollReveal delay={100}>
          <SplitzyGuidesSection />
        </ScrollReveal>

        {/* 7. About Splitzy Story & Pillars */}
        <ScrollReveal delay={100}>
          <AboutSplitzySection
            onOpenDownloadModal={handleDownloadClick}
          />
        </ScrollReveal>

        {/* 8. Frequently Asked Questions */}
        <ScrollReveal delay={100}>
          <FaqSection />
        </ScrollReveal>

        {/* 9. Final High-Conversion Download Call To Action */}
        <ScrollReveal delay={100}>
          <DownloadCtaSection
            onOpenDownloadModal={handleDownloadClick}
          />
        </ScrollReveal>
      </main>

      {/* 10. Footer */}
      <LandingFooter
        onScrollTo={handleScrollTo}
        onOpenDownloadModal={handleDownloadClick}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
      />
    </div>
  );
};
