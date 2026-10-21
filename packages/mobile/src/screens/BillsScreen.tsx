import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  StatusBar,
  Modal,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  mobileDataService,
  MobileExpense,
  isPayorMember,
  cleanBillTitle,
  isCyclePaymentsLocked,
  computeCycleWaterBreakdown,
  computeFairSplitShareCentavos,
} from "../services/firebaseDataService";
import { auth } from "../firebase/config";
import { formatPesos } from "@propertyflow/shared";
import { PaymentsScreen } from "./PaymentsScreen";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { getCategoryMeta } from "../services/categoryService";
import { getBillDueStatus } from "./HomeScreen";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { useTheme } from "../context/ThemeContext";

export interface BillsScreenProps {
  onBack?: () => void;
  onPayPress?: () => void;
  householdId?: string;
  initialSubView?: "overview" | "pay";
}

export const BillsScreen: React.FC<BillsScreenProps> = ({
  onBack,
  onPayPress,
  householdId,
  initialSubView = "overview",
}) => {
  const { isDark, colors } = useTheme();
  const [subView, setSubView] = useState<"overview" | "pay">(initialSubView);
  const [showMenu, setShowMenu] = useState(false);
  const currentUser = auth.currentUser;
  const cachedProfile = mobileDataService.getCachedProfile(currentUser?.uid);
  const [profile, setProfile] = useState<any | null>(() => cachedProfile);
  const resolvedHouseholdId =
    householdId || profile?.householdId || cachedProfile?.householdId || "";
  const [isProfileLoaded, setIsProfileLoaded] = useState<boolean>(() =>
    Boolean(cachedProfile || householdId),
  );
  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [memberBills, setMemberBills] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [cycleAttendance, setCycleAttendance] = useState<any[]>([]);
  const [attendanceSubmissions, setAttendanceSubmissions] = useState<
    Record<string, any>
  >({});
  const [household, setHousehold] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView);
    }
  }, [initialSubView]);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    Platform.OS === "ios" ? 44 : 20,
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  const activeCycle = useMemo(
    () =>
      cycles.find((c) => c.status === "ACTIVE" || c.status === "FINALIZED") ||
      cycles[0],
    [cycles],
  );
  const myBill = memberBills.find((bill) => bill.userId === currentUser?.uid);

  useEffect(() => {
    let mounted = true;
    if (!currentUser?.uid) {
      setIsProfileLoaded(true);
      setLoading(false);
      return;
    }
    mobileDataService
      .getUserProfile(currentUser.uid)
      .then((nextProfile) => {
        if (mounted) {
          setProfile(nextProfile);
          setIsProfileLoaded(true);
        }
      })
      .catch(() => {
        if (mounted) setIsProfileLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    // If profile is still resolving, keep skeleton loader active without flashing empty state
    if (!isProfileLoaded) {
      return;
    }

    if (!resolvedHouseholdId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const billsReady = {
      expenses: false,
      cycles: false,
      members: false,
    };

    const checkReady = () => {
      if (billsReady.expenses && billsReady.cycles && billsReady.members) {
        setLoading(false);
      }
    };

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubExpenses = mobileDataService.listenToExpenses(
      resolvedHouseholdId,
      (data) => {
        setExpenses(data);
        billsReady.expenses = true;
        checkReady();
      },
    );
    const unsubCycles = mobileDataService.listenToBillingCycles(
      resolvedHouseholdId,
      (data) => {
        setCycles(data);
        billsReady.cycles = true;
        checkReady();
      },
    );
    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      resolvedHouseholdId,
      (data) => {
        setMembers(data);
        billsReady.members = true;
        checkReady();
      },
    );
    const unsubWater = mobileDataService.listenToWaterConfig(
      resolvedHouseholdId,
      setWaterConfig,
    );
    const unsubPayments = mobileDataService.listenToPayments(
      resolvedHouseholdId,
      (data) => setPayments(data),
    );
    const unsubHousehold = mobileDataService.listenToHousehold(
      resolvedHouseholdId,
      (data) => setHousehold(data),
    );
    return () => {
      clearTimeout(safetyTimer);
      unsubExpenses();
      unsubCycles();
      unsubMembers();
      unsubWater();
      unsubPayments();
      unsubHousehold();
    };
  }, [resolvedHouseholdId, isProfileLoaded]);

  useEffect(() => {
    if (!resolvedHouseholdId || !activeCycle?.billingCycleId) {
      setCycleAttendance([]);
      setAttendanceSubmissions({});
      return;
    }
    const unsubAtt = mobileDataService.listenToHouseholdCycleAttendance(
      resolvedHouseholdId,
      activeCycle.billingCycleId,
      setCycleAttendance,
    );
    const unsubSub = mobileDataService.listenToAttendanceSubmissions(
      resolvedHouseholdId,
      activeCycle.billingCycleId,
      setAttendanceSubmissions,
    );
    return () => {
      unsubAtt();
      unsubSub();
    };
  }, [resolvedHouseholdId, activeCycle?.billingCycleId]);

  useEffect(() => {
    if (!resolvedHouseholdId || !activeCycle?.billingCycleId) {
      setMemberBills([]);
      return;
    }
    return mobileDataService.listenToMemberBills(
      resolvedHouseholdId,
      activeCycle.billingCycleId,
      setMemberBills,
    );
  }, [activeCycle?.billingCycleId, resolvedHouseholdId]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  const activeMembers = useMemo(() => {
    return members.filter((m) => m.status === "ACTIVE");
  }, [members]);

  const activePayors = useMemo(() => {
    const list = activeMembers.filter((m) => isPayorMember(m));
    return list.length > 0 ? list : activeMembers;
  }, [activeMembers]);

  const activeNonPayors = useMemo(() => {
    return activeMembers.filter((m) => !isPayorMember(m));
  }, [activeMembers]);

  const isCurrentUserPayor = useMemo(() => {
    const me = activeMembers.find((m) => m.userId === currentUser?.uid);
    return isPayorMember(me);
  }, [activeMembers, currentUser?.uid]);

  const oldestCycleId =
    cycles.length > 0 ? cycles[cycles.length - 1]?.billingCycleId : undefined;
  const knownCycleIds = useMemo(
    () => new Set(cycles.map((c) => c.billingCycleId).filter(Boolean)),
    [cycles],
  );

  const currentCycleExpenses = useMemo(() => {
    return activeCycle
      ? expenses.filter(
          (e) =>
            e.billingCycleId === activeCycle.billingCycleId ||
            ((!e.billingCycleId || !knownCycleIds.has(e.billingCycleId)) &&
              (cycles.length <= 1 ||
                activeCycle.billingCycleId === oldestCycleId)),
        )
      : expenses;
  }, [expenses, activeCycle, cycles.length, oldestCycleId, knownCycleIds]);

  const liveUnpaidShareCents = useMemo(() => {
    if (!isCurrentUserPayor) return 0;
    const payorCount = Math.max(1, activePayors.length);
    const unpaidExpenses = currentCycleExpenses.filter(
      (e) => e.status !== "PAID" && !e.isPaid,
    );
    return unpaidExpenses.reduce((sum, e) => {
      const isWater = (e.category || "").toLowerCase().includes("water");
      const mySplit = e.splitDetails?.find(
        (s: any) => s.userId === currentUser?.uid,
      );

      if (mySplit?.isPaid) {
        return sum;
      }

      if (isWater) {
        const isPersonDayMode =
          waterConfig?.pricingModel === "PER_PERSON_DAY" ||
          !waterConfig?.pricingModel;
        if (isPersonDayMode) {
          const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
          const { getPayorShareCentavos } = computeCycleWaterBreakdown(
            activeMembers,
            cycleAttendance,
            attendanceSubmissions,
            rate,
            e.splitDetails,
          );
          return sum + getPayorShareCentavos(currentUser?.uid);
        }
        if (mySplit && typeof mySplit.shareCentavos === "number") {
          return sum + mySplit.shareCentavos;
        }
      }

      const splitPayors = e.splitDetails
        ? e.splitDetails.filter((s: any) => !s.isExempt)
        : [];
      const splitPayorsSum = splitPayors.reduce(
        (acc: number, s: any) => acc + (Number(s.shareCentavos) || 0),
        0,
      );
      const isSplitStale =
        (splitPayors.length > 0 && splitPayors.length !== payorCount) ||
        (!isWater &&
          splitPayors.length > 0 &&
          splitPayorsSum !== e.amountCents);

      if (
        !isSplitStale &&
        e.splitDetails &&
        Array.isArray(e.splitDetails) &&
        e.splitDetails.length > 0
      ) {
        if (mySplit && typeof mySplit.shareCentavos === "number") {
          return sum + mySplit.shareCentavos;
        }
      }
      return (
        sum +
        computeFairSplitShareCentavos(
          e.amountCents,
          activePayors,
          currentUser?.uid,
        )
      );
    }, 0);
  }, [
    currentCycleExpenses,
    activePayors,
    activeMembers,
    cycleAttendance,
    attendanceSubmissions,
    waterConfig,
    currentUser?.uid,
    isCurrentUserPayor,
  ]);

  const userPayments = useMemo(() => {
    return payments.filter(
      (p) =>
        p.userId === currentUser?.uid &&
        (!activeCycle?.billingCycleId ||
          p.billingCycleId === activeCycle.billingCycleId),
    );
  }, [payments, currentUser?.uid, activeCycle?.billingCycleId]);

  const totalUserPaymentsCentavos = useMemo(() => {
    return userPayments.reduce((sum, p) => sum + (p.amountCentavos || 0), 0);
  }, [userPayments]);

  const totalHouseholdCents = currentCycleExpenses.reduce(
    (acc, cur) => acc + cur.amountCents,
    0,
  );
  const paidCentavos =
    myBill && typeof myBill.totalPaidCentavos === "number"
      ? myBill.totalPaidCentavos
      : 0;
  const effectivePaidCentavos = Math.max(
    paidCentavos,
    totalUserPaymentsCentavos,
  );
  const myShareCents = isCurrentUserPayor
    ? Math.max(0, liveUnpaidShareCents - effectivePaidCentavos)
    : 0;
  const isMyCycleSettled =
    isCurrentUserPayor &&
    currentCycleExpenses.length > 0 &&
    myShareCents === 0 &&
    (effectivePaidCentavos > 0 ||
      currentCycleExpenses.every((e) => e.status === "PAID" || e.isPaid));

  const isPaymentsLocked = isCyclePaymentsLocked(activeCycle, household);
  const isHostUser =
    profile?.role === "HOST" || profile?.role === "SUPER_ADMIN";

  const settledPayorUids = useMemo(() => {
    const settled = new Set<string>();
    if (currentCycleExpenses.length === 0 || activePayors.length === 0) {
      return settled;
    }
    const payorCount = Math.max(1, activePayors.length);
    const cycleId = activeCycle?.billingCycleId;
    const isSingleCycle = cycles.length <= 1;

    activePayors.forEach((p) => {
      const uid = p.userId || p.memberId || p.id;
      if (!uid) return;
      const b = memberBills.find((mb) => mb.userId === uid);
      const userPaidFromPmts = payments
        .filter((pmt) => {
          if (pmt.userId !== uid || pmt.status === "REJECTED") return false;
          if (!cycleId) return true;
          return (
            pmt.billingCycleId === cycleId ||
            ((!pmt.billingCycleId || pmt.billingCycleId === "general") &&
              isSingleCycle)
          );
        })
        .reduce((sum, pmt) => sum + (Number(pmt.amountCentavos) || 0), 0);

      let payorShareTotal = 0;
      let allUserSplitsMarkedPaid = true;
      currentCycleExpenses.forEach((exp) => {
        const mySplit = Array.isArray(exp.splitDetails)
          ? exp.splitDetails.find((s: any) => s.userId === uid)
          : null;
        if (mySplit?.isExempt) return;
        const share =
          mySplit && typeof mySplit.shareCentavos === "number"
            ? mySplit.shareCentavos
            : Math.round((exp.amountCents || 0) / payorCount);
        payorShareTotal += share;
        if (
          !exp.isPaid &&
          exp.status !== "PAID" &&
          !mySplit?.isPaid &&
          share > 0
        ) {
          allUserSplitsMarkedPaid = false;
        }
      });

      if (payorShareTotal <= 0) return;
      const effectivePaid = Math.max(
        b?.totalPaidCentavos || 0,
        userPaidFromPmts,
      );
      const isMemberBillSettled =
        b &&
        typeof b.outstandingCentavos === "number" &&
        b.outstandingCentavos === 0 &&
        (b.totalPaidCentavos || 0) > 0;
      if (
        effectivePaid >= payorShareTotal ||
        allUserSplitsMarkedPaid ||
        isMemberBillSettled
      ) {
        settled.add(uid);
      }
    });

    if (isMyCycleSettled && currentUser?.uid) {
      settled.add(currentUser.uid);
    }

    return settled;
  }, [
    currentCycleExpenses,
    activePayors,
    activeCycle?.billingCycleId,
    cycles.length,
    memberBills,
    payments,
    isMyCycleSettled,
    currentUser?.uid,
  ]);

  const allPayorsSettled =
    currentCycleExpenses.length > 0 &&
    activePayors.length > 0 &&
    activePayors.every((p) => {
      const uid = p.userId || p.memberId || p.id;
      return Boolean(uid && settledPayorUids.has(uid));
    });

  useEffect(() => {
    if (allPayorsSettled && resolvedHouseholdId) {
      const hasUnpaid = currentCycleExpenses.some(
        (e) => e.status !== "PAID" || !e.isPaid,
      );
      if (hasUnpaid) {
        mobileDataService
          .markExpensesPaidIfAllSettled(
            resolvedHouseholdId,
            activeCycle?.billingCycleId,
          )
          .catch(() => {});
      }
    }
  }, [
    allPayorsSettled,
    resolvedHouseholdId,
    activeCycle?.billingCycleId,
    currentCycleExpenses,
  ]);

  // Auto-heal: If an active payor joined and unpaid splits or memberBills are out of sync with current payor count, recalculate in Firestore
  useEffect(() => {
    if (
      !resolvedHouseholdId ||
      activePayors.length === 0 ||
      currentCycleExpenses.length === 0
    )
      return;
    const payorCount = Math.max(1, activePayors.length);
    const hasStaleSplit = currentCycleExpenses.some((e) => {
      if (e.status === "PAID" || e.isPaid) return false;
      const isWater = (e.category || "").toLowerCase().includes("water");
      if (isWater) return false; // Water attendance is managed dynamically
      const splitPayors = e.splitDetails
        ? e.splitDetails.filter((s: any) => !s.isExempt)
        : [];
      return splitPayors.length > 0 && splitPayors.length !== payorCount;
    });

    const isMemberBillStale =
      myBill &&
      typeof myBill.outstandingCentavos === "number" &&
      (myBill.totalPaidCentavos || 0) === 0 &&
      Math.abs(myBill.outstandingCentavos - liveUnpaidShareCents) > 100;

    if (hasStaleSplit || isMemberBillStale) {
      const timer = setTimeout(() => {
        mobileDataService
          .recalculateUnpaidExpensesForHousehold(resolvedHouseholdId)
          .catch(() => {});
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [
    resolvedHouseholdId,
    activePayors.length,
    currentCycleExpenses,
    myBill,
    liveUnpaidShareCents,
  ]);
  const { onScroll } = useNavVisibility();

  if (subView === "pay" && (!isPaymentsLocked || isHostUser)) {
    return (
      <PaymentsScreen
        householdId={resolvedHouseholdId}
        billingCycleId={activeCycle?.billingCycleId}
        initialAmountCentavos={myShareCents}
        onBack={() => setSubView("overview")}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        isDark && { backgroundColor: colors.background },
        { paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent={true}
        backgroundColor="transparent"
      />

      {/* Top Header */}
      <View
        style={[
          styles.navBarContainer,
          { paddingTop: topInset },
          isDark && {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.navBar}>
          <TouchableOpacity
            style={[
              styles.circleBackBtn,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => (onBack ? onBack() : null)}
            activeOpacity={0.7}
          >
            <Feather
              name="chevron-left"
              size={24}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>
          <Text style={[styles.navTitle, isDark && { color: colors.text }]}>
            Bills & Dues
          </Text>
          <TouchableOpacity
            style={[
              styles.iconNavBtn,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setShowMenu(true)}
            activeOpacity={0.7}
          >
            <Feather
              name="more-vertical"
              size={22}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <UniversalSkeleton type="bills" />
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
              { paddingBottom: Math.max(120, insets.bottom + 95) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            <Text style={[styles.title, isDark && { color: colors.text }]}>
              My Current Bill
            </Text>
            <Text
              style={[
                styles.subtitle,
                isDark && { color: colors.textSecondary },
              ]}
            >
              {activeCycle
                ? `${activeCycle.name || "Billing cycle"} · Cloud synced`
                : "Cloud synced"}
            </Text>

            {/* Redesigned Hero Card with balanced, state-harmonious UI */}
            <View
              style={[
                styles.heroCard,
                isMyCycleSettled
                  ? isDark
                    ? {
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: "rgba(16, 185, 129, 0.35)",
                      }
                    : {
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1,
                        borderColor: "#A7F3D0",
                      }
                  : myShareCents === 0
                    ? isDark
                      ? {
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.border,
                          shadowOpacity: 0,
                          elevation: 0,
                        }
                      : {
                          backgroundColor: "#FFFFFF",
                          borderWidth: 1,
                          borderColor: "#E2E8F0",
                          shadowColor: "#0F172A",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.05,
                          shadowRadius: 10,
                          elevation: 2,
                        }
                    : {
                        backgroundColor: "#2563EB",
                        shadowColor: "#2563EB",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.28,
                        shadowRadius: 16,
                        elevation: 5,
                      },
              ]}
            >
              {!isCurrentUserPayor && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.08)"
                        : myShareCents > 0
                          ? "rgba(255, 255, 255, 0.12)"
                          : "#F1F5F9",
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        letterSpacing: 0.5,
                        color: isDark
                          ? colors.textSecondary
                          : myShareCents > 0
                            ? "#CBD5E1"
                            : "#475569",
                      }}
                    >
                      EXEMPT (NON-PAYOR)
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.heroTopRow}>
                <Text
                  style={[
                    styles.heroLabel,
                    isMyCycleSettled
                      ? { color: isDark ? "#34D399" : "#059669" }
                      : myShareCents === 0
                        ? { color: isDark ? colors.textMuted : "#64748B" }
                        : { color: "rgba(255, 255, 255, 0.85)" },
                  ]}
                >
                  Total Remaining Due
                </Text>

                {isMyCycleSettled ? (
                  <View
                    style={[
                      styles.settledTopChip,
                      isDark
                        ? {
                            backgroundColor: "rgba(16, 185, 129, 0.14)",
                            borderColor: "rgba(16, 185, 129, 0.3)",
                          }
                        : {
                            backgroundColor: "#ECFDF5",
                            borderColor: "#A7F3D0",
                          },
                    ]}
                  >
                    <Feather
                      name="check-circle"
                      size={12}
                      color={isDark ? "#34D399" : "#059669"}
                    />
                    <Text
                      style={[
                        styles.settledTopChipText,
                        { color: isDark ? "#34D399" : "#047857" },
                      ]}
                    >
                      Settled ✓
                    </Text>
                  </View>
                ) : myShareCents === 0 ? (
                  <View
                    style={[
                      styles.settledTopChip,
                      isDark
                        ? {
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                            borderColor: "rgba(255, 255, 255, 0.12)",
                          }
                        : {
                            backgroundColor: "#F1F5F9",
                            borderColor: "#E2E8F0",
                          },
                    ]}
                  >
                    <Feather
                      name="check"
                      size={12}
                      color={isDark ? colors.textMuted : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.settledTopChipText,
                        { color: isDark ? colors.textSecondary : "#64748B" },
                      ]}
                    >
                      Up to Date
                    </Text>
                  </View>
                ) : isPaymentsLocked && !isHostUser ? (
                  <View
                    style={[
                      styles.settledTopChip,
                      {
                        backgroundColor: isDark
                          ? "rgba(245, 158, 11, 0.15)"
                          : "rgba(245, 158, 11, 0.18)",
                        borderColor: isDark
                          ? "rgba(245, 158, 11, 0.35)"
                          : "rgba(245, 158, 11, 0.35)",
                      },
                    ]}
                  >
                    <Feather name="lock" size={11} color="#FBBF24" />
                    <Text
                      style={[styles.settledTopChipText, { color: "#FBBF24" }]}
                    >
                      Locked
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.settledTopChip,
                      {
                        backgroundColor: "rgba(255, 255, 255, 0.18)",
                        borderColor: "rgba(255, 255, 255, 0.3)",
                      },
                    ]}
                  >
                    <Feather name="calendar" size={11} color="#FFFFFF" />
                    <Text
                      style={[styles.settledTopChipText, { color: "#FFFFFF" }]}
                    >
                      Due This Cycle
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.heroAmount,
                  isMyCycleSettled
                    ? { color: isDark ? "#FFFFFF" : "#0F172A" }
                    : myShareCents === 0
                      ? { color: isDark ? "#FFFFFF" : "#0F172A" }
                      : { color: "#FFFFFF" },
                ]}
              >
                {formatPesos(myShareCents)}
              </Text>

              <Text
                style={[
                  styles.heroSub,
                  isMyCycleSettled
                    ? { color: isDark ? colors.textSecondary : "#475569" }
                    : myShareCents === 0
                      ? { color: isDark ? colors.textSecondary : "#64748B" }
                      : { color: "rgba(255, 255, 255, 0.9)" },
                ]}
              >
                {isCurrentUserPayor
                  ? isMyCycleSettled && totalUserPaymentsCentavos > 0
                    ? `You paid ${formatPesos(totalUserPaymentsCentavos)} towards this cycle. You're completely up to date.`
                    : `Household bills: ${formatPesos(totalHouseholdCents)} · Split fairly across ${activePayors.length} ${activePayors.length === 1 ? "payor" : "payors"}`
                  : `Household bills (${formatPesos(totalHouseholdCents)}) are split fairly among paying roommates only.`}
              </Text>

              {isCurrentUserPayor &&
                (isMyCycleSettled ? (
                  <View
                    style={[
                      styles.payNowBtn,
                      isDark
                        ? {
                            backgroundColor: "rgba(16, 185, 129, 0.12)",
                            borderWidth: 1,
                            borderColor: "rgba(16, 185, 129, 0.25)",
                          }
                        : {
                            backgroundColor: "#ECFDF5",
                            borderWidth: 1,
                            borderColor: "#A7F3D0",
                          },
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      },
                    ]}
                  >
                    <Feather
                      name="check"
                      size={15}
                      color={isDark ? "#34D399" : "#059669"}
                    />
                    <Text
                      style={[
                        styles.payNowText,
                        {
                          color: isDark ? "#34D399" : "#065F46",
                        },
                      ]}
                    >
                      All Settled — Zero Remaining Dues
                    </Text>
                  </View>
                ) : myShareCents === 0 ? (
                  <View
                    style={[
                      styles.payNowBtn,
                      isDark
                        ? {
                            backgroundColor: colors.cardSecondary,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }
                        : {
                            backgroundColor: "#F8FAFC",
                            borderWidth: 1,
                            borderColor: "#E2E8F0",
                          },
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                      },
                    ]}
                  >
                    <Feather
                      name="clock"
                      size={14}
                      color={isDark ? colors.textSecondary : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.payNowText,
                        {
                          color: isDark ? colors.textSecondary : "#64748B",
                          fontWeight: "700",
                        },
                      ]}
                    >
                      No Bills Due Yet for This Cycle
                    </Text>
                  </View>
                ) : isPaymentsLocked && !isHostUser ? (
                  <View
                    style={[
                      styles.payNowBtn,
                      {
                        backgroundColor: isDark
                          ? "rgba(245, 158, 11, 0.15)"
                          : "rgba(245, 158, 11, 0.15)",
                        borderWidth: 1,
                        borderColor: "rgba(245, 158, 11, 0.35)",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      },
                    ]}
                  >
                    <Feather name="lock" size={14} color="#FBBF24" />
                    <Text
                      style={[
                        styles.payNowText,
                        {
                          color: "#FBBF24",
                        },
                      ]}
                    >
                      Bills Under Review · Locked by Host
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.payNowBtn,
                      {
                        backgroundColor: "#FFFFFF",
                        shadowColor: "#000000",
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.12,
                        shadowRadius: 6,
                        elevation: 3,
                      },
                    ]}
                    onPress={() => {
                      if (onPayPress) onPayPress();
                      setSubView("pay");
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.payNowText,
                        { color: "#2563EB", fontWeight: "800" },
                      ]}
                    >
                      Pay with GCash / Bank →
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>

            <Text
              style={[styles.sectionTitle, isDark && { color: colors.text }]}
            >
              Itemized Charges (
              {currentCycleExpenses.length > 0
                ? `${currentCycleExpenses.length} recorded`
                : "No bills yet"}
              )
            </Text>

            {loading ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <ActivityIndicator color="#2563EB" size="small" />
                <Text style={{ marginTop: 8, color: "#64748B", fontSize: 12 }}>
                  Syncing from Firebase...
                </Text>
              </View>
            ) : !resolvedHouseholdId ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No household connected.</Text>
                <Text style={styles.emptySub}>
                  Ask a host or Super Admin to connect your account to a
                  household.
                </Text>
              </View>
            ) : currentCycleExpenses.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  No household bills logged yet.
                </Text>
                <Text style={styles.emptySub}>
                  Bills will appear here after a host records charges or
                  finalizes a cycle.
                </Text>
              </View>
            ) : (
              currentCycleExpenses.map((e) => {
                const isExpensePaid =
                  e.status === "PAID" || e.isPaid === true || allPayorsSettled;
                const catMeta = getCategoryMeta(e.category);
                const isWater = (e.category || "")
                  .toLowerCase()
                  .includes("water");
                const payorCount = Math.max(1, activePayors.length);
                const isPersonDayMode =
                  waterConfig?.pricingModel === "PER_PERSON_DAY" ||
                  !waterConfig?.pricingModel;

                let waterMyShare = 0;
                let waterTotalCentavos = e.amountCents;
                if (isWater) {
                  if (isPersonDayMode) {
                    const rate = Number(
                      waterConfig?.rateCentavosPerPersonPerDay ?? 500,
                    );
                    const {
                      getPayorShareCentavos,
                      totalAmountCentavos: computedWaterTotal,
                    } = computeCycleWaterBreakdown(
                      activeMembers,
                      cycleAttendance,
                      attendanceSubmissions,
                      rate,
                      e.splitDetails,
                    );
                    if (isCurrentUserPayor) {
                      waterMyShare = getPayorShareCentavos(currentUser?.uid);
                    }
                    if (computedWaterTotal > 0) {
                      waterTotalCentavos = computedWaterTotal;
                    }
                  } else if (
                    waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH"
                  ) {
                    if (isCurrentUserPayor) {
                      waterMyShare =
                        waterConfig.fixedPerPersonAmountCentavos || 0;
                    }
                    waterTotalCentavos =
                      (waterConfig.fixedPerPersonAmountCentavos || 0) *
                      payorCount;
                  } else {
                    if (isCurrentUserPayor) {
                      waterMyShare = computeFairSplitShareCentavos(
                        e.amountCents,
                        activePayors,
                        currentUser?.uid,
                      );
                    }
                  }
                }

                const splitPayors = e.splitDetails
                  ? e.splitDetails.filter(
                      (s: any) => !s.isExempt && s.shareCentavos > 0,
                    )
                  : [];
                const splitPayorsSum = splitPayors.reduce(
                  (acc: number, s: any) => acc + (Number(s.shareCentavos) || 0),
                  0,
                );
                const isSplitStale =
                  !isWater &&
                  splitPayors.length > 0 &&
                  (splitPayors.length !== payorCount ||
                    splitPayorsSum !== e.amountCents);
                const mySplit = e.splitDetails?.find(
                  (s: any) => s.userId === currentUser?.uid,
                );
                const myShareForExpense = !isCurrentUserPayor
                  ? 0
                  : isWater
                    ? waterMyShare
                    : !isSplitStale &&
                        mySplit &&
                        typeof mySplit.shareCentavos === "number"
                      ? mySplit.shareCentavos
                      : computeFairSplitShareCentavos(
                          e.amountCents,
                          activePayors,
                          currentUser?.uid,
                        );
                const dueInfo = getBillDueStatus(
                  e,
                  activeCycle,
                  cycles,
                  isDark,
                );

                const mySharePaid =
                  isCurrentUserPayor &&
                  Boolean(
                    isExpensePaid ||
                    mySplit?.isPaid ||
                    isMyCycleSettled ||
                    (currentUser?.uid && settledPayorUids.has(currentUser.uid)),
                  );

                let paidPayorsCount = 0;
                const waitingPayorNames: string[] = [];
                activePayors.forEach((p) => {
                  const pUid = p.userId || p.memberId || p.id;
                  const pSplit = Array.isArray(e.splitDetails)
                    ? e.splitDetails.find(
                        (s: any) =>
                          s.userId === pUid ||
                          s.memberId === pUid ||
                          s.id === pUid,
                      )
                    : null;
                  const isPayorPaid = Boolean(
                    isExpensePaid ||
                    pSplit?.isPaid ||
                    (pUid && settledPayorUids.has(pUid)),
                  );
                  if (isPayorPaid) {
                    paidPayorsCount += 1;
                  } else {
                    const firstName = (
                      p.displayName ||
                      p.name ||
                      "Roommate"
                    ).split(" ")[0];
                    waitingPayorNames.push(firstName);
                  }
                });

                const waitingSummary =
                  waitingPayorNames.length === 0
                    ? ""
                    : waitingPayorNames.length <= 2
                      ? `Waiting on ${waitingPayorNames.join(", ")}`
                      : `Waiting on ${waitingPayorNames.slice(0, 2).join(", ")} +${waitingPayorNames.length - 2}`;

                return (
                  <View
                    key={e.id}
                    style={[
                      styles.billItem,
                      isDark && { borderBottomColor: colors.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.billIconWrap,
                        {
                          backgroundColor: isDark
                            ? "rgba(255, 255, 255, 0.06)"
                            : catMeta.bgColor,
                        },
                      ]}
                    >
                      <Feather
                        name={catMeta.featherIcon as any}
                        size={18}
                        color={catMeta.color}
                      />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <Text
                          style={[
                            styles.billName,
                            isDark && { color: colors.text },
                          ]}
                        >
                          {cleanBillTitle(e.title, e.category)}
                        </Text>
                        {isExpensePaid ? (
                          <View
                            style={[
                              styles.statusBadgePaid,
                              isDark && {
                                backgroundColor: "rgba(16, 185, 129, 0.15)",
                                borderColor: "rgba(16, 185, 129, 0.3)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeTextPaid,
                                isDark && { color: "#34D399" },
                              ]}
                            >
                              ALL PAID
                            </Text>
                          </View>
                        ) : mySharePaid ? (
                          <View
                            style={[
                              styles.statusBadgePaid,
                              isDark && {
                                backgroundColor: "rgba(16, 185, 129, 0.15)",
                                borderColor: "rgba(16, 185, 129, 0.35)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeTextPaid,
                                isDark && { color: "#34D399" },
                              ]}
                            >
                              YOUR SHARE PAID ✓
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.dueBadge,
                              {
                                backgroundColor: dueInfo.badgeBg,
                                borderColor: dueInfo.badgeBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.dueBadgeText,
                                { color: dueInfo.textColor },
                              ]}
                            >
                              {dueInfo.label}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.billPayer,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        {isExpensePaid
                          ? `${e.date} · Settled by all ${payorCount} group ${payorCount === 1 ? "payor" : "payors"}`
                          : paidPayorsCount > 0
                            ? `${e.date} · ${paidPayorsCount}/${payorCount} payors settled${waitingSummary ? ` · ${waitingSummary}` : ""}`
                            : `${e.date} · Added by ${e.payerName || "Host"} · 0/${payorCount} payors settled`}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", marginTop: 2 }}>
                      <Text
                        style={[
                          styles.billValue,
                          isDark && { color: colors.text },
                        ]}
                      >
                        {formatPesos(
                          isWater && waterTotalCentavos > 0
                            ? waterTotalCentavos
                            : e.amountCents,
                        )}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: !isCurrentUserPayor
                            ? isDark
                              ? colors.textMuted
                              : "#94A3B8"
                            : isExpensePaid || mySharePaid
                              ? isDark
                                ? "#34D399"
                                : "#16A34A"
                              : isDark
                                ? colors.accent
                                : "#2563EB",
                          fontWeight: "700",
                          marginTop: 2,
                        }}
                      >
                        {!isCurrentUserPayor
                          ? "Exempt"
                          : isExpensePaid || mySharePaid
                            ? `Your share: ${formatPesos(myShareForExpense)} (Paid ✓)`
                            : `Your share: ${formatPesos(myShareForExpense)}`}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {userPayments.length > 0 && (
              <View style={{ marginTop: 24, marginBottom: 20 }}>
                <Text
                  style={[
                    styles.sectionTitle,
                    isDark && { color: colors.text },
                    { marginBottom: 12 },
                  ]}
                >
                  Recorded Payments & Receipts ({userPayments.length})
                </Text>
                {userPayments.map((p) => {
                  return (
                    <View
                      key={p.paymentId || p.id}
                      style={[
                        styles.billItem,
                        isDark && { borderBottomColor: colors.border },
                      ]}
                    >
                      <View
                        style={[
                          styles.billIconWrap,
                          {
                            backgroundColor: isDark
                              ? "rgba(16, 185, 129, 0.15)"
                              : "#DCFCE7",
                          },
                        ]}
                      >
                        <Feather
                          name="check-circle"
                          size={18}
                          color={isDark ? "#34D399" : "#16A34A"}
                        />
                      </View>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Text
                            style={[
                              styles.billName,
                              isDark && { color: colors.text },
                            ]}
                          >
                            Paid via {p.paymentMethod || "GCash"}
                          </Text>
                          <View
                            style={[
                              styles.statusBadgePaid,
                              isDark && {
                                backgroundColor: "rgba(16, 185, 129, 0.15)",
                                borderColor: "rgba(16, 185, 129, 0.3)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeTextPaid,
                                isDark && { color: "#34D399" },
                              ]}
                            >
                              SETTLED
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.billPayer,
                            isDark && { color: colors.textSecondary },
                          ]}
                        >
                          {p.paymentDate ||
                            p.createdDate?.slice(0, 10) ||
                            "Recent"}{" "}
                          · Ref: {p.referenceNumber || "Direct"}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", marginTop: 2 }}>
                        <Text
                          style={[
                            styles.billValue,
                            {
                              color: isDark ? "#34D399" : "#16A34A",
                              fontWeight: "900",
                            },
                          ]}
                        >
                          -{formatPesos(p.amountCentavos)}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: isDark ? colors.textMuted : "#64748B",
                            fontWeight: "600",
                            marginTop: 2,
                          }}
                        >
                          Credited
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* Menu Modal matching elevated bottom sheet design */}
      <SmoothBottomSheetModal
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Bill Options"
        subtitle="Manage billing cycle & payment actions"
        icon={
          <Feather
            name="layers"
            size={18}
            color={isDark ? colors.accent : "#2563EB"}
          />
        }
      >
        <View style={{ paddingTop: 6, paddingBottom: 10 }}>
          <TouchableOpacity
            style={[
              styles.menuItem,
              isDark && { borderBottomColor: colors.border },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              setShowMenu(false);
              if (onPayPress) onPayPress();
              setSubView("pay");
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDark ? colors.surfaceInset : "#EFF6FF",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather
                name="credit-card"
                size={18}
                color={isDark ? colors.accent : "#2563EB"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.menuItemText, isDark && { color: colors.text }]}
              >
                Pay / Settle Dues
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? colors.textSecondary : "#64748B",
                  marginTop: 2,
                }}
              >
                Submit payment receipt or pay outstanding balance
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#94A3B8"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.menuItem,
              isDark && { borderBottomColor: colors.border },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              setShowMenu(false);
              if (resolvedHouseholdId) {
                setLoading(true);
                mobileDataService
                  .recalculateUnpaidExpensesForHousehold(resolvedHouseholdId)
                  .then(() => setLoading(false))
                  .catch(() => setLoading(false));
              }
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDark
                  ? "rgba(16, 185, 129, 0.15)"
                  : "#F0FDF4",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather
                name="refresh-cw"
                size={18}
                color={isDark ? "#34D399" : "#059669"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.menuItemText, isDark && { color: colors.text }]}
              >
                Recalculate & Sync Splits
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? colors.textSecondary : "#64748B",
                  marginTop: 2,
                }}
              >
                Recompute centavos distribution for all roommates
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#94A3B8"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={() => {
              setShowMenu(false);
              Alert.alert(
                "Billing Information",
                activeCycle
                  ? `Current Cycle: ${activeCycle.name || "Active Cycle"}\nDates: ${activeCycle.startDate} to ${activeCycle.endDate}`
                  : "No active cycle is currently selected.",
              );
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather
                name="info"
                size={18}
                color={isDark ? colors.text : "#0F172A"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.menuItemText, isDark && { color: colors.text }]}
              >
                Billing Cycle Details
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? colors.textSecondary : "#64748B",
                  marginTop: 2,
                }}
              >
                View active cycle dates and period status
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#94A3B8"}
            />
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  navBarContainer: {
    backgroundColor: "#F8FAFC",
    zIndex: 50,
  },
  navBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  circleBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  menuHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  scrollContent: { padding: 20, paddingBottom: 96 },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  segmentTextActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  title: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 2, marginBottom: 16 },
  heroCard: {
    borderRadius: 22,
    padding: 22,
    marginBottom: 24,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: "900",
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },
  payNowBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  payNowText: {
    fontWeight: "800",
    fontSize: 14,
  },
  settledTopChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  settledTopChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  emptyTitle: { fontSize: 13, fontWeight: "700", color: "#334155" },
  emptySub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  billItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  billIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 1,
  },
  billName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 18,
  },
  billPayer: { fontSize: 11, color: "#64748B", marginTop: 3 },
  billValue: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  dueBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dueBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  statusBadgeUnpaid: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  statusBadgeTextUnpaid: {
    color: "#B91C1C",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusBadgePaid: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    display: "none",
  },
  statusBadgeTextPaid: {
    color: "#047857",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
