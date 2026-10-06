import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  MobileExpense,
  NotificationCategory,
  NotificationTextSpan,
  MobileNotificationItem,
  buildRealNotificationsList,
  isNotificationItemUnread,
} from "../services/firebaseDataService";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { NotificationDetailsScreen } from "./NotificationDetailsScreen";
import { useTheme } from "../context/ThemeContext";

export type { NotificationCategory, NotificationTextSpan };
export type NotificationItem = MobileNotificationItem;

export interface NotificationsScreenProps {
  onBack: () => void;
  householdId?: string;
  onNavigate?: (tab: string) => void;
  onOpenSettleDues?: () => void;
  onOpenExpenseHistory?: () => void;
  onOpenViewGroup?: () => void;
  onOpenManageGroup?: (mode?: "details" | "create" | "join") => void;
  onSelectNotification?: (item: MobileNotificationItem) => void;
}

function getCategoryVisuals(category: NotificationCategory, isDark = false) {
  switch (category) {
    case "reminder":
      return {
        bgColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2",
        icon: (
          <Feather
            name="bell"
            size={21}
            color={isDark ? "#F87171" : "#EF4444"}
          />
        ),
      };
    case "expense_added":
      return {
        bgColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#DCFCE7",
        icon: (
          <Feather
            name="plus"
            size={22}
            color={isDark ? "#34D399" : "#10B981"}
          />
        ),
      };
    case "payment_received":
      return {
        bgColor: isDark ? "rgba(59, 130, 246, 0.2)" : "#DBEAFE",
        icon: (
          <Feather
            name="check-circle"
            size={21}
            color={isDark ? "#60A5FA" : "#2563EB"}
          />
        ),
      };
    case "water_calculated":
      return {
        bgColor: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
        icon: (
          <Feather
            name="file-text"
            size={21}
            color={isDark ? "#38BDF8" : "#0284C7"}
          />
        ),
      };
    case "group_invite":
    default:
      return {
        bgColor: isDark ? "rgba(147, 51, 234, 0.2)" : "#F3E8FF",
        icon: (
          <Ionicons
            name="people-outline"
            size={22}
            color={isDark ? "#C084FC" : "#9333EA"}
          />
        ),
      };
  }
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  householdId: propHouseholdId,
  onNavigate,
  onOpenSettleDues,
  onOpenExpenseHistory,
  onOpenViewGroup,
  onOpenManageGroup,
  onSelectNotification,
}) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const firebaseUser = auth.currentUser;
  const cachedProfile = mobileDataService.getCachedProfile(firebaseUser?.uid);
  const cachedHousehold = cachedProfile
    ? mobileDataService.getCachedHousehold()
    : null;

  const [profile, setProfile] = useState<any | null>(() => cachedProfile);
  const [household, setHousehold] = useState<any | null>(() => cachedHousehold);
  const resolvedHouseholdId =
    propHouseholdId ||
    profile?.householdId ||
    household?.householdId ||
    cachedProfile?.householdId ||
    "";

  const [isProfileLoaded, setIsProfileLoaded] = useState<boolean>(() =>
    Boolean(cachedProfile || propHouseholdId),
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [cycleAttendance, setCycleAttendance] = useState<any[]>([]);
  const [cloudNotifications, setCloudNotifications] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<Record<string, boolean>>(() =>
    mobileDataService.getCachedReadNotifications(firebaseUser?.uid),
  );
  const [selectedNotification, setSelectedNotification] =
    useState<MobileNotificationItem | null>(null);
  const [showFilterBar, setShowFilterBar] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "unread" | "read" | "recent" | "date" | "earlier"
  >("all");
  const [selectedDateKey, setSelectedDateKey] = useState<string>("all");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  const isHost = Boolean(
    profile?.role === "HOST" ||
    profile?.role === "SUPER_ADMIN" ||
    profile?.hostApplicationStatus === "APPROVED" ||
    (household?.hostId &&
      firebaseUser?.uid &&
      household.hostId === firebaseUser.uid),
  );

  // Real-time cloud notifications + read IDs subscription
  useEffect(() => {
    const uid = firebaseUser?.uid;
    const unsubRead = mobileDataService.listenToReadNotificationIds(
      uid,
      setReadIds,
    );
    const unsubNotifs = mobileDataService.listenToNotifications(
      uid,
      setCloudNotifications,
    );
    return () => {
      unsubRead();
      unsubNotifs();
    };
  }, [firebaseUser?.uid]);

  // Profile resolution
  useEffect(() => {
    let mounted = true;
    if (!firebaseUser?.uid) {
      setIsProfileLoaded(true);
      setLoading(false);
      return;
    }

    mobileDataService
      .getUserProfile(firebaseUser.uid)
      .then((nextProfile) => {
        if (mounted) {
          setProfile(nextProfile);
          setIsProfileLoaded(true);
          if (!nextProfile?.householdId && !propHouseholdId) {
            setLoading(false);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setIsProfileLoaded(true);
          setLoading(false);
        }
      });

    const unsub = mobileDataService.listenToUserProfile(
      firebaseUser.uid,
      (nextProfile) => {
        if (mounted) {
          setProfile(nextProfile);
          setIsProfileLoaded(true);
          if (!nextProfile?.householdId && !propHouseholdId) {
            setLoading(false);
          }
        }
      },
    );

    return () => {
      mounted = false;
      unsub();
    };
  }, [firebaseUser?.uid, propHouseholdId]);

  // Household data listeners
  useEffect(() => {
    if (!isProfileLoaded) return;

    if (!resolvedHouseholdId) {
      setExpenses([]);
      setPayments([]);
      setCycles([]);
      setMembers([]);
      setCycleAttendance([]);
      setHousehold(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ready = {
      household: false,
      expenses: false,
      payments: false,
      cycles: false,
      members: false,
    };

    const checkReady = () => {
      if (
        ready.household &&
        ready.expenses &&
        ready.payments &&
        ready.cycles &&
        ready.members
      ) {
        setLoading(false);
      }
    };

    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 1800);

    const unsubHousehold = mobileDataService.listenToHousehold(
      resolvedHouseholdId,
      (data) => {
        setHousehold(data);
        ready.household = true;
        checkReady();
      },
    );

    const unsubExpenses = mobileDataService.listenToExpenses(
      resolvedHouseholdId,
      (data) => {
        setExpenses(data);
        ready.expenses = true;
        checkReady();
      },
    );

    const unsubPayments = mobileDataService.listenToPayments(
      resolvedHouseholdId,
      (data) => {
        setPayments(data);
        ready.payments = true;
        checkReady();
      },
    );

    const unsubCycles = mobileDataService.listenToBillingCycles(
      resolvedHouseholdId,
      (data) => {
        setCycles(data);
        ready.cycles = true;
        checkReady();
      },
    );

    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      resolvedHouseholdId,
      (data) => {
        setMembers(data);
        ready.members = true;
        checkReady();
      },
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubHousehold();
      unsubExpenses();
      unsubPayments();
      unsubCycles();
      unsubMembers();
    };
  }, [resolvedHouseholdId, isProfileLoaded]);

  const activeCycle =
    cycles.find((c) => c.status === "ACTIVE" || c.status === "FINALIZED") ||
    cycles[0];

  useEffect(() => {
    const cycleId = activeCycle?.billingCycleId;
    if (!resolvedHouseholdId || !cycleId) {
      setCycleAttendance([]);
      return;
    }
    const unsub = mobileDataService.listenToHouseholdCycleAttendance(
      resolvedHouseholdId,
      cycleId,
      setCycleAttendance,
    );
    return () => unsub();
  }, [resolvedHouseholdId, activeCycle?.billingCycleId]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, fadeAnim, slideAnim]);

  const groupName =
    household?.householdName ||
    household?.name ||
    profile?.householdName ||
    profile?.apartmentName ||
    "Household";

  // Build 100% real notifications from Firestore data
  const notifications = useMemo<MobileNotificationItem[]>(() => {
    return buildRealNotificationsList({
      uid: firebaseUser?.uid,
      householdId: resolvedHouseholdId,
      groupName,
      expenses,
      payments,
      cycles,
      cycleAttendance,
      members,
      cloudNotifications,
    });
  }, [
    firebaseUser?.uid,
    resolvedHouseholdId,
    groupName,
    expenses,
    payments,
    cycles,
    cycleAttendance,
    members,
    cloudNotifications,
  ]);

  // Persist/sync real household notifications to Firestore `notifications` collection
  useEffect(() => {
    if (!firebaseUser?.uid || loading || notifications.length === 0) return;
    mobileDataService
      .syncRealNotificationsToCloud(
        firebaseUser.uid,
        resolvedHouseholdId,
        notifications,
        cloudNotifications,
        readIds,
      )
      .catch(() => {});
  }, [
    firebaseUser?.uid,
    resolvedHouseholdId,
    loading,
    notifications,
    cloudNotifications,
    readIds,
  ]);

  const isItemUnread = (item: MobileNotificationItem): boolean => {
    return isNotificationItemUnread(item, readIds, firebaseUser?.uid);
  };

  const unreadCount = useMemo(() => {
    return notifications.filter((item) =>
      isNotificationItemUnread(item, readIds, firebaseUser?.uid),
    ).length;
  }, [notifications, readIds, firebaseUser?.uid]);

  const handleMarkAllRead = async () => {
    if (notifications.length === 0) return;
    await mobileDataService.markNotificationsRead(
      firebaseUser?.uid,
      notifications,
    );
  };

  const handleActionNavigation = (item: MobileNotificationItem) => {
    switch (item.actionTarget) {
      case "settle_dues":
        if (onOpenSettleDues) onOpenSettleDues();
        else if (onNavigate) onNavigate("bills");
        break;
      case "payments":
        if (onNavigate) onNavigate("payments");
        break;
      case "attendance":
        if (onNavigate) onNavigate("attendance");
        break;
      case "groups":
        if (isHost && onOpenManageGroup) onOpenManageGroup("details");
        else if (onOpenViewGroup) onOpenViewGroup();
        else if (onNavigate) onNavigate("groups");
        break;
      case "bills":
      default:
        if (onOpenExpenseHistory && item.category === "expense_added") {
          onNavigate ? onNavigate("bills") : onOpenExpenseHistory();
        } else if (onNavigate) {
          onNavigate("bills");
        }
        break;
    }
  };

  const handlePressNotification = async (item: MobileNotificationItem) => {
    setSelectedNotification(item);
    if (onSelectNotification) {
      onSelectNotification(item);
    }
    await mobileDataService.markNotificationsRead(firebaseUser?.uid, [item]);
  };

  if (selectedNotification) {
    const liveNotification =
      notifications.find((n) => n.id === selectedNotification.id) ||
      selectedNotification;

    const linkedExpense =
      expenses.find(
        (e) =>
          e.id === liveNotification.relatedEntityId ||
          `exp_${e.id}` === liveNotification.id ||
          `reminder_${e.id}` === liveNotification.id,
      ) ||
      (liveNotification.category === "water_calculated"
        ? expenses.find((e) =>
            (e.category || "").toLowerCase().includes("water"),
          ) || null
        : null);

    const linkedPayment =
      payments.find(
        (p, idx) =>
          p.paymentId === liveNotification.relatedEntityId ||
          `pay_${p.paymentId || `${p.userId || "u"}_${idx}`}` ===
            liveNotification.id,
      ) || null;

    const linkedMember =
      members.find((m) => {
        const memKey = m.memberId || m.userId || m.displayName || m.name;
        return (
          memKey === liveNotification.relatedEntityId ||
          liveNotification.id.startsWith(`member_${memKey}_`)
        );
      }) || null;

    return (
      <NotificationDetailsScreen
        notification={liveNotification}
        onBack={() => setSelectedNotification(null)}
        onPrimaryAction={(notif) => {
          setSelectedNotification(null);
          handleActionNavigation(notif);
        }}
        currentUserId={firebaseUser?.uid}
        groupName={groupName}
        household={household}
        expense={linkedExpense}
        payment={linkedPayment}
        member={linkedMember}
        activeCycle={activeCycle}
        cycleAttendance={cycleAttendance}
        members={members}
      />
    );
  }

  const recentList = notifications.filter((n) => n.section === "recent");
  const earlierList = notifications.filter((n) => n.section === "earlier");
  const readCount = Math.max(0, notifications.length - unreadCount);

  const getNotificationDateKey = (item: MobileNotificationItem): string => {
    const d = new Date(item.createdTimestamp || item.timestampMs || Date.now());
    if (isNaN(d.getTime())) return "unknown";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDateKeyLabel = (dateKey: string): string => {
    if (!dateKey || dateKey === "unknown") return "Recent Date";
    const parts = dateKey.split("-");
    if (parts.length !== 3) return dateKey;
    const d = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2]),
    );
    if (isNaN(d.getTime())) return dateKey;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round(
      (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );
    const formatted = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
    if (diffDays === 0) return `Today · ${formatted}`;
    if (diffDays === 1) return `Yesterday · ${formatted}`;
    return formatted;
  };

  const availableDates = buildAvailableDates();
  function buildAvailableDates() {
    const map = new Map<
      string,
      { key: string; label: string; count: number }
    >();
    notifications.forEach((n) => {
      const key = getNotificationDateKey(n);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          key,
          label: formatDateKeyLabel(key),
          count: 1,
        });
      }
    });
    return Array.from(map.values());
  }

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === "unread") return isItemUnread(item);
    if (activeFilter === "read") return !isItemUnread(item);
    if (activeFilter === "recent") return item.section === "recent";
    if (activeFilter === "earlier") return item.section === "earlier";
    if (activeFilter === "date") {
      if (selectedDateKey === "all") return true;
      return getNotificationDateKey(item) === selectedDateKey;
    }
    return true;
  });

  const renderMarkAllReadControl = () => (
    <View style={styles.markAllReadGroup}>
      <View
        style={[
          styles.unreadCountBadge,
          unreadCount === 0 && styles.unreadCountBadgeZero,
          isDark && {
            backgroundColor:
              unreadCount > 0
                ? "rgba(59, 130, 246, 0.18)"
                : colors.surfaceInset,
            borderColor:
              unreadCount > 0 ? "rgba(96, 165, 250, 0.35)" : colors.border,
          },
        ]}
      >
        {unreadCount > 0 && (
          <View
            style={[
              styles.unreadCountDot,
              isDark && { backgroundColor: colors.accent },
            ]}
          />
        )}
        <Text
          style={[
            styles.unreadCountBadgeText,
            unreadCount === 0 && styles.unreadCountBadgeTextZero,
            isDark && {
              color: unreadCount > 0 ? colors.accent : colors.textMuted,
            },
          ]}
        >
          {unreadCount} unread
        </Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleMarkAllRead}
        disabled={unreadCount === 0}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text
          style={[
            styles.markAllReadText,
            isDark && { color: colors.accent },
            unreadCount === 0 &&
              (isDark
                ? { color: colors.textMuted }
                : styles.markAllReadDisabledText),
          ]}
        >
          {unreadCount === 0 ? "All read" : "Mark all read"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    24,
  );

  const renderNotificationCard = (item: MobileNotificationItem) => {
    const visuals = getCategoryVisuals(item.category, isDark);
    const unread = isItemUnread(item);

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.card,
          isDark && {
            backgroundColor: unread ? colors.cardElevated : colors.card,
            borderColor: unread ? colors.borderHighlighted : colors.border,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 2,
          },
          !isDark &&
            unread && {
              backgroundColor: "#FAFCFF",
              borderColor: "#BFDBFE",
            },
        ]}
        activeOpacity={0.85}
        onPress={() => handlePressNotification(item)}
      >
        {/* Left Colored Rounded Square Icon */}
        <View style={[styles.iconBox, { backgroundColor: visuals.bgColor }]}>
          {visuals.icon}
        </View>

        {/* Right Text Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <Text
              style={[styles.cardTitle, isDark && { color: colors.text }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            <View style={styles.timeWrapper}>
              <Text
                style={[styles.timeText, isDark && { color: colors.textMuted }]}
              >
                {item.timeLabel}
              </Text>
              {unread && (
                <View
                  style={[
                    styles.unreadDot,
                    isDark && { backgroundColor: colors.accent },
                  ]}
                />
              )}
            </View>
          </View>

          <Text
            style={[
              styles.cardDescription,
              isDark && { color: colors.textSecondary },
            ]}
          >
            {item.spans.map((span, idx) => (
              <Text
                key={`${item.id}_span_${idx}`}
                style={[
                  span.bold && [
                    styles.boldSpan,
                    isDark && { color: colors.text },
                  ],
                  span.color ? { color: span.color } : undefined,
                ]}
              >
                {span.text}
              </Text>
            ))}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        isDark && { backgroundColor: colors.background },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* Top Navigation Bar matching UX prototype */}
      <View
        style={[
          styles.topNav,
          { paddingTop: topInset + 8 },
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backButton,
            isDark && {
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.75}
          onPress={onBack}
          accessibilityLabel="Back"
        >
          <Feather
            name="chevron-left"
            size={20}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>

        <Text style={[styles.screenTitle, isDark && { color: colors.text }]}>
          Notification
        </Text>

        <TouchableOpacity
          style={[
            styles.filterToggleButton,
            showFilterBar && styles.filterToggleButtonActive,
            isDark && {
              backgroundColor: showFilterBar
                ? "rgba(59, 130, 246, 0.2)"
                : colors.card,
              borderWidth: 1,
              borderColor: showFilterBar ? colors.accent : colors.border,
            },
          ]}
          activeOpacity={0.75}
          onPress={() => setShowFilterBar((prev) => !prev)}
          accessibilityLabel="Filter notifications"
        >
          <Feather
            name="sliders"
            size={18}
            color={
              showFilterBar || activeFilter !== "all"
                ? isDark
                  ? colors.accent
                  : "#2563EB"
                : isDark
                  ? colors.text
                  : "#0F172A"
            }
          />
          {activeFilter !== "all" && (
            <View
              style={[
                styles.filterActiveDot,
                isDark && { borderColor: colors.background },
              ]}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Tab Bar (Unread, Read, Recent, Date, Earlier) */}
      {showFilterBar && (
        <View
          style={[
            styles.filterBarWrapper,
            isDark && {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabsScroll}
          >
            {(
              [
                {
                  key: "all",
                  label: "All",
                  icon: "layers",
                  count: notifications.length,
                },
                {
                  key: "unread",
                  label: "Unread",
                  icon: "mail",
                  count: unreadCount,
                },
                {
                  key: "read",
                  label: "Read",
                  icon: "check-circle",
                  count: readCount,
                },
                {
                  key: "recent",
                  label: "Recent",
                  icon: "zap",
                  count: recentList.length,
                },
                {
                  key: "date",
                  label: "Date",
                  icon: "calendar",
                  count: availableDates.length,
                },
                {
                  key: "earlier",
                  label: "Earlier",
                  icon: "clock",
                  count: earlierList.length,
                },
              ] as const
            ).map((tab) => {
              const isSelected = activeFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.filterTabChip,
                    isSelected && styles.filterTabChipActive,
                    isDark && {
                      backgroundColor: isSelected ? colors.accent : colors.card,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setActiveFilter(tab.key);
                    if (tab.key !== "date") {
                      setSelectedDateKey("all");
                    }
                  }}
                >
                  <Feather
                    name={tab.icon as any}
                    size={13}
                    color={
                      isSelected
                        ? "#FFFFFF"
                        : isDark
                          ? colors.textSecondary
                          : "#475569"
                    }
                  />
                  <Text
                    style={[
                      styles.filterTabChipText,
                      isSelected && styles.filterTabChipTextActive,
                      isDark && !isSelected && { color: colors.textSecondary },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  <View
                    style={[
                      styles.filterTabCountPill,
                      isSelected && styles.filterTabCountPillActive,
                      isDark &&
                        !isSelected && {
                          backgroundColor: colors.surfaceInset,
                        },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterTabCountText,
                        isSelected && styles.filterTabCountTextActive,
                        isDark &&
                          !isSelected && { color: colors.textSecondary },
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Secondary Date Picker Sub-Bar when "Date" filter tab is selected */}
          {activeFilter === "date" && availableDates.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateSubBarScroll}
            >
              <TouchableOpacity
                style={[
                  styles.dateChip,
                  selectedDateKey === "all" && styles.dateChipActive,
                  isDark && {
                    backgroundColor:
                      selectedDateKey === "all"
                        ? "rgba(59, 130, 246, 0.2)"
                        : colors.surfaceInset,
                    borderColor:
                      selectedDateKey === "all" ? colors.accent : colors.border,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setSelectedDateKey("all")}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    selectedDateKey === "all" && styles.dateChipTextActive,
                    isDark && {
                      color:
                        selectedDateKey === "all"
                          ? colors.accent
                          : colors.textSecondary,
                    },
                  ]}
                >
                  All Dates ({notifications.length})
                </Text>
              </TouchableOpacity>
              {availableDates.map((dItem) => {
                const isDateSelected = selectedDateKey === dItem.key;
                return (
                  <TouchableOpacity
                    key={dItem.key}
                    style={[
                      styles.dateChip,
                      isDateSelected && styles.dateChipActive,
                      isDark && {
                        backgroundColor: isDateSelected
                          ? "rgba(59, 130, 246, 0.2)"
                          : colors.surfaceInset,
                        borderColor: isDateSelected
                          ? colors.accent
                          : colors.border,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedDateKey(dItem.key)}
                  >
                    <Text
                      style={[
                        styles.dateChipText,
                        isDateSelected && styles.dateChipTextActive,
                        isDark && {
                          color: isDateSelected
                            ? colors.accent
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {dItem.label} ({dItem.count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1 }}>
          <UniversalSkeleton type="notifications" />
        </View>
      ) : (
        <Animated.View
          style={{
            flex: 1,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(100, insets.bottom + 50) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {notifications.length === 0 ? (
              <View
                style={[
                  styles.emptyContainer,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.emptyIconCircle,
                    isDark && {
                      backgroundColor: "rgba(59, 130, 246, 0.16)",
                    },
                  ]}
                >
                  <Feather
                    name="bell"
                    size={26}
                    color={isDark ? colors.accent : "#2563EB"}
                  />
                </View>
                <Text
                  style={[styles.emptyTitle, isDark && { color: colors.text }]}
                >
                  No notifications yet
                </Text>
                <Text
                  style={[
                    styles.emptySubtitle,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  You're all caught up! Real-time cloud notifications for your
                  household bills, payments, water attendance, and group invites
                  will appear here.
                </Text>
              </View>
            ) : activeFilter === "all" ? (
              <>
                {/* Recent Section */}
                {recentList.length > 0 && (
                  <>
                    <View style={styles.sectionHeaderRow}>
                      <Text
                        style={[
                          styles.sectionHeaderTitle,
                          isDark && { color: colors.text },
                        ]}
                      >
                        Recent
                      </Text>
                      {renderMarkAllReadControl()}
                    </View>

                    {recentList.map(renderNotificationCard)}
                  </>
                )}

                {/* Earlier Section */}
                {earlierList.length > 0 && (
                  <>
                    <View
                      style={[
                        styles.sectionHeaderRow,
                        {
                          marginTop: recentList.length > 0 ? 12 : 0,
                          marginBottom: 14,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sectionHeaderTitle,
                          isDark && { color: colors.text },
                        ]}
                      >
                        Earlier
                      </Text>
                      {recentList.length === 0 && renderMarkAllReadControl()}
                    </View>

                    {earlierList.map(renderNotificationCard)}
                  </>
                )}
              </>
            ) : filteredNotifications.length === 0 ? (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text
                    style={[
                      styles.sectionHeaderTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {activeFilter === "unread"
                      ? "Unread"
                      : activeFilter === "read"
                        ? "Read"
                        : activeFilter === "recent"
                          ? "Recent"
                          : activeFilter === "earlier"
                            ? "Earlier"
                            : "By Date"}
                  </Text>
                  {renderMarkAllReadControl()}
                </View>

                <View
                  style={[
                    styles.emptyContainer,
                    isDark && {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.emptyIconCircle,
                      isDark && {
                        backgroundColor: "rgba(59, 130, 246, 0.16)",
                      },
                    ]}
                  >
                    <Feather
                      name="inbox"
                      size={24}
                      color={isDark ? colors.accent : "#2563EB"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.emptyTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    No matching notifications
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    {activeFilter === "unread"
                      ? "You have no unread notifications right now."
                      : activeFilter === "read"
                        ? "No notifications have been marked as read yet."
                        : activeFilter === "recent"
                          ? "No notifications in the recent window."
                          : activeFilter === "earlier"
                            ? "No earlier notifications found."
                            : "No notifications found for the selected date."}
                  </Text>
                  <TouchableOpacity
                    style={styles.resetFilterBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      setActiveFilter("all");
                      setSelectedDateKey("all");
                    }}
                  >
                    <Text style={styles.resetFilterBtnText}>
                      Show All Notifications
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : activeFilter === "date" ? (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text
                    style={[
                      styles.sectionHeaderTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {selectedDateKey === "all"
                      ? "Grouped by Date"
                      : formatDateKeyLabel(selectedDateKey)}
                  </Text>
                  {renderMarkAllReadControl()}
                </View>

                {availableDates
                  .filter(
                    (dGroup) =>
                      selectedDateKey === "all" ||
                      dGroup.key === selectedDateKey,
                  )
                  .map((dGroup) => {
                    const itemsForDate = filteredNotifications.filter(
                      (n) => getNotificationDateKey(n) === dGroup.key,
                    );
                    if (itemsForDate.length === 0) return null;
                    return (
                      <View key={dGroup.key} style={styles.dateGroupSection}>
                        {selectedDateKey === "all" && (
                          <View style={styles.dateGroupHeader}>
                            <Feather
                              name="calendar"
                              size={13}
                              color={isDark ? colors.accent : "#2563EB"}
                            />
                            <Text
                              style={[
                                styles.dateGroupHeaderText,
                                isDark && { color: colors.textSecondary },
                              ]}
                            >
                              {dGroup.label}
                            </Text>
                          </View>
                        )}
                        {itemsForDate.map(renderNotificationCard)}
                      </View>
                    );
                  })}
              </>
            ) : (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text
                    style={[
                      styles.sectionHeaderTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {activeFilter === "unread"
                      ? `Unread (${filteredNotifications.length})`
                      : activeFilter === "read"
                        ? `Read (${filteredNotifications.length})`
                        : activeFilter === "recent"
                          ? `Recent (${filteredNotifications.length})`
                          : `Earlier (${filteredNotifications.length})`}
                  </Text>
                  {renderMarkAllReadControl()}
                </View>

                {filteredNotifications.map(renderNotificationCard)}
              </>
            )}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#F8FAFC",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },
  filterToggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterToggleButtonActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  filterActiveDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
    borderWidth: 1.5,
    borderColor: "#F8FAFC",
  },
  filterBarWrapper: {
    backgroundColor: "#F8FAFC",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  filterTabsScroll: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
  },
  filterTabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterTabChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  filterTabChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  filterTabChipTextActive: {
    color: "#FFFFFF",
  },
  filterTabCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    minWidth: 20,
    alignItems: "center",
  },
  filterTabCountPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  filterTabCountText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
  },
  filterTabCountTextActive: {
    color: "#FFFFFF",
  },
  dateSubBarScroll: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 8,
    alignItems: "center",
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dateChipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  dateChipTextActive: {
    color: "#2563EB",
  },
  dateGroupSection: {
    marginBottom: 8,
  },
  dateGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  dateGroupHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: -0.1,
  },
  resetFilterBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2563EB",
  },
  resetFilterBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  markAllReadGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 5,
  },
  unreadCountBadgeZero: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  unreadCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563EB",
  },
  unreadCountBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  unreadCountBadgeTextZero: {
    color: "#94A3B8",
  },
  markAllReadText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  markAllReadDisabledText: {
    color: "#94A3B8",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginRight: 8,
    letterSpacing: -0.2,
  },
  timeWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#2563EB",
    marginLeft: 5,
    marginTop: -6,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
    fontWeight: "400",
  },
  boldSpan: {
    fontWeight: "700",
    color: "#334155",
  },
  emptyContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 28,
    marginTop: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
    textAlign: "center",
  },
});
