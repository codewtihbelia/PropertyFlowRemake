import React, { useState, useEffect, useCallback } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LandingPage } from "./views/landing/LandingPage";
import { TermsOfServiceView } from "./views/legal/TermsOfServiceView";
import { PrivacyPolicyView } from "./views/legal/PrivacyPolicyView";
import { DownloadApkView } from "./views/download/DownloadApkView";

type WebFlow = "landing" | "terms" | "privacy" | "download";

const parseFlowFromLocation = (): WebFlow => {
  if (typeof window === "undefined") return "landing";

  // Clean pathname by removing trailing slashes
  const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, "");
  const hash = window.location.hash.toLowerCase().replace(/\/+$/, "");

  // Priority to clean HTML5 URL paths: /download, /apk, /terms, /privacy
  if (
    pathname === "/download" ||
    pathname.endsWith("/download") ||
    pathname === "/apk" ||
    pathname.endsWith("/apk")
  ) {
    return "download";
  }
  if (pathname === "/terms" || pathname.endsWith("/terms")) {
    return "terms";
  }
  if (pathname === "/privacy" || pathname.endsWith("/privacy")) {
    return "privacy";
  }

  // Backwards compatibility for legacy hash URLs (#download, #terms, #privacy)
  if (hash.includes("download") || hash.includes("apk")) {
    return "download";
  }
  if (hash.includes("terms")) {
    return "terms";
  }
  if (hash.includes("privacy")) {
    return "privacy";
  }

  return "landing";
};

const MainLandingFlow: React.FC = () => {
  const [webFlow, setWebFlow] = useState<WebFlow>(() =>
    parseFlowFromLocation(),
  );

  // If user arrives via legacy hash like #download, automatically replace the URL
  // with the clean path /download without hashtag
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes("download") || hash.includes("apk")) {
        window.history.replaceState({ flow: "download" }, "", "/download");
        setWebFlow((prev) => (prev === "download" ? prev : "download"));
      } else if (hash.includes("terms")) {
        window.history.replaceState({ flow: "terms" }, "", "/terms");
        setWebFlow((prev) => (prev === "terms" ? prev : "terms"));
      } else if (hash.includes("privacy")) {
        window.history.replaceState({ flow: "privacy" }, "", "/privacy");
        setWebFlow((prev) => (prev === "privacy" ? prev : "privacy"));
      }
    }
  }, []);

  // Listen to browser Back / Forward buttons and any history navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const nextFlow = parseFlowFromLocation();
      setWebFlow((prev) => (prev === nextFlow ? prev : nextFlow));
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const navigateTo = useCallback((flow: WebFlow) => {
    setWebFlow(flow);

    let targetPath = "/";
    if (flow === "download") {
      targetPath = "/download";
    } else if (flow === "terms") {
      targetPath = "/terms";
    } else if (flow === "privacy") {
      targetPath = "/privacy";
    }

    // Scroll smoothly to top on route change
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Update browser URL cleanly without hashtag using HTML5 pushState
    const currentPath =
      window.location.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    if (currentPath !== targetPath || window.location.hash) {
      window.history.pushState({ flow }, "", targetPath);
    }
  }, []);

  // Handle Dedicated Download APK View (/download)
  if (webFlow === "download") {
    return (
      <DownloadApkView
        onBackToHome={() => navigateTo("landing")}
        onOpenTerms={() => navigateTo("terms")}
        onOpenPrivacy={() => navigateTo("privacy")}
      />
    );
  }

  // Handle Terms of Service modal / view (/terms)
  if (webFlow === "terms") {
    return (
      <TermsOfServiceView
        onBack={() => navigateTo("landing")}
        onNavigateToPrivacy={() => navigateTo("privacy")}
      />
    );
  }

  // Handle Privacy Policy modal / view (/privacy)
  if (webFlow === "privacy") {
    return (
      <PrivacyPolicyView
        onBack={() => navigateTo("landing")}
        onNavigateToTerms={() => navigateTo("terms")}
      />
    );
  }

  // Default: Pure Splitzy Mobile Showcase Landing Page (/)
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
