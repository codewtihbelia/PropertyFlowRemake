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
  Modal,
  TextInput,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  isPayorMember,
  computeCycleWaterBreakdown,
  resolveCycleWaterConfig,
  computeFairSplitShareCentavos,
  getFairSplitShareAtIndex,
  matchesMemberUid,
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
  weeks: Array<Array<CycleDate | null>>;
}

const parseLocalDate = (dateStr?: string, fallback?: Date): Date => {
  if (!dateStr) return fallback || new Date();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (match) {
    return new Date(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10),
      12,
      0,
      0,
      0,
    );
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      12,
      0,
      0,
      0,
    );
  }
  return fallback || new Date();
};

const generateCycleDates = (
  startStr?: string,
  endStr?: string,
): CycleDate[] => {
  const dates: CycleDate[] = [];
  const now = new Date();
  const defaultStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    12,
    0,
    0,
    0,
  );
  const defaultEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    12,
    0,
    0,
    0,
  );

  let start = startStr ? parseLocalDate(startStr, defaultStart) : defaultStart;
  let end = endStr ? parseLocalDate(endStr, defaultEnd) : defaultEnd;

  if (isNaN(start.getTime())) {
    start = defaultStart;
  }
  if (isNaN(end.getTime()) || end < start) {
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 12, 0, 0, 0);
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

    // Build exact 7-column week rows so every date aligns strictly under MON..SUN
    const cells: Array<CycleDate | null> = [];
    for (let i = 0; i < leadingEmptyDays; i++) {
      cells.push(null);
    }
    for (const d of dates) {
      cells.push(d);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    const weeks: Array<Array<CycleDate | null>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    sections.push({
      monthKey: `${first.rawDate.getFullYear()}-${first.rawDate.getMonth()}`,
      monthName: fullMonthNames[first.rawDate.getMonth()],
      year: first.rawDate.getFullYear(),
      dates,
      startDayNum: first.dayNum,
      endDayNum: last.dayNum,
      leadingEmptyDays,
      weeks,
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

export type PayorAllocationMode =
  | "FAIR_SPLIT"
  | "SPECIFIC_PAYOR"
  | "CUSTOM_SPLIT";

export const AttendanceScreen: React.FC<{
  householdId?: string;
  billingCycleId?: string;
  userId?: string;
  onBack?: () => void;
  onUnsavedChangesChange?: (hasUnsaved: boolean) => void;
  pendingLeaveAction?: (() => void) | null;
  onClearPendingLeave?: () => void;
}> = ({
  householdId,
  billingCycleId,
  userId,
  onBack,
  onUnsavedChangesChange,
  pendingLeaveAction,
  onClearPendingLeave,
}) => {
  const insets = useSafeAreaInsets();
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
  const [expenses, setExpenses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [memberBills, setMemberBills] = useState<any[]>([]);
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [savedPresentDates, setSavedPresentDates] = useState<string[]>([]);
  const [presentDates, setPresentDates] = useState<string[]>([]);
  const [hasUserModifiedDraft, setHasUserModifiedDraft] =
    useState<boolean>(false);
  const hasUserModifiedDraftRef = useRef<boolean>(false);
  const [isEditingAttendance, setIsEditingAttendance] =
    useState<boolean>(false);
  const [showLockedHint, setShowLockedHint] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showLeavePromptModal, setShowLeavePromptModal] =
    useState<boolean>(false);
  const localPendingLeaveRef = useRef<(() => void) | null>(null);

  // Non-payor allocation state inside the Submit Attendance bottom sheet
  const [allocationMode, setAllocationMode] =
    useState<PayorAllocationMode>("FAIR_SPLIT");
  const [selectedSpecificPayorId, setSelectedSpecificPayorId] =
    useState<string>("");
  const [customSplitInputType, setCustomSplitInputType] = useState<
    "PESO" | "PERCENT"
  >("PESO");
  const [customPayorInputs, setCustomPayorInputs] = useState<
    Record<string, string>
  >({});

  const [allCycleAttendance, setAllCycleAttendance] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any>>({});
  const optimisticPresentRef = useRef<Set<string>>(new Set());
  const pendingMutationsRef = useRef<Map<string, "PRESENT" | "ABSENT">>(
    new Map(),
  );
  const inFlightMutationsRef = useRef<Map<string, "PRESENT" | "ABSENT">>(
    new Map(),
  );
  const isFlushingBatchRef = useRef<boolean>(false);
  const isSyncingBillsRef = useRef<boolean>(false);
  const needsFollowUpBillSyncRef = useRef<boolean>(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const billSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showWaterSettingsModal, setShowWaterSettingsModal] =
    useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const presentSet = useMemo(() => new Set(presentDates), [presentDates]);
  const savedPresentSet = useMemo(
    () => new Set(savedPresentDates),
    [savedPresentDates],
  );

  const activeUserId = userId || currentUser?.uid || "";

  const activeCycle = useMemo(
    () =>
      (billingCycleId &&
        cycles.find((c) => c.billingCycleId === billingCycleId)) ||
      cycles.find((c) => c.status === "ACTIVE") ||
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

  const myMember = useMemo(
    () =>
      members.find(
        (m) =>
          (m.userId || m.memberId || m.id) === activeUserId ||
          (m.userId && m.userId.replace("mem_", "") === activeUserId),
      ),
    [members, activeUserId],
  );
  // Only Non-Payors choose how Payors cover their water due in the Submit Bottom Sheet
  const isMyMemberPayor = useMemo(
    () => (myMember ? isPayorMember(myMember) : true),
    [myMember],
  );

  const oldestCycleId =
    cycles.length > 0 ? cycles[cycles.length - 1]?.billingCycleId : undefined;
  const knownCycleIds = useMemo(
    () => new Set(cycles.map((c) => c.billingCycleId).filter(Boolean)),
    [cycles],
  );

  const currentCycleExpenses = useMemo(() => {
    if (!activeCycle?.billingCycleId) return [];
    return expenses.filter(
      (e) =>
        e.billingCycleId === activeCycle.billingCycleId ||
        ((!e.billingCycleId || !knownCycleIds.has(e.billingCycleId)) &&
          (cycles.length <= 1 || activeCycle.billingCycleId === oldestCycleId)),
    );
  }, [
    expenses,
    activeCycle?.billingCycleId,
    cycles.length,
    oldestCycleId,
    knownCycleIds,
  ]);

  const cycleWaterExpense = useMemo(() => {
    return currentCycleExpenses.find((e) =>
      (e.category || "").toLowerCase().includes("water"),
    );
  }, [currentCycleExpenses]);

  const hasCycleAttendanceActivity = useMemo(() => {
    return (
      allCycleAttendance.some((a) => a?.status === "PRESENT") ||
      Object.keys(submissions || {}).length > 0
    );
  }, [allCycleAttendance, submissions]);

  const cycleWaterData = useMemo(() => {
    const resolver =
      typeof resolveCycleWaterConfig === "function"
        ? resolveCycleWaterConfig
        : mobileDataService?.resolveCycleWaterConfig;
    if (typeof resolver !== "function") return null;
    return resolver(waterConfig, resolvedBillingCycleId, {
      cycleWaterExpense,
      payorCount: payingRoommatesCount,
      hasCycleAttendance: hasCycleAttendanceActivity,
      totalCyclesCount: cycles.length,
    });
  }, [
    waterConfig,
    resolvedBillingCycleId,
    cycleWaterExpense,
    payingRoommatesCount,
    hasCycleAttendanceActivity,
    cycles.length,
  ]);

  const pricingModel = cycleWaterData?.pricingModel || "PER_PERSON_DAY";
  const isFixedMode = Boolean(
    cycleWaterData &&
    (pricingModel === "FIXED_MONTHLY" ||
      pricingModel === "FIXED_PER_PERSON_MONTH"),
  );

  const ratePerDayPesos =
    ((cycleWaterData?.rateCentavosPerPersonPerDay ?? 500) || 500) / 100;
  const fixedMonthlyPesos =
    ((cycleWaterData?.fixedMonthlyAmountCentavos ?? 0) || 0) / 100;
  const fixedPerPersonPesos =
    ((cycleWaterData?.fixedPerPersonAmountCentavos ?? 0) || 0) / 100;

  const myFixedSharePesos = useMemo(() => {
    if (!isMyMemberPayor || !isFixedMode) return 0;
    if (pricingModel === "FIXED_PER_PERSON_MONTH") {
      return fixedPerPersonPesos;
    }
    const shareCents = computeFairSplitShareCentavos(
      Math.round(fixedMonthlyPesos * 100),
      activePayors,
      activeUserId,
    );
    return shareCents / 100;
  }, [
    isMyMemberPayor,
    isFixedMode,
    pricingModel,
    fixedPerPersonPesos,
    fixedMonthlyPesos,
    activePayors,
    activeUserId,
  ]);

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

    return settled;
  }, [
    currentCycleExpenses,
    activePayors,
    activeCycle?.billingCycleId,
    cycles.length,
    memberBills,
    payments,
  ]);

  const allExpensesMarkedPaid =
    currentCycleExpenses.length > 0 &&
    currentCycleExpenses.some((e) => (Number(e.amountCents) || 0) > 0) &&
    currentCycleExpenses.every(
      (e) =>
        (Number(e.amountCents) || 0) <= 0 || e.status === "PAID" || e.isPaid,
    );

  const allPayorsSettled =
    allExpensesMarkedPaid ||
    (currentCycleExpenses.length > 0 &&
      activePayors.length > 0 &&
      activePayors.every((p) => {
        const uid = p.userId || p.memberId || p.id;
        return Boolean(uid && settledPayorUids.has(uid));
      }));

  const isCycleClosedOrPaidOff = Boolean(
    activeCycle &&
    (activeCycle.status === "CLOSED" ||
      activeCycle.status === "ARCHIVED" ||
      allPayorsSettled),
  );

  // Lock presence-based water attendance for ALL members (payors & non-payors) once any payor initiates payment for this cycle
  const hasCyclePaymentStarted = useMemo(() => {
    const cycleId = activeCycle?.billingCycleId;
    if (!cycleId) return false;
    const isSingleCycle = cycles.length <= 1;

    const anyCyclePayment = payments.some((pmt) => {
      const statusUpper = String(pmt.status || "").toUpperCase();
      if (statusUpper === "REJECTED" || statusUpper === "CANCELLED") {
        return false;
      }
      if ((Number(pmt.amountCentavos) || 0) <= 0) return false;
      return (
        pmt.billingCycleId === cycleId ||
        ((!pmt.billingCycleId || pmt.billingCycleId === "general") &&
          isSingleCycle)
      );
    });
    if (anyCyclePayment) return true;

    const anyExpenseSplitPaid = currentCycleExpenses.some((exp) => {
      if ((Number(exp.amountCents) || 0) <= 0) return false;
      if (exp.status === "PAID" || exp.isPaid === true) return true;
      if (Array.isArray(exp.splitDetails)) {
        return exp.splitDetails.some(
          (s: any) =>
            !s?.isExempt &&
            (s?.isPaid === true ||
              (Number(s?.paidAmountCentavos) || 0) > 0 ||
              Boolean(s?.paymentId)),
        );
      }
      return false;
    });
    if (anyExpenseSplitPaid) return true;

    const anyMemberBillPaid = memberBills.some(
      (mb) =>
        mb.billingCycleId === cycleId &&
        (Number(mb.totalPaidCentavos || mb.paidCentavos) || 0) > 0,
    );
    return anyMemberBillPaid;
  }, [
    activeCycle?.billingCycleId,
    cycles.length,
    payments,
    currentCycleExpenses,
    memberBills,
  ]);

  const isLockedByCyclePayment = Boolean(
    cycleWaterData &&
    !isFixedMode &&
    !isCycleClosedOrPaidOff &&
    hasCyclePaymentStarted,
  );

  const mySubmission = submissions[activeUserId];
  const isMyAttendanceSubmitted =
    Boolean(mySubmission) && !isCycleClosedOrPaidOff;

  // Calendar is locked when closed/paid off, when cycle payments have started, or when submitted and not editing
  const isCalendarLocked = Boolean(
    isCycleClosedOrPaidOff ||
    isLockedByCyclePayment ||
    (isMyAttendanceSubmitted && !isEditingAttendance),
  );

  // Detect whether draft markings differ from saved Firestore markings
  const areDraftDatesDifferent = useMemo(() => {
    if (presentSet.size !== savedPresentSet.size) return true;
    for (const d of presentSet) {
      if (!savedPresentSet.has(d)) return true;
    }
    return false;
  }, [presentSet, savedPresentSet]);

  const hasUnsavedChanges = Boolean(
    cycleWaterData &&
    !isCycleClosedOrPaidOff &&
    !isLockedByCyclePayment &&
    !isFixedMode &&
    hasUserModifiedDraft &&
    (areDraftDatesDifferent ||
      (!isMyAttendanceSubmitted && presentSet.size > 0)),
  );

  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChangesChange]);

  // Trigger Unsaved Markings Modal when parent navigation attempts to switch tabs
  useEffect(() => {
    if (pendingLeaveAction) {
      if (hasUnsavedChanges) {
        localPendingLeaveRef.current = pendingLeaveAction;
        setShowLeavePromptModal(true);
      } else {
        const action = pendingLeaveAction;
        onClearPendingLeave?.();
        action();
      }
    }
  }, [pendingLeaveAction, hasUnsavedChanges, onClearPendingLeave]);

  // Intercept Android hardware back button when unsaved markings exist
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (hasUnsavedChanges) {
        localPendingLeaveRef.current = () => {
          if (onBack) onBack();
        };
        setShowLeavePromptModal(true);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [hasUnsavedChanges, onBack]);

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

  // Real-time profile sync so join rejection status or household changes update instantly
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = mobileDataService.listenToUserProfile(
      currentUser.uid,
      (p) => {
        if (p) {
          setProfile(p);
          setIsProfileLoaded(true);
        }
      },
    );
    return () => unsub();
  }, [currentUser?.uid]);

  const isActiveGroupMember = (m: any) => {
    if (!m) return false;
    const s = String(m.status || "").toUpperCase();
    const js = String(m.joinRequestStatus || "").toUpperCase();
    if (
      s === "REJECTED" ||
      s === "DECLINED" ||
      s === "PENDING" ||
      s === "INACTIVE" ||
      s === "REMOVED" ||
      s === "CANCELLED"
    ) {
      return false;
    }
    if (
      js === "REJECTED" ||
      js === "DECLINED" ||
      js === "PENDING" ||
      js === "REMOVED"
    ) {
      return false;
    }
    if (m.rejectionReason || m.rejectedDate) {
      return false;
    }
    return (
      s === "ACTIVE" || m.role === "HOST" || (!m.status && !m.joinRequestStatus)
    );
  };

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
    // Automatically clean up any orphaned or duplicate member records in the household
    mobileDataService
      .cleanupDuplicateMembers(resolvedHouseholdId)
      .catch(() => {});

    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      resolvedHouseholdId,
      (data) => {
        const activeOnly = (data || []).filter(isActiveGroupMember);
        // Robust in-memory deduplication by canonical user ID & email
        const seenUids = new Set<string>();
        const deduplicated: any[] = [];
        activeOnly.forEach((m) => {
          const canonical =
            (m.userId || "").replace(/^mem_/, "").trim() ||
            (m.memberId || "").replace(/^mem_/, "").trim() ||
            (m.id || "").replace(/^mem_/, "").trim();
          const email = (m.email || "").trim().toLowerCase();
          const key = canonical || email || m.id;
          if (!seenUids.has(key)) {
            seenUids.add(key);
            if (canonical) seenUids.add(canonical);
            if (email) seenUids.add(email);
            deduplicated.push(m);
          }
        });
        setMembers(deduplicated);
        attReady.members = true;
        checkReady();
      },
    );
    const unsubExpenses = mobileDataService.listenToExpenses(
      resolvedHouseholdId,
      (data) => {
        setExpenses(data);
      },
    );
    const unsubPayments = mobileDataService.listenToPayments(
      resolvedHouseholdId,
      (data) => {
        setPayments(data);
      },
    );
    return () => {
      clearTimeout(safetyTimer);
      unsubCycles();
      unsubWater();
      unsubMembers();
      unsubExpenses();
      unsubPayments();
    };
  }, [resolvedHouseholdId, isProfileLoaded]);

  useEffect(() => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId) {
      setMemberBills([]);
      return;
    }
    return mobileDataService.listenToMemberBills(
      resolvedHouseholdId,
      resolvedBillingCycleId,
      setMemberBills,
    );
  }, [resolvedHouseholdId, resolvedBillingCycleId]);

  useEffect(() => {
    if (allPayorsSettled && resolvedHouseholdId && resolvedBillingCycleId) {
      const hasUnpaid = currentCycleExpenses.some(
        (e) => e.status !== "PAID" || !e.isPaid,
      );
      if (hasUnpaid) {
        mobileDataService
          .markExpensesPaidIfAllSettled(
            resolvedHouseholdId,
            resolvedBillingCycleId,
          )
          .catch(() => {});
      }
    }
  }, [
    allPayorsSettled,
    resolvedHouseholdId,
    resolvedBillingCycleId,
    currentCycleExpenses,
  ]);

  useEffect(() => {
    if (isCycleClosedOrPaidOff || isLockedByCyclePayment) {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (billSyncTimerRef.current) {
        clearTimeout(billSyncTimerRef.current);
        billSyncTimerRef.current = null;
      }
      pendingMutationsRef.current.clear();
      inFlightMutationsRef.current.clear();
      if (isLockedByCyclePayment && hasUserModifiedDraftRef.current) {
        optimisticPresentRef.current = new Set(savedPresentDates);
        setPresentDates([...savedPresentDates]);
      }
      hasUserModifiedDraftRef.current = false;
      setHasUserModifiedDraft(false);
      setIsEditingAttendance(false);
      setShowSubmitModal(false);
      setShowLockedHint(false);
    }
  }, [isCycleClosedOrPaidOff, isLockedByCyclePayment, savedPresentDates]);

  useEffect(() => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId)
      return;

    // Reset draft caches when switching cycles or users
    optimisticPresentRef.current = new Set();
    pendingMutationsRef.current.clear();
    inFlightMutationsRef.current.clear();
    hasUserModifiedDraftRef.current = false;
    setHasUserModifiedDraft(false);
    setIsEditingAttendance(false);
    setShowLockedHint(false);

    const unsubAtt = mobileDataService.listenToAttendance(
      resolvedHouseholdId,
      resolvedBillingCycleId,
      activeUserId,
      (markedDates) => {
        const savedList: string[] = [];
        Object.entries(markedDates).forEach(([date, status]) => {
          if (status === "PRESENT") {
            savedList.push(date);
          }
        });
        setSavedPresentDates(savedList);

        // Only overwrite local draft if user is not actively editing unsaved markings
        if (!hasUserModifiedDraftRef.current) {
          optimisticPresentRef.current = new Set(savedList);
          setPresentDates(savedList);
        }
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
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (billSyncTimerRef.current) {
        clearTimeout(billSyncTimerRef.current);
        billSyncTimerRef.current = null;
      }
      unsubAtt();
      unsubCycleAll();
      unsubSubs();
    };
  }, [activeUserId, resolvedBillingCycleId, resolvedHouseholdId]);

  const handleStartEditing = () => {
    if (isCycleClosedOrPaidOff) return;
    if (isLockedByCyclePayment) {
      Alert.alert(
        "Attendance Locked",
        "One or more payors have already started paying bills for this cycle. Water attendance can no longer be edited so bill shares remain accurate.",
      );
      return;
    }
    setIsEditingAttendance(true);
    setShowLockedHint(false);
  };

  const handleCancelEditing = () => {
    optimisticPresentRef.current = new Set(savedPresentDates);
    setPresentDates([...savedPresentDates]);
    hasUserModifiedDraftRef.current = false;
    setHasUserModifiedDraft(false);
    setIsEditingAttendance(false);
    setShowLockedHint(false);
  };

  // Draft toggle on calendar date (requires explicit submit before leaving)
  const toggleDay = (iso: string) => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId)
      return;

    if (isCycleClosedOrPaidOff) {
      Alert.alert(
        "Cycle Settled & Closed",
        "This billing cycle has already been paid off or closed. Attendance has been reset and will unlock when your host starts the next billing cycle.",
      );
      return;
    }

    if (isLockedByCyclePayment) {
      Alert.alert(
        "Attendance Locked",
        "One or more payors have already started paying bills for this cycle. Water attendance can no longer be edited so bill shares remain accurate.",
      );
      return;
    }

    if (isCalendarLocked) {
      setShowLockedHint(true);
      return;
    }

    const isCurrentlyPresent = optimisticPresentRef.current.has(iso);
    if (isCurrentlyPresent) {
      optimisticPresentRef.current.delete(iso);
    } else {
      optimisticPresentRef.current.add(iso);
    }

    hasUserModifiedDraftRef.current = true;
    setHasUserModifiedDraft(true);
    setPresentDates(Array.from(optimisticPresentRef.current));
  };

  const markAll = () => {
    if (
      !resolvedHouseholdId ||
      !resolvedBillingCycleId ||
      !activeUserId ||
      isCycleClosedOrPaidOff
    )
      return;

    if (isLockedByCyclePayment) {
      Alert.alert(
        "Attendance Locked",
        "One or more payors have already started paying bills for this cycle. Water attendance can no longer be edited so bill shares remain accurate.",
      );
      return;
    }

    if (isCalendarLocked) {
      setShowLockedHint(true);
      return;
    }

    const nextSet = new Set<string>();
    for (const d of cycleDates) {
      nextSet.add(d.iso);
    }
    optimisticPresentRef.current = nextSet;
    hasUserModifiedDraftRef.current = true;
    setHasUserModifiedDraft(true);
    setPresentDates(Array.from(nextSet));
  };

  const clearAll = () => {
    if (
      !resolvedHouseholdId ||
      !resolvedBillingCycleId ||
      !activeUserId ||
      isCycleClosedOrPaidOff
    )
      return;

    if (isLockedByCyclePayment) {
      Alert.alert(
        "Attendance Locked",
        "One or more payors have already started paying bills for this cycle. Water attendance can no longer be edited so bill shares remain accurate.",
      );
      return;
    }

    if (isCalendarLocked) {
      setShowLockedHint(true);
      return;
    }

    optimisticPresentRef.current = new Set<string>();
    hasUserModifiedDraftRef.current = true;
    setHasUserModifiedDraft(true);
    setPresentDates([]);
  };

  const totalDays = cycleDates.length;
  const rawPresentCount = presentDates.length;
  const presentCount = isCycleClosedOrPaidOff ? 0 : rawPresentCount;
  const absentCount = isCycleClosedOrPaidOff
    ? 0
    : Math.max(0, totalDays - presentCount);
  const waterFee = isCycleClosedOrPaidOff
    ? 0
    : isFixedMode
      ? isMyMemberPayor
        ? myFixedSharePesos
        : 0
      : presentCount * ratePerDayPesos;
  const { onScroll, keyboardHeight } = useNavVisibility();

  // Initialize and open the slide-up Submit Attendance Bottom Sheet
  const handleOpenSubmitModal = () => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId) {
      Alert.alert(
        "Notice",
        "No active billing cycle found to record attendance.",
      );
      return;
    }

    if (isCycleClosedOrPaidOff) {
      Alert.alert(
        "Cycle Settled & Closed",
        "This billing cycle is already paid off or closed. Attendance is reset to zero until the next billing cycle starts.",
      );
      return;
    }

    if (isLockedByCyclePayment) {
      Alert.alert(
        "Attendance Locked",
        "One or more payors have already started paying bills for this cycle. Water attendance can no longer be edited so bill shares remain accurate.",
      );
      return;
    }

    // Pre-populate Non-Payor payor allocation settings from existing submission or fair defaults
    const savedMode: PayorAllocationMode =
      mySubmission?.allocationMode === "SPECIFIC_PAYOR" ||
      mySubmission?.allocationMode === "CUSTOM_SPLIT"
        ? mySubmission.allocationMode
        : "FAIR_SPLIT";
    setAllocationMode(savedMode);

    const firstPayorUid =
      activePayors[0]?.userId ||
      activePayors[0]?.memberId ||
      activePayors[0]?.id ||
      "";
    const initialSpecificId =
      mySubmission?.assignedPayorId &&
      activePayors.some(
        (p) =>
          (p.userId || p.memberId || p.id) === mySubmission.assignedPayorId,
      )
        ? mySubmission.assignedPayorId
        : firstPayorUid;
    setSelectedSpecificPayorId(initialSpecificId);

    const savedInputType: "PESO" | "PERCENT" =
      mySubmission?.customSplitInputType === "PERCENT" ? "PERCENT" : "PESO";
    setCustomSplitInputType(savedInputType);

    const initialInputs: Record<string, string> = {};
    const payorCount = Math.max(1, activePayors.length);
    const savedSplitsCents = mySubmission?.customPayorSplitsCentavos || {};
    const savedPcts = mySubmission?.customPayorPercentages || {};
    const hasSavedCustom =
      Object.keys(savedSplitsCents).length > 0 ||
      Object.keys(savedPcts).length > 0;

    let runningCents = 0;
    let runningPct = 0;
    const totalFeeCents = Math.round(waterFee * 100);

    activePayors.forEach((p, idx) => {
      const pUid = p.userId || p.memberId || p.id;
      if (!pUid) return;
      if (hasSavedCustom) {
        if (savedInputType === "PERCENT") {
          const pctVal = Number(savedPcts[pUid] ?? 0);
          initialInputs[pUid] =
            pctVal > 0 ? String(Math.round(pctVal * 10) / 10) : "0";
        } else {
          const centsVal = Number(savedSplitsCents[pUid] ?? 0);
          const scaledPesos =
            mySubmission?.amountCentavos > 0 && totalFeeCents > 0
              ? ((centsVal / mySubmission.amountCentavos) * totalFeeCents) / 100
              : centsVal / 100;
          initialInputs[pUid] =
            scaledPesos > 0 ? scaledPesos.toFixed(2) : "0.00";
        }
      } else {
        if (savedInputType === "PERCENT") {
          const pct =
            idx === activePayors.length - 1
              ? Math.max(0, Math.round((100 - runningPct) * 10) / 10)
              : Math.round((100 / payorCount) * 10) / 10;
          runningPct += pct;
          initialInputs[pUid] = String(pct);
        } else {
          const shareCents = getFairSplitShareAtIndex(
            totalFeeCents,
            payorCount,
            idx,
          );
          runningCents += shareCents;
          initialInputs[pUid] = (shareCents / 100).toFixed(2);
        }
      }
    });

    setCustomPayorInputs(initialInputs);
    setShowSubmitModal(true);
  };

  // Switch Custom Split between Peso (₱) and Percentage (%) while preserving current proportions
  const handleToggleCustomInputType = (nextType: "PESO" | "PERCENT") => {
    if (nextType === customSplitInputType) return;
    const nextInputs: Record<string, string> = {};
    const payorCount = Math.max(1, activePayors.length);

    if (nextType === "PERCENT") {
      let sumPesos = 0;
      activePayors.forEach((p) => {
        const pUid = p.userId || p.memberId || p.id;
        sumPesos += Math.max(
          0,
          parseFloat(customPayorInputs[pUid] || "0") || 0,
        );
      });
      let runningPct = 0;
      activePayors.forEach((p, idx) => {
        const pUid = p.userId || p.memberId || p.id;
        const val = Math.max(
          0,
          parseFloat(customPayorInputs[pUid] || "0") || 0,
        );
        const pct =
          sumPesos > 0
            ? idx === activePayors.length - 1
              ? Math.max(0, Math.round((100 - runningPct) * 10) / 10)
              : Math.round((val / sumPesos) * 100 * 10) / 10
            : Math.round((100 / payorCount) * 10) / 10;
        runningPct += pct;
        nextInputs[pUid] = String(pct);
      });
    } else {
      let sumPct = 0;
      activePayors.forEach((p) => {
        const pUid = p.userId || p.memberId || p.id;
        sumPct += Math.max(0, parseFloat(customPayorInputs[pUid] || "0") || 0);
      });
      const totalCents = Math.round(waterFee * 100);
      let runningCents = 0;
      activePayors.forEach((p, idx) => {
        const pUid = p.userId || p.memberId || p.id;
        const pct = Math.max(
          0,
          parseFloat(customPayorInputs[pUid] || "0") || 0,
        );
        const cents =
          sumPct > 0
            ? idx === activePayors.length - 1
              ? Math.max(0, totalCents - runningCents)
              : Math.round((totalCents * pct) / sumPct)
            : Math.round(totalCents / payorCount);
        runningCents += cents;
        nextInputs[pUid] = (cents / 100).toFixed(2);
      });
    }

    setCustomSplitInputType(nextType);
    setCustomPayorInputs(nextInputs);
  };

  const handleDistributeCustomEqually = () => {
    const nextInputs: Record<string, string> = {};
    const payorCount = Math.max(1, activePayors.length);
    const totalCents = Math.round(waterFee * 100);
    let runningCents = 0;
    let runningPct = 0;

    activePayors.forEach((p, idx) => {
      const pUid = p.userId || p.memberId || p.id;
      if (!pUid) return;
      if (customSplitInputType === "PERCENT") {
        const pct =
          idx === activePayors.length - 1
            ? Math.max(0, Math.round((100 - runningPct) * 10) / 10)
            : Math.round((100 / payorCount) * 10) / 10;
        runningPct += pct;
        nextInputs[pUid] = String(pct);
      } else {
        const cents = getFairSplitShareAtIndex(totalCents, payorCount, idx);
        runningCents += cents;
        nextInputs[pUid] = (cents / 100).toFixed(2);
      }
    });

    setCustomPayorInputs(nextInputs);
  };

  // Compute live Custom Split totals & validation
  const customSplitSummary = useMemo(() => {
    const payorSharesCents: Record<string, number> = {};
    const payorPercentages: Record<string, number> = {};
    const totalTargetCents = Math.round(waterFee * 100);
    let totalEnteredPesos = 0;
    let totalEnteredPercent = 0;

    activePayors.forEach((p) => {
      const pUid = p.userId || p.memberId || p.id;
      if (!pUid) return;
      const rawVal = Math.max(
        0,
        parseFloat(customPayorInputs[pUid] || "0") || 0,
      );
      if (customSplitInputType === "PERCENT") {
        totalEnteredPercent += rawVal;
      } else {
        totalEnteredPesos += rawVal;
      }
    });

    let distributedCents = 0;
    activePayors.forEach((p, idx) => {
      const pUid = p.userId || p.memberId || p.id;
      if (!pUid) return;
      const rawVal = Math.max(
        0,
        parseFloat(customPayorInputs[pUid] || "0") || 0,
      );
      if (customSplitInputType === "PERCENT") {
        payorPercentages[pUid] = Math.round(rawVal * 10) / 10;
        const cents =
          idx === activePayors.length - 1 &&
          Math.abs(totalEnteredPercent - 100) <= 0.5
            ? Math.max(0, totalTargetCents - distributedCents)
            : Math.round((totalTargetCents * rawVal) / 100);
        distributedCents += cents;
        payorSharesCents[pUid] = cents;
      } else {
        const cents = Math.round(rawVal * 100);
        payorSharesCents[pUid] = cents;
        payorPercentages[pUid] =
          totalTargetCents > 0
            ? Math.round((cents / totalTargetCents) * 100 * 10) / 10
            : 0;
      }
    });

    const allocatedPesos =
      customSplitInputType === "PERCENT"
        ? (totalTargetCents * (totalEnteredPercent / 100)) / 100
        : totalEnteredPesos;
    const allocatedPercent =
      customSplitInputType === "PERCENT"
        ? totalEnteredPercent
        : waterFee > 0
          ? (totalEnteredPesos / waterFee) * 100
          : 100;

    const remainingPesos = waterFee - allocatedPesos;
    const remainingPercent = 100 - allocatedPercent;

    const isValid =
      waterFee <= 0
        ? true
        : customSplitInputType === "PERCENT"
          ? Math.abs(totalEnteredPercent - 100) <= 0.5
          : Math.abs(totalEnteredPesos - waterFee) <= 0.05;

    return {
      payorSharesCents,
      payorPercentages,
      allocatedPesos,
      allocatedPercent,
      remainingPesos,
      remainingPercent,
      isValid,
    };
  }, [activePayors, customPayorInputs, customSplitInputType, waterFee]);

  // Confirm & Submit Attendance from the slide-up Bottom Sheet
  const handleConfirmSubmitAttendance = async () => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId) {
      return;
    }
    if (isLockedByCyclePayment) {
      setShowSubmitModal(false);
      Alert.alert(
        "Attendance Locked",
        "One or more payors have already started paying bills for this cycle. Water attendance can no longer be edited so bill shares remain accurate.",
      );
      return;
    }

    if (!isMyMemberPayor && activePayors.length > 0) {
      if (allocationMode === "SPECIFIC_PAYOR" && !selectedSpecificPayorId) {
        Alert.alert(
          "Select a Payor",
          "Please choose which payor will cover your water bill.",
        );
        return;
      }
      if (allocationMode === "CUSTOM_SPLIT" && !customSplitSummary.isValid) {
        Alert.alert(
          "Custom Split Incomplete",
          customSplitInputType === "PERCENT"
            ? `Your custom percentages currently add up to ${customSplitSummary.allocatedPercent.toFixed(1)}%. Please adjust them to total 100%.`
            : `Your custom amounts currently add up to ₱${customSplitSummary.allocatedPesos.toFixed(2)} out of ₱${waterFee.toFixed(2)}. Please match the total water due.`,
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const finalPresentSet = optimisticPresentRef.current;
      const finalPresentCount = finalPresentSet.size;
      const finalAbsentCount = Math.max(0, totalDays - finalPresentCount);
      const finalWaterFee = isFixedMode
        ? myFixedSharePesos
        : finalPresentCount * ratePerDayPesos;
      const centavos = Math.round(finalWaterFee * 100);

      // 1. Batch-save all cycle dates (PRESENT / ABSENT) to Firestore
      if (cycleDates.length > 0) {
        const entries: Array<{ date: string; status: "PRESENT" | "ABSENT" }> =
          cycleDates.map((d) => ({
            date: d.iso,
            status: finalPresentSet.has(d.iso) ? "PRESENT" : "ABSENT",
          }));
        await mobileDataService.bulkToggleAttendance(
          resolvedHouseholdId,
          resolvedBillingCycleId,
          activeUserId,
          entries,
        );
      }

      // 2. Build allocationConfig if user is a Non-Payor
      let allocationConfig:
        | {
            allocationMode: PayorAllocationMode;
            assignedPayorId?: string;
            assignedPayorName?: string;
            customPayorSplitsCentavos?: Record<string, number>;
            customPayorPercentages?: Record<string, number>;
            customSplitInputType?: "PESO" | "PERCENT";
          }
        | undefined;

      if (!isMyMemberPayor) {
        const targetPayor = activePayors.find(
          (p) => (p.userId || p.memberId || p.id) === selectedSpecificPayorId,
        );
        allocationConfig = {
          allocationMode,
          assignedPayorId:
            allocationMode === "SPECIFIC_PAYOR" ? selectedSpecificPayorId : "",
          assignedPayorName:
            allocationMode === "SPECIFIC_PAYOR"
              ? targetPayor?.displayName || "Payor"
              : "",
          customPayorSplitsCentavos:
            allocationMode === "CUSTOM_SPLIT"
              ? customSplitSummary.payorSharesCents
              : {},
          customPayorPercentages:
            allocationMode === "CUSTOM_SPLIT"
              ? customSplitSummary.payorPercentages
              : {},
          customSplitInputType,
        };
      }

      // 3. Submit attendance & sync cycle water bills
      await mobileDataService.submitAttendance(
        resolvedHouseholdId,
        resolvedBillingCycleId,
        activeUserId,
        finalPresentCount,
        finalAbsentCount,
        centavos,
        allocationConfig,
      );
      await mobileDataService.syncCycleWaterBill(
        resolvedHouseholdId,
        resolvedBillingCycleId,
      );

      // 4. Lock calendar into saved view mode and clear unsaved state
      const committedDates = Array.from(finalPresentSet);
      setSavedPresentDates(committedDates);
      setPresentDates(committedDates);
      hasUserModifiedDraftRef.current = false;
      setHasUserModifiedDraft(false);
      setIsEditingAttendance(false);
      setShowLockedHint(false);
      setShowSubmitModal(false);
      setIsSubmitting(false);

      // If submission was triggered from the Unsaved Markings Leave Prompt, complete navigation
      if (localPendingLeaveRef.current) {
        const leaveFn = localPendingLeaveRef.current;
        localPendingLeaveRef.current = null;
        onClearPendingLeave?.();
        leaveFn();
        return;
      }

      const allocationNote = !isMyMemberPayor
        ? allocationMode === "SPECIFIC_PAYOR"
          ? ` Assigned to ${
              activePayors.find(
                (p) =>
                  (p.userId || p.memberId || p.id) === selectedSpecificPayorId,
              )?.displayName || "selected payor"
            }.`
          : allocationMode === "CUSTOM_SPLIT"
            ? " Custom split applied across payors."
            : " Split fairly across all payors."
        : "";

      Alert.alert(
        "Attendance Submitted & Locked",
        `Your water presence (${finalPresentCount} days present, ₱${finalWaterFee.toFixed(
          2,
        )}) has been saved and locked to prevent accidental edits.${allocationNote}`,
      );
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert("Error", err.message || "Failed to submit attendance.");
    }
  };

  // Discard unsaved draft changes and proceed with leaving the screen
  const handleDiscardAndLeave = () => {
    optimisticPresentRef.current = new Set(savedPresentDates);
    setPresentDates([...savedPresentDates]);
    hasUserModifiedDraftRef.current = false;
    setHasUserModifiedDraft(false);
    setIsEditingAttendance(false);
    setShowLockedHint(false);
    setShowLeavePromptModal(false);

    const leaveFn = localPendingLeaveRef.current || pendingLeaveAction;
    localPendingLeaveRef.current = null;
    onClearPendingLeave?.();
    if (leaveFn) {
      leaveFn();
    }
  };

  const handleStayOnScreen = () => {
    setShowLeavePromptModal(false);
    localPendingLeaveRef.current = null;
    onClearPendingLeave?.();
  };

  const handleSubmitFromLeaveModal = () => {
    setShowLeavePromptModal(false);
    handleOpenSubmitModal();
  };

  const handleBackPress = () => {
    if (!onBack) return;
    if (hasUnsavedChanges) {
      localPendingLeaveRef.current = () => {
        onBack();
      };
      setShowLeavePromptModal(true);
      return;
    }
    onBack();
  };

  // Manual Refresh Handler
  const handleRefresh = async () => {
    if (!resolvedHouseholdId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (resolvedBillingCycleId) {
        await mobileDataService
          .markExpensesPaidIfAllSettled(
            resolvedHouseholdId,
            resolvedBillingCycleId,
          )
          .catch(() => {});
        if (!isCycleClosedOrPaidOff) {
          await mobileDataService.syncCycleWaterBill(
            resolvedHouseholdId,
            resolvedBillingCycleId,
          );
        }
      }
      if (!isCycleClosedOrPaidOff) {
        await mobileDataService.recalculateUnpaidExpensesForHousehold(
          resolvedHouseholdId,
        );
      }
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
          onPress={handleBackPress}
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
                  !cycleWaterData
                    ? "Water billing rule has not been configured by your host for this billing cycle yet."
                    : pricingModel === "FIXED_MONTHLY"
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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(40, insets.bottom + 45) },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {profile?.joinRequestStatus === "REJECTED" ? (
            <View
              style={[
                styles.emptyCard,
                {
                  borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECDD3",
                  backgroundColor: isDark
                    ? "rgba(239, 68, 68, 0.08)"
                    : "#FFF1F2",
                },
              ]}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: isDark
                    ? "rgba(239, 68, 68, 0.2)"
                    : "#FFE4E6",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Feather name="shield-off" size={26} color="#E11D48" />
              </View>
              <Text
                style={[
                  styles.emptyTitle,
                  { color: isDark ? "#FDA4AF" : "#9F1239" },
                ]}
              >
                Join Request Declined
              </Text>
              <Text
                style={[
                  styles.emptySub,
                  {
                    color: isDark ? "#FECDD3" : "#BE123C",
                    marginBottom: 12,
                  },
                ]}
              >
                Your request to join this group was declined by the host. Only
                active members of the household can access attendance and
                roommate breakdown.
              </Text>
              {Boolean(profile.joinRejectionReason) && (
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: isDark
                      ? "rgba(0,0,0,0.3)"
                      : "rgba(255,255,255,0.8)",
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#FCA5A5",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter-Medium",
                      color: isDark ? "#FCA5A5" : "#9F1239",
                    }}
                  >
                    Reason: "{profile.joinRejectionReason}"
                  </Text>
                </View>
              )}
              {onBack && (
                <TouchableOpacity
                  style={{
                    backgroundColor: "#E11D48",
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                  onPress={onBack}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontFamily: "Inter-SemiBold",
                      fontSize: 13,
                    }}
                  >
                    Return to Home
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : !resolvedHouseholdId ||
            (!isHost &&
              isProfileLoaded &&
              !loading &&
              members.length > 0 &&
              !members.some((m) => matchesMemberUid(m, activeUserId))) ? (
            <View
              style={[
                styles.emptyCard,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="lock-closed-outline" size={40} color="#94A3B8" />
              <Text
                style={[styles.emptyTitle, isDark && { color: colors.text }]}
              >
                Group Membership Required
              </Text>
              <Text
                style={[
                  styles.emptySub,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Only active members of a household group can access attendance
                tracking and roommate water splits.
              </Text>
              {onBack && (
                <TouchableOpacity
                  style={{
                    marginTop: 12,
                    backgroundColor: colors.primary,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                  onPress={onBack}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontFamily: "Inter-SemiBold",
                      fontSize: 13,
                    }}
                  >
                    Return to Home
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : !activeCycle ? (
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
          ) : !cycleWaterData && !isCycleClosedOrPaidOff ? (
            <View
              style={[
                styles.emptyCard,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: isDark
                    ? "rgba(2, 132, 199, 0.16)"
                    : "#E0F2FE",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 4,
                }}
              >
                <Ionicons
                  name="water-outline"
                  size={30}
                  color={isDark ? colors.accent : "#0284C7"}
                />
              </View>
              <Text
                style={[styles.emptyTitle, isDark && { color: colors.text }]}
              >
                Waiting for Host Setup
              </Text>
              <Text
                style={[
                  styles.emptySub,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                {isHost
                  ? `Set up the water billing rule for ${activeCycle.name || "this billing cycle"} to choose Daily Attendance, Fixed Monthly Split, or Flat Rate.`
                  : `${hostName} hasn't configured the water billing rule for ${activeCycle.name || "this billing cycle"} yet. Once configured, your water billing details or attendance calendar will appear here.`}
              </Text>
              {isHost && (
                <TouchableOpacity
                  style={{
                    marginTop: 18,
                    minHeight: 46,
                    paddingHorizontal: 22,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: isDark ? colors.primary : "#1E60E6",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  onPress={() => setShowWaterSettingsModal(true)}
                  activeOpacity={0.85}
                >
                  <Feather name="settings" size={15} color="#FFFFFF" />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: "800",
                    }}
                  >
                    Configure Water Billing
                  </Text>
                </TouchableOpacity>
              )}
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
                      isCycleClosedOrPaidOff && {
                        backgroundColor: "rgba(16, 185, 129, 0.24)",
                      },
                      isDark && {
                        backgroundColor: isCycleClosedOrPaidOff
                          ? "rgba(16, 185, 129, 0.18)"
                          : "rgba(59, 130, 246, 0.18)",
                        borderColor: isCycleClosedOrPaidOff
                          ? "rgba(16, 185, 129, 0.4)"
                          : colors.borderHighlighted,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    {/* <View
                      style={[
                        styles.activeCycleDot,
                        isCycleClosedOrPaidOff && {
                          backgroundColor: "#34D399",
                        },
                      ]}
                    ></View> */}
                    <Text
                      style={[
                        styles.activeCyclePillText,
                        isDark && {
                          color: isCycleClosedOrPaidOff
                            ? "#34D399"
                            : colors.accent,
                        },
                      ]}
                    >
                      {isCycleClosedOrPaidOff
                        ? "Cycle Settled & Closed"
                        : "Active Billing Cycle"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.totalDaysText,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    {isCycleClosedOrPaidOff
                      ? "Reset to 0"
                      : isFixedMode
                        ? "Fixed Monthly"
                        : `${totalDays} Total Days`}
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
                      {isFixedMode ? "—" : presentCount}
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
                      {isFixedMode ? "—" : absentCount}
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
                      {isFixedMode && !isMyMemberPayor
                        ? "Exempt"
                        : `₱${waterFee.toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Cycle Settled & Closed Reset Banner */}
              {isCycleClosedOrPaidOff && (
                <View
                  style={[
                    styles.settledResetBanner,
                    isDark && {
                      backgroundColor: "rgba(16, 185, 129, 0.12)",
                      borderColor: "rgba(16, 185, 129, 0.3)",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.settledResetIconWrap,
                      isDark && { backgroundColor: "rgba(16, 185, 129, 0.2)" },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-done-circle"
                      size={22}
                      color={isDark ? "#34D399" : "#059669"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.settledResetTitle,
                        isDark && { color: "#6EE7B7" },
                      ]}
                    >
                      Cycle Paid Off & Attendance Reset
                    </Text>
                    <Text
                      style={[
                        styles.settledResetSub,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      All dues for this billing cycle have been settled or
                      closed. Attendance counters are reset to zero awaiting the
                      next cycle.
                    </Text>
                  </View>
                </View>
              )}

              {/* =========================================================================
                WATER UTILITY FEE ACTION BAR
                ========================================================================= */}
              <View
                style={[
                  styles.feeBarCard,
                  isEditingAttendance && styles.feeBarCardEditing,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: isEditingAttendance
                      ? isDark
                        ? "rgba(59, 130, 246, 0.45)"
                        : "#93C5FD"
                      : colors.border,
                  },
                ]}
              >
                {/* Header Row: Icon, Title & Rate, Status/Edit Badge */}
                <View style={styles.feeBarHeaderRow}>
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

                  <View style={styles.feeBarTextWrap}>
                    <Text
                      style={[
                        styles.feeBarTitle,
                        isDark && { color: colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      Water Utility Fee
                    </Text>
                    <Text
                      style={[
                        styles.feeBarSubtitle,
                        isDark && { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {pricingModel === "FIXED_MONTHLY"
                        ? `Fixed ₱${fixedMonthlyPesos.toFixed(2)} split evenly`
                        : pricingModel === "FIXED_PER_PERSON_MONTH"
                          ? `Fixed ₱${fixedPerPersonPesos.toFixed(2)} flat fee`
                          : `Fixed ₱${ratePerDayPesos.toFixed(0)} per present day`}
                    </Text>
                  </View>

                  {isLockedByCyclePayment && (
                    <View
                      style={[
                        styles.settledFeePill,
                        {
                          backgroundColor: isDark
                            ? "rgba(245, 158, 11, 0.16)"
                            : "#FEF3C7",
                          borderColor: isDark
                            ? "rgba(245, 158, 11, 0.35)"
                            : "#FDE68A",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                        },
                      ]}
                    >
                      <Feather
                        name="lock"
                        size={11}
                        color={isDark ? "#FBBF24" : "#B45309"}
                      />
                      <Text
                        style={[
                          styles.settledFeePillText,
                          { color: isDark ? "#FBBF24" : "#B45309" },
                        ]}
                      >
                        Payments Started
                      </Text>
                    </View>
                  )}

                  {!isFixedMode &&
                    !isCycleClosedOrPaidOff &&
                    !isLockedByCyclePayment &&
                    isCalendarLocked && (
                      <TouchableOpacity
                        style={[
                          styles.editAttendancePillBtn,
                          isDark && {
                            backgroundColor: colors.primaryLight,
                            borderColor: colors.borderHighlighted,
                          },
                        ]}
                        onPress={handleStartEditing}
                        activeOpacity={0.7}
                      >
                        <Feather
                          name="edit-2"
                          size={12}
                          color={isDark ? colors.accent : "#2563EB"}
                        />
                        <Text
                          style={[
                            styles.editAttendancePillBtnText,
                            isDark && { color: colors.accent },
                          ]}
                        >
                          Edit Attendance
                        </Text>
                      </TouchableOpacity>
                    )}

                  {!isFixedMode &&
                    !isCycleClosedOrPaidOff &&
                    !isLockedByCyclePayment &&
                    !isCalendarLocked &&
                    isEditingAttendance &&
                    isMyAttendanceSubmitted && (
                      <View
                        style={[
                          styles.editingModeBadge,
                          isDark && {
                            backgroundColor: "rgba(59, 130, 246, 0.15)",
                            borderColor: "rgba(59, 130, 246, 0.35)",
                          },
                        ]}
                      >
                        <View style={styles.editingPulseDot} />
                        <Text
                          style={[
                            styles.editingModeBadgeText,
                            isDark && { color: colors.accent },
                          ]}
                        >
                          Editing
                        </Text>
                      </View>
                    )}

                  {isCycleClosedOrPaidOff && (
                    <View
                      style={[
                        styles.settledFeePill,
                        isDark && {
                          backgroundColor: "rgba(16, 185, 129, 0.16)",
                          borderColor: "rgba(16, 185, 129, 0.35)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.settledFeePillText,
                          isDark && { color: "#34D399" },
                        ]}
                      >
                        Settled · ₱0.00
                      </Text>
                    </View>
                  )}
                </View>

                {/* Dedicated Action Toolbar when editing or marking attendance */}
                {!isFixedMode &&
                  !isCycleClosedOrPaidOff &&
                  !isCalendarLocked && (
                    <>
                      <View
                        style={[
                          styles.feeBarDivider,
                          isDark && { backgroundColor: colors.border },
                        ]}
                      />

                      <View style={styles.feeBarActionsStrip}>
                        <TouchableOpacity
                          style={[
                            styles.markAllBtn,
                            isDark && {
                              backgroundColor: colors.primaryLight,
                              borderColor: colors.borderHighlighted,
                            },
                          ]}
                          onPress={markAll}
                          activeOpacity={0.7}
                        >
                          <Feather
                            name="check-square"
                            size={13}
                            color={isDark ? colors.accent : "#2563EB"}
                          />
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
                            },
                          ]}
                          onPress={clearAll}
                          activeOpacity={0.7}
                        >
                          <Feather
                            name="rotate-ccw"
                            size={12}
                            color={isDark ? colors.textSecondary : "#64748B"}
                          />
                          <Text
                            style={[
                              styles.clearBtnText,
                              isDark && { color: colors.textSecondary },
                            ]}
                          >
                            Clear
                          </Text>
                        </TouchableOpacity>

                        {isMyAttendanceSubmitted && isEditingAttendance && (
                          <TouchableOpacity
                            style={[
                              styles.cancelEditPillBtn,
                              isDark && {
                                backgroundColor: "rgba(239, 68, 68, 0.12)",
                                borderColor: "rgba(239, 68, 68, 0.28)",
                              },
                            ]}
                            onPress={handleCancelEditing}
                            activeOpacity={0.7}
                          >
                            <Feather
                              name="x"
                              size={13}
                              color={isDark ? "#F87171" : "#DC2626"}
                            />
                            <Text
                              style={[
                                styles.cancelEditPillBtnText,
                                isDark && { color: "#F87171" },
                              ]}
                            >
                              Cancel
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}
              </View>

              {/* Locked Banner when cycle payments have started */}
              {isLockedByCyclePayment && (
                <View
                  style={[
                    styles.lockedHintBanner,
                    {
                      backgroundColor: isDark
                        ? "rgba(245, 158, 11, 0.14)"
                        : "#FFFBEB",
                      borderColor: isDark
                        ? "rgba(245, 158, 11, 0.35)"
                        : "#FDE68A",
                    },
                  ]}
                >
                  <Feather
                    name="lock"
                    size={15}
                    color={isDark ? "#FBBF24" : "#D97706"}
                  />
                  <Text
                    style={[
                      styles.lockedHintText,
                      { color: isDark ? "#FDE68A" : "#92400E" },
                    ]}
                  >
                    Attendance is locked for everyone because bill payments have
                    already started for this cycle.
                  </Text>
                </View>
              )}

              {/* Locked Calendar Hint Banner (when user taps a locked date after submitting) */}
              {showLockedHint &&
                isCalendarLocked &&
                !isLockedByCyclePayment &&
                !isCycleClosedOrPaidOff && (
                  <View
                    style={[
                      styles.lockedHintBanner,
                      isDark && {
                        backgroundColor: "rgba(37, 99, 235, 0.14)",
                        borderColor: "rgba(59, 130, 246, 0.35)",
                      },
                    ]}
                  >
                    <Feather
                      name="lock"
                      size={15}
                      color={isDark ? colors.accent : "#2563EB"}
                    />
                    <Text
                      style={[
                        styles.lockedHintText,
                        isDark && { color: colors.text },
                      ]}
                    >
                      Attendance is locked to prevent accidental edits.
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.lockedHintActionBtn,
                        isDark && { backgroundColor: colors.primary },
                      ]}
                      onPress={handleStartEditing}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.lockedHintActionText}>Edit Now</Text>
                    </TouchableOpacity>
                  </View>
                )}

              {/* Unsaved Markings Indicator Banner */}
              {hasUnsavedChanges && !isCycleClosedOrPaidOff && (
                <View
                  style={[
                    styles.unsavedDraftBanner,
                    isDark && {
                      backgroundColor: "rgba(245, 158, 11, 0.14)",
                      borderColor: "rgba(245, 158, 11, 0.35)",
                    },
                  ]}
                >
                  <Ionicons
                    name="alert-circle"
                    size={18}
                    color={isDark ? "#FBBF24" : "#D97706"}
                  />
                  <Text
                    style={[
                      styles.unsavedDraftText,
                      isDark && { color: "#FDE68A" },
                    ]}
                  >
                    Unsaved markings ({presentCount} day
                    {presentCount === 1 ? "" : "s"}). Tap Submit below before
                    leaving.
                  </Text>
                  <TouchableOpacity
                    style={styles.unsavedDraftSubmitMiniBtn}
                    onPress={handleOpenSubmitModal}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.unsavedDraftSubmitMiniText}>
                      Submit
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

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
                  const sectionPresentCount = isCycleClosedOrPaidOff
                    ? 0
                    : sec.dates.reduce(
                        (acc, d) => (presentSet.has(d.iso) ? acc + 1 : acc),
                        0,
                      );
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

                        <View style={styles.monthHeaderRightRow}>
                          {isCalendarLocked && !isCycleClosedOrPaidOff && (
                            <View
                              style={[
                                styles.lockedCalendarBadge,
                                isDark && {
                                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                                },
                              ]}
                            >
                              <Feather
                                name="lock"
                                size={10}
                                color={isDark ? "#34D399" : "#059669"}
                              />
                              <Text
                                style={[
                                  styles.lockedCalendarBadgeText,
                                  isDark && { color: "#34D399" },
                                ]}
                              >
                                Locked
                              </Text>
                            </View>
                          )}
                          <Text
                            style={[
                              styles.monthPresentRatio,
                              isDark && { color: colors.accent },
                            ]}
                          >
                            {sectionPresentCount} / {totalInSec} Present
                          </Text>
                        </View>
                      </View>

                      {/* Weekday Row - 7 equal flex:1 columns */}
                      <View style={styles.weekdaysRow}>
                        {weekdayLabels.map((w) => (
                          <View key={w} style={styles.weekdayCell}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.weekdayText,
                                isDark && { color: colors.textMuted },
                              ]}
                            >
                              {w}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Days Grid - Deterministic 7-column week rows so SUN column never wraps */}
                      <View style={styles.daysGrid}>
                        {sec.weeks.map((week, weekIdx) => (
                          <View
                            key={`week_${sec.monthKey}_${weekIdx}`}
                            style={styles.weekRow}
                          >
                            {week.map((d, colIdx) => {
                              if (!d) {
                                return (
                                  <View
                                    key={`spacer_${sec.monthKey}_${weekIdx}_${colIdx}`}
                                    style={styles.dayBoxEmpty}
                                  />
                                );
                              }
                              const isPresent =
                                !isCycleClosedOrPaidOff &&
                                presentSet.has(d.iso);
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
                                            backgroundColor:
                                              colors.surfaceInset,
                                            borderColor:
                                              "rgba(255, 255, 255, 0.12)",
                                          },
                                        ],
                                    isCycleClosedOrPaidOff && { opacity: 0.65 },
                                  ]}
                                  onPress={() => toggleDay(d.iso)}
                                  hitSlop={{
                                    top: 4,
                                    bottom: 4,
                                    left: 4,
                                    right: 4,
                                  }}
                                  activeOpacity={isCalendarLocked ? 0.85 : 0.6}
                                >
                                  <Text
                                    numberOfLines={1}
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
                        ))}
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
                  {(() => {
                    const liveWaterBreakdown = computeCycleWaterBreakdown(
                      members,
                      allCycleAttendance,
                      submissions,
                      Number(cycleWaterData?.rateCentavosPerPersonPerDay) > 0
                        ? Number(cycleWaterData?.rateCentavosPerPersonPerDay)
                        : 500,
                    );
                    return members.map((member, index) => {
                      const mUid =
                        member.userId || member.memberId || member.id;
                      const isMe = mUid === activeUserId;
                      const isPayor = isPayorMember(member);
                      const memberWaterInfo =
                        liveWaterBreakdown.membersBreakdown.find((b) =>
                          matchesMemberUid(member, b.userId),
                        );

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
                      const rawMemberPresentCount = isMe
                        ? rawPresentCount
                        : attPresentCount > 0
                          ? attPresentCount
                          : subPresentCount;
                      const memberPresentCount = isCycleClosedOrPaidOff
                        ? 0
                        : rawMemberPresentCount;

                      const memberAbsentCount = isCycleClosedOrPaidOff
                        ? 0
                        : Math.max(0, totalDays - memberPresentCount);
                      // Effective daily rate (defaults safely to ₱5.00/day)
                      const effectiveDailyRate =
                        Number(cycleWaterData?.rateCentavosPerPersonPerDay) > 0
                          ? Number(
                              cycleWaterData?.rateCentavosPerPersonPerDay,
                            ) / 100
                          : 5.0;

                      const ownWaterPesos = isCycleClosedOrPaidOff
                        ? 0
                        : isFixedMode
                          ? !isPayor
                            ? 0
                            : pricingModel === "FIXED_PER_PERSON_MONTH"
                              ? fixedPerPersonPesos
                              : computeFairSplitShareCentavos(
                                  Math.round(fixedMonthlyPesos * 100),
                                  activePayors,
                                  mUid,
                                ) / 100
                          : memberPresentCount > 0
                            ? memberPresentCount * effectiveDailyRate
                            : 0;

                      const absorbedNonPayorPesos =
                        isCycleClosedOrPaidOff || !isPayor || isFixedMode
                          ? 0
                          : (memberWaterInfo?.nonPayorWaterCentavos || 0) / 100;

                      // For Payors, show their total effective water share (own + absorbed Non-Payor share).
                      // For Non-Payors, show their generated water amount alongside who covers it (on presence mode only).
                      const memberWaterTotal = isCycleClosedOrPaidOff
                        ? 0
                        : isPayor
                          ? ownWaterPesos + absorbedNonPayorPesos
                          : ownWaterPesos;

                      const memberSubmission = memberSub || submissions[mUid];
                      const isSubmitted =
                        isCycleClosedOrPaidOff || isFixedMode
                          ? false
                          : isMe
                            ? isMyAttendanceSubmitted
                            : Boolean(memberSubmission);
                      const hasMarked =
                        isCycleClosedOrPaidOff || isFixedMode
                          ? false
                          : isMe
                            ? presentCount > 0
                            : memberPresentCount > 0;

                      const nonPayorAllocationLabel = isFixedMode
                        ? null
                        : !isPayor && (isSubmitted || memberSubmission)
                          ? memberWaterInfo?.nonPayorAllocationSummary ||
                            (memberSubmission?.allocationMode ===
                            "SPECIFIC_PAYOR"
                              ? `Paid by ${memberSubmission.assignedPayorName || "Assigned Payor"}`
                              : memberSubmission?.allocationMode ===
                                  "CUSTOM_SPLIT"
                                ? "Custom Split on Payors"
                                : "Split Fairly on Payors")
                          : isPayor && absorbedNonPayorPesos > 0
                            ? memberWaterInfo?.nonPayorWaterNotes?.length
                              ? `+${memberWaterInfo.nonPayorWaterNotes.join(", ")}`
                              : `+₱${absorbedNonPayorPesos.toFixed(2)} non-payor`
                            : null;

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
                              {isFixedMode
                                ? isPayor
                                  ? pricingModel === "FIXED_MONTHLY"
                                    ? "Equal monthly split"
                                    : "Flat monthly fee"
                                  : "Exempt from fixed water bill"
                                : `${memberPresentCount} days present • ${memberAbsentCount} off${
                                    nonPayorAllocationLabel
                                      ? ` • ${nonPayorAllocationLabel}`
                                      : ""
                                  }`}
                            </Text>
                          </View>

                          {/* Right Due & Status */}
                          <View style={styles.memberDueCol}>
                            {!(isFixedMode && !isPayor) && (
                              <Text
                                style={[
                                  styles.memberDueAmount,
                                  isDark && { color: colors.text },
                                ]}
                              >
                                ₱{memberWaterTotal.toFixed(2)}
                              </Text>
                            )}
                            <Text
                              style={[
                                styles.memberStatusLabel,
                                isCycleClosedOrPaidOff ||
                                (isFixedMode && isPayor) ||
                                hasMarked ||
                                isSubmitted
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
                              {isCycleClosedOrPaidOff
                                ? !isPayor
                                  ? "Exempt"
                                  : "Settled"
                                : isFixedMode
                                  ? !isPayor
                                    ? "Exempt"
                                    : "Fixed Share"
                                  : hasMarked || isSubmitted
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
                    });
                  })()}
                </View>
              </View>

              {/* =========================================================================
                SUBMIT / EDIT BUTTON & BANNER (Presence-Based Mode Only)
                Requires explicit submit before leaving; locks calendar after submission
                or when cycle payments have started. Omitted completely on Fixed rules.
                ========================================================================= */}
              {!isFixedMode && (
                <View style={styles.submissionContainer}>
                  <View
                    style={[
                      styles.submissionNoticeBox,
                      isLockedByCyclePayment
                        ? styles.submissionNoticeBoxWarning
                        : isCycleClosedOrPaidOff || isCalendarLocked
                          ? styles.submissionNoticeBoxSubmitted
                          : hasUnsavedChanges
                            ? styles.submissionNoticeBoxWarning
                            : styles.submissionNoticeBoxPending,
                      isDark &&
                        (isLockedByCyclePayment || hasUnsavedChanges
                          ? {
                              backgroundColor: "rgba(245, 158, 11, 0.14)",
                              borderColor: "rgba(245, 158, 11, 0.32)",
                            }
                          : isCycleClosedOrPaidOff || isCalendarLocked
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
                        isCycleClosedOrPaidOff || isCalendarLocked
                          ? "lock-closed"
                          : hasUnsavedChanges
                            ? "alert-circle"
                            : "water-outline"
                      }
                      size={18}
                      color={
                        isLockedByCyclePayment || hasUnsavedChanges
                          ? isDark
                            ? "#FBBF24"
                            : "#D97706"
                          : isCycleClosedOrPaidOff || isCalendarLocked
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
                        (isCycleClosedOrPaidOff ||
                          (isCalendarLocked && !isLockedByCyclePayment)) &&
                          styles.submissionNoticeTextSubmitted,
                        (hasUnsavedChanges || isLockedByCyclePayment) &&
                          styles.submissionNoticeTextWarning,
                        isDark && {
                          color:
                            isLockedByCyclePayment || hasUnsavedChanges
                              ? "#FDE68A"
                              : isCycleClosedOrPaidOff || isCalendarLocked
                                ? "#6EE7B7"
                                : "#93C5FD",
                        },
                      ]}
                    >
                      {isCycleClosedOrPaidOff
                        ? "This billing cycle is paid off and closed. Your water attendance and dues have been reset to zero (₱0.00) for the next cycle."
                        : isLockedByCyclePayment
                          ? `Attendance is locked (${presentCount} days, ₱${waterFee.toFixed(
                              2,
                            )}) because one or more payors have already started paying bills for this cycle.`
                          : isCalendarLocked
                            ? `Attendance submitted & locked (${presentCount} days, ₱${waterFee.toFixed(
                                2,
                              )})${
                                !isMyMemberPayor && mySubmission
                                  ? mySubmission.allocationMode ===
                                    "SPECIFIC_PAYOR"
                                    ? ` • Covered by ${mySubmission.assignedPayorName || "Specific Payor"}`
                                    : mySubmission.allocationMode ===
                                        "CUSTOM_SPLIT"
                                      ? " • Covered via Custom Payor Split"
                                      : " • Split fairly across Payors"
                                  : ""
                              }. Tap Edit Attendance below to modify.`
                            : hasUnsavedChanges
                              ? `You have unsaved attendance markings (${presentCount} days, ₱${waterFee.toFixed(
                                  2,
                                )}). Please submit your markings before leaving this screen.`
                              : "Mark the days you were present above, then tap Submit Attendance to confirm and lock your markings."}
                    </Text>
                  </View>

                  {isCycleClosedOrPaidOff ? (
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#94A3B8",
                          shadowOpacity: 0,
                          elevation: 0,
                        },
                      ]}
                      disabled
                    >
                      <View style={styles.submitBtnInner}>
                        <Text
                          style={[
                            styles.submitButtonText,
                            isDark && { color: colors.textSecondary },
                          ]}
                        >
                          Cycle Settled (₱0.00)
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : isLockedByCyclePayment ? (
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#94A3B8",
                          shadowOpacity: 0,
                          elevation: 0,
                        },
                      ]}
                      disabled
                    >
                      <View style={styles.submitBtnInner}>
                        <Feather
                          name="lock"
                          size={17}
                          color={isDark ? colors.textSecondary : "#FFFFFF"}
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          style={[
                            styles.submitButtonText,
                            isDark && { color: colors.textSecondary },
                          ]}
                        >
                          Attendance Locked · Payments Started
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : isCalendarLocked ? (
                    <TouchableOpacity
                      style={[
                        styles.editAttendanceMainBtn,
                        isDark && {
                          backgroundColor: colors.card,
                          borderColor: colors.primary,
                        },
                      ]}
                      onPress={handleStartEditing}
                      activeOpacity={0.85}
                    >
                      <View style={styles.submitBtnInner}>
                        <Feather
                          name="edit-2"
                          size={17}
                          color={isDark ? colors.accent : "#2563EB"}
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          style={[
                            styles.editAttendanceMainBtnText,
                            isDark && { color: colors.accent },
                          ]}
                        >
                          Edit Attendance Markings
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.submitActionRow}>
                      {isMyAttendanceSubmitted && isEditingAttendance && (
                        <TouchableOpacity
                          style={[
                            styles.cancelEditMainBtn,
                            isDark && {
                              backgroundColor: colors.surfaceInset,
                              borderColor: colors.border,
                            },
                          ]}
                          onPress={handleCancelEditing}
                          disabled={isSubmitting}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.cancelEditMainBtnText,
                              isDark && { color: colors.textSecondary },
                            ]}
                          >
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.submitButton,
                          { flex: 1 },
                          isDark && {
                            backgroundColor: colors.primary,
                            shadowColor: colors.primary,
                          },
                          isSubmitting && { opacity: 0.75 },
                        ]}
                        onPress={handleOpenSubmitModal}
                        disabled={isSubmitting}
                        activeOpacity={0.85}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <View style={styles.submitBtnInner}>
                            <Text style={styles.submitButtonText}>
                              {isMyAttendanceSubmitted
                                ? `Update (₱${waterFee.toFixed(2)})`
                                : `Submit Attendance (₱${waterFee.toFixed(2)})`}
                            </Text>
                            <Feather
                              name="arrow-up-circle"
                              size={18}
                              color="#FFFFFF"
                              style={{ marginLeft: 8 }}
                            />
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text
                    style={[
                      styles.submissionFootnote,
                      isDark && { color: colors.textMuted },
                    ]}
                  >
                    {isCycleClosedOrPaidOff
                      ? "Cycle closed & settled · Ready for your host to start the next cycle"
                      : isLockedByCyclePayment
                        ? "Attendance locked for everyone once cycle bill payments begin"
                        : isCalendarLocked
                          ? "Locked after submission to prevent accidental edits"
                          : !isMyMemberPayor
                            ? "Tap Submit to choose which Payors cover your water share"
                            : "Tap Submit to confirm and lock your water attendance markings"}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* =========================================================================
        UNSAVED MARKINGS NAVIGATION GUARD MODAL
        Prompts user to Submit Now, Stay on Screen, or Discard Changes & Leave
        ========================================================================= */}
      <Modal
        visible={showLeavePromptModal}
        transparent
        animationType="fade"
        onRequestClose={handleStayOnScreen}
      >
        <View style={styles.modalOverlayCenter}>
          <View
            style={[
              styles.unsavedModalCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.unsavedModalIconCircle,
                isDark && { backgroundColor: "rgba(245, 158, 11, 0.16)" },
              ]}
            >
              <Ionicons
                name="warning-outline"
                size={28}
                color={isDark ? "#FBBF24" : "#D97706"}
              />
            </View>

            <Text
              style={[
                styles.unsavedModalTitle,
                isDark && { color: colors.text },
              ]}
            >
              Unsaved Attendance Markings
            </Text>

            <Text
              style={[
                styles.unsavedModalDesc,
                isDark && { color: colors.textSecondary },
              ]}
            >
              You marked{" "}
              <Text
                style={{
                  fontWeight: "800",
                  color: isDark ? colors.text : "#0F172A",
                }}
              >
                {presentCount} present day{presentCount === 1 ? "" : "s"} (₱
                {waterFee.toFixed(2)})
              </Text>{" "}
              without submitting. Submit your attendance now so your markings
              aren't lost.
            </Text>

            <TouchableOpacity
              style={[
                styles.unsavedModalPrimaryBtn,
                isDark && { backgroundColor: colors.primary },
              ]}
              onPress={handleSubmitFromLeaveModal}
              activeOpacity={0.85}
            >
              <Feather name="check-circle" size={16} color="#FFFFFF" />
              <Text style={styles.unsavedModalPrimaryBtnText}>Submit Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.unsavedModalSecondaryBtn,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleStayOnScreen}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.unsavedModalSecondaryBtnText,
                  isDark && { color: colors.text },
                ]}
              >
                Stay on Screen
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.unsavedModalDangerBtn}
              onPress={handleDiscardAndLeave}
              activeOpacity={0.75}
            >
              <Text style={styles.unsavedModalDangerBtnText}>
                Discard Changes & Leave
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
        SLIDE-UP SUBMIT ATTENDANCE BOTTOM SHEET MODAL
        Non-Payors choose how Payors cover their water bill:
        1) Split Fairly, 2) Assign Specific Payor, or 3) Custom Split (₱ or %)
        ========================================================================= */}
      <Modal
        visible={showSubmitModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmitting) {
            setShowSubmitModal(false);
          }
        }}
      >
        <KeyboardAvoidingView
          style={[
            styles.bottomSheetOverlay,
            Platform.OS === "android" &&
              (keyboardHeight || 0) > 0 && {
                paddingBottom: keyboardHeight,
              },
          ]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
            onPress={() => {
              if (!isSubmitting) {
                setShowSubmitModal(false);
              }
            }}
          />

          <View
            style={[
              styles.bottomSheetContainer,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Drag Handle */}
            <View style={styles.bottomSheetHandleWrap}>
              <View
                style={[
                  styles.bottomSheetHandle,
                  isDark && { backgroundColor: colors.border },
                ]}
              />
            </View>

            {/* Sheet Header */}
            <View style={styles.bottomSheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.bottomSheetTitle,
                    isDark && { color: colors.text },
                  ]}
                >
                  {!isMyMemberPayor
                    ? "Submit & Assign Water Bill"
                    : "Confirm Water Attendance"}
                </Text>
                <Text
                  style={[
                    styles.bottomSheetSubtitle,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  {!isMyMemberPayor
                    ? "Choose how Payors will cover your water bill share"
                    : "Review and lock your attendance markings for this cycle"}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.bottomSheetCloseBtn,
                  isDark && { backgroundColor: colors.surfaceInset },
                ]}
                onPress={() => {
                  if (!isSubmitting) {
                    setShowSubmitModal(false);
                  }
                }}
                disabled={isSubmitting}
              >
                <Feather
                  name="x"
                  size={18}
                  color={isDark ? colors.textSecondary : "#64748B"}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.bottomSheetScroll}
              contentContainerStyle={styles.bottomSheetScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Summary Pill Card */}
              <View
                style={[
                  styles.sheetSummaryCard,
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.sheetSummaryCol}>
                  <Text
                    style={[
                      styles.sheetSummaryLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Present Days
                  </Text>
                  <Text
                    style={[
                      styles.sheetSummaryVal,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {presentCount} / {totalDays} days
                  </Text>
                </View>

                <View
                  style={[
                    styles.sheetSummaryDivider,
                    isDark && { backgroundColor: colors.border },
                  ]}
                />

                <View style={styles.sheetSummaryCol}>
                  <Text
                    style={[
                      styles.sheetSummaryLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Daily Rate
                  </Text>
                  <Text
                    style={[
                      styles.sheetSummaryVal,
                      isDark && { color: colors.text },
                    ]}
                  >
                    ₱{ratePerDayPesos.toFixed(2)}/day
                  </Text>
                </View>

                <View
                  style={[
                    styles.sheetSummaryDivider,
                    isDark && { backgroundColor: colors.border },
                  ]}
                />

                <View style={styles.sheetSummaryCol}>
                  <Text
                    style={[
                      styles.sheetSummaryLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Water Due
                  </Text>
                  <Text
                    style={[
                      styles.sheetSummaryValAccent,
                      isDark && { color: colors.accent },
                    ]}
                  >
                    ₱{waterFee.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* NON-PAYOR PAYOR ALLOCATION OPTIONS */}
              {!isMyMemberPayor ? (
                <View style={styles.allocationSection}>
                  <Text
                    style={[
                      styles.allocationSectionTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    Who pays your ₱{waterFee.toFixed(2)} water bill?
                  </Text>

                  {/* Mode Selector Tabs */}
                  <View style={styles.allocationModeList}>
                    {/* Option 1: Split Fairly */}
                    <TouchableOpacity
                      style={[
                        styles.allocationModeCard,
                        allocationMode === "FAIR_SPLIT" &&
                          styles.allocationModeCardActive,
                        isDark && {
                          backgroundColor:
                            allocationMode === "FAIR_SPLIT"
                              ? "rgba(37, 99, 235, 0.16)"
                              : colors.surfaceInset,
                          borderColor:
                            allocationMode === "FAIR_SPLIT"
                              ? colors.primary
                              : colors.border,
                        },
                      ]}
                      onPress={() => setAllocationMode("FAIR_SPLIT")}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.allocationRadioOuter,
                          allocationMode === "FAIR_SPLIT" &&
                            styles.allocationRadioOuterActive,
                        ]}
                      >
                        {allocationMode === "FAIR_SPLIT" && (
                          <View style={styles.allocationRadioInner} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.allocationModeTitle,
                            isDark && { color: colors.text },
                          ]}
                        >
                          Split Fairly Among All Payors
                        </Text>
                        <Text
                          style={[
                            styles.allocationModeSub,
                            isDark && { color: colors.textSecondary },
                          ]}
                        >
                          Equally divides ₱{waterFee.toFixed(2)} across{" "}
                          {activePayors.length} payor
                          {activePayors.length === 1 ? "" : "s"} (₱
                          {(
                            waterFee / Math.max(1, activePayors.length)
                          ).toFixed(2)}{" "}
                          each)
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Option 2: Assign Specific Payor */}
                    <TouchableOpacity
                      style={[
                        styles.allocationModeCard,
                        allocationMode === "SPECIFIC_PAYOR" &&
                          styles.allocationModeCardActive,
                        isDark && {
                          backgroundColor:
                            allocationMode === "SPECIFIC_PAYOR"
                              ? "rgba(37, 99, 235, 0.16)"
                              : colors.surfaceInset,
                          borderColor:
                            allocationMode === "SPECIFIC_PAYOR"
                              ? colors.primary
                              : colors.border,
                        },
                      ]}
                      onPress={() => {
                        setAllocationMode("SPECIFIC_PAYOR");
                        if (
                          !selectedSpecificPayorId &&
                          activePayors.length > 0
                        ) {
                          const firstP = activePayors[0];
                          setSelectedSpecificPayorId(
                            firstP.userId || firstP.memberId || firstP.id,
                          );
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.allocationRadioOuter,
                          allocationMode === "SPECIFIC_PAYOR" &&
                            styles.allocationRadioOuterActive,
                        ]}
                      >
                        {allocationMode === "SPECIFIC_PAYOR" && (
                          <View style={styles.allocationRadioInner} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.allocationModeTitle,
                            isDark && { color: colors.text },
                          ]}
                        >
                          Assign Specific Payor
                        </Text>
                        <Text
                          style={[
                            styles.allocationModeSub,
                            isDark && { color: colors.textSecondary },
                          ]}
                        >
                          Choose 1 payor to cover 100% of your ₱
                          {waterFee.toFixed(2)} water bill
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Option 3: Custom Split on Payors */}
                    <TouchableOpacity
                      style={[
                        styles.allocationModeCard,
                        allocationMode === "CUSTOM_SPLIT" &&
                          styles.allocationModeCardActive,
                        isDark && {
                          backgroundColor:
                            allocationMode === "CUSTOM_SPLIT"
                              ? "rgba(37, 99, 235, 0.16)"
                              : colors.surfaceInset,
                          borderColor:
                            allocationMode === "CUSTOM_SPLIT"
                              ? colors.primary
                              : colors.border,
                        },
                      ]}
                      onPress={() => {
                        setAllocationMode("CUSTOM_SPLIT");
                        const hasValues = Object.values(customPayorInputs).some(
                          (v) => Number(v) > 0,
                        );
                        if (!hasValues) {
                          handleDistributeCustomEqually();
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.allocationRadioOuter,
                          allocationMode === "CUSTOM_SPLIT" &&
                            styles.allocationRadioOuterActive,
                        ]}
                      >
                        {allocationMode === "CUSTOM_SPLIT" && (
                          <View style={styles.allocationRadioInner} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.allocationModeTitle,
                            isDark && { color: colors.text },
                          ]}
                        >
                          Custom Split on Payors
                        </Text>
                        <Text
                          style={[
                            styles.allocationModeSub,
                            isDark && { color: colors.textSecondary },
                          ]}
                        >
                          Enter custom Peso (₱) amounts or percentages (%) per
                          payor
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* PAYORS LIST DETAILS BASED ON SELECTED ALLOCATION MODE */}
                  <View
                    style={[
                      styles.payorsListBox,
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.payorsListHeader}>
                      <Text
                        style={[
                          styles.payorsListHeaderTitle,
                          isDark && { color: colors.text },
                        ]}
                      >
                        {allocationMode === "FAIR_SPLIT"
                          ? `Payors Breakdown (${activePayors.length})`
                          : allocationMode === "SPECIFIC_PAYOR"
                            ? "Select a Payor"
                            : "Custom Split per Payor"}
                      </Text>

                      {allocationMode === "CUSTOM_SPLIT" && (
                        <View style={styles.unitToggleWrap}>
                          <TouchableOpacity
                            style={[
                              styles.unitToggleBtn,
                              customSplitInputType === "PESO" &&
                                styles.unitToggleBtnActive,
                            ]}
                            onPress={() => handleToggleCustomInputType("PESO")}
                          >
                            <Text
                              style={[
                                styles.unitToggleBtnText,
                                customSplitInputType === "PESO" &&
                                  styles.unitToggleBtnTextActive,
                              ]}
                            >
                              ₱ Peso
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.unitToggleBtn,
                              customSplitInputType === "PERCENT" &&
                                styles.unitToggleBtnActive,
                            ]}
                            onPress={() =>
                              handleToggleCustomInputType("PERCENT")
                            }
                          >
                            <Text
                              style={[
                                styles.unitToggleBtnText,
                                customSplitInputType === "PERCENT" &&
                                  styles.unitToggleBtnTextActive,
                              ]}
                            >
                              % Percent
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {activePayors.map((payor: any, idx: number) => {
                      const pUid =
                        payor.userId || payor.memberId || payor.id || "";
                      const pName = payor.displayName || payor.name || "Payor";
                      const pInitials = getInitials(pName);
                      const avatarColor =
                        AVATAR_COLORS[idx % AVATAR_COLORS.length];

                      if (allocationMode === "FAIR_SPLIT") {
                        const totalFeeCents = Math.round(waterFee * 100);
                        const fairShareCents = getFairSplitShareAtIndex(
                          totalFeeCents,
                          Math.max(1, activePayors.length),
                          idx,
                        );
                        const fairShare = fairShareCents / 100;
                        return (
                          <View
                            key={pUid}
                            style={[
                              styles.payorOptionRow,
                              isDark && { borderBottomColor: colors.border },
                            ]}
                          >
                            <View
                              style={[
                                styles.payorMiniAvatar,
                                { backgroundColor: avatarColor },
                              ]}
                            >
                              <Text style={styles.payorMiniAvatarText}>
                                {pInitials}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.payorRowName,
                                  isDark && { color: colors.text },
                                ]}
                              >
                                {pName}
                              </Text>
                              <Text
                                style={[
                                  styles.payorRowSub,
                                  isDark && { color: colors.textSecondary },
                                ]}
                              >
                                Equal share (
                                {(
                                  100 / Math.max(1, activePayors.length)
                                ).toFixed(1)}
                                %)
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.payorRowAmount,
                                isDark && { color: colors.accent },
                              ]}
                            >
                              +₱{fairShare.toFixed(2)}
                            </Text>
                          </View>
                        );
                      }

                      if (allocationMode === "SPECIFIC_PAYOR") {
                        const isSelected = selectedSpecificPayorId === pUid;
                        return (
                          <TouchableOpacity
                            key={pUid}
                            style={[
                              styles.payorOptionRow,
                              isSelected && styles.payorOptionRowSelected,
                              isDark && {
                                borderBottomColor: colors.border,
                                backgroundColor: isSelected
                                  ? "rgba(37, 99, 235, 0.15)"
                                  : "transparent",
                              },
                            ]}
                            onPress={() => setSelectedSpecificPayorId(pUid)}
                            activeOpacity={0.75}
                          >
                            <View
                              style={[
                                styles.payorMiniAvatar,
                                { backgroundColor: avatarColor },
                              ]}
                            >
                              <Text style={styles.payorMiniAvatarText}>
                                {pInitials}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.payorRowName,
                                  isDark && { color: colors.text },
                                ]}
                              >
                                {pName}
                              </Text>
                              <Text
                                style={[
                                  styles.payorRowSub,
                                  isDark && { color: colors.textSecondary },
                                ]}
                              >
                                {isSelected
                                  ? "Covers 100% of your water bill"
                                  : "Tap to assign"}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.payorRowAmount,
                                !isSelected && {
                                  color: isDark ? colors.textMuted : "#94A3B8",
                                },
                                isSelected &&
                                  isDark && { color: colors.accent },
                              ]}
                            >
                              {isSelected ? `₱${waterFee.toFixed(2)}` : "₱0.00"}
                            </Text>
                            <View
                              style={[
                                styles.allocationRadioOuter,
                                { marginLeft: 8, marginRight: 0 },
                                isSelected && styles.allocationRadioOuterActive,
                              ]}
                            >
                              {isSelected && (
                                <View style={styles.allocationRadioInner} />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      }

                      // CUSTOM_SPLIT
                      const rawInput = customPayorInputs[pUid] ?? "";
                      const resolvedCents =
                        customSplitSummary.payorSharesCents[pUid] || 0;
                      const resolvedPesos = resolvedCents / 100;
                      const resolvedPct =
                        customSplitSummary.payorPercentages[pUid] || 0;

                      return (
                        <View
                          key={pUid}
                          style={[
                            styles.payorOptionRow,
                            isDark && { borderBottomColor: colors.border },
                          ]}
                        >
                          <View
                            style={[
                              styles.payorMiniAvatar,
                              { backgroundColor: avatarColor },
                            ]}
                          >
                            <Text style={styles.payorMiniAvatarText}>
                              {pInitials}
                            </Text>
                          </View>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text
                              style={[
                                styles.payorRowName,
                                isDark && { color: colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {pName}
                            </Text>
                            <Text
                              style={[
                                styles.payorRowSub,
                                isDark && { color: colors.textSecondary },
                              ]}
                            >
                              {customSplitInputType === "PESO"
                                ? `${resolvedPct.toFixed(1)}% of bill`
                                : `≈ ₱${resolvedPesos.toFixed(2)}`}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.customSplitInputWrap,
                              isDark && {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            {customSplitInputType === "PESO" && (
                              <Text
                                style={[
                                  styles.customSplitUnitPrefix,
                                  isDark && { color: colors.textSecondary },
                                ]}
                              >
                                ₱
                              </Text>
                            )}
                            <TextInput
                              style={[
                                styles.customSplitInput,
                                isDark && { color: colors.text },
                              ]}
                              keyboardType="decimal-pad"
                              value={rawInput}
                              placeholder="0.00"
                              placeholderTextColor={
                                isDark ? colors.textMuted : "#94A3B8"
                              }
                              onChangeText={(txt) => {
                                const cleaned = txt.replace(/[^0-9.]/g, "");
                                setCustomPayorInputs(
                                  (prev: Record<string, string>) => ({
                                    ...prev,
                                    [pUid]: cleaned,
                                  }),
                                );
                              }}
                            />
                            {customSplitInputType === "PERCENT" && (
                              <Text
                                style={[
                                  styles.customSplitUnitPrefix,
                                  isDark && { color: colors.textSecondary },
                                ]}
                              >
                                %
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {/* Custom Split Footer Validation & Equalize Button */}
                    {allocationMode === "CUSTOM_SPLIT" && (
                      <View style={styles.customSplitFooter}>
                        <View style={styles.customSplitTotalRow}>
                          <Text
                            style={[
                              styles.customSplitTotalLabel,
                              !customSplitSummary.isValid && {
                                color: "#EF4444",
                              },
                              customSplitSummary.isValid && {
                                color: isDark ? "#34D399" : "#059669",
                              },
                            ]}
                          >
                            {customSplitInputType === "PESO"
                              ? `Allocated: ₱${customSplitSummary.allocatedPesos.toFixed(
                                  2,
                                )} / ₱${waterFee.toFixed(2)}`
                              : `Allocated: ${customSplitSummary.allocatedPercent.toFixed(
                                  1,
                                )}% / 100%`}
                          </Text>

                          <TouchableOpacity
                            style={styles.distributeEquallyBtn}
                            onPress={handleDistributeCustomEqually}
                          >
                            <Text style={styles.distributeEquallyBtnText}>
                              Split Equally
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {!customSplitSummary.isValid && (
                          <Text style={styles.customSplitErrorText}>
                            {customSplitInputType === "PESO"
                              ? customSplitSummary.remainingPesos > 0
                                ? `₱${customSplitSummary.remainingPesos.toFixed(
                                    2,
                                  )} remaining to allocate.`
                                : `Exceeded total by ₱${Math.abs(
                                    customSplitSummary.remainingPesos,
                                  ).toFixed(2)}.`
                              : customSplitSummary.remainingPercent > 0
                                ? `${customSplitSummary.remainingPercent.toFixed(
                                    1,
                                  )}% remaining to reach 100%.`
                                : `Exceeded 100% by ${Math.abs(
                                    customSplitSummary.remainingPercent,
                                  ).toFixed(1)}%.`}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.payorConfirmInfoBox,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={22}
                    color={isDark ? colors.accent : "#2563EB"}
                  />
                  <Text
                    style={[
                      styles.payorConfirmInfoText,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Once submitted, your attendance calendar will lock to
                    prevent accidental taps. You can tap{" "}
                    <Text
                      style={{
                        fontWeight: "800",
                        color: isDark ? colors.text : "#0F172A",
                      }}
                    >
                      Edit Attendance
                    </Text>{" "}
                    anytime you return to make changes.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Bottom Sheet Action Buttons */}
            <View
              style={[
                styles.bottomSheetFooter,
                isDark && { borderTopColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.sheetKeepEditingBtn,
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
              >
                <Text
                  style={[
                    styles.sheetKeepEditingBtnText,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Keep Editing
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sheetConfirmSubmitBtn,
                  isDark && { backgroundColor: colors.primary },
                  !isMyMemberPayor &&
                    allocationMode === "CUSTOM_SPLIT" &&
                    !customSplitSummary.isValid && { opacity: 0.5 },
                  isSubmitting && { opacity: 0.75 },
                ]}
                onPress={handleConfirmSubmitAttendance}
                disabled={
                  isSubmitting ||
                  (!isMyMemberPayor &&
                    allocationMode === "CUSTOM_SPLIT" &&
                    !customSplitSummary.isValid)
                }
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.sheetConfirmSubmitBtnText}>
                      Confirm & Submit
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Host Water Settings Modal */}
      {isHost && resolvedHouseholdId && (
        <WaterSettingsModal
          visible={showWaterSettingsModal}
          onClose={() => setShowWaterSettingsModal(false)}
          householdId={resolvedHouseholdId}
          billingCycleId={resolvedBillingCycleId || undefined}
          initialConfig={
            cycleWaterData || (waterConfig?.updatedAt ? waterConfig : null)
          }
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
    borderRadius: 24,
    padding: 32,
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

  /* Cycle Settled & Reset Banner */
  settledResetBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 12,
  },
  settledResetIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  settledResetTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#065F46",
    marginBottom: 2,
  },
  settledResetSub: {
    fontSize: 11,
    lineHeight: 16,
    color: "#047857",
    fontWeight: "600",
  },

  /* Water Utility Fee Bar & Actions Strip */
  feeBarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    // shadowColor: "#0F172A",
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.04,
    // shadowRadius: 6,
    // elevation: 2,
  },
  feeBarCardEditing: {
    borderColor: "#93C5FD",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  feeBarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  feeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  feeBarTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  feeBarTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  feeBarSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  editingModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  editingPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563EB",
  },
  editingModeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.2,
  },
  feeBarDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginTop: 12,
    marginBottom: 10,
  },
  feeBarActionsStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  markAllBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingVertical: 8.5,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  clearBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 8.5,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  editAttendancePillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  editAttendancePillBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  cancelEditPillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 8.5,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  cancelEditPillBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  settledFeePill: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  settledFeePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
  },

  /* Locked & Unsaved Hint Banners */
  lockedHintBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  lockedHintText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#1E3A8A",
  },
  lockedHintActionBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  lockedHintActionText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  unsavedDraftBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  unsavedDraftText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
    lineHeight: 16,
  },
  unsavedDraftSubmitMiniBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
  },
  unsavedDraftSubmitMiniText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* Monthly Calendar Card matching Image 1 */
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 14,
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
  monthHeaderRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockedCalendarBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  lockedCalendarBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
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
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayText: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },
  daysGrid: {
    flexDirection: "column",
    gap: 4,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dayBoxEmpty: {
    flex: 1,
    aspectRatio: 1,
  },
  dayBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
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
    fontSize: 6,
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
    fontSize: 6,
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

  /* Submit Water Bill Attendance Button */
  submissionContainer: {
    marginBottom: 24,
  },
  submissionNoticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  submissionNoticeBoxWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
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
  submissionNoticeTextWarning: {
    color: "#92400E",
  },
  submitActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
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
  },
  editAttendanceMainBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#2563EB",
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  editAttendanceMainBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2563EB",
  },
  cancelEditMainBtn: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelEditMainBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
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
    marginTop: 8,
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    fontWeight: "600",
  },

  /* Unsaved Markings Leave Guard Modal */
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  unsavedModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  unsavedModalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  unsavedModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  unsavedModalDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
    textAlign: "center",
    marginBottom: 18,
  },
  unsavedModalPrimaryBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  unsavedModalPrimaryBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  unsavedModalSecondaryBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingVertical: 13,
    marginBottom: 8,
  },
  unsavedModalSecondaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  unsavedModalDangerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  unsavedModalDangerBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#EF4444",
  },

  /* Slide-Up Submit Attendance Bottom Sheet */
  bottomSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bottomSheetBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  bottomSheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: "88%",
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
  },
  bottomSheetHandleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  bottomSheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
  },
  bottomSheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  bottomSheetSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  bottomSheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  bottomSheetScroll: {
    maxHeight: 460,
  },
  bottomSheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  sheetSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  sheetSummaryCol: {
    flex: 1,
    alignItems: "center",
  },
  sheetSummaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E2E8F0",
  },
  sheetSummaryLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 2,
  },
  sheetSummaryVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  sheetSummaryValAccent: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2563EB",
  },
  allocationSection: {
    gap: 12,
  },
  allocationSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  allocationModeList: {
    gap: 8,
  },
  allocationModeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
  },
  allocationModeCardActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  allocationRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  allocationRadioOuterActive: {
    borderColor: "#2563EB",
  },
  allocationRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  allocationModeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  allocationModeSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  payorsListBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 12,
    marginTop: 4,
  },
  payorsListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  payorsListHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  unitToggleWrap: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    padding: 2,
  },
  unitToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  unitToggleBtnActive: {
    backgroundColor: "#2563EB",
  },
  unitToggleBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  unitToggleBtnTextActive: {
    color: "#FFFFFF",
  },
  payorOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    borderRadius: 12,
  },
  payorOptionRowSelected: {
    backgroundColor: "#EFF6FF",
  },
  payorMiniAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  payorMiniAvatarText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  payorRowName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  payorRowSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  payorRowAmount: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2563EB",
  },
  customSplitInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 36,
    minWidth: 88,
  },
  customSplitUnitPrefix: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    marginHorizontal: 2,
  },
  customSplitInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "right",
    paddingVertical: 4,
    minWidth: 50,
  },
  customSplitFooter: {
    marginTop: 10,
    paddingTop: 6,
  },
  customSplitTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  customSplitTotalLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  distributeEquallyBtn: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  distributeEquallyBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },
  customSplitErrorText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EF4444",
    marginTop: 4,
  },
  payorConfirmInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
  },
  payorConfirmInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
  },
  bottomSheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginBottom: 24,
  },
  sheetKeepEditingBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetKeepEditingBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
  },
  sheetConfirmSubmitBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#2563EB",
  },
  sheetConfirmSubmitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
