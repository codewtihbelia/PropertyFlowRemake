import React, { useState, useMemo, useEffect } from "react";
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
  Modal,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../context/ThemeContext";
import { useNavVisibility } from "../context/NavVisibilityContext";
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

export interface CustomDateFilter {
  type: "single" | "range" | "preset";
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ActivityLedgerScreen({
  transactions = [],
  onBack,
  onSelectTransaction,
}: ActivityLedgerScreenProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { hideNav, showNav } = useNavVisibility();

  // Hide bottom navigation bar while in Activity Ledger screen
  useEffect(() => {
    hideNav();
    return () => {
      showNav();
    };
  }, [hideNav, showNav]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // In-screen Transaction Detail Modal State
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [copiedRefId, setCopiedRefId] = useState(false);

  // Dedicated Date Search & Filter State
  const [customDateFilter, setCustomDateFilter] =
    useState<CustomDateFilter | null>(null);
  const [showDatePickerModal, setShowDatePickerModal] =
    useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [calendarMode, setCalendarMode] = useState<
    "presets" | "single" | "range"
  >("presets");
  const [pickedSingleDate, setPickedSingleDate] = useState<string>(() =>
    formatLocalDate(new Date()),
  );
  const [pickedRangeStart, setPickedRangeStart] = useState<string>(() =>
    formatLocalDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
  );
  const [pickedRangeEnd, setPickedRangeEnd] = useState<string>(() =>
    formatLocalDate(new Date()),
  );

  // Set of dates in YYYY-MM-DD that have transactions (for calendar dots)
  const transactionDatesSet = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.timestamp) {
        try {
          const d = new Date(tx.timestamp);
          s.add(formatLocalDate(d));
        } catch (_) {}
      }
    });
    return s;
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).getTime();

    const q = searchQuery.toLowerCase().trim();

    return transactions.filter((tx) => {
      const txTime = new Date(tx.timestamp || 0).getTime();
      const txDateObj = new Date(tx.timestamp || 0);
      const txIsoDate = formatLocalDate(txDateObj);

      // 1. Text & Date Search Filter
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

        // Date-aware search matching
        let dateMatch = false;
        if (tx.timestamp) {
          const shortMonth = txDateObj
            .toLocaleDateString("en-US", { month: "short" })
            .toLowerCase();
          const longMonth = txDateObj
            .toLocaleDateString("en-US", { month: "long" })
            .toLowerCase();
          const shortDate = txDateObj
            .toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
            .toLowerCase();
          const dayNumber = String(txDateObj.getDate());
          const yearNumber = String(txDateObj.getFullYear());
          const slashDate = `${txDateObj.getMonth() + 1}/${txDateObj.getDate()}`;
          const slashDateFull = `${txDateObj.getMonth() + 1}/${txDateObj.getDate()}/${yearNumber}`;
          const weekday = txDateObj
            .toLocaleDateString("en-US", { weekday: "long" })
            .toLowerCase();

          if (
            txIsoDate.includes(q) ||
            shortDate.includes(q) ||
            longMonth.includes(q) ||
            shortMonth === q ||
            slashDate.includes(q) ||
            slashDateFull.includes(q) ||
            weekday.includes(q) ||
            (q.length >= 2 && dayNumber === q) ||
            yearNumber === q
          ) {
            dateMatch = true;
          }

          if (q === "today" && txTime >= startOfToday) {
            dateMatch = true;
          }
          if (
            q === "yesterday" &&
            txTime >= startOfYesterday &&
            txTime < startOfToday
          ) {
            dateMatch = true;
          }
        }

        if (
          !titleMatch &&
          !descMatch &&
          !noteMatch &&
          !methodMatch &&
          !refMatch &&
          !amountMatch &&
          !dateMatch
        ) {
          return false;
        }
      }

      // 2. Custom Date Search Filter (if active)
      if (customDateFilter) {
        if (customDateFilter.type === "single") {
          if (txIsoDate !== customDateFilter.startDate) {
            return false;
          }
        } else {
          // range or preset with start & end
          if (txIsoDate < customDateFilter.startDate) {
            return false;
          }
          if (
            customDateFilter.endDate &&
            txIsoDate > customDateFilter.endDate
          ) {
            return false;
          }
        }
      }

      // 3. Type Filter
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

      // 4. Time Filter (only if no custom date filter is active)
      if (!customDateFilter && timeFilter !== "all") {
        if (timeFilter === "today" && txTime < startOfToday) return false;
        if (timeFilter === "week" && txTime < oneWeekAgo) return false;
        if (timeFilter === "month" && txTime < startOfMonth) return false;
      }

      return true;
    });
  }, [transactions, searchQuery, customDateFilter, timeFilter, typeFilter]);

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
      const dateScope = customDateFilter
        ? ` (${customDateFilter.label})`
        : timeFilter !== "all"
          ? ` (${timeFilter})`
          : "";
      const summaryText =
        `Splitzy Wallet Activity Ledger Summary${dateScope}\n` +
        `Total Activities: ${stats.count}\n` +
        `Total Inflow: +₱${stats.inflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
        `Total Outflow: -₱${stats.outflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
        `Net Balance: ₱${stats.net.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      await Share.share({ message: summaryText });
    } catch (_) {}
  };

  const handleShareTxReceipt = async (tx: WalletTransaction) => {
    try {
      const isPositive =
        tx.type === "cash_in" || tx.type === "qr_transfer_received";
      const formattedDate = tx.timestamp
        ? new Date(tx.timestamp).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "Recent";
      const receipt =
        `Splitzy Wallet Transaction Receipt\n` +
        `------------------------------------\n` +
        `Item: ${tx.title || tx.description || "Transaction"}\n` +
        `Amount: ${isPositive ? "+" : "-"}₱${Number(tx.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `Status: ${tx.status || "Completed"}\n` +
        `Date: ${formattedDate}\n` +
        `Payment Method: ${tx.paymentMethodUsed || "Splitzy Wallet"}\n` +
        `Ref ID: ${tx.referenceId || tx.id}\n` +
        (tx.note ? `Note: ${tx.note}\n` : "") +
        `------------------------------------\n` +
        `Verified via Splitzy App`;
      await Share.share({ message: receipt });
    } catch (_) {}
  };

  const handleCopyRef = async (ref: string) => {
    try {
      await Clipboard.setStringAsync(ref);
      setCopiedRefId(true);
      setTimeout(() => setCopiedRefId(false), 2000);
    } catch (_) {}
  };

  // Quick Preset Applicators
  const applyPreset = (
    presetKey: "today" | "yesterday" | "week" | "month" | "last_month",
  ) => {
    const now = new Date();
    if (presetKey === "today") {
      const iso = formatLocalDate(now);
      const label = `Today (${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
      setCustomDateFilter({ type: "single", label, startDate: iso });
    } else if (presetKey === "yesterday") {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const iso = formatLocalDate(y);
      const label = `Yesterday (${y.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
      setCustomDateFilter({ type: "single", label, startDate: iso });
    } else if (presetKey === "week") {
      const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const label = `Last 7 Days (${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
      setCustomDateFilter({
        type: "range",
        label,
        startDate: formatLocalDate(start),
        endDate: formatLocalDate(now),
      });
    } else if (presetKey === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const label = now.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      setCustomDateFilter({
        type: "range",
        label,
        startDate: formatLocalDate(start),
        endDate: formatLocalDate(now),
      });
    } else if (presetKey === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      const label = start.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      setCustomDateFilter({
        type: "range",
        label,
        startDate: formatLocalDate(start),
        endDate: formatLocalDate(end),
      });
    }
    setShowDatePickerModal(false);
  };

  const applySingleDate = () => {
    const d = new Date(`${pickedSingleDate}T00:00:00`);
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    setCustomDateFilter({
      type: "single",
      label,
      startDate: pickedSingleDate,
    });
    setShowDatePickerModal(false);
  };

  const applyDateRange = () => {
    let s = pickedRangeStart;
    let e = pickedRangeEnd;
    if (s > e) {
      const tmp = s;
      s = e;
      e = tmp;
    }
    const d1 = new Date(`${s}T00:00:00`);
    const d2 = new Date(`${e}T00:00:00`);
    const label = `${d1.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${d2.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    setCustomDateFilter({
      type: "range",
      label,
      startDate: s,
      endDate: e,
    });
    setShowDatePickerModal(false);
  };

  // Calendar days generator for the interactive calendar
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      day: number;
      isoDate: string;
      isCurrentMonth: boolean;
      hasTransactions: boolean;
    } | null> = [];

    // Empty slots before month start
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {
      const monthStr = String(month + 1).padStart(2, "0");
      const dayStr = String(day).padStart(2, "0");
      const iso = `${year}-${monthStr}-${dayStr}`;
      days.push({
        day,
        isoDate: iso,
        isCurrentMonth: true,
        hasTransactions: transactionDatesSet.has(iso),
      });
    }

    return days;
  }, [calendarMonth, transactionDatesSet]);

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
      {/* 1. Header */}
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            showNav();
            onBack();
          }}
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
            {customDateFilter ? ` · ${customDateFilter.label}` : ""}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {/* Dedicated Date Search Button */}
          <TouchableOpacity
            style={[
              styles.actionIconBtn,
              Boolean(customDateFilter) && {
                backgroundColor: isDark ? "#1E3A8A" : "#EFF6FF",
              },
            ]}
            onPress={() => setShowDatePickerModal(true)}
            activeOpacity={0.7}
            accessibilityLabel="Filter by date"
          >
            <Ionicons
              name={customDateFilter ? "calendar" : "calendar-outline"}
              size={18}
              color={
                customDateFilter ? "#2563EB" : isDark ? colors.text : "#0F172A"
              }
            />
            {customDateFilter && <View style={styles.headerActiveBadgeDot} />}
          </TouchableOpacity>

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

      {/* 2. Search Bar with Date-Aware Keyword Search */}
      {showSearchInput && (
        <View
          style={[
            styles.searchBarContainer,
            {
              backgroundColor: colors.background,
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
              placeholder="Search title, merchant, ref, or date (e.g. Oct 28)..."
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
                style={{ padding: 4 }}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={isDark ? colors.textMuted : "#94A3B8"}
                />
              </TouchableOpacity>
            )}

            {/* Quick calendar trigger inside search bar */}
            <TouchableOpacity
              onPress={() => setShowDatePickerModal(true)}
              style={styles.searchCalendarTrigger}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={customDateFilter ? "calendar" : "calendar-outline"}
                size={18}
                color={
                  customDateFilter
                    ? "#2563EB"
                    : isDark
                      ? colors.textMuted
                      : "#64748B"
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 3. Active Custom Date Filter Banner (when active) */}
      {customDateFilter && (
        <View
          style={[
            styles.activeDateBanner,
            {
              backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "#EFF6FF",
              borderColor: isDark ? "rgba(37, 99, 235, 0.35)" : "#BFDBFE",
            },
          ]}
        >
          <View style={styles.activeDateBannerLeft}>
            <Ionicons name="calendar" size={16} color="#2563EB" />
            <Text
              style={[
                styles.activeDateBannerText,
                { color: isDark ? "#93C5FD" : "#1D4ED8" },
              ]}
              numberOfLines={1}
            >
              Date:{" "}
              <Text style={{ fontWeight: "700" }}>
                {customDateFilter.label}
              </Text>{" "}
              ({filteredTransactions.length} found)
            </Text>
          </View>
          <TouchableOpacity
            style={styles.clearDateChipBtn}
            onPress={() => setCustomDateFilter(null)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.clearDateChipBtnText,
                { color: isDark ? "#93C5FD" : "#2563EB" },
              ]}
            >
              Clear
            </Text>
            <Ionicons
              name="close"
              size={14}
              color={isDark ? "#93C5FD" : "#2563EB"}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Filter Chips (Time, Date, & Type) */}
      <View
        style={[
          styles.filtersContainer,
          {
            backgroundColor: colors.background,
            borderBottomColor: isDark ? colors.border : "#E2E8F0",
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {/* Custom Date Search Chip */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              customDateFilter
                ? styles.filterChipActive
                : {
                    backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                    borderColor: isDark ? colors.border : "#E2E8F0",
                  },
            ]}
            onPress={() => setShowDatePickerModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar"
              size={13}
              color={
                customDateFilter
                  ? "#FFFFFF"
                  : isDark
                    ? colors.textMuted
                    : "#64748B"
              }
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                customDateFilter
                  ? styles.filterChipTextActive
                  : { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              {customDateFilter ? customDateFilter.label : "Date Search"}
            </Text>
            {customDateFilter && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setCustomDateFilter(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 4 }}
              >
                <Ionicons name="close" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Time filters (disabled styling if custom date is active) */}
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
                !customDateFilter && timeFilter === t.id
                  ? styles.filterChipActive
                  : {
                      backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                      borderColor: isDark ? colors.border : "#E2E8F0",
                    },
              ]}
              onPress={() => {
                setCustomDateFilter(null);
                setTimeFilter(t.id);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !customDateFilter && timeFilter === t.id
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

      {/* 5. Financial Summary Metrics Bar */}
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

      {/* 6. Main Transactions List */}
      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 40 },
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
                ? `No transactions matched "${searchQuery}". Try a different search term or clear filters.`
                : customDateFilter
                  ? `No transactions recorded on ${customDateFilter.label}.`
                  : "No activities match your selected filter criteria."}
            </Text>
            {(searchQuery ||
              customDateFilter ||
              timeFilter !== "all" ||
              typeFilter !== "all") && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => {
                  setSearchQuery("");
                  setCustomDateFilter(null);
                  setTimeFilter("all");
                  setTypeFilter("all");
                }}
              >
                <Text style={styles.resetBtnText}>Reset All Filters</Text>
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
                  setSelectedTx(tx);
                  if (onSelectTransaction) {
                    onSelectTransaction(tx);
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
                      {tx.note || tx.description || "No memo attached"}
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
                    {Boolean(tx.paymentMethodUsed) && (
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

      {/* 7. SELF-CONTAINED TRANSACTION DETAIL MODAL */}
      <Modal
        visible={Boolean(selectedTx)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTx(null)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSelectedTx(null)}
          />
          <View
            style={[
              styles.detailModalSheet,
              {
                backgroundColor: isDark ? colors.surface : "#FFFFFF",
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <View style={styles.modalDragHandle} />

            {selectedTx && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6 }}
              >
                {/* Header Icon & Title */}
                {(() => {
                  const sem = getExpenseSemanticIconMobile(selectedTx);
                  const isPositive =
                    selectedTx.type === "cash_in" ||
                    selectedTx.type === "qr_transfer_received";
                  return (
                    <View style={styles.detailHeaderWrap}>
                      <View
                        style={[
                          styles.detailBigIconWrap,
                          { backgroundColor: sem.bg },
                        ]}
                      >
                        <Ionicons name={sem.icon} size={36} color={sem.color} />
                      </View>
                      <Text
                        style={[
                          styles.detailHeaderTitle,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                      >
                        {selectedTx.title ||
                          selectedTx.description ||
                          "Transaction Record"}
                      </Text>
                      <Text
                        style={[
                          styles.detailAmountText,
                          {
                            color: isPositive
                              ? "#10B981"
                              : isDark
                                ? colors.text
                                : "#0F172A",
                          },
                        ]}
                      >
                        {isPositive ? "+" : "-"}₱
                        {Number(selectedTx.amount || 0).toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </Text>
                      <View
                        style={[
                          styles.detailStatusBadge,
                          {
                            backgroundColor:
                              selectedTx.status === "failed"
                                ? "#FEE2E2"
                                : isDark
                                  ? "#064E3B"
                                  : "#ECFDF5",
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            selectedTx.status === "failed"
                              ? "close-circle"
                              : "checkmark-circle"
                          }
                          size={14}
                          color={
                            selectedTx.status === "failed"
                              ? "#DC2626"
                              : "#059669"
                          }
                        />
                        <Text
                          style={[
                            styles.detailStatusBadgeText,
                            {
                              color:
                                selectedTx.status === "failed"
                                  ? "#DC2626"
                                  : "#059669",
                            },
                          ]}
                        >
                          {selectedTx.status || "Completed"}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Digital Receipt Card */}
                <View
                  style={[
                    styles.receiptDetailsCard,
                    {
                      backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                      borderColor: isDark ? colors.border : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={styles.receiptFieldRow}>
                    <Text
                      style={[
                        styles.receiptFieldLabel,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Date & Time
                    </Text>
                    <Text
                      style={[
                        styles.receiptFieldValue,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      {selectedTx.timestamp
                        ? new Date(selectedTx.timestamp).toLocaleString(
                            "en-US",
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : "Recent"}
                    </Text>
                  </View>

                  <View style={styles.receiptFieldRow}>
                    <Text
                      style={[
                        styles.receiptFieldLabel,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Payment Method
                    </Text>
                    <Text
                      style={[
                        styles.receiptFieldValue,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      {selectedTx.paymentMethodUsed || "Splitzy Wallet"}
                    </Text>
                  </View>

                  {/* Reference ID with 1-Tap Copy */}
                  <View style={styles.receiptFieldRow}>
                    <Text
                      style={[
                        styles.receiptFieldLabel,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Reference ID
                    </Text>
                    <TouchableOpacity
                      style={styles.receiptCopyRefBtn}
                      onPress={() =>
                        handleCopyRef(selectedTx.referenceId || selectedTx.id)
                      }
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.receiptRefText, { color: "#2563EB" }]}
                        numberOfLines={1}
                      >
                        {selectedTx.referenceId || selectedTx.id}
                      </Text>
                      <Ionicons
                        name={copiedRefId ? "checkmark-circle" : "copy-outline"}
                        size={14}
                        color={copiedRefId ? "#10B981" : "#2563EB"}
                      />
                      {copiedRefId && (
                        <Text style={styles.copiedBadgeText}>Copied!</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Note / Memo */}
                  {Boolean(selectedTx.note || selectedTx.description) && (
                    <View style={styles.receiptFieldRowStacked}>
                      <Text
                        style={[
                          styles.receiptFieldLabel,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        Memo / Note
                      </Text>
                      <Text
                        style={[
                          styles.receiptFieldMemo,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                      >
                        {selectedTx.note || selectedTx.description}
                      </Text>
                    </View>
                  )}

                  <View style={styles.receiptFieldRow}>
                    <Text
                      style={[
                        styles.receiptFieldLabel,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Ledger Status
                    </Text>
                    <View style={styles.receiptStatusRow}>
                      <View style={styles.statusDotGreen} />
                      <Text
                        style={[styles.receiptStatusText, { color: "#10B981" }]}
                      >
                        Verified on Device
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Modal Buttons */}
                <View style={styles.detailActionBtnRow}>
                  <TouchableOpacity
                    style={styles.detailShareBtn}
                    onPress={() => handleShareTxReceipt(selectedTx)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.detailShareBtnText}>Share Receipt</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.detailCloseBtn,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F1F5F9",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                    onPress={() => setSelectedTx(null)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.detailCloseBtnText,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 8. DEDICATED DATE SEARCH & FILTER MODAL */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePickerModal(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowDatePickerModal(false)}
          />
          <View
            style={[
              styles.datePickerSheet,
              {
                backgroundColor: isDark ? colors.surface : "#FFFFFF",
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <View style={styles.modalDragHandle} />

            {/* Modal Header */}
            <View style={styles.datePickerHeader}>
              <View>
                <Text
                  style={[
                    styles.datePickerTitle,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                >
                  Date Search & Filter
                </Text>
                <Text
                  style={[
                    styles.datePickerSubtitle,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Filter ledger entries by specific date or range
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDatePickerModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? colors.textMuted : "#64748B"}
                />
              </TouchableOpacity>
            </View>

            {/* Mode Selector Tabs */}
            <View
              style={[
                styles.dateModeTabsRow,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                },
              ]}
            >
              {(
                [
                  { id: "presets", label: "Quick Presets" },
                  { id: "single", label: "Single Date" },
                  { id: "range", label: "Date Range" },
                ] as const
              ).map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.dateModeTabBtn,
                    calendarMode === tab.id && styles.dateModeTabBtnActive,
                  ]}
                  onPress={() => setCalendarMode(tab.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dateModeTabBtnText,
                      calendarMode === tab.id
                        ? styles.dateModeTabBtnTextActive
                        : { color: isDark ? colors.textMuted : "#64748B" },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}
            >
              {/* TAB A: Quick Presets */}
              {calendarMode === "presets" && (
                <View style={styles.presetButtonsWrap}>
                  <TouchableOpacity
                    style={[
                      styles.presetRowBtn,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#E2E8F0",
                      },
                    ]}
                    onPress={() => applyPreset("today")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetRowLeft}>
                      <Ionicons
                        name="today-outline"
                        size={20}
                        color="#2563EB"
                      />
                      <Text
                        style={[
                          styles.presetRowTitle,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                      >
                        Today
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.presetRowSub,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      {new Date().toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetRowBtn,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#E2E8F0",
                      },
                    ]}
                    onPress={() => applyPreset("yesterday")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetRowLeft}>
                      <Ionicons name="time-outline" size={20} color="#F59E0B" />
                      <Text
                        style={[
                          styles.presetRowTitle,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                      >
                        Yesterday
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.presetRowSub,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      {new Date(
                        Date.now() - 24 * 60 * 60 * 1000,
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetRowBtn,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#E2E8F0",
                      },
                    ]}
                    onPress={() => applyPreset("week")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetRowLeft}>
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#10B981"
                      />
                      <Text
                        style={[
                          styles.presetRowTitle,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                      >
                        Last 7 Days
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.presetRowSub,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Past 1 week
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetRowBtn,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#E2E8F0",
                      },
                    ]}
                    onPress={() => applyPreset("month")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetRowLeft}>
                      <Ionicons
                        name="calendar-clear-outline"
                        size={20}
                        color="#6366F1"
                      />
                      <Text
                        style={[
                          styles.presetRowTitle,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                      >
                        This Month
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.presetRowSub,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      {new Date().toLocaleDateString("en-US", {
                        month: "long",
                      })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetRowBtn,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#E2E8F0",
                      },
                    ]}
                    onPress={() => applyPreset("last_month")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetRowLeft}>
                      <Ionicons
                        name="archive-outline"
                        size={20}
                        color="#8B5CF6"
                      />
                      <Text
                        style={[
                          styles.presetRowTitle,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                      >
                        Last Month
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.presetRowSub,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Previous full month
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* TAB B & C: Interactive Calendar for Single Date or Date Range */}
              {(calendarMode === "single" || calendarMode === "range") && (
                <View style={styles.calendarContainer}>
                  {/* Month Switcher Header */}
                  <View style={styles.calendarHeaderRow}>
                    <TouchableOpacity
                      style={styles.calendarMonthNavBtn}
                      onPress={() => {
                        const prev = new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() - 1,
                          1,
                        );
                        setCalendarMonth(prev);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather
                        name="chevron-left"
                        size={20}
                        color={isDark ? colors.text : "#0F172A"}
                      />
                    </TouchableOpacity>

                    <Text
                      style={[
                        styles.calendarMonthTitle,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      {calendarMonth.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </Text>

                    <TouchableOpacity
                      style={styles.calendarMonthNavBtn}
                      onPress={() => {
                        const next = new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() + 1,
                          1,
                        );
                        setCalendarMonth(next);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather
                        name="chevron-right"
                        size={20}
                        color={isDark ? colors.text : "#0F172A"}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Day of Week Headers */}
                  <View style={styles.weekDaysRow}>
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
                      (d, idx) => (
                        <Text
                          key={idx}
                          style={[
                            styles.weekDayHeader,
                            { color: isDark ? colors.textMuted : "#94A3B8" },
                          ]}
                        >
                          {d}
                        </Text>
                      ),
                    )}
                  </View>

                  {/* Calendar Grid of Days */}
                  <View style={styles.daysGrid}>
                    {calendarDays.map((item, idx) => {
                      if (!item) {
                        return (
                          <View
                            key={`empty-${idx}`}
                            style={styles.emptyDayCell}
                          />
                        );
                      }

                      const isSelectedSingle =
                        calendarMode === "single" &&
                        pickedSingleDate === item.isoDate;

                      const isRangeStart =
                        calendarMode === "range" &&
                        pickedRangeStart === item.isoDate;
                      const isRangeEnd =
                        calendarMode === "range" &&
                        pickedRangeEnd === item.isoDate;
                      const isInRange =
                        calendarMode === "range" &&
                        item.isoDate >= pickedRangeStart &&
                        item.isoDate <= pickedRangeEnd;

                      return (
                        <TouchableOpacity
                          key={item.isoDate}
                          style={[
                            styles.dayCell,
                            isSelectedSingle && styles.dayCellSelected,
                            (isRangeStart || isRangeEnd) &&
                              styles.dayCellSelected,
                            isInRange &&
                              !isRangeStart &&
                              !isRangeEnd &&
                              styles.dayCellInRange,
                          ]}
                          onPress={() => {
                            if (calendarMode === "single") {
                              setPickedSingleDate(item.isoDate);
                            } else {
                              // range mode
                              if (pickedRangeStart && !pickedRangeEnd) {
                                if (item.isoDate >= pickedRangeStart) {
                                  setPickedRangeEnd(item.isoDate);
                                } else {
                                  setPickedRangeEnd(pickedRangeStart);
                                  setPickedRangeStart(item.isoDate);
                                }
                              } else {
                                setPickedRangeStart(item.isoDate);
                                setPickedRangeEnd(item.isoDate);
                              }
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dayCellText,
                              {
                                color:
                                  isSelectedSingle || isRangeStart || isRangeEnd
                                    ? "#FFFFFF"
                                    : isInRange
                                      ? "#2563EB"
                                      : isDark
                                        ? colors.text
                                        : "#0F172A",
                              },
                            ]}
                          >
                            {item.day}
                          </Text>
                          {item.hasTransactions && (
                            <View
                              style={[
                                styles.dayTransactionDot,
                                {
                                  backgroundColor:
                                    isSelectedSingle ||
                                    isRangeStart ||
                                    isRangeEnd
                                      ? "#FFFFFF"
                                      : "#2563EB",
                                },
                              ]}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Range Mode Selection Helper Hint */}
                  {calendarMode === "range" && (
                    <View
                      style={[
                        styles.rangeHelperBox,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#EFF6FF",
                          borderColor: isDark ? colors.border : "#BFDBFE",
                        },
                      ]}
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color="#2563EB"
                      />
                      <Text
                        style={[
                          styles.rangeHelperText,
                          { color: isDark ? colors.text : "#1E40AF" },
                        ]}
                      >
                        From {pickedRangeStart} to {pickedRangeEnd}
                      </Text>
                    </View>
                  )}

                  {/* Apply Buttons for Calendar View */}
                  <View style={styles.calendarApplyRow}>
                    <TouchableOpacity
                      style={styles.applyDateFilterBtn}
                      onPress={
                        calendarMode === "single"
                          ? applySingleDate
                          : applyDateRange
                      }
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.applyDateFilterBtnText}>
                        Apply {calendarMode === "single" ? "Date" : "Range"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Reset / Clear Button */}
              {customDateFilter && (
                <TouchableOpacity
                  style={[
                    styles.clearAllDateBtn,
                    {
                      borderColor: isDark ? colors.border : "#CBD5E1",
                      backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    },
                  ]}
                  onPress={() => {
                    setCustomDateFilter(null);
                    setShowDatePickerModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={styles.clearAllDateBtnText}>
                    Clear Active Date Filter
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    position: "relative",
  },
  headerActiveBadgeDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#2563EB",
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: "100%",
  },
  searchCalendarTrigger: {
    padding: 6,
    marginLeft: 4,
  },
  activeDateBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activeDateBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  activeDateBannerText: {
    fontSize: 12,
    fontWeight: "500",
  },
  clearDateChipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
  },
  clearDateChipBtnText: {
    fontSize: 11,
    fontWeight: "700",
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
    borderRadius: 100,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  filterChipActiveGreen: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
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
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2E8F0",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
    marginTop: 24,
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

  // Modals common styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalDragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 14,
  },

  // Detail Modal Specific Styles
  detailModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
  },
  detailHeaderWrap: {
    alignItems: "center",
    marginVertical: 12,
  },
  detailBigIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  detailHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  detailAmountText: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  detailStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  detailStatusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  receiptDetailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 14,
    gap: 12,
  },
  receiptFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  receiptFieldRowStacked: {
    gap: 4,
  },
  receiptFieldLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  receiptFieldValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  receiptFieldMemo: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  receiptCopyRefBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  receiptRefText: {
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 160,
  },
  copiedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
  },
  receiptStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDotGreen: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  receiptStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  detailActionBtnRow: {
    gap: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  detailShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 14,
  },
  detailShareBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  detailCloseBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  detailCloseBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Date Picker Modal Specific Styles
  datePickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  datePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  datePickerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  dateModeTabsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 100,
    padding: 3,
  },
  dateModeTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
  },
  dateModeTabBtnActive: {
    backgroundColor: "#2563EB",
  },
  dateModeTabBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  dateModeTabBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  presetButtonsWrap: {
    gap: 10,
    paddingVertical: 8,
  },
  presetRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 100,
    borderWidth: 1,
  },
  presetRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  presetRowTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  presetRowSub: {
    fontSize: 12,
  },
  calendarContainer: {
    paddingVertical: 6,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  calendarMonthNavBtn: {
    padding: 8,
  },
  calendarMonthTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  weekDaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  weekDayHeader: {
    width: "14.28%",
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  emptyDayCell: {
    width: "14.28%",
    height: 40,
  },
  dayCell: {
    width: "14.28%",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    position: "relative",
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: "#2563EB",
  },
  dayCellInRange: {
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    borderRadius: 8,
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dayTransactionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: "absolute",
    bottom: 4,
  },
  rangeHelperBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  rangeHelperText: {
    fontSize: 12,
    fontWeight: "600",
  },
  calendarApplyRow: {
    marginTop: 16,
    marginBottom: 8,
  },
  applyDateFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 100,
  },
  applyDateFilterBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  clearAllDateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 16,
  },
  clearAllDateBtnText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
  },
});
