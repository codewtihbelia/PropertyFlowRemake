import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  isPayorMember,
} from "../services/firebaseDataService";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { WaterSettingsModal } from "../components/WaterSettingsModal";
import {
  UniversalLoader,
  UniversalSkeleton,
} from "../components/UniversalLoader";
import { useTheme } from "../context/ThemeContext";

interface CycleDate {
  iso: string;
  dayNum: number;
  monthShort: string;
  dayOfWeek: string;
  isWeekend: boolean;
  rawDate: Date;
}

interface MonthSection {
  monthKey: string;
  monthName: string;
  year: number;
  dates: CycleDate[];
  startDayNum: number;
  endDayNum: number;
  leadingEmptyDays: number;
}

const generateCycleDates = (
  startStr?: string,
  endStr?: string,
): CycleDate[] => {
  const dates: CycleDate[] = [];
  const now = new Date();

  let start = startStr
    ? new Date(startStr)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  let end = endStr
    ? new Date(endStr)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0);

  if (isNaN(start.getTime())) {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (isNaN(end.getTime()) || end < start) {
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  }

  const cur = new Date(start);
  const monthNames = [
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
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let safety = 0;
  while (cur <= end && safety < 65) {
    safety++;
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    dates.push({
      iso,
      dayNum: cur.getDate(),
      monthShort: monthNames[cur.getMonth()],
      dayOfWeek: dayNames[cur.getDay()],
      isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
      rawDate: new Date(cur),
    });
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

const groupDatesByMonth = (cycleDates: CycleDate[]): MonthSection[] => {
  const map = new Map<string, CycleDate[]>();
  for (const cd of cycleDates) {
    const key = `${cd.rawDate.getFullYear()}-${cd.rawDate.getMonth()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(cd);
  }

  const sections: MonthSection[] = [];
  const fullMonthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  map.forEach((dates) => {
    if (dates.length === 0) return;
    const first = dates[0];
    const last = dates[dates.length - 1];
    // Monday-first index: Monday = 0, ..., Sunday = 6
    const leadingEmptyDays = (first.rawDate.getDay() + 6) % 7;
    sections.push({
      monthKey: `${first.rawDate.getFullYear()}-${first.rawDate.getMonth()}`,
      monthName: fullMonthNames[first.rawDate.getMonth()],
      year: first.rawDate.getFullYear(),
      dates,
      startDayNum: first.dayNum,
      endDayNum: last.dayNum,
      leadingEmptyDays,
    });
  });

  return sections;
};

const getInitials = (name?: string): string => {
  if (!name) return "R";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AVATAR_COLORS = [
  "#2563EB",
  "#F59E0B",
  "#7C3AED",
  "#0D9488",
  "#E11D48",
  "#4F46E5",
  "#059669",
];

export const AttendanceScreen: React.FC<{
  householdId?: string;
  billingCycleId?: string;
  userId?: string;
  onBack?: () => void;
}> = ({ householdId, billingCycleId, userId, onBack }) => {
  const { isDark, colors } = useTheme();
  const currentUser = auth.currentUser;
  const cachedProfile = mobileDataService.getCachedProfile(currentUser?.uid);
  const [profile, setProfile] = useState<any | null>(() => cachedProfile);
  const resolvedHouseholdId =
    householdId || profile?.householdId || cachedProfile?.householdId || "";
  const [isProfileLoaded, setIsProfileLoaded] = useState<boolean>(() =>
    Boolean(cachedProfile || householdId),
  );
  const [cycles, setCycles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [presentDates, setPresentDates] = useState<string[]>([]);
  const [allCycleAttendance, setAllCycleAttendance] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const isBatchingRef = useRef<boolean>(false);
  const [isBatching, setIsBatching] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showWaterSettingsModal, setShowWaterSettingsModal] =
    useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const activeUserId = userId || currentUser?.uid || "";

  const activeCycle = useMemo(
    () =>
      cycles.find((c) => c.billingCycleId === billingCycleId) ||
      cycles.find((c) => c.status === "ACTIVE" || c.status === "FINALIZED") ||
      cycles[0],
    [billingCycleId, cycles],
  );
  const resolvedBillingCycleId =
    billingCycleId || activeCycle?.billingCycleId || "";

  const cycleDates = useMemo(
    () =>
      activeCycle
        ? generateCycleDates(activeCycle.startDate, activeCycle.endDate)
        : [],
    [activeCycle],
  );

  const monthSections = useMemo(
    () => groupDatesByMonth(cycleDates),
    [cycleDates],
  );

  const pricingModel =
    waterConfig?.pricingModel ||
    (waterConfig?.fixedMonthlyAmountCentavos
      ? "FIXED_MONTHLY"
      : "PER_PERSON_DAY");
  const isFixedMode =
    pricingModel === "FIXED_MONTHLY" ||
    pricingModel === "FIXED_PER_PERSON_MONTH";

  const ratePerDayPesos =
    ((waterConfig?.rateCentavosPerPersonPerDay ?? 500) || 500) / 100;
  const fixedMonthlyPesos =
    ((waterConfig?.fixedMonthlyAmountCentavos ?? 0) || 0) / 100;
  const fixedPerPersonPesos =
    ((waterConfig?.fixedPerPersonAmountCentavos ?? 0) || 0) / 100;

  const isHost =
    profile?.role === "HOST" ||
    profile?.role === "SUPER_ADMIN" ||
    profile?.hostApplicationStatus === "APPROVED" ||
    members.some(
      (m) =>
        (m.userId === currentUser?.uid || m.memberId === currentUser?.uid) &&
        m.role === "HOST",
    );

  const hostMember = members.find((m) => m.role === "HOST");
  const hostName = hostMember?.displayName || "Property Host";

  const activePayors = useMemo(() => {
    return members.filter((m) => m.status === "ACTIVE" && isPayorMember(m));
  }, [members]);

  const payingRoommatesCount = Math.max(1, activePayors.length);
  const myFixedSharePesos =
    pricingModel === "FIXED_MONTHLY"
      ? fixedMonthlyPesos / payingRoommatesCount
      : fixedPerPersonPesos;

  const mySubmission = submissions[activeUserId];
  const isMyAttendanceSubmitted = Boolean(mySubmission);

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
    // Wait for profile resolution before deciding if user is in a household
    if (!isProfileLoaded) {
      return;
    }

    if (!resolvedHouseholdId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const attReady = { cycles: false, members: false };
    const checkReady = () => {
      if (attReady.cycles && attReady.members) {
        setLoading(false);
      }
    };

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubCycles = mobileDataService.listenToBillingCycles(
      resolvedHouseholdId,
      (data) => {
        setCycles(data);
        attReady.cycles = true;
        checkReady();
      },
    );
    const unsubWater = mobileDataService.listenToWaterConfig(
      resolvedHouseholdId,
      setWaterConfig,
    );
    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      resolvedHouseholdId,
      (data) => {
        setMembers(data);
        attReady.members = true;
        checkReady();
      },
    );
    return () => {
      clearTimeout(safetyTimer);
      unsubCycles();
      unsubWater();
      unsubMembers();
    };
  }, [resolvedHouseholdId, isProfileLoaded]);

  useEffect(() => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId)
      return;
    const unsubAtt = mobileDataService.listenToAttendance(
      resolvedHouseholdId,
      resolvedBillingCycleId,
      activeUserId,
      (markedDates) => {
        if (isBatchingRef.current) return;
        const serverPresent = Object.entries(markedDates)
          .filter(([, status]) => status === "PRESENT")
          .map(([date]) => date);

        setPresentDates((prev) => {
          const merged = new Set(serverPresent);
          for (const pendingIso of inFlightRef.current) {
            if (prev.includes(pendingIso)) {
              merged.add(pendingIso);
            } else {
              merged.delete(pendingIso);
            }
          }
          return Array.from(merged);
        });
      },
    );

    const unsubCycleAll = mobileDataService.listenToHouseholdCycleAttendance(
      resolvedHouseholdId,
      resolvedBillingCycleId,
      setAllCycleAttendance,
    );

    const unsubSubs = mobileDataService.listenToAttendanceSubmissions(
      resolvedHouseholdId,
      resolvedBillingCycleId,
      setSubmissions,
    );

    return () => {
      unsubAtt();
      unsubCycleAll();
      unsubSubs();
    };
  }, [activeUserId, resolvedBillingCycleId, resolvedHouseholdId]);

  // Zero-latency toggle with real-time sync across household and bills
  const toggleDay = async (iso: string) => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId)
      return;
    if (inFlightRef.current.has(iso) || isBatchingRef.current) return;

    const isCurrentlyPresent = presentDates.includes(iso);
    const nextStatus = isCurrentlyPresent ? "ABSENT" : "PRESENT";

    inFlightRef.current.add(iso);

    const nextPresent =
      nextStatus === "PRESENT"
        ? presentDates.includes(iso)
          ? presentDates
          : [...presentDates, iso]
        : presentDates.filter((date) => date !== iso);

    setPresentDates(nextPresent);

    try {
      await mobileDataService.toggleAttendance(
        resolvedHouseholdId,
        resolvedBillingCycleId,
        activeUserId,
        iso,
        nextStatus,
      );

      // If user already submitted before, keep submission record updated in background
      if (isMyAttendanceSubmitted) {
        const nextPresentCount = nextPresent.length;
        const nextAbsentCount = Math.max(
          0,
          cycleDates.length - nextPresentCount,
        );
        const nextWaterFee = isFixedMode
          ? myFixedSharePesos
          : nextPresentCount * ratePerDayPesos;
        mobileDataService
          .submitAttendance(
            resolvedHouseholdId,
            resolvedBillingCycleId,
            activeUserId,
            nextPresentCount,
            nextAbsentCount,
            Math.round(nextWaterFee * 100),
          )
          .catch(() => {});
      }

      // Synchronously recalculate and update water bills across screens
      await mobileDataService.syncCycleWaterBill(
        resolvedHouseholdId,
        resolvedBillingCycleId,
      );
      await mobileDataService.recalculateUnpaidExpensesForHousehold(
        resolvedHouseholdId,
      );
    } catch (err) {
      console.warn("[AttendanceScreen] toggleDay failed, rolling back:", err);
      setPresentDates((prev) =>
        isCurrentlyPresent
          ? prev.includes(iso)
            ? prev
            : [...prev, iso]
          : prev.filter((d) => d !== iso),
      );
    } finally {
      inFlightRef.current.delete(iso);
    }
  };

  const markAll = async () => {
    if (
      !resolvedHouseholdId ||
      !resolvedBillingCycleId ||
      !activeUserId ||
      isBatchingRef.current
    )
      return;
    setIsBatching(true);
    isBatchingRef.current = true;
    const prevDates = [...presentDates];
    const allIsos = cycleDates.map((d) => d.iso);
    setPresentDates(allIsos);

    try {
      await mobileDataService.bulkToggleAttendance(
        resolvedHouseholdId,
        resolvedBillingCycleId,
        activeUserId,
        cycleDates.map((d) => ({ date: d.iso, status: "PRESENT" as const })),
      );

      if (isMyAttendanceSubmitted) {
        const nextPresentCount = allIsos.length;
        const nextWaterFee = isFixedMode
          ? myFixedSharePesos
          : nextPresentCount * ratePerDayPesos;
        await mobileDataService.submitAttendance(
          resolvedHouseholdId,
          resolvedBillingCycleId,
          activeUserId,
          nextPresentCount,
          0,
          Math.round(nextWaterFee * 100),
        );
      }

      await mobileDataService.syncCycleWaterBill(
        resolvedHouseholdId,
        resolvedBillingCycleId,
      );
      await mobileDataService.recalculateUnpaidExpensesForHousehold(
        resolvedHouseholdId,
      );
    } catch (err) {
      console.warn("[AttendanceScreen] markAll error:", err);
      setPresentDates(prevDates);
    } finally {
      setIsBatching(false);
      isBatchingRef.current = false;
    }
  };

  const clearAll = async () => {
    if (
      !resolvedHouseholdId ||
      !resolvedBillingCycleId ||
      !activeUserId ||
      isBatchingRef.current
    )
      return;
    setIsBatching(true);
    isBatchingRef.current = true;
    const prevDates = [...presentDates];
    setPresentDates([]);

    try {
      await mobileDataService.bulkToggleAttendance(
        resolvedHouseholdId,
        resolvedBillingCycleId,
        activeUserId,
        cycleDates.map((d) => ({ date: d.iso, status: "ABSENT" as const })),
      );

      if (isMyAttendanceSubmitted) {
        const nextWaterFee = isFixedMode ? myFixedSharePesos : 0;
        await mobileDataService.submitAttendance(
          resolvedHouseholdId,
          resolvedBillingCycleId,
          activeUserId,
          0,
          cycleDates.length,
          Math.round(nextWaterFee * 100),
        );
      }

      await mobileDataService.syncCycleWaterBill(
        resolvedHouseholdId,
        resolvedBillingCycleId,
      );
      await mobileDataService.recalculateUnpaidExpensesForHousehold(
        resolvedHouseholdId,
      );
    } catch (err) {
      console.warn("[AttendanceScreen] clearAll error:", err);
      setPresentDates(prevDates);
    } finally {
      setIsBatching(false);
      isBatchingRef.current = false;
    }
  };

  const totalDays = cycleDates.length;
  const presentCount = presentDates.length;
  const absentCount = Math.max(0, totalDays - presentCount);
  const waterFee = isFixedMode
    ? myFixedSharePesos
    : presentCount * ratePerDayPesos;
  const { onScroll } = useNavVisibility();

  // Handle Submit / Update Attendance
  const handleSubmitAttendance = async () => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId) {
      Alert.alert(
        "Notice",
        "No active billing cycle found to record attendance.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const centavos = Math.round(waterFee * 100);
      await mobileDataService.submitAttendance(
        resolvedHouseholdId,
        resolvedBillingCycleId,
        activeUserId,
        presentCount,
        absentCount,
        centavos,
      );
      // Ensure water bill expense & all memberBills are immediately updated
      await mobileDataService.syncCycleWaterBill(
        resolvedHouseholdId,
        resolvedBillingCycleId,
      );
      await mobileDataService.recalculateUnpaidExpensesForHousehold(
        resolvedHouseholdId,
      );

      setIsSubmitting(false);
      Alert.alert(
        "Attendance Synced",
        `Your water presence (${presentCount} days present, ₱${waterFee.toFixed(
          2,
        )}) has been submitted and updated synchronously across all household bills. You can still edit your dates anytime.`,
      );
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert("Error", err.message || "Failed to submit attendance.");
    }
  };

  // Manual Refresh Handler
  const handleRefresh = async () => {
    if (!resolvedHouseholdId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (resolvedBillingCycleId) {
        await mobileDataService.syncCycleWaterBill(
          resolvedHouseholdId,
          resolvedBillingCycleId,
        );
      }
      await mobileDataService.recalculateUnpaidExpensesForHousehold(
        resolvedHouseholdId,
      );
    } catch (err) {
      console.warn("[AttendanceScreen] refresh notice:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format date range nicely (e.g. "Jul 13, 2026 – Aug 12, 2026")
  const formatCycleRangeTitle = (
    startStr?: string,
    endStr?: string,
  ): string => {
    if (!startStr || !endStr) return "Current Billing Cycle";
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const months = [
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
      return `${months[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
    } catch {
      return `${startStr} – ${endStr}`;
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        isDark && { backgroundColor: colors.background },
      ]}
    >
      {/* Top Bar with circular buttons matching Image 1 */}
      <View
        style={[
          styles.topBar,
          isDark && {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.circleIconBtn,
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
            size={22}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.topBarTitle, isDark && { color: colors.text }]}>
            Attendance
          </Text>
          <Text
            style={[
              styles.topBarSubtitle,
              isDark && { color: colors.textSecondary },
            ]}
          >
            Water Utility Tracking
          </Text>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[
              styles.circleIconBtn,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={handleRefresh}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={20}
                color={isDark ? colors.text : "#0F172A"}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.circleIconBtn,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {
              if (isHost) {
                setShowWaterSettingsModal(true);
              } else {
                Alert.alert(
                  "Water Mode Info",
                  pricingModel === "FIXED_MONTHLY"
                    ? `Fixed monthly water bill is split evenly across ${payingRoommatesCount} roommates.`
                    : pricingModel === "FIXED_PER_PERSON_MONTH"
                      ? `Flat water fee of ₱${fixedPerPersonPesos.toFixed(2)} / resident / month.`
                      : `Daily rate is ₱${ratePerDayPesos.toFixed(2)}/day present. Configured by host.`,
                );
              }
            }}
            activeOpacity={0.7}
          >
            <Feather
              name="more-vertical"
              size={20}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <UniversalSkeleton type="attendance" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {!resolvedHouseholdId || !activeCycle ? (
            <View
              style={[
                styles.emptyCard,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="calendar-outline" size={40} color="#94A3B8" />
              <Text
                style={[styles.emptyTitle, isDark && { color: colors.text }]}
              >
                No Active Billing Cycle
              </Text>
              <Text
                style={[
                  styles.emptySub,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Ask your host to create a billing cycle to log and calculate
                water attendance.
              </Text>
            </View>
          ) : (
            <>
              {/* =========================================================================
                BLUE HERO CARD - Pixel perfect match to Image 1
                ========================================================================= */}
              <View
                style={[
                  styles.heroCard,
                  isDark && {
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    shadowOpacity: 0,
                    elevation: 0,
                  },
                ]}
              >
                <View style={styles.heroTopRow}>
                  <View
                    style={[
                      styles.activeCyclePill,
                      isDark && {
                        backgroundColor: "rgba(59, 130, 246, 0.18)",
                        borderColor: colors.borderHighlighted,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <View style={styles.activeCycleDot} />
                    <Text
                      style={[
                        styles.activeCyclePillText,
                        isDark && { color: colors.accent },
                      ]}
                    >
                      Active Billing Cycle
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.totalDaysText,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    {totalDays} Total Days
                  </Text>
                </View>

                <Text
                  style={[
                    styles.heroCycleRange,
                    isDark && { color: colors.text },
                  ]}
                >
                  {formatCycleRangeTitle(
                    activeCycle.startDate,
                    activeCycle.endDate,
                  )}
                </Text>

                <Text
                  style={[
                    styles.heroWaterRate,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Water Bill:{" "}
                  <Text
                    style={[
                      styles.heroWaterRateBold,
                      isDark && { color: colors.accent },
                    ]}
                  >
                    {pricingModel === "FIXED_MONTHLY"
                      ? `₱${fixedMonthlyPesos.toFixed(2)} / month total`
                      : pricingModel === "FIXED_PER_PERSON_MONTH"
                        ? `₱${fixedPerPersonPesos.toFixed(2)} / resident / mo`
                        : `₱${ratePerDayPesos.toFixed(2)} / day / person`}
                  </Text>
                </Text>

                {/* 3 Translucent Metric Cards */}
                <View style={styles.heroMetricsRow}>
                  <View
                    style={[
                      styles.heroMetricBox,
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.heroMetricLabel,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      Present Days
                    </Text>
                    <Text
                      style={[
                        styles.heroMetricValue,
                        isDark && { color: colors.text },
                      ]}
                    >
                      {presentCount}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.heroMetricBox,
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.heroMetricLabel,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      Absent Days
                    </Text>
                    <Text
                      style={[
                        styles.heroMetricValue,
                        isDark && { color: colors.text },
                      ]}
                    >
                      {absentCount}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.heroMetricBox,
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.heroMetricLabel,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      Your Due
                    </Text>
                    <Text
                      style={[
                        styles.heroMetricValue,
                        styles.heroMetricValueDue,
                        isDark && { color: colors.accent },
                      ]}
                    >
                      ₱{waterFee.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* =========================================================================
                WATER UTILITY FEE ACTION BAR - Pixel perfect match to Image 1
                ========================================================================= */}
              <View
                style={[
                  styles.feeBarCard,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.feeIconCircle,
                    isDark && { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Ionicons
                    name="water"
                    size={18}
                    color={isDark ? colors.accent : "#2563EB"}
                  />
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text
                    style={[
                      styles.feeBarTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    Water Utility Fee
                  </Text>
                  <Text
                    style={[
                      styles.feeBarSubtitle,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    {pricingModel === "FIXED_MONTHLY"
                      ? `Fixed ₱${fixedMonthlyPesos.toFixed(2)} split evenly`
                      : pricingModel === "FIXED_PER_PERSON_MONTH"
                        ? `Fixed ₱${fixedPerPersonPesos.toFixed(2)} flat fee`
                        : `Fixed ₱${ratePerDayPesos.toFixed(0)} per present day`}
                  </Text>
                </View>

                {!isFixedMode && (
                  <View style={styles.feeBarActions}>
                    <TouchableOpacity
                      style={[
                        styles.markAllBtn,
                        isDark && { backgroundColor: colors.primaryLight },
                      ]}
                      onPress={markAll}
                      disabled={isBatching}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.markAllBtnText,
                          isDark && { color: colors.accent },
                        ]}
                      >
                        Mark All
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.clearBtn,
                        isDark && {
                          backgroundColor: colors.surfaceInset,
                          borderColor: colors.border,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={clearAll}
                      disabled={isBatching}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.clearBtnText,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        Clear
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* =========================================================================
                CALENDAR SECTION - Grouped by Month with Clean Dates ONLY (No ₱5)
                ========================================================================= */}
              {isFixedMode ? (
                <View
                  style={[
                    styles.fixedNoticeCard,
                    isDark && {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.fixedNoticeIconBox,
                      isDark && { backgroundColor: "rgba(16, 185, 129, 0.15)" },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={32}
                      color={isDark ? colors.success : "#059669"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.fixedNoticeTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    Daily attendance is not required for your apartment.
                  </Text>
                  <Text
                    style={[
                      styles.fixedNoticeSub,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    {pricingModel === "FIXED_MONTHLY"
                      ? `Household water bill (₱${fixedMonthlyPesos.toFixed(
                          2,
                        )}) is split evenly across ${payingRoommatesCount} paying roommates.`
                      : `Water is billed as a flat monthly rate of ₱${fixedPerPersonPesos.toFixed(
                          2,
                        )} / resident.`}
                  </Text>
                  <View
                    style={[
                      styles.fixedHostTag,
                      isDark && {
                        backgroundColor: "rgba(59, 130, 246, 0.12)",
                        borderColor: "rgba(59, 130, 246, 0.25)",
                      },
                    ]}
                  >
                    <Feather
                      name="shield"
                      size={13}
                      color={isDark ? colors.accent : "#0369A1"}
                    />
                    <Text
                      style={[
                        styles.fixedHostTagText,
                        isDark && { color: colors.accent },
                      ]}
                    >
                      Set by Property Host ({hostName})
                    </Text>
                  </View>
                </View>
              ) : (
                monthSections.map((sec) => {
                  const sectionPresentCount = sec.dates.filter((d) =>
                    presentDates.includes(d.iso),
                  ).length;
                  const totalInSec = sec.dates.length;
                  const rangeLabel = `${sec.dates[0].monthShort} ${sec.startDayNum} – ${
                    sec.dates[sec.dates.length - 1].monthShort
                  } ${sec.endDayNum} (${totalInSec} days)`;

                  // Weekday headers matching Image 1: MON TUE WED THU FRI SAT SUN
                  const weekdayLabels = [
                    "MON",
                    "TUE",
                    "WED",
                    "THU",
                    "FRI",
                    "SAT",
                    "SUN",
                  ];

                  return (
                    <View
                      key={sec.monthKey}
                      style={[
                        styles.calendarCard,
                        isDark && {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {/* Month Header */}
                      <View style={styles.monthHeaderRow}>
                        <View style={styles.monthTitleLeft}>
                          <View
                            style={[
                              styles.monthDot,
                              isDark && { backgroundColor: colors.accent },
                            ]}
                          />
                          <Text
                            style={[
                              styles.monthTitleText,
                              isDark && { color: colors.text },
                            ]}
                          >
                            {sec.monthName} {sec.year}
                          </Text>
                          <View
                            style={[
                              styles.monthRangePill,
                              isDark && {
                                backgroundColor: colors.surfaceInset,
                                borderWidth: 1,
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.monthRangePillText,
                                isDark && { color: colors.textSecondary },
                              ]}
                            >
                              {rangeLabel}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.monthPresentRatio,
                            isDark && { color: colors.accent },
                          ]}
                        >
                          {sectionPresentCount} / {totalInSec} Present
                        </Text>
                      </View>

                      {/* Weekday Row */}
                      <View style={styles.weekdaysRow}>
                        {weekdayLabels.map((w) => (
                          <Text
                            key={w}
                            style={[
                              styles.weekdayText,
                              isDark && { color: colors.textMuted },
                            ]}
                          >
                            {w}
                          </Text>
                        ))}
                      </View>

                      {/* Days Grid - Only dates, no ₱5 per user instruction! */}
                      <View style={styles.daysGrid}>
                        {/* Leading empty spacers to align day of week */}
                        {Array.from({ length: sec.leadingEmptyDays }).map(
                          (_, idx) => (
                            <View
                              key={`spacer_${idx}`}
                              style={styles.dayBoxEmpty}
                            />
                          ),
                        )}

                        {/* Actual Cycle Dates - Clean date numbers only */}
                        {sec.dates.map((d) => {
                          const isPresent = presentDates.includes(d.iso);
                          return (
                            <TouchableOpacity
                              key={d.iso}
                              style={[
                                styles.dayBox,
                                isPresent
                                  ? [
                                      styles.dayBoxPresent,
                                      isDark && {
                                        backgroundColor: colors.primary,
                                        borderColor: colors.primary,
                                        shadowColor: colors.primary,
                                      },
                                    ]
                                  : [
                                      styles.dayBoxAbsent,
                                      isDark && {
                                        backgroundColor: colors.surfaceInset,
                                        borderColor:
                                          "rgba(255, 255, 255, 0.12)",
                                      },
                                    ],
                              ]}
                              onPress={() => toggleDay(d.iso)}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.dayNumberText,
                                  isPresent
                                    ? styles.dayNumberTextPresent
                                    : [
                                        styles.dayNumberTextAbsent,
                                        isDark && {
                                          color: colors.textSecondary,
                                        },
                                      ],
                                ]}
                              >
                                {d.dayNum}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              )}

              {/* =========================================================================
                ROOMMATES BREAKDOWN CARD - Pixel perfect match to Image 2
                ========================================================================= */}
              <View
                style={[
                  styles.breakdownCard,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.breakdownHeader}>
                  <Text
                    style={[
                      styles.breakdownTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    Roommates Breakdown
                  </Text>
                  <Text
                    style={[
                      styles.breakdownMemberCount,
                      isDark && { color: colors.accent },
                    ]}
                  >
                    {members.length} Member{members.length === 1 ? "" : "s"}
                  </Text>
                </View>

                <View style={styles.roommatesList}>
                  {members.map((member, index) => {
                    const mUid = member.userId || member.memberId;
                    const isMe = mUid === activeUserId;
                    const isPayor = isPayorMember(member);

                    // Calculate days present for this member from allCycleAttendance or submissions
                    const attPresentCount = allCycleAttendance.filter(
                      (a) =>
                        (a.userId === mUid ||
                          a.userId === member.userId ||
                          a.userId === member.memberId ||
                          a.userId === member.id ||
                          (member.userId &&
                            a.userId === member.userId.replace("mem_", "")) ||
                          (mUid && a.userId === mUid.replace("mem_", ""))) &&
                        a.status === "PRESENT",
                    ).length;
                    const memberSub =
                      submissions[mUid] ||
                      (member.userId
                        ? submissions[member.userId]
                        : undefined) ||
                      (member.memberId
                        ? submissions[member.memberId]
                        : undefined) ||
                      (member.id ? submissions[member.id] : undefined) ||
                      (mUid
                        ? submissions[mUid.replace("mem_", "")]
                        : undefined);
                    const subPresentCount = memberSub?.daysPresent || 0;
                    const memberPresentCount = isMe
                      ? presentCount
                      : attPresentCount > 0
                        ? attPresentCount
                        : subPresentCount;

                    const memberAbsentCount = Math.max(
                      0,
                      totalDays - memberPresentCount,
                    );
                    // Effective daily rate (defaults safely to ₱5.00/day)
                    const effectiveDailyRate =
                      Number(waterConfig?.rateCentavosPerPersonPerDay) > 0
                        ? Number(waterConfig.rateCentavosPerPersonPerDay) / 100
                        : 5.0;

                    // Real amount based on presence: if member has presence days, ALWAYS calculate presence * daily rate
                    const memberWaterTotal =
                      memberPresentCount > 0
                        ? memberPresentCount * effectiveDailyRate
                        : isFixedMode
                          ? myFixedSharePesos
                          : 0;

                    const memberSubmission = submissions[mUid];
                    const isSubmitted = isMe
                      ? isMyAttendanceSubmitted
                      : Boolean(memberSubmission);
                    const hasMarked = isMe
                      ? presentCount > 0
                      : memberPresentCount > 0;

                    const avatarInitials = getInitials(
                      member.displayName || member.name,
                    );
                    const avatarBg = isMe
                      ? "#2563EB"
                      : AVATAR_COLORS[index % AVATAR_COLORS.length];

                    return (
                      <View
                        key={mUid}
                        style={[
                          styles.memberCard,
                          isDark && {
                            backgroundColor: isMe
                              ? "rgba(59, 130, 246, 0.12)"
                              : colors.surfaceInset,
                            borderColor: isMe
                              ? colors.borderHighlighted
                              : colors.border,
                          },
                          !isDark && isMe && styles.memberCardHighlight,
                        ]}
                      >
                        {/* Avatar */}
                        {member.profilePicture || member.photoURL ? (
                          <Image
                            source={{
                              uri: member.profilePicture || member.photoURL,
                            }}
                            style={styles.memberAvatarImg}
                          />
                        ) : (
                          <View
                            style={[
                              styles.memberAvatar,
                              { backgroundColor: avatarBg },
                            ]}
                          >
                            <Text style={styles.memberAvatarText}>
                              {avatarInitials}
                            </Text>
                          </View>
                        )}

                        {/* Details */}
                        <View style={styles.memberInfoCol}>
                          <View style={styles.memberNameRow}>
                            <Text
                              style={[
                                styles.memberName,
                                isDark && { color: colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {member.displayName || "Roommate"}
                              {isMe ? " (You)" : ""}
                            </Text>

                            {/* Synced Badge */}
                            {isSubmitted && (
                              <View
                                style={[
                                  styles.syncedPill,
                                  isDark && {
                                    backgroundColor: colors.primary,
                                  },
                                ]}
                              >
                                <Text style={styles.syncedPillText}>
                                  Synced
                                </Text>
                              </View>
                            )}

                            {/* Exempt Badge */}
                            {!isPayor && (
                              <View
                                style={[
                                  styles.exemptPill,
                                  isDark && {
                                    backgroundColor: colors.surfaceInset,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.exemptPillText,
                                    isDark && { color: colors.textMuted },
                                  ]}
                                >
                                  Exempt
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text
                            style={[
                              styles.memberStaySub,
                              isDark && { color: colors.textSecondary },
                            ]}
                          >
                            {memberPresentCount} days present •{" "}
                            {memberAbsentCount} off
                          </Text>
                        </View>

                        {/* Right Due & Status */}
                        <View style={styles.memberDueCol}>
                          <Text
                            style={[
                              styles.memberDueAmount,
                              isDark && { color: colors.text },
                            ]}
                          >
                            ₱{memberWaterTotal.toFixed(2)}
                          </Text>
                          <Text
                            style={[
                              styles.memberStatusLabel,
                              hasMarked || isSubmitted
                                ? [
                                    styles.memberStatusMarked,
                                    isDark && { color: colors.success },
                                  ]
                                : [
                                    styles.memberStatusPending,
                                    isDark && { color: colors.textMuted },
                                  ],
                            ]}
                          >
                            {hasMarked || isSubmitted
                              ? !isPayor
                                ? "Marked (Exempt)"
                                : "Marked"
                              : !isPayor
                                ? "Exempt"
                                : "Pending"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* =========================================================================
                SUBMIT / UPDATE BUTTON & BANNER - Pixel perfect match to Image 2
                Allows editing anytime and synchronizes all bills across app
                ========================================================================= */}
              <View style={styles.submissionContainer}>
                <View
                  style={[
                    styles.submissionNoticeBox,
                    isMyAttendanceSubmitted
                      ? styles.submissionNoticeBoxSubmitted
                      : styles.submissionNoticeBoxPending,
                    isDark &&
                      (isMyAttendanceSubmitted
                        ? {
                            backgroundColor: "rgba(16, 185, 129, 0.12)",
                            borderColor: "rgba(16, 185, 129, 0.25)",
                          }
                        : {
                            backgroundColor: "rgba(59, 130, 246, 0.12)",
                            borderColor: "rgba(59, 130, 246, 0.25)",
                          }),
                  ]}
                >
                  <Ionicons
                    name={
                      isMyAttendanceSubmitted
                        ? "checkmark-circle"
                        : "water-outline"
                    }
                    size={18}
                    color={
                      isMyAttendanceSubmitted
                        ? isDark
                          ? colors.success
                          : "#059669"
                        : isDark
                          ? colors.accent
                          : "#2563EB"
                    }
                  />
                  <Text
                    style={[
                      styles.submissionNoticeText,
                      isMyAttendanceSubmitted &&
                        styles.submissionNoticeTextSubmitted,
                      isDark && {
                        color: isMyAttendanceSubmitted ? "#6EE7B7" : "#93C5FD",
                      },
                    ]}
                  >
                    {isMyAttendanceSubmitted
                      ? `Presence submitted (${presentCount} days, ₱${waterFee.toFixed(
                          2,
                        )}). You can edit dates above anytime — bills will update synchronously.`
                      : "Submit your water presence for this cycle. You can make adjustments and resubmit anytime."}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    isDark && {
                      backgroundColor: colors.primary,
                      shadowColor: colors.primary,
                    },
                    isSubmitting && { opacity: 0.75 },
                  ]}
                  onPress={handleSubmitAttendance}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={styles.submitBtnInner}>
                      <Text style={styles.submitButtonText}>
                        {isMyAttendanceSubmitted
                          ? `Update Water Presence (₱${waterFee.toFixed(2)})`
                          : `Submit Water Presence (₱${waterFee.toFixed(2)})`}
                      </Text>
                      <Feather
                        name={isMyAttendanceSubmitted ? "check" : "arrow-right"}
                        size={18}
                        color="#FFFFFF"
                        style={{ marginLeft: 8 }}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                <Text
                  style={[
                    styles.submissionFootnote,
                    isDark && { color: colors.textMuted },
                  ]}
                >
                  {isMyAttendanceSubmitted
                    ? "✓ Real-time synced · Tap any day to edit and re-sync"
                    : "Tap above to mark days present, then submit to sync dues"}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Host Water Settings Modal */}
      {isHost && resolvedHouseholdId && (
        <WaterSettingsModal
          visible={showWaterSettingsModal}
          onClose={() => setShowWaterSettingsModal(false)}
          householdId={resolvedHouseholdId}
          initialConfig={waterConfig}
          onSaved={() => {
            if (resolvedBillingCycleId) {
              mobileDataService
                .syncCycleWaterBill(resolvedHouseholdId, resolvedBillingCycleId)
                .catch(() => {});
            }
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
  },
  topBarCenter: {
    flex: 1,
    marginLeft: 12,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  topBarSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  circleIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 95,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },

  /* Blue Hero Card matching Image 1 */
  heroCard: {
    backgroundColor: "#1E60E6",
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#1E60E6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  activeCyclePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  activeCycleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  activeCyclePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  totalDaysText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  heroCycleRange: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  heroWaterRate: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.85)",
    marginBottom: 16,
  },
  heroWaterRateBold: {
    fontWeight: "900",
    color: "#FFFFFF",
  },
  heroMetricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  heroMetricBox: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  heroMetricLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.85)",
    marginBottom: 2,
  },
  heroMetricValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  heroMetricValueDue: {
    color: "#FACC15",
  },

  /* Water Utility Fee Bar matching Image 1 */
  feeBarCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  feeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  feeBarTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  feeBarSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  feeBarActions: {
    flexDirection: "row",
    gap: 6,
  },
  markAllBtn: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  clearBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },

  /* Monthly Calendar Card matching Image 1 */
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  monthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  monthTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    flex: 1,
  },
  monthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
  },
  monthRangePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  monthRangePillText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  monthPresentRatio: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  weekdayText: {
    width: "13.2%",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "flex-start",
  },
  dayBoxEmpty: {
    width: "13.2%",
    aspectRatio: 1,
  },
  dayBox: {
    width: "13.2%",
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  dayBoxPresent: {
    backgroundColor: "#1E60E6",
    borderColor: "#1E60E6",
    shadowColor: "#1E60E6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  dayBoxAbsent: {
    backgroundColor: "#FAFAFA",
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  dayNumberText: {
    fontSize: 16,
    fontWeight: "800",
  },
  dayNumberTextPresent: {
    color: "#FFFFFF",
  },
  dayNumberTextAbsent: {
    color: "#64748B",
  },

  /* Fixed notice card */
  fixedNoticeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    marginBottom: 14,
  },
  fixedNoticeIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  fixedNoticeTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 6,
  },
  fixedNoticeSub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 14,
  },
  fixedHostTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  fixedHostTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369A1",
  },

  /* Roommates Breakdown Card matching Image 2 */
  breakdownCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },
  breakdownMemberCount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },
  roommatesList: {
    gap: 10,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderRadius: 18,
    padding: 12,
  },
  memberCardHighlight: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FAFF",
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  memberAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  memberInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  syncedPill: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  syncedPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  exemptPill: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  exemptPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },
  memberStaySub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  memberDueCol: {
    alignItems: "flex-end",
  },
  memberDueAmount: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 2,
  },
  memberStatusLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  memberStatusMarked: {
    color: "#059669",
  },
  memberStatusPending: {
    color: "#94A3B8",
  },

  /* Submit Water Bill Attendance Button matching Image 2 */
  submissionContainer: {
    marginBottom: 24,
  },
  submissionNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  submissionNoticeBoxPending: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  submissionNoticeBoxSubmitted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  submissionNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#1E40AF",
    fontWeight: "600",
  },
  submissionNoticeTextSubmitted: {
    color: "#065F46",
  },
  submitButton: {
    backgroundColor: "#2563EB",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  submitBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  submissionFootnote: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    fontWeight: "600",
  },
});
