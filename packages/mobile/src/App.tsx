import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Animated,
  Platform,
  Alert,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { NavigationBar } from "./utils/safeNavigationBar";
import {
  NavVisibilityProvider,
  useNavVisibility,
} from "./context/NavVisibilityContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

import { SplashScreen } from "./screens/SplashScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { BillsScreen } from "./screens/BillsScreen";
import { WalletScreen } from "./screens/WalletScreen";
import { AttendanceScreen } from "./screens/AttendanceScreen";
import { MessagesScreen } from "./screens/MessagesScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { AddExpenseScreen } from "./screens/AddExpenseScreen";
import { SettleDuesScreen } from "./screens/SettleDuesScreen";
import { ExpenseHistoryScreen } from "./screens/ExpenseHistoryScreen";
import { ExpenseDetailsScreen } from "./screens/ExpenseDetailsScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { ManageGroupScreen } from "./screens/ManageGroupScreen";
import { ViewGroupScreen } from "./screens/ViewGroupScreen";
import { HostApplicationScreen } from "./screens/HostApplicationScreen";
import { PaymentMethodConfigurationScreen } from "./screens/PaymentMethodConfigurationScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { TermsOfServiceScreen } from "./screens/TermsOfServiceScreen";
import { PrivacyPolicyScreen } from "./screens/PrivacyPolicyScreen";
import {
  registerForPushNotificationsAsync,
  setupNotificationChannelsAsync,
  setupNotificationResponseListener,
} from "./services/pushNotificationService";
import { mobileDataService } from "./services/firebaseDataService";
import { auth } from "./firebase/config";
import { alertService } from "./services/alertService";
import { CustomAlertModal } from "./components/CustomAlertModal";
import { AuthPinScreen } from "./screens/AuthPinScreen";
import { SavedProfileAuthScreen } from "./screens/SavedProfileAuthScreen";
import { PinSetupModal } from "./components/PinSetupModal";
import { NewUserPinPromptModal } from "./components/NewUserPinPromptModal";
import { authPinService, StoredPinUser } from "./services/authPinService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FloatingMessagesBubble } from "./components/FloatingMessagesBubble";
import { initAudioUnlock, playMessengerPopChime } from "./utils/soundEffects";
import { notificationService } from "./services/notificationService";
import { NotificationBanner } from "./components/NotificationBanner";
import { updateService } from "./services/updateService";

// Initialize global alert interceptor to upgrade all Alert.alert dialogs to app-matching UI
alertService.initAlertPatch();
// Silently check for and stage Over-The-Air updates in the background on app startup
updateService.initBackgroundUpdateCheck();
// Configure high-priority Android notification channels (sound, vibration, heads-up popups)
setupNotificationChannelsAsync();
// Immediately attach user gesture listeners to unlock Web Audio on first touch (web only)
if (Platform.OS === "web") {
  initAudioUnlock();
}

type RootFlow =
  | "splash"
  | "onboarding"
  | "auth"
  | "saved_profile"
  | "pin_keypad"
  | "main";
type MainTab =
  | "home"
  | "groups"
  | "wallet"
  | "bills"
  | "attendance"
  | "messages"
  | "profile";
type OverlayScreen =
  | "none"
  | "notifications"
  | "messages"
  | "add_expense"
  | "settle_dues"
  | "expense_history"
  | "expense_details"
  | "reports"
  | "manage_group"
  | "view_group"
  | "host_application"
  | "payment_method_configuration"
  | "terms_of_service"
  | "privacy_policy";

interface NavItemConfig {
  key: MainTab;
  label: string;
  renderIcon: (active: boolean, isDark?: boolean) => React.ReactNode;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    key: "home",
    label: "Home",
    renderIcon: (active, isDark) => (
      <Feather
        name="home"
        size={20}
        color={active ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"}
      />
    ),
  },
  {
    key: "groups",
    label: "Groups",
    renderIcon: (active, isDark) => (
      <Ionicons
        name={active ? "people" : "people-outline"}
        size={22}
        color={active ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"}
      />
    ),
  },
  {
    key: "wallet",
    label: "Wallet",
    renderIcon: (active, isDark) => (
      <Ionicons
        name={active ? "wallet" : "wallet-outline"}
        size={20}
        color={active ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"}
      />
    ),
  },
  {
    key: "bills",
    label: "Bills",
    renderIcon: (active, isDark) => (
      <Ionicons
        name={active ? "receipt" : "receipt-outline"}
        size={20}
        color={active ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"}
      />
    ),
  },
  {
    key: "attendance",
    label: "Attendance",
    renderIcon: (active, isDark) => (
      <Ionicons
        name={active ? "calendar" : "calendar-outline"}
        size={20}
        color={active ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"}
      />
    ),
  },
  {
    key: "profile",
    label: "Settings",
    renderIcon: (active, isDark) => (
      <Ionicons
        name={active ? "settings" : "settings-outline"}
        size={20}
        color={active ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"}
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
  const { isDark, colors } = useTheme();
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
      <View
        style={[
          styles.floatingPill,
          {
            backgroundColor: colors.navBackground,
            borderColor: colors.navBorder,
          },
          isDark && {
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.55,
            shadowRadius: 20,
            elevation: 12,
          },
        ]}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = currentTab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.navButton,
                isActive && {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                },
              ]}
              onPress={() => onSelectTab(item.key)}
              activeOpacity={0.8}
              accessibilityLabel={item.label}
            >
              {item.renderIcon(isActive, isDark)}
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
  const { isDark, colors } = useTheme();
  const [currentTab, setCurrentTab] = useState<MainTab>("home");
  const [billsInitialSubView, setBillsInitialSubView] = useState<
    "overview" | "pay"
  >("overview");
  const [manageGroupInitialView, setManageGroupInitialView] = useState<
    "details" | "create" | "join"
  >("details");
  const [overlayScreen, setOverlayScreen] = useState<OverlayScreen>("none");
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [attendanceHasUnsavedChanges, setAttendanceHasUnsavedChanges] =
    useState<boolean>(false);
  const [pendingAttendanceLeave, setPendingAttendanceLeave] = useState<
    (() => void) | null
  >(null);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    role: string;
    email: string;
    avatar: string;
    photoURL?: string;
  }>({
    name: "Resident",
    role: "Member",
    email: "",
    avatar: "R",
  });
  const [userProfile, setUserProfile] = useState<any>(() =>
    mobileDataService.getCachedProfile(auth.currentUser?.uid),
  );
  const [householdId, setHouseholdId] = useState<string>(() => {
    const cached = mobileDataService.getCachedProfile(auth.currentUser?.uid);
    return cached?.householdId || "";
  });

  const [savedProfileUser, setSavedProfileUser] =
    useState<StoredPinUser | null>(null);
  const [authInitialTab, setAuthInitialTab] = useState<"signin" | "signup">(
    "signin",
  );
  const [showNewUserPinPrompt, setShowNewUserPinPrompt] =
    useState<boolean>(false);
  const [showNewUserPinSetupModal, setShowNewUserPinSetupModal] =
    useState<boolean>(false);
  const [saveProfilePromptData, setSaveProfilePromptData] = useState<{
    uid: string;
    displayName: string;
    email: string;
    role: string;
    hasExistingPin: boolean;
    isOverride?: boolean;
    existingSavedUser?: {
      displayName?: string;
      email?: string;
      uid?: string;
    } | null;
  } | null>(null);

  const performCleanSignOut = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.warn("Sign out notice:", e);
    }
    // Clean all state, tracking refs & cache immediately
    mobileDataService.clearCache();
    setHouseholdId("");
    setUserProfile(null);
    setCurrentUser({
      name: "Resident",
      role: "Member",
      email: "",
      avatar: "R",
    });
    setUnreadMessagesCount(0);
    setLatestUnreadMessage(null);
    seenMessageIds.current = new Set();
    isInitialLoad.current = true;
    setCurrentTab("home");
    setOverlayScreen("none");
    setBillsInitialSubView("overview");
  };

  useEffect(() => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser?.uid) return;
    const unsub = mobileDataService.listenToUserProfile(
      firebaseUser.uid,
      (p) => {
        if (p) {
          setUserProfile(p);
          setHouseholdId(p.householdId || "");
          const pic = p.profilePicture || p.photoURL;
          if (pic) {
            authPinService.cacheUserAvatar(firebaseUser.uid, pic);
            setSavedProfileUser((prev) => {
              if (
                prev &&
                prev.uid === firebaseUser.uid &&
                prev.photoURL !== pic
              ) {
                return { ...prev, photoURL: pic };
              }
              return prev;
            });
          }
        } else {
          // If no profile exists yet (new signup), ensure householdId is cleanly empty
          setHouseholdId("");
          setUserProfile(null);
        }
      },
    );
    return () => unsub();
  }, [rootFlow]);

  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [latestUnreadMessage, setLatestUnreadMessage] = useState<{
    id: string;
    senderName: string;
    text: string;
  } | null>(null);

  const seenMessageIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Focus messages view or group approval when a system push notification is tapped
  useEffect(() => {
    notificationService.setOnClickCallback(() => {
      setOverlayScreen("messages");
    });

    const unsubPush = setupNotificationResponseListener((data) => {
      if (!data) return;
      if (data.screen === "messages") {
        setOverlayScreen("messages");
      } else if (data.screen === "group_manage") {
        setCurrentTab("groups");
        setManageGroupInitialView("details");
        setOverlayScreen("none");
      } else if (data.screen === "notifications") {
        setOverlayScreen("notifications");
      }
    });

    return () => {
      unsubPush();
    };
  }, []);

  useEffect(() => {
    // Reset seen message tracking whenever the active household changes
    seenMessageIds.current = new Set();
    isInitialLoad.current = true;

    if (!householdId) {
      setUnreadMessagesCount(0);
      setLatestUnreadMessage(null);
      return;
    }
    const currentUid = auth.currentUser?.uid;
    // Heartbeat update
    mobileDataService.updateUserHeartbeat(householdId, currentUid);
    const heartbeatInterval = setInterval(() => {
      mobileDataService.updateUserHeartbeat(householdId, currentUid);
    }, 120000);

    const unsub = mobileDataService.listenToHouseholdMessages(
      householdId,
      (msgs) => {
        if (!currentUid) {
          setUnreadMessagesCount(0);
          setLatestUnreadMessage(null);
          return;
        }
        const unread = (msgs || []).filter((m: any) => {
          if (!m || m.senderId === currentUid) return false;
          if ((m.readBy || []).includes(currentUid)) return false;

          // 1. Group broadcast messages (visible to all household members)
          const isGroupMsg =
            m.conversationId === "household_group" ||
            m.recipientId === "ALL" ||
            (!m.conversationId && !m.recipientId);

          // 2. Direct 1-on-1 messages (strictly private between sender and recipient)
          const isDirectToMe =
            m.recipientId === currentUid ||
            (m.conversationId &&
              m.conversationId.startsWith("dm_") &&
              m.conversationId.includes(currentUid) &&
              (m.recipientId === currentUid || !m.recipientId));

          return isGroupMsg || isDirectToMe;
        });

        // Detect newly arrived messages for currentUid after initial data sync
        if (!isInitialLoad.current && msgs && msgs.length > 0) {
          const brandNewMsgs = unread.filter(
            (m: any) => !seenMessageIds.current.has(m.id),
          );
          if (brandNewMsgs.length > 0) {
            playMessengerPopChime();
            const latest = brandNewMsgs[brandNewMsgs.length - 1];
            const isGroup =
              latest.conversationId === "household_group" ||
              latest.recipientId === "ALL" ||
              (!latest.conversationId && !latest.recipientId);
            const sender = (latest.senderName || "Roommate").split(" ")[0];

            // If app is hidden / in background on mobile or web, fire system push notification!
            if (typeof document !== "undefined" && document.hidden) {
              notificationService.showNotification({
                title: isGroup
                  ? `${sender} in Bills Group`
                  : `${sender} (Direct Message)`,
                body: latest.text || "Sent a message",
                tag: latest.id,
                data: {
                  conversationId: latest.conversationId,
                  messageId: latest.id,
                },
              });
            }
          }
        }

        // Store known message IDs
        seenMessageIds.current = new Set((msgs || []).map((m: any) => m.id));
        isInitialLoad.current = false;

        setUnreadMessagesCount(unread.length);
        if (unread.length > 0) {
          const lastMsg = unread[unread.length - 1];
          setLatestUnreadMessage({
            id: lastMsg.id,
            senderName: (lastMsg.senderName || "Roommate").split(" ")[0],
            text: lastMsg.text || "Sent a message",
          });
        } else {
          setLatestUnreadMessage(null);
        }
      },
    );
    return () => {
      unsub();
      clearInterval(heartbeatInterval);
    };
  }, [householdId, rootFlow]);

  const isHostUser = Boolean(
    userProfile?.role === "HOST" ||
    userProfile?.role === "SUPER_ADMIN" ||
    userProfile?.hostApplicationStatus === "APPROVED" ||
    currentUser.role === "HOST" ||
    currentUser.role === "SUPER ADMIN",
  );

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

  const handleSplashFinish = async () => {
    const savedUser = await authPinService.getSavedDeviceProfile();
    const firebaseUser = auth.currentUser;

    // Security check: if there is a saved profile on this device, but auth.currentUser belongs to a different account
    if (savedUser && firebaseUser && firebaseUser.uid !== savedUser.uid) {
      console.warn(
        "Mismatched active session on phone with saved profile, signing out guest session:",
        firebaseUser.email,
      );
      await performCleanSignOut();
      setSavedProfileUser(savedUser);
      setRootFlow("saved_profile");
      return;
    }

    if (savedUser) {
      setSavedProfileUser(savedUser);
      const isPinEnabled = await authPinService.isPinEnabled(savedUser.uid);
      if (isPinEnabled) {
        setRootFlow("saved_profile");
        return;
      }
    }

    if (firebaseUser?.uid) {
      const isPinEnabled = await authPinService.isPinEnabled(firebaseUser.uid);
      const isSaved = await authPinService.isDeviceProfileSaved(
        firebaseUser.uid,
      );
      const displayName =
        firebaseUser.displayName || firebaseUser.email || "Resident";
      setCurrentUser({
        name: displayName,
        role: "MEMBER",
        email: firebaseUser.email || "",
        avatar: displayName.charAt(0).toUpperCase(),
      });
      if (isPinEnabled && isSaved) {
        setSavedProfileUser(
          savedUser || {
            uid: firebaseUser.uid,
            displayName,
            email: firebaseUser.email || "",
            photoURL: firebaseUser.photoURL || undefined,
          },
        );
        setRootFlow("saved_profile");
        return;
      }
      setRootFlow("main");
    } else {
      // Check if there is an explicitly saved profile on this device
      if (savedUser) {
        setSavedProfileUser(savedUser);
        setRootFlow("saved_profile");
        return;
      }

      try {
        const onboardingDone = await AsyncStorage.getItem(
          "@splitzy_onboarding_completed",
        );
        if (onboardingDone === "true") {
          setRootFlow("auth");
        } else {
          setRootFlow("onboarding");
        }
      } catch {
        setRootFlow("onboarding");
      }
    }
  };

  if (rootFlow === "splash") {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (rootFlow === "onboarding") {
    return (
      <OnboardingScreen
        onComplete={async () => {
          try {
            await AsyncStorage.setItem("@splitzy_onboarding_completed", "true");
          } catch {}
          setRootFlow("auth");
        }}
      />
    );
  }

  // Dedicated Facebook-style Saved Profile Screen for quick entry
  if (rootFlow === "saved_profile" && savedProfileUser) {
    return (
      <SavedProfileAuthScreen
        user={savedProfileUser}
        onContinueWithPin={() => {
          setRootFlow("pin_keypad");
        }}
        onPasswordLoginSuccess={async (user) => {
          mobileDataService.clearCache();
          seenMessageIds.current = new Set();
          isInitialLoad.current = true;
          setUnreadMessagesCount(0);
          setLatestUnreadMessage(null);
          setHouseholdId("");
          setUserProfile(null);

          registerForPushNotificationsAsync(user.uid);
          const displayName = user.displayName || user.email || "Resident";
          setCurrentUser({
            name: displayName,
            role: (user.role || "MEMBER").replace("_", " "),
            email: user.email,
            avatar: displayName.charAt(0).toUpperCase(),
          });
          try {
            const profile = await mobileDataService.getUserProfile(user.uid);
            if (profile) {
              setUserProfile(profile);
              setHouseholdId(profile.householdId || "");
            }
          } catch (e) {
            console.warn("Profile fetch after password login notice:", e);
          }
          setCurrentTab("home");
          setOverlayScreen("none");
          setBillsInitialSubView("overview");
          setRootFlow("main");
        }}
        onUseAnotherProfile={async () => {
          setSavedProfileUser(null);
          await performCleanSignOut();
          setAuthInitialTab("signin");
          setRootFlow("auth");
        }}
        onCreateNewAccount={async () => {
          setSavedProfileUser(null);
          await performCleanSignOut();
          setAuthInitialTab("signup");
          setRootFlow("auth");
        }}
        onProfileRemoved={async () => {
          setSavedProfileUser(null);
          await performCleanSignOut();
          setAuthInitialTab("signin");
          setRootFlow("auth");
        }}
      />
    );
  }

  // 4-Digit PIN Keypad Screen transitioned from Saved Profile
  if (rootFlow === "pin_keypad" && savedProfileUser) {
    return (
      <AuthPinScreen
        user={{
          uid: savedProfileUser.uid,
          displayName: savedProfileUser.displayName,
          email: savedProfileUser.email,
          photoURL: savedProfileUser.photoURL,
        }}
        onUnlockSuccess={async (enteredPin?: string) => {
          // 1. If a different user is active in Firebase Auth, force clean sign out immediately
          if (
            auth.currentUser &&
            auth.currentUser.uid !== savedProfileUser.uid
          ) {
            await performCleanSignOut();
          } else {
            mobileDataService.clearCache();
            seenMessageIds.current = new Set();
            isInitialLoad.current = true;
            setUnreadMessagesCount(0);
            setLatestUnreadMessage(null);
            setHouseholdId("");
            setUserProfile(null);
          }

          // 2. Ensure Firebase Auth session is active and matches the saved user
          if (auth.currentUser?.uid !== savedProfileUser.uid) {
            let sessionRestored = false;
            if (enteredPin) {
              const result = await authPinService.restoreFirebaseSessionWithPin(
                savedProfileUser.uid,
                enteredPin,
              );
              if (
                result.success &&
                auth.currentUser?.uid === savedProfileUser.uid
              ) {
                sessionRestored = true;
              }
            }

            if (!sessionRestored) {
              Alert.alert(
                "Password Required",
                `PIN verified! Please sign in once with your password for ${savedProfileUser.displayName || savedProfileUser.email} to authorize instant 1-tap PIN sign-in on this device.`,
                [
                  {
                    text: "Sign In with Password",
                    onPress: () => {
                      setRootFlow("saved_profile");
                    },
                  },
                ],
              );
              return;
            }
          }

          // 3. Strictly use savedProfileUser UID - never fall back to an unverified user
          const activeUid = savedProfileUser.uid;
          registerForPushNotificationsAsync(activeUid);
          const displayName =
            savedProfileUser.displayName ||
            savedProfileUser.email ||
            "Resident";
          setCurrentUser({
            name: displayName,
            role: (savedProfileUser.role || "MEMBER").replace("_", " "),
            email: savedProfileUser.email,
            avatar: displayName.charAt(0).toUpperCase(),
          });

          // 4. Fetch full profile and household ID to guarantee complete dashboard access
          try {
            const profile = await mobileDataService.getUserProfile(activeUid);
            if (profile) {
              setUserProfile(profile);
              setHouseholdId(profile.householdId || "");
            }
          } catch (e) {
            console.warn("Profile fetch after PIN unlock notice:", e);
          }

          setCurrentTab("home");
          setOverlayScreen("none");
          setBillsInitialSubView("overview");
          setRootFlow("main");
        }}
        onSwitchAccount={async () => {
          setSavedProfileUser(null);
          await performCleanSignOut();
          setAuthInitialTab("signin");
          setRootFlow("auth");
        }}
        onBack={() => {
          setRootFlow("saved_profile");
        }}
      />
    );
  }

  if (rootFlow === "auth") {
    return (
      <View style={{ flex: 1, backgroundColor: "#2563EB" }}>
        <AuthScreen
          initialTab={authInitialTab}
          onBackToSavedProfile={
            savedProfileUser ? () => setRootFlow("saved_profile") : undefined
          }
          onLoginSuccess={async (user) => {
            mobileDataService.clearCache();
            seenMessageIds.current = new Set();
            isInitialLoad.current = true;
            setUnreadMessagesCount(0);
            setLatestUnreadMessage(null);

            registerForPushNotificationsAsync(user.uid);

            const displayName = user.displayName || user.email || "Resident";
            setCurrentUser({
              name: displayName,
              role: (user.role || "MEMBER").replace("_", " "),
              email: user.email,
              avatar: displayName.charAt(0).toUpperCase(),
              photoURL: user.photoURL,
            });

            // Set householdId from user (or empty string if new user!)
            setHouseholdId(user.householdId || "");
            if (!user.householdId) {
              setUserProfile(null);
            }

            setCurrentTab("home");
            setOverlayScreen("none");
            setBillsInitialSubView("overview");

            // --- DEVICE CHECK: Finance security (1 saved profile per device rule) ---
            const existingSavedUser =
              await authPinService.getSavedDeviceProfile();

            if (existingSavedUser && existingSavedUser.uid === user.uid) {
              // Current account is ALREADY the saved profile on this device
              const cachedAvatar = await authPinService.getCachedUserAvatar(
                user.uid,
              );
              const photoURL =
                (user as any).photoURL ||
                cachedAvatar ||
                existingSavedUser.photoURL ||
                userProfile?.profilePicture ||
                auth.currentUser?.photoURL ||
                undefined;
              if (photoURL) {
                await authPinService.cacheUserAvatar(user.uid, photoURL);
              }
              await authPinService.saveLastPinUser({
                uid: user.uid,
                displayName,
                email: user.email,
                role: user.role || "PAYOR",
                photoURL,
              });
              setSavedProfileUser({
                uid: user.uid,
                displayName,
                email: user.email,
                role: user.role || "PAYOR",
                photoURL,
              });
            } else if (
              existingSavedUser &&
              existingSavedUser.uid !== user.uid
            ) {
              // A DIFFERENT account is already saved on this device!
              // Since this is a finance app, explicitly ask if they want to override the saved device profile.
              const hasCloudPin = await authPinService.hasPinConfigured(
                user.uid,
              );
              setSaveProfilePromptData({
                uid: user.uid,
                displayName,
                email: user.email,
                role: user.role || "PAYOR",
                hasExistingPin: hasCloudPin,
                isOverride: true,
                existingSavedUser,
              });
              setShowNewUserPinPrompt(true);
            } else {
              // No profile saved on device yet: ask if they want to save profile
              const shouldPrompt = await authPinService.shouldPromptSaveProfile(
                user.uid,
              );
              if (shouldPrompt) {
                const hasCloudPin = await authPinService.hasPinConfigured(
                  user.uid,
                );
                setSaveProfilePromptData({
                  uid: user.uid,
                  displayName,
                  email: user.email,
                  role: user.role || "PAYOR",
                  hasExistingPin: hasCloudPin,
                  isOverride: false,
                  existingSavedUser: null,
                });
                setShowNewUserPinPrompt(true);
              }
            }

            // Immediately enter the main dashboard directly without any secondary lock
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
        onAddExpensePress={
          isHostUser ? () => setOverlayScreen("add_expense") : undefined
        }
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
    return (
      <ReportScreen
        onBack={() => setOverlayScreen("none")}
        onOpenSettleDues={() => setOverlayScreen("settle_dues")}
      />
    );
  }

  if (overlayScreen === "view_group") {
    return (
      <ViewGroupScreen
        onBack={() => setOverlayScreen("none")}
        onOpenSettleDues={() => setOverlayScreen("settle_dues")}
        onOpenHostApplication={() => setOverlayScreen("host_application")}
        currentUser={currentUser}
      />
    );
  }

  if (overlayScreen === "manage_group") {
    if (!isHostUser && manageGroupInitialView === "details") {
      return (
        <ViewGroupScreen
          onBack={() => {
            setOverlayScreen("none");
            setManageGroupInitialView("details");
          }}
          onOpenSettleDues={() => setOverlayScreen("settle_dues")}
          onOpenHostApplication={() => {
            setOverlayScreen("host_application");
            setManageGroupInitialView("details");
          }}
          currentUser={currentUser}
        />
      );
    }
    return (
      <ManageGroupScreen
        onBack={() => {
          setOverlayScreen("none");
          setManageGroupInitialView("details");
        }}
        onOpenAddExpense={() => {
          setOverlayScreen("add_expense");
          setManageGroupInitialView("details");
        }}
        onOpenSettleDues={() => setOverlayScreen("settle_dues")}
        onOpenHostApplication={() => {
          setOverlayScreen("host_application");
          setManageGroupInitialView("details");
        }}
        onOpenPaymentMethodConfiguration={() => {
          setOverlayScreen("payment_method_configuration");
        }}
        currentUser={currentUser}
        initialView={manageGroupInitialView}
      />
    );
  }

  if (overlayScreen === "payment_method_configuration") {
    return (
      <PaymentMethodConfigurationScreen
        onBack={() => setOverlayScreen("manage_group")}
        onOpenHostApplication={() => setOverlayScreen("host_application")}
      />
    );
  }

  if (overlayScreen === "host_application") {
    return <HostApplicationScreen onBack={() => setOverlayScreen("none")} />;
  }

  if (overlayScreen === "terms_of_service") {
    return <TermsOfServiceScreen onBack={() => setOverlayScreen("none")} />;
  }

  if (overlayScreen === "privacy_policy") {
    return <PrivacyPolicyScreen onBack={() => setOverlayScreen("none")} />;
  }

  if (overlayScreen === "messages") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={colors.statusBar}
          translucent
          backgroundColor="transparent"
        />
        <MessagesScreen
          onBack={() => setOverlayScreen("none")}
          householdId={householdId}
          currentUser={{
            ...currentUser,
            photoURL:
              userProfile?.profilePicture ||
              userProfile?.photoURL ||
              auth.currentUser?.photoURL ||
              undefined,
          }}
          onOpenSettleDues={() => {
            setOverlayScreen("settle_dues");
          }}
          onOpenAddExpense={
            isHostUser ? () => setOverlayScreen("add_expense") : undefined
          }
        />
      </View>
    );
  }

  if (overlayScreen === "notifications") {
    return (
      <NotificationsScreen
        onBack={() => setOverlayScreen("none")}
        householdId={householdId}
        onNavigate={(tab: any) => {
          setOverlayScreen("none");
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
        onOpenSettleDues={() => setOverlayScreen("settle_dues")}
        onOpenExpenseHistory={() => setOverlayScreen("expense_history")}
        onOpenViewGroup={() => setOverlayScreen("view_group")}
        onOpenManageGroup={(mode) => {
          if (!isHostUser && (!mode || mode === "details")) {
            setOverlayScreen("view_group");
            return;
          }
          setManageGroupInitialView(mode || "details");
          setOverlayScreen("manage_group");
        }}
      />
    );
  }

  const renderTabContent = () => {
    switch (currentTab) {
      case "groups":
        if (!isHostUser && manageGroupInitialView === "details") {
          return (
            <ViewGroupScreen
              onBack={() => {
                setCurrentTab("home");
                setManageGroupInitialView("details");
              }}
              onOpenSettleDues={() => setOverlayScreen("settle_dues")}
              onOpenHostApplication={() => setOverlayScreen("host_application")}
              currentUser={currentUser}
            />
          );
        }
        return (
          <ManageGroupScreen
            onBack={() => {
              setCurrentTab("home");
              setManageGroupInitialView("details");
            }}
            onOpenAddExpense={() => setOverlayScreen("add_expense")}
            onOpenSettleDues={() => setOverlayScreen("settle_dues")}
            onOpenHostApplication={() => setOverlayScreen("host_application")}
            currentUser={currentUser}
            initialView={manageGroupInitialView}
          />
        );
      case "wallet":
        return (
          <WalletScreen
            userId={userProfile?.uid || auth.currentUser?.uid || "guest"}
            currentUser={currentUser}
            onNavigateToBills={() => {
              setBillsInitialSubView("pay");
              setCurrentTab("bills");
            }}
            onNavigateToSettle={() => setOverlayScreen("settle_dues")}
          />
        );
      case "bills":
        return (
          <BillsScreen
            onBack={() => setCurrentTab("home")}
            householdId={householdId}
            initialSubView={billsInitialSubView}
            onPayPress={() => setBillsInitialSubView("pay")}
          />
        );
      case "attendance":
        return (
          <AttendanceScreen
            householdId={householdId}
            onBack={() => setCurrentTab("home")}
            onUnsavedChangesChange={setAttendanceHasUnsavedChanges}
            pendingLeaveAction={pendingAttendanceLeave}
            onClearPendingLeave={() => setPendingAttendanceLeave(null)}
          />
        );
      case "messages":
        return (
          <MessagesScreen
            onBack={() => setCurrentTab("home")}
            householdId={householdId}
            currentUser={currentUser}
            onOpenSettleDues={() => {
              setOverlayScreen("settle_dues");
            }}
            onOpenAddExpense={
              isHostUser ? () => setOverlayScreen("add_expense") : undefined
            }
          />
        );
      case "profile":
        return (
          <ProfileScreen
            onBack={() => setCurrentTab("home")}
            currentUser={currentUser}
            onOpenHostApplication={() => setOverlayScreen("host_application")}
            onOpenViewGroup={() => setOverlayScreen("view_group")}
            onOpenManageGroup={(mode) => {
              if (!isHostUser && (!mode || mode === "details")) {
                setOverlayScreen("view_group");
                return;
              }
              setManageGroupInitialView(mode || "details");
              setOverlayScreen("manage_group");
            }}
            onOpenReports={() => setOverlayScreen("reports")}
            onOpenOnboarding={() => setRootFlow("onboarding")}
            onOpenTermsOfService={() => setOverlayScreen("terms_of_service")}
            onOpenPrivacyPolicy={() => setOverlayScreen("privacy_policy")}
            onSignOut={async () => {
              const savedUser = await authPinService.getLastPinUser();
              await performCleanSignOut();

              // If a profile is saved on this device, return to Saved Profile screen for 1-tap re-entry
              if (savedUser) {
                setSavedProfileUser(savedUser);
                setRootFlow("saved_profile");
              } else {
                setSavedProfileUser(null);
                setAuthInitialTab("signin");
                setRootFlow("auth");
              }
            }}
          />
        );
      case "home":
      default:
        return (
          <HomeScreen
            householdId={householdId}
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
            onOpenViewGroup={() => setOverlayScreen("view_group")}
            onOpenManageGroup={(mode) => {
              if (!isHostUser && (!mode || mode === "details")) {
                setOverlayScreen("view_group");
                return;
              }
              setManageGroupInitialView(mode || "details");
              setOverlayScreen("manage_group");
            }}
            onOpenReports={() => setOverlayScreen("reports")}
            onOpenHostApplication={() => setOverlayScreen("host_application")}
            onOpenNotifications={() => setOverlayScreen("notifications")}
          />
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.statusBar}
        translucent
        backgroundColor="transparent"
      />
      <View
        style={[styles.mainContent, { backgroundColor: colors.background }]}
      >
        {currentTab === "home" && overlayScreen === "none" && (
          <NotificationBanner />
        )}
        {renderTabContent()}
      </View>

      {currentTab !== "groups" && (
        <FloatingNavBar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            showNav();
            if (
              currentTab === "attendance" &&
              tab !== "attendance" &&
              attendanceHasUnsavedChanges
            ) {
              setPendingAttendanceLeave(() => () => {
                setAttendanceHasUnsavedChanges(false);
                if (tab === "bills") {
                  setBillsInitialSubView("overview");
                }
                if (tab === "groups") {
                  setManageGroupInitialView("details");
                }
                setCurrentTab(tab);
              });
              return;
            }
            if (tab === "bills") {
              setBillsInitialSubView("overview");
            }
            if (tab === "groups") {
              setManageGroupInitialView("details");
            }
            setCurrentTab(tab);
          }}
        />
      )}

      {/* Floating draggable messages widget, floating and draggable across the screen */}
      {currentTab !== "messages" && overlayScreen === "none" && (
        <FloatingMessagesBubble
          unreadCount={unreadMessagesCount}
          latestUnreadMessage={latestUnreadMessage}
          onPress={() => {
            setOverlayScreen("messages");
          }}
        />
      )}

      {/* Smooth Save Profile & Quick PIN Prompt Modal (fading/sliding from bottom) */}
      {auth.currentUser?.uid && (
        <NewUserPinPromptModal
          visible={showNewUserPinPrompt}
          userName={saveProfilePromptData?.displayName || currentUser.name}
          userEmail={saveProfilePromptData?.email || currentUser.email}
          hasExistingPin={Boolean(saveProfilePromptData?.hasExistingPin)}
          isOverride={Boolean(saveProfilePromptData?.isOverride)}
          existingSavedUser={saveProfilePromptData?.existingSavedUser}
          onSetUpNow={async () => {
            setShowNewUserPinPrompt(false);
            if (!auth.currentUser?.uid) return;

            // If this is an override, first clear the previous user's device profile
            if (
              saveProfilePromptData?.isOverride &&
              saveProfilePromptData?.existingSavedUser?.uid
            ) {
              await authPinService.removeDeviceProfile(
                saveProfilePromptData.existingSavedUser.uid,
              );
            }

            const currentUid = auth.currentUser.uid;
            const displayName =
              saveProfilePromptData?.displayName || currentUser.name;
            const email = saveProfilePromptData?.email || currentUser.email;
            const role = saveProfilePromptData?.role || "PAYOR";
            const cachedAvatar =
              await authPinService.getCachedUserAvatar(currentUid);
            const photoURL =
              (saveProfilePromptData as any)?.photoURL ||
              cachedAvatar ||
              auth.currentUser?.photoURL ||
              userProfile?.profilePicture ||
              undefined;
            if (photoURL) {
              await authPinService.cacheUserAvatar(currentUid, photoURL);
            }

            if (saveProfilePromptData?.hasExistingPin) {
              try {
                await authPinService.saveProfileAndEnableExistingPin({
                  uid: currentUid,
                  displayName,
                  email,
                  role,
                  photoURL,
                });
                setSavedProfileUser({
                  uid: currentUid,
                  displayName,
                  email,
                  role,
                  photoURL,
                });
                alertService.show({
                  title: saveProfilePromptData?.isOverride
                    ? "Profile Overridden & Saved"
                    : "Profile Saved on Device",
                  message:
                    "This device is now registered to your account! You can use your 4-digit PIN for quick access anytime.",
                  type: "success",
                });
              } catch {
                setShowNewUserPinSetupModal(true);
              }
            } else {
              setShowNewUserPinSetupModal(true);
            }
          }}
          onMaybeLater={async () => {
            setShowNewUserPinPrompt(false);
            if (!saveProfilePromptData?.isOverride && auth.currentUser?.uid) {
              await authPinService.dismissNewUserPrompt(auth.currentUser.uid);
            }
          }}
        />
      )}

      {/* 4-Digit PIN Setup Modal */}
      {auth.currentUser?.uid && (
        <PinSetupModal
          visible={showNewUserPinSetupModal}
          onClose={async () => {
            setShowNewUserPinSetupModal(false);
            // Even if PIN creation modal was closed, save profile for 1-tap quick password sign-in
            if (auth.currentUser?.uid) {
              const photoURL =
                (saveProfilePromptData as any)?.photoURL ||
                auth.currentUser?.photoURL ||
                userProfile?.profilePicture ||
                undefined;
              await authPinService.saveDeviceProfile({
                uid: auth.currentUser.uid,
                displayName:
                  saveProfilePromptData?.displayName || currentUser.name,
                email: saveProfilePromptData?.email || currentUser.email,
                role: saveProfilePromptData?.role || "PAYOR",
                photoURL,
              });
              setSavedProfileUser({
                uid: auth.currentUser.uid,
                displayName:
                  saveProfilePromptData?.displayName || currentUser.name,
                email: saveProfilePromptData?.email || currentUser.email,
                role: saveProfilePromptData?.role || "PAYOR",
                photoURL,
              });
            }
          }}
          uid={auth.currentUser.uid}
          isChangeMode={false}
          onSuccess={async () => {
            setShowNewUserPinSetupModal(false);
            if (auth.currentUser?.uid) {
              const photoURL =
                (saveProfilePromptData as any)?.photoURL ||
                auth.currentUser?.photoURL ||
                userProfile?.profilePicture ||
                undefined;
              setSavedProfileUser({
                uid: auth.currentUser.uid,
                displayName:
                  saveProfilePromptData?.displayName || currentUser.name,
                email: saveProfilePromptData?.email || currentUser.email,
                role: saveProfilePromptData?.role || "PAYOR",
                photoURL,
              });
            }
            alertService.show({
              title: "Profile Saved & PIN Ready",
              message:
                "Your 4-digit PIN is active and your profile is saved on this device. You can now use it anytime to easily access your dashboard!",
              type: "success",
            });
          }}
        />
      )}
    </View>
  );
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      errorMessage: error?.message || "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: any, info: any) {
    console.warn("[AppErrorBoundary] Caught runtime error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: "#F8FAFC",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#0F172A",
              marginBottom: 8,
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: "#64748B",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            {this.state.errorMessage}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, errorMessage: "" })}
            style={{
              backgroundColor: "#2563EB",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [rootFlow, setRootFlow] = useState<RootFlow>("splash");

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider style={{ flex: 1, backgroundColor: "#111215" }}>
          <NavVisibilityProvider>
            <MainAppContent rootFlow={rootFlow} setRootFlow={setRootFlow} />
            <CustomAlertModal />
          </NavVisibilityProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </AppErrorBoundary>
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
