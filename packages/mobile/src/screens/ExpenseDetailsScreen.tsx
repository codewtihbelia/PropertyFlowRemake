import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { formatPesos } from "@propertyflow/shared";
import { getCategoryMeta } from "../services/categoryService";
import {
  cleanBillTitle,
  mobileDataService,
  MobilePayment,
  isPayorMember,
} from "../services/firebaseDataService";
import { auth } from "../firebase/config";
import { useTheme } from "../context/ThemeContext";
import { ExpensePayorBreakdownItem } from "./ExpenseHistoryScreen";

interface ExpenseDetailsScreenProps {
  expense: {
    id: string;
    householdId?: string;
    title: string;
    categoryLabel: string;
    icon: string;
    amountCents: number;
    date: string;
    payer: string;
    recordedBy?: string;
    groupPayorsSummary?: string;
    payorCount?: number;
    myShareCents?: number;
    myShareFormatted?: string;
    isCurrentUserPayor?: boolean;
    splitMethod: string;
    cycle: string;
    billingCycleId?: string;
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
      isPaid?: boolean;
      paidDate?: string;
      paymentId?: string;
      role?: string;
      note?: string;
    }>;
    payorBreakdown?: ExpensePayorBreakdownItem[];
  };
  onBack: () => void;
}

export const ExpenseDetailsScreen: React.FC<ExpenseDetailsScreenProps> = ({
  expense,
  onBack,
}) => {
  const { isDark, colors } = useTheme();
  const currentUser = auth.currentUser;
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<MobilePayment[]>([]);

  const effectiveHouseholdId =
    expense.householdId ||
    mobileDataService.getCachedProfile()?.householdId ||
    "";

  useEffect(() => {
    if (!effectiveHouseholdId) return;
    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      effectiveHouseholdId,
      (data) => setMembers(data || []),
    );
    const unsubPayments = mobileDataService.listenToPayments(
      effectiveHouseholdId,
      (data) => setPayments(data || []),
    );
    return () => {
      unsubMembers();
      unsubPayments();
    };
  }, [effectiveHouseholdId]);

  const isExpensePaid =
    expense.status === "PAID" ||
    expense.status === "Paid" ||
    expense.isPaid === true ||
    Boolean(expense.payorBreakdown && expense.payorBreakdown.length > 0);

  const catMeta = getCategoryMeta(expense.categoryLabel || expense.title);

  // Build real breakdown from passed payorBreakdown or live household members + splitDetails + payments
  const participants: ExpensePayorBreakdownItem[] = useMemo(() => {
    if (expense.payorBreakdown && expense.payorBreakdown.length > 0) {
      return expense.payorBreakdown;
    }

    const activeMembers = members.filter(
      (m) => !m.status || m.status === "ACTIVE" || m.status === "SETTLED",
    );
    const rawSplits = Array.isArray(expense.splitDetails)
      ? expense.splitDetails
      : [];

    const sourceMembers =
      activeMembers.length > 0
        ? activeMembers
        : rawSplits.map((s) => ({
            userId: s.userId,
            memberId: s.userId,
            displayName: s.displayName || "Roommate",
            role: (s.role as any) || (s.isExempt ? "NON_PAYOR" : "PAYOR"),
            isExempt: s.isExempt,
          }));

    const effPayors = sourceMembers.filter((m: any) => isPayorMember(m));
    const effPayorCount = Math.max(
      1,
      effPayors.length > 0 ? effPayors.length : sourceMembers.length,
    );

    const list: ExpensePayorBreakdownItem[] = sourceMembers.map((m: any) => {
      const uid = m.userId || m.memberId || m.id;
      const isPayor = isPayorMember(m);
      const splitEntry = rawSplits.find(
        (s: any) => s.userId === uid || s.memberId === uid || s.id === uid,
      );
      const isExempt = !isPayor || Boolean(splitEntry?.isExempt);
      const shareCentavos = isExempt
        ? 0
        : splitEntry &&
            typeof splitEntry.shareCentavos === "number" &&
            splitEntry.shareCentavos > 0
          ? splitEntry.shareCentavos
          : Math.round((expense.amountCents || 0) / effPayorCount);

      const percentage = isExempt
        ? 0
        : expense.amountCents > 0
          ? Math.round((shareCentavos / expense.amountCents) * 1000) / 10
          : Math.round((100 / effPayorCount) * 10) / 10;

      const matchedPayment = payments.find((pmt) => {
        if (pmt.userId !== uid || pmt.status === "REJECTED") return false;
        if (splitEntry?.paymentId && pmt.paymentId === splitEntry.paymentId) {
          return true;
        }
        if (!expense.billingCycleId) return true;
        return (
          pmt.billingCycleId === expense.billingCycleId ||
          !pmt.billingCycleId ||
          pmt.billingCycleId === "general"
        );
      });

      const memberName =
        m.displayName ||
        m.name ||
        splitEntry?.displayName ||
        (m.role === "HOST" ? "Host" : "Roommate");

      const roleType: "HOST" | "PAYOR" | "NON_PAYOR" =
        m.role === "HOST" ? "HOST" : isExempt ? "NON_PAYOR" : "PAYOR";

      const roleLabel =
        m.role === "HOST"
          ? isExempt
            ? "HOST · EXEMPT"
            : "HOST · PAYOR"
          : isExempt
            ? "NON-PAYOR (EXEMPT)"
            : "GROUP PAYOR";

      return {
        userId: uid,
        displayName: memberName,
        role: roleType,
        roleLabel,
        isPayor: !isExempt,
        isExempt,
        shareCentavos,
        percentage,
        isPaid: isExpensePaid || Boolean(splitEntry?.isPaid),
        paidDate:
          matchedPayment?.paymentDate ||
          (splitEntry?.paidDate
            ? String(splitEntry.paidDate).slice(0, 10)
            : expense.date),
        paymentMethod: matchedPayment?.paymentMethod || undefined,
        referenceNumber: matchedPayment?.referenceNumber || undefined,
        note:
          splitEntry?.note ||
          (isExempt
            ? "Exempted (Non-payor)"
            : `Fair share across ${effPayorCount} ${effPayorCount === 1 ? "payor" : "payors"} (${percentage}%)`),
        isCurrentUser: Boolean(currentUser?.uid && uid === currentUser.uid),
      };
    });

    list.sort((a, b) => {
      if (a.isCurrentUser && !b.isCurrentUser) return -1;
      if (!a.isCurrentUser && b.isCurrentUser) return 1;
      if (a.isPayor && !b.isPayor) return -1;
      if (!a.isPayor && b.isPayor) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return list;
  }, [
    expense.payorBreakdown,
    expense.splitDetails,
    expense.amountCents,
    expense.billingCycleId,
    expense.date,
    members,
    payments,
    isExpensePaid,
    currentUser?.uid,
  ]);

  const contributingPayors = useMemo(
    () => participants.filter((p) => p.isPayor),
    [participants],
  );

  const exemptMembers = useMemo(
    () => participants.filter((p) => !p.isPayor || p.isExempt),
    [participants],
  );

  const recordedByName =
    expense.recordedBy ||
    (expense.payer && !expense.payer.includes("Group Payor")
      ? expense.payer
      : "Host");

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent={true}
        backgroundColor="transparent"
      />
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
            name="chevron-left"
            size={20}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Paid Bill Breakdown
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
                  ? catMeta.darkBgColor || "rgba(255, 255, 255, 0.08)"
                  : catMeta.bgColor,
                borderWidth: 1,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.04)",
              },
            ]}
          >
            <Ionicons
              name={catMeta.ionicon as any}
              size={32}
              color={
                isDark ? catMeta.darkColor || catMeta.color : catMeta.color
              }
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

          <Text style={[styles.heroSubtext, { color: colors.textSecondary }]}>
            Settled on {expense.date} · Added by {recordedByName}
          </Text>

          <View style={styles.tagWrap}>
            <View
              style={[
                styles.categoryTagWrap,
                {
                  backgroundColor: isDark
                    ? catMeta.darkBgColor || "rgba(255, 255, 255, 0.08)"
                    : catMeta.bgColor,
                  borderColor: isDark
                    ? catMeta.darkColor || colors.border
                    : catMeta.color,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryTag,
                  {
                    color: isDark
                      ? catMeta.darkColor || colors.text
                      : catMeta.color,
                  },
                ]}
              >
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
                {
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.14)"
                    : "#DCFCE7",
                  borderColor: isDark ? "rgba(16, 185, 129, 0.28)" : "#BBF7D0",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: isDark ? "#34D399" : "#16A34A",
                  },
                ]}
              >
                PAID BY {contributingPayors.length || 1}{" "}
                {(contributingPayors.length || 1) === 1 ? "PAYOR" : "PAYORS"}
              </Text>
            </View>
          </View>
        </View>

        {/* True Group Payors Section (Who Truly Paid It) */}
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
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text
                style={[
                  styles.sectionHeading,
                  {
                    color: isDark ? colors.text : "#0F172A",
                    marginBottom: 2,
                  },
                ]}
              >
                Who Truly Paid ({contributingPayors.length} Group{" "}
                {contributingPayors.length === 1 ? "Payor" : "Payors"})
              </Text>
              <Text
                style={[
                  styles.sectionSubHeading,
                  { color: colors.textSecondary },
                ]}
              >
                Paid collectively by household payors ({expense.splitMethod})
              </Text>
            </View>

            <View
              style={[
                styles.settledPill,
                {
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.16)"
                    : "#DCFCE7",
                  borderColor: isDark ? "rgba(16, 185, 129, 0.35)" : "#86EFAC",
                },
              ]}
            >
              <Feather
                name="check-circle"
                size={9}
                color={isDark ? "#34D399" : "#15803D"}
              />
              <Text
                style={[
                  styles.settledPillText,
                  { color: isDark ? "#34D399" : "#15803D" },
                ]}
              >
                100% PAID
              </Text>
            </View>
          </View>

          {contributingPayors.map((payor, idx) => (
            <View
              key={payor.userId || idx}
              style={[
                styles.payorCardRow,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                  borderColor: payor.isCurrentUser
                    ? isDark
                      ? "rgba(59, 130, 246, 0.45)"
                      : "#93C5FD"
                    : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.payerAvatar,
                  {
                    backgroundColor: isDark
                      ? "rgba(59, 130, 246, 0.18)"
                      : "#DBEAFE",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.payerAvatarText,
                    { color: isDark ? "#60A5FA" : "#1E40AF" },
                  ]}
                >
                  {payor.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={styles.payorNameRow}>
                  <Text style={[styles.payerName, { color: colors.text }]}>
                    {payor.displayName}
                    {payor.isCurrentUser ? " (You)" : ""}
                  </Text>
                  <View
                    style={[
                      styles.roleBadge,
                      {
                        backgroundColor:
                          payor.role === "HOST"
                            ? isDark
                              ? "rgba(245, 158, 11, 0.18)"
                              : "#FEF3C7"
                            : isDark
                              ? "rgba(59, 130, 246, 0.18)"
                              : "#DBEAFE",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBadgeText,
                        {
                          color:
                            payor.role === "HOST"
                              ? isDark
                                ? "#FBBF24"
                                : "#B45309"
                              : isDark
                                ? "#60A5FA"
                                : "#1D4ED8",
                        },
                      ]}
                    >
                      {payor.roleLabel}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[styles.payerSub, { color: colors.textSecondary }]}
                >
                  {payor.note}
                </Text>

                <View style={styles.paymentMetaRow}>
                  <Feather
                    name="check-circle"
                    size={11}
                    color={isDark ? "#34D399" : "#16A34A"}
                  />
                  <Text
                    style={[
                      styles.paymentMetaText,
                      { color: isDark ? "#34D399" : "#15803D" },
                    ]}
                  >
                    Paid {payor.paidDate ? `on ${payor.paidDate}` : "in full"}
                    {payor.paymentMethod ? ` via ${payor.paymentMethod}` : ""}
                    {payor.referenceNumber ? ` (${payor.referenceNumber})` : ""}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.splitAmount, { color: colors.text }]}>
                  {formatPesos(payor.shareCentavos)}
                </Text>
                <Text
                  style={[
                    styles.sharePercentText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {payor.percentage}% of bill
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Exempt / Non-Payor Household Members (if any) */}
        {exemptMembers.length > 0 && (
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
                  {
                    color: isDark ? colors.textSecondary : "#0F172A",
                    marginBottom: 0,
                  },
                ]}
              >
                Exempt Members ({exemptMembers.length})
              </Text>
              <Text
                style={[
                  styles.splitRule,
                  { color: isDark ? "#C084FC" : "#7C3AED" },
                ]}
              >
                ₱0.00 Share
              </Text>
            </View>

            {exemptMembers.map((p, idx) => (
              <View
                key={p.userId || idx}
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
                      backgroundColor: isDark ? colors.surfaceInset : "#F3E8FF",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.userInitialsText,
                      { color: isDark ? "#C084FC" : "#6D28D9" },
                    ]}
                  >
                    {p.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <Text style={[styles.splitUserName, { color: colors.text }]}>
                    {p.displayName}
                    {p.isCurrentUser ? " (You)" : ""}
                  </Text>
                  <Text
                    style={[
                      styles.splitUserRole,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {p.note || "Exempted (Non-payor)"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[
                      styles.splitAmount,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Exempt
                  </Text>
                  <Text
                    style={[styles.statusBadge, { color: colors.textMuted }]}
                  >
                    ₱0.00
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

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
                Settled Household Bill Record
              </Text>
              <Text
                style={[styles.placeholderSub, { color: colors.textSecondary }]}
              >
                Verified & Settled by {contributingPayors.length} Group{" "}
                {contributingPayors.length === 1 ? "Payor" : "Payors"}
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
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginBottom: 4,
  },
  heroSubtext: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 12,
    textAlign: "center",
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
  sectionSubHeading: {
    fontSize: 11,
    fontWeight: "500",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  settledPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  settledPillText: {
    fontSize: 8,
    fontWeight: "800",
  },
  splitRule: { fontSize: 12, fontWeight: "700" },
  payorCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  payerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  payerAvatarText: { fontSize: 16, fontWeight: "900" },
  payorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  payerName: { fontSize: 14, fontWeight: "700" },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  payerSub: { fontSize: 11, marginTop: 3 },
  paymentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  paymentMetaText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sharePercentText: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
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
  splitAmount: { fontSize: 15, fontWeight: "800" },
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
