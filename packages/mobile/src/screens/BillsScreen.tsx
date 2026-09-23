import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  mobileDataService,
  MobileExpense,
} from "../services/firebaseDataService";
import { auth } from "../firebase/config";
import { formatPesos } from "@propertyflow/shared";
import { PaymentsScreen } from "./PaymentsScreen";
import { Ionicons } from "@expo/vector-icons";
import { useNavVisibility } from "../context/NavVisibilityContext";

export const BillsScreen: React.FC<{
  onPayPress?: () => void;
  householdId?: string;
  initialSubView?: "overview" | "pay";
}> = ({ onPayPress, householdId, initialSubView = "overview" }) => {
  const [subView, setSubView] = useState<"overview" | "pay">(initialSubView);
  const [profile, setProfile] = useState<any | null>(null);
  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [memberBills, setMemberBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;
  const resolvedHouseholdId = householdId || profile?.householdId || "";

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
      setLoading(false);
      return;
    }
    mobileDataService.getUserProfile(currentUser.uid).then((nextProfile) => {
      if (mounted) setProfile(nextProfile);
    });
    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!resolvedHouseholdId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubExpenses = mobileDataService.listenToExpenses(
      resolvedHouseholdId,
      (data) => {
        setExpenses(data);
        setLoading(false);
      },
    );
    const unsubCycles = mobileDataService.listenToBillingCycles(
      resolvedHouseholdId,
      setCycles,
    );
    return () => {
      unsubExpenses();
      unsubCycles();
    };
  }, [resolvedHouseholdId]);

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

  const totalHouseholdCents = expenses.reduce(
    (acc, cur) => acc + cur.amountCents,
    0,
  );
  const myShareCents = myBill?.outstandingCentavos || 0;
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

  return (
    <SafeAreaView style={styles.container}>
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
          <Text style={styles.heroLabel}>Total Remaining Due</Text>
          <Text style={styles.heroAmount}>{formatPesos(myShareCents)}</Text>
          <Text style={styles.heroSub}>
            Household expenses total: {formatPesos(totalHouseholdCents)}
          </Text>

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
        </View>

        <Text style={styles.sectionTitle}>
          Itemized Charges (
          {expenses.length > 0
            ? `${expenses.length} from Firebase`
            : "No cloud expenses"}
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
              Ask a host or Super Admin to connect your account to a household.
            </Text>
          </View>
        ) : expenses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No cloud expenses logged yet.</Text>
            <Text style={styles.emptySub}>
              Bills will appear here after a host records charges or finalizes a
              cycle.
            </Text>
          </View>
        ) : (
          expenses.map((e) => {
            const isExpensePaid = e.status === "PAID" || e.isPaid === true;
            return (
              <View key={e.id} style={styles.billItem}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <Text style={styles.billName}>{e.title}</Text>
                    <View
                      style={
                        isExpensePaid
                          ? styles.statusBadgePaid
                          : styles.statusBadgeUnpaid
                      }
                    >
                      <Text
                        style={
                          isExpensePaid
                            ? styles.statusBadgeTextPaid
                            : styles.statusBadgeTextUnpaid
                        }
                      >
                        {isExpensePaid ? "PAID" : "UNPAID BILL"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.billPayer}>
                    {isExpensePaid
                      ? `${e.date} · Paid by ${e.payerName}`
                      : `${e.date} · Unpaid Household Bill · Billed by ${e.payerName || "Host"}`}
                  </Text>
                </View>
                <Text style={styles.billValue}>
                  {formatPesos(e.amountCents)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
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
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  billName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  billPayer: { fontSize: 11, color: "#64748B", marginTop: 2 },
  billValue: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
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
