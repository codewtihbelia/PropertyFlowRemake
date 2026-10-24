import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  mobileDataService,
  MobileExpense,
  isPayorMember,
  cleanBillTitle,
  buildRealNotificationsList,
  isNotificationItemUnread,
  isCyclePaymentsLocked,
  computeCycleWaterBreakdown,
  computeFairSplitShareCentavos,
  matchesMemberUid,
  evaluateHouseholdCycleSettlements,
} from "../services/firebaseDataService";
import { auth } from "../firebase/config";
import { formatPesos } from "@propertyflow/shared";
import { useNavVisibility } from "../context/NavVisibilityContext";
import {
  UniversalLoader,
  UniversalSkeleton,
} from "../components/UniversalLoader";
import { Ionicons, Feather } from "@expo/vector-icons";
import { getCategoryMeta } from "../services/categoryService";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { GlobalAnnouncementBannerModal } from "../components/GlobalAnnoucementBannerModal";
import { useTheme } from "../context/ThemeContext";
import { walletService } from "../services/walletService";
import { LinearGradient } from "expo-linear-gradient";

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
  householdId?: string;
  onOpenAddExpense?: () => void;
  onOpenSettleDues?: () => void;
  onOpenExpenseHistory?: () => void;
  onOpenViewGroup?: () => void;
  onOpenManageGroup?: (mode?: "details" | "create" | "join") => void;
  onOpenReports?: () => void;
  onOpenHostApplication?: () => void;
  onOpenNotifications?: () => void;
  currentUser?: { name: string; avatar: string };
}

/**
 * Parses date strings (ISO, YYYY-MM-DD, MM/DD/YYYY, or readable string) or Timestamps to midnight Date
 */
function parseDateToMidnight(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (typeof dateVal?.toDate === "function") {
    const d = dateVal.toDate();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (typeof dateVal?.seconds === "number") {
    const d = new Date(dateVal.seconds * 1000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (typeof dateVal === "number") {
    const d = new Date(dateVal);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (typeof dateVal === "string") {
    const trimmed = dateVal.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return new Date(
        parseInt(isoMatch[1], 10),
        parseInt(isoMatch[2], 10) - 1,
        parseInt(isoMatch[3], 10),
      );
    }
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      return new Date(
        parseInt(slashMatch[3], 10),
        parseInt(slashMatch[1], 10) - 1,
        parseInt(slashMatch[2], 10),
      );
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate(),
      );
    }
  }
  return null;
}

/**
 * Calculates due status badge:
 * - Red ("Pay now"): due today or overdue (diffDays <= 0)
 * - Orange ("Due soon"): due in 1 to 3 days (1 <= diffDays <= 3)
 * - Green ("Due later" / "Due in Xd"): far due (diffDays > 3)
 */
export function getBillDueStatus(
  bill: any,
  activeCycle?: any,
  cycles?: any[],
  isDark?: boolean,
): {
  status: "pay_now" | "due_soon" | "due_far";
  label: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  diffDays: number;
} {
  const raw = bill?.rawExpense || {};
  let dueObj: Date | null = null;

  // 1. Direct dueDate on the expense or bill object
  const directDueDate = bill?.dueDate || raw?.dueDate || raw?.due_date;
  if (directDueDate) {
    dueObj = parseDateToMidnight(directDueDate);
  }

  // 2. Billing cycle associated with the expense
  const cycleId = bill?.billingCycleId || raw?.billingCycleId;
  if (!dueObj && cycleId && Array.isArray(cycles)) {
    const linkedCycle = cycles.find((c) => c.billingCycleId === cycleId);
    if (linkedCycle) {
      dueObj = parseDateToMidnight(linkedCycle.dueDate || linkedCycle.endDate);
    }
  }

  // 3. Fallback to activeCycle dueDate or endDate
  if (!dueObj && activeCycle) {
    dueObj = parseDateToMidnight(activeCycle.dueDate || activeCycle.endDate);
  }

  // 4. Fallback to expense date if it represents a future target
  if (!dueObj && (bill?.date || raw?.date)) {
    const expDate = parseDateToMidnight(bill?.date || raw?.date);
    if (expDate) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (expDate.getTime() > today.getTime()) {
        dueObj = expDate;
      }
    }
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let diffDays = 0;
  if (dueObj) {
    const diffMs = dueObj.getTime() - today.getTime();
    diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  } else {
    // If no due date could be found, treat as due now
    diffDays = 0;
  }

  if (diffDays <= 0) {
    // Red: Due now / overdue -> "Pay now"
    return {
      status: "pay_now",
      label: "Pay now",
      badgeBg: isDark ? "rgba(239, 68, 68, 0.16)" : "#FEE2E2",
      badgeBorder: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA",
      textColor: isDark ? "#F87171" : "#DC2626",
      diffDays,
    };
  } else if (diffDays <= 3) {
    // Orange: Due soon (1-3 days away)
    return {
      status: "due_soon",
      label: "Due soon",
      badgeBg: isDark ? "rgba(245, 158, 11, 0.16)" : "#FEF3C7",
      badgeBorder: isDark ? "rgba(245, 158, 11, 0.3)" : "#FDE68A",
      textColor: isDark ? "#FBBF24" : "#D97706",
      diffDays,
    };
  } else {
    // Green: Far (4+ days away)
    return {
      status: "due_far",
      label: diffDays <= 7 ? `Due in ${diffDays}d` : "Due later",
      badgeBg: isDark ? "rgba(16, 185, 129, 0.16)" : "#DCFCE7",
      badgeBorder: isDark ? "rgba(16, 185, 129, 0.3)" : "#BBF7D0",
      textColor: isDark ? "#34D399" : "#16A34A",
      diffDays,
    };
  }
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  householdId: propHouseholdId,
  onOpenAddExpense,
  onOpenSettleDues,
  onOpenExpenseHistory,
  onOpenViewGroup,
  onOpenManageGroup,
  onOpenReports,
  onOpenHostApplication,
  onOpenNotifications,
  currentUser = { name: "Resident", avatar: "R" },
}) => {
  const { isDark, toggleTheme, cycleTheme, themeMode, colors } = useTheme();
  const firebaseUser = auth.currentUser;
  const cachedInitialProfile = mobileDataService.getCachedProfile(
    firebaseUser?.uid,
  );
  const cachedInitialHousehold = cachedInitialProfile
    ? mobileDataService.getCachedHousehold()
    : null;
  const [profile, setProfile] = useState<any | null>(
    () => cachedInitialProfile,
  );
  const [household, setHousehold] = useState<any | null>(
    () => cachedInitialHousehold,
  );
  const householdId =
    propHouseholdId ||
    profile?.householdId ||
    household?.householdId ||
    cachedInitialProfile?.householdId ||
    "";
  const [isProfileLoaded, setIsProfileLoaded] = useState<boolean>(() =>
    Boolean(cachedInitialProfile || propHouseholdId),
  );
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [allMemberBills, setAllMemberBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [cycleAttendance, setCycleAttendance] = useState<any[]>([]);
  const [attendanceSubmissions, setAttendanceSubmissions] = useState<
    Record<string, any>
  >({});
  const [expandedWaterBills, setExpandedWaterBills] = useState<
    Record<string, boolean>
  >({});
  const [selectedSettledExpense, setSelectedSettledExpense] = useState<
    any | null
  >(null);
  const [showActivitiesModal, setShowActivitiesModal] =
    useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [showHostRequiredModal, setShowHostRequiredModal] =
    useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>("");
  const [joinLoading, setJoinLoading] = useState<boolean>(false);
  const [cloudNotifications, setCloudNotifications] = useState<any[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<
    Record<string, boolean>
  >(() => mobileDataService.getCachedReadNotifications(firebaseUser?.uid));
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Rotating animated border for Splitzy Wallet Quick Widget
  const walletBorderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(walletBorderAnim, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [walletBorderAnim]);

  const walletBorderRotate = walletBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    const unsub = walletService.listenToWallet(uid, (w) => {
      if (w?.balance !== undefined) setWalletBalance(w.balance);
    });
    return unsub;
  }, [firebaseUser?.uid]);

  const activeCycle =
    cycles.find((c) => c.status === "ACTIVE" || c.status === "FINALIZED") ||
    cycles[0];
  const oldestCycleId =
    cycles.length > 0 ? cycles[cycles.length - 1]?.billingCycleId : undefined;
  const activeCycleExpenses = useMemo(() => {
    if (!activeCycle?.billingCycleId) return expenses;
    return expenses.filter(
      (e) =>
        e.billingCycleId === activeCycle.billingCycleId ||
        (!e.billingCycleId &&
          (cycles.length <= 1 || activeCycle.billingCycleId === oldestCycleId)),
    );
  }, [expenses, activeCycle?.billingCycleId, cycles.length, oldestCycleId]);
  const memberBills = useMemo(() => {
    if (!activeCycle?.billingCycleId) return allMemberBills;
    return allMemberBills.filter(
      (b) => b.billingCycleId === activeCycle.billingCycleId,
    );
  }, [allMemberBills, activeCycle?.billingCycleId]);
  const myBill = memberBills.find((bill) => bill.userId === firebaseUser?.uid);
  const totalExpenses = activeCycleExpenses.reduce(
    (sum, expense) => sum + expense.amountCents,
    0,
  );
  const { onScroll } = useNavVisibility();
  const insets = useSafeAreaInsets();
  const isHost = Boolean(
    profile?.role === "HOST" ||
    profile?.role === "SUPER_ADMIN" ||
    profile?.hostApplicationStatus === "APPROVED" ||
    (household?.hostId &&
      firebaseUser?.uid &&
      household.hostId === firebaseUser.uid),
  );
  const hasGroup = Boolean(household?.householdId || profile?.householdId);

  const handleOpenGroupView = () => {
    if (isHost) {
      if (onOpenManageGroup) {
        onOpenManageGroup("details");
      } else {
        onNavigate("groups");
      }
    } else {
      if (onOpenViewGroup) {
        onOpenViewGroup();
      } else {
        onNavigate("groups");
      }
    }
  };

  const handleCreateGroupPress = () => {
    if (!isHost) {
      setShowHostRequiredModal(true);
      return;
    }
    if (onOpenManageGroup) {
      onOpenManageGroup("create");
    } else {
      onNavigate("manage_group");
    }
  };

  const fadeAnim = useRef(
    new Animated.Value(cachedInitialProfile ? 1 : 0),
  ).current;
  const slideAnim = useRef(
    new Animated.Value(cachedInitialProfile ? 0 : 14),
  ).current;

  // Fallback timer for loading screen so UI never hangs indefinitely
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialLoading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [initialLoading]);

  useEffect(() => {
    const uid = firebaseUser?.uid;
    const unsubRead = mobileDataService.listenToReadNotificationIds(
      uid,
      setReadNotificationIds,
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

  useEffect(() => {
    let mounted = true;
    if (!firebaseUser?.uid) {
      setIsProfileLoaded(true);
      setInitialLoading(false);
      return;
    }
    mobileDataService
      .getUserProfile(firebaseUser.uid)
      .then((nextProfile) => {
        if (mounted) {
          setProfile(nextProfile);
          setIsProfileLoaded(true);
          if (!nextProfile?.householdId) {
            setInitialLoading(false);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setIsProfileLoaded(true);
          setInitialLoading(false);
        }
      });
    const unsubProfile = mobileDataService.listenToUserProfile(
      firebaseUser.uid,
      (nextProfile) => {
        if (mounted) {
          setProfile(nextProfile);
          setIsProfileLoaded(true);
          if (!nextProfile?.householdId) {
            setHousehold(null);
            setInitialLoading(false);
          }
        }
      },
    );
    return () => {
      mounted = false;
      unsubProfile();
    };
  }, [firebaseUser?.uid]);

  useEffect(() => {
    // Wait for profile resolution before deciding if user is in a household
    if (!isProfileLoaded) {
      return;
    }

    if (!householdId) {
      setHousehold(null);
      setExpenses([]);
      setCycles([]);
      setMembers([]);
      setPayments([]);
      setAllMemberBills([]);
      setCycleAttendance([]);
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);

    const readyTracker = {
      household: false,
      expenses: false,
      cycles: false,
      members: false,
    };

    const checkAllReady = () => {
      if (
        readyTracker.household &&
        readyTracker.expenses &&
        readyTracker.cycles &&
        readyTracker.members
      ) {
        setInitialLoading(false);
      }
    };

    const safetyTimer = setTimeout(() => {
      setInitialLoading(false);
    }, 2500);

    const unsubHousehold = mobileDataService.listenToHousehold(
      householdId,
      (data) => {
        setHousehold(data);
        readyTracker.household = true;
        checkAllReady();
      },
    );
    const unsubExpenses = mobileDataService.listenToExpenses(
      householdId,
      (data) => {
        setExpenses(data);
        readyTracker.expenses = true;
        checkAllReady();
      },
    );
    const unsubCycles = mobileDataService.listenToBillingCycles(
      householdId,
      (data) => {
        setCycles(data);
        readyTracker.cycles = true;
        checkAllReady();
      },
    );
    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      householdId,
      (data) => {
        setMembers(data);
        readyTracker.members = true;
        checkAllReady();
      },
    );
    const unsubPayments = mobileDataService.listenToPayments(
      householdId,
      setPayments,
    );
    const unsubWater = mobileDataService.listenToWaterConfig(
      householdId,
      setWaterConfig,
    );
    return () => {
      clearTimeout(safetyTimer);
      unsubHousehold();
      unsubExpenses();
      unsubCycles();
      unsubMembers();
      unsubPayments();
      unsubWater();
    };
  }, [householdId, isProfileLoaded]);

  useEffect(() => {
    if (!householdId) {
      setAllMemberBills([]);
      return;
    }
    return mobileDataService.listenToMemberBills(
      householdId,
      setAllMemberBills,
    );
  }, [householdId]);

  // Real-time Water Attendance for active cycle
  useEffect(() => {
    const cycleId = activeCycle?.billingCycleId;
    if (!householdId || !cycleId) {
      setCycleAttendance([]);
      setAttendanceSubmissions({});
      return;
    }
    const unsubAtt = mobileDataService.listenToHouseholdCycleAttendance(
      householdId,
      cycleId,
      setCycleAttendance,
    );
    const unsubSub = mobileDataService.listenToAttendanceSubmissions(
      householdId,
      cycleId,
      setAttendanceSubmissions,
    );
    return () => {
      unsubAtt();
      unsubSub();
    };
  }, [activeCycle?.billingCycleId, householdId]);

  const getMemberAttendanceDays = (targetUid: string): number => {
    const fromAtt = cycleAttendance.filter(
      (a) => a.userId === targetUid && a.status === "PRESENT",
    ).length;
    const fromSub = attendanceSubmissions[targetUid]?.daysPresent || 0;
    return fromAtt > 0 ? fromAtt : fromSub;
  };

  const handleJoinByCode = async () => {
    const clean = joinCodeInput.trim();
    if (!clean) {
      Alert.alert(
        "Input Required",
        "Please enter a household invite code (e.g. PF-402).",
      );
      return;
    }
    if (!firebaseUser?.uid) {
      Alert.alert(
        "Sign In Required",
        "Please sign in before joining a household.",
      );
      return;
    }

    setJoinLoading(true);
    let code = clean;
    if (code.includes("/")) {
      code = code.split("/").pop() || code;
    }

    const result = await mobileDataService.joinHouseholdByCode(code, {
      uid: firebaseUser.uid,
      displayName:
        profile?.displayName || firebaseUser.displayName || currentUser.name,
      email: firebaseUser.email || "",
      photoURL: profile?.profilePicture || firebaseUser.photoURL || "",
    });

    setJoinLoading(false);
    if (result.success) {
      setShowJoinModal(false);
      setJoinCodeInput("");
      Alert.alert(
        "Request Sent",
        `Your request to join "${result.household?.householdName || "the household"}" has been sent! The host must approve your request before you can access the group.`,
      );
    } else {
      Alert.alert(
        "Could Not Join",
        result.error || "No household found matching that code.",
      );
    }
  };

  // User display name from profile, current user, or firebase auth
  const greetingName = useMemo(() => {
    if (profile?.displayName) return profile.displayName.split(" ")[0];
    if (profile?.fullName) return profile.fullName.split(" ")[0];
    if (
      currentUser?.name &&
      currentUser.name !== "Resident" &&
      currentUser.name !== "Member" &&
      currentUser.name !== "Arafat"
    ) {
      return currentUser.name.split(" ")[0];
    }
    if (firebaseUser?.displayName)
      return firebaseUser.displayName.split(" ")[0];
    if (firebaseUser?.email) return firebaseUser.email.split("@")[0];
    return "Resident";
  }, [profile, currentUser?.name, firebaseUser]);

  // Formatted display amounts in Philippine Pesos (₱)
  const group1TotalDisplay =
    totalExpenses > 0 ? formatPesos(totalExpenses) : "₱0.00";
  const group1Title =
    household?.householdName ||
    household?.name ||
    profile?.householdName ||
    profile?.apartmentName ||
    (hasGroup ? "My Household" : "Create a Group");
  const group1Subtitle = hasGroup
    ? `Total Expenses: ${group1TotalDisplay}`
    : "No group yet · Set up your room";

  // Outstanding update banner & calculation values
  const activeMembersList = members.filter((m) => m.status === "ACTIVE");
  const activePayorsList = activeMembersList.filter((m) => isPayorMember(m));
  const isCurrentUserPayor = isPayorMember(
    activeMembersList.find((m) => m.userId === firebaseUser?.uid),
  );
  const payorCount = Math.max(
    1,
    activePayorsList.length > 0
      ? activePayorsList.length
      : activeMembersList.length,
  );
  const isPaymentsLocked = isCyclePaymentsLocked(activeCycle, household);

  const cycleNameById = useMemo(() => {
    const map = new Map<string, string>();
    cycles.forEach((c) => {
      if (c?.billingCycleId) {
        map.set(
          String(c.billingCycleId),
          c.name || c.cycleName || "Previous Cycle",
        );
      }
    });
    return map;
  }, [cycles]);

  // Track which active payors have settled their shares for each billing cycle (active + all prior cycles)
  const cycleSettlement = useMemo(() => {
    return evaluateHouseholdCycleSettlements({
      cycles,
      expenses,
      payments,
      allMemberBills,
      members: activeMembersList,
    });
  }, [cycles, expenses, payments, allMemberBills, activeMembersList]);

  const settledPayorUidsByCycle = cycleSettlement.settledPayorUidsByCycle;

  const settledPayorUidsForActiveCycle = useMemo(() => {
    if (!activeCycle?.billingCycleId) return new Set<string>();
    return (
      settledPayorUidsByCycle.get(String(activeCycle.billingCycleId)) ||
      new Set<string>()
    );
  }, [settledPayorUidsByCycle, activeCycle?.billingCycleId]);

  // Check if all active payors have settled their shares strictly for the active cycle
  const allPayorsSettled = useMemo(() => {
    if (activePayorsList.length === 0 || activeCycleExpenses.length === 0)
      return false;
    return activePayorsList.every((p) => {
      const uid = p.userId || p.memberId || p.id;
      return Boolean(uid && settledPayorUidsForActiveCycle.has(uid));
    });
  }, [
    activePayorsList,
    activeCycleExpenses.length,
    settledPayorUidsForActiveCycle,
  ]);

  useEffect(() => {
    if (!householdId || cycles.length === 0) return;
    mobileDataService
      .reconcileStaleArrearsAndSettledCycles(householdId)
      .catch(() => {});
  }, [householdId, cycles.length, payments.length]);

  useEffect(() => {
    if (!householdId || activePayorsList.length === 0) return;
    settledPayorUidsByCycle.forEach((settledSet, cycId) => {
      const allCyclePayorsDone = activePayorsList.every((p) => {
        const uid = p.userId || p.memberId || p.id;
        return Boolean(uid && settledSet.has(uid));
      });
      if (!allCyclePayorsDone) return;
      const hasUnpaidInCycle = expenses.some(
        (e) => e.billingCycleId === cycId && (e.status !== "PAID" || !e.isPaid),
      );
      if (hasUnpaidInCycle) {
        mobileDataService
          .markExpensesPaidIfAllSettled(householdId, cycId)
          .catch(() => {});
      }
    });
  }, [settledPayorUidsByCycle, activePayorsList, expenses, householdId]);

  // Map real Firestore expenses to UI items
  const realExpensesMapped = useMemo(() => {
    return expenses.map((exp) => {
      const categoryMeta = getCategoryMeta(exp.category);
      const belongsToActiveCycle =
        !activeCycle?.billingCycleId ||
        exp.billingCycleId === activeCycle.billingCycleId ||
        (!exp.billingCycleId &&
          (cycles.length <= 1 || activeCycle.billingCycleId === oldestCycleId));

      const expCycleSettledSet = exp.billingCycleId
        ? settledPayorUidsByCycle.get(String(exp.billingCycleId))
        : belongsToActiveCycle
          ? settledPayorUidsForActiveCycle
          : undefined;

      const allExpCyclePayorsSettled =
        activePayorsList.length > 0 &&
        Boolean(expCycleSettledSet) &&
        activePayorsList.every((p) => {
          const pUid = p.userId || p.memberId || p.id;
          return Boolean(pUid && expCycleSettledSet!.has(pUid));
        });

      const isPaid =
        exp.status === "PAID" ||
        exp.isPaid === true ||
        (belongsToActiveCycle && allPayorsSettled) ||
        allExpCyclePayorsSettled;
      const formatted = isPaid
        ? `-₱${(exp.amountCents / 100).toFixed(2)}`
        : `₱${(exp.amountCents / 100).toFixed(2)}`;

      // Calculate roommate's specific share for this bill
      let myShareCents = 0;
      if (isCurrentUserPayor) {
        const isWater = (exp.category || "").toLowerCase().includes("water");
        const mySplit = exp.splitDetails?.find(
          (s: any) => s.userId === firebaseUser?.uid,
        );
        if (isWater) {
          const isPersonDayMode =
            waterConfig?.pricingModel === "PER_PERSON_DAY" ||
            !waterConfig?.pricingModel;
          if (isPersonDayMode && belongsToActiveCycle) {
            const rate = Number(
              waterConfig?.rateCentavosPerPersonPerDay ?? 500,
            );
            const { getPayorShareCentavos } = computeCycleWaterBreakdown(
              activeMembersList,
              cycleAttendance,
              attendanceSubmissions,
              rate,
              exp.splitDetails,
            );
            myShareCents = getPayorShareCentavos(firebaseUser?.uid);
          } else if (mySplit && typeof mySplit.shareCentavos === "number") {
            myShareCents = mySplit.shareCentavos;
          } else if (waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH") {
            myShareCents = waterConfig.fixedPerPersonAmountCentavos || 0;
          } else {
            myShareCents = computeFairSplitShareCentavos(
              exp.amountCents,
              activePayorsList,
              firebaseUser?.uid,
            );
          }
        } else {
          const splitPayors = exp.splitDetails
            ? exp.splitDetails.filter((s: any) => !s.isExempt)
            : [];
          const splitPayorsSum = splitPayors.reduce(
            (acc: number, s: any) => acc + (Number(s.shareCentavos) || 0),
            0,
          );
          const isSplitStale =
            (splitPayors.length > 0 && splitPayors.length !== payorCount) ||
            (splitPayors.length > 0 && splitPayorsSum !== exp.amountCents);
          myShareCents =
            !isSplitStale &&
            mySplit &&
            typeof mySplit.shareCentavos === "number"
              ? mySplit.shareCentavos
              : computeFairSplitShareCentavos(
                  exp.amountCents,
                  activePayorsList,
                  firebaseUser?.uid,
                );
        }
      }

      const displayTitle = cleanBillTitle(exp.title, exp.category, group1Title);
      const mySplitEntry = Array.isArray(exp.splitDetails)
        ? exp.splitDetails.find(
            (s: any) =>
              s.userId === firebaseUser?.uid ||
              s.memberId === firebaseUser?.uid,
          )
        : null;

      const mySharePaid =
        isCurrentUserPayor &&
        Boolean(
          isPaid ||
          mySplitEntry?.isPaid ||
          (firebaseUser?.uid && expCycleSettledSet?.has(firebaseUser.uid)),
        );

      let paidPayorsCount = 0;
      const waitingPayorNames: string[] = [];
      activePayorsList.forEach((p) => {
        const pUid = p.userId || p.memberId || p.id;
        const pSplit = Array.isArray(exp.splitDetails)
          ? exp.splitDetails.find(
              (s: any) =>
                s.userId === pUid || s.memberId === pUid || s.id === pUid,
            )
          : null;
        const isPayorPaid = Boolean(
          isPaid || pSplit?.isPaid || (pUid && expCycleSettledSet?.has(pUid)),
        );
        if (isPayorPaid) {
          paidPayorsCount += 1;
        } else {
          const firstName = (p.displayName || p.name || "Roommate").split(
            " ",
          )[0];
          waitingPayorNames.push(firstName);
        }
      });

      const waitingSummary =
        waitingPayorNames.length === 0
          ? ""
          : waitingPayorNames.length <= 2
            ? `Waiting on ${waitingPayorNames.join(", ")}`
            : `Waiting on ${waitingPayorNames.slice(0, 2).join(", ")} +${waitingPayorNames.length - 2}`;

      const groupProgressText =
        paidPayorsCount > 0 && waitingSummary
          ? `${paidPayorsCount}/${payorCount} payors settled · ${waitingSummary}`
          : waitingSummary
            ? `${paidPayorsCount}/${payorCount} payors settled · ${waitingSummary}`
            : `${paidPayorsCount}/${payorCount} payors settled`;

      const originCycleName = exp.billingCycleId
        ? cycleNameById.get(String(exp.billingCycleId)) || "Previous Cycle"
        : activeCycle?.name || "Current Cycle";

      return {
        id: exp.id,
        rawExpense: exp,
        billingCycleId: exp.billingCycleId,
        originCycleName,
        dueDate: (exp as any).dueDate || (exp as any).due_date,
        title: displayTitle,
        category: exp.category || "General",
        categoryMeta,
        date: exp.date || "Recent",
        payerName: exp.payerName || "Roommate",
        amountCents: exp.amountCents,
        amountFormatted: formatted,
        myShareCents,
        myShareFormatted: formatPesos(myShareCents),
        mySharePaid,
        paidPayorsCount,
        waitingSummary,
        groupProgressText,
        isPaid,
        status: exp.status || (isPaid ? "PAID" : "UNPAID"),
      };
    });
  }, [
    expenses,
    isCurrentUserPayor,
    payorCount,
    firebaseUser?.uid,
    group1Title,
    waterConfig,
    cycleAttendance,
    attendanceSubmissions,
    activeMembersList,
    activePayorsList,
    settledPayorUidsByCycle,
    settledPayorUidsForActiveCycle,
    allPayorsSettled,
    cycleNameById,
    activeCycle?.name,
    activeCycle?.billingCycleId,
    cycles.length,
    oldestCycleId,
  ]);

  const allDisplayExpenses = realExpensesMapped;

  // Filter expenses by search query
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return allDisplayExpenses;
    const q = searchQuery.toLowerCase();
    return allDisplayExpenses.filter(
      (exp) =>
        exp.title.toLowerCase().includes(q) ||
        exp.category.toLowerCase().includes(q) ||
        exp.payerName.toLowerCase().includes(q) ||
        (exp.rawExpense?.title &&
          exp.rawExpense.title.toLowerCase().includes(q)),
    );
  }, [allDisplayExpenses, searchQuery]);

  // Separate Overdue Bills (unpaid dues from previous closed cycles) from Upcoming Bills (active cycle)
  const overdueBills = useMemo(() => {
    if (cycles.length <= 1 || !activeCycle?.billingCycleId) return [];

    const fromPriorExpenses = filteredExpenses.filter((e) => {
      if (e.isPaid) return false;
      if (!e.billingCycleId) return false;
      return (
        e.billingCycleId !== activeCycle.billingCycleId &&
        Boolean(e.waitingSummary)
      );
    });

    const coveredPriorCycleIds = new Set(
      fromPriorExpenses.map((e) => String(e.billingCycleId || "")),
    );

    // Fallback: include any carried-over unpaid Arrears on active memberBills if no matching prior expense doc exists
    const arrearsByPriorCycle = new Map<
      string,
      {
        priorCycleId: string;
        originCycleName: string;
        totalUnpaidCents: number;
        myUnpaidCents: number;
        unpaidNames: string[];
      }
    >();

    memberBills.forEach((mb) => {
      const mUid = mb.userId;
      const memberDoc = activePayorsList.find((p) => matchesMemberUid(p, mUid));
      if (!memberDoc) return;

      const truePriorUnpaid = cycleSettlement.getPriorUnpaidArrearsBeforeCycle(
        activeCycle.billingCycleId,
        memberDoc,
      );
      if (truePriorUnpaid <= 0) return;

      const mbPaid = Number(mb.totalPaidCentavos || 0);
      let remCredit = mbPaid;
      let remainingCap = truePriorUnpaid;

      (mb.lineItems || []).forEach((li: any) => {
        if (li.isExempt || remainingCap <= 0) return;
        const isArr = Boolean(li.category === "Arrears" || li.isArrears);
        const amt = Number(li.amountCentavos) || 0;
        if (!isArr) return;
        if (li.status === "PAID" || li.isSettled) {
          if (remCredit >= amt) remCredit -= amt;
          return;
        }
        if (amt > 0 && remCredit >= amt) {
          remCredit -= amt;
          return;
        }
        const rawRemAmt = Math.max(0, amt - remCredit);
        remCredit = 0;
        const remAmt = Math.min(rawRemAmt, remainingCap);
        if (remAmt <= 0) return;

        const pCycId = String(li.priorCycleId || "prior");
        if (pCycId !== "prior") {
          const pSummary = cycleSettlement.getMemberCycleSummary(
            pCycId,
            memberDoc,
          );
          if (
            pSummary.remainingCycleCentavos <= 0 &&
            pSummary.priorUnpaidArrearsCentavos <= 0
          ) {
            return;
          }
        }
        if (coveredPriorCycleIds.has(pCycId)) return;
        remainingCap -= remAmt;

        const existing: {
          priorCycleId: string;
          originCycleName: string;
          totalUnpaidCents: number;
          myUnpaidCents: number;
          unpaidNames: string[];
        } = arrearsByPriorCycle.get(pCycId) || {
          priorCycleId: pCycId,
          originCycleName:
            cycleNameById.get(pCycId) ||
            li.description?.replace(/^Previous Balance\s*\((.*)\)$/i, "$1") ||
            "Previous Cycle",
          totalUnpaidCents: 0,
          myUnpaidCents: 0,
          unpaidNames: [] as string[],
        };
        existing.totalUnpaidCents += remAmt;
        if (
          firebaseUser?.uid &&
          matchesMemberUid(memberDoc, firebaseUser.uid)
        ) {
          existing.myUnpaidCents += remAmt;
        }
        const fName: string = String(
          memberDoc.displayName || memberDoc.name || "Roommate",
        ).split(" ")[0];
        if (!existing.unpaidNames.includes(fName)) {
          existing.unpaidNames.push(fName);
        }
        arrearsByPriorCycle.set(pCycId, existing);
      });
    });

    const fallbackArrearsBills = Array.from(arrearsByPriorCycle.values())
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.originCycleName.toLowerCase().includes(q) ||
          "overdue arrears previous balance".includes(q)
        );
      })
      .map((item) => {
        const paidCount = Math.max(0, payorCount - item.unpaidNames.length);
        const waitingSummary =
          item.unpaidNames.length <= 2
            ? `Waiting on ${item.unpaidNames.join(", ")}`
            : `Waiting on ${item.unpaidNames.slice(0, 2).join(", ")} +${item.unpaidNames.length - 2}`;
        return {
          id: `overdue_arrears_${item.priorCycleId}`,
          rawExpense: null,
          billingCycleId: item.priorCycleId,
          originCycleName: item.originCycleName,
          dueDate: undefined,
          title: `Previous Cycle Dues`,
          category: "Arrears",
          categoryMeta: {
            featherIcon: "clock",
            color: isDark ? "#F87171" : "#EF4444",
            bgColor: "#FEE2E2",
          },
          date: item.originCycleName,
          payerName: "Host",
          amountCents: item.totalUnpaidCents,
          amountFormatted: formatPesos(item.totalUnpaidCents),
          myShareCents: item.myUnpaidCents,
          myShareFormatted: formatPesos(item.myUnpaidCents),
          mySharePaid: isCurrentUserPayor && item.myUnpaidCents === 0,
          paidPayorsCount: paidCount,
          waitingSummary,
          groupProgressText: `${paidCount}/${payorCount} payors settled · ${waitingSummary}`,
          isPaid: false,
          status: "UNPAID",
        };
      });

    return [...fromPriorExpenses, ...fallbackArrearsBills];
  }, [
    cycles.length,
    activeCycle?.billingCycleId,
    filteredExpenses,
    memberBills,
    activePayorsList,
    cycleSettlement,
    cycleNameById,
    firebaseUser?.uid,
    searchQuery,
    payorCount,
    isDark,
    isCurrentUserPayor,
  ]);

  const upcomingBills = useMemo(() => {
    return filteredExpenses.filter((e) => {
      if (e.isPaid) return false;
      if (!activeCycle?.billingCycleId) return true;
      return (
        e.billingCycleId === activeCycle.billingCycleId ||
        (!e.billingCycleId &&
          (cycles.length <= 1 || activeCycle.billingCycleId === oldestCycleId))
      );
    });
  }, [
    filteredExpenses,
    activeCycle?.billingCycleId,
    cycles.length,
    oldestCycleId,
  ]);

  const settledExpenses = useMemo(() => {
    return filteredExpenses.filter((e) => e.isPaid);
  }, [filteredExpenses]);

  // Active cycle payments and balance calculation
  const activeCycleUserPaidCents = useMemo(() => {
    const isSingleCycle = cycles.length <= 1;
    const pmtsSum = payments
      .filter(
        (p) =>
          p.userId === firebaseUser?.uid &&
          p.status !== "REJECTED" &&
          (!activeCycle?.billingCycleId ||
            p.billingCycleId === activeCycle.billingCycleId ||
            ((!p.billingCycleId || p.billingCycleId === "general") &&
              isSingleCycle)),
      )
      .reduce((sum, p) => sum + (Number(p.amountCentavos) || 0), 0);
    const billPaid =
      myBill && typeof myBill.totalPaidCentavos === "number"
        ? myBill.totalPaidCentavos
        : 0;
    return Math.max(billPaid, pmtsSum);
  }, [
    payments,
    firebaseUser?.uid,
    activeCycle?.billingCycleId,
    cycles.length,
    myBill,
  ]);

  const unpaidExpenses = activeCycleExpenses.filter(
    (e) => e.status !== "PAID" && !e.isPaid,
  );

  const computeMyExpenseShareOnHome = (e: MobileExpense): number => {
    const isWater = (e.category || "").toLowerCase().includes("water");
    if (isWater) {
      const isPersonDayMode =
        waterConfig?.pricingModel === "PER_PERSON_DAY" ||
        !waterConfig?.pricingModel;
      if (isPersonDayMode) {
        const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
        const { getPayorShareCentavos } = computeCycleWaterBreakdown(
          activeMembersList,
          cycleAttendance,
          attendanceSubmissions,
          rate,
          e.splitDetails,
        );
        return getPayorShareCentavos(firebaseUser?.uid);
      } else if (waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH") {
        return waterConfig.fixedPerPersonAmountCentavos || 0;
      } else {
        return computeFairSplitShareCentavos(
          e.amountCents,
          activePayorsList,
          firebaseUser?.uid,
        );
      }
    }

    const splitPayors = e.splitDetails
      ? e.splitDetails.filter((s: any) => !s.isExempt && s.shareCentavos > 0)
      : [];
    const splitPayorsSum = splitPayors.reduce(
      (acc: number, s: any) => acc + (Number(s.shareCentavos) || 0),
      0,
    );
    const isSplitStale =
      (splitPayors.length > 0 && splitPayors.length !== payorCount) ||
      (splitPayors.length > 0 && splitPayorsSum !== e.amountCents);
    if (
      !isSplitStale &&
      e.splitDetails &&
      Array.isArray(e.splitDetails) &&
      e.splitDetails.length > 0
    ) {
      const mySplit = e.splitDetails.find(
        (s: any) => s.userId === firebaseUser?.uid,
      );
      if (mySplit && typeof mySplit.shareCentavos === "number")
        return mySplit.shareCentavos;
    }
    return computeFairSplitShareCentavos(
      e.amountCents,
      activePayorsList,
      firebaseUser?.uid,
    );
  };

  const liveShareCents = isCurrentUserPayor
    ? (activeCycleUserPaidCents > 0
        ? activeCycleExpenses
        : unpaidExpenses
      ).reduce((sum, e) => {
        if (activeCycleUserPaidCents === 0) {
          const mySplit = e.splitDetails?.find(
            (s: any) => s.userId === firebaseUser?.uid,
          );
          if (mySplit?.isPaid) return sum;
        }
        return sum + computeMyExpenseShareOnHome(e);
      }, 0)
    : 0;

  const arrearsShareCents = useMemo(() => {
    const mySummary = cycleSettlement.getMemberCycleSummary(
      activeCycle?.billingCycleId,
      firebaseUser?.uid,
    );
    if (!myBill?.lineItems || !Array.isArray(myBill.lineItems)) {
      return activeCycleUserPaidCents > 0
        ? mySummary.priorUnpaidArrearsCentavos +
            mySummary.settledArrearsInCycleCentavos
        : mySummary.priorUnpaidArrearsCentavos;
    }
    const rawArrears = myBill.lineItems
      .filter((li: any) => {
        if (!(li.category === "Arrears" || li.isArrears) || li.isExempt) {
          return false;
        }
        if (li.status === "PAID" || li.isSettled) {
          return activeCycleUserPaidCents > 0;
        }
        return mySummary.priorUnpaidArrearsCentavos > 0;
      })
      .reduce((sum: number, li: any) => sum + (li.amountCentavos || 0), 0);

    if (activeCycleUserPaidCents === 0) {
      return Math.min(rawArrears, mySummary.priorUnpaidArrearsCentavos);
    }
    return rawArrears;
  }, [
    myBill,
    activeCycleUserPaidCents,
    cycleSettlement,
    activeCycle?.billingCycleId,
    firebaseUser?.uid,
  ]);

  const paidCentavos = activeCycleUserPaidCents;
  const totalUserShareCents = liveShareCents + arrearsShareCents;
  const outstandingCents = isCurrentUserPayor
    ? Math.max(0, totalUserShareCents - paidCentavos)
    : 0;
  const outstandingAmount = !isCurrentUserPayor
    ? "₱0.00"
    : formatPesos(outstandingCents);

  // Auto-heal: If an active payor joined and unpaid splits or memberBills are out of sync with current payor count or exact centavo total, recalculate in Firestore
  useEffect(() => {
    if (!householdId || payorCount === 0 || activeCycleExpenses.length === 0)
      return;
    const hasStaleSplit = activeCycleExpenses.some((e) => {
      if (e.status === "PAID" || e.isPaid) return false;
      const isWater = (e.category || "").toLowerCase().includes("water");
      if (isWater) {
        if (
          waterConfig?.pricingModel === "PER_PERSON_DAY" ||
          !waterConfig?.pricingModel
        ) {
          if (!e.splitDetails || !Array.isArray(e.splitDetails)) return true;
          return e.splitDetails.some(
            (s: any) => !s.isExempt && s.ownWaterCentavos === undefined,
          );
        }
        return false;
      }
      const splitPayors = e.splitDetails
        ? e.splitDetails.filter((s: any) => !s.isExempt && s.shareCentavos > 0)
        : [];
      const splitPayorsSum = splitPayors.reduce(
        (acc: number, s: any) => acc + (Number(s.shareCentavos) || 0),
        0,
      );
      return (
        (splitPayors.length > 0 && splitPayors.length !== payorCount) ||
        (splitPayors.length > 0 && splitPayorsSum !== e.amountCents)
      );
    });

    const isMemberBillStale =
      myBill &&
      typeof myBill.outstandingCentavos === "number" &&
      (myBill.totalPaidCentavos || 0) === 0 &&
      Math.abs(myBill.outstandingCentavos - liveShareCents) > 100;

    if (hasStaleSplit || isMemberBillStale) {
      const timer = setTimeout(() => {
        mobileDataService
          .recalculateUnpaidExpensesForHousehold(householdId)
          .catch(() => {});
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [
    householdId,
    payorCount,
    activeCycleExpenses,
    myBill,
    liveShareCents,
    waterConfig?.pricingModel,
  ]);

  const toggleWaterBillDropdown = (billId: string) => {
    setExpandedWaterBills((prev) => ({
      ...prev,
      [billId]: !prev[billId],
    }));
  };

  const getWaterBreakdownForBill = (bill: any) => {
    const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
    const { membersBreakdown } = computeCycleWaterBreakdown(
      activeMembersList,
      cycleAttendance,
      attendanceSubmissions,
      rate,
      bill?.rawExpense?.splitDetails,
    );

    return membersBreakdown.map((item) => {
      const uid = item.userId;
      const isPayor = item.isPayor;
      const isCurrent = matchesMemberUid({ userId: uid }, firebaseUser?.uid);

      const splitEntry = Array.isArray(bill?.rawExpense?.splitDetails)
        ? bill.rawExpense.splitDetails.find((s: any) =>
            matchesMemberUid(s, uid),
          )
        : null;
      const isMemberPaid = isPayor
        ? Boolean(
            bill?.isPaid ||
            splitEntry?.isPaid ||
            (uid && settledPayorUidsForActiveCycle.has(uid)),
          )
        : true;

      return {
        userId: uid,
        displayName: item.displayName,
        role: item.role,
        daysPresent: item.daysPresent,
        rateCentavosPerDay: item.rateCentavosPerDay,
        ownWaterCentavos: item.ownWaterCentavos,
        nonPayorAbsorptionCentavos: item.nonPayorWaterCentavos,
        nonPayorWaterNotes: item.nonPayorWaterNotes,
        nonPayorAllocationSummary: item.nonPayorAllocationSummary,
        totalShareCentavos: item.shareCentavos,
        isPaid: isMemberPaid,
        isCurrentUser: isCurrent,
      };
    });
  };

  // Dynamic real activities feed combining payments and added bills
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      type: "payment" | "bill_added" | "bill_settled";
      title: string;
      desc: string;
      timestamp: string;
      dateFormatted: string;
      amountFormatted: string;
      actionText: string;
      onAction: () => void;
      icon: "check-circle" | "file-text" | "alert-circle";
      color: string;
    }> = [];

    // 1. Payments recorded in Firebase
    payments.forEach((p) => {
      const isApproved = p.status === "APPROVED";
      const isPending = p.status === "SUBMITTED" || p.status === "PENDING";
      const payerName = p.payerName || "Roommate";
      const amtStr = formatPesos(p.amountCentavos);
      const isCurrentUser = p.userId === firebaseUser?.uid;

      list.push({
        id: `pay_${p.paymentId}`,
        type: "payment",
        title: isApproved
          ? `${payerName} Settled a Payment!`
          : isCurrentUser
            ? `You Submitted a Payment!`
            : `${payerName} Made a Payment!`,
        desc: `${amtStr} via ${p.paymentMethod || "GCash / Bank"}${
          isPending && isHost
            ? " · Awaiting your verification"
            : " · Payment recorded"
        }.`,
        timestamp: p.createdDate || p.paymentDate || "",
        dateFormatted: p.paymentDate || "Recent",
        amountFormatted: amtStr,
        actionText: isHost && isPending ? "Review" : "View Payments",
        onAction: () => onNavigate("payments"),
        icon: "check-circle",
        color: "#10B981",
      });
    });

    // 2. Added Bills & Expenses in Firebase
    expenses.forEach((exp) => {
      const isPaid = exp.status === "PAID" || exp.isPaid;
      const amtStr = formatPesos(exp.amountCents);
      const payer = exp.payerName || "Host";
      const isMePayer = exp.payerId === firebaseUser?.uid;

      // Calculate my share for this bill if payor
      let myShareStr = "";
      if (isCurrentUserPayor) {
        const mySplit = exp.splitDetails?.find(
          (s: any) => s.userId === firebaseUser?.uid,
        );
        const myShareCents =
          mySplit?.shareCentavos ?? Math.round(exp.amountCents / payorCount);
        myShareStr = `Your share: ${formatPesos(myShareCents)}`;
      }

      const cleanTitle = cleanBillTitle(exp.title, exp.category, group1Title);

      if (isPaid) {
        list.push({
          id: `exp_settled_${exp.id}`,
          type: "bill_settled",
          title: `${payer} Paid ${cleanTitle}`,
          desc: `${amtStr} settled in full for the household.`,
          timestamp: exp.createdAt || exp.date || "",
          dateFormatted: exp.date || "Recent",
          amountFormatted: amtStr,
          actionText: "View History",
          onAction: () =>
            onOpenExpenseHistory ? onOpenExpenseHistory() : onNavigate("bills"),
          icon: "check-circle",
          color: "#2563EB",
        });
      } else {
        const hasDues = isCurrentUserPayor && outstandingCents > 0;
        const canSettleNow = hasDues && (!isPaymentsLocked || isHost);
        const actionLabel = canSettleNow
          ? "Settle Now"
          : isCurrentUserPayor && outstandingCents === 0
            ? "All Settled ✓"
            : "View Bill";
        list.push({
          id: `exp_new_${exp.id}`,
          type: "bill_added",
          title: isMePayer
            ? `You Added Bill: ${cleanTitle}`
            : `${payer} Added Bill: ${cleanTitle}`,
          desc: `Total: ${amtStr}${myShareStr ? ` · ${myShareStr}` : ""}${
            isCurrentUserPayor && isPaymentsLocked && !isHost
              ? " · Payments locked by host"
              : isCurrentUserPayor && outstandingCents === 0
                ? " · Paid & Settled"
                : ""
          }.`,
          timestamp: exp.createdAt || exp.date || "",
          dateFormatted: exp.date || "Recent",
          amountFormatted: amtStr,
          actionText: actionLabel,
          onAction: () => {
            if (canSettleNow && onOpenSettleDues) {
              onOpenSettleDues();
            } else if (isCurrentUserPayor && outstandingCents === 0) {
              Alert.alert(
                "All Settled ✓",
                "You have no pending dues for this billing cycle. Everything is caught up!",
                [
                  { text: "View Bills", onPress: () => onNavigate("bills") },
                  { text: "Dismiss", style: "cancel" },
                ],
              );
            } else {
              onNavigate("bills");
            }
          },
          icon: "file-text",
          color: "#D97706",
        });
      }
    });

    // Sort by timestamp newest first
    list.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return list;
  }, [
    payments,
    expenses,
    firebaseUser?.uid,
    isHost,
    isCurrentUserPayor,
    isPaymentsLocked,
    payorCount,
    outstandingCents,
    onNavigate,
    onOpenExpenseHistory,
    onOpenSettleDues,
  ]);

  const latestActivity = recentActivities[0];

  const realNotifications = useMemo(() => {
    const hhName =
      household?.householdName ||
      household?.name ||
      profile?.householdName ||
      profile?.apartmentName ||
      "Household";
    return buildRealNotificationsList({
      uid: firebaseUser?.uid,
      householdId,
      groupName: hhName,
      expenses,
      payments,
      cycles,
      cycleAttendance,
      members,
      cloudNotifications,
    });
  }, [
    firebaseUser?.uid,
    householdId,
    household?.householdName,
    household?.name,
    profile?.householdName,
    profile?.apartmentName,
    expenses,
    payments,
    cycles,
    cycleAttendance,
    members,
    cloudNotifications,
  ]);

  useEffect(() => {
    if (!firebaseUser?.uid || initialLoading || realNotifications.length === 0)
      return;
    mobileDataService
      .syncRealNotificationsToCloud(
        firebaseUser.uid,
        householdId,
        realNotifications,
        cloudNotifications,
        readNotificationIds,
      )
      .catch(() => {});
  }, [
    firebaseUser?.uid,
    householdId,
    initialLoading,
    realNotifications,
    cloudNotifications,
    readNotificationIds,
  ]);

  const hasUnreadNotifications = useMemo(() => {
    return realNotifications.some((item) =>
      isNotificationItemUnread(item, readNotificationIds, firebaseUser?.uid),
    );
  }, [realNotifications, readNotificationIds, firebaseUser?.uid]);

  const recentPayerName =
    payments.length > 0 && payments[0]?.payerName
      ? payments[0].payerName
      : expenses.length > 0 && expenses[0]?.payerName
        ? expenses[0].payerName
        : hasGroup
          ? "All settled"
          : "None";

  const bannerActivity = latestActivity || {
    id: "default",
    type: "bill_added",
    title: hasGroup
      ? "No Recent Updates"
      : isHost
        ? "Start a Household Group"
        : "Household Group",
    desc: hasGroup
      ? isHost
        ? "Add a household bill to start tracking room expenses."
        : "View your household group overview, billing cycle, and roommates."
      : isHost
        ? "Create your shared apartment group or enter an invite code."
        : "Join your household with an invite code, or apply to be a Host.",
    actionText: hasGroup
      ? isHost
        ? "Add Bills"
        : "View Group"
      : isHost
        ? "Create Group"
        : "Join / Host",
    onAction: () =>
      hasGroup
        ? isHost
          ? onOpenAddExpense
            ? onOpenAddExpense()
            : onNavigate("bills")
          : handleOpenGroupView()
        : handleCreateGroupPress(),
    icon: hasGroup ? "file-text" : isHost ? "users" : "shield",
    color: "#2563EB",
  };

  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    24,
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* Global Top-down Slide and Fade Announcement Modal */}
      <GlobalAnnouncementBannerModal
        onOpenNotifications={onOpenNotifications}
        onNavigate={onNavigate}
      />

      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        {/* Fixed Status Bar Shield & Top Bar: Splitzy Logo & Actions */}
        <View
          style={[
            styles.fixedHeaderContainer,
            {
              paddingTop: topInset + 6,
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.topBar}>
            <View style={styles.brandTitleRow}>
              <Text style={[styles.splitText, { color: colors.text }]}>
                Split
              </Text>
              <Text
                style={[styles.zyText, isDark && { color: colors.primary }]}
              >
                zy
              </Text>
            </View>
            <View style={styles.topBarActions}>
              {/* Quick 3-Mode Theme Toggle (Light -> OLED Dark -> System) */}
              <TouchableOpacity
                style={[
                  styles.iconCircleButton,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                activeOpacity={0.75}
                onPress={cycleTheme}
                accessibilityLabel={`Theme mode ${themeMode}, tap to switch`}
                accessibilityHint="Cycles between Light, OLED Dark, and System theme"
              >
                {themeMode === "light" ? (
                  <Feather name="sun" size={19} color="#D97706" />
                ) : themeMode === "dark" ? (
                  <Feather name="moon" size={19} color="#60A5FA" />
                ) : (
                  <Ionicons
                    name="phone-portrait-outline"
                    size={18}
                    color={isDark ? "#FFFFFF" : "#0F172A"}
                  />
                )}
              </TouchableOpacity>

              {/* Notification Bell with red dot shown ONLY when there are unread notifications */}
              <TouchableOpacity
                style={[
                  styles.iconCircleButton,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (onOpenNotifications) {
                    onOpenNotifications();
                  } else {
                    setShowActivitiesModal(true);
                  }
                }}
              >
                <Feather
                  name="bell"
                  size={20}
                  color={isDark ? "#FFFFFF" : "#0F172A"}
                />
                {hasUnreadNotifications && (
                  <View style={styles.notificationDot} />
                )}
              </TouchableOpacity>

              {/* Profile Avatar Image */}
              <TouchableOpacity
                style={styles.avatarButton}
                activeOpacity={0.85}
                onPress={() => onNavigate("profile")}
              >
                {profile?.profilePicture || firebaseUser?.photoURL ? (
                  <Image
                    source={{
                      uri: profile?.profilePicture || firebaseUser?.photoURL,
                    }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarInitialWrap}>
                    <Text style={styles.avatarInitialText}>
                      {(profile?.displayName || currentUser.name || "R")
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {initialLoading ? (
          <View style={{ flex: 1, paddingTop: topInset + 54 }}>
            <UniversalSkeleton type="home" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: 10,
                paddingBottom: Math.max(40, insets.bottom + 45),
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {/* Greeting Section */}
            <View style={styles.greetingSection}>
              <Text
                style={[styles.greetingTitle, isDark && { color: colors.text }]}
              >
                Hi {greetingName}!
              </Text>
              <Text
                style={[
                  styles.greetingSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Control your expenses here.
              </Text>
            </View>

            {/* Pending Request Status Notice */}
            {profile?.joinRequestStatus === "PENDING" && (
              <View
                style={[
                  styles.noticeBannerPending,
                  isDark && {
                    backgroundColor: "rgba(245, 158, 11, 0.12)",
                    borderColor: "rgba(245, 158, 11, 0.25)",
                  },
                ]}
              >
                <Feather name="clock" size={20} color="#F59E0B" />
                <View style={styles.noticeBannerTextWrap}>
                  <Text
                    style={[
                      styles.noticeBannerTitle,
                      isDark && { color: "#FBBF24" },
                    ]}
                  >
                    Join Request Pending Approval
                  </Text>
                  <Text
                    style={[
                      styles.noticeBannerSubtitle,
                      isDark && { color: "#FCD34D" },
                    ]}
                  >
                    Waiting for the host of{" "}
                    {profile.pendingHouseholdName || "the household"} to approve
                    your request.
                  </Text>
                </View>
              </View>
            )}

            {profile?.joinRequestStatus === "REJECTED" && (
              <View
                style={[
                  styles.noticeBannerRejected,
                  isDark && {
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    borderColor: "rgba(239, 68, 68, 0.25)",
                  },
                ]}
              >
                <Feather name="alert-circle" size={20} color="#EF4444" />
                <View style={styles.noticeBannerTextWrap}>
                  <Text
                    style={[
                      styles.noticeBannerRejectedTitle,
                      isDark && { color: "#F87171" },
                    ]}
                  >
                    Join Request Declined
                  </Text>
                  <Text
                    style={[
                      styles.noticeBannerRejectedSubtitle,
                      isDark && { color: "#FCA5A5" },
                    ]}
                  >
                    Reason: {profile.joinRejectionReason || "Declined by host"}.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    mobileDataService.saveUserProfile({
                      uid: firebaseUser!.uid,
                      joinRequestStatus: undefined,
                      joinRejectionReason: undefined,
                    })
                  }
                >
                  <Feather
                    name="x"
                    size={16}
                    color={isDark ? "#F87171" : "#E11D48"}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Search Bar Capsule */}
            <View
              style={[
                styles.searchBarContainer,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather
                name="search"
                size={19}
                color={isDark ? colors.textMuted : "#64748B"}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, isDark && { color: colors.text }]}
                placeholder="Search group or expenses"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name="x"
                    size={16}
                    color={isDark ? colors.textMuted : "#94A3B8"}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Splitzy Wallet Quick Widget with rotating blue-white gradient animation border */}
            <TouchableOpacity
              style={styles.walletQuickWidgetContainer}
              onPress={() => onNavigate("wallet")}
              activeOpacity={0.88}
            >
              {/* Rotating blue-white gradient animated border layer */}
              <Animated.View
                style={[
                  styles.walletRotatingGradientWrap,
                  {
                    transform: [{ rotate: walletBorderRotate }],
                  },
                ]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={[
                    "#0052FF",
                    "#FFFFFF",
                    "#38BDF8",
                    "#002D9C",
                    "#FFFFFF",
                    "#2563EB",
                    "#FFFFFF",
                    "#0052FF",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.walletRotatingGradient}
                />
              </Animated.View>

              {/* Inner container with theme-responsive background */}
              <View
                style={[
                  styles.walletQuickInner,
                  {
                    backgroundColor: isDark ? colors.card : "#FFFFFF",
                  },
                ]}
              >
                <View style={styles.walletQuickLeft}>
                  <View style={styles.walletQuickIconWrap}>
                    <Ionicons name="wallet" size={20} color="#2563EB" />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.walletQuickTitle,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Splitzy Wallet
                    </Text>
                    <Text
                      style={[
                        styles.walletQuickAmount,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      ₱
                      {walletBalance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                  </View>
                </View>

                <View style={styles.walletQuickActionWrap}>
                  <Text style={styles.walletQuickActionText}>
                    Manage & Cards
                  </Text>
                  <Feather name="chevron-right" size={16} color="#2563EB" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Recent Updates Section */}
            <View style={styles.sectionHeader}>
              <Text
                style={[styles.sectionTitle, isDark && { color: colors.text }]}
              >
                Recent Updates
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (onOpenNotifications) {
                    onOpenNotifications();
                  } else if (recentActivities.length > 0) {
                    setShowActivitiesModal(true);
                  } else if (onOpenExpenseHistory) {
                    onOpenExpenseHistory();
                  } else {
                    onNavigate("bills");
                  }
                }}
              >
                <Text
                  style={[
                    styles.viewAllText,
                    isDark && { color: colors.accent },
                  ]}
                >
                  View All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recent Updates Banner Card */}
            <View
              style={[
                styles.recentUpdateCard,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.recentUpdateTextWrap}>
                <Text
                  style={[
                    styles.recentUpdateTitle,
                    isDark && { color: colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {bannerActivity.title}
                </Text>
                <Text
                  style={[
                    styles.recentUpdateDesc,
                    isDark && { color: colors.textSecondary },
                  ]}
                  numberOfLines={2}
                >
                  {bannerActivity.desc}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.settleNowButton,
                  isDark && {
                    backgroundColor: colors.primary,
                    shadowOpacity: 0,
                    elevation: 0,
                  },
                ]}
                activeOpacity={0.85}
                onPress={bannerActivity.onAction}
              >
                <Text
                  style={[
                    styles.settleNowButtonText,
                    isDark && { color: "#FFFFFF" },
                  ]}
                >
                  {bannerActivity.actionText}
                </Text>
              </TouchableOpacity>
            </View>

            {/* My Groups Section */}
            <View style={styles.sectionHeader}>
              <Text
                style={[styles.sectionTitle, isDark && { color: colors.text }]}
              >
                My Groups
              </Text>
              <TouchableOpacity onPress={handleOpenGroupView}>
                <Text
                  style={[
                    styles.viewAllText,
                    isDark && { color: colors.accent },
                  ]}
                >
                  View All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Groups Horizontal Carousel */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupsScrollContent}
            >
              {/* Card 1: Vibrant Blue Card (Active Household) */}
              <TouchableOpacity
                style={styles.groupCardBlue}
                activeOpacity={0.92}
                onPress={() => {
                  if (hasGroup) {
                    handleOpenGroupView();
                  } else if (isHost) {
                    handleCreateGroupPress();
                  } else {
                    setShowJoinModal(true);
                  }
                }}
              >
                <Text style={styles.groupCardBlueTitle} numberOfLines={1}>
                  {group1Title}
                </Text>
                <Text style={styles.groupCardBlueSubtitle}>
                  {group1Subtitle}
                </Text>

                {/* Roommate Avatars: if no members yet, only room host is shown */}
                <View style={styles.avatarStackRow}>
                  {(() => {
                    if (!hasGroup) {
                      return (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <View
                            style={[
                              styles.stackAvatarFallback,
                              {
                                backgroundColor: "rgba(255,255,255,0.2)",
                                borderColor: "rgba(255,255,255,0.4)",
                              },
                            ]}
                          >
                            <Feather
                              name={isHost ? "plus" : "shield"}
                              size={14}
                              color="#FFFFFF"
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 11,
                              color: "rgba(255, 255, 255, 0.9)",
                              fontWeight: "600",
                            }}
                          >
                            {isHost
                              ? "Tap to create a household"
                              : "Host status required to create"}
                          </Text>
                        </View>
                      );
                    }

                    const hostId =
                      household?.hostId || (isHost ? firebaseUser?.uid : "");
                    const hostDisplayName =
                      household?.hostName ||
                      (isHost
                        ? profile?.displayName || currentUser.name
                        : "Room Host");
                    const hostPhoto = isHost
                      ? profile?.profilePicture || firebaseUser?.photoURL
                      : household?.hostPhoto ||
                        members.find((m) => m.role === "HOST")?.profilePicture;

                    const hostObj = {
                      memberId: hostId || "host",
                      displayName: hostDisplayName,
                      profilePicture: hostPhoto,
                      role: "HOST",
                    };

                    // Strictly approved, active members that are NOT the host
                    const otherActiveMembers = members.filter(
                      (m) =>
                        m.status === "ACTIVE" &&
                        m.role !== "HOST" &&
                        m.userId !== hostId &&
                        m.memberId !== hostId,
                    );

                    // If no members yet, only show room host profile!
                    if (otherActiveMembers.length === 0) {
                      return (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {hostObj.profilePicture ? (
                            <Image
                              source={{ uri: hostObj.profilePicture }}
                              style={[
                                styles.stackAvatarImage,
                                { borderColor: "#2563EB" },
                              ]}
                            />
                          ) : (
                            <View
                              style={[
                                styles.stackAvatarFallback,
                                { borderColor: "#2563EB" },
                              ]}
                            >
                              <Text style={styles.stackAvatarFallbackText}>
                                {hostObj.displayName.charAt(0).toUpperCase() ||
                                  "H"}
                              </Text>
                            </View>
                          )}
                          <Text
                            style={{
                              fontSize: 11,
                              color: "rgba(255, 255, 255, 0.9)",
                              fontWeight: "700",
                            }}
                          >
                            Host: {hostObj.displayName}
                          </Text>
                        </View>
                      );
                    }

                    // If there are approved members, show host + up to 3 members
                    const displayedList = [
                      hostObj,
                      ...otherActiveMembers.slice(0, 3),
                    ];
                    const extraRoommatesCount = Math.max(
                      0,
                      otherActiveMembers.length - 3,
                    );

                    return (
                      <>
                        {displayedList.map((m: any, idx: number) => {
                          if (m.profilePicture) {
                            return (
                              <Image
                                key={`g1-avatar-${m.memberId || m.userId || idx}`}
                                source={{ uri: m.profilePicture }}
                                style={[
                                  styles.stackAvatarImage,
                                  idx > 0 && styles.stackAvatarOverlap,
                                  { borderColor: "#2563EB" },
                                ]}
                              />
                            );
                          }
                          const initial = (
                            m.displayName ||
                            m.name ||
                            (m.role === "HOST" ? "H" : "M")
                          )
                            .charAt(0)
                            .toUpperCase();
                          return (
                            <View
                              key={`g1-avatar-${m.memberId || m.userId || idx}`}
                              style={[
                                styles.stackAvatarFallback,
                                idx > 0 && styles.stackAvatarOverlap,
                                { borderColor: "#2563EB" },
                              ]}
                            >
                              <Text style={styles.stackAvatarFallbackText}>
                                {initial}
                              </Text>
                            </View>
                          );
                        })}
                        {extraRoommatesCount > 0 && (
                          <View
                            style={[
                              styles.stackCounterBadge,
                              styles.stackAvatarOverlap,
                            ]}
                          >
                            <Text style={styles.stackCounterText}>
                              +{extraRoommatesCount}
                            </Text>
                          </View>
                        )}
                      </>
                    );
                  })()}
                </View>

                {/* Add Bills (Host) or View Group (Member) or Create/Join Button */}
                <TouchableOpacity
                  style={[
                    styles.groupCardBlueButton,
                    isDark && {
                      backgroundColor: "rgba(255, 255, 255, 0.16)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.25)",
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (hasGroup) {
                      if (isHost) {
                        if (onOpenAddExpense) onOpenAddExpense();
                        else onNavigate("bills");
                      } else {
                        handleOpenGroupView();
                      }
                    } else if (isHost) {
                      handleCreateGroupPress();
                    } else {
                      setShowJoinModal(true);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.groupCardBlueButtonText,
                      isDark && { color: "#FFFFFF" },
                    ]}
                  >
                    {hasGroup
                      ? isHost
                        ? "Add Bills"
                        : "View Group"
                      : isHost
                        ? "Create Group"
                        : "Join Household"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Card 2: Clean Join Card */}
              <TouchableOpacity
                style={[
                  styles.groupCardLight,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                activeOpacity={0.92}
                onPress={() => setShowJoinModal(true)}
              >
                <View style={styles.groupCardLightHeader}>
                  <Text
                    style={[
                      styles.groupCardLightTitle,
                      isDark && { color: colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    Join a Room
                  </Text>
                  <View
                    style={[
                      styles.groupCardLightIconWrap,
                      isDark && { backgroundColor: colors.surfaceInset },
                    ]}
                  >
                    <Feather
                      name="user-plus"
                      size={16}
                      color={isDark ? colors.text : "#0F172A"}
                    />
                  </View>
                </View>
                <Text
                  style={[
                    styles.groupCardLightSubtitle,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Have an invite code from your host?
                </Text>

                <View
                  style={[
                    styles.joinCodePillPreview,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather
                    name="hash"
                    size={13}
                    color={isDark ? colors.textSecondary : "#0F172A"}
                  />
                  <Text
                    style={[
                      styles.joinCodePillText,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Invite Code
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.groupCardLightButton,
                    isDark && { backgroundColor: colors.cardSecondary },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setShowJoinModal(true)}
                >
                  <Text
                    style={[
                      styles.groupCardLightButtonText,
                      isDark && { color: colors.accent },
                    ]}
                  >
                    Enter Code
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Card 3: Create Household Button Card */}
              <TouchableOpacity
                style={[
                  styles.groupCardAdd,
                  isDark
                    ? {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }
                    : !isHost && {
                        borderColor: "#E2E8F0",
                        backgroundColor: "#F8FAFC",
                      },
                ]}
                activeOpacity={0.85}
                onPress={handleCreateGroupPress}
              >
                <View
                  style={[
                    styles.groupCardAddIconWrap,
                    isDark && { backgroundColor: colors.surfaceInset },
                  ]}
                >
                  <Feather
                    name={isHost ? "plus" : "shield"}
                    size={22}
                    color={isDark ? colors.text : "#0F172A"}
                  />
                </View>
                <Text
                  style={[
                    styles.groupCardAddTitle,
                    isDark && { color: colors.text },
                  ]}
                >
                  Create Group
                </Text>
                <Text
                  style={[
                    styles.groupCardAddSubtitle,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  {isHost ? "Start New Household" : "Host Access Only"}
                </Text>
                {!isHost && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: isDark
                        ? "rgba(37, 99, 235, 0.15)"
                        : "#EFF6FF",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                      marginTop: 6,
                      borderWidth: 1,
                      borderColor: isDark
                        ? "rgba(37, 99, 235, 0.3)"
                        : "#BFDBFE",
                    }}
                  >
                    <Feather
                      name="lock"
                      size={10}
                      color={isDark ? colors.accent : "#2563EB"}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: isDark ? colors.accent : "#2563EB",
                      }}
                    >
                      Host Guard
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>

            {/* Overdue Bills Section (Previous Closed Cycles with Unsettled Payors) */}
            {overdueBills.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 24 }]}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={[
                        styles.sectionTitle,
                        isDark && { color: colors.text },
                      ]}
                    >
                      Overdue Bills
                    </Text>
                    <View
                      style={[
                        styles.overdueCountBadge,
                        isDark && {
                          backgroundColor: "rgba(239, 68, 68, 0.16)",
                          borderColor: "rgba(239, 68, 68, 0.35)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.overdueCountBadgeText,
                          isDark && { color: "#F87171" },
                        ]}
                      >
                        {overdueBills.length}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => onNavigate("bills")}>
                    <Text
                      style={[
                        styles.viewAllText,
                        { color: isDark ? "#F87171" : "#DC2626" },
                      ]}
                    >
                      Review Dues
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.expenseList}>
                  {overdueBills.map((bill) => {
                    const canUserPayOverdueNow =
                      isCurrentUserPayor &&
                      !bill.mySharePaid &&
                      bill.myShareCents > 0 &&
                      outstandingCents > 0;

                    return (
                      <TouchableOpacity
                        key={`overdue_${bill.id}`}
                        style={[
                          styles.upcomingBillCard,
                          styles.overdueBillCard,
                          isDark && {
                            backgroundColor: colors.card,
                            borderColor: "rgba(239, 68, 68, 0.32)",
                          },
                        ]}
                        activeOpacity={0.85}
                        onPress={() => {
                          if (
                            canUserPayOverdueNow &&
                            (!isPaymentsLocked || isHost) &&
                            onOpenSettleDues
                          ) {
                            onOpenSettleDues();
                          } else {
                            onNavigate("bills");
                          }
                        }}
                      >
                        <View
                          style={[
                            styles.upcomingBillIconContainer,
                            {
                              backgroundColor: isDark
                                ? "rgba(239, 68, 68, 0.14)"
                                : "#FEF2F2",
                            },
                          ]}
                        >
                          <Feather
                            name={bill.categoryMeta.featherIcon as any}
                            size={20}
                            color={isDark ? "#F87171" : "#DC2626"}
                          />
                        </View>

                        <View style={styles.upcomingBillDetailsWrap}>
                          <Text
                            style={[
                              styles.upcomingBillTitle,
                              isDark && { color: colors.text },
                            ]}
                            numberOfLines={2}
                          >
                            {cleanBillTitle(
                              bill.title,
                              bill.category,
                              group1Title,
                            )}
                          </Text>
                          <Text
                            style={[
                              styles.upcomingBillSubtitle,
                              isDark && { color: colors.textSecondary },
                            ]}
                            numberOfLines={2}
                          >
                            {bill.originCycleName} · {bill.groupProgressText}
                          </Text>
                          {isCurrentUserPayor && bill.myShareCents > 0 ? (
                            <Text
                              style={[
                                styles.upcomingBillShareText,
                                {
                                  fontVariant: ["tabular-nums"],
                                  color: bill.mySharePaid
                                    ? isDark
                                      ? "#34D399"
                                      : "#16A34A"
                                    : isDark
                                      ? "#F87171"
                                      : "#DC2626",
                                },
                              ]}
                            >
                              {bill.mySharePaid
                                ? `Your share: ${bill.myShareFormatted} (Paid ✓)`
                                : `Your overdue share: ${bill.myShareFormatted}`}
                            </Text>
                          ) : !isCurrentUserPayor ? (
                            <Text
                              style={[
                                styles.upcomingBillShareText,
                                {
                                  color: isDark ? colors.textMuted : "#64748B",
                                },
                              ]}
                            >
                              Exempt (Non-payor) ·{" "}
                              {bill.waitingSummary || "Awaiting payors"}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.upcomingBillRightCol}>
                          <TouchableOpacity
                            style={[
                              styles.overdueActionBtn,
                              bill.mySharePaid
                                ? {
                                    backgroundColor: isDark
                                      ? "rgba(16, 185, 129, 0.16)"
                                      : "#DCFCE7",
                                    borderColor: isDark
                                      ? "rgba(16, 185, 129, 0.35)"
                                      : "#86EFAC",
                                  }
                                : canUserPayOverdueNow
                                  ? isPaymentsLocked && !isHost
                                    ? {
                                        backgroundColor: isDark
                                          ? "rgba(245, 158, 11, 0.16)"
                                          : "#FEF3C7",
                                        borderColor: isDark
                                          ? "rgba(245, 158, 11, 0.3)"
                                          : "#FDE68A",
                                      }
                                    : {
                                        backgroundColor: isDark
                                          ? "#DC2626"
                                          : "#EF4444",
                                        borderColor: isDark
                                          ? "#EF4444"
                                          : "#DC2626",
                                      }
                                  : {
                                      backgroundColor: isDark
                                        ? "rgba(239, 68, 68, 0.14)"
                                        : "#FEF2F2",
                                      borderColor: isDark
                                        ? "rgba(239, 68, 68, 0.32)"
                                        : "#FECACA",
                                    },
                            ]}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.8}
                            onPress={() => {
                              if (
                                canUserPayOverdueNow &&
                                (!isPaymentsLocked || isHost) &&
                                onOpenSettleDues
                              ) {
                                onOpenSettleDues();
                              } else {
                                onNavigate("bills");
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.overdueActionBtnText,
                                {
                                  color: bill.mySharePaid
                                    ? isDark
                                      ? "#34D399"
                                      : "#15803D"
                                    : canUserPayOverdueNow
                                      ? isPaymentsLocked && !isHost
                                        ? isDark
                                          ? "#FBBF24"
                                          : "#B45309"
                                        : "#FFFFFF"
                                      : isDark
                                        ? "#F87171"
                                        : "#DC2626",
                                },
                              ]}
                            >
                              {bill.mySharePaid
                                ? "Your Share Paid ✓"
                                : canUserPayOverdueNow
                                  ? isPaymentsLocked && !isHost
                                    ? "Locked"
                                    : "Pay Now"
                                  : "Overdue"}
                            </Text>
                          </TouchableOpacity>

                          <View style={styles.upcomingBillAmountWrap}>
                            <Text
                              style={[
                                styles.billTotalAmountText,
                                { fontVariant: ["tabular-nums"] },
                                isDark && { color: colors.text },
                              ]}
                            >
                              {formatPesos(bill.amountCents)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Upcoming Bills Section */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    isDark && { color: colors.text },
                  ]}
                >
                  Upcoming Bills
                </Text>
                {upcomingBills.length > 0 && (
                  <View
                    style={[
                      styles.countBadge,
                      isDark && {
                        backgroundColor: colors.cardSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countBadgeText,
                        isDark && { color: colors.accent },
                      ]}
                    >
                      {upcomingBills.length}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => onNavigate("bills")}>
                <Text
                  style={[
                    styles.viewAllText,
                    isDark && { color: colors.accent },
                  ]}
                >
                  View All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Upcoming Bills List */}
            <View style={styles.expenseList}>
              {upcomingBills.length === 0 ? (
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
                    style={[
                      styles.emptyIconWrap,
                      isDark && { backgroundColor: colors.surfaceInset },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-done-circle-outline"
                      size={24}
                      color="#10B981"
                    />
                  </View>
                  <Text
                    style={[
                      styles.emptyTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {searchQuery.trim()
                      ? "No matching upcoming bills"
                      : "No upcoming bills right now"}
                  </Text>
                  <Text
                    style={[
                      styles.emptySub,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    {searchQuery.trim()
                      ? "Try searching another keyword or clear your query."
                      : hasGroup
                        ? "All household bills have been settled or none are currently pending."
                        : "Join a household above to view upcoming shared bills."}
                  </Text>
                </View>
              ) : (
                upcomingBills.map((bill) => {
                  const dueInfo = getBillDueStatus(
                    bill,
                    activeCycle,
                    cycles,
                    isDark,
                  );
                  const isWaterBill = (bill.category || "")
                    .toLowerCase()
                    .includes("water");
                  const isExpanded = Boolean(expandedWaterBills[bill.id]);
                  const waterBreakdownItems = isWaterBill
                    ? getWaterBreakdownForBill(bill)
                    : [];
                  const waterHouseholdTotal = isWaterBill
                    ? waterBreakdownItems.reduce(
                        (acc: number, it: any) =>
                          acc + (it.totalShareCentavos || 0),
                        0,
                      )
                    : bill.amountCents;
                  const effectiveHouseholdTotal =
                    waterHouseholdTotal > 0
                      ? waterHouseholdTotal
                      : bill.amountCents;

                  return (
                    <View
                      key={`bill_${bill.id}`}
                      style={
                        isWaterBill
                          ? [
                              styles.waterUpcomingCardWrapper,
                              isDark && {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                              },
                            ]
                          : undefined
                      }
                    >
                      <TouchableOpacity
                        style={[
                          styles.upcomingBillCard,
                          isDark && {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                          isWaterBill && {
                            borderWidth: 0,
                            borderRadius: 0,
                            backgroundColor: isDark ? colors.card : "#FFFFFF",
                          },
                        ]}
                        activeOpacity={0.85}
                        onPress={() => {
                          if (
                            !bill.mySharePaid &&
                            dueInfo.status === "pay_now" &&
                            outstandingCents > 0 &&
                            (!isPaymentsLocked || isHost) &&
                            onOpenSettleDues
                          ) {
                            onOpenSettleDues();
                          } else {
                            onNavigate("bills");
                          }
                        }}
                      >
                        {/* Left Icon Container - aligned flex-start with title */}
                        <View
                          style={[
                            styles.upcomingBillIconContainer,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.06)"
                                : bill.categoryMeta.bgColor,
                            },
                          ]}
                        >
                          <Feather
                            name={bill.categoryMeta.featherIcon as any}
                            size={20}
                            color={bill.categoryMeta.color}
                          />
                        </View>

                        {/* Middle Title & Details - aligned flex-start */}
                        <View style={styles.upcomingBillDetailsWrap}>
                          <Text
                            style={[
                              styles.upcomingBillTitle,
                              isDark && { color: colors.text },
                            ]}
                            numberOfLines={2}
                          >
                            {cleanBillTitle(
                              bill.title,
                              bill.category,
                              group1Title,
                            )}
                          </Text>
                          <Text
                            style={[
                              styles.upcomingBillSubtitle,
                              isDark && { color: colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {bill.paidPayorsCount > 0
                              ? `${bill.date} · ${bill.groupProgressText}`
                              : isWaterBill
                                ? `${bill.date} · ₱${((waterConfig?.rateCentavosPerPersonPerDay ?? 500) / 100).toFixed(2)}/day attendance`
                                : `${bill.date} · Added by ${bill.payerName}`}
                          </Text>
                          {isCurrentUserPayor && bill.myShareCents > 0 ? (
                            <Text
                              style={[
                                styles.upcomingBillShareText,
                                isDark && { color: colors.accent },
                                bill.mySharePaid && {
                                  color: isDark ? "#34D399" : "#16A34A",
                                },
                              ]}
                            >
                              {bill.mySharePaid
                                ? `Your share: ${bill.myShareFormatted} (Paid ✓) · ${bill.paidPayorsCount}/${payorCount} paid`
                                : bill.paidPayorsCount > 0
                                  ? `Your share: ${bill.myShareFormatted} · ${bill.paidPayorsCount}/${payorCount} payors paid`
                                  : `Your share: ${bill.myShareFormatted}`}
                            </Text>
                          ) : !isCurrentUserPayor ? (
                            <Text
                              style={[
                                styles.upcomingBillShareText,
                                {
                                  color: isDark ? colors.textMuted : "#64748B",
                                },
                              ]}
                            >
                              Exempt (Non-payor) · {bill.paidPayorsCount}/
                              {payorCount} payors paid
                            </Text>
                          ) : null}
                        </View>

                        {/* Right Column - Dynamic Due status badge at upper-right, Amount at bottom-right */}
                        <View style={styles.upcomingBillRightCol}>
                          <TouchableOpacity
                            style={[
                              styles.dueBadge,
                              {
                                backgroundColor: bill.mySharePaid
                                  ? isDark
                                    ? "rgba(16, 185, 129, 0.16)"
                                    : "#DCFCE7"
                                  : isPaymentsLocked && !isHost
                                    ? isDark
                                      ? "rgba(245, 158, 11, 0.16)"
                                      : "#FEF3C7"
                                    : dueInfo.badgeBg,
                                borderColor: bill.mySharePaid
                                  ? isDark
                                    ? "rgba(16, 185, 129, 0.35)"
                                    : "#86EFAC"
                                  : isPaymentsLocked && !isHost
                                    ? isDark
                                      ? "rgba(245, 158, 11, 0.3)"
                                      : "#FDE68A"
                                    : dueInfo.badgeBorder,
                              },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => {
                              if (
                                !bill.mySharePaid &&
                                dueInfo.status === "pay_now" &&
                                outstandingCents > 0 &&
                                (!isPaymentsLocked || isHost) &&
                                onOpenSettleDues
                              ) {
                                onOpenSettleDues();
                              } else {
                                onNavigate("bills");
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.dueBadgeText,
                                {
                                  color: bill.mySharePaid
                                    ? isDark
                                      ? "#34D399"
                                      : "#15803D"
                                    : isPaymentsLocked && !isHost
                                      ? isDark
                                        ? "#FBBF24"
                                        : "#B45309"
                                      : dueInfo.textColor,
                                },
                              ]}
                            >
                              {bill.mySharePaid
                                ? "Your Share Paid ✓"
                                : isPaymentsLocked && !isHost
                                  ? "Locked"
                                  : dueInfo.label}
                            </Text>
                          </TouchableOpacity>
                          <View style={styles.upcomingBillAmountWrap}>
                            <Text
                              style={[
                                styles.billTotalAmountText,
                                isDark && { color: colors.text },
                              ]}
                            >
                              {isWaterBill
                                ? formatPesos(effectiveHouseholdTotal)
                                : formatPesos(bill.amountCents)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Water Bill Dropdown Button & Detailed Breakdown */}
                      {isWaterBill && (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.waterDropdownButton,
                              isDark && {
                                backgroundColor: colors.cardSecondary,
                                borderTopColor: colors.border,
                              },
                            ]}
                            activeOpacity={0.7}
                            onPress={() => toggleWaterBillDropdown(bill.id)}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <Feather
                                name="droplet"
                                size={13}
                                color={isDark ? colors.accent : "#0284C7"}
                              />
                              <Text
                                style={[
                                  styles.waterDropdownButtonText,
                                  isDark && { color: colors.accent },
                                ]}
                              >
                                {isExpanded
                                  ? "Hide Water Breakdown"
                                  : "View Water Breakdown"}
                              </Text>
                            </View>
                            <Feather
                              name={isExpanded ? "chevron-up" : "chevron-down"}
                              size={16}
                              color={isDark ? colors.accent : "#0284C7"}
                            />
                          </TouchableOpacity>

                          {isExpanded && (
                            <View
                              style={[
                                styles.waterBreakdownCard,
                                isDark && {
                                  backgroundColor: colors.surfaceInset,
                                  borderTopColor: colors.border,
                                },
                              ]}
                            >
                              <View style={styles.waterBreakdownTopRow}>
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <Feather
                                    name="users"
                                    size={14}
                                    color={isDark ? colors.accent : "#0369A1"}
                                  />
                                  <Text
                                    style={[
                                      styles.waterBreakdownTitle,
                                      isDark && { color: colors.text },
                                    ]}
                                  >
                                    Water Split Breakdown
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.waterRateTag,
                                    isDark && {
                                      backgroundColor: colors.cardSecondary,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.waterRateTagText,
                                      isDark && { color: colors.accent },
                                    ]}
                                  >
                                    ₱
                                    {(
                                      (waterConfig?.rateCentavosPerPersonPerDay ??
                                        500) / 100
                                    ).toFixed(2)}
                                    /day
                                  </Text>
                                </View>
                              </View>
                              <Text
                                style={[
                                  styles.waterBreakdownNote,
                                  isDark && { color: colors.textSecondary },
                                ]}
                              >
                                Payors pay their own water + water from
                                non-payors. Non-payors are exempt.
                              </Text>

                              <View style={styles.waterBreakdownList}>
                                {waterBreakdownItems.map((item: any) => (
                                  <View
                                    key={item.userId}
                                    style={[
                                      styles.waterBreakdownRow,
                                      isDark && {
                                        backgroundColor: colors.card,
                                        borderColor: colors.border,
                                      },
                                      item.isCurrentUser &&
                                        styles.waterBreakdownRowCurrent,
                                      item.isCurrentUser &&
                                        isDark && {
                                          backgroundColor:
                                            "rgba(59, 130, 246, 0.12)",
                                          borderColor: colors.borderHighlighted,
                                        },
                                    ]}
                                  >
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        <Text
                                          style={[
                                            styles.waterMemberName,
                                            isDark && { color: colors.text },
                                            item.isCurrentUser &&
                                              styles.waterMemberNameCurrent,
                                          ]}
                                        >
                                          {item.displayName}
                                        </Text>
                                        {item.isCurrentUser && (
                                          <View style={styles.waterYouBadge}>
                                            <Text
                                              style={styles.waterYouBadgeText}
                                            >
                                              YOU
                                            </Text>
                                          </View>
                                        )}
                                        <View
                                          style={[
                                            item.role === "NON_PAYOR"
                                              ? styles.waterNonPayorPill
                                              : item.role === "HOST"
                                                ? styles.waterHostPill
                                                : styles.waterPayorPill,
                                            isDark &&
                                              (item.role === "NON_PAYOR"
                                                ? {
                                                    backgroundColor:
                                                      "rgba(168, 85, 247, 0.18)",
                                                  }
                                                : item.role === "HOST"
                                                  ? {
                                                      backgroundColor:
                                                        "rgba(59, 130, 246, 0.18)",
                                                    }
                                                  : {
                                                      backgroundColor:
                                                        "rgba(245, 158, 11, 0.18)",
                                                    }),
                                          ]}
                                        >
                                          <Text
                                            style={
                                              item.role === "NON_PAYOR"
                                                ? styles.waterNonPayorPillText
                                                : item.role === "HOST"
                                                  ? styles.waterHostPillText
                                                  : styles.waterPayorPillText
                                            }
                                          >
                                            {item.role === "NON_PAYOR"
                                              ? "NON-PAYOR"
                                              : item.role === "HOST"
                                                ? "HOST"
                                                : "PAYOR"}
                                          </Text>
                                        </View>
                                      </View>
                                      <Text
                                        style={[
                                          styles.waterMemberMeta,
                                          isDark && {
                                            color: colors.textSecondary,
                                          },
                                        ]}
                                      >
                                        {item.daysPresent} days present
                                        {item.role === "NON_PAYOR" &&
                                        item.daysPresent > 0
                                          ? ` (₱${((item.daysPresent * (item.rateCentavosPerDay || 500)) / 100).toFixed(2)})`
                                          : ""}{" "}
                                        ·{" "}
                                        {item.role === "NON_PAYOR"
                                          ? item.nonPayorAllocationSummary ||
                                            "Exempted"
                                          : `Own: ₱${(item.ownWaterCentavos / 100).toFixed(2)}`}
                                        {item.role !== "NON_PAYOR" &&
                                          item.nonPayorAbsorptionCentavos > 0 &&
                                          (item.nonPayorWaterNotes &&
                                          item.nonPayorWaterNotes.length > 0
                                            ? ` + ${item.nonPayorWaterNotes.join(", ")}`
                                            : ` + ₱${(item.nonPayorAbsorptionCentavos / 100).toFixed(2)} non-payor split`)}
                                      </Text>
                                    </View>
                                    <View style={{ alignItems: "flex-end" }}>
                                      <Text
                                        style={[
                                          styles.waterMemberAmount,
                                          isDark && { color: colors.text },
                                          item.isCurrentUser &&
                                            styles.waterMemberAmountCurrent,
                                        ]}
                                      >
                                        {item.role === "NON_PAYOR"
                                          ? "₱0.00"
                                          : formatPesos(
                                              item.totalShareCentavos,
                                            )}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.waterMemberSub,
                                          isDark && {
                                            color: colors.textMuted,
                                          },
                                          item.role !== "NON_PAYOR" &&
                                            item.isPaid && {
                                              color: isDark
                                                ? "#34D399"
                                                : "#16A34A",
                                              fontWeight: "700",
                                            },
                                        ]}
                                      >
                                        {item.role === "NON_PAYOR"
                                          ? "Exempt"
                                          : item.isPaid
                                            ? "Paid ✓"
                                            : "Water Share"}
                                      </Text>
                                    </View>
                                  </View>
                                ))}
                              </View>

                              <View
                                style={[
                                  styles.waterBreakdownFooter,
                                  isDark && {
                                    borderTopColor: colors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.waterBreakdownFooterText,
                                    isDark && {
                                      color: colors.textSecondary,
                                    },
                                  ]}
                                >
                                  Water Total:
                                </Text>
                                <Text
                                  style={[
                                    styles.waterBreakdownFooterAmount,
                                    isDark && { color: colors.text },
                                  ]}
                                >
                                  {formatPesos(effectiveHouseholdTotal)}
                                </Text>
                              </View>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {/* Recent Expenses Section (Settled & Paid items) */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    isDark && { color: colors.text },
                  ]}
                >
                  Recent Expenses
                </Text>
                {settledExpenses.length > 0 && (
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: isDark
                          ? "rgba(16, 185, 129, 0.15)"
                          : "#DCFCE7",
                        borderColor: isDark
                          ? "rgba(16, 185, 129, 0.35)"
                          : "#86EFAC",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countBadgeText,
                        { color: isDark ? "#34D399" : "#15803D" },
                      ]}
                    >
                      {settledExpenses.length}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={onOpenExpenseHistory}>
                <Text
                  style={[
                    styles.viewAllText,
                    isDark && { color: colors.accent },
                  ]}
                >
                  View All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Settled Expense Items List */}
            <View style={styles.expenseList}>
              {settledExpenses.length === 0 ? (
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
                    style={[
                      styles.emptyIconWrap,
                      isDark && { backgroundColor: colors.surfaceInset },
                    ]}
                  >
                    <Ionicons
                      name="receipt-outline"
                      size={24}
                      color="#94A3B8"
                    />
                  </View>
                  <Text
                    style={[
                      styles.emptyTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {searchQuery.trim()
                      ? "No matching paid expenses"
                      : "No paid expenses recorded yet"}
                  </Text>
                  <Text
                    style={[
                      styles.emptySub,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    {searchQuery.trim()
                      ? "Try searching another keyword or clear your search."
                      : "Once upcoming bills are settled, they will appear here as completed expenses."}
                  </Text>
                </View>
              ) : (
                settledExpenses.map((expense) => {
                  return (
                    <TouchableOpacity
                      key={`exp_${expense.id}`}
                      style={[
                        styles.expenseItemCard,
                        isDark && {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                      activeOpacity={0.85}
                      onPress={() => setSelectedSettledExpense(expense)}
                    >
                      {/* Left Icon Container */}
                      <View
                        style={[
                          styles.expenseIconContainer,
                          {
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.06)"
                              : expense.categoryMeta.bgColor,
                          },
                        ]}
                      >
                        <Feather
                          name={expense.categoryMeta.featherIcon as any}
                          size={20}
                          color={expense.categoryMeta.color}
                        />
                      </View>

                      {/* Middle Title & Breakdown Summary */}
                      <View style={styles.expenseDetailsWrap}>
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
                              styles.expenseTitle,
                              isDark && { color: colors.text },
                            ]}
                          >
                            {expense.title}
                          </Text>
                          <View
                            style={{
                              backgroundColor: isDark
                                ? "rgba(16, 185, 129, 0.16)"
                                : "#DCFCE7",
                              borderWidth: 1,
                              borderColor: isDark
                                ? "rgba(16, 185, 129, 0.35)"
                                : "#86EFAC",
                              paddingHorizontal: 6,
                              paddingVertical: 1.5,
                              borderRadius: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 9,
                                fontWeight: "800",
                                color: isDark ? "#34D399" : "#15803D",
                              }}
                            >
                              PAID
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.expenseSubtitle,
                            isDark && { color: colors.textSecondary },
                          ]}
                        >
                          {expense.date} · Settled by group payors
                          {/* {expense.payerName || "Household"} */}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: isDark ? colors.accent : "#2563EB",
                            marginTop: 3,
                          }}
                        >
                          {isCurrentUserPayor
                            ? `Split across ${payorCount} ${payorCount === 1 ? "payor" : "payors"} · Your share: ${expense.myShareFormatted}`
                            : "Exempt (Non-payor) · Tap for breakdown"}
                        </Text>
                      </View>

                      {/* Right Amount & Breakdown Hint */}
                      <View
                        style={{
                          alignItems: "flex-end",
                          alignSelf: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={[
                            styles.expenseAmountText,
                            isDark && { color: colors.text },
                          ]}
                        >
                          {formatPesos(expense.amountCents)}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                            marginTop: 3,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "700",
                              color: isDark ? "#34D399" : "#16A34A",
                            }}
                          >
                            Breakdown
                          </Text>
                          <Feather
                            name="chevron-right"
                            size={12}
                            color={isDark ? "#34D399" : "#16A34A"}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}
      </Animated.View>

      {/* Settled Expense Breakdown Modal */}
      <SmoothBottomSheetModal
        visible={Boolean(selectedSettledExpense)}
        onClose={() => setSelectedSettledExpense(null)}
        variant="bottom-sheet"
        showChipBar={true}
        title={selectedSettledExpense?.title || "Expense Breakdown"}
        subtitle={`${selectedSettledExpense?.category || "Bill"} · ${selectedSettledExpense?.date || "Settled"}`}
        icon={
          <Feather
            name={
              (selectedSettledExpense?.categoryMeta?.featherIcon as any) ||
              "check-circle"
            }
            size={18}
            color={selectedSettledExpense?.categoryMeta?.color || "#10B981"}
          />
        }
        maxHeight="86%"
      >
        {selectedSettledExpense && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            style={{ marginTop: 4, maxHeight: 440 }}
          >
            <View
              style={{
                backgroundColor: isDark ? colors.surfaceInset : "#F0FDF4",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: isDark ? "rgba(16, 185, 129, 0.3)" : "#BBF7D0",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: isDark ? colors.textSecondary : "#15803D",
                    textTransform: "uppercase",
                  }}
                >
                  Total Settled Bill
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: isDark ? colors.text : "#0F172A",
                    marginTop: 2,
                  }}
                >
                  {formatPesos(selectedSettledExpense.amountCents || 0)}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.2)"
                    : "#DCFCE7",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Feather
                  name="check-circle"
                  size={14}
                  color={isDark ? "#34D399" : "#15803D"}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: isDark ? "#34D399" : "#15803D",
                  }}
                >
                  ALL PAID
                </Text>
              </View>
            </View>

            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: isDark ? colors.text : "#0F172A",
                marginBottom: 10,
              }}
            >
              Roommate Split Breakdown ({activeMembersList.length})
            </Text>

            <View style={{ gap: 8, marginBottom: 18 }}>
              {activeMembersList.map((m) => {
                const uid = m.userId || m.memberId;
                const isPayor = isPayorMember(m);
                const rawSplits =
                  selectedSettledExpense.rawExpense?.splitDetails || [];
                const isSettledWater = (selectedSettledExpense.category || "")
                  .toLowerCase()
                  .includes("water");
                const rawSplitsSum = Array.isArray(rawSplits)
                  ? rawSplits
                      .filter((s: any) => !s.isExempt)
                      .reduce(
                        (acc: number, s: any) =>
                          acc + (Number(s.shareCentavos) || 0),
                        0,
                      )
                  : 0;
                const isSettledSplitExact =
                  isSettledWater ||
                  rawSplitsSum === (selectedSettledExpense.amountCents || 0);
                const memberSplit = Array.isArray(rawSplits)
                  ? rawSplits.find((s: any) => s.userId === uid)
                  : null;
                const shareCents = !isPayor
                  ? 0
                  : isSettledSplitExact &&
                      memberSplit &&
                      typeof memberSplit.shareCentavos === "number"
                    ? memberSplit.shareCentavos
                    : computeFairSplitShareCentavos(
                        selectedSettledExpense.amountCents || 0,
                        activePayorsList,
                        uid,
                      );
                const mName =
                  m.displayName ||
                  m.name ||
                  (m.role === "HOST" ? "Host" : "Roommate");

                return (
                  <View
                    key={uid}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: isDark ? colors.card : "#F8FAFC",
                      borderWidth: 1,
                      borderColor: isDark ? colors.border : "#E2E8F0",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: isDark ? colors.text : "#0F172A",
                          }}
                        >
                          {mName}
                        </Text>
                        <View
                          style={{
                            backgroundColor: isPayor
                              ? isDark
                                ? "rgba(59, 130, 246, 0.16)"
                                : "#DBEAFE"
                              : isDark
                                ? "rgba(168, 85, 247, 0.16)"
                                : "#F3E8FF",
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 5,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "800",
                              color: isPayor
                                ? isDark
                                  ? "#60A5FA"
                                  : "#1D4ED8"
                                : isDark
                                  ? "#C084FC"
                                  : "#6D28D9",
                            }}
                          >
                            {m.role === "HOST"
                              ? "HOST"
                              : isPayor
                                ? "PAYOR"
                                : "NON-PAYOR"}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={{
                          fontSize: 11,
                          color: isDark ? colors.textSecondary : "#64748B",
                          marginTop: 2,
                        }}
                      >
                        {memberSplit?.note ||
                          (isPayor
                            ? `Fair share across ${payorCount} payors`
                            : "Exempted (Non-payor)")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: isDark ? colors.text : "#0F172A",
                        }}
                      >
                        {isPayor ? formatPesos(shareCents) : "Exempt"}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: isDark ? "#34D399" : "#16A34A",
                          marginTop: 1,
                        }}
                      >
                        {isPayor ? "Paid ✓" : "₱0.00"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  isDark && {
                    backgroundColor: colors.cardSecondary,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setSelectedSettledExpense(null)}
              >
                <Text
                  style={[
                    styles.modalCancelBtnText,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
              {onOpenExpenseHistory && (
                <TouchableOpacity
                  style={[
                    styles.modalSubmitBtn,
                    isDark && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => {
                    setSelectedSettledExpense(null);
                    onOpenExpenseHistory();
                  }}
                >
                  <Text style={styles.modalSubmitBtnText}>
                    Full Expense History
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        )}
      </SmoothBottomSheetModal>

      {/* Join Household with Code Modal */}
      <SmoothBottomSheetModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Join Household Group"
        subtitle="Enter invite code or group ID"
        icon={
          <Ionicons
            name="key"
            size={18}
            color={isDark ? colors.text : "#0F172A"}
          />
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
        >
          <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>
            Household Code (e.g. PF-402)
          </Text>
          <TextInput
            style={[
              styles.textInput,
              isDark && {
                backgroundColor: colors.surfaceInset,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="e.g. PF-402"
            placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            value={joinCodeInput}
            onChangeText={setJoinCodeInput}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text
            style={[
              styles.inputHint,
              isDark && { color: colors.textSecondary },
            ]}
          >
            Ask your host or roommate to check their Household settings or
            invite code.
          </Text>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              style={[
                styles.modalCancelBtn,
                isDark && {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setShowJoinModal(false)}
              disabled={joinLoading}
            >
              <Text
                style={[
                  styles.modalCancelBtnText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                isDark && { backgroundColor: colors.primary },
                joinLoading && { opacity: 0.7 },
              ]}
              onPress={handleJoinByCode}
              disabled={joinLoading}
            >
              {joinLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Join Group</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SmoothBottomSheetModal>

      {/* Recent Updates Activity Feed Modal */}
      <SmoothBottomSheetModal
        visible={showActivitiesModal}
        onClose={() => setShowActivitiesModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Recent Updates"
        subtitle="Real-time activity feed for your room"
        icon={
          <Feather
            name="activity"
            size={18}
            color={isDark ? colors.text : "#0F172A"}
          />
        }
        maxHeight="86%"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          style={{ marginTop: 6, maxHeight: 440 }}
        >
          {recentActivities.length === 0 ? (
            <View style={{ paddingVertical: 28, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 13,
                  color: isDark ? colors.textMuted : "#94A3B8",
                }}
              >
                No recent activities yet.
              </Text>
            </View>
          ) : (
            recentActivities.map((act) => (
              <TouchableOpacity
                key={act.id}
                style={[
                  styles.activityRow,
                  isDark && { borderBottomColor: colors.border },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setShowActivitiesModal(false);
                  act.onAction();
                }}
              >
                <View
                  style={[
                    styles.activityIconCircle,
                    {
                      backgroundColor: isDark
                        ? colors.surfaceInset
                        : "rgba(15, 23, 42, 0.05)",
                    },
                  ]}
                >
                  <Feather
                    name={act.icon}
                    size={16}
                    color={isDark ? colors.text : "#0F172A"}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                  <Text
                    style={[
                      styles.activityTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {act.title}
                  </Text>
                  <Text
                    style={[
                      styles.activityDesc,
                      isDark && { color: colors.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    {act.desc}
                  </Text>
                  <Text
                    style={[
                      styles.activityTime,
                      isDark && { color: colors.textMuted },
                    ]}
                  >
                    {(act as any).time ||
                      (act as any).timestamp ||
                      (act as any).dateFormatted ||
                      ""}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={16}
                  color={isDark ? colors.textMuted : "#94A3B8"}
                />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SmoothBottomSheetModal>

      {/* Host Privileges Guard Modal */}
      <SmoothBottomSheetModal
        visible={showHostRequiredModal}
        onClose={() => setShowHostRequiredModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        showCloseBtn={true}
        maxHeight="90%"
      >
        <View style={{ alignItems: "center", paddingTop: 4 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              color: isDark ? colors.text : "#0F172A",
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            Host Privileges Required
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: isDark ? colors.textSecondary : "#64748B",
              textAlign: "center",
              lineHeight: 19,
              paddingHorizontal: 8,
              marginBottom: 16,
            }}
          >
            Only verified Property Hosts can create and manage new household
            groups. Non-hosts can join an existing room with an invite code.
          </Text>

          {/* Informational Guidance Box */}
          <View
            style={{
              backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: isDark ? colors.border : "#E2E8F0",
              padding: 12,
              width: "100%",
              marginBottom: 18,
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <Feather
                name="home"
                size={16}
                color={isDark ? colors.accent : "#2563EB"}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isDark ? colors.text : "#1E293B",
                  }}
                >
                  Are you the Property Host?
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: isDark ? colors.textSecondary : "#64748B",
                    marginTop: 1,
                    lineHeight: 15,
                  }}
                >
                  Apply to get verified. Approved hosts can create household
                  groups, set rules, and split utilities.
                </Text>
              </View>
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: isDark ? colors.border : "#E2E8F0",
              }}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <Feather
                name="users"
                size={16}
                color="#10B981"
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isDark ? colors.text : "#1E293B",
                  }}
                >
                  Are you a Roommate or Tenant?
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: isDark ? colors.textSecondary : "#64748B",
                    marginTop: 1,
                    lineHeight: 15,
                  }}
                >
                  Ask your property host for your household’s invite code (e.g.
                  PF-402) to join immediately.
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={{
              width: "100%",
              backgroundColor: colors.primary,
              paddingVertical: 13,
              borderRadius: 14,
              alignItems: "center",
              marginBottom: 10,
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
            onPress={() => {
              setShowHostRequiredModal(false);
              if (onOpenHostApplication) {
                onOpenHostApplication();
              } else {
                onNavigate("profile");
              }
            }}
          >
            <Feather name="shield" size={16} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              Apply to Become a Host
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              width: "100%",
              backgroundColor: isDark ? colors.cardSecondary : "#EFF6FF",
              borderWidth: 1,
              borderColor: isDark ? colors.border : "#BFDBFE",
              paddingVertical: 13,
              borderRadius: 14,
              alignItems: "center",
              marginBottom: 8,
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
            onPress={() => {
              setShowHostRequiredModal(false);
              setShowJoinModal(true);
            }}
          >
            <Feather name="hash" size={15} color="#2563EB" />
            <Text style={{ color: "#2563EB", fontWeight: "700", fontSize: 14 }}>
              Join with Invite Code
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ paddingVertical: 8 }}
            onPress={() => setShowHostRequiredModal(false)}
          >
            <Text style={{ color: "#94A3B8", fontWeight: "600", fontSize: 13 }}>
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loaderScreenContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  // Fixed Header Shield
  fixedHeaderContainer: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
    paddingBottom: 4,
    zIndex: 50,
  },

  // Top Bar
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  splitText: {
    fontSize: 27,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: -0.8,
  },
  zyText: {
    fontSize: 27,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: -0.8,
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarInitialWrap: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Notice Banners
  noticeBannerPending: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
    gap: 12,
  },
  noticeBannerRejected: {
    backgroundColor: "#FFE4E6",
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
    gap: 12,
  },
  noticeBannerTextWrap: {
    flex: 1,
  },
  noticeBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E",
  },
  noticeBannerSubtitle: {
    fontSize: 11,
    color: "#B45309",
    marginTop: 2,
  },
  noticeBannerRejectedTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9F1239",
  },
  noticeBannerRejectedSubtitle: {
    fontSize: 11,
    color: "#BE123C",
    marginTop: 2,
  },

  // Greeting
  greetingSection: {
    marginBottom: 4,
  },
  greetingTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "400",
  },

  // Search Bar
  searchBarContainer: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
    paddingVertical: 0,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  viewAllText: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "700",
  },

  // Recent Updates Banner Card
  recentUpdateCard: {
    backgroundColor: "#DBEAFE",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  recentUpdateTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  recentUpdateTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  recentUpdateDesc: {
    fontSize: 12,
    color: "#475569",
    marginTop: 4,
    fontWeight: "500",
  },
  settleNowButton: {
    backgroundColor: "#FBBF24",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  settleNowButtonText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 12,
  },

  // Groups Section
  groupsScrollContent: {
    paddingRight: 10,
    gap: 14,
  },
  groupCardBlue: {
    width: 195,
    backgroundColor: "#2563EB",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  groupCardBlueTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  groupCardBlueSubtitle: {
    color: "#BFDBFE",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 3,
    textAlign: "center",
  },
  avatarStackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
  },
  stackAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  stackAvatarOverlap: {
    marginLeft: -8,
  },
  stackCounterBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  stackAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1D4ED8",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stackAvatarFallbackText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  stackCounterText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2563EB",
  },
  groupCardBlueButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 9,
    alignItems: "center",
    width: "100%",
  },
  groupCardBlueButtonText: {
    color: "#2563EB",
    fontWeight: "800",
    fontSize: 12,
  },

  // Group Card Light (Join Group)
  groupCardLight: {
    width: 195,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  groupCardLightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  groupCardLightIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  joinCodePillPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginVertical: 10,
  },
  joinCodePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  groupCardLightTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
  },
  groupCardLightSubtitle: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "left",
    width: "100%",
  },
  groupCardLightButton: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    paddingVertical: 9,
    alignItems: "center",
    width: "100%",
  },
  groupCardLightButtonText: {
    color: "#2563EB",
    fontWeight: "800",
    fontSize: 12,
  },

  // Group Card Add / Join
  groupCardAdd: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
  },
  groupCardAddIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  groupCardAddTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  groupCardAddSubtitle: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },

  // Recent Expenses
  expenseList: {
    gap: 12,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  emptySub: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "center",
  },
  upcomingBillCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minHeight: 86,
  },
  upcomingBillIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  upcomingBillDetailsWrap: {
    flex: 1,
    paddingRight: 8,
    justifyContent: "flex-start",
  },
  upcomingBillTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 20,
  },
  upcomingBillSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
    fontWeight: "400",
  },
  upcomingBillShareText: {
    fontSize: 11,
    color: "#2563EB",
    fontWeight: "700",
    marginTop: 4,
  },
  upcomingBillRightCol: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "stretch",
    minHeight: 58,
    paddingLeft: 4,
  },
  upcomingBillAmountWrap: {
    alignItems: "flex-end",
    marginTop: 6,
  },
  billHouseholdTotalText: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
    fontWeight: "500",
  },
  waterUpcomingCardWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    overflow: "hidden",
  },
  waterDropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#E0F2FE",
  },
  waterDropdownButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },
  waterBreakdownCard: {
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  waterBreakdownTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  waterBreakdownTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0369A1",
  },
  waterRateTag: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  waterRateTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0284C7",
  },
  waterBreakdownNote: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 10,
    lineHeight: 15,
  },
  waterBreakdownList: {
    gap: 8,
  },
  waterBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  waterBreakdownRowCurrent: {
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
  },
  waterMemberName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  waterMemberNameCurrent: {
    color: "#0369A1",
    fontWeight: "800",
  },
  waterYouBadge: {
    backgroundColor: "#0284C7",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  waterYouBadgeText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  waterPayorPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  waterPayorPillText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#B45309",
  },
  waterHostPill: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  waterHostPillText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#1E40AF",
  },
  waterNonPayorPill: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  waterNonPayorPillText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#7E22CE",
  },
  waterMemberMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  waterMemberAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  waterMemberAmountCurrent: {
    color: "#0284C7",
  },
  waterMemberSub: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 1,
  },
  waterBreakdownFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  waterBreakdownFooterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  waterBreakdownFooterAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  expenseItemCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  expenseIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
    marginRight: 14,
    marginTop: 2,
  },
  expenseDetailsWrap: {
    flex: 1,
    paddingRight: 8,
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  expenseSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
    fontWeight: "400",
  },
  expenseAmountText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  modalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 1,
  },
  inputHint: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
    lineHeight: 16,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
  modalCancelBtnText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 13,
  },
  modalSubmitBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },
  modalSubmitBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  countBadge: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },
  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dueBadgeText: {
    fontSize: 6,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  badgeUnpaid: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  badgeUnpaidText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
  },
  expenseMyShare: {
    fontSize: 11,
    color: "#2563EB",
    fontWeight: "700",
    marginTop: 2,
  },
  billTotalAmountText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  billDueLabel: {
    fontSize: 11,
    color: "#D97706",
    fontWeight: "700",
    marginTop: 2,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  activityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  activityDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  activityTime: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 3,
  },
  activityActionBtn: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  activityActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  walletQuickWidgetContainer: {
    position: "relative",
    borderRadius: 20,
    padding: 2.5,
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: "#1D4ED8",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  walletRotatingGradientWrap: {
    position: "absolute",
    width: "450%",
    height: "450%",
    top: "-175%",
    left: "-175%",
  },
  walletRotatingGradient: {
    width: "100%",
    height: "100%",
  },
  walletQuickInner: {
    position: "relative",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 17.5,
  },
  walletQuickWidget: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  walletQuickLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletQuickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#2563EB15",
    alignItems: "center",
    justifyContent: "center",
  },
  walletQuickTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  walletQuickAmount: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  walletQuickActionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2563EB10",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  walletQuickActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  overdueCountBadge: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  overdueCountBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#DC2626",
    fontVariant: ["tabular-nums"],
  },
  overdueBillCard: {
    borderColor: "#FECACA",
    backgroundColor: "#FFFFFF",
  },
  overdueActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
  },
  overdueActionBtnText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
