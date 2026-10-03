import React, { useEffect, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StatusBar,
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
import { getCategoryMeta } from "../services/categoryService";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { useTheme } from "../context/ThemeContext";

export interface ViewGroupScreenProps {
  onBack: () => void;
  onOpenSettleDues?: () => void;
  onOpenHostApplication?: () => void;
  currentUser?: {
    name: string;
    avatar: string;
    uid?: string;
    role?: string;
    email?: string;
  };
}

interface ParticipantInfo {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  profilePicture?: string;
  role: string;
  status: "Pending" | "Settled";
  owesCents: number;
  waterShareCents?: number;
  waterOwnCents?: number;
  waterNonPayorCents?: number;
  waterDaysPresent?: number;
  waterAllocationSummary?: string;
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const ViewGroupScreen: React.FC<ViewGroupScreenProps> = ({
  onBack,
  onOpenSettleDues,
  onOpenHostApplication,
  currentUser = { name: "Resident", avatar: "R" },
}) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    Platform.OS === "ios" ? 44 : 20,
  );

  const firebaseUser = auth.currentUser;
  const cachedProfile = mobileDataService.getCachedProfile(
    firebaseUser?.uid || currentUser?.uid,
  );
  const cachedHousehold = cachedProfile
    ? mobileDataService.getCachedHousehold()
    : null;

  const [profile, setProfile] = useState<any | null>(() => cachedProfile);
  const [household, setHousehold] = useState<any | null>(() => cachedHousehold);
  const [isProfileLoaded, setIsProfileLoaded] = useState<boolean>(() =>
    Boolean(cachedProfile),
  );
  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [cloudMembers, setCloudMembers] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [electricityConfig, setElectricityConfig] = useState<any | null>(null);
  const [userPhotosMap, setUserPhotosMap] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState<boolean>(true);

  // Join Group input for non-hosts who don't have a household yet
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  const householdId =
    profile?.householdId ||
    household?.householdId ||
    cachedProfile?.householdId ||
    "";

  useEffect(() => {
    let mounted = true;
    if (!firebaseUser?.uid) {
      setIsProfileLoaded(true);
      setLoading(false);
      return;
    }
    mobileDataService
      .getUserProfile(firebaseUser.uid)
      .then((p) => {
        if (mounted) {
          if (p) setProfile(p);
          setIsProfileLoaded(true);
        }
      })
      .catch(() => {
        if (mounted) setIsProfileLoaded(true);
      });
    const unsubProfile = mobileDataService.listenToUserProfile(
      firebaseUser.uid,
      (p) => {
        if (mounted) {
          if (p) {
            setProfile(p);
            if (!p.householdId) setHousehold(null);
          }
          setIsProfileLoaded(true);
        }
      },
    );
    return () => {
      mounted = false;
      unsubProfile();
    };
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!isProfileLoaded) {
      return;
    }

    if (!householdId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const groupReady = {
      household: false,
      expenses: false,
      cycles: false,
      members: false,
    };

    const checkReady = () => {
      if (
        groupReady.household &&
        groupReady.expenses &&
        groupReady.cycles &&
        groupReady.members
      ) {
        setLoading(false);
      }
    };

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubHh = mobileDataService.listenToHousehold(householdId, (hh) => {
      if (hh) setHousehold(hh);
      groupReady.household = true;
      checkReady();
    });
    const unsubExp = mobileDataService.listenToExpenses(
      householdId,
      (loadedExpenses) => {
        setExpenses(loadedExpenses);
        groupReady.expenses = true;
        checkReady();
      },
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
        groupReady.cycles = true;
        checkReady();
      },
    );
    const unsubMem = mobileDataService.listenToHouseholdMembers(
      householdId,
      (loadedMembers) => {
        setCloudMembers(loadedMembers);
        groupReady.members = true;
        checkReady();
      },
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
      clearTimeout(safetyTimer);
      unsubHh();
      unsubExp();
      unsubCyc();
      unsubMem();
      unsubWater();
      unsubElec();
    };
  }, [householdId, isProfileLoaded]);

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
    "My Household";

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

  const totalExpenseCents = useMemo(() => {
    return currentCycleExpenses.reduce(
      (sum, e) => sum + (e.amountCents || 0),
      0,
    );
  }, [currentCycleExpenses]);

  const unpaidCycleExpenses = currentCycleExpenses.filter(
    (e) => e.status !== "PAID" && !e.isPaid,
  );

  const activeMembersList = cloudMembers.filter((m) => m.status === "ACTIVE");
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

  // Auto-heal in ViewGroupScreen if payors changed or water splits need update
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

  const participants: ParticipantInfo[] = useMemo(() => {
    if (activeMembersList.length === 0) return [];
    return activeMembersList.map((m) => {
      const uid = m.userId || m.memberId;
      const userBill = uniqueBills.find((b) => matchesMemberUid(m, b.userId));
      const isPayor = isPayorMember(m);
      let owes = 0;
      let totalCycleShare = 0;
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
          const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
          memberWaterOwn =
            waterMember?.ownWaterCentavos ?? memberWaterDays * rate;
          memberWaterNonPayor = waterMember?.nonPayorWaterCentavos ?? 0;
          memberWaterShare =
            waterMember?.shareCentavos ?? memberWaterOwn + memberWaterNonPayor;
        } else if (waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH") {
          const flat = Number(waterConfig?.fixedPerPersonAmountCentavos || 0);
          memberWaterShare = flat;
          memberWaterOwn = flat;
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

        totalCycleShare = currentCycleExpenses.reduce((sum, e) => {
          const isWater = (e.category || "").toLowerCase().includes("water");
          if (isWater) {
            return sum + memberWaterShare;
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
            (splitPayors.length > 0 && splitPayors.length !== payorCount) ||
            (splitPayors.length > 0 && splitPayorsSum !== e.amountCents);
          if (
            !isSplitStale &&
            e.splitDetails &&
            Array.isArray(e.splitDetails) &&
            e.splitDetails.length > 0
          ) {
            const mySplit = e.splitDetails.find((s: any) =>
              matchesMemberUid(m, s.userId),
            );
            if (mySplit && typeof mySplit.shareCentavos === "number") {
              return sum + mySplit.shareCentavos;
            }
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

        const liveShare = unpaidCycleExpenses.reduce((sum, e) => {
          const isWater = (e.category || "").toLowerCase().includes("water");
          if (isWater) {
            return sum + memberWaterShare;
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
            (splitPayors.length > 0 && splitPayors.length !== payorCount) ||
            (splitPayors.length > 0 && splitPayorsSum !== e.amountCents);
          if (
            !isSplitStale &&
            e.splitDetails &&
            Array.isArray(e.splitDetails) &&
            e.splitDetails.length > 0
          ) {
            const mySplit = e.splitDetails.find((s: any) =>
              matchesMemberUid(m, s.userId),
            );
            if (mySplit && typeof mySplit.shareCentavos === "number") {
              return sum + mySplit.shareCentavos;
            }
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

        const paidCentavos =
          userBill && typeof userBill.totalPaidCentavos === "number"
            ? userBill.totalPaidCentavos
            : 0;
        owes = Math.max(0, liveShare - paidCentavos);
      } else {
        // Non-payor member
        memberWaterShare = 0;
        memberWaterOwn = 0;
        memberWaterNonPayor = 0;
      }

      const paidForCycle =
        userBill && typeof userBill.totalPaidCentavos === "number"
          ? userBill.totalPaidCentavos
          : 0;
      const isPayorCycleSettled =
        !isPayor ||
        (totalCycleShare > 0 &&
          owes === 0 &&
          (paidForCycle > 0 ||
            currentCycleExpenses.every(
              (e) => e.status === "PAID" || e.isPaid,
            )));

      const isCurrentUser =
        firebaseUser?.uid &&
        (m.userId === firebaseUser.uid || m.memberId === firebaseUser.uid);

      return {
        id: m.memberId || m.userId,
        userId: uid,
        name:
          m.displayName || m.name || (m.role === "HOST" ? "Host" : "Roommate"),
        avatar: (m.displayName || m.name || "R").charAt(0).toUpperCase(),
        profilePicture:
          m.profilePicture ||
          m.photoURL ||
          userPhotosMap[uid] ||
          (isCurrentUser ? myPhoto : undefined),
        role: m.role || "PAYOR",
        status: isPayorCycleSettled ? "Settled" : "Pending",
        owesCents: owes,
        waterShareCents: memberWaterShare,
        waterOwnCents: memberWaterOwn,
        waterNonPayorCents: memberWaterNonPayor,
        waterDaysPresent: memberWaterDays,
        waterAllocationSummary: waterMember?.nonPayorAllocationSummary || "",
      };
    });
  }, [
    activeMembersList,
    activePayorsList,
    uniqueBills,
    currentCycleExpenses,
    unpaidCycleExpenses,
    cycleWaterExpense,
    cycleWaterBreakdown,
    waterConfig,
    payorCount,
    userPhotosMap,
    myPhoto,
    firebaseUser?.uid,
  ]);

  const myParticipant = participants.find(
    (p) => p.userId === firebaseUser?.uid || p.id === firebaseUser?.uid,
  );
  const myDuesCents = myParticipant ? myParticipant.owesCents : 0;

  const payingParticipants = participants.filter((p) => p.role !== "NON_PAYOR");
  const allPayorsSettled =
    currentCycleExpenses.length > 0 &&
    payingParticipants.length > 0 &&
    payingParticipants.every(
      (p) => p.status === "Settled" && p.owesCents === 0,
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

  const hostMember =
    activeMembersList.find((m) => m.role === "HOST") ||
    (household?.hostName ? { displayName: household.hostName } : null);

  const handleJoinGroup = async () => {
    const clean = joinCodeInput.trim();
    if (!clean) {
      Alert.alert(
        "Invite Code Required",
        "Please enter your household's invite code.",
      );
      return;
    }
    if (!firebaseUser?.uid) return;

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
      setJoinCodeInput("");
      Alert.alert(
        "Join Request Sent",
        `Your request to join "${result.household?.householdName || "the household"}" has been sent to the host for approval.`,
      );
    } else {
      Alert.alert(
        "Unable to Join",
        result.error || "No household found with that invite code.",
      );
    }
  };

  if (loading) {
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
                  borderColor: colors.border,
                  borderWidth: 1,
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
              Group Overview
            </Text>
          </View>
        </View>
        <UniversalSkeleton type="groups" />
      </View>
    );
  }

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
          translucent
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
                  borderColor: colors.border,
                  borderWidth: 1,
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
              Join a Group
            </Text>
            <View style={{ width: 42 }} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.infoHeroCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.infoHeroIconWrap,
                isDark && { backgroundColor: colors.primaryLight },
              ]}
            >
              <Feather
                name="users"
                size={26}
                color={isDark ? colors.accent : "#2563EB"}
              />
            </View>
            <Text
              style={[styles.infoHeroTitle, isDark && { color: colors.text }]}
            >
              No Active Household
            </Text>
            <Text
              style={[
                styles.infoHeroSub,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Enter the invite code shared by your property host to join your
              household group and view shared bills.
            </Text>

            <View style={{ width: "100%", marginTop: 18 }}>
              <Text
                style={[
                  styles.inputLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Household Invite Code
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
                value={joinCodeInput}
                onChangeText={setJoinCodeInput}
                placeholder="e.g. PF-402"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[
                  styles.primaryPillBtn,
                  { marginTop: 14 },
                  isDark && {
                    backgroundColor: colors.primary,
                    shadowColor: colors.primary,
                  },
                ]}
                onPress={handleJoinGroup}
                disabled={joinLoading}
              >
                {joinLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryPillBtnText}>
                    Request to Join Group
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {onOpenHostApplication && (
              <TouchableOpacity
                style={[
                  styles.secondaryOutlineBtn,
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                  },
                ]}
                onPress={onOpenHostApplication}
              >
                <Feather
                  name="shield"
                  size={15}
                  color={isDark ? colors.accent : "#2563EB"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.secondaryOutlineBtnText,
                    isDark && { color: colors.accent },
                  ]}
                >
                  Apply to Become a Host Instead
                </Text>
              </TouchableOpacity>
            )}
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
        translucent
        backgroundColor="transparent"
      />

      {/* Top Header - Informational Only (No Edit/Manage Menu) */}
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
                borderColor: colors.border,
                borderWidth: 1,
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
            Group Overview
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Household Information Banner Card */}
        <View
          style={[
            styles.householdSummaryCard,
            isDark && {
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              shadowOpacity: 0,
              elevation: 0,
            },
          ]}
        >
          <View style={styles.householdSummaryTopRow}>
            <View
              style={[
                styles.householdIconBadge,
                isDark && { backgroundColor: colors.primaryLight },
              ]}
            >
              <Feather
                name="home"
                size={22}
                color={isDark ? colors.accent : "#FFFFFF"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.householdNameText,
                  isDark && { color: colors.text },
                ]}
                numberOfLines={1}
              >
                {currentGroupName}
              </Text>
              <Text
                style={[
                  styles.householdHostSubText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Hosted by{" "}
                {hostMember?.displayName ||
                  hostMember?.name ||
                  household?.hostName ||
                  "Property Host"}
              </Text>
            </View>
            <View
              style={[
                styles.memberRolePill,
                isDark && { backgroundColor: "rgba(59, 130, 246, 0.15)" },
              ]}
            >
              <Text
                style={[
                  styles.memberRolePillText,
                  isDark && { color: colors.accent },
                ]}
              >
                {myParticipant?.role === "NON_PAYOR" ? "NON-PAYOR" : "PAYOR"}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.householdDivider,
              isDark && { backgroundColor: colors.border },
            ]}
          />

          <View style={styles.householdMetaRow}>
            <View style={styles.householdMetaItem}>
              <Feather
                name="users"
                size={14}
                color={isDark ? colors.accent : "#DBEAFE"}
              />
              <Text
                style={[
                  styles.householdMetaText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                {participants.length} Active{" "}
                {participants.length === 1 ? "Member" : "Members"}
              </Text>
            </View>
            <View style={styles.householdMetaItem}>
              <Feather
                name="calendar"
                size={14}
                color={isDark ? colors.accent : "#DBEAFE"}
              />
              <Text
                style={[
                  styles.householdMetaText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                {activeCycle ? activeCycle.name || "Active Cycle" : "No Cycle"}
              </Text>
            </View>
          </View>
        </View>

        {/* Billing Cycle Section (Informational Only - No Add/Edit/Delete Buttons) */}
        <View style={styles.sectionRow}>
          <Text
            style={[styles.sectionHeading, isDark && { color: colors.text }]}
          >
            Billing Cycle
          </Text>
          {activeCycle?.status && (
            <View
              style={[
                styles.cycleStatusBadge,
                isDark && {
                  backgroundColor: "rgba(16, 185, 129, 0.16)",
                },
              ]}
            >
              <Text
                style={[
                  styles.cycleStatusBadgeText,
                  isDark && { color: colors.success },
                ]}
              >
                {activeCycle.status}
              </Text>
            </View>
          )}
        </View>

        {cycles.length === 0 ? (
          <View
            style={[
              styles.emptyInfoCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={24}
              color={isDark ? colors.textMuted : "#64748B"}
            />
            <Text
              style={[styles.emptyInfoTitle, isDark && { color: colors.text }]}
            >
              No Active Billing Cycle
            </Text>
            <Text
              style={[
                styles.emptyInfoSub,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Your household host has not started a billing cycle yet.
            </Text>
          </View>
        ) : (
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
                      isSelected &&
                        (isDark
                          ? {
                              backgroundColor: colors.primary,
                              borderColor: colors.primary,
                            }
                          : styles.cycleChipActive),
                    ]}
                    onPress={() => setSelectedCycleId(c.billingCycleId)}
                  >
                    <Text
                      style={[
                        styles.cycleChipText,
                        isDark && { color: colors.textSecondary },
                        isSelected && [
                          styles.cycleChipTextActive,
                          isDark && { color: "#FFFFFF" },
                        ],
                      ]}
                    >
                      {c.name || "Cycle"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activeCycle && (
              <View style={styles.dateRangeRow}>
                <View
                  style={[
                    styles.datePill,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
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
                      isDark && { color: colors.textSecondary },
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
                      backgroundColor: colors.surfaceInset,
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
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    {formatShortDate(activeCycle.endDate)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Water Billing Info Card (Read-Only - No Configure Button) */}
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
                isDark && { backgroundColor: "rgba(59, 130, 246, 0.15)" },
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
                Water Billing Rule
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
                ? "Each paying roommate is billed a fixed monthly water rate."
                : waterConfig?.pricingModel === "FIXED_MONTHLY"
                  ? "Water bill is split equally among paying roommates."
                  : "Calculated from daily attendance logged in the calendar."}
            </Text>
            <View
              style={[
                styles.waterModeTag,
                isDark && {
                  backgroundColor: "rgba(59, 130, 246, 0.12)",
                  borderColor: "rgba(59, 130, 246, 0.25)",
                },
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
                    ? "Equal Split Mode"
                    : "Attendance Based"}
              </Text>
            </View>
          </View>
        </View>

        {/* Electricity Billing Info Card (Strictly Scoped to Selected Cycle) */}
        {cycleElectricityData ? (
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
                  Electricity Billing Rule
                </Text>
                <Text
                  style={[
                    styles.waterConfigSub,
                    { color: isDark ? "#FBBF24" : "#D97706" },
                  ]}
                >
                  {cycleElectricityData.hasReadings
                    ? `₱${(cycleElectricityData.rateCentavosPerKwh / 100).toFixed(2)} / kWh · ${cycleElectricityData.previousReadingKwh} → ${cycleElectricityData.currentReadingKwh} kWh (${cycleElectricityData.consumedKwh} kWh)`
                    : `Electricity Bill · ${formatPesos(cycleElectricityData.totalAmountCentavos)}`}
                </Text>
              </View>
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
                {cycleElectricityData.hasReadings
                  ? `(${cycleElectricityData.currentReadingKwh} - ${cycleElectricityData.previousReadingKwh} kWh) × ₱${(cycleElectricityData.rateCentavosPerKwh / 100).toFixed(2)}/kWh = ${formatPesos(cycleElectricityData.totalAmountCentavos)} split among payors.`
                  : `Total cycle electricity bill of ${formatPesos(cycleElectricityData.totalAmountCentavos)} split among active paying roommates.`}
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
                  {cycleElectricityData.hasReadings
                    ? "Meter Based (kWh)"
                    : "Cycle Split"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Summary Metric Cards */}
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
                color={isDark ? colors.accent : "#2563EB"}
              />
            </View>
            <Text
              style={[styles.metricValue, isDark && { color: colors.text }]}
            >
              {formatPesos(myDuesCents)}
            </Text>
            <Text
              style={[
                styles.metricLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Your Unpaid Dues
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
                color={isDark ? colors.textSecondary : "#0F172A"}
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
              Total Group Bills
            </Text>
          </View>
        </View>

        {/* Cycle Bills List (Read-Only - No Add Button) */}
        <View style={styles.sectionRow}>
          <Text
            style={[styles.sectionHeading, isDark && { color: colors.text }]}
          >
            Household Bills ({currentCycleExpenses.length})
          </Text>
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
                No bills have been posted for this billing cycle yet.
              </Text>
            </View>
          ) : (
            currentCycleExpenses.map((exp) => {
              const isExpensePaid =
                exp.status === "PAID" ||
                exp.isPaid === true ||
                allPayorsSettled;
              const catMeta = getCategoryMeta(exp.category);
              return (
                <View
                  key={exp.id}
                  style={[
                    styles.expenseItemRow,
                    isDark && { borderBottomColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.expenseCategoryIconWrap,
                      {
                        backgroundColor: isDark
                          ? catMeta.darkBgColor || "rgba(255, 255, 255, 0.08)"
                          : catMeta.bgColor,
                      },
                    ]}
                  >
                    <Feather
                      name={catMeta.featherIcon as any}
                      size={15}
                      color={
                        isDark
                          ? catMeta.darkColor || catMeta.color
                          : catMeta.color
                      }
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
                        style={
                          isExpensePaid
                            ? [
                                styles.statusBadgePaid,
                                isDark && {
                                  backgroundColor: "rgba(16, 185, 129, 0.16)",
                                },
                              ]
                            : [
                                styles.statusBadgeUnpaid,
                                isDark && {
                                  backgroundColor: "rgba(244, 63, 94, 0.16)",
                                },
                              ]
                        }
                      >
                        <Text
                          style={
                            isExpensePaid
                              ? [
                                  styles.statusBadgeTextPaid,
                                  isDark && { color: colors.success },
                                ]
                              : [
                                  styles.statusBadgeTextUnpaid,
                                  isDark && { color: colors.danger },
                                ]
                          }
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
                      Posted by {exp.payerName || "Host"} •{" "}
                      {formatShortDate(exp.date)}
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
                  <Text
                    style={[
                      styles.expenseItemAmount,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {formatPesos(exp.amountCents)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Roommates / Participants List (Read-Only - No Invite/Role/Remove Buttons) */}
        <View style={[styles.sectionRow, { marginTop: 24 }]}>
          <Text
            style={[styles.sectionHeading, isDark && { color: colors.text }]}
          >
            Household Members ({participants.length})
          </Text>
        </View>

        <View style={styles.participantsList}>
          {participants.length === 0 ? (
            <View
              style={[
                styles.emptyExpenseBox,
                isDark && { backgroundColor: colors.card },
              ]}
            >
              <Text
                style={[
                  styles.emptyExpenseText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                No active members found.
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
                  <View style={styles.participantAvatar}>
                    {p.profilePicture ? (
                      <Image
                        source={{ uri: p.profilePicture }}
                        style={styles.participantAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.participantAvatarText}>
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
                        <View
                          style={[
                            styles.nonPayorBadge,
                            isDark && {
                              backgroundColor: colors.surfaceInset,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.nonPayorBadgeText,
                              isDark && { color: colors.textMuted },
                            ]}
                          >
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
                              p.status === "Settled" ? "#10B981" : "#F43F5E",
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
                        <View style={styles.participantWaterBreakdownWrap}>
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
                          : p.status === "Settled"
                            ? "Settled"
                            : formatPesos(0)}
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
                          : "Zero Dues"}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {myDuesCents > 0 &&
          onOpenSettleDues &&
          (isCyclePaymentsLocked(activeCycle, household) ? (
            <View
              style={[
                styles.primaryPillBtn,
                {
                  marginTop: 24,
                  backgroundColor: isDark
                    ? "rgba(245, 158, 11, 0.15)"
                    : "#FEF3C7",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(245, 158, 11, 0.35)" : "#FCD34D",
                  shadowOpacity: 0,
                  elevation: 0,
                },
              ]}
            >
              <Feather
                name="lock"
                size={16}
                color={isDark ? "#FBBF24" : "#B45309"}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.primaryPillBtnText,
                  { color: isDark ? "#FBBF24" : "#92400E" },
                ]}
              >
                Bills Under Review · Payments Locked
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryPillBtn,
                { marginTop: 24 },
                isDark && {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                },
              ]}
              onPress={onOpenSettleDues}
            >
              <Ionicons
                name="wallet-outline"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.primaryPillBtnText}>
                Settle My Dues ({formatPesos(myDuesCents)})
              </Text>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  navBarContainer: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    marginTop: 10,
  },
  circleBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  readOnlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  readOnlyBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  householdSummaryCard: {
    backgroundColor: "#2563EB",
    borderRadius: 22,
    padding: 18,
    marginBottom: 22,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  householdSummaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  householdIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  householdNameText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  householdHostSubText: {
    fontSize: 12,
    color: "#DBEAFE",
    marginTop: 2,
    fontWeight: "500",
  },
  memberRolePill: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  memberRolePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  householdDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    marginVertical: 14,
  },
  householdMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  householdMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  householdMetaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EFF6FF",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  cycleStatusBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cycleStatusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#15803D",
  },
  emptyInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18,
  },
  emptyInfoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 8,
  },
  emptyInfoSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
  cycleChipsScroll: {
    gap: 8,
    paddingBottom: 6,
  },
  cycleChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cycleChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  cycleChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  cycleChipTextActive: {
    color: "#FFFFFF",
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  datePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  waterConfigCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18,
  },
  waterConfigHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  waterConfigIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
  },
  waterConfigTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  waterConfigSub: {
    fontSize: 12,
    color: "#0284C7",
    fontWeight: "600",
    marginTop: 2,
  },
  waterConfigDetailsRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  waterModeTag: {
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  waterModeTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369A1",
  },
  waterModeSummary: {
    flex: 1,
    fontSize: 12,
    color: "#64748B",
  },
  metricCardsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },
  metricLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  expenseBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  emptyExpenseBox: {
    padding: 24,
    alignItems: "center",
  },
  emptyExpenseText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  expenseItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  expenseCategoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  expenseItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  expenseItemSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  expenseItemAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  statusBadgePaid: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeTextPaid: {
    fontSize: 6,
    fontWeight: "800",
    color: "#15803D",
  },
  statusBadgeUnpaid: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeTextUnpaid: {
    fontSize: 6,
    fontWeight: "800",
    color: "#B45309",
  },
  participantsList: {
    gap: 10,
  },
  participantCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  participantAvatarImage: {
    width: "100%",
    height: "100%",
  },
  participantAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2563EB",
  },
  participantName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  hostBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hostBadgeText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  payorBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  payorBadgeText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#15803D",
  },
  nonPayorBadge: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nonPayorBadgeText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#6D28D9",
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  participantSubInfo: {
    fontSize: 12,
    color: "#64748B",
  },
  participantWaterBreakdownWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  participantWaterBreakdownText: {
    fontSize: 11,
    color: "#0284C7",
    fontWeight: "600",
  },
  participantOwesText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  participantOwesSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  infoHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  infoHeroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  infoHeroTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },
  infoHeroSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  primaryPillBtn: {
    flexDirection: "row",
    backgroundColor: "#2563EB",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPillBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 10,
  },
  secondaryOutlineBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
});
