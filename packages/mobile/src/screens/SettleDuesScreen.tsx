import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { formatPesos } from "@propertyflow/shared";

interface SettleDuesScreenProps {
  onBack: () => void;
  onPayPress: (item: { name: string; amount: number }) => void;
}

export const SettleDuesScreen: React.FC<SettleDuesScreenProps> = ({
  onBack,
  onPayPress,
}) => {
  const dues = [
    {
      id: "1",
      name: "Apartment Room Rent",
      amount: 3500.0,
      status: "PAID",
      icon: "home",
      color: "#0F172A",
      bg: "rgba(15, 23, 42, 0.05)",
    },
    {
      id: "2",
      name: "Fiber Internet 300Mbps",
      amount: 375.0,
      status: "PAID",
      icon: "wifi",
      color: "#0F172A",
      bg: "rgba(15, 23, 42, 0.05)",
    },
    {
      id: "3",
      name: "Electricity Sub-Meter (140 kWh)",
      amount: 219.5,
      status: "UNPAID",
      icon: "flash",
      color: "#0F172A",
      bg: "rgba(15, 23, 42, 0.05)",
    },
    {
      id: "4",
      name: "Water Attendance (25 days)",
      amount: 125.0,
      status: "PAID",
      icon: "water",
      color: "#0F172A",
      bg: "rgba(15, 23, 42, 0.05)",
    },
  ];

  const totalDues = 219.5;
  const totalExpense = 4219.5;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settle Dues</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* KPI Cards matching proposedUI */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Dues</Text>
            <Text style={styles.statAmountDues}>₱{totalDues.toFixed(2)}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Expense</Text>
            <Text style={styles.statAmountExpense}>
              ₱{totalExpense.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Your Due Payments matching proposedUI */}
        <Text style={styles.sectionTitle}>Your Due payments</Text>

        <View style={styles.duesList}>
          {dues.map((item) => (
            <View key={item.id} style={styles.dueItem}>
              <View style={styles.dueItemLeft}>
                <View
                  style={[styles.dueIconWrap, { backgroundColor: item.bg }]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={18}
                    color={item.color}
                  />
                </View>
                <View>
                  <Text style={styles.dueName}>{item.name}</Text>
                  <Text style={styles.dueAmount}>
                    {formatPesos(item.amount * 100)}
                  </Text>
                </View>
              </View>

              {item.status === "UNPAID" ? (
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() =>
                    onPayPress({ name: item.name, amount: item.amount })
                  }
                >
                  <Text style={styles.payBtnText}>Pay</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.paidBadge}>
                  <Text style={styles.paidBadgeText}>Paid</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  backBtnText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: -2,
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  scrollContent: { padding: 20 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  statLabel: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  statAmountDues: {
    fontSize: 22,
    fontWeight: "900",
    color: "#E11D48",
    marginTop: 4,
  },
  statAmountExpense: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2563EB",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 14,
  },
  duesList: { gap: 10 },
  dueItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  dueItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  dueIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  dueName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  dueAmount: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  payBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  payBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  paidBadge: {
    backgroundColor: "#E2E8F0",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  paidBadgeText: { color: "#64748B", fontWeight: "700", fontSize: 12 },
});
