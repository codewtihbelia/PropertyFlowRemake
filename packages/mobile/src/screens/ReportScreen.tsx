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
  const [bills, setBills] = useState<any[]>([]);
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [cycleAttendance, setCycleAttendance] = useState<any[]>([]);
  const [attendanceSubmissions, setAttendanceSubmissions] = useState<
    Record<string, any>
  >({});
  const [userPhotosMap, setUserPhotosMap] = useState<Record<string, string>>(
    {},
  );
  const [loadingCloud, setLoadingCloud] = useState<boolean>(true);

  // Selected Period / Cycle Filter
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [selectedMonthLabel, setSelectedMonthLabel] = useState<string>("");
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Track initial auto-selection of the ACTIVE billing cycle
  const hasSelectedRealCycleRef = useRef<boolean>(false);

  // Animations for reload button and Current Summary flash highlight
  const spinAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  const triggerSummaryFlash = () => {
    flashAnim.setValue(1);
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 0.25,
        duration: 260,
        useNativeDriver: false,
      }),
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: false,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 900,
        useNativeDriver: false,
      }),
    ]).start();
  };

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

    const unsubWater = mobileDataService.listenToWaterConfig(
      resolvedHouseholdId,
      (cfg) => setWaterConfig(cfg),
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubHh();
      unsubMems();
      unsubExps();
      unsubCycles();
      unsubPays();
      unsubWater();
    };
  }, [resolvedHouseholdId]);

  // Listen to cycle-specific memberBills and attendance for the selected cycle
  useEffect(() => {
    if (
      !resolvedHouseholdId ||
      !selectedCycleId ||
      selectedCycleId.startsWith("month_")
    ) {
      setBills([]);
      setCycleAttendance([]);
      setAttendanceSubmissions({});
      return;
    }

    const unsubBills = mobileDataService.listenToMemberBills(
      resolvedHouseholdId,
      selectedCycleId,
      (nextBills: any[]) => setBills(nextBills || []),
    );

    const unsubAtt = mobileDataService.listenToHouseholdCycleAttendance(
      resolvedHouseholdId,
      selectedCycleId,
      (att: any[]) => setCycleAttendance(att || []),
    );

    const unsubSub = mobileDataService.listenToAttendanceSubmissions(
      resolvedHouseholdId,
      selectedCycleId,
      (subs: Record<string, any>) => setAttendanceSubmissions(subs || {}),
    );

    return () => {
      unsubBills();
      unsubAtt();
      unsubSub();
    };
  }, [resolvedHouseholdId, selectedCycleId]);

  // Fetch missing profile photos for members
  useEffect(() => {
    const missingUids = members
      .map((m) => m.userId || m.memberId)
      .filter((uid) => uid && !uid.startsWith("mem_") && !userPhotosMap[uid]);

    if (missingUids.length === 0) return;

    let active = true;
    Promise.all(
      missingUids.map(async (uid) => {
        try {
          const uDoc = await mobileDataService.getUserProfile(uid);
          if (uDoc && (uDoc.profilePicture || uDoc.photoURL)) {
            return { uid, photo: uDoc.profilePicture || uDoc.photoURL };
          }
        } catch {}
        return null;
      }),
    ).then((results) => {
      if (!active) return;
      const map: Record<string, string> = {};
      results.forEach((r) => {
        if (r) map[r.uid] = r.photo;
      });
      if (Object.keys(map).length > 0) {
        setUserPhotosMap((prev) => ({ ...prev, ...map }));
      }
    });

    return () => {
      active = false;
    };
  }, [members]);

  // 3. Dynamic Billing Cycles list derived strictly from household billingCycles when present
  interface PeriodOption {
    id: string;
    label: string;
    subLabel?: string;
    isCycle: boolean;
    status?: string;
    isCurrent?: boolean;
  }

  const periodOptions: PeriodOption[] = useMemo(() => {
    // When household billingCycles exist, ONLY list real billing cycles (never duplicate with synthetic calendar months)
    if (billingCycles.length > 0) {
      // Ensure ACTIVE cycle appears first (Current Cycle), followed by previous cycles
      const sorted = [...billingCycles].sort((a, b) => {
        if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
        if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
        const aTime = new Date(a.createdDate || a.startDate || 0).getTime();
        const bTime = new Date(b.createdDate || b.startDate || 0).getTime();
        return bTime - aTime;
      });

      return sorted.map((c, idx) => {
        const isCurrent = c.status === "ACTIVE" || idx === 0;
        const rawName =
          c.name ||
          (c.startDate
            ? formatMonthYear(c.startDate)
            : `Cycle ${sorted.length - idx}`);
        const subLabel = isCurrent
          ? "Current Cycle"
          : c.status === "CLOSED" || c.status === "COMPLETED"
            ? "Previous Cycle • Closed & Paid"
            : "Previous Cycle";
        return {
          id: c.billingCycleId,
          label: rawName,
          subLabel,
          isCycle: true,
          status: c.status,
          isCurrent,
        };
      });
    }

    // Fallback ONLY when household has zero billingCycles documents
    const options: PeriodOption[] = [];
    const expenseMonths = new Set<string>();
    expenses.forEach((e) => {
      if (e.date) {
        expenseMonths.add(formatMonthYear(e.date));
      }
    });

    Array.from(expenseMonths).forEach((mLabel, idx) => {
      if (!options.some((o) => o.label === mLabel)) {
        options.push({
          id: `month_${mLabel}`,
          label: mLabel,
          subLabel: idx === 0 ? "Current Summary" : "Previous Summary",
          isCycle: false,
          isCurrent: idx === 0,
        });
      }
    });

    if (options.length === 0) {
      const now = new Date();
      const label = formatMonthYear(now);
      options.push({
        id: `month_${label}`,
        label,
        subLabel: "Current Summary",
        isCycle: false,
        isCurrent: true,
      });
    }

    return options;
  }, [billingCycles, expenses]);

  // Always default to the Current (ACTIVE) Billing Cycle when billingCycles load and flash the summary
  useEffect(() => {
    if (periodOptions.length === 0) return;

    const active =
      periodOptions.find((p) => p.status === "ACTIVE") || periodOptions[0];

    if (billingCycles.length > 0 && !hasSelectedRealCycleRef.current) {
      hasSelectedRealCycleRef.current = true;
      setSelectedCycleId(active.id);
      setSelectedMonthLabel(active.label);
      triggerSummaryFlash();
      return;
    }

    if (
      !selectedCycleId ||
      !periodOptions.some((p) => p.id === selectedCycleId)
    ) {
      setSelectedCycleId(active.id);
      setSelectedMonthLabel(active.label);
      triggerSummaryFlash();
    }
  }, [periodOptions, billingCycles.length, selectedCycleId]);

  const selectedPeriodOption = useMemo(() => {
    return (
      periodOptions.find((p) => p.id === selectedCycleId) || periodOptions[0]
    );
  }, [periodOptions, selectedCycleId]);

  const selectedCycleObj = useMemo(() => {
    return billingCycles.find((c) => c.billingCycleId === selectedCycleId);
  }, [billingCycles, selectedCycleId]);

  const oldestCycleId =
    billingCycles.length > 0
      ? billingCycles[billingCycles.length - 1]?.billingCycleId
      : undefined;

  const knownCycleIds = useMemo(
    () => new Set(billingCycles.map((c) => c.billingCycleId).filter(Boolean)),
    [billingCycles],
  );

  // 4. Filter expenses matching the selected cycle (aligned with ManageGroupScreen & ViewGroupScreen)
  const filteredExpenses = useMemo(() => {
    if (!selectedCycleId && periodOptions.length === 0) return expenses;

    const currentOption = periodOptions.find((p) => p.id === selectedCycleId);
    if (!currentOption) return expenses;

    return expenses.filter((e) => {
      if (currentOption.isCycle) {
        return (
          e.billingCycleId === currentOption.id ||
          ((!e.billingCycleId || !knownCycleIds.has(e.billingCycleId)) &&
            (billingCycles.length <= 1 || currentOption.id === oldestCycleId))
        );
      } else {
        return e.date ? formatMonthYear(e.date) === currentOption.label : false;
      }
    });
  }, [
    expenses,
    selectedCycleId,
    periodOptions,
    knownCycleIds,
    billingCycles.length,
    oldestCycleId,
  ]);

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

  const getMemberAttendanceDays = (targetUid: string): number => {
    const fromAtt = cycleAttendance.filter(
      (a) => a.userId === targetUid && a.status === "PRESENT",
    ).length;
    const fromSub = attendanceSubmissions[targetUid]?.daysPresent || 0;
    return fromAtt > 0 ? fromAtt : fromSub;
  };

  const uniqueBills = useMemo(() => {
    const map = new Map<string, any>();
    bills.forEach((b) => {
      const uid = b.userId || b.billId;
      if (!map.has(uid) || b.billId?.startsWith("bill_")) {
        map.set(uid, b);
      }
    });
    return Array.from(map.values());
  }, [bills]);

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

  const isSelectedCycleClosed = useMemo(() => {
    if (selectedCycleObj) {
      const st = (selectedCycleObj.status || "").toUpperCase();
      if (
        st === "CLOSED" ||
        st === "COMPLETED" ||
        st === "ARCHIVED" ||
        selectedCycleObj.isPaid === true
      ) {
        return true;
      }
    }
    if (
      filteredExpenses.length > 0 &&
      filteredExpenses.every((e) => e.status === "PAID" || e.isPaid === true)
    ) {
      return true;
    }
    return false;
  }, [selectedCycleObj, filteredExpenses]);

  // 7. Calculate real Roommate Breakdown and Chart data
  const roommatesBreakdown: RoommateBreakdownItem[] = useMemo(() => {
    const payorCount = Math.max(1, activePayors.length);

    const computeMemberExpenseShare = (
      exp: MobileExpense,
      uid: string,
      isPayor: boolean,
    ): number => {
      if (!isPayor) return 0;

      const isWater = (exp.category || "").toLowerCase().includes("water");
      if (isWater) {
        if (
          exp.splitDetails &&
          Array.isArray(exp.splitDetails) &&
          exp.splitDetails.length > 0
        ) {
          const split = exp.splitDetails.find((s: any) => s.userId === uid);
          if (split && typeof split.shareCentavos === "number") {
            return split.shareCentavos;
          }
        }

        const isPersonDayMode =
          waterConfig?.pricingModel === "PER_PERSON_DAY" ||
          !waterConfig?.pricingModel;
        if (isPersonDayMode) {
          const memberDays = getMemberAttendanceDays(uid);
          if (
            cycleAttendance.length > 0 ||
            Object.keys(attendanceSubmissions).length > 0
          ) {
            const rate = Number(
              waterConfig?.rateCentavosPerPersonPerDay ?? 500,
            );
            const ownCost = memberDays * rate;
            const totalNonPayorWater = activeMembers
              .filter((np) => !isPayorMember(np))
              .reduce((npSum, np) => {
                const npUid = np.userId || np.memberId;
                return npSum + getMemberAttendanceDays(npUid) * rate;
              }, 0);
            const extraPerPayor =
              payorCount > 0 ? Math.round(totalNonPayorWater / payorCount) : 0;
            return ownCost + extraPerPayor;
          }
        } else if (waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH") {
          return Number(waterConfig?.fixedPerPersonAmountCentavos || 0);
        }
        return Math.round((exp.amountCents || 0) / payorCount);
      }

      if (
        exp.splitDetails &&
        Array.isArray(exp.splitDetails) &&
        exp.splitDetails.length > 0
      ) {
        const split = exp.splitDetails.find((s: any) => s.userId === uid);
        if (split && typeof split.shareCentavos === "number") {
          return split.shareCentavos;
        }
      }

      return Math.round((exp.amountCents || 0) / payorCount);
    };

    const myPhoto =
      profile?.profilePicture || profile?.photoURL || currentUser?.photoURL;

    // First pass: compute shares and payments for each active member
    const computed = activeMembers.map((m, idx) => {
      const uid = m.userId || m.memberId || "";
      const isMe = uid === currentUser?.uid;
      const isPayor = isPayorMember(m);
      const rawName = m.displayName || m.name || (isMe ? "You" : "Roommate");
      const shortName = isMe ? "You" : rawName.split(" ")[0];
      const displayName = isMe ? `${rawName} (You)` : rawName;
      const initials = rawName
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const palette = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];
      const userBill = uniqueBills.find((b) => b.userId === uid);

      let shareCentavos = 0;
      let unpaidExpensesShareCentavos = 0;

      filteredExpenses.forEach((exp) => {
        const expShare = computeMemberExpenseShare(exp, uid, isPayor);
        shareCentavos += expShare;

        const isExpPaid = exp.status === "PAID" || exp.isPaid === true;
        const mySplit =
          exp.splitDetails && Array.isArray(exp.splitDetails)
            ? exp.splitDetails.find((s: any) => s.userId === uid)
            : null;
        const isSplitPaid = mySplit?.isPaid === true;

        if (!isExpPaid && !isSplitPaid) {
          unpaidExpensesShareCentavos += expShare;
        }
      });

      // Sum confirmed payments made by this member for this cycle
      const memberPayments = payments.filter((p) => {
        if (p.userId !== uid) return false;
        const isConfirmed =
          p.status === "CONFIRMED" ||
          p.status === "COMPLETED" ||
          p.status === "APPROVED" ||
          p.status === "VERIFIED" ||
          p.status === "PAID";
        if (!isConfirmed) return false;

        if (selectedCycleId && p.billingCycleId) {
          return (
            p.billingCycleId === selectedCycleId ||
            (!knownCycleIds.has(p.billingCycleId) &&
              selectedCycleId === oldestCycleId)
          );
        }
        return selectedCycleId === oldestCycleId || billingCycles.length <= 1;
      });

      const paidFromPayments = memberPayments.reduce(
        (sum, p) => sum + (p.amountCents || Math.round((p.amount || 0) * 100)),
        0,
      );

      const paidFromBill =
        userBill && typeof userBill.totalPaidCentavos === "number"
          ? userBill.totalPaidCentavos
          : 0;

      const isBillMarkedPaid =
        userBill?.status === "PAID" ||
        (userBill &&
          typeof userBill.outstandingCentavos === "number" &&
          userBill.outstandingCentavos <= 0 &&
          (userBill.totalPaidCentavos > 0 || userBill.totalAmountCentavos > 0));

      let balanceCentavos = 0;
      let paidCentavos = 0;

      if (!isPayor || shareCentavos === 0) {
        balanceCentavos = 0;
        paidCentavos = 0;
      } else if (
        isSelectedCycleClosed ||
        isBillMarkedPaid ||
        unpaidExpensesShareCentavos <= 0
      ) {
        balanceCentavos = 0;
        paidCentavos = shareCentavos;
      } else {
        const extraPaid = Math.max(paidFromBill, paidFromPayments);
        balanceCentavos = Math.max(0, unpaidExpensesShareCentavos - extraPaid);
        paidCentavos = Math.max(0, shareCentavos - balanceCentavos);
      }

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
        statusText = `Paid ₱${(paidCentavos / 100).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} partial`;
        statusDotColor = "#F59E0B";
        settlementTag = `Owes ₱${(balanceCentavos / 100).toLocaleString(
          undefined,
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )}`;
        settlementTagColor = "#D97706";
      } else {
        statusText = "Pending payment";
        statusDotColor = "#F59E0B";
        settlementTag = `Owes ₱${(balanceCentavos / 100).toLocaleString(
          undefined,
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )}`;
        settlementTagColor = "#D97706";
      }

      const resolvedPhoto =
        (isMe && myPhoto) ||
        m.photoURL ||
        m.profilePicture ||
        userPhotosMap[uid] ||
        undefined;

      return {
        id: uid || `member_${idx}`,
        userId: uid,
        name: displayName,
        shortName,
        initials,
        photoURL: resolvedPhoto,
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
        chartHeight: 25,
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
    uniqueBills,
    waterConfig,
    cycleAttendance,
    attendanceSubmissions,
    userPhotosMap,
    profile,
    currentUser?.uid,
    isDark,
    selectedCycleId,
    isSelectedCycleClosed,
    knownCycleIds,
    oldestCycleId,
    billingCycles.length,
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

  // Select cycle helper
  const handleSelectPeriod = (opt: PeriodOption) => {
    setSelectedCycleId(opt.id);
    setSelectedMonthLabel(opt.label);
    setShowMonthModal(false);
    triggerSummaryFlash();
  };

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
      triggerSummaryFlash();
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

  const summaryHighlightBorderColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isDark ? "rgba(59, 130, 246, 0.2)" : "#E2E8F0", "#2563EB"],
  });

  const summaryHighlightBgColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isDark ? "rgba(30, 41, 59, 0.65)" : "#FFFFFF",
      isDark ? "rgba(37, 99, 235, 0.22)" : "#EFF6FF",
    ],
  });

  // Settle All handler
  const handleSettleAll = () => {
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

    if (onOpenSettleDues) {
      onOpenSettleDues();
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
  const isCurrentSelected = Boolean(selectedPeriodOption?.isCurrent);
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
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* TITLE & SUBTITLE AREA */}
          <View style={styles.titleSection}>
            <View style={styles.titleBadgeRow}>
              <Text
                style={[styles.mainTitle, isDark && { color: colors.text }]}
              >
                {isCurrentSelected
                  ? "Current Cycle Summary"
                  : "Previous Cycle Summary"}
              </Text>
              <View
                style={[
                  styles.cycleStatusBadge,
                  isCurrentSelected
                    ? styles.cycleStatusBadgeActive
                    : styles.cycleStatusBadgeClosed,
                ]}
              >
                <View
                  style={[
                    styles.cycleStatusDot,
                    {
                      backgroundColor: isCurrentSelected
                        ? "#2563EB"
                        : "#10B981",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.cycleStatusBadgeText,
                    {
                      color: isCurrentSelected ? "#2563EB" : "#059669",
                    },
                  ]}
                >
                  {isCurrentSelected
                    ? "CURRENT"
                    : isSelectedCycleClosed
                      ? "CLOSED & PAID"
                      : "PREVIOUS"}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.subTitle,
                isDark && { color: colors.textSecondary },
              ]}
            >
              {household?.householdName || household?.apartmentName
                ? `${household?.householdName || household?.apartmentName} • `
                : ""}
              {isCurrentSelected
                ? "Showing live summary for the active cycle. Tap below to browse previous summaries."
                : "Viewing archived summary for a previous billing cycle."}
            </Text>
          </View>

          {/* QUICK CYCLE SWITCHER (CURRENT SUMMARY FIRST + BROWSE PREVIOUS SUMMARIES) */}
          {periodOptions.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cycleChipsScrollContent}
              style={styles.cycleChipsScroll}
            >
              {periodOptions.map((opt, index) => {
                const isSelected = opt.id === selectedCycleId;
                const chipTag = opt.isCurrent
                  ? "Current"
                  : `Previous${periodOptions.length > 2 ? ` #${periodOptions.length - index}` : ""}`;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.cycleSwitchChip,
                      isDark && {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                      isSelected &&
                        (isDark
                          ? {
                              backgroundColor: "rgba(37, 99, 235, 0.22)",
                              borderColor: "#3B82F6",
                            }
                          : styles.cycleSwitchChipSelected),
                    ]}
                    onPress={() => handleSelectPeriod(opt)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={
                        opt.isCurrent
                          ? "flash"
                          : opt.status === "CLOSED"
                            ? "checkmark-done-circle"
                            : "time-outline"
                      }
                      size={14}
                      color={
                        isSelected
                          ? isDark
                            ? "#60A5FA"
                            : "#2563EB"
                          : opt.status === "CLOSED"
                            ? "#10B981"
                            : isDark
                              ? colors.textSecondary
                              : "#64748B"
                      }
                    />
                    <Text
                      style={[
                        styles.cycleSwitchChipText,
                        isDark && { color: colors.textSecondary },
                        isSelected &&
                          (isDark
                            ? { color: "#60A5FA", fontWeight: "800" }
                            : styles.cycleSwitchChipTextSelected),
                      ]}
                    >
                      {chipTag}: {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* TOTAL EXPENSE & CYCLE PICKER CARD (FLASHED ON LOAD / SWITCH) */}
          <Animated.View
            style={[
              styles.expenseSummaryCard,
              {
                backgroundColor: summaryHighlightBgColor,
                borderColor: summaryHighlightBorderColor,
              },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text
                style={[
                  styles.totalExpenseLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                {isCurrentSelected
                  ? "Current Cycle Total"
                  : "Cycle Total Amount"}
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
                {avgFormatted} • {filteredExpenses.length}{" "}
                {filteredExpenses.length === 1 ? "bill" : "bills"}
              </Text>
            </View>

            {/* Billing Cycle Selector Pill */}
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
                numberOfLines={1}
              >
                {selectedMonthLabel || "Current Cycle"}
              </Text>
              <Feather
                name="chevron-down"
                size={15}
                color={isDark ? colors.primary : "#2563EB"}
              />
            </TouchableOpacity>
          </Animated.View>

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
                    ? "Pending roommate dues for this cycle"
                    : isSelectedCycleClosed
                      ? "Cycle closed & all roommate shares paid"
                      : "All roommate shares verified & settled"}
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
                  !hasOutstanding && { color: "#059669" },
                  isDark && hasOutstanding && { color: colors.primary },
                ]}
              >
                {hasOutstanding ? "Settle All" : "All Settled ✓"}
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

      {/* BILLING CYCLE PICKER MODAL */}
      <SmoothBottomSheetModal
        visible={showMonthModal}
        onClose={() => setShowMonthModal(false)}
        variant="bottom-sheet"
        title="Select Billing Cycle"
        subtitle={`Showing ${periodOptions.length} household billing ${periodOptions.length === 1 ? "cycle" : "cycles"}`}
        icon={<Feather name="calendar" size={18} color="#2563EB" />}
      >
        <ScrollView
          style={styles.modalMonthList}
          contentContainerStyle={{
            paddingBottom: Math.max(30, insets.bottom + 16),
          }}
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
                onPress={() => handleSelectPeriod(opt)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
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
                    {opt.status === "ACTIVE" ? (
                      <View style={styles.activePillTag}>
                        <Text style={styles.activePillTagText}>CURRENT</Text>
                      </View>
                    ) : opt.status === "CLOSED" ||
                      opt.status === "COMPLETED" ? (
                      <View style={styles.closedPillTag}>
                        <Text style={styles.closedPillTagText}>
                          CLOSED & PAID
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {opt.subLabel ? (
                    <Text
                      style={[
                        styles.modalSubText,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      {opt.subLabel}
                    </Text>
                  ) : null}
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
        <View
          style={[
            styles.modalDetailsContent,
            { paddingBottom: Math.max(24, insets.bottom + 16) },
          ]}
        >
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
    backgroundColor: "#F8FAFC",
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
    marginBottom: 14,
  },
  titleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  cycleStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  cycleStatusBadgeActive: {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  cycleStatusBadgeClosed: {
    backgroundColor: "rgba(16, 185, 129, 0.14)",
  },
  cycleStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cycleStatusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
  },

  /* Cycle Switcher Chips */
  cycleChipsScroll: {
    marginBottom: 14,
  },
  cycleChipsScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  cycleSwitchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cycleSwitchChipSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  cycleSwitchChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#475569",
  },
  cycleSwitchChipTextSelected: {
    color: "#2563EB",
    fontWeight: "800",
  },

  /* Expense Summary Card */
  expenseSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    marginBottom: 18,
  },
  totalExpenseLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 2,
  },
  totalExpenseAmount: {
    fontSize: 30,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  avgLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 3,
  },
  monthPickerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderColor: "#DBEAFE",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    gap: 6,
    maxWidth: 155,
  },
  monthPickerText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#2563EB",
    flexShrink: 1,
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
  modalSubText: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 2,
  },
  activePillTag: {
    backgroundColor: "rgba(37, 99, 235, 0.14)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563EB",
  },
  closedPillTag: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  closedPillTagText: {
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
