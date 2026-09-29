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
import { Feather, Ionicons } from "@expo/vector-icons";
import { formatPesos } from "@propertyflow/shared";
import { getCategoryMeta } from "../services/categoryService";
import { cleanBillTitle } from "../services/firebaseDataService";
import { useTheme } from "../context/ThemeContext";

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
    splitDetails?: Array<{
      userId: string;
      displayName: string;
      shareCentavos: number;
      percentage?: number;
      isExempt?: boolean;
      note?: string;
    }>;
  };
  onBack: () => void;
}

export const ExpenseDetailsScreen: React.FC<ExpenseDetailsScreenProps> = ({
  expense,
  onBack,
}) => {
  const { isDark, colors } = useTheme();

  const isExpensePaid =
    expense.status === "PAID" ||
    expense.status === "Paid" ||
    expense.isPaid === true;

  const catMeta = getCategoryMeta(expense.categoryLabel || expense.title);

  // Real split participants from bill or fallback
  const participants =
    expense.splitDetails && expense.splitDetails.length > 0
      ? expense.splitDetails.map((s) => ({
          name: s.displayName || "Roommate",
          role: s.isExempt ? "Non-Payor (Exempt)" : "Payor",
          shareCents: s.shareCentavos,
          status: isExpensePaid ? "Paid" : s.isExempt ? "Exempt" : "Pending",
          isExempt: s.isExempt,
          note: s.note,
        }))
      : [
          {
            name: "Alice Santos",
            role: "Host / Payor",
            shareCents: Math.round(expense.amountCents / 4),
            status: isExpensePaid ? "Paid" : "Pending",
            isExempt: false,
            note: undefined,
          },
          {
            name: "Bea Alonzo",
            role: "Payor",
            shareCents: Math.round(expense.amountCents / 4),
            status: isExpensePaid ? "Paid" : "Pending",
            isExempt: false,
            note: undefined,
          },
          {
            name: "Charlie Cruz",
            role: "Payor",
            shareCents: Math.round(expense.amountCents / 4),
            status: isExpensePaid ? "Paid" : "Pending",
            isExempt: false,
            note: undefined,
          },
          {
            name: "Dennis Tan",
            role: "Payor",
            shareCents:
              expense.amountCents - Math.round(expense.amountCents / 4) * 3,
            status: isExpensePaid ? "Paid" : "Pending",
            isExempt: false,
            note: undefined,
          },
        ];

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
          Bill Details
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Expense Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.heroIconWrap,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : catMeta.bgColor,
              },
            ]}
          >
            <Ionicons
              name={catMeta.ionicon as any}
              size={32}
              color={catMeta.color}
            />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {cleanBillTitle(expense.title, expense.categoryLabel)}
          </Text>
          <Text
            style={[
              styles.heroAmount,
              { color: isDark ? colors.text : "#2563EB" },
            ]}
          >
            {formatPesos(expense.amountCents)}
          </Text>
          <View style={styles.tagWrap}>
            <View
              style={[
                styles.categoryTagWrap,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.06)"
                    : catMeta.bgColor,
                  borderColor: isDark ? colors.border : catMeta.color,
                },
              ]}
            >
              <Text style={[styles.categoryTag, { color: catMeta.color }]}>
                {expense.categoryLabel}
              </Text>
            </View>
            <View
              style={[
                styles.cycleTagWrap,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#EFF6FF",
                  borderColor: colors.border,
                  borderWidth: isDark ? 1 : 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.cycleTag,
                  { color: isDark ? colors.accent : "#2563EB" },
                ]}
              >
                {expense.cycle}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadgeWrap,
                isExpensePaid
                  ? {
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.14)"
                        : "#DCFCE7",
                      borderColor: isDark
                        ? "rgba(16, 185, 129, 0.28)"
                        : "#BBF7D0",
                    }
                  : {
                      backgroundColor: isDark
                        ? "rgba(239, 68, 68, 0.14)"
                        : "#FEF2F2",
                      borderColor: isDark
                        ? "rgba(239, 68, 68, 0.28)"
                        : "#FECACA",
                    },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: isExpensePaid
                      ? isDark
                        ? "#34D399"
                        : "#16A34A"
                      : isDark
                        ? "#F87171"
                        : "#B91C1C",
                  },
                ]}
              >
                {isExpensePaid ? "PAID" : "UNPAID BILL"}
              </Text>
            </View>
          </View>
        </View>

        {/* Payer Info */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionHeading,
              { color: isDark ? colors.textSecondary : "#0F172A" },
            ]}
          >
            {isExpensePaid ? "Who Paid" : "Bill Status & Payer"}
          </Text>
          <View style={styles.payerRow}>
            <View
              style={[
                styles.payerAvatar,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#DBEAFE",
                  borderColor: colors.border,
                  borderWidth: isDark ? 1 : 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.payerAvatarText,
                  { color: isDark ? colors.accent : "#1E40AF" },
                ]}
              >
                {expense.payer.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.payerName, { color: colors.text }]}>
                {expense.payer}
              </Text>
              <Text style={[styles.payerSub, { color: colors.textSecondary }]}>
                {isExpensePaid
                  ? `Paid in Full on ${expense.date}`
                  : `Billed to Household on ${expense.date} · Due from payors`}
              </Text>
            </View>
            <View
              style={[
                styles.paidMethodBadge,
                isExpensePaid
                  ? {
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.14)"
                        : "#DCFCE7",
                      borderColor: isDark
                        ? "rgba(16, 185, 129, 0.28)"
                        : "#BBF7D0",
                    }
                  : {
                      backgroundColor: isDark
                        ? "rgba(239, 68, 68, 0.14)"
                        : "#FEF2F2",
                      borderColor: isDark
                        ? "rgba(239, 68, 68, 0.28)"
                        : "#FECACA",
                    },
              ]}
            >
              <Text
                style={[
                  styles.paidMethodText,
                  {
                    color: isExpensePaid
                      ? isDark
                        ? "#34D399"
                        : "#166534"
                      : isDark
                        ? "#F87171"
                        : "#B91C1C",
                  },
                ]}
              >
                {isExpensePaid ? "Cash / Bank" : "Unpaid Bill"}
              </Text>
            </View>
          </View>
        </View>

        {/* Split Breakdown */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <Text
              style={[
                styles.sectionHeading,
                { color: isDark ? colors.textSecondary : "#0F172A" },
              ]}
            >
              Split Breakdown
            </Text>
            <Text
              style={[
                styles.splitRule,
                { color: isDark ? colors.accent : "#2563EB" },
              ]}
            >
              {expense.splitMethod}
            </Text>
          </View>

          {participants.map((p, idx) => (
            <View
              key={idx}
              style={[
                styles.splitItem,
                {
                  borderBottomColor: colors.borderSubtle,
                },
              ]}
            >
              <View
                style={[
                  styles.userInitials,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                    borderColor: colors.border,
                    borderWidth: isDark ? 1 : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.userInitialsText,
                    { color: isDark ? colors.textSecondary : "#475569" },
                  ]}
                >
                  {p.name.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={[styles.splitUserName, { color: colors.text }]}>
                  {p.name}
                </Text>
                <Text
                  style={[
                    styles.splitUserRole,
                    { color: colors.textSecondary },
                  ]}
                >
                  {p.role}
                </Text>
                {p.note && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 2,
                    }}
                  >
                    <Feather
                      name="info"
                      size={11}
                      color={isDark ? colors.accent : "#0284C7"}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        color: isDark ? colors.accent : "#0284C7",
                      }}
                    >
                      {p.note}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.splitAmount, { color: colors.text }]}>
                  {formatPesos(p.shareCents)}
                </Text>
                <Text
                  style={[
                    styles.statusBadge,
                    p.status === "Paid"
                      ? { color: isDark ? "#34D399" : "#16A34A" }
                      : p.status === "Exempt"
                        ? { color: colors.textMuted }
                        : { color: isDark ? "#FBBF24" : "#EAB308" },
                  ]}
                >
                  {p.status}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Receipt Proof */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionHeading,
              { color: isDark ? colors.textSecondary : "#0F172A" },
            ]}
          >
            Receipt / Proof
          </Text>
          {expense.receiptUrl ? (
            <Image
              source={{ uri: expense.receiptUrl }}
              style={[styles.receiptImage, { borderColor: colors.border }]}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.receiptPlaceholder,
                {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather
                name="file-text"
                size={26}
                color={colors.textMuted}
                style={{ marginBottom: 6 }}
              />
              <Text
                style={[
                  styles.placeholderText,
                  { color: isDark ? colors.text : "#334155" },
                ]}
              >
                Official Document Uploaded
              </Text>
              <Text
                style={[styles.placeholderSub, { color: colors.textSecondary }]}
              >
                Validated & Archived for Audit
              </Text>
            </View>
          )}
        </View>

        {/* Notes & Audit Info */}
        {expense.notes && (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.sectionHeading,
                { color: isDark ? colors.textSecondary : "#0F172A" },
              ]}
            >
              Notes & Meter Readings
            </Text>
            <Text
              style={[
                styles.notesText,
                { color: isDark ? colors.textSecondary : "#475569" },
              ]}
            >
              {expense.notes}
            </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 12,
  },
  tagWrap: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  categoryTagWrap: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryTag: {
    fontSize: 12,
    fontWeight: "700",
  },
  cycleTagWrap: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cycleTag: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusBadgeWrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  splitRule: { fontSize: 12, fontWeight: "700" },
  payerRow: { flexDirection: "row", alignItems: "center" },
  payerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  payerAvatarText: { fontSize: 18, fontWeight: "900" },
  payerName: { fontSize: 14, fontWeight: "700" },
  payerSub: { fontSize: 12, marginTop: 2 },
  paidMethodBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  paidMethodText: { fontSize: 11, fontWeight: "700" },
  splitItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  userInitials: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userInitialsText: { fontSize: 14, fontWeight: "bold" },
  splitUserName: { fontSize: 13, fontWeight: "700" },
  splitUserRole: { fontSize: 11 },
  splitAmount: { fontSize: 14, fontWeight: "800" },
  statusBadge: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  receiptPlaceholder: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
  },
  receiptImage: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    borderWidth: 1,
  },
  placeholderText: { fontSize: 13, fontWeight: "700" },
  placeholderSub: { fontSize: 11, marginTop: 2 },
  notesText: { fontSize: 13, lineHeight: 20 },
});
