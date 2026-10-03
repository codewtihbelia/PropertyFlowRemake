import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StatusBar,
  Modal,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  MobileExpense,
  cleanBillTitle,
  isPayorMember,
  isCyclePaymentsLocked,
  computeCycleWaterBreakdown,
  computeFairSplitShareCentavos,
  matchesMemberUid,
} from "../services/firebaseDataService";
import { formatPesos } from "@propertyflow/shared";
import { BILL_CATEGORIES, getCategoryMeta } from "../services/categoryService";
import { WaterSettingsModal } from "../components/WaterSettingsModal";
import { ElectricitySettingsModal } from "../components/ElectricitySettingsModal";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { ViewGroupScreen } from "./ViewGroupScreen";
import { useTheme } from "../context/ThemeContext";

export interface ManageGroupScreenProps {
  onBack: () => void;
  onOpenAddExpense?: () => void;
  onOpenSettleDues?: () => void;
  onOpenHostApplication?: () => void;
  onOpenPaymentMethodConfiguration?: () => void;
  currentUser?: {
    name: string;
    avatar: string;
    uid?: string;
    role?: string;
    email?: string;
  };
  initialView?: "details" | "edit" | "create" | "join";
}

interface Participant {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  profilePicture?: string;
  role: string;
  status: "Pending" | "Settled";
  statusDate?: string;
  owesCents: number;
  email?: string;
  phone?: string;
  waterShareCents?: number;
  waterOwnCents?: number;
  waterNonPayorCents?: number;
  waterDaysPresent?: number;
  waterAllocationSummary?: string;
}

export const ManageGroupScreen: React.FC<ManageGroupScreenProps> = ({
  onBack,
  onOpenAddExpense,
  onOpenSettleDues,
  onOpenHostApplication,
  onOpenPaymentMethodConfiguration,
  currentUser = { name: "Resident", avatar: "R" },
  initialView = "details",
}) => {
  const { isDark, colors } = useTheme();
  const [viewMode, setViewMode] = useState<
    "details" | "edit" | "create" | "success" | "join"
  >(initialView);
  const [showMenu, setShowMenu] = useState(false);
  const [showHostRequiredModal, setShowHostRequiredModal] = useState(false);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    Platform.OS === "ios" ? 44 : 20,
  );

  // Household & Profile state with cache initialization
  const cachedProfile = mobileDataService.getCachedProfile(currentUser?.uid);
  const cachedHousehold = cachedProfile
    ? mobileDataService.getCachedHousehold()
    : null;
  const [profile, setProfile] = useState<any | null>(() => cachedProfile);
  const [household, setHousehold] = useState<any | null>(() => cachedHousehold);
  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [cloudMembers, setCloudMembers] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [userPhotosMap, setUserPhotosMap] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(
    () => !cachedHousehold,
  );

  // Modals
  const [showCreateCycleModal, setShowCreateCycleModal] = useState(false);
  const [showEditCycleModal, setShowEditCycleModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showWaterSettingsModal, setShowWaterSettingsModal] = useState(false);
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [showElectricitySettingsModal, setShowElectricitySettingsModal] =
    useState(false);
  const [electricityConfig, setElectricityConfig] = useState<any | null>(null);

  // Edit & Delete Bill State (Host)
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MobileExpense | null>(
    null,
  );
  const [editExpenseTitle, setEditExpenseTitle] = useState("");
  const [editExpenseCategory, setEditExpenseCategory] = useState("Rent");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseNotes, setEditExpenseNotes] = useState("");
  const [editExpenseStatus, setEditExpenseStatus] = useState<"PAID" | "UNPAID">(
    "UNPAID",
  );
  const [editExpenseCycleId, setEditExpenseCycleId] = useState("");
  const [editExpenseSplitMethod, setEditExpenseSplitMethod] = useState<
    "Equal" | "% Custom"
  >("Equal");
  const [editExpenseSplitDetails, setEditExpenseSplitDetails] = useState<any[]>(
    [],
  );
  const [isUpdatingExpense, setIsUpdatingExpense] = useState(false);
  const [showAllBills, setShowAllBills] = useState(false);

  // Edit Cycle Form State
  const [editCycleName, setEditCycleName] = useState("");
  const [editCycleStart, setEditCycleStart] = useState("");
  const [editCycleEnd, setEditCycleEnd] = useState("");
  const [editCycleStatus, setEditCycleStatus] = useState("ACTIVE");

  // Create Cycle Form State
  const now = new Date();
  const defaultMonthName = now.toLocaleString("default", { month: "short" });
  const defaultYear = now.getFullYear();
  const [cycleNameInput, setCycleNameInput] = useState(
    `${defaultMonthName} ${defaultYear} Cycle`,
  );
  const [cycleStartInput, setCycleStartInput] = useState(
    new Date(defaultYear, now.getMonth(), 1).toISOString().slice(0, 10),
  );
  const [cycleEndInput, setCycleEndInput] = useState(
    new Date(defaultYear, now.getMonth() + 1, 0).toISOString().slice(0, 10),
  );

  // Invite Roommate Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteContact, setInviteContact] = useState("");

  // Create Group Form State
  const [groupNameInput, setGroupNameInput] = useState(
    () =>
      cachedHousehold?.householdName ||
      cachedHousehold?.apartmentName ||
      cachedProfile?.householdName ||
      "",
  );
  const [createdGroupName, setCreatedGroupName] = useState("");
  const [newMemberInput, setNewMemberInput] = useState("");
  const [addedMembers, setAddedMembers] = useState<
    Array<{ id: string; name: string; phone?: string }>
  >([]);

  // Join Group State
  const [joinLinkInput, setJoinLinkInput] = useState("");

  // Edit Group Form State
  const [editGroupName, setEditGroupName] = useState(
    () =>
      cachedHousehold?.householdName ||
      cachedHousehold?.apartmentName ||
      cachedProfile?.householdName ||
      "",
  );

  // Pending Join Requests & Reject Modal State
  const [rejectingMember, setRejectingMember] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null,
  );

  const firebaseUser = auth.currentUser;
  const householdId = profile?.householdId || household?.householdId || "";
  const isHost = Boolean(
    profile?.role === "HOST" ||
    profile?.role === "SUPER_ADMIN" ||
    profile?.hostApplicationStatus === "APPROVED" ||
    (household?.hostId &&
      firebaseUser?.uid &&
      household.hostId === firebaseUser.uid),
  );

  const handleApproveRequest = async (memberId: string) => {
    if (!householdId) return;
    try {
      setProcessingRequestId(memberId);
      const success = await mobileDataService.approveJoinRequest(
        householdId,
        memberId,
      );
      if (success) {
        Alert.alert(
          "Approved",
          "The roommate has been approved and added to the household.",
        );
      } else {
        Alert.alert("Error", "Failed to approve join request.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to approve join request.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async () => {
    if (!householdId || !rejectingMember) return;
    try {
      setProcessingRequestId(
        rejectingMember.userId || rejectingMember.memberId,
      );
      const reason = rejectReason.trim() || "Declined by room host.";
      const success = await mobileDataService.rejectJoinRequest(
        householdId,
        rejectingMember.userId || rejectingMember.memberId,
        reason,
      );
      if (success) {
        Alert.alert("Request Declined", "The join request has been declined.");
        setRejectingMember(null);
        setRejectReason("");
      } else {
        Alert.alert("Error", "Failed to decline request.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to decline request.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Fetch profile on mount
  useEffect(() => {
    let mounted = true;
    if (!firebaseUser?.uid) return;
    mobileDataService.getUserProfile(firebaseUser.uid).then((p) => {
      if (mounted) {
        if (p) {
          setProfile(p);
          const defaultApt = p.householdName || p.apartmentName || "";
          if (defaultApt) {
            setGroupNameInput((prev: string) => prev || defaultApt);
            setEditGroupName((prev: string) => prev || defaultApt);
          }
        }
        setIsInitialLoading(false);
      }
    });
    const unsubProfile = mobileDataService.listenToUserProfile(
      firebaseUser.uid,
      (p) => {
        if (mounted) {
          if (p) {
            setProfile(p);
            if (!p.householdId) {
              setHousehold(null);
            }
          }
          setIsInitialLoading(false);
        }
      },
    );
    return () => {
      mounted = false;
      unsubProfile();
    };
  }, [firebaseUser?.uid]);

  const prevInitialViewRef = useRef(initialView);
  const hasInitializedRef = useRef(false);

  // Set initial view mode on mount or when initialView prop changes
  useEffect(() => {
    // CRITICAL: Never overwrite if user is on the success screen
    if (viewMode === "success") {
      return;
    }

    const propChanged = prevInitialViewRef.current !== initialView;
    if (propChanged) {
      prevInitialViewRef.current = initialView;
      if (initialView === "create") {
        if (profile && !isHost) {
          setViewMode(householdId ? "details" : "join");
          setShowHostRequiredModal(true);
        } else {
          setViewMode("create");
        }
      } else if (initialView === "join") {
        setViewMode("join");
      } else if (initialView === "edit") {
        setViewMode("edit");
      } else if (initialView === "details") {
        setViewMode(householdId ? "details" : isHost ? "create" : "join");
      }
      return;
    }

    // Initial mount check when profile loads
    if (!hasInitializedRef.current && profile) {
      hasInitializedRef.current = true;
      if (initialView === "create" && !isHost) {
        setViewMode(householdId ? "details" : "join");
        setShowHostRequiredModal(true);
      }
    }
  }, [initialView, householdId, isHost, profile, viewMode]);

  // Listen to Household and sub-collections
  useEffect(() => {
    if (!householdId) return;
    const unsubHh = mobileDataService.listenToHousehold(householdId, (hh) => {
      if (hh) {
        setHousehold(hh);
        const resolved =
          hh.householdName || hh.apartmentName || "Household Group";
        setEditGroupName(resolved);
        setGroupNameInput(resolved);
      }
    });
    const unsubExp = mobileDataService.listenToExpenses(
      householdId,
      setExpenses,
    );
    const unsubCyc = mobileDataService.listenToBillingCycles(
      householdId,
      (loadedCycles) => {
        setCycles(loadedCycles);
        if (loadedCycles.length > 0 && !selectedCycleId) {
          const active =
            loadedCycles.find((c) => c.status === "ACTIVE") || loadedCycles[0];
          setSelectedCycleId(active.billingCycleId);
        }
      },
    );
    const unsubMem = mobileDataService.listenToHouseholdMembers(
      householdId,
      setCloudMembers,
    );
    const unsubWater = mobileDataService.listenToWaterConfig(
      householdId,
      setWaterConfig,
    );
    const unsubElec = mobileDataService.listenToElectricityConfig(
      householdId,
      setElectricityConfig,
    );

    return () => {
      unsubHh();
      unsubExp();
      unsubCyc();
      unsubMem();
      unsubWater();
      unsubElec();
    };
  }, [householdId]);

  // Determine active billing cycle
  const activeCycle =
    cycles.find((c) => c.billingCycleId === selectedCycleId) ||
    cycles.find((c) => c.status === "ACTIVE") ||
    cycles[0] ||
    null;

  useEffect(() => {
    if (!householdId || !activeCycle?.billingCycleId) {
      setBills([]);
      return;
    }
    return mobileDataService.listenToMemberBills(
      householdId,
      activeCycle.billingCycleId,
      setBills,
    );
  }, [householdId, activeCycle?.billingCycleId]);

  // Real-time Water Attendance for the active cycle
  const [cycleAttendance, setCycleAttendance] = useState<any[]>([]);
  const [attendanceSubmissions, setAttendanceSubmissions] = useState<
    Record<string, any>
  >({});

  useEffect(() => {
    const cycleIdToListen = selectedCycleId || activeCycle?.billingCycleId;
    if (!householdId || !cycleIdToListen) {
      setCycleAttendance([]);
      setAttendanceSubmissions({});
      return;
    }
    const unsubAtt = mobileDataService.listenToHouseholdCycleAttendance(
      householdId,
      cycleIdToListen,
      setCycleAttendance,
    );
    const unsubSub = mobileDataService.listenToAttendanceSubmissions(
      householdId,
      cycleIdToListen,
      setAttendanceSubmissions,
    );
    return () => {
      unsubAtt();
      unsubSub();
    };
  }, [householdId, selectedCycleId, activeCycle?.billingCycleId]);

  const getMemberAttendanceDays = (targetUid: string): number => {
    const fromAtt = cycleAttendance.filter(
      (a) => a.userId === targetUid && a.status === "PRESENT",
    ).length;
    const fromSub = attendanceSubmissions[targetUid]?.daysPresent || 0;
    return fromAtt > 0 ? fromAtt : fromSub;
  };

  // Fetch missing user profile pictures from users collection
  useEffect(() => {
    const missingUids = cloudMembers
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
  }, [cloudMembers]);

  const currentGroupName =
    household?.householdName ||
    household?.apartmentName ||
    profile?.householdName ||
    profile?.apartmentName ||
    (householdId ? "Household Group" : "No Group");

  const handleBackFromCreate = () => {
    if (initialView === "create" || !householdId) {
      onBack();
    } else {
      setViewMode("details");
    }
  };

  const handleBackFromJoin = () => {
    if (!householdId) {
      onBack();
    } else {
      setViewMode("details");
    }
  };

  // Filter expenses strictly for the selected/active cycle (legacy unscoped expenses only attach when a single cycle exists or on the oldest cycle)
  const oldestCycleId =
    cycles.length > 0 ? cycles[cycles.length - 1]?.billingCycleId : undefined;
  const knownCycleIds = useMemo(
    () => new Set(cycles.map((c) => c.billingCycleId).filter(Boolean)),
    [cycles],
  );
  const currentCycleExpenses = activeCycle
    ? expenses.filter(
        (e) =>
          e.billingCycleId === activeCycle.billingCycleId ||
          ((!e.billingCycleId || !knownCycleIds.has(e.billingCycleId)) &&
            (cycles.length <= 1 ||
              activeCycle.billingCycleId === oldestCycleId)),
      )
    : expenses;

  const cycleElectricityExpense = useMemo(() => {
    return currentCycleExpenses.find(
      (e) => (e.category || "").toLowerCase() === "electricity",
    );
  }, [currentCycleExpenses]);

  const cycleElectricityData = useMemo(() => {
    const cycleId = activeCycle?.billingCycleId;
    if (cycleElectricityExpense) {
      const cycleSaved =
        cycleId && electricityConfig?.cycles?.[cycleId]
          ? electricityConfig.cycles[cycleId]
          : null;
      const rateCentavosPerKwh = Number(
        cycleElectricityExpense.rateCentavosPerKwh ??
          cycleSaved?.rateCentavosPerKwh ??
          electricityConfig?.rateCentavosPerKwh ??
          1200,
      );
      const previousReadingKwh = Number(
        cycleElectricityExpense.previousReadingKwh ??
          cycleSaved?.previousReadingKwh ??
          0,
      );
      const currentReadingKwh = Number(
        cycleElectricityExpense.currentReadingKwh ??
          cycleSaved?.currentReadingKwh ??
          0,
      );
      const consumedKwh =
        cycleElectricityExpense.consumedKwh !== undefined
          ? Number(cycleElectricityExpense.consumedKwh)
          : Math.max(
              0,
              Math.round((currentReadingKwh - previousReadingKwh) * 100) / 100,
            );
      const totalAmountCentavos = Number(
        cycleElectricityExpense.amountCents ??
          Math.round(consumedKwh * rateCentavosPerKwh),
      );
      return {
        rateCentavosPerKwh,
        previousReadingKwh,
        currentReadingKwh,
        consumedKwh,
        totalAmountCentavos,
        hasReadings:
          cycleElectricityExpense.previousReadingKwh !== undefined ||
          cycleElectricityExpense.currentReadingKwh !== undefined ||
          Boolean(cycleSaved),
      };
    }

    if (cycleId && electricityConfig?.cycles?.[cycleId]) {
      const cycleSaved = electricityConfig.cycles[cycleId];
      const rateCentavosPerKwh = Number(
        cycleSaved.rateCentavosPerKwh ??
          electricityConfig.rateCentavosPerKwh ??
          1200,
      );
      const previousReadingKwh = Number(cycleSaved.previousReadingKwh ?? 0);
      const currentReadingKwh = Number(
        cycleSaved.currentReadingKwh ?? previousReadingKwh,
      );
      const consumedKwh = Math.max(
        0,
        Math.round((currentReadingKwh - previousReadingKwh) * 100) / 100,
      );
      const totalAmountCentavos = Number(
        cycleSaved.totalAmountCentavos ??
          Math.round(consumedKwh * rateCentavosPerKwh),
      );
      if (consumedKwh > 0 || totalAmountCentavos > 0) {
        return {
          rateCentavosPerKwh,
          previousReadingKwh,
          currentReadingKwh,
          consumedKwh,
          totalAmountCentavos,
          hasReadings: true,
        };
      }
    }

    return null;
  }, [activeCycle?.billingCycleId, cycleElectricityExpense, electricityConfig]);

  // Deduplicate bills by user to prevent any duplicate document issues
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

  // Real amounts calculated from Firestore data (Zero when nothing added, NO hardcoding)
  // Total Expense card displays the real total paid expenses of the group (not upcoming/unpaid bills)
  const paidCycleExpenses = useMemo(() => {
    return currentCycleExpenses.filter(
      (e) => e.status === "PAID" || e.isPaid === true,
    );
  }, [currentCycleExpenses]);

  const totalExpenseCents = useMemo(() => {
    return currentCycleExpenses.reduce((sum, e) => {
      const isFullPaid = e.status === "PAID" || e.isPaid === true;
      if (isFullPaid) {
        return sum + (e.amountCents || 0);
      }
      // If individual splits were marked as paid
      if (e.splitDetails && Array.isArray(e.splitDetails)) {
        const paidSplitsSum = e.splitDetails
          .filter((s: any) => !s.isExempt && s.isPaid === true)
          .reduce((sSum: number, s: any) => sSum + (s.shareCentavos || 0), 0);
        return sum + paidSplitsSum;
      }
      return sum;
    }, 0);
  }, [currentCycleExpenses]);

  const unpaidCycleExpenses = currentCycleExpenses.filter(
    (e) => e.status !== "PAID" && !e.isPaid,
  );
  const fallbackDuesCents = unpaidCycleExpenses.reduce(
    (sum, e) => sum + (e.amountCents || 0),
    0,
  );

  // Separate active participants and pending join requests
  const activeMembersList = cloudMembers.filter((m) => m.status === "ACTIVE");
  const pendingRequests = cloudMembers.filter((m) => m.status === "PENDING");
  const activePayorsList = activeMembersList.filter(isPayorMember);
  const payorCount = Math.max(
    1,
    activePayorsList.length > 0
      ? activePayorsList.length
      : activeMembersList.length,
  );

  const cycleWaterExpense = useMemo(() => {
    return currentCycleExpenses.find((e) =>
      (e.category || "").toLowerCase().includes("water"),
    );
  }, [currentCycleExpenses]);

  const cycleWaterBreakdown = useMemo(() => {
    const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
    return computeCycleWaterBreakdown(
      activeMembersList,
      cycleAttendance,
      attendanceSubmissions,
      rate,
      cycleWaterExpense?.splitDetails,
    );
  }, [
    activeMembersList,
    cycleAttendance,
    attendanceSubmissions,
    waterConfig?.rateCentavosPerPersonPerDay,
    cycleWaterExpense?.splitDetails,
  ]);

  // Auto-heal in ManageGroupScreen if payors changed or water splits need update
  useEffect(() => {
    if (!householdId || payorCount === 0 || currentCycleExpenses.length === 0)
      return;
    const hasStaleSplit = currentCycleExpenses.some((e) => {
      if (e.status === "PAID" || e.isPaid) return false;
      const isWater = (e.category || "").toLowerCase().includes("water");
      if (isWater) {
        if (
          waterConfig?.pricingModel === "PER_PERSON_DAY" ||
          !waterConfig?.pricingModel
        ) {
          if (!e.splitDetails || !Array.isArray(e.splitDetails)) return true;
          // Check if any payor's saved split diverges from the current cycle breakdown
          const hasDivergentPayor = activePayorsList.some((p) => {
            const pUid = p.userId || p.memberId || p.id;
            const saved = e.splitDetails?.find((s: any) =>
              matchesMemberUid(p, s.userId),
            );
            const expected = cycleWaterBreakdown.getPayorShareCentavos(pUid);
            return !saved || saved.shareCentavos !== expected;
          });
          return (
            hasDivergentPayor ||
            e.amountCents !== cycleWaterBreakdown.totalAmountCentavos
          );
        }
        return false;
      }
      const splitPayors = e.splitDetails
        ? e.splitDetails.filter((s: any) => !s.isExempt && s.shareCentavos > 0)
        : [];
      return splitPayors.length > 0 && splitPayors.length !== payorCount;
    });
    if (hasStaleSplit) {
      mobileDataService
        .recalculateUnpaidExpensesForHousehold(householdId)
        .catch(() => {});
    }
  }, [
    householdId,
    payorCount,
    currentCycleExpenses,
    waterConfig?.pricingModel,
    activePayorsList,
    cycleWaterBreakdown,
  ]);

  const myPhoto =
    profile?.profilePicture || profile?.photoURL || firebaseUser?.photoURL;

  // Real participants list from Firestore members
  const participants: Participant[] =
    activeMembersList.length > 0
      ? activeMembersList.map((m) => {
          const uid = m.userId || m.memberId;
          const userBill = uniqueBills.find((b) =>
            matchesMemberUid(m, b.userId),
          );
          const isPayor = isPayorMember(m);
          let owes = 0;
          let memberWaterShare = 0;
          let memberWaterOwn = 0;
          let memberWaterNonPayor = 0;

          const waterMember = cycleWaterBreakdown.membersBreakdown.find((mb) =>
            matchesMemberUid(m, mb.userId),
          );
          const memberWaterDays =
            waterMember?.daysPresent ?? getMemberAttendanceDays(uid);

          if (isPayor) {
            const isPersonDayMode =
              waterConfig?.pricingModel === "PER_PERSON_DAY" ||
              !waterConfig?.pricingModel;

            if (isPersonDayMode) {
              const rate = Number(
                waterConfig?.rateCentavosPerPersonPerDay ?? 500,
              );
              memberWaterOwn =
                waterMember?.ownWaterCentavos ?? memberWaterDays * rate;
              memberWaterNonPayor = waterMember?.nonPayorWaterCentavos ?? 0;
              memberWaterShare =
                waterMember?.shareCentavos ??
                memberWaterOwn + memberWaterNonPayor;
            } else if (waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH") {
              const flatRate = Number(
                waterConfig.fixedPerPersonAmountCentavos || 0,
              );
              memberWaterShare = flatRate;
              memberWaterOwn = flatRate;
              memberWaterNonPayor = 0;
            } else {
              const fixedTotal = Number(
                waterConfig?.fixedMonthlyAmountCentavos ||
                  cycleWaterExpense?.amountCents ||
                  0,
              );
              const fixedShare = computeFairSplitShareCentavos(
                fixedTotal,
                activePayorsList,
                uid,
              );
              memberWaterShare = fixedShare;
              memberWaterOwn = fixedShare;
              memberWaterNonPayor = 0;
            }

            const liveShare = unpaidCycleExpenses.reduce((sum, e) => {
              const isWater = (e.category || "")
                .toLowerCase()
                .includes("water");
              if (isWater) {
                return sum + memberWaterShare;
              }

              // Non-water bills (Rent, Internet, Electricity, Custom)
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
                (splitPayors.length > 0 && splitPayors.length !== payorCount) ||
                (splitPayors.length > 0 && splitPayorsSum !== e.amountCents);
              if (
                !isSplitStale &&
                e.splitDetails &&
                Array.isArray(e.splitDetails) &&
                e.splitDetails.length > 0
              ) {
                const s = e.splitDetails.find((item: any) =>
                  matchesMemberUid(m, item.userId),
                );
                if (s && typeof s.shareCentavos === "number")
                  return sum + s.shareCentavos;
              }
              return (
                sum +
                computeFairSplitShareCentavos(
                  e.amountCents || 0,
                  activePayorsList,
                  uid,
                )
              );
            }, 0);

            const paid =
              userBill && typeof userBill.totalPaidCentavos === "number"
                ? userBill.totalPaidCentavos
                : 0;
            owes = Math.max(0, liveShare - paid);
          } else {
            // Non-payor member
            memberWaterShare = 0;
            memberWaterOwn = 0;
            memberWaterNonPayor = 0;
          }
          const isSettled = isPayor
            ? currentCycleExpenses.length > 0 && owes <= 0
            : true;
          const displayName =
            m.displayName ||
            m.name ||
            (m.role === "HOST" ? "Host" : "Roommate");
          const isCurrent = uid === firebaseUser?.uid;
          const photo =
            (isCurrent && myPhoto) ||
            m.profilePicture ||
            m.photoURL ||
            userPhotosMap[uid] ||
            undefined;

          return {
            id: m.memberId || m.userId || String(Math.random()),
            userId: uid,
            name: displayName,
            avatar: displayName.charAt(0).toUpperCase(),
            profilePicture: photo,
            role: m.role || "PAYOR",
            status: isSettled ? "Settled" : "Pending",
            statusDate: activeCycle
              ? formatShortDate(activeCycle.endDate || "")
              : "Current",
            owesCents: owes,
            waterShareCents: memberWaterShare,
            waterOwnCents: memberWaterOwn,
            waterNonPayorCents: memberWaterNonPayor,
            waterDaysPresent: memberWaterDays,
            waterAllocationSummary:
              waterMember?.nonPayorAllocationSummary || "",
            email: m.email,
            phone: m.phoneNumber,
          };
        })
      : firebaseUser
        ? [
            {
              id: firebaseUser.uid,
              userId: firebaseUser.uid,
              name: firebaseUser.displayName || currentUser.name || "Host",
              avatar: (firebaseUser.displayName || currentUser.name || "H")
                .charAt(0)
                .toUpperCase(),
              profilePicture: myPhoto || undefined,
              role: profile?.role === "HOST" ? "HOST" : "PAYOR",
              status: "Settled",
              statusDate: "Current",
              owesCents: 0,
              email: firebaseUser.email || undefined,
            },
          ]
        : [];

  const totalDuesCents = useMemo(() => {
    return participants.reduce((sum, p) => sum + (p.owesCents || 0), 0);
  }, [participants]);

  const payingParticipants = useMemo(
    () => participants.filter((p) => p.role !== "NON_PAYOR"),
    [participants],
  );
  const allPayorsSettled =
    currentCycleExpenses.length > 0 &&
    payingParticipants.length > 0 &&
    payingParticipants.every((p) => (p.owesCents || 0) === 0);

  const isSelectedCycleClosed = Boolean(
    activeCycle &&
    (activeCycle.status === "CLOSED" ||
      activeCycle.status === "ARCHIVED" ||
      activeCycle.status === "FINALIZED" ||
      allPayorsSettled ||
      (cycles.length > 1 &&
        activeCycle.billingCycleId !== cycles[0]?.billingCycleId &&
        activeCycle.status !== "ACTIVE")),
  );

  useEffect(() => {
    if (allPayorsSettled && householdId) {
      const hasUnpaid = currentCycleExpenses.some(
        (e) => e.status !== "PAID" || !e.isPaid,
      );
      if (hasUnpaid) {
        mobileDataService
          .markExpensesPaidIfAllSettled(
            householdId,
            activeCycle?.billingCycleId,
          )
          .catch(() => {});
      }
    }
  }, [
    allPayorsSettled,
    householdId,
    activeCycle?.billingCycleId,
    currentCycleExpenses,
  ]);

  // Helper date formatting
  function formatShortDate(dateStr: string) {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  }

  // Handlers
  const handleCreateBillingCycle = async () => {
    if (!cycleNameInput.trim()) {
      Alert.alert("Validation", "Please enter a name for the cycle.");
      return;
    }
    if (!householdId) {
      Alert.alert(
        "Household Required",
        "Please ensure your household is active.",
      );
      return;
    }

    setLoading(true);
    try {
      const newCycleId = await mobileDataService.createBillingCycle(
        householdId,
        {
          name: cycleNameInput.trim(),
          startDate: cycleStartInput,
          endDate: cycleEndInput,
          status: "ACTIVE",
        },
      );
      setSelectedCycleId(newCycleId);
      setShowCreateCycleModal(false);
      setLoading(false);
      Alert.alert(
        "Billing Cycle Created",
        `Cycle "${cycleNameInput.trim()}" is now active.`,
      );
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error", err.message || "Failed to create billing cycle.");
    }
  };

  const handleOpenEditCycle = () => {
    if (!activeCycle) return;
    setEditCycleName(activeCycle.name || "");
    setEditCycleStart(activeCycle.startDate || "");
    setEditCycleEnd(activeCycle.endDate || "");
    setEditCycleStatus(activeCycle.status || "ACTIVE");
    setShowEditCycleModal(true);
  };

  const handleUpdateBillingCycle = async () => {
    if (!editCycleName.trim()) {
      Alert.alert("Validation", "Please enter a name for the cycle.");
      return;
    }
    if (!householdId || !activeCycle) return;

    setLoading(true);
    try {
      await mobileDataService.updateBillingCycle(
        householdId,
        activeCycle.billingCycleId,
        {
          name: editCycleName.trim(),
          startDate: editCycleStart,
          endDate: editCycleEnd,
          status: editCycleStatus,
        },
      );
      setShowEditCycleModal(false);
      setLoading(false);
      Alert.alert(
        "Cycle Updated",
        `Cycle "${editCycleName.trim()}" has been updated.`,
      );
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error", err.message || "Failed to update billing cycle.");
    }
  };

  const handleDeleteBillingCycle = () => {
    if (!householdId || !activeCycle) return;
    Alert.alert(
      "Delete Billing Cycle",
      `Are you sure you want to delete cycle "${activeCycle.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await mobileDataService.deleteBillingCycle(
                householdId,
                activeCycle.billingCycleId,
              );
              const remaining = cycles.filter(
                (c) => c.billingCycleId !== activeCycle.billingCycleId,
              );
              if (remaining.length > 0) {
                setSelectedCycleId(remaining[0].billingCycleId);
              } else {
                setSelectedCycleId("");
              }
              setLoading(false);
              Alert.alert("Deleted", "Billing cycle has been deleted.");
            } catch (err: any) {
              setLoading(false);
              Alert.alert(
                "Error",
                err.message || "Failed to delete billing cycle.",
              );
            }
          },
        },
      ],
    );
  };

  const isPaymentsLocked = isCyclePaymentsLocked(activeCycle, household);

  const handleTogglePaymentsLock = async () => {
    if (!householdId || !activeCycle) return;
    const currentlyLocked = isCyclePaymentsLocked(activeCycle, household);
    const newLocked = !currentlyLocked;
    try {
      await mobileDataService.toggleCyclePaymentsLock(
        householdId,
        activeCycle.billingCycleId,
        newLocked,
      );
      Alert.alert(
        newLocked ? "Payments Locked" : "Payments Opened",
        newLocked
          ? "Roommates will see that bills are under review and cannot pay until you reopen payments."
          : "Payments are now open for roommates to pay their bill shares.",
      );
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.message || "Could not update payment lock state.",
      );
    }
  };

  const handleOpenEditExpense = (exp: MobileExpense) => {
    setEditingExpense(exp);
    setEditExpenseTitle(cleanBillTitle(exp.title, exp.category));
    setEditExpenseCategory(exp.category || "Rent");
    setEditExpenseAmount(
      exp.amountCents
        ? (exp.amountCents / 100).toFixed(2).replace(/\.00$/, "")
        : "",
    );
    setEditExpenseNotes(exp.notes || "");
    setEditExpenseStatus(
      exp.status === "PAID" || exp.isPaid ? "PAID" : "UNPAID",
    );
    setEditExpenseCycleId(exp.billingCycleId || selectedCycleId || "");
    setEditExpenseSplitMethod(
      (exp.splitMethod as "Equal" | "% Custom") || "Equal",
    );
    setEditExpenseSplitDetails(exp.splitDetails || []);
    setShowEditExpenseModal(true);
  };

  const handleDeleteExpense = (exp: MobileExpense) => {
    if (!householdId) return;
    const billTitle = cleanBillTitle(exp.title, exp.category);
    Alert.alert(
      "Delete Bill",
      `Are you sure you want to delete "${billTitle}" (${formatPesos(exp.amountCents)})?\n\nThis will permanently remove the bill from the group and automatically recalculate all roommate dues and balances.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Bill",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const success = await mobileDataService.deleteExpense(
                householdId,
                exp.id,
              );
              if (editingExpense?.id === exp.id) {
                setShowEditExpenseModal(false);
                setEditingExpense(null);
              }
              setLoading(false);
              if (success) {
                Alert.alert(
                  "Bill Deleted",
                  `"${billTitle}" has been removed and group dues have been recalculated.`,
                );
              }
            } catch (err: any) {
              setLoading(false);
              Alert.alert("Error", err.message || "Could not delete bill.");
            }
          },
        },
      ],
    );
  };

  const handleSaveEditExpense = async () => {
    if (!editingExpense || !householdId) return;

    if (!editExpenseTitle.trim()) {
      Alert.alert("Required", "Please enter a title for the bill.");
      return;
    }

    const cleanAmountStr = editExpenseAmount.replace(/,/g, "").trim();
    const parsedAmount = parseFloat(cleanAmountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(
        "Invalid Amount",
        "Please enter a valid amount greater than 0.",
      );
      return;
    }

    const amountCents = Math.round(parsedAmount * 100);
    const isPaid = editExpenseStatus === "PAID";

    // Recalculate equal splits if splitMethod is Equal
    let updatedSplits = editExpenseSplitDetails;
    if (
      editExpenseSplitMethod === "Equal" &&
      Array.isArray(updatedSplits) &&
      updatedSplits.length > 0
    ) {
      const payors = updatedSplits.filter((s: any) => !s.isExempt);
      const count = Math.max(1, payors.length);
      const perPayorCents = Math.round(amountCents / count);
      updatedSplits = updatedSplits.map((s: any) => ({
        ...s,
        shareCentavos: s.isExempt ? 0 : perPayorCents,
        isPaid: s.isExempt ? true : isPaid,
      }));
    }

    setIsUpdatingExpense(true);
    try {
      await mobileDataService.updateExpense(householdId, editingExpense.id, {
        title: editExpenseTitle.trim(),
        category: editExpenseCategory,
        amountCents,
        notes: editExpenseNotes.trim(),
        status: editExpenseStatus,
        isPaid,
        billingCycleId: editExpenseCycleId || undefined,
        splitMethod: editExpenseSplitMethod,
        splitDetails: updatedSplits,
      });

      setIsUpdatingExpense(false);
      setShowEditExpenseModal(false);
      setEditingExpense(null);
      Alert.alert("Success", "Bill has been updated successfully.");
    } catch (err: any) {
      setIsUpdatingExpense(false);
      Alert.alert("Error", err.message || "Failed to update bill.");
    }
  };

  const handleExpensePress = (exp: MobileExpense) => {
    if (!householdId) return;
    const isCurrentlyPaid = exp.status === "PAID" || exp.isPaid === true;
    const billTitle = cleanBillTitle(exp.title, exp.category);
    if (isHost) {
      const nextStatus = isCurrentlyPaid ? "UNPAID" : "PAID";
      Alert.alert(
        billTitle,
        `Amount: ${formatPesos(exp.amountCents)}\nCurrent Status: ${isCurrentlyPaid ? "PAID" : "UNPAID (Upcoming)"}\nCategory: ${exp.category || "General"}\nDate: ${formatShortDate(exp.date)}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "✏️ Edit Bill",
            onPress: () => handleOpenEditExpense(exp),
          },
          {
            text: `Mark as ${nextStatus}`,
            onPress: async () => {
              try {
                await mobileDataService.updateExpenseStatus(
                  householdId,
                  exp.id,
                  !isCurrentlyPaid,
                );
              } catch (err: any) {
                Alert.alert(
                  "Error",
                  err.message || "Could not update bill status.",
                );
              }
            },
          },
          {
            text: "🗑️ Delete Bill",
            style: "destructive",
            onPress: () => handleDeleteExpense(exp),
          },
        ],
      );
    } else {
      Alert.alert(
        billTitle,
        `Amount: ${formatPesos(exp.amountCents)}\nStatus: ${isCurrentlyPaid ? "PAID" : "UNPAID (Upcoming)"}\nDate: ${formatShortDate(exp.date)}\nAdded by: ${exp.payerName || "Host"}`,
      );
    }
  };

  const handleInviteRoommate = async () => {
    if (!inviteName.trim()) {
      Alert.alert("Validation", "Please enter the roommate's name.");
      return;
    }
    if (!householdId) return;

    setLoading(true);
    try {
      await mobileDataService.inviteMemberToHousehold(householdId, {
        name: inviteName.trim(),
        phoneOrEmail: inviteContact.trim(),
        role: "PAYOR",
      });
      setInviteName("");
      setInviteContact("");
      setShowInviteModal(false);
      setLoading(false);
      Alert.alert(
        "Roommate Added",
        `${inviteName.trim()} has been invited to the household.`,
      );
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Notice", err.message || "Could not invite roommate.");
    }
  };

  const handleToggleMemberRole = (member: Participant) => {
    if (member.role === "HOST") {
      Alert.alert("Host Role", "The host cannot change their own role here.");
      return;
    }
    const targetRole = member.role === "NON_PAYOR" ? "PAYOR" : "NON_PAYOR";
    const roleLabel = targetRole === "PAYOR" ? "Payor" : "Non-Payor";
    const description =
      targetRole === "NON_PAYOR"
        ? `Change ${member.name}'s status to Non-Payor? They will be exempted from rent and shared utility splits.`
        : `Change ${member.name}'s status to Payor? They will share equally in rent, wifi, and shared bills.`;

    Alert.alert(`Set as ${roleLabel}?`, description, [
      { text: "Cancel", style: "cancel" },
      {
        text: `Set ${roleLabel}`,
        onPress: async () => {
          if (!householdId) return;
          try {
            setLoading(true);
            await mobileDataService.updateMemberRole(
              householdId,
              member.id,
              member.userId || member.id,
              targetRole as "PAYOR" | "NON_PAYOR",
            );
            setLoading(false);
            Alert.alert(
              "Status Updated",
              `${member.name} is now set as ${roleLabel}.`,
            );
          } catch (err: any) {
            setLoading(false);
            Alert.alert("Error", err.message || "Failed to update role.");
          }
        },
      },
    ]);
  };

  const handleRemoveMember = (member: Participant) => {
    if (member.role === "HOST") {
      Alert.alert(
        "Host Protected",
        "The host cannot be removed from their household.",
      );
      return;
    }
    Alert.alert(
      "Remove Roommate",
      `Are you sure you want to remove ${member.name} from this household?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (householdId && member.id) {
              setLoading(true);
              try {
                await mobileDataService.removeMemberFromHousehold(
                  householdId,
                  member.id,
                  member.userId,
                );
                Alert.alert("Removed", `${member.name} has been removed.`);
              } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to remove member.");
              } finally {
                setLoading(false);
              }
            }
          },
        },
      ],
    );
  };

  const handleCreateGroup = async () => {
    if (!isHost) {
      Alert.alert(
        "Host Privileges Required",
        "Only verified Hosts can create household groups. Please submit a host application first.",
      );
      return;
    }

    const finalGroupName =
      groupNameInput.trim() ||
      profile?.apartmentName ||
      profile?.householdName ||
      "My Household";
    if (!finalGroupName) {
      Alert.alert("Error", "Please enter a group name.");
      return;
    }
    if (!firebaseUser?.uid) {
      Alert.alert("Auth Required", "Please sign in to create a group.");
      return;
    }

    setLoading(true);
    try {
      await mobileDataService.createHousehold({
        householdName: finalGroupName,
        apartmentName: finalGroupName,
        hostId: firebaseUser.uid,
        members: addedMembers.map((m) => ({
          name: m.name,
          phoneOrEmail: m.phone,
        })),
      });
      setCreatedGroupName(finalGroupName);
      setGroupNameInput("");
      setAddedMembers([]);
      setLoading(false);
      setViewMode("success");
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Creation Notice", err.message || "Failed to create group.");
    }
  };

  const handleUpdateGroup = async () => {
    if (!editGroupName.trim()) {
      Alert.alert("Validation", "Group name cannot be empty.");
      return;
    }
    if (householdId) {
      await mobileDataService.updateHousehold(householdId, {
        householdName: editGroupName.trim(),
        apartmentName: editGroupName.trim(),
      });
    }
    Alert.alert("Group Updated", "Apartment details updated successfully.");
    setViewMode("details");
  };

  const handleJoinGroup = async () => {
    if (!joinLinkInput.trim()) {
      Alert.alert("Input Required", "Please enter a household code or link.");
      return;
    }
    if (!firebaseUser?.uid) return;

    setLoading(true);
    let code = joinLinkInput.trim();
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

    setLoading(false);
    if (result.success) {
      Alert.alert(
        "Request Submitted",
        `Your request to join "${result.household?.householdName || "the household"}" has been sent! The host must approve your request before you can access the group.`,
      );
      setViewMode("details");
    } else {
      Alert.alert("Join Failed", result.error || "Could not find household.");
    }
  };

  const handleCopyInviteCode = () => {
    const code =
      household?.inviteCode || householdId.slice(-6).toUpperCase() || "PF-402";
    Alert.alert("Invite Code", `Share this code with your roommates: ${code}`);
    setShowMenu(false);
  };

  // Non-host safety guard: non-host users in a group always see the read-only informational ViewGroupScreen
  if (!isInitialLoading && profile && !isHost && viewMode !== "join") {
    return (
      <ViewGroupScreen
        onBack={onBack}
        onOpenSettleDues={onOpenSettleDues}
        onOpenHostApplication={onOpenHostApplication}
        currentUser={currentUser}
      />
    );
  }

  // --------------------------------------------------------------------------
  // VIEW: SUCCESS SCREEN
  // --------------------------------------------------------------------------
  if (viewMode === "success") {
    return (
      <View
        style={[
          styles.container,
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent={true}
          backgroundColor="transparent"
        />
        <View style={{ paddingTop: topInset }} />
        <View style={styles.successContainer}>
          <View style={styles.badgeWrapper}>
            <View
              style={[
                styles.sparkleDot,
                { top: 0, left: 24, backgroundColor: "#3B82F6" },
              ]}
            />
            <View
              style={[
                styles.sparkleDot,
                {
                  top: 12,
                  right: 20,
                  backgroundColor: "#60A5FA",
                  width: 8,
                  height: 8,
                },
              ]}
            />
            <View
              style={[
                styles.sparkleDot,
                {
                  bottom: 10,
                  left: 16,
                  backgroundColor: "#93C5FD",
                  width: 9,
                  height: 9,
                },
              ]}
            />
            <View
              style={[
                styles.sparkleDot,
                {
                  bottom: 6,
                  right: 28,
                  backgroundColor: "#2563EB",
                  width: 6,
                  height: 6,
                },
              ]}
            />
            <View
              style={[
                styles.starBadgeCircle,
                isDark && { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons name="star" size={54} color="#FFFFFF" />
            </View>
          </View>

          <Text style={[styles.successTitle, isDark && { color: colors.text }]}>
            Your Group is Created Successfully!
          </Text>
          <Text
            style={[
              styles.successSub,
              isDark && { color: colors.textSecondary },
            ]}
          >
            {createdGroupName || "Your Group"} is now active. You can now add
            billing cycles, record expenses, and invite roommates.
          </Text>

          <View style={{ flex: 1 }} />

          <View style={{ width: "100%", gap: 12, marginBottom: 16 }}>
            <TouchableOpacity
              style={[
                styles.primaryPillBtn,
                { width: "100%" },
                isDark && { backgroundColor: colors.primary },
              ]}
              onPress={() => setViewMode("details")}
            >
              <Text style={styles.primaryPillBtnText}>View Group Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryPillBtn,
                {
                  width: "100%",
                  backgroundColor: isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : "#EFF6FF",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#BFDBFE",
                },
              ]}
              onPress={() => {
                if (onOpenAddExpense) {
                  onOpenAddExpense();
                } else {
                  onBack();
                }
              }}
            >
              <Text
                style={[
                  styles.primaryPillBtnText,
                  { color: isDark ? colors.accent : "#2563EB" },
                ]}
              >
                + Add Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                width: "100%",
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={onBack}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: isDark ? colors.textSecondary : "#64748B",
                }}
              >
                Back to Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW: CREATE GROUP
  // --------------------------------------------------------------------------
  if (viewMode === "create") {
    if (profile && !isHost) {
      return (
        <View
          style={[
            styles.container,
            isDark && { backgroundColor: colors.background },
          ]}
        >
          <StatusBar
            barStyle={isDark ? "light-content" : "dark-content"}
            translucent={true}
            backgroundColor="transparent"
          />
          <View
            style={[
              styles.navBarContainer,
              { paddingTop: topInset },
              isDark && { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.navBar}>
              <TouchableOpacity
                style={[
                  styles.circleBackBtn,
                  isDark && {
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleBackFromCreate}
              >
                <Feather
                  name="chevron-left"
                  size={24}
                  color={isDark ? colors.text : "#0F172A"}
                />
              </TouchableOpacity>
              <Text style={[styles.navTitle, isDark && { color: colors.text }]}>
                Create Group
              </Text>
              <View style={{ width: 42 }} />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                alignItems: "center",
                justifyContent: "center",
                minHeight: 460,
                paddingVertical: 32,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: isDark
                  ? colors.card
                  : "rgba(15, 23, 42, 0.05)",
                borderWidth: isDark ? 1 : 0,
                borderColor: colors.border,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <Feather
                name="shield"
                size={36}
                color={isDark ? colors.accent : "#0F172A"}
              />
            </View>

            <Text
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: isDark ? colors.text : "#0F172A",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Host Privileges Required
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: isDark ? colors.textSecondary : "#64748B",
                textAlign: "center",
                lineHeight: 22,
                maxWidth: 320,
                marginBottom: 24,
              }}
            >
              Creating and managing household groups is restricted to verified
              Property Hosts. Non-hosts can join an existing room with an invite
              code from their host.
            </Text>

            <View
              style={{
                backgroundColor: isDark ? colors.card : "#F8FAFC",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? colors.border : "#E2E8F0",
                padding: 16,
                width: "100%",
                maxWidth: 340,
                marginBottom: 24,
                gap: 12,
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
                      fontSize: 13,
                      fontWeight: "700",
                      color: isDark ? colors.text : "#1E293B",
                    }}
                  >
                    Are you the Property Host?
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: isDark ? colors.textSecondary : "#64748B",
                      marginTop: 2,
                      lineHeight: 17,
                    }}
                  >
                    Apply for host status to create households, add roommates,
                    and split utility expenses.
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
                  color={isDark ? colors.success : "#059669"}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: isDark ? colors.text : "#1E293B",
                    }}
                  >
                    Are you a Resident?
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: isDark ? colors.textSecondary : "#64748B",
                      marginTop: 2,
                      lineHeight: 17,
                    }}
                  >
                    Ask your property host for your household’s 5-character
                    invite code to join immediately.
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ width: "100%", maxWidth: 340, gap: 12 }}>
              <TouchableOpacity
                style={[
                  styles.primaryPillBtn,
                  isDark && { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  if (onOpenHostApplication) {
                    onOpenHostApplication();
                  } else {
                    Alert.alert(
                      "Host Application",
                      "Navigate to Settings / Profile to submit a Host application.",
                    );
                  }
                }}
              >
                <Feather
                  name="shield"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.primaryPillBtnText}>
                  Apply to Become a Host
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryPillBtn,
                  {
                    backgroundColor: isDark
                      ? "rgba(59, 130, 246, 0.15)"
                      : "#EFF6FF",
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#BFDBFE",
                  },
                ]}
                onPress={() => setViewMode("join")}
              >
                <Feather
                  name="hash"
                  size={16}
                  color={isDark ? colors.accent : "#2563EB"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.primaryPillBtnText,
                    { color: isDark ? colors.accent : "#2563EB" },
                  ]}
                >
                  Join with Invite Code
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingVertical: 12, alignItems: "center" }}
                onPress={handleBackFromCreate}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: isDark ? colors.textSecondary : "#64748B",
                    fontWeight: "600",
                  }}
                >
                  Cancel & Return
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.container,
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent={true}
          backgroundColor="transparent"
        />
        <View
          style={[
            styles.navBarContainer,
            { paddingTop: topInset },
            isDark && { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.navBar}>
            <TouchableOpacity
              style={[
                styles.circleBackBtn,
                isDark && {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleBackFromCreate}
            >
              <Feather
                name="chevron-left"
                size={24}
                color={isDark ? colors.text : "#0F172A"}
              />
            </TouchableOpacity>
            <Text style={[styles.navTitle, isDark && { color: colors.text }]}>
              Create Group
            </Text>
            <View style={{ width: 42 }} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>
              Group Name
            </Text>
            <TextInput
              style={[
                styles.textInput,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={groupNameInput}
              onChangeText={setGroupNameInput}
              placeholder="e.g. Sunshine Residence Unit 4B"
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            />
          </View>

          <View style={[styles.inputGroup, { marginTop: 24 }]}>
            <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>
              Add Roommates
            </Text>
            {addedMembers.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.addedMemberRow,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.memberSmallAvatar,
                    isDark && {
                      backgroundColor: "rgba(59, 130, 246, 0.2)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.memberSmallAvatarText,
                      isDark && { color: colors.accent },
                    ]}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.addedMemberName,
                    isDark && { color: colors.text },
                  ]}
                >
                  {m.name}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setAddedMembers(
                      addedMembers.filter((item) => item.id !== m.id),
                    )
                  }
                >
                  <Feather
                    name="x"
                    size={18}
                    color={isDark ? colors.textMuted : "#94A3B8"}
                  />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.inviteInputRow}>
              <View
                style={[
                  styles.inviteInnerBox,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.inviteTextInput,
                    isDark && { color: colors.text },
                  ]}
                  placeholder="Enter Name or Phone"
                  placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                  value={newMemberInput}
                  onChangeText={setNewMemberInput}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.inviteBtn,
                  isDark && { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  if (newMemberInput.trim()) {
                    setAddedMembers([
                      ...addedMembers,
                      { id: `m_${Date.now()}`, name: newMemberInput.trim() },
                    ]);
                    setNewMemberInput("");
                  }
                }}
              >
                <Text style={styles.inviteBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            isDark && {
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.primaryPillBtn,
              isDark && { backgroundColor: colors.primary },
            ]}
            onPress={handleCreateGroup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryPillBtnText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW: JOIN GROUP
  // --------------------------------------------------------------------------
  if (viewMode === "join") {
    return (
      <View
        style={[
          styles.container,
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent={true}
          backgroundColor="transparent"
        />
        <View
          style={[
            styles.navBarContainer,
            { paddingTop: topInset },
            isDark && { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.navBar}>
            <TouchableOpacity
              style={[
                styles.circleBackBtn,
                isDark && {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleBackFromJoin}
            >
              <Feather
                name="chevron-left"
                size={24}
                color={isDark ? colors.text : "#0F172A"}
              />
            </TouchableOpacity>
            <Text style={[styles.navTitle, isDark && { color: colors.text }]}>
              Join Group
            </Text>
            <View style={{ width: 42 }} />
          </View>
        </View>

        <View style={[styles.scrollContent, { flex: 1 }]}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>
              Household Code or Link
            </Text>
            <TextInput
              style={[
                styles.textInput,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={joinLinkInput}
              onChangeText={setJoinLinkInput}
              placeholder="e.g. PF-402 or hh_..."
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryPillBtn,
              { marginTop: 24 },
              isDark && { backgroundColor: colors.primary },
            ]}
            onPress={handleJoinGroup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryPillBtnText}>Join Group</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW: EDIT GROUP
  // --------------------------------------------------------------------------
  if (viewMode === "edit") {
    return (
      <View
        style={[
          styles.container,
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent={true}
          backgroundColor="transparent"
        />
        <View
          style={[
            styles.navBarContainer,
            { paddingTop: topInset },
            isDark && { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.navBar}>
            <TouchableOpacity
              style={[
                styles.circleBackBtn,
                isDark && {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setViewMode("details")}
            >
              <Feather
                name="chevron-left"
                size={24}
                color={isDark ? colors.text : "#0F172A"}
              />
            </TouchableOpacity>
            <Text style={[styles.navTitle, isDark && { color: colors.text }]}>
              Edit Group
            </Text>
            <TouchableOpacity
              style={[
                styles.iconNavBtn,
                isDark && {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setShowMenu(true)}
            >
              <Feather
                name="more-vertical"
                size={22}
                color={isDark ? colors.text : "#0F172A"}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>
              Apartment / Group Name
            </Text>
            <TextInput
              style={[
                styles.textInput,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={editGroupName}
              onChangeText={setEditGroupName}
              placeholder="Group or Apartment Name"
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            />
          </View>

          <View style={[styles.sectionRow, { marginTop: 28 }]}>
            <Text
              style={[styles.sectionHeading, isDark && { color: colors.text }]}
            >
              Participants ({participants.length})
            </Text>
            <TouchableOpacity onPress={() => setShowInviteModal(true)}>
              <Text
                style={[
                  styles.sectionActionText,
                  isDark && { color: colors.accent },
                ]}
              >
                + Invite
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.participantsList}>
            {participants.map((p) => (
              <View
                key={p.id}
                style={[
                  styles.participantCard,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.participantRow}>
                  <View
                    style={[
                      styles.participantAvatar,
                      isDark && { backgroundColor: colors.surfaceInset },
                    ]}
                  >
                    {p.profilePicture ? (
                      <Image
                        source={{ uri: p.profilePicture }}
                        style={styles.participantAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text
                        style={[
                          styles.participantAvatarText,
                          isDark && { color: colors.text },
                        ]}
                      >
                        {p.avatar}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={[
                          styles.participantName,
                          isDark && { color: colors.text },
                        ]}
                      >
                        {p.name}
                      </Text>
                      {p.role === "HOST" ? (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeText}>HOST</Text>
                        </View>
                      ) : p.role === "NON_PAYOR" ? (
                        <View style={styles.nonPayorBadge}>
                          <Text style={styles.nonPayorBadgeText}>
                            NON-PAYOR
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.payorBadge}>
                          <Text style={styles.payorBadgeText}>PAYOR</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.participantRoleTag,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      {p.role === "HOST"
                        ? "Host Administrator"
                        : p.role === "NON_PAYOR"
                          ? "Non-Payor (Exempt)"
                          : "Payor (Active Split)"}
                    </Text>
                  </View>
                  {p.role !== "HOST" && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.editModeToggleRoleBtn,
                          isDark && {
                            backgroundColor: colors.surfaceInset,
                            borderWidth: 1,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => handleToggleMemberRole(p)}
                      >
                        <Text
                          style={[
                            styles.editModeToggleRoleText,
                            isDark && { color: colors.accent },
                          ]}
                        >
                          {p.role === "NON_PAYOR"
                            ? "Make Payor"
                            : "Make Non-Payor"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.deleteParticipantBtn,
                          isDark && {
                            backgroundColor: "rgba(239, 68, 68, 0.15)",
                            borderWidth: 1,
                            borderColor: "rgba(239, 68, 68, 0.3)",
                          },
                        ]}
                        onPress={() => handleRemoveMember(p)}
                      >
                        <Feather
                          name="trash-2"
                          size={18}
                          color={isDark ? colors.danger : "#EF4444"}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            isDark && {
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.primaryPillBtn,
              isDark && { backgroundColor: colors.primary },
            ]}
            onPress={handleUpdateGroup}
          >
            <Text style={styles.primaryPillBtnText}>Update Group</Text>
          </TouchableOpacity>
        </View>

        {renderMenuModal()}
        {renderInviteModal()}
        {renderHostRequiredModal()}
      </View>
    );
  }

  // If initial profile & household are loading, show UniversalSkeleton groups
  if (isInitialLoading && !householdId && viewMode === "details") {
    return (
      <View
        style={[
          styles.container,
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent={true}
          backgroundColor="transparent"
        />
        <View
          style={[
            styles.navBarContainer,
            { paddingTop: topInset },
            isDark && { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.navBar}>
            <TouchableOpacity
              style={[
                styles.circleBackBtn,
                isDark && {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={onBack}
            >
              <Feather
                name="chevron-left"
                size={24}
                color={isDark ? colors.text : "#0F172A"}
              />
            </TouchableOpacity>
            <Text style={[styles.navTitle, isDark && { color: colors.text }]}>
              Manage Group
            </Text>
            <View style={{ width: 42 }} />
          </View>
        </View>
        <UniversalSkeleton type="groups" />
      </View>
    );
  }

  // If no household exists, show clean empty state instead of phantom active household
  if (!householdId) {
    return (
      <View
        style={[
          styles.container,
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent={true}
          backgroundColor="transparent"
        />
        <View
          style={[
            styles.navBarContainer,
            { paddingTop: topInset },
            isDark && { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.navBar}>
            <TouchableOpacity
              style={[
                styles.circleBackBtn,
                isDark && {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={onBack}
            >
              <Feather
                name="chevron-left"
                size={24}
                color={isDark ? colors.text : "#0F172A"}
              />
            </TouchableOpacity>
            <Text style={[styles.navTitle, isDark && { color: colors.text }]}>
              Manage Group
            </Text>
            <View style={{ width: 42 }} />
          </View>
        </View>

        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: 22,
              backgroundColor: isDark ? colors.card : "rgba(15, 23, 42, 0.05)",
              borderWidth: isDark ? 1 : 0,
              borderColor: colors.border,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Feather
              name="home"
              size={32}
              color={isDark ? colors.accent : "#0F172A"}
            />
          </View>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: isDark ? colors.text : "#0F172A",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            No Household Group
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: isDark ? colors.textSecondary : "#64748B",
              textAlign: "center",
              marginBottom: 28,
              lineHeight: 22,
              maxWidth: 300,
            }}
          >
            {isHost
              ? "You haven't created a household group yet. Create your group to invite roommates and organize billing cycles."
              : "You are not a member of any active household yet. Join with an invite code from your host, or apply to become a Host to create your own group."}
          </Text>
          <View style={{ width: "100%", maxWidth: 320, gap: 12 }}>
            {isHost ? (
              <TouchableOpacity
                style={[
                  styles.primaryPillBtn,
                  isDark && { backgroundColor: colors.primary },
                ]}
                onPress={() => setViewMode("create")}
              >
                <Text style={styles.primaryPillBtnText}>+ Create Group</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.primaryPillBtn,
                  isDark && { backgroundColor: colors.primary },
                ]}
                onPress={() =>
                  onOpenHostApplication
                    ? onOpenHostApplication()
                    : setShowHostRequiredModal(true)
                }
              >
                <Feather
                  name="shield"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.primaryPillBtnText}>
                  Apply to Become a Host
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.primaryPillBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : "#EFF6FF",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#BFDBFE",
                },
              ]}
              onPress={() => setViewMode("join")}
            >
              <Text
                style={[
                  styles.primaryPillBtnText,
                  { color: isDark ? colors.accent : "#2563EB" },
                ]}
              >
                Join with Invite Code
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {renderHostRequiredModal()}
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW: GROUP DETAILS (Default View - Matched to Image)
  // --------------------------------------------------------------------------
  return (
    <View
      style={[
        styles.container,
        isDark && { backgroundColor: colors.background },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent={true}
        backgroundColor="transparent"
      />

      {/* Top Header with Circular Back Button */}
      <View
        style={[
          styles.navBarContainer,
          { paddingTop: topInset },
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <View style={styles.navBar}>
          <TouchableOpacity
            style={[
              styles.circleBackBtn,
              isDark && {
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
            onPress={onBack}
          >
            <Feather
              name="chevron-left"
              size={24}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>
          <Text style={[styles.navTitle, isDark && { color: colors.text }]}>
            Manage Group
          </Text>
          <TouchableOpacity
            style={[
              styles.iconNavBtn,
              isDark && {
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setShowMenu(true)}
          >
            <Feather
              name="more-vertical"
              size={22}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Group Selector Pills - Exactly matching user image */}
        <View style={styles.groupPillsContainer}>
          <TouchableOpacity style={[styles.groupPill, styles.groupPillActive]}>
            <Text style={[styles.groupPillTitle, styles.groupPillTitleActive]}>
              {currentGroupName}
            </Text>
            <Text style={[styles.groupPillSub, styles.groupPillSubActive]}>
              Active Group
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.groupPill,
              isDark && {
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {
              if (!isHost) {
                setShowHostRequiredModal(true);
              } else {
                setViewMode("create");
              }
            }}
          >
            <Text
              style={[styles.groupPillTitle, isDark && { color: colors.text }]}
            >
              {isHost ? "+ New Group" : "+ Add / Join"}
            </Text>
            <Text
              style={[
                styles.groupPillSub,
                isDark && { color: colors.textSecondary },
              ]}
            >
              {isHost ? "Create Group" : "Host Guarded"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Billing Cycle Section */}
        <View style={styles.sectionRow}>
          <Text
            style={[styles.sectionHeading, isDark && { color: colors.text }]}
          >
            Billing Cycle
          </Text>
          <TouchableOpacity onPress={() => setShowCreateCycleModal(true)}>
            <Text
              style={[
                styles.sectionActionText,
                isDark && { color: colors.accent },
              ]}
            >
              + Add Cycle
            </Text>
          </TouchableOpacity>
        </View>

        {cycles.length === 0 ? (
          /* Dashed Card for Empty Cycle - styled like image document upload */
          <TouchableOpacity
            style={[
              styles.emptyCycleDashedBox,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setShowCreateCycleModal(true)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.cycleIconBadge,
                isDark && { backgroundColor: colors.surfaceInset },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={24}
                color={isDark ? colors.accent : "#0F172A"}
              />
            </View>
            <Text
              style={[styles.emptyCycleTitle, isDark && { color: colors.text }]}
            >
              No Active Billing Cycle
            </Text>
            <Text
              style={[
                styles.emptyCycleSub,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Tap to create a billing cycle (Cycle Name, Start & End Date) to
              calculate roommate dues and track expenses.
            </Text>
            <View
              style={[
                styles.createCyclePillBtn,
                isDark && { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.createCyclePillBtnText}>
                + Create Billing Cycle
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          /* Horizontal Cycle Selector Pills */
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cycleChipsScroll}
            >
              {cycles.map((c) => {
                const isSelected =
                  c.billingCycleId === (activeCycle?.billingCycleId || "");
                return (
                  <TouchableOpacity
                    key={c.billingCycleId}
                    style={[
                      styles.cycleChip,
                      isDark && {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                      isSelected && styles.cycleChipActive,
                      isSelected &&
                        isDark && {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        },
                    ]}
                    onPress={() => setSelectedCycleId(c.billingCycleId)}
                  >
                    <Text
                      style={[
                        styles.cycleChipText,
                        isDark && { color: colors.textSecondary },
                        isSelected && styles.cycleChipTextActive,
                        isSelected && isDark && { color: "#FFFFFF" },
                      ]}
                    >
                      {c.name || "Cycle"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[
                  styles.cycleChip,
                  { borderStyle: "dashed" },
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setShowCreateCycleModal(true)}
              >
                <Text
                  style={[
                    styles.cycleChipText,
                    { color: isDark ? colors.accent : "#2563EB" },
                  ]}
                >
                  + New Cycle
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Date Range Badge for Selected Cycle & Host Actions */}
            {activeCycle && (
              <View style={{ marginVertical: 10 }}>
                <View style={styles.dateRangeRow}>
                  <View
                    style={[
                      styles.datePill,
                      isDark && {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name="calendar"
                      size={13}
                      color={isDark ? colors.accent : "#64748B"}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.datePillText,
                        isDark && { color: colors.text },
                      ]}
                    >
                      {formatShortDate(activeCycle.startDate)}
                    </Text>
                  </View>
                  <Feather
                    name="arrow-right"
                    size={14}
                    color={isDark ? colors.textMuted : "#94A3B8"}
                    style={{ marginHorizontal: 10 }}
                  />
                  <View
                    style={[
                      styles.datePill,
                      isDark && {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name="calendar"
                      size={13}
                      color={isDark ? colors.accent : "#64748B"}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.datePillText,
                        isDark && { color: colors.text },
                      ]}
                    >
                      {formatShortDate(activeCycle.endDate)}
                    </Text>
                  </View>
                </View>

                {isHost && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{
                      width: "100%",
                      marginTop: 6,
                    }}
                    contentContainerStyle={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 2,
                    }}
                  >
                    <TouchableOpacity
                      onPress={handleOpenEditCycle}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flexShrink: 0,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 14,
                        backgroundColor: isDark
                          ? "rgba(59, 130, 246, 0.15)"
                          : "#EFF6FF",
                        borderWidth: 1,
                        borderColor: isDark
                          ? "rgba(59, 130, 246, 0.3)"
                          : "#BFDBFE",
                      }}
                    >
                      <Feather
                        name="edit-2"
                        size={12}
                        color={isDark ? colors.accent : "#2563EB"}
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: isDark ? colors.accent : "#2563EB",
                        }}
                      >
                        Edit Cycle
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleTogglePaymentsLock}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flexShrink: 0,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 14,
                        backgroundColor: isPaymentsLocked
                          ? isDark
                            ? "rgba(245, 158, 11, 0.15)"
                            : "#FEF3C7"
                          : isDark
                            ? "rgba(16, 185, 129, 0.15)"
                            : "#DCFCE7",
                        borderWidth: 1,
                        borderColor: isPaymentsLocked
                          ? isDark
                            ? "rgba(245, 158, 11, 0.3)"
                            : "#FDE68A"
                          : isDark
                            ? "rgba(16, 185, 129, 0.3)"
                            : "#A7F3D0",
                      }}
                    >
                      <Feather
                        name={isPaymentsLocked ? "lock" : "unlock"}
                        size={12}
                        color={
                          isPaymentsLocked
                            ? isDark
                              ? "#FBBF24"
                              : "#B45309"
                            : isDark
                              ? "#34D399"
                              : "#15803D"
                        }
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: isPaymentsLocked
                            ? isDark
                              ? "#FBBF24"
                              : "#B45309"
                            : isDark
                              ? "#34D399"
                              : "#15803D",
                        }}
                      >
                        {isPaymentsLocked ? "Payments Locked" : "Payments Open"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleDeleteBillingCycle}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flexShrink: 0,
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 14,
                        backgroundColor: isDark
                          ? "rgba(220, 38, 38, 0.15)"
                          : "#FEF2F2",
                        borderWidth: 1,
                        borderColor: isDark
                          ? "rgba(220, 38, 38, 0.3)"
                          : "#FECACA",
                      }}
                    >
                      <Feather
                        name="trash-2"
                        size={12}
                        color={isDark ? colors.danger : "#DC2626"}
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: isDark ? colors.danger : "#DC2626",
                        }}
                      >
                        Delete Cycle
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        )}

        {/* Water Billing Configuration Card */}
        {householdId ? (
          <View
            style={[
              styles.waterConfigCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.waterConfigHeader}>
              <View
                style={[
                  styles.waterConfigIconWrap,
                  isDark && {
                    backgroundColor: "rgba(2, 132, 199, 0.15)",
                  },
                ]}
              >
                <Feather
                  name="droplet"
                  size={18}
                  color={isDark ? colors.accent : "#0284C7"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.waterConfigTitle,
                    isDark && { color: colors.text },
                  ]}
                >
                  Water Billing Configuration
                </Text>
                <Text
                  style={[
                    styles.waterConfigSub,
                    isDark && { color: colors.accent },
                  ]}
                >
                  {waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH"
                    ? `Flat Rate · ₱${((waterConfig?.fixedPerPersonAmountCentavos || 0) / 100).toFixed(2)} / resident / mo`
                    : waterConfig?.pricingModel === "FIXED_MONTHLY"
                      ? `Fixed Household · ₱${((waterConfig?.fixedMonthlyAmountCentavos || 0) / 100).toFixed(2)} / month`
                      : `Daily Attendance · ₱${((waterConfig?.rateCentavosPerPersonPerDay ?? 500) / 100).toFixed(2)} / person / day`}
                </Text>
              </View>
              {isHost && (
                <TouchableOpacity
                  style={[
                    styles.waterConfigEditBtn,
                    isDark && {
                      backgroundColor: "rgba(2, 132, 199, 0.15)",
                      borderColor: "rgba(2, 132, 199, 0.3)",
                    },
                  ]}
                  onPress={() => setShowWaterSettingsModal(true)}
                  activeOpacity={0.8}
                >
                  <Feather
                    name="settings"
                    size={13}
                    color={isDark ? colors.accent : "#0284C7"}
                  />
                </TouchableOpacity>
              )}
            </View>

            <View
              style={[
                styles.waterConfigDetailsRow,
                isDark && { borderTopColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.waterModeSummary,
                  isDark && { color: colors.textSecondary },
                ]}
                numberOfLines={2}
              >
                {waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH"
                  ? "Billed directly as a flat fee to each paying roommate. No calendar logging."
                  : waterConfig?.pricingModel === "FIXED_MONTHLY"
                    ? "Split equally across active paying roommates. No calendar logging."
                    : "Roommates mark daily stay on the Attendance Calendar."}
              </Text>
              <View
                style={[
                  styles.waterModeTag,
                  isDark && { backgroundColor: colors.surfaceInset },
                ]}
              >
                <Text
                  style={[
                    styles.waterModeTagText,
                    isDark && { color: colors.accent },
                  ]}
                >
                  {waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH"
                    ? "Flat Fee Mode"
                    : waterConfig?.pricingModel === "FIXED_MONTHLY"
                      ? "Household Split Mode"
                      : "Calendar Active"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Electricity Billing Configuration Card (Strictly Scoped to Selected Cycle) */}
        {householdId &&
        (cycleElectricityData || (!isSelectedCycleClosed && isHost)) ? (
          <View
            style={[
              styles.waterConfigCard,
              { marginTop: 8 },
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.waterConfigHeader}>
              <View
                style={[
                  styles.waterConfigIconWrap,
                  {
                    backgroundColor: isDark
                      ? "rgba(245, 158, 11, 0.16)"
                      : "#FEF3C7",
                  },
                ]}
              >
                <Feather
                  name="zap"
                  size={18}
                  color={isDark ? "#FBBF24" : "#D97706"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.waterConfigTitle,
                    isDark && { color: colors.text },
                  ]}
                >
                  Electricity Billing Configuration
                </Text>
                <Text
                  style={[
                    styles.waterConfigSub,
                    { color: isDark ? "#FBBF24" : "#D97706" },
                  ]}
                >
                  {cycleElectricityData
                    ? cycleElectricityData.hasReadings
                      ? `₱${(cycleElectricityData.rateCentavosPerKwh / 100).toFixed(2)} / kWh · ${cycleElectricityData.previousReadingKwh} → ${cycleElectricityData.currentReadingKwh} kWh (${cycleElectricityData.consumedKwh} kWh)`
                      : `Electricity Bill · ${formatPesos(cycleElectricityData.totalAmountCentavos)}`
                    : "Not configured for this cycle yet"}
                </Text>
              </View>
              {isHost && !isSelectedCycleClosed && (
                <TouchableOpacity
                  style={[
                    styles.waterConfigEditBtn,
                    {
                      backgroundColor: isDark
                        ? "rgba(245, 158, 11, 0.16)"
                        : "#FEF3C7",
                      borderColor: isDark
                        ? "rgba(245, 158, 11, 0.35)"
                        : "#FDE68A",
                    },
                  ]}
                  onPress={() => setShowElectricitySettingsModal(true)}
                  activeOpacity={0.8}
                >
                  <Feather
                    name="settings"
                    size={13}
                    color={isDark ? "#FBBF24" : "#D97706"}
                  />
                </TouchableOpacity>
              )}
            </View>

            <View
              style={[
                styles.waterConfigDetailsRow,
                isDark && { borderTopColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.waterModeSummary,
                  isDark && { color: colors.textSecondary },
                ]}
                numberOfLines={2}
              >
                {cycleElectricityData
                  ? cycleElectricityData.hasReadings
                    ? `(${cycleElectricityData.currentReadingKwh} - ${cycleElectricityData.previousReadingKwh} kWh) × ₱${(cycleElectricityData.rateCentavosPerKwh / 100).toFixed(2)}/kWh = ${formatPesos(cycleElectricityData.totalAmountCentavos)} split among payors.`
                    : `Total cycle electricity bill of ${formatPesos(cycleElectricityData.totalAmountCentavos)} split among active paying roommates.`
                  : "Tap the settings icon to set Previous Reading, Current Reading, and Rate per kWh for this cycle."}
              </Text>
              <View
                style={[
                  styles.waterModeTag,
                  {
                    backgroundColor: isDark
                      ? "rgba(245, 158, 11, 0.14)"
                      : "#FEF3C7",
                    borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#FDE68A",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.waterModeTagText,
                    { color: isDark ? "#FBBF24" : "#B45309" },
                  ]}
                >
                  {isSelectedCycleClosed
                    ? "Cycle Closed"
                    : cycleElectricityData
                      ? "Meter Based (kWh)"
                      : "Unconfigured"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Host Payment Methods Configuration Card */}
        {householdId && isHost && (
          <View
            style={[
              styles.waterConfigCard,
              { marginTop: 8 },
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.waterConfigHeader}>
              <View
                style={[
                  styles.waterConfigIconWrap,
                  {
                    backgroundColor: isDark
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(16, 185, 129, 0.1)",
                  },
                ]}
              >
                <Feather
                  name="credit-card"
                  size={18}
                  color={isDark ? colors.success : "#10B981"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.waterConfigTitle,
                    isDark && { color: colors.text },
                  ]}
                >
                  Payment Methods & QR
                </Text>
                <Text
                  style={[
                    styles.waterConfigSub,
                    isDark && { color: colors.success },
                  ]}
                >
                  {household?.paymentMethods &&
                  Array.isArray(household.paymentMethods) &&
                  household.paymentMethods.length > 0
                    ? `${household.paymentMethods.filter((m: any) => m.isEnabled !== false).length} Active Methods · QR Ready`
                    : "GCash, Maya, Bank Transfer, Cash"}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.waterConfigEditBtn,
                  isDark && {
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    borderColor: "rgba(16, 185, 129, 0.3)",
                  },
                ]}
                onPress={() =>
                  onOpenPaymentMethodConfiguration
                    ? onOpenPaymentMethodConfiguration()
                    : Alert.alert(
                        "Payment Configuration",
                        "Opening host payment methods setup...",
                      )
                }
                activeOpacity={0.8}
              >
                <Feather
                  name="settings"
                  size={13}
                  color={isDark ? colors.success : "#10B981"}
                />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.waterConfigDetailsRow,
                isDark && { borderTopColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.waterModeSummary,
                  isDark && { color: colors.textSecondary },
                ]}
                numberOfLines={2}
              >
                Upload payment QR codes or bank account numbers so payors can
                settle bills easily.
              </Text>
              <View
                style={[
                  styles.waterModeTag,
                  isDark && { backgroundColor: colors.surfaceInset },
                ]}
              >
                <Text
                  style={[
                    styles.waterModeTagText,
                    { color: isDark ? colors.success : "#059669" },
                  ]}
                >
                  QR & Accounts
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Two Metric Cards - Real Calculated Values (Zero if empty) */}
        <View style={styles.metricCardsRow}>
          <View
            style={[
              styles.metricCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.metricIconWrap,
                isDark && { backgroundColor: colors.surfaceInset },
              ]}
            >
              <Ionicons
                name="wallet-outline"
                size={20}
                color={isDark ? colors.accent : "#0F172A"}
              />
            </View>
            <Text
              style={[styles.metricValue, isDark && { color: colors.text }]}
            >
              {formatPesos(totalDuesCents)}
            </Text>
            <Text
              style={[
                styles.metricLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Total Dues
            </Text>
          </View>

          <View
            style={[
              styles.metricCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.metricIconWrap,
                isDark && { backgroundColor: colors.surfaceInset },
              ]}
            >
              <Ionicons
                name="receipt-outline"
                size={20}
                color={isDark ? colors.accent : "#0F172A"}
              />
            </View>
            <Text
              style={[styles.metricValue, isDark && { color: colors.text }]}
            >
              {formatPesos(totalExpenseCents)}
            </Text>
            <Text
              style={[
                styles.metricLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Total Expense
            </Text>
          </View>
        </View>

        {/* Expenses Section */}
        <View style={styles.sectionRow}>
          <Text
            style={[styles.sectionHeading, isDark && { color: colors.text }]}
          >
            Bills ({currentCycleExpenses.length})
          </Text>
          <TouchableOpacity
            onPress={() =>
              onOpenAddExpense
                ? onOpenAddExpense()
                : Alert.alert("Add Expense", "Opening expense modal...")
            }
          >
            <Text
              style={[
                styles.sectionActionText,
                isDark && { color: colors.accent },
              ]}
            >
              + Add
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.expenseBox,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {currentCycleExpenses.length === 0 ? (
            <View style={styles.emptyExpenseBox}>
              <Text
                style={[
                  styles.emptyExpenseText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                No expenses logged for this cycle yet.
              </Text>
              <TouchableOpacity
                style={[
                  styles.addExpenseInlineBtn,
                  isDark && {
                    backgroundColor: "rgba(59, 130, 246, 0.15)",
                  },
                ]}
                onPress={() =>
                  onOpenAddExpense
                    ? onOpenAddExpense()
                    : Alert.alert("Add Expense", "Opening expense modal...")
                }
              >
                <Text
                  style={[
                    styles.addExpenseInlineBtnText,
                    isDark && { color: colors.accent },
                  ]}
                >
                  + Add First Expense
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {(showAllBills
                ? currentCycleExpenses
                : currentCycleExpenses.slice(0, 5)
              ).map((exp) => {
                const isExpensePaid =
                  exp.status === "PAID" ||
                  exp.isPaid === true ||
                  allPayorsSettled;
                const catMeta = getCategoryMeta(exp.category);
                return (
                  <TouchableOpacity
                    key={exp.id}
                    style={[
                      styles.expenseItemRow,
                      isDark && { borderBottomColor: colors.border },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleExpensePress(exp)}
                  >
                    <View
                      style={[
                        styles.expenseCategoryIconWrap,
                        { backgroundColor: catMeta.bgColor },
                      ]}
                    >
                      <Feather
                        name={catMeta.featherIcon as any}
                        size={15}
                        color={catMeta.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text
                          style={[
                            styles.expenseItemTitle,
                            isDark && { color: colors.text },
                          ]}
                        >
                          {cleanBillTitle(exp.title, exp.category)}
                        </Text>
                        <View
                          style={[
                            isExpensePaid
                              ? styles.statusBadgePaid
                              : styles.statusBadgeUnpaid,
                            isDark && {
                              backgroundColor: isExpensePaid
                                ? "rgba(16, 185, 129, 0.16)"
                                : "rgba(239, 68, 68, 0.16)",
                              borderColor: isExpensePaid
                                ? "rgba(16, 185, 129, 0.3)"
                                : "rgba(239, 68, 68, 0.3)",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              isExpensePaid
                                ? styles.statusBadgeTextPaid
                                : styles.statusBadgeTextUnpaid,
                              isDark && {
                                color: isExpensePaid
                                  ? colors.success
                                  : colors.danger,
                              },
                            ]}
                          >
                            {isExpensePaid ? "PAID" : "UNPAID"}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.expenseItemSub,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        {isExpensePaid
                          ? `${exp.payerName || "Household"}`
                          : `Added by ${exp.payerName || "Host"}`}{" "}
                        • {formatShortDate(exp.date)}
                      </Text>
                      {(exp.notes || exp.consumedKwh !== undefined) && (
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: isDark ? colors.accent : "#0284C7",
                            marginTop: 2,
                          }}
                          numberOfLines={2}
                        >
                          {exp.notes ||
                            `Prev: ${exp.previousReadingKwh ?? 0} kWh → Curr: ${exp.currentReadingKwh ?? 0} kWh (${exp.consumedKwh ?? 0} kWh)`}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 5 }}>
                      <Text
                        style={[
                          styles.expenseItemAmount,
                          isDark && { color: colors.accent },
                        ]}
                      >
                        {formatPesos(exp.amountCents)}
                      </Text>
                      {isHost && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <TouchableOpacity
                            style={[
                              styles.billActionIconBtn,
                              isDark && {
                                backgroundColor: "rgba(59, 130, 246, 0.18)",
                                borderColor: "rgba(59, 130, 246, 0.35)",
                              },
                            ]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleOpenEditExpense(exp);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Edit bill"
                          >
                            <Feather
                              name="edit-2"
                              size={12}
                              color={isDark ? colors.accent : "#2563EB"}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.billActionIconBtn,
                              styles.billActionIconBtnDelete,
                              isDark && {
                                backgroundColor: "rgba(239, 68, 68, 0.18)",
                                borderColor: "rgba(239, 68, 68, 0.35)",
                              },
                            ]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteExpense(exp);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Delete bill"
                          >
                            <Feather
                              name="trash-2"
                              size={12}
                              color={isDark ? colors.danger : "#EF4444"}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {currentCycleExpenses.length > 5 && (
                <TouchableOpacity
                  style={[
                    styles.viewAllBillsBtn,
                    isDark && { borderTopColor: colors.border },
                  ]}
                  onPress={() => setShowAllBills((prev) => !prev)}
                >
                  <Text
                    style={[
                      styles.viewAllBillsBtnText,
                      isDark && { color: colors.accent },
                    ]}
                  >
                    {showAllBills
                      ? "Show Less"
                      : `View All Bills (${currentCycleExpenses.length})`}
                  </Text>
                  <Feather
                    name={showAllBills ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={isDark ? colors.accent : "#2563EB"}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Pending Join Requests (Requires Host Approval) */}
        {isHost && pendingRequests.length > 0 && (
          <View
            style={[
              styles.pendingRequestsContainer,
              isDark && {
                backgroundColor: colors.card,
                borderColor: "rgba(217, 119, 6, 0.3)",
              },
            ]}
          >
            <View style={styles.pendingRequestsHeader}>
              <View style={styles.pendingIconWrap}>
                <Feather name="clock" size={16} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.pendingRequestsTitle,
                    isDark && { color: colors.text },
                  ]}
                >
                  Pending Join Requests ({pendingRequests.length})
                </Text>
                <Text
                  style={[
                    styles.pendingRequestsSubtitle,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Roommates who used your invite code awaiting approval
                </Text>
              </View>
            </View>

            <View style={styles.pendingList}>
              {pendingRequests.map((req: any) => {
                const reqId = req.memberId || req.userId;
                const reqName = req.displayName || req.name || "Applicant";
                const isProcessing = processingRequestId === reqId;

                return (
                  <View
                    key={reqId}
                    style={[
                      styles.pendingRequestCard,
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        flex: 1,
                      }}
                    >
                      {req.profilePicture || req.photoURL ? (
                        <Image
                          source={{ uri: req.profilePicture || req.photoURL }}
                          style={styles.pendingAvatarImage}
                        />
                      ) : (
                        <View
                          style={[
                            styles.pendingAvatarFallback,
                            isDark && {
                              backgroundColor: "rgba(245, 158, 11, 0.2)",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pendingAvatarText,
                              isDark && { color: colors.accent },
                            ]}
                          >
                            {reqName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pendingMemberName,
                            isDark && { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {reqName}
                        </Text>
                        <Text
                          style={[
                            styles.pendingMemberEmail,
                            isDark && { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {req.email ||
                            req.phoneNumber ||
                            "Invite code applicant"}
                        </Text>
                        {req.requestedDate && (
                          <Text
                            style={[
                              styles.pendingMemberDate,
                              isDark && { color: colors.textMuted },
                            ]}
                          >
                            Requested: {formatShortDate(req.requestedDate)}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.pendingActionButtonsRow}>
                      <TouchableOpacity
                        style={[
                          styles.pendingApproveBtn,
                          isDark && { backgroundColor: colors.success },
                        ]}
                        disabled={isProcessing}
                        onPress={() => handleApproveRequest(reqId)}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Feather name="check" size={14} color="#FFFFFF" />
                            <Text style={styles.pendingApproveBtnText}>
                              Approve
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.pendingRejectBtn,
                          isDark && {
                            backgroundColor: "rgba(239, 68, 68, 0.15)",
                            borderColor: "rgba(239, 68, 68, 0.3)",
                          },
                        ]}
                        disabled={isProcessing}
                        onPress={() => {
                          setRejectingMember(req);
                          setRejectReason("");
                        }}
                      >
                        <Feather
                          name="x"
                          size={14}
                          color={isDark ? colors.danger : "#BE123C"}
                        />
                        <Text
                          style={[
                            styles.pendingRejectBtnText,
                            isDark && { color: colors.danger },
                          ]}
                        >
                          Reject
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Total Participants Section */}
        <View style={[styles.sectionRow, { marginTop: 24 }]}>
          <Text
            style={[styles.sectionHeading, isDark && { color: colors.text }]}
          >
            Total Participants ({participants.length})
          </Text>
          <TouchableOpacity onPress={() => setShowInviteModal(true)}>
            <Text
              style={[
                styles.sectionActionText,
                isDark && { color: colors.accent },
              ]}
            >
              + Invite
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.participantsList}>
          {participants.length === 0 ? (
            <View style={styles.emptyExpenseBox}>
              <Text
                style={[
                  styles.emptyExpenseText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                No roommates added yet.
              </Text>
            </View>
          ) : (
            participants.map((p) => (
              <View
                key={p.id}
                style={[
                  styles.participantCard,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.participantRow}>
                  <View
                    style={[
                      styles.participantAvatar,
                      isDark && { backgroundColor: colors.surfaceInset },
                    ]}
                  >
                    {p.profilePicture ? (
                      <Image
                        source={{ uri: p.profilePicture }}
                        style={styles.participantAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text
                        style={[
                          styles.participantAvatarText,
                          isDark && { color: colors.text },
                        ]}
                      >
                        {p.avatar}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={[
                          styles.participantName,
                          isDark && { color: colors.text },
                        ]}
                      >
                        {p.name}
                      </Text>
                      {p.role === "HOST" ? (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeText}>HOST</Text>
                        </View>
                      ) : p.role === "NON_PAYOR" ? (
                        <View style={styles.nonPayorBadge}>
                          <Text style={styles.nonPayorBadgeText}>
                            NON-PAYOR
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.payorBadge}>
                          <Text style={styles.payorBadgeText}>PAYOR</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.statusDotRow}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              p.status === "Settled"
                                ? isDark
                                  ? colors.success
                                  : "#10B981"
                                : isDark
                                  ? colors.danger
                                  : "#F43F5E",
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color:
                              p.status === "Settled"
                                ? isDark
                                  ? colors.success
                                  : "#059669"
                                : isDark
                                  ? colors.danger
                                  : "#E11D48",
                          },
                        ]}
                      >
                        {p.status}
                      </Text>
                      <Text
                        style={[
                          styles.participantSubInfo,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        {p.role === "NON_PAYOR"
                          ? "• Exempted"
                          : p.role === "HOST"
                            ? "• Host"
                            : "• Shares bills"}
                      </Text>
                    </View>
                    {p.role !== "NON_PAYOR" &&
                      p.waterShareCents !== undefined &&
                      p.waterShareCents > 0 && (
                        <View
                          style={[
                            styles.participantWaterBreakdownWrap,
                            isDark && {
                              backgroundColor: "rgba(2, 132, 199, 0.15)",
                              borderColor: "rgba(2, 132, 199, 0.3)",
                            },
                          ]}
                        >
                          <Feather
                            name="droplet"
                            size={11}
                            color={isDark ? colors.accent : "#0284C7"}
                          />
                          <Text
                            style={[
                              styles.participantWaterBreakdownText,
                              isDark && { color: colors.accent },
                            ]}
                          >
                            {formatPesos(p.waterShareCents)} (
                            {p.waterDaysPresent || 0}d own
                            {p.waterNonPayorCents && p.waterNonPayorCents > 0
                              ? ` + ${formatPesos(p.waterNonPayorCents)} NP`
                              : ""}
                            )
                          </Text>
                        </View>
                      )}
                    {p.role === "NON_PAYOR" && (
                      <View
                        style={[
                          styles.participantWaterBreakdownWrap,
                          isDark && {
                            backgroundColor: "rgba(100, 116, 139, 0.15)",
                            borderColor: "rgba(100, 116, 139, 0.3)",
                          },
                        ]}
                      >
                        <Feather
                          name="droplet"
                          size={11}
                          color={isDark ? colors.textMuted : "#64748B"}
                        />
                        <Text
                          style={[
                            styles.participantWaterBreakdownText,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          {p.waterDaysPresent || 0}d
                          {p.waterAllocationSummary
                            ? ` · ${p.waterAllocationSummary}`
                            : ""}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        styles.participantOwesText,
                        isDark && { color: colors.text },
                      ]}
                    >
                      {p.role === "NON_PAYOR"
                        ? "Exempt"
                        : p.owesCents > 0
                          ? formatPesos(p.owesCents)
                          : currentCycleExpenses.length === 0
                            ? formatPesos(0)
                            : "Settled"}
                    </Text>
                    <Text
                      style={[
                        styles.participantOwesSub,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      {p.role === "NON_PAYOR"
                        ? "Non-Payor"
                        : p.owesCents > 0
                          ? "Outstanding"
                          : currentCycleExpenses.length === 0
                            ? "Pending Bills"
                            : "Zero Dues"}
                    </Text>
                  </View>
                </View>

                {/* Host actions on member: Toggle Payor/Non-Payor & Delete */}
                {isHost && p.role !== "HOST" && (
                  <View
                    style={[
                      styles.hostActionButtonsRow,
                      isDark && { borderTopColor: colors.border },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.roleTogglePill,
                        isDark && {
                          backgroundColor: colors.surfaceInset,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => handleToggleMemberRole(p)}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name={p.role === "NON_PAYOR" ? "check-circle" : "slash"}
                        size={13}
                        color={
                          isDark
                            ? colors.accent
                            : p.role === "NON_PAYOR"
                              ? "#2563EB"
                              : "#7C3AED"
                        }
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        style={[
                          styles.roleTogglePillText,
                          {
                            color: isDark
                              ? colors.accent
                              : p.role === "NON_PAYOR"
                                ? "#2563EB"
                                : "#7C3AED",
                          },
                        ]}
                      >
                        {p.role === "NON_PAYOR"
                          ? "Switch to Payor"
                          : "Switch to Non-Payor"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.removeMemberPill,
                        isDark && {
                          backgroundColor: "rgba(220, 38, 38, 0.15)",
                          borderColor: "rgba(220, 38, 38, 0.3)",
                        },
                      ]}
                      onPress={() => handleRemoveMember(p)}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name="trash-2"
                        size={13}
                        color={isDark ? colors.danger : "#DC2626"}
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        style={[
                          styles.removeMemberPillText,
                          isDark && { color: colors.danger },
                        ]}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom Floating Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 14),
          },
          isDark && {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            style={[
              styles.primaryPillBtn,
              { flex: 1 },
              isDark && { backgroundColor: colors.primary },
            ]}
            onPress={() => setViewMode("edit")}
          >
            <Feather
              name="edit-2"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.primaryPillBtnText}>Edit Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryPillBtn,
              {
                flex: 1,
                backgroundColor: isDark
                  ? "rgba(59, 130, 246, 0.15)"
                  : "#EFF6FF",
                borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#BFDBFE",
              },
            ]}
            onPress={handleCopyInviteCode}
          >
            <Feather
              name="share-2"
              size={16}
              color={isDark ? colors.accent : "#2563EB"}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.secondaryPillBtnText,
                isDark && { color: colors.accent },
              ]}
            >
              Invite Code
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL: Create Billing Cycle */}
      {renderCreateCycleModal()}

      {/* MODAL: Edit Billing Cycle */}
      {renderEditCycleModal()}

      {/* MODAL: Invite Roommate */}
      {renderInviteModal()}

      {/* MODAL: Menu Actions */}
      {renderMenuModal()}

      {/* MODAL: Reject Join Request with Reason */}
      {renderRejectModal()}

      {/* MODAL: Host Required Guard Modal */}
      {renderHostRequiredModal()}

      {/* MODAL: Edit Expense / Bill (Host Only) */}
      {renderEditExpenseModal()}

      {/* MODAL: Water Billing Settings Modal */}
      {householdId ? (
        <WaterSettingsModal
          visible={showWaterSettingsModal}
          onClose={() => setShowWaterSettingsModal(false)}
          householdId={householdId}
          initialConfig={waterConfig}
          onSaved={() => {
            if (activeCycle?.billingCycleId) {
              mobileDataService
                .syncCycleWaterBill(householdId, activeCycle.billingCycleId)
                .catch(() => {});
            }
          }}
        />
      ) : null}

      {/* MODAL: Electricity Billing Settings Modal */}
      {householdId ? (
        <ElectricitySettingsModal
          visible={showElectricitySettingsModal}
          onClose={() => setShowElectricitySettingsModal(false)}
          householdId={householdId}
          billingCycleId={activeCycle?.billingCycleId}
          initialConfig={
            cycleElectricityData
              ? {
                  previousReadingKwh: cycleElectricityData.previousReadingKwh,
                  currentReadingKwh: cycleElectricityData.currentReadingKwh,
                  rateCentavosPerKwh: cycleElectricityData.rateCentavosPerKwh,
                }
              : {
                  previousReadingKwh: Number(
                    electricityConfig?.lastCurrentReadingKwh ??
                      electricityConfig?.currentReadingKwh ??
                      0,
                  ),
                  currentReadingKwh: Number(
                    electricityConfig?.lastCurrentReadingKwh ??
                      electricityConfig?.currentReadingKwh ??
                      0,
                  ),
                  rateCentavosPerKwh: Number(
                    electricityConfig?.rateCentavosPerKwh ?? 1200,
                  ),
                }
          }
          onSaved={() => {}}
        />
      ) : null}
    </View>
  );

  function renderCreateCycleModal() {
    return (
      <SmoothBottomSheetModal
        visible={showCreateCycleModal}
        onClose={() => setShowCreateCycleModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Create Billing Cycle"
        subtitle="Set up a billing cycle (e.g. monthly) to track rent, electricity, and water dues"
        icon={
          <Feather
            name="calendar"
            size={18}
            color={isDark ? colors.accent : "#2563EB"}
          />
        }
      >
        <View style={{ paddingTop: 4 }}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>
              Cycle Name
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
              value={cycleNameInput}
              onChangeText={setCycleNameInput}
              placeholder="e.g. October 2026 Cycle"
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Start Date (YYYY-MM-DD)
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
                value={cycleStartInput}
                onChangeText={setCycleStartInput}
                placeholder="2026-10-01"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                End Date (YYYY-MM-DD)
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
                value={cycleEndInput}
                onChangeText={setCycleEndInput}
                placeholder="2026-10-31"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryPillBtn,
              { marginTop: 24 },
              isDark && { backgroundColor: colors.primary },
            ]}
            onPress={handleCreateBillingCycle}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryPillBtnText}>Create Cycle</Text>
            )}
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>
    );
  }

  function renderEditCycleModal() {
    return (
      <SmoothBottomSheetModal
        visible={showEditCycleModal}
        onClose={() => setShowEditCycleModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Edit Billing Cycle"
        subtitle="Update cycle name, duration dates, or billing status"
        icon={
          <Feather
            name="edit-3"
            size={18}
            color={isDark ? colors.accent : "#2563EB"}
          />
        }
      >
        <View style={{ paddingTop: 4 }}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>
              Cycle Name
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
              value={editCycleName}
              onChangeText={setEditCycleName}
              placeholder="e.g. October 2026 Cycle"
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Start Date (YYYY-MM-DD)
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
                value={editCycleStart}
                onChangeText={setEditCycleStart}
                placeholder="2026-10-01"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                End Date (YYYY-MM-DD)
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
                value={editCycleEnd}
                onChangeText={setEditCycleEnd}
                placeholder="2026-10-31"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>
          </View>

          <View style={[styles.inputGroup, { marginTop: 14 }]}>
            <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>
              Status
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              {["ACTIVE", "FINALIZED", "ARCHIVED"].map((status) => {
                const isSelected = editCycleStatus === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      borderRadius: 12,
                      alignItems: "center",
                      backgroundColor: isSelected
                        ? isDark
                          ? "rgba(59, 130, 246, 0.2)"
                          : "#EFF6FF"
                        : isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                      borderWidth: 1,
                      borderColor: isSelected
                        ? isDark
                          ? colors.accent
                          : "#2563EB"
                        : isDark
                          ? colors.border
                          : "#E2E8F0",
                    }}
                    onPress={() => setEditCycleStatus(status)}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isSelected
                          ? isDark
                            ? colors.accent
                            : "#2563EB"
                          : isDark
                            ? colors.textSecondary
                            : "#64748B",
                      }}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryPillBtn,
              { marginTop: 24 },
              isDark && { backgroundColor: colors.primary },
            ]}
            onPress={handleUpdateBillingCycle}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryPillBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>
    );
  }

  function renderInviteModal() {
    return (
      <SmoothBottomSheetModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Invite Roommate"
        subtitle="Add a new resident to your household room"
        icon={
          <Feather
            name="user-plus"
            size={18}
            color={isDark ? colors.accent : "#2563EB"}
          />
        }
      >
        <View style={{ paddingTop: 4 }}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>
              Roommate Name
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
              value={inviteName}
              onChangeText={setInviteName}
              placeholder="e.g. John Doe"
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            />
          </View>

          <View style={[styles.inputGroup, { marginTop: 14 }]}>
            <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>
              Email or Phone (Optional)
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
              value={inviteContact}
              onChangeText={setInviteContact}
              placeholder="e.g. roommate@email.com or +63 912..."
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryPillBtn,
              { marginTop: 24 },
              isDark && { backgroundColor: colors.primary },
            ]}
            onPress={handleInviteRoommate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryPillBtnText}>Send Invitation</Text>
            )}
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>
    );
  }

  function renderMenuModal() {
    return (
      <SmoothBottomSheetModal
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Group Options"
        subtitle="Manage apartment details & memberships"
        icon={
          <Feather
            name="more-horizontal"
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
              setViewMode("edit");
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
                name="edit-3"
                size={18}
                color={isDark ? colors.accent : "#2563EB"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.menuItemText, isDark && { color: colors.text }]}
              >
                Edit Apartment & Members
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? colors.textSecondary : "#64748B",
                  marginTop: 2,
                }}
              >
                Update name, rent cost, and member list
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#94A3B8"}
            />
          </TouchableOpacity>

          {isHost && (
            <TouchableOpacity
              style={[
                styles.menuItem,
                isDark && { borderBottomColor: colors.border },
              ]}
              activeOpacity={0.7}
              onPress={() => {
                setShowMenu(false);
                if (onOpenPaymentMethodConfiguration) {
                  onOpenPaymentMethodConfiguration();
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
                    : "#ECFDF5",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Feather
                  name="credit-card"
                  size={18}
                  color={isDark ? colors.success : "#10B981"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.menuItemText,
                    isDark && { color: colors.text },
                  ]}
                >
                  Payment Methods & QR
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? colors.textSecondary : "#64748B",
                    marginTop: 2,
                  }}
                >
                  Configure QR codes, GCash, Maya & bank accounts
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={isDark ? colors.textMuted : "#94A3B8"}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.menuItem,
              isDark && { borderBottomColor: colors.border },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              setShowMenu(false);
              setShowCreateCycleModal(true);
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
                name="calendar"
                size={18}
                color={isDark ? colors.success : "#059669"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.menuItemText, isDark && { color: colors.text }]}
              >
                Create New Billing Cycle
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? colors.textSecondary : "#64748B",
                  marginTop: 2,
                }}
              >
                Start a new month or tracking period
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#94A3B8"}
            />
          </TouchableOpacity>

          {isHost ? (
            <TouchableOpacity
              style={[
                styles.menuItem,
                isDark && { borderBottomColor: colors.border },
              ]}
              activeOpacity={0.7}
              onPress={() => {
                setShowMenu(false);
                setViewMode("create");
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isDark
                    ? "rgba(124, 58, 237, 0.15)"
                    : "#FAF5FF",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Feather
                  name="plus-circle"
                  size={18}
                  color={isDark ? "#A78BFA" : "#7C3AED"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.menuItemText,
                    isDark && { color: colors.text },
                  ]}
                >
                  Create Another Group
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? colors.textSecondary : "#64748B",
                    marginTop: 2,
                  }}
                >
                  Add another unit or roommate property
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={isDark ? colors.textMuted : "#94A3B8"}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.menuItem,
                isDark && { borderBottomColor: colors.border },
              ]}
              activeOpacity={0.7}
              onPress={() => {
                setShowMenu(false);
                if (onOpenHostApplication) {
                  onOpenHostApplication();
                } else {
                  setShowHostRequiredModal(true);
                }
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
                  name="shield"
                  size={18}
                  color={isDark ? colors.accent : "#2563EB"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.menuItemText,
                    {
                      color: isDark ? colors.accent : "#2563EB",
                      fontWeight: "700",
                    },
                  ]}
                >
                  Apply to Become a Host
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? colors.textSecondary : "#64748B",
                    marginTop: 2,
                  }}
                >
                  Unlock host privileges to create groups
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={isDark ? colors.textMuted : "#94A3B8"}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.menuItem,
              isDark && { borderBottomColor: colors.border },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              setShowMenu(false);
              setViewMode("join");
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather
                name="link"
                size={18}
                color={isDark ? colors.text : "#0F172A"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.menuItemText, isDark && { color: colors.text }]}
              >
                Join with Code or Link
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? colors.textSecondary : "#64748B",
                  marginTop: 2,
                }}
              >
                Enter a code to join another apartment
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
            onPress={handleCopyInviteCode}
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
                name="copy"
                size={18}
                color={isDark ? colors.accent : "#2563EB"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.menuItemText,
                  {
                    color: isDark ? colors.accent : "#2563EB",
                    fontWeight: "700",
                  },
                ]}
              >
                Copy Household Code
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? colors.textSecondary : "#64748B",
                  marginTop: 2,
                }}
              >
                Share code with roommates
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
    );
  }

  function renderRejectModal() {
    if (!rejectingMember) return null;
    const reqName =
      rejectingMember.displayName || rejectingMember.name || "Applicant";
    const isProcessing = Boolean(processingRequestId);

    return (
      <SmoothBottomSheetModal
        visible={Boolean(rejectingMember)}
        onClose={() => setRejectingMember(null)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Decline Join Request"
        subtitle={`Please provide a reason for declining ${reqName}`}
        icon={<Feather name="alert-triangle" size={18} color="#BE123C" />}
      >
        <View style={{ paddingTop: 4 }}>
          <Text
            style={[styles.sheetSub, isDark && { color: colors.textSecondary }]}
          >
            The applicant will see this reason in their app so they understand
            why they were not approved.
          </Text>

          <TextInput
            style={[
              styles.textInput,
              { height: 90, textAlignVertical: "top", paddingTop: 10 },
              isDark && {
                backgroundColor: colors.surfaceInset,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="e.g. Unit is already at maximum capacity / Room code not intended for this tenant."
            placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            multiline
            numberOfLines={3}
            value={rejectReason}
            onChangeText={setRejectReason}
            autoFocus
          />

          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              style={[
                styles.secondaryPillBtn,
                { flex: 1 },
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setRejectingMember(null)}
              disabled={isProcessing}
            >
              <Text
                style={[
                  styles.secondaryPillBtnText,
                  isDark && { color: colors.text },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dangerPillBtn,
                { flex: 1 },
                isDark && { backgroundColor: colors.danger },
                (!rejectReason.trim() || isProcessing) && { opacity: 0.6 },
              ]}
              onPress={handleRejectRequest}
              disabled={!rejectReason.trim() || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.dangerPillBtnText}>Confirm Rejection</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SmoothBottomSheetModal>
    );
  }

  function renderHostRequiredModal() {
    return (
      <SmoothBottomSheetModal
        visible={showHostRequiredModal}
        onClose={() => setShowHostRequiredModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        showCloseBtn={true}
        maxHeight="90%"
      >
        <View style={{ alignItems: "center", paddingTop: 4 }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF",
              borderWidth: 2,
              borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#BFDBFE",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Feather
              name="shield"
              size={28}
              color={isDark ? colors.accent : "#2563EB"}
            />
          </View>
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
              marginBottom: 16,
            }}
          >
            Creating and managing household groups is restricted to verified
            Property Hosts. Non-hosts can join an existing room with an invite
            code.
          </Text>

          {/* Informational Guidance Box */}
          <View
            style={{
              backgroundColor: isDark ? colors.card : "#F8FAFC",
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
                  Property Hosts
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
                color={isDark ? colors.success : "#059669"}
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
                  Roommates / Residents
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: isDark ? colors.textSecondary : "#64748B",
                    marginTop: 1,
                    lineHeight: 15,
                  }}
                >
                  Ask your property host for your room’s invite code (e.g.
                  PF-402) to join immediately.
                </Text>
              </View>
            </View>
          </View>

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
                Alert.alert(
                  "Host Application",
                  "Navigate to Settings / Profile to submit a Host application.",
                );
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
              backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF",
              borderWidth: 1,
              borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#BFDBFE",
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
              setViewMode("join");
            }}
          >
            <Feather
              name="hash"
              size={15}
              color={isDark ? colors.accent : "#2563EB"}
            />
            <Text
              style={{
                color: isDark ? colors.accent : "#2563EB",
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              Join with Invite Code
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ paddingVertical: 8 }}
            onPress={() => setShowHostRequiredModal(false)}
          >
            <Text
              style={{
                color: isDark ? colors.textSecondary : "#94A3B8",
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>
    );
  }

  function renderEditExpenseModal() {
    if (!editingExpense) return null;
    return (
      <SmoothBottomSheetModal
        visible={showEditExpenseModal}
        onClose={() => {
          if (!isUpdatingExpense) {
            setShowEditExpenseModal(false);
            setEditingExpense(null);
          }
        }}
        variant="bottom-sheet"
        showChipBar={true}
        title="Edit Bill"
        subtitle="Update bill name, category, amount, or status"
        icon={
          <Feather
            name="edit-3"
            size={18}
            color={isDark ? colors.accent : "#2563EB"}
          />
        }
      >
        <ScrollView
          style={{ maxHeight: 520 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingTop: 4, paddingBottom: 24 }}>
            {/* Bill Title Input */}
            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Bill Title
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
                value={editExpenseTitle}
                onChangeText={setEditExpenseTitle}
                placeholder="e.g. Meralco Electric Bill"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>

            {/* Category Selector */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Category
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {BILL_CATEGORIES.map((cat) => {
                  const isSelected = editExpenseCategory === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categorySelectChip,
                        isSelected && {
                          backgroundColor: isDark
                            ? cat.darkBgColor
                            : cat.bgColor,
                          borderColor: cat.color,
                        },
                        isDark &&
                          !isSelected && {
                            backgroundColor: colors.surfaceInset,
                            borderColor: colors.border,
                          },
                      ]}
                      onPress={() => setEditExpenseCategory(cat.name)}
                    >
                      <Feather
                        name={cat.featherIcon as any}
                        size={13}
                        color={
                          isSelected
                            ? cat.color
                            : isDark
                              ? colors.textSecondary
                              : "#64748B"
                        }
                      />
                      <Text
                        style={[
                          styles.categorySelectChipText,
                          isSelected && {
                            color: cat.color,
                            fontWeight: "700",
                          },
                          isDark &&
                            !isSelected && {
                              color: colors.textSecondary,
                            },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Amount Input */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Total Amount (₱)
              </Text>
              <View
                style={[
                  styles.currencyInputWrap,
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.currencySymbolBadge,
                    isDark && { borderRightColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.currencySymbolText,
                      isDark && { color: colors.accent },
                    ]}
                  >
                    ₱
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.currencyInputField,
                    isDark && { color: colors.text },
                  ]}
                  value={editExpenseAmount}
                  onChangeText={setEditExpenseAmount}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Status (PAID / UNPAID) */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Payment Status
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={[
                    styles.statusToggleBtn,
                    editExpenseStatus === "UNPAID" &&
                      styles.statusToggleBtnActiveUnpaid,
                    isDark &&
                      editExpenseStatus !== "UNPAID" && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                      },
                    isDark &&
                      editExpenseStatus === "UNPAID" && {
                        backgroundColor: "rgba(239, 68, 68, 0.16)",
                        borderColor: "rgba(239, 68, 68, 0.5)",
                      },
                  ]}
                  onPress={() => setEditExpenseStatus("UNPAID")}
                >
                  <View
                    style={[
                      styles.statusToggleDot,
                      { backgroundColor: "#EF4444" },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusToggleBtnText,
                      editExpenseStatus === "UNPAID" && {
                        color: "#EF4444",
                        fontWeight: "700",
                      },
                      isDark &&
                        editExpenseStatus !== "UNPAID" && {
                          color: colors.textSecondary,
                        },
                    ]}
                  >
                    UNPAID (Upcoming)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusToggleBtn,
                    editExpenseStatus === "PAID" &&
                      styles.statusToggleBtnActivePaid,
                    isDark &&
                      editExpenseStatus !== "PAID" && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                      },
                    isDark &&
                      editExpenseStatus === "PAID" && {
                        backgroundColor: "rgba(16, 185, 129, 0.16)",
                        borderColor: "rgba(16, 185, 129, 0.5)",
                      },
                  ]}
                  onPress={() => setEditExpenseStatus("PAID")}
                >
                  <View
                    style={[
                      styles.statusToggleDot,
                      { backgroundColor: "#10B981" },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusToggleBtnText,
                      editExpenseStatus === "PAID" && {
                        color: "#10B981",
                        fontWeight: "700",
                      },
                      isDark &&
                        editExpenseStatus !== "PAID" && {
                          color: colors.textSecondary,
                        },
                    ]}
                  >
                    PAID (Settled)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Billing Cycle Selector (if cycles exist) */}
            {cycles.length > 0 && (
              <View style={[styles.inputGroup, { marginTop: 14 }]}>
                <Text
                  style={[styles.inputLabel, isDark && { color: colors.text }]}
                >
                  Billing Cycle
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                >
                  {cycles.map((c) => {
                    const isSelected = editExpenseCycleId === c.billingCycleId;
                    return (
                      <TouchableOpacity
                        key={c.billingCycleId}
                        style={[
                          styles.cycleSelectChip,
                          isSelected && styles.cycleSelectChipActive,
                          isDark &&
                            !isSelected && {
                              backgroundColor: colors.surfaceInset,
                              borderColor: colors.border,
                            },
                          isDark &&
                            isSelected && {
                              backgroundColor: "rgba(59, 130, 246, 0.2)",
                              borderColor: colors.accent,
                            },
                        ]}
                        onPress={() => setEditExpenseCycleId(c.billingCycleId)}
                      >
                        <Feather
                          name="calendar"
                          size={12}
                          color={
                            isSelected
                              ? isDark
                                ? colors.accent
                                : "#2563EB"
                              : isDark
                                ? colors.textSecondary
                                : "#64748B"
                          }
                        />
                        <Text
                          style={[
                            styles.cycleSelectChipText,
                            isSelected && {
                              color: isDark ? colors.accent : "#2563EB",
                              fontWeight: "700",
                            },
                            isDark &&
                              !isSelected && {
                                color: colors.textSecondary,
                              },
                          ]}
                        >
                          {c.cycleName || "Cycle"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Notes / Details */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Notes & Description (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { minHeight: 65, textAlignVertical: "top" },
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={editExpenseNotes}
                onChangeText={setEditExpenseNotes}
                placeholder="Invoice number, meter readings, or notes..."
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                multiline
              />
            </View>

            {/* Split Members Info */}
            {editExpenseSplitDetails && editExpenseSplitDetails.length > 0 && (
              <View
                style={[
                  styles.splitPreviewCard,
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <Feather
                    name="users"
                    size={13}
                    color={isDark ? colors.accent : "#2563EB"}
                  />
                  <Text
                    style={[
                      styles.splitPreviewTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    Split Breakdown ({editExpenseSplitMethod})
                  </Text>
                </View>
                {editExpenseSplitDetails.map((s, idx) => (
                  <View key={s.userId || idx} style={styles.splitPreviewRow}>
                    <Text
                      style={[
                        styles.splitPreviewMemberName,
                        isDark && { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {s.displayName || "Roommate"}{" "}
                      {s.isExempt ? "(Exempt)" : ""}
                    </Text>
                    <Text
                      style={[
                        styles.splitPreviewShare,
                        isDark && { color: colors.text },
                      ]}
                    >
                      {s.isExempt ? "₱0.00" : formatPesos(s.shareCentavos)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.primaryPillBtn,
                { marginTop: 22 },
                isDark && { backgroundColor: colors.primary },
              ]}
              onPress={handleSaveEditExpense}
              disabled={isUpdatingExpense}
            >
              {isUpdatingExpense ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryPillBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            {/* Delete Button (Host Option) */}
            <TouchableOpacity
              style={[
                styles.deleteBillBtn,
                { marginTop: 12 },
                isDark && {
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                },
              ]}
              onPress={() => {
                if (editingExpense) {
                  handleDeleteExpense(editingExpense);
                }
              }}
              disabled={isUpdatingExpense}
            >
              <Feather
                name="trash-2"
                size={15}
                color={isDark ? colors.danger : "#EF4444"}
              />
              <Text
                style={[
                  styles.deleteBillBtnText,
                  isDark && { color: colors.danger },
                ]}
              >
                Delete This Bill
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SmoothBottomSheetModal>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
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
    // borderBottomWidth: 1,
    // borderBottomColor: "#F1F5F9",
    // backgroundColor: "#FFFFFF",
  },
  circleBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  // Top Group Selector Pills - Exactly matching screenshot
  groupPillsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  groupPill: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  groupPillActive: {
    backgroundColor: "#2563EB",
  },
  groupPillTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
  },
  groupPillTitleActive: {
    color: "#FFFFFF",
  },
  groupPillSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  groupPillSubActive: {
    color: "rgba(255,255,255,0.85)",
  },
  // Cycle chips
  cycleChipsScroll: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 8,
  },
  cycleChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cycleChipActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  cycleChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  cycleChipTextActive: {
    color: "#2563EB",
  },
  // Empty Cycle Dashed Box
  emptyCycleDashedBox: {
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 20,
    alignItems: "center",
    marginVertical: 8,
  },
  cycleIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyCycleTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 6,
  },
  emptyCycleSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 14,
  },
  createCyclePillBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createCyclePillBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  // Metric Cards
  metricCardsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    // shadowColor: "#000",
    // shadowOpacity: 0.03,
    // shadowRadius: 8,
    // shadowOffset: { width: 0, height: 2 },
    // elevation: 2,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  expenseBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  emptyExpenseBox: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyExpenseText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  addExpenseInlineBtn: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 10,
  },
  addExpenseInlineBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },
  expenseItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  expenseCategoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  expenseItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  expenseItemSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  expenseItemAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563EB",
    marginLeft: 8,
  },
  statusBadgeUnpaid: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  statusBadgeTextUnpaid: {
    color: "#B91C1C",
    fontSize: 6,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusBadgePaid: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  statusBadgeTextPaid: {
    color: "#047857",
    fontSize: 6,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  billActionIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  billActionIconBtnDelete: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  viewAllBillsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  viewAllBillsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  categorySelectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categorySelectChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  currencyInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  currencySymbolBadge: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  currencySymbolText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2563EB",
  },
  currencyInputField: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  statusToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusToggleBtnActiveUnpaid: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  statusToggleBtnActivePaid: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  statusToggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusToggleBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  cycleSelectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cycleSelectChipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  cycleSelectChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  splitPreviewCard: {
    marginTop: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  splitPreviewTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
  },
  splitPreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  splitPreviewMemberName: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },
  splitPreviewShare: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    marginLeft: 8,
  },
  deleteBillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  deleteBillBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#EF4444",
  },
  participantsList: {
    gap: 10,
  },
  participantCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  participantAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
  },
  participantName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  hostBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hostBadgeText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#1E40AF",
  },
  payorBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  payorBadgeText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#B45309",
  },
  nonPayorBadge: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nonPayorBadgeText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#7E22CE",
  },
  participantRoleTag: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    flexWrap: "wrap",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  participantSubInfo: {
    fontSize: 11,
    color: "#64748B",
    marginLeft: 4,
  },
  participantWaterBreakdownWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 5,
    alignSelf: "flex-start",
    gap: 4,
  },
  participantWaterBreakdownText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#0369A1",
  },
  participantOwesText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  participantOwesSub: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 2,
  },
  hostActionButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  roleTogglePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  roleTogglePillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  removeMemberPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  removeMemberPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  editModeToggleRoleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  editModeToggleRoleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  deleteParticipantBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 14,
    // borderTopWidth: 1,
    // borderTopColor: "#F1F5F9",
  },
  primaryPillBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  primaryPillBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryPillBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  secondaryPillBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563EB",
  },
  inputGroup: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  addedMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  memberSmallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  memberSmallAvatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  addedMemberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  inviteInputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  inviteInnerBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  inviteTextInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  inviteBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  badgeWrapper: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 28,
  },
  starBadgeCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  sparkleDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 10,
  },
  successSub: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  sheetSub: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 12,
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
  participantAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  pendingRequestsContainer: {
    backgroundColor: "#FFFBEB",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    marginTop: 20,
    marginBottom: 8,
  },
  pendingRequestsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  pendingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingRequestsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#92400E",
  },
  pendingRequestsSubtitle: {
    fontSize: 11,
    color: "#B45309",
    marginTop: 1,
  },
  pendingList: {
    gap: 10,
  },
  pendingRequestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FEF3C7",
    gap: 10,
  },
  pendingAvatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  pendingAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingAvatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#92400E",
  },
  pendingMemberName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  pendingMemberEmail: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  pendingMemberDate: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  pendingActionButtonsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  pendingApproveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  pendingApproveBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  pendingRejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  pendingRejectBtnText: {
    color: "#BE123C",
    fontSize: 12,
    fontWeight: "800",
  },
  dangerPillBtn: {
    backgroundColor: "#E11D48",
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerPillBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  waterConfigCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
    marginTop: 12,
  },
  waterConfigHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  waterConfigIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  waterConfigTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  waterConfigSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
    marginTop: 2,
  },
  waterConfigEditBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  waterConfigEditBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0284C7",
  },
  waterConfigDetailsRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },
  waterModeTag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  waterModeTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  waterModeSummary: {
    flex: 1,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },
});
