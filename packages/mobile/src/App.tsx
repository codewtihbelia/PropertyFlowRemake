import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  StatusBar,
  Animated,
  Platform,
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
import { MessagesScreen } from "./screens/MessagesScreen";
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

interface MainAppContentProps {
  rootFlow: RootFlow;
  setRootFlow: React.Dispatch<React.SetStateAction<RootFlow>>;
}

function MainAppContent({ rootFlow, setRootFlow }: MainAppContentProps) {
  const { showNav } = useNavVisibility();
  const [currentTab, setCurrentTab] = useState<MainTab>("home");
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
            setOverlayScreen("none");
            setBillsInitialSubView("overview");
            setRootFlow("main");
          }}
        />
      </View>
    );
  }

  if (overlayScreen === "add_expense") {
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
  }

  if (overlayScreen === "settle_dues") {
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
  }

  if (overlayScreen === "expense_history") {
    return (
      <ExpenseHistoryScreen
        onBack={() => setOverlayScreen("none")}
        onAddExpensePress={() => setOverlayScreen("add_expense")}
        onSelectExpense={(expense) => {
          setSelectedExpense(expense);
          setOverlayScreen("expense_details");
        }}
      />
    );
  }

  if (overlayScreen === "expense_details") {
    return (
      <ExpenseDetailsScreen
        expense={selectedExpense}
        onBack={() => setOverlayScreen("expense_history")}
      />
    );
  }

  if (overlayScreen === "reports") {
    return <ReportScreen onBack={() => setOverlayScreen("none")} />;
  }

  if (overlayScreen === "manage_group") {
    return (
      <ManageGroupScreen
        onBack={() => setOverlayScreen("none")}
        onOpenAddExpense={() => setOverlayScreen("add_expense")}
        onOpenHostApplication={() => setOverlayScreen("host_application")}
        currentUser={currentUser}
        initialView={manageGroupInitialView}
      />
    );
  }

  if (overlayScreen === "host_application") {
    return <HostApplicationScreen onBack={() => setOverlayScreen("none")} />;
  }

  const renderTabContent = () => {
    switch (currentTab) {
      case "groups":
        return (
          <ManageGroupScreen
            onBack={() => setCurrentTab("home")}
            onOpenAddExpense={() => setOverlayScreen("add_expense")}
            onOpenHostApplication={() => setOverlayScreen("host_application")}
            currentUser={currentUser}
            initialView={manageGroupInitialView}
          />
        );
      case "bills":
        return (
          <BillsScreen
            initialSubView={billsInitialSubView}
            onPayPress={() => setBillsInitialSubView("pay")}
          />
        );
      case "attendance":
        return <AttendanceScreen />;
      case "messages":
        return <MessagesScreen />;
      case "profile":
        return (
          <ProfileScreen
            currentUser={currentUser}
            onOpenHostApplication={() => setOverlayScreen("host_application")}
            onOpenManageGroup={(mode) => {
              setManageGroupInitialView(mode || "details");
              setOverlayScreen("manage_group");
            }}
            onOpenReports={() => setOverlayScreen("reports")}
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
              setOverlayScreen("none");
              setBillsInitialSubView("overview");
              setRootFlow("auth");
            }}
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
            onNavigate={(tab: any) => {
              if (tab === "payments") {
                setBillsInitialSubView("pay");
                setCurrentTab("bills");
              } else if (tab === "bills") {
                setBillsInitialSubView("overview");
                setCurrentTab("bills");
              } else {
                setCurrentTab(tab);
              }
            }}
            onOpenAddExpense={() => setOverlayScreen("add_expense")}
            onOpenSettleDues={() => setOverlayScreen("settle_dues")}
            onOpenExpenseHistory={() => setOverlayScreen("expense_history")}
            onOpenManageGroup={(mode) => {
              setManageGroupInitialView(mode || "details");
              setOverlayScreen("manage_group");
            }}
            onOpenReports={() => setOverlayScreen("reports")}
            onOpenHostApplication={() => setOverlayScreen("host_application")}
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
      <View style={styles.mainContent}>{renderTabContent()}</View>

      <FloatingNavBar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          showNav();
          if (tab === "bills") {
            setBillsInitialSubView("overview");
          }
          setCurrentTab(tab);
        }}
      />
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
