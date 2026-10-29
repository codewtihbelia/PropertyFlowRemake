import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import {
  WalletTransaction,
  PaymentCard,
  SavingsPocket,
  WalletSubscription,
  WalletDebt,
} from "../services/walletService";

interface WalletAnalyticsScreenProps {
  balance: number;
  transactions: WalletTransaction[];
  cards: PaymentCard[];
  pockets: SavingsPocket[];
  subscriptions?: WalletSubscription[];
  debts?: WalletDebt[];
  onBack: () => void;
}

type AnalyticsPeriod = "7d" | "30d" | "90d" | "1y" | "all";

export function WalletAnalyticsScreen({
  balance = 0,
  transactions = [],
  cards = [],
  pockets = [],
  subscriptions = [],
  debts = [],
  onBack,
}: WalletAnalyticsScreenProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");

  // Filter transactions by period
  const periodTransactions = useMemo(() => {
    const now = Date.now();
    let cutoff = 0;
    if (period === "7d") cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (period === "30d") cutoff = now - 30 * 24 * 60 * 60 * 1000;
    else if (period === "90d") cutoff = now - 90 * 24 * 60 * 60 * 1000;
    else if (period === "1y") cutoff = now - 365 * 24 * 60 * 60 * 1000;

    return transactions.filter((tx) => {
      if (cutoff === 0) return true;
      const t = new Date(tx.timestamp || 0).getTime();
      return t >= cutoff;
    });
  }, [transactions, period]);

  // Income vs Expense Metrics
  const metrics = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    const categoryTotals: Record<string, number> = {};
    const methodTotals: Record<string, number> = {};

    periodTransactions.forEach((tx) => {
      const isPositive =
        tx.type === "cash_in" || tx.type === "qr_transfer_received";
      const amt = tx.amount || 0;

      if (isPositive) {
        inflow += amt;
      } else {
        outflow += amt;

        // Categorize expenses
        let cat = "Other";
        const text = `${tx.title} ${tx.description} ${tx.note}`.toLowerCase();
        if (
          /food|jollibee|mcdo|lunch|dinner|coffee|restaurant|snack/.test(text)
        ) {
          cat = "Food & Dining";
        } else if (/commute|jeep|taxi|grab|bus|mrt|fare|gas|fuel/.test(text)) {
          cat = "Transportation";
        } else if (
          /water|electricity|meralco|pldt|globe|internet|utility|bill/.test(
            text,
          )
        ) {
          cat = "Utilities & Bills";
        } else if (
          /netflix|spotify|youtube|disney|sub|subscription|stream/.test(text)
        ) {
          cat = "Subscriptions";
        } else if (/debt|settle|loan|iou|roommate|borrow/.test(text)) {
          cat = "Debt Settlements";
        } else if (
          /shopping|groceries|shopee|lazada|mall|sm|puregold/.test(text)
        ) {
          cat = "Groceries & Retail";
        } else if (tx.type === "savings_deposit") {
          cat = "Savings Stashed";
        }

        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;

        // Categorize payment methods
        const m = tx.paymentMethodUsed || "Splitzy Wallet";
        methodTotals[m] = (methodTotals[m] || 0) + amt;
      }
    });

    // Sort categories descending
    const sortedCategories = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: outflow > 0 ? (amount / outflow) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Sort methods descending
    const sortedMethods = Object.entries(methodTotals)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: outflow > 0 ? (amount / outflow) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      inflow,
      outflow,
      net: inflow - outflow,
      sortedCategories,
      sortedMethods,
    };
  }, [periodTransactions]);

  // Subscriptions Burn Rate
  const subscriptionStats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status !== "cancelled");
    const monthlyTotal = active.reduce((sum, s) => {
      const amt = s.amount || 0;
      return sum + (s.billingCycle === "yearly" ? amt / 12 : amt);
    }, 0);
    return {
      count: active.length,
      monthlyTotal,
    };
  }, [subscriptions]);

  // Debts Overview
  const debtsStats = useMemo(() => {
    let iOweTotal = 0;
    let owedToMeTotal = 0;

    debts.forEach((d) => {
      if (d.status === "settled") return;
      const remaining = Math.max(0, d.amount - (d.settledAmount || 0));
      if (d.type === "i_owe") {
        iOweTotal += remaining;
      } else {
        owedToMeTotal += remaining;
      }
    });

    return {
      iOweTotal,
      owedToMeTotal,
      netDebt: owedToMeTotal - iOweTotal,
    };
  }, [debts]);

  // Category Icon & Color Mapping
  const getCategoryMeta = (catName: string) => {
    switch (catName) {
      case "Food & Dining":
        return { icon: "restaurant" as const, color: "#F59E0B", bg: "#FEF3C7" };
      case "Transportation":
        return { icon: "car" as const, color: "#3B82F6", bg: "#DBEAFE" };
      case "Utilities & Bills":
        return { icon: "flash" as const, color: "#8B5CF6", bg: "#EDE9FE" };
      case "Subscriptions":
        return { icon: "card" as const, color: "#EC4899", bg: "#FCE7F3" };
      case "Debt Settlements":
        return {
          icon: "swap-horizontal" as const,
          color: "#10B981",
          bg: "#D1FAE5",
        };
      case "Groceries & Retail":
        return { icon: "cart" as const, color: "#14B8A6", bg: "#CCFBF1" };
      case "Savings Stashed":
        return {
          icon: "shield-checkmark" as const,
          color: "#6366F1",
          bg: "#E0E7FF",
        };
      default:
        return { icon: "wallet" as const, color: "#64748B", bg: "#F1F5F9" };
    }
  };

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* 1. Sticky Header */}
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: colors.background,
            // borderBottomColor: isDark ? colors.border : "#E2E8F0",
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather
            name="chevron-left"
            size={24}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? colors.text : "#0F172A" },
            ]}
          >
            Wallet Analytics
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDark ? colors.textMuted : "#64748B" },
            ]}
          >
            Spending & Balance Insights
          </Text>
        </View>

        <View style={styles.headerBadge}>
          <Ionicons name="pie-chart" size={16} color="#D97706" />
        </View>
      </View>

      {/* 2. Period Filter Tabs */}
      <View
        style={[
          styles.periodRow,
          {
            backgroundColor: colors.background,
            // borderBottomColor: isDark ? colors.border : "#E2E8F0",
          },
        ]}
      >
        {(
          [
            { id: "7d", label: "7 Days" },
            { id: "30d", label: "30 Days" },
            { id: "90d", label: "3 Months" },
            { id: "1y", label: "1 Year" },
            { id: "all", label: "All Time" },
          ] as const
        ).map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.periodTab,
              period === p.id && {
                backgroundColor: isDark ? colors.surfaceInset : "#EFF6FF",
                borderColor: "#2563EB",
              },
            ]}
            onPress={() => setPeriod(p.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.periodTabText,
                period === p.id
                  ? { color: "#2563EB", fontWeight: "700" }
                  : { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 3. Hero Inflow vs Outflow Card */}
        <LinearGradient
          colors={isDark ? ["#0F172A", "#1E293B"] : ["#1E293B", "#0F172A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroCardEyebrow}>NET CASH FLOW</Text>
          <Text
            style={[
              styles.heroNetBalance,
              { color: metrics.net >= 0 ? "#34D399" : "#F87171" },
            ]}
          >
            {metrics.net >= 0 ? "+" : ""}₱
            {metrics.net.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>

          <View style={styles.heroSplitRow}>
            <View style={styles.heroSplitCol}>
              <View style={styles.heroSplitIconRow}>
                <Ionicons name="arrow-down-circle" size={16} color="#34D399" />
                <Text style={styles.heroSplitLabel}>TOTAL RECEIVED</Text>
              </View>
              <Text style={styles.heroSplitValueGreen}>
                +₱
                {metrics.inflow.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>

            <View style={styles.heroSplitDivider} />

            <View style={styles.heroSplitCol}>
              <View style={styles.heroSplitIconRow}>
                <Ionicons name="arrow-up-circle" size={16} color="#F87171" />
                <Text style={styles.heroSplitLabel}>TOTAL SPENT</Text>
              </View>
              <Text style={styles.heroSplitValueRed}>
                -₱
                {metrics.outflow.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* 4. Subscriptions & Debts Summary Cards */}
        <View style={styles.twoColumnRow}>
          {/* Subscriptions Burn Rate */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? colors.surface : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <View
                style={[
                  styles.metricIconWrap,
                  { backgroundColor: isDark ? "#4C1D95" : "#EDE9FE" },
                ]}
              >
                <Ionicons name="refresh" size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.metricCardBadge}>
                {subscriptionStats.count} Active
              </Text>
            </View>
            <Text
              style={[
                styles.metricCardTitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              Subscription Burn
            </Text>
            <Text
              style={[
                styles.metricCardAmount,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              ₱{Math.round(subscriptionStats.monthlyTotal).toLocaleString()}
              <Text style={styles.metricCardUnit}>/mo</Text>
            </Text>
          </View>

          {/* Debts Balance */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? colors.surface : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <View
                style={[
                  styles.metricIconWrap,
                  { backgroundColor: isDark ? "#064E3B" : "#D1FAE5" },
                ]}
              >
                <Ionicons name="swap-horizontal" size={18} color="#059669" />
              </View>
              <Text style={styles.metricCardBadge}>
                {debtsStats.netDebt >= 0 ? "Positive" : "Deficit"}
              </Text>
            </View>
            <Text
              style={[
                styles.metricCardTitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              Debts Status
            </Text>
            <Text
              style={[
                styles.metricCardAmount,
                {
                  color: debtsStats.netDebt >= 0 ? "#059669" : "#EF4444",
                },
              ]}
            >
              {debtsStats.netDebt >= 0 ? "+₱" : "-₱"}
              {Math.abs(debtsStats.netDebt).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* 5. Spending by Category Breakdown */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? colors.surface : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Spending by Category
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                Distribution across lifestyle & household costs
              </Text>
            </View>
          </View>

          {metrics.sortedCategories.length === 0 ? (
            <View style={styles.emptyCategories}>
              <Text
                style={[
                  styles.emptyCategoriesText,
                  { color: isDark ? colors.textMuted : "#94A3B8" },
                ]}
              >
                No expenses recorded for this timeframe.
              </Text>
            </View>
          ) : (
            <View style={styles.categoriesList}>
              {metrics.sortedCategories.map((cat) => {
                const meta = getCategoryMeta(cat.name);
                return (
                  <View key={cat.name} style={styles.catItem}>
                    <View style={styles.catHeaderRow}>
                      <View style={styles.catLeftRow}>
                        <View
                          style={[
                            styles.catIconWrap,
                            { backgroundColor: meta.bg },
                          ]}
                        >
                          <Ionicons
                            name={meta.icon}
                            size={16}
                            color={meta.color}
                          />
                        </View>
                        <Text
                          style={[
                            styles.catName,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </View>

                      <View style={styles.catRightCol}>
                        <Text
                          style={[
                            styles.catAmount,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          ₱
                          {cat.amount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                        <Text
                          style={[
                            styles.catPercent,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          {cat.percentage.toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View
                      style={[
                        styles.progressBarTrack,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F1F5F9",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                            backgroundColor: meta.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 6. Payment Methods Utilization */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? colors.surface : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Payment Method Usage
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                Which accounts & cards funded your spending
              </Text>
            </View>
          </View>

          {metrics.sortedMethods.length === 0 ? (
            <View style={styles.emptyCategories}>
              <Text
                style={[
                  styles.emptyCategoriesText,
                  { color: isDark ? colors.textMuted : "#94A3B8" },
                ]}
              >
                No payment methods utilized during this period.
              </Text>
            </View>
          ) : (
            <View style={styles.categoriesList}>
              {metrics.sortedMethods.map((m) => (
                <View key={m.name} style={styles.methodRow}>
                  <View style={styles.methodLeftCol}>
                    <Ionicons name="card-outline" size={18} color="#2563EB" />
                    <Text
                      style={[
                        styles.methodName,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      {m.name}
                    </Text>
                  </View>

                  <View style={styles.methodRightCol}>
                    <Text
                      style={[
                        styles.methodAmount,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      ₱
                      {m.amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                    <Text
                      style={[
                        styles.methodPercent,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      {m.percentage.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 7. Savings Pockets Stash Progress */}
        {pockets.length > 0 && (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: isDark ? colors.surface : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                >
                  Savings Goal Progress
                </Text>
                <Text
                  style={[
                    styles.sectionSubtitle,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Vault allocations for upcoming milestones
                </Text>
              </View>
            </View>

            <View style={styles.categoriesList}>
              {pockets.map((p) => {
                const pct =
                  p.targetAmount > 0
                    ? Math.min(
                        100,
                        Math.round((p.currentAmount / p.targetAmount) * 100),
                      )
                    : 100;
                return (
                  <View key={p.id} style={styles.catItem}>
                    <View style={styles.catHeaderRow}>
                      <View style={styles.catLeftRow}>
                        <View
                          style={[
                            styles.catIconWrap,
                            { backgroundColor: `${p.color}22` },
                          ]}
                        >
                          <Ionicons
                            name="shield-checkmark"
                            size={16}
                            color={p.color}
                          />
                        </View>
                        <Text
                          style={[
                            styles.catName,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          {p.name}
                        </Text>
                      </View>

                      <View style={styles.catRightCol}>
                        <Text
                          style={[
                            styles.catAmount,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          ₱{p.currentAmount.toLocaleString()} / ₱
                          {p.targetAmount.toLocaleString()}
                        </Text>
                        <Text style={[styles.catPercent, { color: p.color }]}>
                          {pct}%
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.progressBarTrack,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F1F5F9",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${pct}%`,
                            backgroundColor: p.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  periodTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "transparent",
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroCardEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#94A3B8",
    marginBottom: 4,
  },
  heroNetBalance: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  heroSplitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
    paddingTop: 14,
  },
  heroSplitCol: {
    flex: 1,
  },
  heroSplitIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 3,
  },
  heroSplitLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "#94A3B8",
  },
  heroSplitValueGreen: {
    fontSize: 15,
    fontWeight: "700",
    color: "#34D399",
  },
  heroSplitValueRed: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F87171",
  },
  heroSplitDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginHorizontal: 12,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  metricCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  metricCardBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  metricCardTitle: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  metricCardAmount: {
    fontSize: 18,
    fontWeight: "800",
  },
  metricCardUnit: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyCategories: {
    paddingVertical: 18,
    alignItems: "center",
  },
  emptyCategoriesText: {
    fontSize: 13,
  },
  categoriesList: {
    gap: 14,
  },
  catItem: {
    gap: 6,
  },
  catHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  catLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  catIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: {
    fontSize: 13,
    fontWeight: "600",
  },
  catRightCol: {
    alignItems: "flex-end",
  },
  catAmount: {
    fontSize: 13,
    fontWeight: "700",
  },
  catPercent: {
    fontSize: 11,
    marginTop: 1,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  methodLeftCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  methodName: {
    fontSize: 13,
    fontWeight: "600",
  },
  methodRightCol: {
    alignItems: "flex-end",
  },
  methodAmount: {
    fontSize: 13,
    fontWeight: "700",
  },
  methodPercent: {
    fontSize: 11,
    color: "#64748B",
  },
});
