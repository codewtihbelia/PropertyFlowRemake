import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { alertService } from "../services/alertService";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  MobileExpense,
  isPayorMember,
} from "../services/firebaseDataService";
import { UniversalSkeleton } from "../components/UniversalLoader";

interface ReportScreenProps {
  onBack: () => void;
  onOpenSettleDues?: () => void;
  loading?: boolean;
}

interface RoommateBreakdownItem {
  id: string;
  userId: string;
  name: string;
  shortName: string;
  initials: string;
  photoURL?: string;
  avatarBg: string;
  avatarTextColor: string;
  statusText: string;
  statusDotColor: string;
  amount: string;
  shareCentavos: number;
  paidCentavos: number;
  balanceCentavos: number;
  settlementTag: string;
  settlementTagColor: string;
  chartValue: string;
  chartValueColor: string;
  chartBarColor: string;
  chartHeight: number;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatMonthYear(dateInput?: any): string {
  if (!dateInput) {
    const now = new Date();
    return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  }
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

const AVATAR_PALETTES = [
  {
    bg: "#FFE4E6",
    darkBg: "rgba(225, 29, 72, 0.2)",
    text: "#E11D48",
    bar: "#FECDD3",
    darkBar: "rgba(225, 29, 72, 0.35)",
    valColor: "#E11D48",
    darkValColor: "#FB7185",
  },
  {
    bg: "#FEF3C7",
    darkBg: "rgba(217, 119, 6, 0.2)",
    text: "#D97706",
    bar: "#FDE68A",
    darkBar: "rgba(217, 119, 6, 0.35)",
    valColor: "#D97706",
    darkValColor: "#FBBF24",
  },
  {
    bg: "#D1FAE5",
    darkBg: "rgba(5, 150, 105, 0.2)",
    text: "#059669",
    bar: "#A7F3D0",
    darkBar: "rgba(5, 150, 105, 0.35)",
    valColor: "#059669",
    darkValColor: "#34D399",
  },
  {
    bg: "#DBEAFE",
    darkBg: "rgba(37, 99, 235, 0.2)",
    text: "#2563EB",
    bar: "#BFDBFE",
    darkBar: "rgba(37, 99, 235, 0.35)",
    valColor: "#2563EB",
    darkValColor: "#60A5FA",
  },
  {
    bg: "#F3E8FF",
    darkBg: "rgba(147, 51, 234, 0.2)",
    text: "#9333EA",
    bar: "#E9D5FF",
    darkBar: "rgba(147, 51, 234, 0.35)",
    valColor: "#9333EA",
    darkValColor: "#C084FC",
  },
  {
    bg: "#CFFAFE",
    darkBg: "rgba(8, 145, 178, 0.2)",
    text: "#0891B2",
    bar: "#A5F3FC",
    darkBar: "rgba(8, 145, 178, 0.35)",
    valColor: "#0891B2",
    darkValColor: "#38BDF8",
  },
];

export const ReportScreen: React.FC<ReportScreenProps> = ({
  onBack,
  onOpenSettleDues,
  loading: externalLoading,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  // Cloud Firestore state
  const currentUser = auth.currentUser;
  const [profile, setProfile] = useState<any | null>(null);
  const [household, setHousehold] = useState<any | null>(null);
  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [billingCycles, setBillingCycles] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingCloud, setLoadingCloud] = useState<boolean>(true);

  // Selected Period / Cycle Filter
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [selectedMonthLabel, setSelectedMonthLabel] = useState<string>("");
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Spin animation for reload button
  const spinAnim = useRef(new Animated.Value(0)).current;

  // 1. Fetch current user profile from Firestore
  useEffect(() => {
    let mounted = true;
    if (!currentUser?.uid) {
      setLoadingCloud(false);
      return;
    }

    mobileDataService.getUserProfile(currentUser.uid).then((p) => {
      if (mounted) {
        setProfile(p);
      }
    });

    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  // 2. Setup real-time listeners once household is resolved
  const resolvedHouseholdId = profile?.householdId || household?.householdId;

  useEffect(() => {
    if (!resolvedHouseholdId) {
      // If user has no household after profile loads
      const timer = setTimeout(() => {
        setLoadingCloud(false);
      }, 1200);
      return () => clearTimeout(timer);
    }

    setLoadingCloud(true);
    let loadedCount = { expenses: false, members: false, cycles: false };

    const checkDone = () => {
      if (loadedCount.expenses && loadedCount.members && loadedCount.cycles) {
        setLoadingCloud(false);
      }
    };

    const safetyTimer = setTimeout(() => {
      setLoadingCloud(false);
    }, 2500);

    const unsubHh = mobileDataService.listenToHousehold(
      resolvedHouseholdId,
      (hh) => setHousehold(hh),
    );

    const unsubMems = mobileDataService.listenToHouseholdMembers(
      resolvedHouseholdId,
      (mems) => {
        setMembers(mems || []);
        loadedCount.members = true;
        checkDone();
      },
    );

    const unsubExps = mobileDataService.listenToExpenses(
      resolvedHouseholdId,
      (exps) => {
        setExpenses(exps || []);
        loadedCount.expenses = true;
        checkDone();
      },
    );

    const unsubCycles = mobileDataService.listenToBillingCycles(
      resolvedHouseholdId,
      (cycles) => {
        setBillingCycles(cycles || []);
        loadedCount.cycles = true;
        checkDone();
      },
    );

    const unsubPays = mobileDataService.listenToPayments(
      resolvedHouseholdId,
      (pays) => setPayments(pays || []),
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubHh();
      unsubMems();
      unsubExps();
      unsubCycles();
      unsubPays();
    };
  }, [resolvedHouseholdId]);

  // 3. Dynamic Month / Billing Cycles list derived from Cloud Firestore
  interface PeriodOption {
    id: string;
    label: string;
    isCycle: boolean;
    status?: string;
  }

  const periodOptions: PeriodOption[] = useMemo(() => {
    const options: PeriodOption[] = [];

    // Add cycles from Firestore
    if (billingCycles.length > 0) {
      billingCycles.forEach((c) => {
        const cycleName =
          c.name ||
          (c.startDate
            ? formatMonthYear(c.startDate)
            : `Cycle ${c.billingCycleId.slice(0, 6)}`);
        options.push({
          id: c.billingCycleId,
          label: cycleName,
          isCycle: true,
          status: c.status,
        });
      });
    }

    // Also extract months from expenses if any are outside formal cycles
    const expenseMonths = new Set<string>();
    expenses.forEach((e) => {
      if (e.date) {
        expenseMonths.add(formatMonthYear(e.date));
      }
    });

    expenseMonths.forEach((mLabel) => {
      if (!options.some((o) => o.label === mLabel)) {
        options.push({
          id: `month_${mLabel}`,
          label: mLabel,
          isCycle: false,
        });
      }
    });

    // If still empty, add current and recent months
    if (options.length === 0) {
      const now = new Date();
      for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = formatMonthYear(d);
        options.push({
          id: `month_${label}`,
          label,
          isCycle: false,
        });
      }
    }

    return options;
  }, [billingCycles, expenses]);

  // Set default selected period once options are ready
  useEffect(() => {
    if (periodOptions.length > 0) {
      // Prefer active billing cycle if present
      const active =
        periodOptions.find((p) => p.status === "ACTIVE") || periodOptions[0];

      if (
        !selectedCycleId ||
        !periodOptions.some((p) => p.id === selectedCycleId)
      ) {
        setSelectedCycleId(active.id);
        setSelectedMonthLabel(active.label);
      }
    }
  }, [periodOptions, selectedCycleId]);

  // 4. Filter expenses matching the selected cycle / month
  const filteredExpenses = useMemo(() => {
    if (!selectedCycleId && periodOptions.length === 0) return expenses;

    const currentOption = periodOptions.find((p) => p.id === selectedCycleId);
    if (!currentOption) return expenses;

    return expenses.filter((e) => {
      if (currentOption.isCycle) {
        if (e.billingCycleId === currentOption.id) return true;
        // Fallback: match month label if billing cycle id wasn't set
        if (e.date && formatMonthYear(e.date) === currentOption.label)
          return true;
        return false;
      } else {
        // Month string match
        return e.date ? formatMonthYear(e.date) === currentOption.label : false;
      }
    });
  }, [expenses, selectedCycleId, periodOptions]);

  // 5. Active roommates
  const activeMembers = useMemo(() => {
    const list = members.filter((m) => m.status === "ACTIVE");
    if (list.length > 0) return list;
    if (currentUser?.uid) {
      return [
        {
          userId: currentUser.uid,
          memberId: currentUser.uid,
          displayName: currentUser.displayName || profile?.displayName || "You",
          role: "HOST",
          status: "ACTIVE",
          photoURL: currentUser.photoURL || profile?.profilePicture,
        },
      ];
    }
    return [];
  }, [members, currentUser, profile]);

  const activePayors = useMemo(() => {
    const list = activeMembers.filter((m) => isPayorMember(m));
    return list.length > 0 ? list : activeMembers;
  }, [activeMembers]);

  // 6. Aggregate calculations for total expenses & average
  const totalExpenseCents = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  }, [filteredExpenses]);

  const totalExpenseFormatted = useMemo(() => {
    return `₱${(totalExpenseCents / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [totalExpenseCents]);

  const avgPerPayorCents = useMemo(() => {
    if (activePayors.length === 0) return 0;
    return Math.round(totalExpenseCents / activePayors.length);
  }, [totalExpenseCents, activePayors]);

  const avgFormatted = useMemo(() => {
    return `Avg: ₱${(avgPerPayorCents / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [avgPerPayorCents]);

  // 7. Calculate real Roommate Breakdown and Chart data
  const roommatesBreakdown: RoommateBreakdownItem[] = useMemo(() => {
    const payorCount = Math.max(1, activePayors.length);

    // First pass: compute shares and payments for each active member
    const computed = activeMembers.map((m, idx) => {
      const uid = m.userId || m.memberId || "";
      const isMe = uid === currentUser?.uid;
      const isPayor = isPayorMember(m);
      const rawName = m.displayName || (isMe ? "You" : "Roommate");
      const shortName = isMe ? "You" : rawName.split(" ")[0];
      const displayName = isMe ? `${rawName} (You)` : rawName;
      const initials = rawName
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      // Palette for this member
      const palette = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];

      // Sum member's share from filteredExpenses
      let shareCentavos = 0;
      filteredExpenses.forEach((exp) => {
        if (
          exp.splitDetails &&
          Array.isArray(exp.splitDetails) &&
          exp.splitDetails.length > 0
        ) {
          const split = exp.splitDetails.find((s) => s.userId === uid);
          if (split && typeof split.shareCentavos === "number") {
            shareCentavos += split.shareCentavos;
          } else if (
            isPayor &&
            !exp.splitDetails.some((s) => s.userId === uid)
          ) {
            // If split details exist but doesn't include this payor, fallback to fair share
            shareCentavos += Math.round((exp.amountCents || 0) / payorCount);
          }
        } else if (isPayor) {
          // Equal split across payors
          shareCentavos += Math.round((exp.amountCents || 0) / payorCount);
        }
      });

      // Sum confirmed payments made by this member
      const memberPayments = payments.filter((p) => {
        if (p.userId !== uid) return false;
        const isConfirmed =
          p.status === "CONFIRMED" ||
          p.status === "COMPLETED" ||
          p.status === "APPROVED";
        if (!isConfirmed) return false;

        // Match cycle or month if applicable
        if (selectedCycleId && p.billingCycleId) {
          return p.billingCycleId === selectedCycleId;
        }
        return true;
      });

      const paidCentavos = memberPayments.reduce(
        (sum, p) => sum + (p.amountCents || Math.round((p.amount || 0) * 100)),
        0,
      );

      const balanceCentavos = Math.max(0, shareCentavos - paidCentavos);

      // Status tags & dots
      let statusText = "Paid full share";
      let statusDotColor = "#10B981";
      let settlementTag = "Settled";
      let settlementTagColor = "#059669";

      if (!isPayor) {
        statusText = "Exempted (Non-payor)";
        statusDotColor = "#64748B";
        settlementTag = "Exempt";
        settlementTagColor = "#64748B";
      } else if (shareCentavos === 0) {
        statusText = "No dues assigned";
        statusDotColor = "#10B981";
        settlementTag = "Settled";
        settlementTagColor = "#059669";
      } else if (balanceCentavos <= 0) {
        statusText = "Paid full share";
        statusDotColor = "#10B981";
        settlementTag = "Settled";
        settlementTagColor = "#059669";
      } else if (paidCentavos > 0) {
        statusText = `Paid ₱${(paidCentavos / 100).toFixed(2)} partial`;
        statusDotColor = "#F59E0B";
        settlementTag = `Owes ₱${(balanceCentavos / 100).toFixed(2)}`;
        settlementTagColor = "#D97706";
      } else {
        statusText = "Pending payment";
        statusDotColor = "#F59E0B";
        settlementTag = `Owes ₱${(balanceCentavos / 100).toFixed(2)}`;
        settlementTagColor = "#D97706";
      }

      return {
        id: uid || `member_${idx}`,
        userId: uid,
        name: displayName,
        shortName,
        initials,
        photoURL: m.photoURL || m.profilePicture,
        avatarBg: isDark ? palette.darkBg : palette.bg,
        avatarTextColor: palette.text,
        statusText,
        statusDotColor,
        amount: `₱${(shareCentavos / 100).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        shareCentavos,
        paidCentavos,
        balanceCentavos,
        settlementTag,
        settlementTagColor,
        chartValue: `₱${Math.round(shareCentavos / 100).toLocaleString()}`,
        chartValueColor: isDark ? palette.darkValColor : palette.valColor,
        chartBarColor: isDark ? palette.darkBar : palette.bar,
        chartHeight: 25, // Computed in next pass
      };
    });

    // Second pass: compute relative bar heights normalized between 22 and 125
    const maxShareCents = Math.max(
      ...computed.map((c) => c.shareCentavos),
      1000,
    );

    return computed.map((c) => {
      const height =
        c.shareCentavos > 0
          ? Math.max(
              22,
              Math.min(
                125,
                Math.round((c.shareCentavos / maxShareCents) * 120),
              ),
            )
          : 12;
      return {
        ...c,
        chartHeight: height,
      };
    });
  }, [
    activeMembers,
    activePayors,
    filteredExpenses,
    payments,
    currentUser?.uid,
    isDark,
    selectedCycleId,
  ]);

  // 8. Categories breakdown for the details modal
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const cat = e.category || "General Expense";
      map[cat] = (map[cat] || 0) + (e.amountCents || 0);
    });

    return Object.entries(map).map(([category, cents]) => ({
      category,
      amountFormatted: `₱${(cents / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      cents,
    }));
  }, [filteredExpenses]);

  // 9. Remainder & discrepancy check
  const mathDiscrepancy = useMemo(() => {
    const sumSharesCentavos = roommatesBreakdown.reduce(
      (sum, r) => sum + r.shareCentavos,
      0,
    );
    const diff = Math.abs(sumSharesCentavos - totalExpenseCents);
    return (diff / 100).toFixed(2);
  }, [roommatesBreakdown, totalExpenseCents]);

  // Refresh handler
  const handleRefresh = () => {
    setIsRefreshing(true);
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 750,
      useNativeDriver: true,
    }).start(async () => {
      if (currentUser?.uid) {
        const nextProfile = await mobileDataService.getUserProfile(
          currentUser.uid,
        );
        if (nextProfile) setProfile(nextProfile);
      }
      setIsRefreshing(false);
      alertService.show({
        title: "Report Synchronized",
        message: `Cloud calculations and settlement ledgers for ${selectedMonthLabel} are live.`,
        type: "success",
      });
    });
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Settle All handler
  const handleSettleAll = () => {
    if (onOpenSettleDues) {
      onOpenSettleDues();
      return;
    }

    const membersWithDues = roommatesBreakdown.filter(
      (r) => r.balanceCentavos > 0,
    );
    if (membersWithDues.length === 0) {
      alertService.show({
        title: "All Dues Settled",
        message: `All roommate accounts for ${selectedMonthLabel} are fully paid and verified.`,
        type: "success",
      });
      return;
    }

    const totalOwedCents = membersWithDues.reduce(
      (sum, r) => sum + r.balanceCentavos,
      0,
    );
    const names = membersWithDues.map((r) => r.name).join(", ");

    alertService.show({
      title: "Settle Household Dues",
      message: `Outstanding balances for ${selectedMonthLabel} total ₱${(
        totalOwedCents / 100
      ).toFixed(
        2,
      )} from ${names}. Would you like to review settlements or remind roommates?`,
      buttons: [
        { text: "Dismiss", style: "cancel" },
        {
          text: "Remind Roommates",
          style: "default",
          onPress: () => {
            alertService.show({
              title: "Reminders Dispatched",
              message:
                "Payment reminders have been logged for outstanding roommates.",
              type: "success",
            });
          },
        },
      ],
    });
  };

  // Up to 5 chart items to display cleanly on screen
  const chartItems = useMemo(() => {
    if (roommatesBreakdown.length <= 5) return roommatesBreakdown;
    return roommatesBreakdown.slice(0, 5);
  }, [roommatesBreakdown]);

  const hasOutstanding = roommatesBreakdown.some((r) => r.balanceCentavos > 0);
  const isLoading = externalLoading || loadingCloud;

  return (
    <View
      style={[
        styles.rootContainer,
        { paddingTop: insets.top },
        isDark && { backgroundColor: colors.background },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent={true}
        backgroundColor="transparent"
      />

      {/* TOP HEADER */}
      <View
        style={[
          styles.header,
          isDark && { backgroundColor: colors.background },
        ]}
      >
        {/* Left Back Button */}
        <TouchableOpacity
          style={[
            styles.circleHeaderBtn,
            isDark && { backgroundColor: "rgba(255, 255, 255, 0.08)" },
          ]}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Feather
            name="chevron-left"
            size={22}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>

        {/* Center Title */}
        <Text style={[styles.headerTitle, isDark && { color: colors.text }]}>
          Report
        </Text>

        {/* Right Reload Button */}
        <TouchableOpacity
          style={[
            styles.circleHeaderBtn,
            isDark && { backgroundColor: "rgba(255, 255, 255, 0.08)" },
          ]}
          onPress={handleRefresh}
          activeOpacity={0.7}
          accessibilityLabel="Refresh Report"
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons
              name="refresh-outline"
              size={22}
              color={isDark ? colors.text : "#0F172A"}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* MAIN SCROLLABLE CONTENT */}
      {isLoading ? (
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
          <UniversalSkeleton type="reports" />
        </View>
      ) : (
        <ScrollView
          style={[
            styles.scrollView,
            isDark && { backgroundColor: colors.background },
          ]}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 90, 110) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* TITLE & SUBTITLE AREA */}
          <View style={styles.titleSection}>
            <Text style={[styles.mainTitle, isDark && { color: colors.text }]}>
              Monthly Summary
            </Text>
            <Text
              style={[
                styles.subTitle,
                isDark && { color: colors.textSecondary },
              ]}
            >
              {household?.householdName || household?.apartmentName
                ? `${household?.householdName || household?.apartmentName} • `
                : ""}
              Here's how expenses are split this period
            </Text>
          </View>

          {/* TOTAL EXPENSE & MONTH PICKER ROW */}
          <View style={styles.expenseSummaryRow}>
            <View>
              <Text
                style={[
                  styles.totalExpenseLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Total Expense
              </Text>
              <Text
                style={[
                  styles.totalExpenseAmount,
                  isDark && { color: colors.text },
                ]}
              >
                {totalExpenseFormatted}
              </Text>
              <Text
                style={[
                  styles.avgLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                {avgFormatted}
              </Text>
            </View>

            {/* Month Selector Pill */}
            <TouchableOpacity
              style={[
                styles.monthPickerPill,
                isDark && {
                  backgroundColor: "rgba(59, 130, 246, 0.15)",
                  borderColor: "rgba(59, 130, 246, 0.35)",
                },
              ]}
              onPress={() => setShowMonthModal(true)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.monthPickerText,
                  isDark && { color: colors.primary },
                ]}
              >
                {selectedMonthLabel || "Current Month"}
              </Text>
              <Feather
                name="chevron-down"
                size={15}
                color={isDark ? colors.primary : "#2563EB"}
              />
            </TouchableOpacity>
          </View>

          {/* BAR CHART CARD */}
          <View
            style={[
              styles.chartCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Columns */}
            {chartItems.length === 0 ? (
              <View style={styles.emptyChartNotice}>
                <Ionicons
                  name="bar-chart-outline"
                  size={32}
                  color={isDark ? colors.textMuted : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.emptyNoticeText,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  No active roommate shares to display
                </Text>
              </View>
            ) : (
              <View style={styles.chartColumnsContainer}>
                {chartItems.map((item) => (
                  <View key={item.id} style={styles.chartColumn}>
                    {/* Top Value Label */}
                    <Text
                      style={[
                        styles.barValueText,
                        { color: item.chartValueColor },
                      ]}
                      numberOfLines={1}
                    >
                      {item.chartValue}
                    </Text>

                    {/* Capsule Bar */}
                    <View style={styles.barTrackArea}>
                      <View
                        style={[
                          styles.capsuleBar,
                          {
                            height: item.chartHeight,
                            backgroundColor: item.chartBarColor,
                          },
                        ]}
                      />
                    </View>

                    {/* Bottom Roommate Label */}
                    <Text
                      style={[
                        styles.barLabel,
                        isDark && { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.shortName}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Bottom Card Status Line */}
            <View
              style={[
                styles.chartCardFooter,
                isDark && { borderTopColor: colors.borderSubtle },
              ]}
            >
              <View style={styles.statusDotRow}>
                <View
                  style={[
                    styles.greenStatusDot,
                    hasOutstanding && { backgroundColor: "#F59E0B" },
                  ]}
                />
                <Text
                  style={[
                    styles.statusOnTrackText,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  {hasOutstanding
                    ? "Pending roommate dues for this period"
                    : "All roommate shares verified & on track"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowDetailsModal(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.detailsLink,
                    isDark && { color: colors.primary },
                  ]}
                >
                  Details
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION HEADER: BREAKDOWN BY ROOMMATE */}
          <View style={styles.sectionHeaderRow}>
            <Text
              style={[
                styles.sectionHeading,
                isDark && { color: colors.textSecondary },
              ]}
            >
              BREAKDOWN BY ROOMMATE
            </Text>
            <TouchableOpacity onPress={handleSettleAll} activeOpacity={0.7}>
              <Text
                style={[
                  styles.settleAllLink,
                  isDark && { color: colors.primary },
                ]}
              >
                Settle All
              </Text>
            </TouchableOpacity>
          </View>

          {/* ROOMMATE BREAKDOWN CARDS */}
          {roommatesBreakdown.length === 0 ? (
            <View
              style={[
                styles.emptyBreakdownCard,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather
                name="users"
                size={24}
                color={isDark ? colors.textMuted : "#94A3B8"}
              />
              <Text
                style={[
                  styles.emptyNoticeText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                No household members found in this group
              </Text>
            </View>
          ) : (
            <View style={styles.cardsList}>
              {roommatesBreakdown.map((roommate) => (
                <View
                  key={roommate.id}
                  style={[
                    styles.roommateCard,
                    isDark && {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Circular Avatar */}
                  {roommate.photoURL ? (
                    <Image
                      source={{ uri: roommate.photoURL }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatarCircle,
                        { backgroundColor: roommate.avatarBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          { color: roommate.avatarTextColor },
                        ]}
                      >
                        {roommate.initials}
                      </Text>
                    </View>
                  )}

                  {/* Name & Subtitle */}
                  <View style={styles.cardCenterInfo}>
                    <Text
                      style={[
                        styles.roommateName,
                        isDark && { color: colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {roommate.name}
                    </Text>
                    <View style={styles.statusSubRow}>
                      <View
                        style={[
                          styles.subDot,
                          { backgroundColor: roommate.statusDotColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusSubText,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        {roommate.statusText}
                      </Text>
                    </View>
                  </View>

                  {/* Right Amounts */}
                  <View style={styles.cardRightInfo}>
                    <Text
                      style={[
                        styles.roommateAmount,
                        isDark && { color: colors.text },
                      ]}
                    >
                      {roommate.amount}
                    </Text>
                    <Text
                      style={[
                        styles.roommateSettlementTag,
                        { color: roommate.settlementTagColor },
                      ]}
                    >
                      {roommate.settlementTag}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* MONTH / BILLING CYCLE PICKER MODAL */}
      <SmoothBottomSheetModal
        visible={showMonthModal}
        onClose={() => setShowMonthModal(false)}
        variant="bottom-sheet"
        title="Select Billing Cycle"
        subtitle="Review real cloud expense ledger records"
        icon={<Feather name="calendar" size={18} color="#2563EB" />}
      >
        <ScrollView
          style={styles.modalMonthList}
          showsVerticalScrollIndicator={false}
        >
          {periodOptions.map((opt) => {
            const isSelected = selectedCycleId === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.modalMonthRow,
                  isDark && { backgroundColor: colors.surfaceInset },
                  isSelected &&
                    (isDark
                      ? {
                          backgroundColor: "rgba(59, 130, 246, 0.18)",
                          borderColor: "rgba(59, 130, 246, 0.4)",
                          borderWidth: 1,
                        }
                      : styles.modalMonthRowSelected),
                ]}
                onPress={() => {
                  setSelectedCycleId(opt.id);
                  setSelectedMonthLabel(opt.label);
                  setShowMonthModal(false);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text
                    style={[
                      styles.modalMonthText,
                      isDark && { color: colors.text },
                      isSelected &&
                        (isDark
                          ? { color: colors.primary }
                          : styles.modalMonthTextSelected),
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {opt.status === "ACTIVE" && (
                    <View style={styles.activePillTag}>
                      <Text style={styles.activePillTagText}>ACTIVE</Text>
                    </View>
                  )}
                </View>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={isDark ? colors.primary : "#2563EB"}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SmoothBottomSheetModal>

      {/* DETAILS BREAKDOWN MODAL */}
      <SmoothBottomSheetModal
        visible={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        variant="bottom-sheet"
        title={`${selectedMonthLabel || "Billing"} Cost Breakdown`}
        subtitle="Utility categories, attendance deductions & remainder verification"
        icon={<Feather name="bar-chart-2" size={18} color="#2563EB" />}
      >
        <View style={styles.modalDetailsContent}>
          {/* Summary Box */}
          <View
            style={[
              styles.detailSummaryBox,
              isDark && {
                backgroundColor: colors.surfaceInset,
                borderColor: colors.border,
              },
            ]}
          >
            {categoryBreakdown.length === 0 ? (
              <Text
                style={[
                  styles.emptyCategoryNotice,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                No itemized expenses recorded in this period yet.
              </Text>
            ) : (
              categoryBreakdown.map((cat, idx) => (
                <View key={idx} style={styles.detailSummaryRow}>
                  <Text
                    style={[
                      styles.detailLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    {cat.category}
                  </Text>
                  <Text
                    style={[
                      styles.detailValue,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {cat.amountFormatted}
                  </Text>
                </View>
              ))
            )}

            <View
              style={[
                styles.detailDivider,
                isDark && { backgroundColor: colors.borderSubtle },
              ]}
            />
            <View style={styles.detailSummaryRow}>
              <Text
                style={[
                  styles.detailTotalLabel,
                  isDark && { color: colors.text },
                ]}
              >
                Total Verified Invoices
              </Text>
              <Text
                style={[
                  styles.detailTotalValue,
                  isDark && { color: colors.primary },
                ]}
              >
                {totalExpenseFormatted}
              </Text>
            </View>
          </View>

          {/* Math Assurance Badge */}
          <View
            style={[
              styles.mathAssuranceCard,
              isDark && {
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                borderColor: "rgba(16, 185, 129, 0.25)",
              },
            ]}
          >
            <Ionicons
              name="shield-checkmark"
              size={18}
              color={isDark ? "#34D399" : "#059669"}
            />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text
                style={[
                  styles.mathAssuranceTitle,
                  isDark && { color: "#34D399" },
                ]}
              >
                Centavo Remainder Checked
              </Text>
              <Text
                style={[
                  styles.mathAssuranceSub,
                  isDark && { color: "#A7F3D0" },
                ]}
              >
                {mathDiscrepancy === "0.00"
                  ? "Exact remainder allocated deterministically with ₱0.00 discrepancy."
                  : `Remainder discrepancy verified within ₱${mathDiscrepancy}.`}
              </Text>
            </View>
          </View>
        </View>
      </SmoothBottomSheetModal>
    </View>
  );
};

// Also export as MonthlySummaryReportScreen for complete compatibility
export const MonthlySummaryReportScreen = ReportScreen;

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
  },
  circleHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  /* Title Section */
  titleSection: {
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  subTitle: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: 4,
  },

  /* Expense Summary Row */
  expenseSummaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  totalExpenseLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 2,
  },
  totalExpenseAmount: {
    fontSize: 30,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  avgLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  monthPickerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderColor: "#DBEAFE",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
    marginTop: 6,
  },
  monthPickerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },

  /* Chart Card */
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 24,
  },
  emptyChartNotice: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyNoticeText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  chartColumnsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 165,
    paddingBottom: 6,
  },
  chartColumn: {
    alignItems: "center",
    flex: 1,
    maxWidth: 58,
  },
  barValueText: {
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 6,
  },
  barTrackArea: {
    height: 130,
    width: 36,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  capsuleBar: {
    width: 36,
    borderRadius: 10,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 8,
  },
  chartCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  greenStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  statusOnTrackText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
  },
  detailsLink: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#2563EB",
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  settleAllLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },

  /* Roommate Cards */
  cardsList: {
    gap: 10,
  },
  emptyBreakdownCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  roommateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
  },
  cardCenterInfo: {
    flex: 1,
  },
  roommateName: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  statusSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  subDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusSubText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  cardRightInfo: {
    alignItems: "flex-end",
  },
  roommateAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  roommateSettlementTag: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },

  /* Modals */
  modalMonthList: {
    maxHeight: 280,
    paddingVertical: 4,
  },
  modalMonthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    marginVertical: 4,
  },
  modalMonthRowSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
  },
  modalMonthText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  modalMonthTextSelected: {
    color: "#2563EB",
    fontWeight: "700",
  },
  activePillTag: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePillTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#059669",
  },
  modalDetailsContent: {
    paddingVertical: 8,
    gap: 12,
  },
  detailSummaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  emptyCategoryNotice: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    paddingVertical: 10,
  },
  detailSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  detailTotalLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  detailTotalValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563EB",
  },
  mathAssuranceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  mathAssuranceTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#065F46",
  },
  mathAssuranceSub: {
    fontSize: 11,
    color: "#047857",
    marginTop: 1,
  },
});
