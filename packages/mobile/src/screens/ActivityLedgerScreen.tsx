import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  Share,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { WalletTransaction } from "../services/walletService";
import { getExpenseSemanticIconMobile } from "../utils/WalletSemanticIcons";

interface ActivityLedgerScreenProps {
  transactions: WalletTransaction[];
  onBack: () => void;
  onSelectTransaction?: (tx: WalletTransaction) => void;
}

type TimeFilter = "all" | "today" | "week" | "month";
type TypeFilter =
  | "all"
  | "cash_in"
  | "expense"
  | "transfer"
  | "debt_settlement";

export function ActivityLedgerScreen({
  transactions = [],
  onBack,
  onSelectTransaction,
}: ActivityLedgerScreenProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).getTime();

    const q = searchQuery.toLowerCase().trim();

    return transactions.filter((tx) => {
      // 1. Text Search Filter
      if (q) {
        const titleMatch = (tx.title || "").toLowerCase().includes(q);
        const descMatch = (tx.description || "").toLowerCase().includes(q);
        const noteMatch = (tx.note || "").toLowerCase().includes(q);
        const methodMatch = (tx.paymentMethodUsed || "")
          .toLowerCase()
          .includes(q);
        const refMatch = (tx.referenceId || tx.id || "")
          .toLowerCase()
          .includes(q);
        const amountMatch = String(tx.amount || "").includes(q);
        if (
          !titleMatch &&
          !descMatch &&
          !noteMatch &&
          !methodMatch &&
          !refMatch &&
          !amountMatch
        ) {
          return false;
        }
      }

      // 2. Type Filter
      if (typeFilter !== "all") {
        if (
          typeFilter === "cash_in" &&
          tx.type !== "cash_in" &&
          tx.type !== "qr_transfer_received"
        ) {
          return false;
        }
        if (
          typeFilter === "expense" &&
          tx.type !== "cash_expense" &&
          tx.type !== "expense_simulation" &&
          tx.type !== "bill_payment" &&
          tx.type !== "expense_share"
        ) {
          return false;
        }
        if (
          typeFilter === "transfer" &&
          tx.type !== "card_transfer" &&
          tx.type !== "qr_transfer_sent" &&
          tx.type !== "savings_deposit" &&
          tx.type !== "savings_withdrawal"
        ) {
          return false;
        }
        if (typeFilter === "debt_settlement" && tx.type !== "debt_settlement") {
          return false;
        }
      }

      // 3. Time Filter
      if (timeFilter !== "all") {
        const txTime = new Date(tx.timestamp || 0).getTime();
        if (timeFilter === "today" && txTime < startOfToday) return false;
        if (timeFilter === "week" && txTime < oneWeekAgo) return false;
        if (timeFilter === "month" && txTime < startOfMonth) return false;
      }

      return true;
    });
  }, [transactions, searchQuery, timeFilter, typeFilter]);

  // Statistics for current filtered view
  const stats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;

    filteredTransactions.forEach((tx) => {
      const isPositive =
        tx.type === "cash_in" || tx.type === "qr_transfer_received";
      if (isPositive) {
        inflow += tx.amount || 0;
      } else {
        outflow += tx.amount || 0;
      }
    });

    return {
      inflow,
      outflow,
      net: inflow - outflow,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  const handleShareSummary = async () => {
    try {
      const summaryText =
        `Splitzy Wallet Ledger Summary\n` +
        `Total Activities: ${stats.count}\n` +
        `Total Inflow: +₱${stats.inflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
        `Total Outflow: -₱${stats.outflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
        `Net Balance: ₱${stats.net.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      await Share.share({ message: summaryText });
    } catch (_) {}
  };

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: isDark ? colors.background : "#F8FAFC",
          paddingTop: insets.top,
        },
      ]}
    >
      {/* 1. Sticky Header */}
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: isDark ? colors.surface : "#F8FAFC",
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
            Activity & Ledger
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDark ? colors.textMuted : "#64748B" },
            ]}
          >
            {stats.count} recorded {stats.count === 1 ? "entry" : "entries"}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.actionIconBtn,
              showSearchInput && {
                backgroundColor: isDark ? "#1E293B" : "#EFF6FF",
              },
            ]}
            onPress={() => setShowSearchInput(!showSearchInput)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="search"
              size={18}
              color={
                showSearchInput
                  ? "#2563EB"
                  : isDark
                    ? colors.textMuted
                    : "#64748B"
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={handleShareSummary}
            activeOpacity={0.7}
          >
            <Ionicons
              name="share-outline"
              size={18}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Search Bar */}
      {showSearchInput && (
        <View
          style={[
            styles.searchBarContainer,
            {
              backgroundColor: isDark ? colors.surface : "#F8FAFC",
              borderBottomColor: isDark ? colors.border : "#F1F5F9",
            },
          ]}
        >
          <View
            style={[
              styles.searchInputWrap,
              {
                backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={isDark ? colors.textMuted : "#64748B"}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={[
                styles.searchInput,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
              placeholder="Search by title, merchant, amount, or ref ID..."
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={isDark ? colors.textMuted : "#94A3B8"}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 3. Filter Chips (Time & Type) */}
      <View
        style={[
          styles.filtersContainer,
          {
            backgroundColor: isDark ? colors.surface : "#F8FAFC",
            borderBottomColor: isDark ? colors.border : "#E2E8F0",
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {/* Time filters */}
          {(
            [
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "week", label: "Last 7 Days" },
              { id: "month", label: "This Month" },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.filterChip,
                timeFilter === t.id
                  ? styles.filterChipActive
                  : {
                      backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                      borderColor: isDark ? colors.border : "#E2E8F0",
                    },
              ]}
              onPress={() => setTimeFilter(t.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  timeFilter === t.id
                    ? styles.filterChipTextActive
                    : { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.filterDivider} />

          {/* Type filters */}
          {(
            [
              { id: "all", label: "All Types" },
              { id: "cash_in", label: "Cash In" },
              { id: "expense", label: "Expenses" },
              { id: "transfer", label: "Transfers" },
              { id: "debt_settlement", label: "Debts" },
            ] as const
          ).map((tp) => (
            <TouchableOpacity
              key={tp.id}
              style={[
                styles.filterChip,
                typeFilter === tp.id
                  ? styles.filterChipActiveGreen
                  : {
                      backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                      borderColor: isDark ? colors.border : "#E2E8F0",
                    },
              ]}
              onPress={() => setTypeFilter(tp.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  typeFilter === tp.id
                    ? styles.filterChipTextActive
                    : { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                {tp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 4. Financial Summary Metrics Bar */}
      <View
        style={[
          styles.summaryBar,
          {
            backgroundColor: isDark ? colors.surface : "#FFFFFF",
            borderColor: isDark ? colors.border : "#E2E8F0",
          },
        ]}
      >
        <View style={styles.summaryItem}>
          <Text
            style={[
              styles.summaryLabel,
              { color: isDark ? colors.textMuted : "#64748B" },
            ]}
          >
            Inflow
          </Text>
          <Text style={[styles.summaryValue, { color: "#10B981" }]}>
            +₱
            {stats.inflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text
            style={[
              styles.summaryLabel,
              { color: isDark ? colors.textMuted : "#64748B" },
            ]}
          >
            Outflow
          </Text>
          <Text style={[styles.summaryValue, { color: "#EF4444" }]}>
            -₱
            {stats.outflow.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text
            style={[
              styles.summaryLabel,
              { color: isDark ? colors.textMuted : "#64748B" },
            ]}
          >
            Net
          </Text>
          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  stats.net >= 0
                    ? isDark
                      ? colors.text
                      : "#0F172A"
                    : "#EF4444",
              },
            ]}
          >
            {stats.net >= 0 ? "+" : ""}₱
            {stats.net.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* 5. Main Transactions List */}
      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {filteredTransactions.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isDark ? colors.surface : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="receipt-outline"
                size={36}
                color={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>
            <Text
              style={[
                styles.emptyTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              No activities found
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              {searchQuery
                ? `No transactions matched "${searchQuery}". Try a different keyword or reset filters.`
                : "No activities match your selected filter criteria."}
            </Text>
            {(searchQuery || timeFilter !== "all" || typeFilter !== "all") && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => {
                  setSearchQuery("");
                  setTimeFilter("all");
                  setTypeFilter("all");
                }}
              >
                <Text style={styles.resetBtnText}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredTransactions.map((tx) => {
            const isPositive =
              tx.type === "cash_in" || tx.type === "qr_transfer_received";
            const sem = getExpenseSemanticIconMobile(tx);

            const timeStr = tx.timestamp
              ? new Date(tx.timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Recent";

            return (
              <TouchableOpacity
                key={tx.id}
                style={[
                  styles.txItem,
                  {
                    backgroundColor: isDark ? colors.surface : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#E2E8F0",
                  },
                ]}
                onPress={() => {
                  if (onSelectTransaction) {
                    onSelectTransaction(tx);
                  } else {
                    setSelectedTx(tx);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.txIconWrap, { backgroundColor: sem.bg }]}>
                  <Ionicons name={sem.icon} size={20} color={sem.color} />
                </View>

                <View style={styles.txTextCol}>
                  <View style={styles.txTitleRow}>
                    <Text
                      style={[
                        styles.txTitle,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                      numberOfLines={1}
                    >
                      {tx.title || tx.description || "Transaction"}
                    </Text>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: isPositive ? "#10B981" : "#EF4444" },
                      ]}
                    >
                      {isPositive ? "+" : "-"}₱
                      {Number(tx.amount || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                  </View>

                  <View style={styles.txSubRow}>
                    <Text
                      style={[
                        styles.txSubtitle,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                      numberOfLines={1}
                    >
                      {tx.note ||
                        tx.description ||
                        tx.paymentMethodUsed ||
                        "Wallet"}
                    </Text>

                    <Text
                      style={[
                        styles.txTime,
                        { color: isDark ? colors.textMuted : "#94A3B8" },
                      ]}
                    >
                      {timeStr}
                    </Text>
                  </View>

                  <View style={styles.txMetaRow}>
                    {tx.paymentMethodUsed && (
                      <View
                        style={[
                          styles.badgePill,
                          {
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#F1F5F9",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgePillText,
                            { color: isDark ? colors.textMuted : "#475569" },
                          ]}
                        >
                          {tx.paymentMethodUsed}
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.badgePill,
                        {
                          backgroundColor:
                            tx.status === "failed"
                              ? "#FEE2E2"
                              : isDark
                                ? "#064E3B"
                                : "#ECFDF5",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgePillText,
                          {
                            color:
                              tx.status === "failed" ? "#DC2626" : "#059669",
                          },
                        ]}
                      >
                        {tx.status || "completed"}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
  },
  filtersContainer: {
    paddingVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  filterChipActiveGreen: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  filterDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 4,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2E8F0",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  txItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  txTextCol: {
    flex: 1,
  },
  txTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  txSubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  txSubtitle: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  txTime: {
    fontSize: 11,
  },
  txMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 32,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  resetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2563EB",
  },
  resetBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
