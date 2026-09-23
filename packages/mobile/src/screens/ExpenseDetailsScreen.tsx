import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatPesos } from "@propertyflow/shared";

interface ExpenseDetailsScreenProps {
  expense: {
    id: string;
    title: string;
    categoryLabel: string;
    icon: string;
    amountCents: number;
    date: string;
    payer: string;
    splitMethod: string;
    cycle: string;
    status?: string;
    isPaid?: boolean;
    receiptUrl?: string;
    notes?: string;
  };
  onBack: () => void;
}

export const ExpenseDetailsScreen: React.FC<ExpenseDetailsScreenProps> = ({
  expense,
  onBack,
}) => {
  const isExpensePaid =
    expense.status === "PAID" ||
    expense.status === "Paid" ||
    expense.isPaid === true;

  // Sample split participants
  const participants = [
    {
      name: "Alice Santos",
      role: "Host / Payor",
      shareCents: Math.round(expense.amountCents / 4),
      status: "Paid",
    },
    {
      name: "Bea Alonzo",
      role: "Payor",
      shareCents: Math.round(expense.amountCents / 4),
      status: "Pending",
    },
    {
      name: "Charlie Cruz",
      role: "Payor",
      shareCents: Math.round(expense.amountCents / 4),
      status: "Pending",
    },
    {
      name: "Dennis Tan",
      role: "Payor",
      shareCents: expense.amountCents - Math.round(expense.amountCents / 4) * 3,
      status: "Pending",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Expense Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Text style={{ fontSize: 32 }}>{expense.icon}</Text>
          </View>
          <Text style={styles.heroTitle}>{expense.title}</Text>
          <Text style={styles.heroAmount}>
            {formatPesos(expense.amountCents)}
          </Text>
          <View style={styles.tagWrap}>
            <Text style={styles.categoryTag}>{expense.categoryLabel}</Text>
            <Text style={styles.cycleTag}>{expense.cycle}</Text>
            <Text
              style={[
                styles.statusBadge,
                isExpensePaid
                  ? styles.statusPaid
                  : { backgroundColor: "#FEF2F2", borderColor: "#FECACA", color: "#B91C1C" },
              ]}
            >
              {isExpensePaid ? "PAID" : "UNPAID BILL"}
            </Text>
          </View>
        </View>

        {/* Payer Info matching proposedUI */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>
            {isExpensePaid ? "Who Paid" : "Bill Status & Payer"}
          </Text>
          <View style={styles.payerRow}>
            <View style={styles.payerAvatar}>
              <Text style={styles.payerAvatarText}>
                {expense.payer.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payerName}>{expense.payer}</Text>
              <Text style={styles.payerSub}>
                {isExpensePaid
                  ? `Paid in Full on ${expense.date}`
                  : `Billed to Household on ${expense.date} · Due from payors`}
              </Text>
            </View>
            <View
              style={[
                styles.paidMethodBadge,
                !isExpensePaid && { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
              ]}
            >
              <Text
                style={[
                  styles.paidMethodText,
                  !isExpensePaid && { color: "#B91C1C" },
                ]}
              >
                {isExpensePaid ? "Cash / Bank" : "Unpaid Bill"}
              </Text>
            </View>
          </View>
        </View>

        {/* Split Breakdown matching proposedUI */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Split Breakdown</Text>
            <Text style={styles.splitRule}>{expense.splitMethod}</Text>
          </View>

          {participants.map((p, idx) => (
            <View key={idx} style={styles.splitItem}>
              <View style={styles.userInitials}>
                <Text style={styles.userInitialsText}>{p.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.splitUserName}>{p.name}</Text>
                <Text style={styles.splitUserRole}>{p.role}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.splitAmount}>
                  {formatPesos(p.shareCents)}
                </Text>
                <Text
                  style={[
                    styles.statusBadge,
                    p.status === "Paid"
                      ? styles.statusPaid
                      : styles.statusPending,
                  ]}
                >
                  {p.status}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Receipt Proof matching proposedUI */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Receipt / Proof</Text>
          {expense.receiptUrl ? (
            <Image
              source={{ uri: expense.receiptUrl }}
              style={styles.receiptImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.receiptPlaceholder}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>🧾</Text>
              <Text style={styles.placeholderText}>
                Official Document Uploaded
              </Text>
              <Text style={styles.placeholderSub}>
                Validated & Archived for Audit
              </Text>
            </View>
          )}
        </View>

        {/* Notes & Audit Info */}
        {expense.notes && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>Notes & Meter Readings</Text>
            <Text style={styles.notesText}>{expense.notes}</Text>
          </View>
        )}
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
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: { fontSize: 20, color: "#0F172A", fontWeight: "bold" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2563EB",
    marginTop: 6,
    marginBottom: 12,
  },
  tagWrap: { flexDirection: "row", gap: 8 },
  categoryTag: {
    backgroundColor: "#F1F5F9",
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cycleTag: {
    backgroundColor: "#EFF6FF",
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
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
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  splitRule: { fontSize: 12, fontWeight: "600", color: "#2563EB" },
  payerRow: { flexDirection: "row", alignItems: "center" },
  payerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  payerAvatarText: { fontSize: 18, fontWeight: "900", color: "#1E40AF" },
  payerName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  payerSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  paidMethodBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paidMethodText: { fontSize: 11, fontWeight: "700", color: "#166534" },
  splitItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  userInitials: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userInitialsText: { fontSize: 14, fontWeight: "bold", color: "#475569" },
  splitUserName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  splitUserRole: { fontSize: 11, color: "#64748B" },
  splitAmount: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  statusBadge: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  statusPaid: { color: "#16A34A" },
  statusPending: { color: "#EAB308" },
  receiptPlaceholder: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  receiptImage: { width: "100%", height: 180, borderRadius: 12 },
  placeholderText: { fontSize: 13, fontWeight: "700", color: "#334155" },
  placeholderSub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  notesText: { fontSize: 13, color: "#475569", lineHeight: 20 },
});
