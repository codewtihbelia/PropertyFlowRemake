import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { formatPesos } from "@propertyflow/shared";
import { UniversalSkeleton } from "../components/UniversalLoader";

interface ReportScreenProps {
  onBack: () => void;
  loading?: boolean;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  onBack,
  loading = false,
}) => {
  const [selectedMonth, setSelectedMonth] = useState("Aug 2026");

  if (loading) {
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
          <Text style={styles.headerTitle}>Financial Reports</Text>
          <View style={{ width: 36 }} />
        </View>
        <UniversalSkeleton type="reports" />
      </SafeAreaView>
    );
  }

  const months = ["Jul 2026", "Aug 2026", "Sep 2026"];

  const categoryStats = [
    {
      label: "Rent",
      amountCents: 1400000,
      color: "#2563EB",
      percentage: 65,
      height: 120,
    },
    {
      label: "Electricity",
      amountCents: 224000,
      color: "#F97316",
      percentage: 10,
      height: 50,
    },
    {
      label: "Internet",
      amountCents: 150000,
      color: "#8B5CF6",
      percentage: 7,
      height: 35,
    },
    {
      label: "Water",
      amountCents: 98500,
      color: "#06B6D4",
      percentage: 5,
      height: 25,
    },
    {
      label: "Supplies",
      amountCents: 125000,
      color: "#10B981",
      percentage: 6,
      height: 30,
    },
  ];

  const residentShares = [
    {
      name: "Alice Santos",
      role: "Host / Payor",
      shareCents: 474750,
      status: "Settled",
      statusColor: "#16A34A",
    },
    {
      name: "Bea Alonzo",
      role: "Payor",
      shareCents: 474750,
      status: "₱219.50 Due",
      statusColor: "#DC2626",
    },
    {
      name: "Charlie Cruz",
      role: "Payor",
      shareCents: 474750,
      status: "Settled",
      statusColor: "#16A34A",
    },
    {
      name: "Dennis Tan",
      role: "Payor",
      shareCents: 474750,
      status: "Settled",
      statusColor: "#16A34A",
    },
    {
      name: "Grace Lim",
      role: "Non-Payor",
      shareCents: 0,
      status: "Exempt",
      statusColor: "#64748B",
    },
  ];

  const totalHouseholdCents = 1872500;

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
        <Text style={styles.headerTitle}>Monthly Summary</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Month Selector Pills */}
        <View style={styles.monthSelector}>
          {months.map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.monthPill,
                selectedMonth === m && styles.monthPillActive,
              ]}
              onPress={() => setSelectedMonth(m)}
            >
              <Text
                style={[
                  styles.monthPillText,
                  selectedMonth === m && styles.monthPillTextActive,
                ]}
              >
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total Expense Hero Card matching proposedUI */}
        <View style={styles.totalCard}>
          <Text style={styles.totalCardLabel}>Total Household Expenses</Text>
          <Text style={styles.totalCardAmount}>
            {formatPesos(totalHouseholdCents)}
          </Text>
          <Text style={styles.totalCardSub}>
            Billing Cycle: Aug 13 – Sep 12, 2026
          </Text>
        </View>

        {/* Bar Chart Visual Pillars matching proposedUI */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Category Spending Breakdown</Text>
          <View style={styles.barsContainer}>
            {categoryStats.map((item, idx) => (
              <View key={idx} style={styles.barColumn}>
                <Text style={styles.barAmount}>
                  ₱{(item.amountCents / 100000).toFixed(1)}k
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: item.height, backgroundColor: item.color },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Category Details Table */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Category Details</Text>
          {categoryStats.map((cat, idx) => (
            <View key={idx} style={styles.catRow}>
              <View
                style={[styles.catColorDot, { backgroundColor: cat.color }]}
              />
              <Text style={styles.catName}>{cat.label}</Text>
              <Text style={styles.catPercent}>{cat.percentage}%</Text>
              <Text style={styles.catAmount}>
                {formatPesos(cat.amountCents)}
              </Text>
            </View>
          ))}
        </View>

        {/* Roommate Balances */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>
            Roommate Balance Distribution
          </Text>
          {residentShares.map((res, idx) => (
            <View key={idx} style={styles.resRow}>
              <View style={styles.resAvatar}>
                <Text style={styles.resAvatarText}>{res.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resName}>{res.name}</Text>
                <Text style={styles.resRole}>{res.role}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.resAmount}>
                  {formatPesos(res.shareCents)}
                </Text>
                <Text style={[styles.resStatus, { color: res.statusColor }]}>
                  {res.status}
                </Text>
              </View>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: { fontSize: 20, color: "#0F172A", fontWeight: "bold" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  monthSelector: { flexDirection: "row", gap: 8, marginBottom: 16 },
  monthPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  monthPillActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  monthPillText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  monthPillTextActive: { color: "#FFFFFF", fontWeight: "bold" },
  totalCard: {
    backgroundColor: "#2563EB",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: "#2563EB",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  totalCardLabel: { fontSize: 13, fontWeight: "700", color: "#DBEAFE" },
  totalCardAmount: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
    marginBottom: 8,
  },
  totalCardSub: { fontSize: 12, color: "#93C5FD" },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
  },
  barsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 160,
    paddingBottom: 10,
  },
  barColumn: { alignItems: "center", width: 50 },
  barAmount: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 6,
  },
  barTrack: {
    height: 120,
    width: 24,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barFill: { width: "100%", borderRadius: 6 },
  barLabel: { fontSize: 10, fontWeight: "700", color: "#475569", marginTop: 8 },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 14,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  catColorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  catName: { flex: 1, fontSize: 13, fontWeight: "600", color: "#0F172A" },
  catPercent: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    marginRight: 16,
  },
  catAmount: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  resRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  resAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  resAvatarText: { fontSize: 14, fontWeight: "bold", color: "#2563EB" },
  resName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  resRole: { fontSize: 11, color: "#64748B" },
  resAmount: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  resStatus: { fontSize: 11, fontWeight: "700", marginTop: 2 },
});
