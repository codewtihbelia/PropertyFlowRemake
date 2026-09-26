import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  StatusBar,
  Animated,
  Platform,
  Easing,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { NavigationBar } from "expo-navigation-bar";
import {
  NavVisibilityProvider,
  useNavVisibility,
} from "./context/NavVisibilityContext";

import { SplashScreen } from "./screens/SplashScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { BillsScreen } from "./screens/BillsScreen";
import { AttendanceScreen } from "./screens/AttendanceScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { AddExpenseScreen } from "./screens/AddExpenseScreen";
import { SettleDuesScreen } from "./screens/SettleDuesScreen";
import { ExpenseHistoryScreen } from "./screens/ExpenseHistoryScreen";
import { ExpenseDetailsScreen } from "./screens/ExpenseDetailsScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { ManageGroupScreen } from "./screens/ManageGroupScreen";
import { HostApplicationScreen } from "./screens/HostApplicationScreen";
import { registerForPushNotificationsAsync } from "./services/pushNotificationService";
import { mobileDataService } from "./services/firebaseDataService";
import { auth } from "./firebase/config";
import { UniversalLoader } from "./components/UniversalLoader";

type RootFlow = "splash" | "onboarding" | "auth" | "main";
type MainTab =
  | "home"
  | "groups"
  | "bills"
  | "attendance"
  | "messages"
  | "profile";
type OverlayScreen =
  | "none"
  | "add_expense"
  | "settle_dues"
  | "expense_history"
  | "expense_details"
  | "reports"
  | "manage_group"
  | "host_application";

interface NavItemConfig {
  key: MainTab;
  label: string;
  renderIcon: (active: boolean) => React.ReactNode;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    key: "home",
    label: "Home",
    renderIcon: (active) => (
      <Feather name="home" size={20} color={active ? "#FFFFFF" : "#64748B"} />
    ),
  },
  {
    key: "groups",
    label: "Groups",
    renderIcon: (active) => (
      <Ionicons
        name={active ? "people" : "people-outline"}
        size={22}
        color={active ? "#FFFFFF" : "#64748B"}
      />
    ),
  },
  {
    key: "bills",
    label: "Bills",
    renderIcon: (active) => (
      <Ionicons
        name={active ? "receipt" : "receipt-outline"}
        size={20}
        color={active ? "#FFFFFF" : "#64748B"}
      />
    ),
  },
  {
    key: "attendance",
    label: "Attendance",
    renderIcon: (active) => (
      <Ionicons
        name={active ? "calendar" : "calendar-outline"}
        size={20}
        color={active ? "#FFFFFF" : "#64748B"}
      />
    ),
  },
  {
    key: "profile",
    label: "Settings",
    renderIcon: (active) => (
      <Ionicons
        name={active ? "settings" : "settings-outline"}
        size={20}
        color={active ? "#FFFFFF" : "#64748B"}
      />
    ),
  },
];

function FloatingNavBar({
  currentTab,
  onSelectTab,
}: {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
}) {
  const insets = useSafeAreaInsets();
  const { navAnim, isVisible } = useNavVisibility();
  // With phone navigation bar hidden on Android, position menu sleekly near bottom
  const bottomOffset =
    Platform.OS === "android" ? 14 : Math.max(insets.bottom + 4, 18);

  const translateY = navAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 95],
  });

  const opacity = navAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.floatingBarWrapper,
        {
          bottom: bottomOffset,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents={isVisible ? "box-none" : "none"}
    >
      <View style={styles.floatingPill}>
        {NAV_ITEMS.map((item) => {
          const isActive = currentTab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navButton, isActive && styles.navButtonActive]}
              onPress={() => onSelectTab(item.key)}
              activeOpacity={0.8}
              accessibilityLabel={item.label}
            >
              {item.renderIcon(isActive)}
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const TAB_TRANSITION_META: Record<
  MainTab,
  { title: string; subtitle: string }
> = {
  home: {
    title: "Loading Home...",
    subtitle: "Preparing your balance & bills...",
  },
  groups: {
    title: "Loading Groups...",
    subtitle: "Connecting household members...",
  },
  bills: {
    title: "Loading Bills...",
    subtitle: "Calculating fair shares & utilities...",
  },
  attendance: {
    title: "Loading Attendance...",
    subtitle: "Syncing monthly calendar...",
  },
  messages: {
    title: "Loading Messages...",
    subtitle: "Connecting household chat...",
  },
  profile: {
    title: "Loading Settings...",
    subtitle: "Retrieving account configuration...",
  },
};

interface MainAppContentProps {
  rootFlow: RootFlow;
  setRootFlow: React.Dispatch<React.SetStateAction<RootFlow>>;
}

function MainAppContent({ rootFlow, setRootFlow }: MainAppContentProps) {
  const { showNav } = useNavVisibility();
  const [currentTab, setCurrentTab] = useState<MainTab>("home");
  const [visitedTabs, setVisitedTabs] = useState<Set<MainTab>>(
    () => new Set(["home"]),
  );
  const [navTransition, setNavTransition] = useState<{
    tab: MainTab;
    title: string;
    subtitle: string;
  } | null>(null);

  const transitionFadeAnim = useRef(new Animated.Value(0)).current;
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [billsInitialSubView, setBillsInitialSubView] = useState<
    "overview" | "pay"
  >("overview");
  const [manageGroupInitialView, setManageGroupInitialView] = useState<
    "details" | "create" | "join"
  >("details");
  const [overlayScreen, setOverlayScreen] = useState<OverlayScreen>("none");
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState({
    name: "Resident",
    role: "Member",
    email: "",
    avatar: "R",
  });

  const [isTransitionExiting, setIsTransitionExiting] = useState(false);

  const dismissTransition = () => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    setIsTransitionExiting(true);
    Animated.timing(transitionFadeAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setNavTransition(null);
      setIsTransitionExiting(false);
    });
  };

  const navigateToTab = (tab: MainTab, billsSubView?: "overview" | "pay") => {
    showNav();
    if (billsSubView) {
      setBillsInitialSubView(billsSubView);
    } else if (tab === "bills") {
      setBillsInitialSubView("overview");
    }
    setOverlayScreen("none");
    if (tab === currentTab) return;

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    const meta = TAB_TRANSITION_META[tab] || {
      title: "Loading...",
      subtitle: "Please wait a moment...",
    };

    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });

    setIsTransitionExiting(false);
    transitionFadeAnim.setValue(0);
    setNavTransition({ tab, ...meta });
    setCurrentTab(tab);

    // Smooth fade-in
    Animated.timing(transitionFadeAnim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Give a clear, satisfying 600ms presence so the user comfortably sees the loader card, then smoothly exit
    transitionTimerRef.current = setTimeout(() => {
      dismissTransition();
    }, 600);
  };

  const navigateToOverlay = (screen: OverlayScreen, setup?: () => void) => {
    if (setup) setup();
    setOverlayScreen(screen);
  };

  useEffect(() => {
    if (Platform.OS === "android") {
      try {
        if (rootFlow === "auth") {
          // Blue background at bottom: white navigation icons
          NavigationBar.setStyle("dark");
        } else {
          // Light #F8FAFC background at bottom: dark navigation icons
          NavigationBar.setStyle("light");
        }
        NavigationBar.setHidden(true);
      } catch {
        // Fallback safely in environments without native nav bar control
      }
    }
  }, [rootFlow]);

  useEffect(() => {
    if (Platform.OS === "android") {
      try {
        NavigationBar.setHidden(true);
      } catch {
        // Fallback safely
      }
    }
  }, [currentTab, overlayScreen]);

  if (rootFlow === "splash") {
    return <SplashScreen onFinish={() => setRootFlow("onboarding")} />;
  }

  if (rootFlow === "onboarding") {
    return <OnboardingScreen onComplete={() => setRootFlow("auth")} />;
  }

  if (rootFlow === "auth") {
    return (
      <View style={{ flex: 1, backgroundColor: "#2563EB" }}>
        <AuthScreen
          onLoginSuccess={(user) => {
            mobileDataService.clearCache();
            registerForPushNotificationsAsync(user.uid);
            const displayName = user.displayName || user.email || "Resident";
            setCurrentUser({
              name: displayName,
              role: (user.role || "MEMBER").replace("_", " "),
              email: user.email,
              avatar: displayName.charAt(0).toUpperCase(),
            });
            setCurrentTab("home");
            setVisitedTabs(new Set(["home"]));
            setOverlayScreen("none");
            setBillsInitialSubView("overview");
            setRootFlow("main");
          }}
        />
      </View>
    );
  }

  const renderOverlayScreen = () => {
    switch (overlayScreen) {
      case "add_expense":
        return (
          <AddExpenseScreen
            onBack={() => setOverlayScreen("none")}
            onSaveExpense={() => {
              setOverlayScreen("none");
              setBillsInitialSubView("overview");
              setCurrentTab("bills");
            }}
          />
        );
      case "settle_dues":
        return (
          <SettleDuesScreen
            onBack={() => setOverlayScreen("none")}
            onPayPress={() => {
              setOverlayScreen("none");
              setBillsInitialSubView("pay");
              setCurrentTab("bills");
            }}
          />
        );
      case "expense_history":
        return (
          <ExpenseHistoryScreen
            onBack={() => setOverlayScreen("none")}
            onAddExpensePress={() => navigateToOverlay("add_expense")}
            onSelectExpense={(expense) => {
              setSelectedExpense(expense);
              navigateToOverlay("expense_details");
            }}
          />
        );
      case "expense_details":
        return (
          <ExpenseDetailsScreen
            expense={selectedExpense}
            onBack={() => setOverlayScreen("expense_history")}
          />
        );
      case "reports":
        return <ReportScreen onBack={() => setOverlayScreen("none")} />;
      case "manage_group":
        return (
          <ManageGroupScreen
            onBack={() => setOverlayScreen("none")}
            onOpenAddExpense={() => navigateToOverlay("add_expense")}
            onOpenHostApplication={() => navigateToOverlay("host_application")}
            currentUser={currentUser}
            initialView={manageGroupInitialView}
          />
        );
      case "host_application":
        return (
          <HostApplicationScreen onBack={() => setOverlayScreen("none")} />
        );
      default:
        return null;
    }
  };

  const renderTabContent = (tab: MainTab, onLoaded?: () => void) => {
    switch (tab) {
      case "groups":
        return (
          <ManageGroupScreen
            onBack={() => navigateToTab("home")}
            onOpenAddExpense={() => navigateToOverlay("add_expense")}
            onOpenHostApplication={() => navigateToOverlay("host_application")}
            currentUser={currentUser}
            initialView={manageGroupInitialView}
            onLoaded={onLoaded}
          />
        );
      case "bills":
        return (
          <BillsScreen
            initialSubView={billsInitialSubView}
            onPayPress={() => {
              setBillsInitialSubView("pay");
            }}
            onLoaded={onLoaded}
          />
        );
      case "attendance":
        return <AttendanceScreen onLoaded={onLoaded} />;
      case "messages":
        return <MessagesScreen />;
      case "profile":
        return (
          <ProfileScreen
            currentUser={currentUser}
            onOpenHostApplication={() => navigateToOverlay("host_application")}
            onOpenManageGroup={(mode) => {
              setManageGroupInitialView(mode || "details");
              navigateToOverlay("manage_group");
            }}
            onOpenReports={() => navigateToOverlay("reports")}
            onOpenOnboarding={() => setRootFlow("onboarding")}
            onSignOut={async () => {
              await auth.signOut();
              mobileDataService.clearCache();
              setCurrentUser({
                name: "Resident",
                role: "Member",
                email: "",
                avatar: "R",
              });
              setCurrentTab("home");
              setVisitedTabs(new Set(["home"]));
              setOverlayScreen("none");
              setBillsInitialSubView("overview");
              setRootFlow("auth");
            }}
            onLoaded={onLoaded}
          />
        );
      case "home":
      default:
        return (
          <HomeScreen
            currentUser={{
              name: currentUser.name.split(" ")[0],
              avatar: currentUser.avatar,
            }}
            onNavigate={(navTarget: any) => {
              if (navTarget === "payments") {
                navigateToTab("bills", "pay");
              } else if (navTarget === "bills") {
                navigateToTab("bills", "overview");
              } else if (
                navTarget === "manage_group" ||
                navTarget === "add_expense" ||
                navTarget === "settle_dues" ||
                navTarget === "expense_history" ||
                navTarget === "reports" ||
                navTarget === "host_application"
              ) {
                navigateToOverlay(navTarget);
              } else {
                navigateToTab(navTarget);
              }
            }}
            onOpenAddExpense={() => navigateToOverlay("add_expense")}
            onOpenSettleDues={() => navigateToOverlay("settle_dues")}
            onOpenExpenseHistory={() => navigateToOverlay("expense_history")}
            onOpenManageGroup={(mode) => {
              setManageGroupInitialView(mode || "details");
              navigateToOverlay("manage_group");
            }}
            onOpenReports={() => navigateToOverlay("reports")}
            onOpenHostApplication={() => navigateToOverlay("host_application")}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Visited Tab Screens (kept mounted in memory, zero remount lag, no duplicate loaders) */}
      {Array.from(visitedTabs).map((tab) => (
        <View
          key={tab}
          style={[
            StyleSheet.absoluteFill,
            { display: currentTab === tab ? "flex" : "none" },
          ]}
        >
          {renderTabContent(tab, () => {
            // Screen is fully ready
          })}
        </View>
      ))}

      {/* Floating Bottom Navigation Bar (only visible when no overlay screen is open) */}
      {overlayScreen === "none" && (
        <FloatingNavBar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            navigateToTab(tab);
          }}
        />
      )}

      {/* Unique Transition Overlay using UniversalLoader */}
      {navTransition && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 9999,
              opacity: transitionFadeAnim,
            },
          ]}
          pointerEvents="auto"
        >
          <UniversalLoader
            text={navTransition.title}
            subtitle={navTransition.subtitle}
            transparent={true}
            isExiting={isTransitionExiting}
          />
        </Animated.View>
      )}

      {/* Overlay Screens (stacked on top of the base screen) */}
      {overlayScreen !== "none" && (
        <View style={StyleSheet.absoluteFill}>{renderOverlayScreen()}</View>
      )}
    </View>
  );
}

export default function App() {
  const [rootFlow, setRootFlow] = useState<RootFlow>("splash");

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <NavVisibilityProvider>
        <MainAppContent rootFlow={rootFlow} setRootFlow={setRootFlow} />
      </NavVisibilityProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  mainContent: { flex: 1, backgroundColor: "#F8FAFC" },
  floatingBarWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  floatingPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 9999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(241, 245, 249, 0.95)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8,
    gap: 6,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  navButtonActive: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
});
