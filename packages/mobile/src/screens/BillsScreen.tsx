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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  mobileDataService,
  MobileExpense,
  isPayorMember,
  cleanBillTitle,
} from "../services/firebaseDataService";
import { auth } from "../firebase/config";
import { formatPesos } from "@propertyflow/shared";
import { PaymentsScreen } from "./PaymentsScreen";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { UniversalLoader } from "../components/UniversalLoader";
import { getCategoryMeta } from "../services/categoryService";
import { getBillDueStatus } from "./HomeScreen";

export const BillsScreen: React.FC<{
  onPayPress?: () => void;
  householdId?: string;
  initialSubView?: "overview" | "pay";
  onLoaded?: () => void;
}> = ({ onPayPress, householdId, initialSubView = "overview", onLoaded }) => {
  const [subView, setSubView] = useState<"overview" | "pay">(initialSubView);
  const [profile, setProfile] = useState<any | null>(null);
  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [memberBills, setMemberBills] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [cycleAttendance, setCycleAttendance] = useState<any[]>([]);
  const [attendanceSubmissions, setAttendanceSubmissions] = useState<
    Record<string, any>
  >({});
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;
  const resolvedHouseholdId = householdId || profile?.householdId || "";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  const updateLoading = (val: boolean) => {
    setLoading(val);
    if (!val) {
      onLoaded?.();
    }
  };

  // Fallback safety timer
  useEffect(() => {
    const timer = setTimeout(() => {
      updateLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

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
      updateLoading(false);
      return;
    }
    mobileDataService.getUserProfile(currentUser.uid).then((nextProfile) => {
      if (mounted) {
        setProfile(nextProfile);
        setProfileLoaded(true);
        if (!nextProfile?.householdId && !householdId) {
          updateLoading(false);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [currentUser?.uid, householdId]);

  useEffect(() => {
    if (!profileLoaded && !householdId) {
      // Still waiting for profile to resolve
      return;
    }
    if (!resolvedHouseholdId) {
      updateLoading(false);
      return;
    }
    updateLoading(true);
    let expLoaded = false;
    let cycLoaded = false;
    const checkDone = () => {
      if (expLoaded && cycLoaded) {
        updateLoading(false);
      }
    };

    const unsubExpenses = mobileDataService.listenToExpenses(
      resolvedHouseholdId,
      (data) => {
        setExpenses(data);
        expLoaded = true;
        checkDone();
      },
    );
    const unsubCycles = mobileDataService.listenToBillingCycles(
      resolvedHouseholdId,
      (data) => {
        setCycles(data);
        cycLoaded = true;
        checkDone();
      },
    );
    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      resolvedHouseholdId,
      setMembers,
    );
    const unsubWater = mobileDataService.listenToWaterConfig(
      resolvedHouseholdId,
      setWaterConfig,
    );
    return () => {
      unsubExpenses();
      unsubCycles();
      unsubMembers();
      unsubWater();
    };
  }, [resolvedHouseholdId]);

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

  const liveUnpaidShareCents = useMemo(() => {
    if (!isCurrentUserPayor) return 0;
    const payorCount = Math.max(1, activePayors.length);
    const unpaidExpenses = expenses.filter((e) => e.status !== "PAID");
    return unpaidExpenses.reduce((sum, e) => {
      const isWater = (e.category || "").toLowerCase().includes("water");
      const mySplit = e.splitDetails?.find(
        (s: any) => s.userId === currentUser?.uid,
      );

      if (isWater && mySplit && typeof mySplit.shareCentavos === "number") {
        return sum + mySplit.shareCentavos;
      }

      const splitPayors = e.splitDetails
        ? e.splitDetails.filter((s: any) => !s.isExempt)
        : [];
      const isSplitStale =
        splitPayors.length > 0 && splitPayors.length !== payorCount;

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
      return sum + Math.round(e.amountCents / payorCount);
    }, 0);
  }, [expenses, activePayors, currentUser?.uid, isCurrentUserPayor]);

  const totalHouseholdCents = expenses.reduce(
    (acc, cur) => acc + cur.amountCents,
    0,
  );
  const paidCentavos =
    myBill && typeof myBill.totalPaidCentavos === "number"
      ? myBill.totalPaidCentavos
      : 0;
  const myShareCents = isCurrentUserPayor
    ? Math.max(0, liveUnpaidShareCents - paidCentavos)
    : 0;

  // Auto-heal: If an active payor joined and unpaid splits or memberBills are out of sync with current payor count, recalculate in Firestore
  useEffect(() => {
    if (
      !resolvedHouseholdId ||
      activePayors.length === 0 ||
      expenses.length === 0
    )
      return;
    const payorCount = Math.max(1, activePayors.length);
    const hasStaleSplit = expenses.some((e) => {
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
      mobileDataService
        .recalculateUnpaidExpensesForHousehold(resolvedHouseholdId)
        .catch(() => {});
    }
  }, [
    resolvedHouseholdId,
    activePayors.length,
    expenses,
    myBill,
    liveUnpaidShareCents,
  ]);
  const { onScroll } = useNavVisibility();

  if (subView === "pay") {
    return (
      <PaymentsScreen
        householdId={resolvedHouseholdId}
        billingCycleId={activeCycle?.billingCycleId}
        onBack={() => setSubView("overview")}
      />
    );
  }

  if (loading && !onLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "transparent" }}>
        <StatusBar
          barStyle="dark-content"
          translucent={true}
          backgroundColor="transparent"
        />
        <UniversalLoader
          text="Loading bills..."
          subtitle="Calculating fair shares..."
          transparent={true}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {/* Top Sub-screen Segment Control */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, styles.segmentBtnActive]}
              onPress={() => setSubView("overview")}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={15} color="#2563EB" />
              <Text style={[styles.segmentText, styles.segmentTextActive]}>
                Bills & Dues
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.segmentBtn}
              onPress={() => {
                if (onPayPress) onPayPress();
                setSubView("pay");
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="card-outline" size={15} color="#64748B" />
              <Text style={styles.segmentText}>Pay / Settle</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>My Current Bill</Text>
          <Text style={styles.subtitle}>
            {activeCycle
              ? `${activeCycle.name || "Billing cycle"} · Firestore synced`
              : "Firestore synced"}
          </Text>

          <View style={styles.heroCard}>
            {!isCurrentUserPayor && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <View
                  style={{
                    backgroundColor: "#E2E8F0",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: "#475569",
                    }}
                  >
                    EXEMPT (NON-PAYOR)
                  </Text>
                </View>
              </View>
            )}
            <Text style={styles.heroLabel}>Total Remaining Due</Text>
            <Text style={styles.heroAmount}>{formatPesos(myShareCents)}</Text>
            <Text style={styles.heroSub}>
              {isCurrentUserPayor
                ? `Household bills: ${formatPesos(totalHouseholdCents)} · Split fairly across ${activePayors.length} ${activePayors.length === 1 ? "payor" : "payors"}`
                : `Household bills (${formatPesos(totalHouseholdCents)}) are split fairly among paying roommates only.`}
            </Text>

            {isCurrentUserPayor && (
              <TouchableOpacity
                style={styles.payNowBtn}
                onPress={() => {
                  if (onPayPress) onPayPress();
                  setSubView("pay");
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.payNowText}>Pay with GCash / Bank →</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionTitle}>
            Itemized Charges (
            {expenses.length > 0
              ? `${expenses.length} recorded`
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
          ) : expenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No household bills logged yet.
              </Text>
              <Text style={styles.emptySub}>
                Bills will appear here after a host records charges or finalizes
                a cycle.
              </Text>
            </View>
          ) : (
            expenses.map((e) => {
              const isExpensePaid = e.status === "PAID" || e.isPaid === true;
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
                  const myAtt = cycleAttendance.filter(
                    (a) =>
                      a.userId === currentUser?.uid && a.status === "PRESENT",
                  ).length;
                  const mySub =
                    attendanceSubmissions[currentUser?.uid || ""]
                      ?.daysPresent || 0;
                  const myDays = myAtt > 0 ? myAtt : mySub;
                  const ownCost = myDays * rate;
                  const totalNonPayorWater = members
                    .filter((m) => m.status === "ACTIVE" && !isPayorMember(m))
                    .reduce((npSum, np) => {
                      const npUid = np.userId || np.memberId;
                      const npAtt = cycleAttendance.filter(
                        (a) => a.userId === npUid && a.status === "PRESENT",
                      ).length;
                      const npSub =
                        attendanceSubmissions[npUid]?.daysPresent || 0;
                      const npDays = npAtt > 0 ? npAtt : npSub;
                      return npSum + npDays * rate;
                    }, 0);
                  const extraPerPayor =
                    payorCount > 0
                      ? Math.round(totalNonPayorWater / payorCount)
                      : 0;
                  if (isCurrentUserPayor) {
                    waterMyShare = ownCost + extraPerPayor;
                  }

                  const totalAllWater = members
                    .filter((m) => m.status === "ACTIVE")
                    .reduce((sum, m) => {
                      const mUid = m.userId || m.memberId;
                      const att = cycleAttendance.filter(
                        (a) => a.userId === mUid && a.status === "PRESENT",
                      ).length;
                      const sub = attendanceSubmissions[mUid]?.daysPresent || 0;
                      const days = att > 0 ? att : sub;
                      return sum + days * rate;
                    }, 0);
                  if (totalAllWater > 0) {
                    waterTotalCentavos = totalAllWater;
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
                    waterMyShare = Math.round(e.amountCents / payorCount);
                  }
                }
              }

              const splitPayors = e.splitDetails
                ? e.splitDetails.filter(
                    (s: any) => !s.isExempt && s.shareCentavos > 0,
                  )
                : [];
              const isSplitStale =
                !isWater &&
                splitPayors.length > 0 &&
                splitPayors.length !== payorCount;
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
                    : Math.round(e.amountCents / payorCount);
              const dueInfo = getBillDueStatus(e, activeCycle, cycles);

              return (
                <View key={e.id} style={styles.billItem}>
                  <View
                    style={[
                      styles.billIconWrap,
                      { backgroundColor: catMeta.bgColor },
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
                      <Text style={styles.billName}>
                        {cleanBillTitle(e.title, e.category)}
                      </Text>
                      {isExpensePaid ? (
                        <View style={styles.statusBadgePaid}>
                          <Text style={styles.statusBadgeTextPaid}>PAID</Text>
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
                    <Text style={styles.billPayer}>
                      {isExpensePaid
                        ? `${e.date} · Paid by ${e.payerName}`
                        : `${e.date} · Added by ${e.payerName || "Host"}`}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", marginTop: 2 }}>
                    <Text style={styles.billValue}>
                      {formatPesos(
                        isWater && waterTotalCentavos > 0
                          ? waterTotalCentavos
                          : e.amountCents,
                      )}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: isCurrentUserPayor ? "#2563EB" : "#94A3B8",
                        fontWeight: "700",
                        marginTop: 2,
                      }}
                    >
                      {isCurrentUserPayor
                        ? `Your share: ${formatPesos(myShareForExpense)}`
                        : "Exempt"}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 20, paddingBottom: 85 },
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
    backgroundColor: "#2563EB",
    borderRadius: 22,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  heroLabel: {
    color: "#BFDBFE",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  heroAmount: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginVertical: 6,
  },
  heroSub: { color: "#EFF6FF", fontSize: 11, marginBottom: 18 },
  payNowBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  payNowText: { color: "#2563EB", fontWeight: "bold", fontSize: 13 },
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
  },
  statusBadgeTextPaid: {
    color: "#047857",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
