import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { HouseholdProvider, useHousehold } from "./contexts/HouseholdContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Header } from "./components/common/Header";
import { Sidebar } from "./components/common/Sidebar";
import { CustomAlertModal } from "./components/CustomAlertModal";
import { webAlertService } from "./services/webAlertService";
import { auth } from "./firebase/config";

// Initialize global window.alert override with app-matching custom modal
webAlertService.initWebAlertPatch();

// Auth & Onboarding Views
import { OnboardingView } from "./views/auth/OnboardingView";
import { AuthView } from "./views/auth/AuthView";

// Alias Auth to AuthView to resolve any "Cannot find name Auth" references
export const Auth = AuthView;

// Host Views
import { HostDashboard } from "./views/host/HostDashboard";
import { HostHousehold } from "./views/host/HostHousehold";
import { HostBilling } from "./views/host/HostBilling";
import { HostAttendance } from "./views/host/HostAttendance";
import { HostPayments } from "./views/host/HostPayments";
import { HostRedistribution } from "./views/host/HostRedistribution";
import { HostReports } from "./views/host/HostReports";
import { HostCommunication } from "./views/host/HostCommunication";
import { HostAuditLogs } from "./views/host/HostAuditLogs";
import { HostSettings } from "./views/host/HostSettings";

// Client Views
import { ClientDashboard } from "./views/client/ClientDashboard";
import { ClientBills } from "./views/client/ClientBills";
import { ClientPayments } from "./views/client/ClientPayments";
import { ClientAttendance } from "./views/client/ClientAttendance";
import { ClientProfile } from "./views/client/ClientProfile";
import { ClientWallet } from "./views/client/ClientWallet";

// Super Admin Views
import { SuperAdminDashboard } from "./views/admin/SuperAdminDashboard";
import { SuperAdminHostApplications } from "./views/admin/SuperAdminHostApplications";
import { SuperAdminHouseholds } from "./views/admin/SuperAdminHouseholds";
import { SuperAdminUsers } from "./views/admin/SuperAdminUsers";
import { SuperAdminVersions } from "./views/admin/SuperAdminVersions";
import { SuperAdminSupport } from "./views/admin/SuperAdminSupport";
import { ClientHostApplication } from "./views/client/ClientHostApplication";
import { LandingPage } from "./views/landing/LandingPage";
import { TermsOfServiceView } from "./views/legal/TermsOfServiceView";
import { PrivacyPolicyView } from "./views/legal/PrivacyPolicyView";

type WebFlow = "landing" | "onboarding" | "auth" | "app" | "terms" | "privacy";

const MainLayout: React.FC = () => {
  const {
    currentUser,
    isHost,
    isSuperAdmin,
    role,
    signOut,
    isAuthenticated,
    loading,
    isEmailVerified,
    sendVerificationEmail,
    reloadUser,
  } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>("host_dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<
    "signin" | "register" | "forgot"
  >("signin");
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [checkingVerificationStatus, setCheckingVerificationStatus] =
    useState<boolean>(false);
  const [dismissVerifyBanner, setDismissVerifyBanner] =
    useState<boolean>(false);
  const [previousFlow, setPreviousFlow] = useState<WebFlow>("landing");

  // Initialize flow: default to landing page
  const [webFlow, setWebFlow] = useState<WebFlow>(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.hash === "#portal" || window.location.hash === "#app")
    ) {
      return "app";
    }
    return "landing";
  });

  const { household, members } = useHousehold();

  const isUserHost = Boolean(
    isHost ||
    currentUser.role === "HOST" ||
    currentUser.hostApplicationStatus === "APPROVED" ||
    (household.hostId && household.hostId === currentUser.uid) ||
    members.some(
      (m) =>
        (m.userId === currentUser.uid ||
          m.memberId === currentUser.uid ||
          m.memberId === `mem_${currentUser.uid}`) &&
        m.role === "HOST",
    ),
  );

  // Synchronize default tab on role switch
  useEffect(() => {
    if (isSuperAdmin) {
      setCurrentTab("admin_dashboard");
    } else if (isUserHost) {
      setCurrentTab((prev) =>
        prev === "client_dashboard" || prev === "client_host_application"
          ? "host_dashboard"
          : prev,
      );
    } else {
      setCurrentTab((prev) =>
        prev.startsWith("host_") ? "client_dashboard" : prev,
      );
    }
  }, [role, isSuperAdmin, isUserHost]);

  const handleOpenTerms = () => {
    setPreviousFlow(
      webFlow === "terms" || webFlow === "privacy" ? "landing" : webFlow,
    );
    setWebFlow("terms");
  };

  const handleOpenPrivacy = () => {
    setPreviousFlow(
      webFlow === "terms" || webFlow === "privacy" ? "landing" : webFlow,
    );
    setWebFlow("privacy");
  };

  // Terms of Service View
  if (webFlow === "terms") {
    return (
      <TermsOfServiceView
        onBack={() => setWebFlow(previousFlow || "landing")}
        onNavigateToPrivacy={() => setWebFlow("privacy")}
      />
    );
  }

  // Privacy Policy View
  if (webFlow === "privacy") {
    return (
      <PrivacyPolicyView
        onBack={() => setWebFlow(previousFlow || "landing")}
        onNavigateToTerms={() => setWebFlow("terms")}
      />
    );
  }

  // Landing Screen View (Default for /web)
  if (webFlow === "landing") {
    return (
      <LandingPage
        onOpenApp={() => {
          if (currentUser?.uid) {
            setWebFlow("app");
          } else {
            setAuthInitialMode("signin");
            setWebFlow("auth");
          }
        }}
        onOpenAuth={(mode) => {
          setAuthInitialMode(mode || "signin");
          setWebFlow("auth");
        }}
        onOpenTerms={handleOpenTerms}
        onOpenPrivacy={handleOpenPrivacy}
      />
    );
  }

  // Onboarding Screen View
  if (webFlow === "onboarding") {
    return (
      <OnboardingView
        onComplete={() => {
          localStorage.setItem("splitzy_onboarding_completed", "true");
          setWebFlow(currentUser?.uid ? "app" : "auth");
        }}
      />
    );
  }

  // Auth Screen View
  if (webFlow === "auth") {
    return (
      <AuthView
        initialMode={authInitialMode}
        onSuccess={() => {
          setWebFlow("app");
          if (typeof window !== "undefined") {
            window.location.hash = "portal";
          }
        }}
        onBackToLanding={() => setWebFlow("landing")}
        onOpenTerms={handleOpenTerms}
        onOpenPrivacy={handleOpenPrivacy}
      />
    );
  }

  // STRICT AUTH GUARD: Only authenticated users can access the application portal
  if (webFlow === "app") {
    const hasActiveUser = Boolean(currentUser?.uid || auth.currentUser?.uid);

    if (loading && !hasActiveUser) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-700 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-brand-500/25 animate-pulse mb-4">
            S
          </div>
          <div className="text-base font-bold text-slate-800">
            Verifying session...
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Authenticating with Firebase Cloud
          </div>
        </div>
      );
    }

    if (!hasActiveUser) {
      return (
        <AuthView
          initialMode="signin"
          onSuccess={() => {
            setWebFlow("app");
            if (typeof window !== "undefined") {
              window.location.hash = "portal";
            }
          }}
          onBackToLanding={() => setWebFlow("landing")}
        />
      );
    }
  }

  const renderContent = () => {
    // Global Legal Views within Portal
    if (currentTab === "terms") {
      return (
        <TermsOfServiceView
          onBack={() =>
            setCurrentTab(
              isSuperAdmin
                ? "admin_dashboard"
                : isUserHost
                  ? "host_dashboard"
                  : "client_dashboard",
            )
          }
          onNavigateToPrivacy={() => setCurrentTab("privacy")}
        />
      );
    }
    if (currentTab === "privacy") {
      return (
        <PrivacyPolicyView
          onBack={() =>
            setCurrentTab(
              isSuperAdmin
                ? "admin_dashboard"
                : isUserHost
                  ? "host_dashboard"
                  : "client_dashboard",
            )
          }
          onNavigateToTerms={() => setCurrentTab("terms")}
        />
      );
    }

    // Super Admin Routes
    if (isSuperAdmin) {
      switch (currentTab) {
        case "admin_host_applications":
          return <SuperAdminHostApplications />;
        case "admin_households":
          return <SuperAdminHouseholds />;
        case "admin_users":
          return <SuperAdminUsers />;
        case "admin_versions":
          return <SuperAdminVersions />;
        case "admin_support":
          return <SuperAdminSupport />;
        case "admin_logs":
          return <HostAuditLogs />;
        case "admin_dashboard":
        default:
          return <SuperAdminDashboard onNavigate={setCurrentTab} />;
      }
    }

    // Host Routes
    if (isUserHost) {
      switch (currentTab) {
        case "host_household":
          return <HostHousehold />;
        case "host_billing":
          return <HostBilling />;
        case "host_attendance":
          return <HostAttendance />;
        case "host_payments":
          return <HostPayments />;
        case "host_redistribution":
          return <HostRedistribution />;
        case "host_reports":
          return <HostReports />;
        case "host_messages":
        case "host_announcements":
          return <HostCommunication />;
        case "host_logs":
          return <HostAuditLogs />;
        case "host_settings":
          return <HostSettings />;
        case "client_wallet":
          return (
            <ClientWallet
              onNavigateToBills={() => setCurrentTab("client_bills")}
              onNavigateToPayments={() => setCurrentTab("client_payments")}
            />
          );
        case "client_bills":
          return (
            <ClientBills onPayClick={() => setCurrentTab("client_payments")} />
          );
        case "client_payments":
          return <ClientPayments />;
        case "client_attendance":
          return <ClientAttendance />;
        case "client_profile":
          return <ClientProfile />;
        case "client_dashboard":
          return <ClientDashboard onNavigate={setCurrentTab} />;
        case "host_dashboard":
        default:
          return <HostDashboard onNavigate={setCurrentTab} />;
      }
    }

    // Client Routes (Payor & Non-Payor)
    switch (currentTab) {
      case "client_host_application":
        return <ClientHostApplication onNavigate={setCurrentTab} />;
      case "client_wallet":
        return (
          <ClientWallet
            onNavigateToBills={() => setCurrentTab("client_bills")}
            onNavigateToPayments={() => setCurrentTab("client_payments")}
          />
        );
      case "client_bills":
        return (
          <ClientBills onPayClick={() => setCurrentTab("client_payments")} />
        );
      case "client_payments":
        return <ClientPayments />;
      case "client_attendance":
        return <ClientAttendance />;
      case "client_messages":
      case "client_announcements":
        return <HostCommunication />;
      case "client_profile":
        return <ClientProfile />;
      case "client_dashboard":
      default:
        return <ClientDashboard onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onSignOut={async () => {
          await signOut();
          setWebFlow("landing");
        }}
      />

      {/* Unverified Email In-App Notice */}
      {currentUser.uid && !isEmailVerified && !dismissVerifyBanner && (
        <div className="bg-amber-500/10 border-b border-amber-300 text-amber-900 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              Your email address (<strong>{currentUser.email}</strong>) is not
              verified yet. Please confirm your account to secure receipts.
            </span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {resendStatus && (
              <span className="text-emerald-700 font-semibold">
                {resendStatus}
              </span>
            )}
            <button
              type="button"
              onClick={async () => {
                try {
                  await sendVerificationEmail();
                  setResendStatus("Link sent!");
                  setTimeout(() => setResendStatus(null), 4000);
                } catch {
                  setResendStatus("Error sending link.");
                }
              }}
              className="font-bold underline text-amber-800 hover:text-amber-950 cursor-pointer"
            >
              Resend Verification Link
            </button>
            <button
              type="button"
              onClick={async () => {
                setCheckingVerificationStatus(true);
                const verified = await reloadUser();
                setCheckingVerificationStatus(false);
                if (verified) {
                  setResendStatus("Verified! Thank you.");
                } else {
                  setResendStatus("Not verified yet.");
                  setTimeout(() => setResendStatus(null), 3000);
                }
              }}
              disabled={checkingVerificationStatus}
              className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer disabled:opacity-75 transition text-[11px]"
            >
              {checkingVerificationStatus ? "Checking..." : "I've Verified"}
            </button>
            <button
              type="button"
              onClick={() => setDismissVerifyBanner(true)}
              className="text-amber-700 hover:text-amber-950 font-bold ml-1 cursor-pointer"
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HouseholdProvider>
          <NotificationProvider>
            <MainLayout />
            <CustomAlertModal />
          </NotificationProvider>
        </HouseholdProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
