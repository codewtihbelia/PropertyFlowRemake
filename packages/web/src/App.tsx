import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { HouseholdProvider, useHousehold } from "./contexts/HouseholdContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { Header } from "./components/common/Header";
import { Sidebar } from "./components/common/Sidebar";
import { auth } from "./firebase/config";

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

// Super Admin Views
import { SuperAdminDashboard } from "./views/admin/SuperAdminDashboard";
import { SuperAdminHostApplications } from "./views/admin/SuperAdminHostApplications";
import { SuperAdminHouseholds } from "./views/admin/SuperAdminHouseholds";
import { SuperAdminUsers } from "./views/admin/SuperAdminUsers";
import { SuperAdminVersions } from "./views/admin/SuperAdminVersions";
import { SuperAdminSupport } from "./views/admin/SuperAdminSupport";
import { ClientHostApplication } from "./views/client/ClientHostApplication";
import { LandingPage } from "./views/landing/LandingPage";
import { UniversalLoader } from "./components/common/UniversalLoader";

type WebFlow = "landing" | "onboarding" | "auth" | "app";

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
  const [navTransition, setNavTransition] = useState<{
    title: string;
    subtitle: string;
    isExiting?: boolean;
  } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const transitionTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleSelectTab = (tab: string) => {
    if (tab === currentTab) return;

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    const tabLabels: Record<string, { title: string; subtitle: string }> = {
      host_dashboard: {
        title: "Loading Host Dashboard...",
        subtitle: "Preparing property overview...",
      },
      host_household: {
        title: "Loading Household...",
        subtitle: "Fetching roommates and rooms...",
      },
      host_billing: {
        title: "Loading Billing & Invoices...",
        subtitle: "Calculating split charges...",
      },
      host_attendance: {
        title: "Loading Attendance...",
        subtitle: "Syncing monthly calendar...",
      },
      host_payments: {
        title: "Loading Payments...",
        subtitle: "Fetching transaction history...",
      },
      host_redistribution: {
        title: "Loading Redistribution...",
        subtitle: "Auditing utility shares...",
      },
      host_reports: {
        title: "Loading Financial Reports...",
        subtitle: "Compiling balance analytics...",
      },
      host_messages: {
        title: "Loading Messages...",
        subtitle: "Connecting household channels...",
      },
      host_announcements: {
        title: "Loading Announcements...",
        subtitle: "Connecting household channels...",
      },
      host_logs: {
        title: "Loading Audit Logs...",
        subtitle: "Fetching security and activity log...",
      },
      host_settings: {
        title: "Loading Settings...",
        subtitle: "Retrieving household configuration...",
      },
      client_dashboard: {
        title: "Loading Client Dashboard...",
        subtitle: "Preparing your expense summary...",
      },
      client_bills: {
        title: "Loading Bills...",
        subtitle: "Calculating fair shares & utilities...",
      },
      client_payments: {
        title: "Loading Payments...",
        subtitle: "Fetching receipt history...",
      },
      client_attendance: {
        title: "Loading Attendance...",
        subtitle: "Syncing your active dates...",
      },
      client_profile: {
        title: "Loading Profile...",
        subtitle: "Retrieving account details...",
      },
      client_messages: {
        title: "Loading Messages...",
        subtitle: "Connecting household channels...",
      },
      client_announcements: {
        title: "Loading Announcements...",
        subtitle: "Connecting household channels...",
      },
      client_host_application: {
        title: "Loading Host Application...",
        subtitle: "Preparing application form...",
      },
      admin_dashboard: {
        title: "Loading Admin Dashboard...",
        subtitle: "Preparing system metrics...",
      },
      admin_host_applications: {
        title: "Loading Host Applications...",
        subtitle: "Reviewing pending hosts...",
      },
      admin_households: {
        title: "Loading Households...",
        subtitle: "Reviewing all properties...",
      },
      admin_users: {
        title: "Loading Users...",
        subtitle: "Retrieving member directory...",
      },
      admin_versions: {
        title: "Loading Version History...",
        subtitle: "Reviewing app releases...",
      },
      admin_support: {
        title: "Loading Support...",
        subtitle: "Reviewing tickets and help...",
      },
      admin_logs: {
        title: "Loading Audit Logs...",
        subtitle: "Reviewing system security logs...",
      },
    };

    const meta = tabLabels[tab] || {
      title: "Navigating...",
      subtitle: "Please wait a moment...",
    };

    // 1. Immediately display transition loader
    setNavTransition({ ...meta, isExiting: false });

    // 2. Mount and render destination view underneath
    setCurrentTab(tab);

    // 3. Keep transition visible for smooth branded feel (280ms) then fade out smoothly
    transitionTimerRef.current = setTimeout(() => {
      setNavTransition((prev) => (prev ? { ...prev, isExiting: true } : null));

      exitTimerRef.current = setTimeout(() => {
        setNavTransition(null);
      }, 180);
    }, 280);
  };
  const [authInitialMode, setAuthInitialMode] = useState<
    "signin" | "register" | "forgot"
  >("signin");
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [checkingVerificationStatus, setCheckingVerificationStatus] =
    useState<boolean>(false);
  const [dismissVerifyBanner, setDismissVerifyBanner] =
    useState<boolean>(false);

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
      />
    );
  }

  // STRICT AUTH GUARD: Only authenticated users can access the application portal
  if (webFlow === "app") {
    const hasActiveUser = Boolean(currentUser?.uid || auth.currentUser?.uid);

    if (loading && !hasActiveUser) {
      return (
        <UniversalLoader
          text="Verifying session..."
          subtitle="Authenticating with Firebase Cloud"
          transparent={false}
        />
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
          return <SuperAdminDashboard onNavigate={handleSelectTab} />;
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
        case "client_bills":
          return (
            <ClientBills
              onPayClick={() => handleSelectTab("client_payments")}
            />
          );
        case "client_payments":
          return <ClientPayments />;
        case "client_attendance":
          return <ClientAttendance />;
        case "client_profile":
          return <ClientProfile />;
        case "client_dashboard":
          return <ClientDashboard onNavigate={handleSelectTab} />;
        case "host_dashboard":
        default:
          return <HostDashboard onNavigate={handleSelectTab} />;
      }
    }

    // Client Routes (Payor & Non-Payor)
    switch (currentTab) {
      case "client_host_application":
        return <ClientHostApplication onNavigate={handleSelectTab} />;
      case "client_bills":
        return (
          <ClientBills onPayClick={() => handleSelectTab("client_payments")} />
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
        return <ClientDashboard onNavigate={handleSelectTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
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
          onSelectTab={handleSelectTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0 relative">
          {renderContent()}
          {navTransition && (
            <UniversalLoader
              text={navTransition.title}
              subtitle={navTransition.subtitle}
              transparent={true}
              isExiting={navTransition.isExiting}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <NotificationProvider>
          <MainLayout />
        </NotificationProvider>
      </HouseholdProvider>
    </AuthProvider>
  );
}

export default App;
