import React, { useState, useEffect } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LandingPage } from "./views/landing/LandingPage";
import { TermsOfServiceView } from "./views/legal/TermsOfServiceView";
import { PrivacyPolicyView } from "./views/legal/PrivacyPolicyView";
import { DownloadApkView } from "./views/download/DownloadApkView";

type WebFlow = "landing" | "terms" | "privacy" | "download";

const MainLandingFlow: React.FC = () => {
  const [webFlow, setWebFlow] = useState<WebFlow>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes("download") || hash.includes("apk")) {
        return "download";
      }
      if (hash.includes("terms")) {
        return "terms";
      }
      if (hash.includes("privacy")) {
        return "privacy";
      }
    }
    return "landing";
  });

  // Keep window hash synchronized with browser navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes("download") || hash.includes("apk")) {
        setWebFlow("download");
      } else if (hash.includes("terms")) {
        setWebFlow("terms");
      } else if (hash.includes("privacy")) {
        setWebFlow("privacy");
      } else if (!hash || hash === "#" || hash === "#/") {
        setWebFlow("landing");
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (flow: WebFlow) => {
    setWebFlow(flow);
    if (flow === "download") {
      window.location.hash = "#download";
    } else if (flow === "terms") {
      window.location.hash = "#terms";
    } else if (flow === "privacy") {
      window.location.hash = "#privacy";
    } else {
      if (window.location.hash && window.location.hash !== "#") {
        window.history.pushState(null, "", window.location.pathname);
      }
    }
  };

  // Handle Dedicated Download APK View
  if (webFlow === "download") {
    return (
      <DownloadApkView
        onBackToHome={() => navigateTo("landing")}
        onOpenTerms={() => navigateTo("terms")}
        onOpenPrivacy={() => navigateTo("privacy")}
      />
    );
  }

  // Handle Terms of Service modal / view
  if (webFlow === "terms") {
    return (
      <TermsOfServiceView
        onBack={() => navigateTo("landing")}
        onNavigateToPrivacy={() => navigateTo("privacy")}
      />
    );
  }

  // Handle Privacy Policy modal / view
  if (webFlow === "privacy") {
    return (
      <PrivacyPolicyView
        onBack={() => navigateTo("landing")}
        onNavigateToTerms={() => navigateTo("terms")}
      />
    );
  }

  // Default: Pure Splitzy Mobile Showcase Landing Page
  return (
    <LandingPage
      onNavigateToDownload={() => navigateTo("download")}
      onOpenTerms={() => navigateTo("terms")}
      onOpenPrivacy={() => navigateTo("privacy")}
    />
  );
};

export function App() {
  return (
    <ThemeProvider>
      <MainLandingFlow />
    </ThemeProvider>
  );
}

export default App;
