import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { formatPesos } from "@propertyflow/shared";
import { useTheme } from "../context/ThemeContext";
import {
  mobileDataService,
  MobileExpense,
  isPayorMember,
  cleanBillTitle,
} from "../services/firebaseDataService";
import { auth } from "../firebase/config";
import { getCategoryMeta } from "../services/categoryService";

interface SettleDuesScreenProps {
  onBack: () => void;
  onPayPress: (item?: { name: string; amount: number }) => void;
}

export const SettleDuesScreen: React.FC<SettleDuesScreenProps> = ({
  onBack,
  onPayPress,
}) => {
  const { isDark, colors } = useTheme();
  const currentUser = auth.currentUser;
  const cachedProfile = mobileDataService.getCachedProfile(currentUser?.uid);
  const householdId = cachedProfile?.householdId || "";

  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    const unsubExp = mobileDataService.listenToExpenses(householdId, (data) => {
      setExpenses(data);
      setLoading(false);
    });

    const unsubMem = mobileDataService.listenToHouseholdMembers(
      householdId,
      setMembers,
    );

    const unsubPmt = mobileDataService.listenToPayments(
      householdId,
      setPayments,
    );

    return () => {
      unsubExp();
      unsubMem();
      unsubPmt();
    };
  }, [householdId]);

  const activeMembers = useMemo(() => {
    return members.filter((m) => m.status === "ACTIVE" || !m.status);
  }, [members]);

  const activePayors = useMemo(() => {
    const list = activeMembers.filter((m) => isPayorMember(m));
    return list.length > 0 ? list : activeMembers;
  }, [activeMembers]);

  const isCurrentUserPayor = useMemo(() => {
    const me = activeMembers.find((m) => m.userId === currentUser?.uid);
    return isPayorMember(me);
  }, [activeMembers, currentUser?.uid]);

  const dues = useMemo(() => {
    const payorCount = Math.max(1, activePayors.length);

    return expenses.map((exp) => {
      const catMeta = getCategoryMeta(exp.category);
      const isPaid = exp.status === "PAID" || exp.isPaid === true;
      const mySplit = exp.splitDetails?.find(
        (s: any) => s.userId === currentUser?.uid,
      );
      const mySplitPaid = mySplit?.isPaid === true;

      const myShareCentavos = !isCurrentUserPayor
        ? 0
        : mySplit && typeof mySplit.shareCentavos === "number"
          ? mySplit.shareCentavos
          : Math.round(exp.amountCents / payorCount);

      const status = isPaid || mySplitPaid ? "PAID" : "UNPAID";

      return {
        id: exp.id,
        name: cleanBillTitle(exp.title, exp.category),
        amount: myShareCentavos / 100,
        amountCentavos: myShareCentavos,
        totalExpenseCentavos: exp.amountCents,
        status,
        icon: (catMeta.featherIcon as string) || "file-text",
        iconColor: catMeta.color,
        bg: isDark ? "rgba(255, 255, 255, 0.06)" : catMeta.bgColor,
      };
    });
  }, [expenses, activePayors, currentUser?.uid, isCurrentUserPayor, isDark]);

  const totalDuesCentavos = useMemo(() => {
    return dues
      .filter((d) => d.status === "UNPAID")
      .reduce((sum, d) => sum + d.amountCentavos, 0);
  }, [dues]);

  const totalExpenseCentavos = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amountCents, 0);
  }, [expenses]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: isDark ? colors.card : "rgba(15, 23, 42, 0.05)",
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Feather
            name="arrow-left"
            size={20}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Settle Dues
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* KPI Cards */}
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Total Dues
            </Text>
            <Text
              style={[
                styles.statAmountDues,
                {
                  color:
                    totalDuesCentavos > 0
                      ? isDark
                        ? "#F87171"
                        : "#E11D48"
                      : isDark
                        ? "#34D399"
                        : "#16A34A",
                },
              ]}
            >
              {formatPesos(totalDuesCentavos)}
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Total Expense
            </Text>
            <Text
              style={[
                styles.statAmountExpense,
                { color: isDark ? "#60A5FA" : "#2563EB" },
              ]}
            >
              {formatPesos(totalExpenseCentavos)}
            </Text>
          </View>
        </View>

        {/* Pay All Button if dues > 0 */}
        {totalDuesCentavos > 0 && isCurrentUserPayor && (
          <TouchableOpacity
            style={[
              styles.payBtn,
              {
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 16,
                marginBottom: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              },
            ]}
            onPress={() =>
              onPayPress({
                name: "All Outstanding Dues",
                amount: totalDuesCentavos / 100,
              })
            }
            activeOpacity={0.85}
          >
            <Feather name="credit-card" size={18} color="#FFFFFF" />
            <Text style={[styles.payBtnText, { fontSize: 15 }]}>
              Pay All Remaining Dues ({formatPesos(totalDuesCentavos)})
            </Text>
          </TouchableOpacity>
        )}

        {/* Section Header */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Your Due Payments
        </Text>

        {loading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text
              style={{
                marginTop: 8,
                color: colors.textSecondary,
                fontSize: 12,
              }}
            >
              Loading your bills from Firebase...
            </Text>
          </View>
        ) : dues.length === 0 ? (
          <View
            style={[
              styles.dueItem,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                padding: 24,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <Feather name="check-circle" size={32} color="#10B981" />
            <Text
              style={[
                styles.dueName,
                { color: colors.text, marginTop: 10, textAlign: "center" },
              ]}
            >
              No Household Dues
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              You have no pending bills recorded in this household.
            </Text>
          </View>
        ) : (
          <View style={styles.duesList}>
            {dues.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.dueItem,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.dueItemLeft}>
                  <View
                    style={[
                      styles.dueIconWrap,
                      {
                        backgroundColor: item.bg,
                        borderColor: colors.border,
                        borderWidth: isDark ? 1 : 0,
                      },
                    ]}
                  >
                    <Feather
                      name={item.icon as any}
                      size={18}
                      color={item.iconColor}
                    />
                  </View>
                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text
                      style={[styles.dueName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.dueAmount,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Your share: {formatPesos(item.amountCentavos)}
                    </Text>
                  </View>
                </View>

                {item.status === "UNPAID" ? (
                  <TouchableOpacity
                    style={[
                      styles.payBtn,
                      {
                        backgroundColor: colors.primary,
                        shadowColor: colors.primary,
                      },
                    ]}
                    onPress={() =>
                      onPayPress({ name: item.name, amount: item.amount })
                    }
                    activeOpacity={0.85}
                  >
                    <Text style={styles.payBtnText}>Pay</Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={[
                      styles.paidBadge,
                      {
                        backgroundColor: isDark
                          ? "rgba(16, 185, 129, 0.14)"
                          : "#DCFCE7",
                        borderColor: isDark
                          ? "rgba(16, 185, 129, 0.28)"
                          : "#BBF7D0",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.paidBadgeText,
                        { color: isDark ? "#34D399" : "#16A34A" },
                      ]}
                    >
                      Paid
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  scrollContent: { padding: 20 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  statLabel: { fontSize: 11, fontWeight: "600" },
  statAmountDues: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  statAmountExpense: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 14,
  },
  duesList: { gap: 10 },
  dueItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  dueItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  dueIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  dueName: { fontSize: 13, fontWeight: "700" },
  dueAmount: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  payBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  payBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  paidBadge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  paidBadgeText: { fontWeight: "800", fontSize: 11 },
});
