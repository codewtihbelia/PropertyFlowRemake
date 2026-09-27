import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  MobileExpense,
  cleanBillTitle,
} from "../services/firebaseDataService";
import { getCategoryMeta } from "../services/categoryService";
import { UniversalSkeleton } from "../components/UniversalLoader";

export interface ExpenseItem {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  icon: string;
  emoji: string;
  categoryColor: string;
  categoryBgColor: string;
  amountCents: number;
  date: string;
  payer: string;
  splitMethod: string;
  cycle: string;
  status?: "UNPAID" | "PAID";
  isPaid?: boolean;
  receiptUrl?: string;
  notes?: string;
  splitDetails?: any[];
}

interface ExpenseHistoryScreenProps {
  onBack: () => void;
  onSelectExpense: (expense: ExpenseItem) => void;
  onAddExpensePress?: () => void;
}

export const ExpenseHistoryScreen: React.FC<ExpenseHistoryScreenProps> = ({
  onBack,
  onSelectExpense,
  onAddExpensePress,
}) => {
  const [activeTab, setActiveTab] = useState<"chronological" | "by_category">(
    "chronological",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [liveExpenses, setLiveExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    Platform.OS === "ios" ? 44 : 20,
  );

  const currentUser = auth.currentUser;

  const loadData = async (isManualRefresh = false) => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const profile = await mobileDataService.getUserProfile(currentUser.uid);
      const hid = profile?.householdId;
      if (hid) {
        setHouseholdId(hid);
      }
    } catch (err) {
      console.warn("[ExpenseHistoryScreen] load profile error:", err);
    } finally {
      if (isManualRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = mobileDataService.listenToExpenses(
      householdId,
      (data: MobileExpense[]) => {
        if (!data) {
          setLiveExpenses([]);
          setLoading(false);
          return;
        }

        const mapped: ExpenseItem[] = data.map((exp) => {
          const meta = getCategoryMeta(exp.category);
          const isPaid = exp.status === "PAID" || exp.isPaid === true;

          return {
            id: exp.id,
            title: cleanBillTitle(exp.title, exp.category),
            category: meta.id.toLowerCase(),
            categoryLabel: exp.category || meta.name,
            icon: meta.featherIcon,
            emoji: meta.emoji,
            categoryColor: meta.color,
            categoryBgColor: meta.bgColor,
            amountCents: exp.amountCents,
            date: exp.date,
            payer: exp.payerName || "Host",
            splitMethod: exp.splitMethod || "Equal Split",
            cycle: exp.billingCycleId || "Current Cycle",
            status: isPaid ? "PAID" : "UNPAID",
            isPaid,
            receiptUrl: exp.receiptUrl,
            notes: exp.notes,
            splitDetails: exp.splitDetails,
          };
        });

        // Sort by newest date first
        mapped.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        setLiveExpenses(mapped);
        setLoading(false);
      },
    );

    return () => {
      unsub();
    };
  }, [householdId]);

  const handleRefresh = () => {
    loadData(true);
  };

  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return liveExpenses;
    const q = searchQuery.toLowerCase().trim();
    return liveExpenses.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.payer.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q),
    );
  }, [liveExpenses, searchQuery]);

  const formatExpenseDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${d.getDate()} ${monthNames[d.getMonth()]}`;
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (cents: number) => {
    const val = (Math.abs(cents) / 100).toFixed(2);
    return `-₱${val}`;
  };

  const renderCategoryIcon = (iconName: string, item?: ExpenseItem) => {
    const meta = getCategoryMeta(item?.categoryLabel || iconName);
    return (
      <Feather
        name={meta.featherIcon as any}
        size={18}
        color={meta.color || "#475569"}
      />
    );
  };

  // Group by categories for the By Category view
  const categorizedExpenses = useMemo(() => {
    const groups: Record<string, ExpenseItem[]> = {};
    filteredExpenses.forEach((exp) => {
      const cat = exp.categoryLabel || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(exp);
    });
    return groups;
  }, [filteredExpenses]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        translucent={true}
        backgroundColor="transparent"
      />

      {/* Top Header */}
      <View style={[styles.navBarContainer, { paddingTop: topInset }]}>
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.circleBackBtn}
            onPress={() => (onBack ? onBack() : null)}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={24} color="#0F172A" />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Bill History</Text>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconNavBtn}
              onPress={() => setShowSearch(!showSearch)}
              activeOpacity={0.7}
            >
              <Feather name="search" size={20} color="#0F172A" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconNavBtn}
              onPress={handleRefresh}
              activeOpacity={0.7}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Feather name="rotate-cw" size={20} color="#0F172A" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Expandable Search Input */}
      {showSearch && (
        <View style={styles.searchBarContainer}>
          <Feather
            name="search"
            size={16}
            color="#64748B"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title, payer or category..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Segmented Tab Switcher matching screen.png */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "chronological" && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab("chronological")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "chronological" && styles.tabBtnTextActive,
            ]}
          >
            Chronological
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "by_category" && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab("by_category")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "by_category" && styles.tabBtnTextActive,
            ]}
          >
            By Category
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      {loading ? (
        <UniversalSkeleton type="history" />
      ) : liveExpenses.length === 0 ? (
        /* Clean Empty State as requested (no hardcoded data) */
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="receipt-outline" size={32} color="#0F172A" />
            </View>
            <Text style={styles.emptyTitle}>No Bills Yet</Text>
            <Text style={styles.emptySubtitle}>
              No household bills have been recorded for this household yet. Once
              your host records a bill or payments are settled, they will appear
              here.
            </Text>

            {onAddExpensePress && (
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={onAddExpensePress}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyActionBtnText}>+ Record A Bill</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : filteredExpenses.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptySearchTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            No expenses matched "{searchQuery}". Try a different keyword.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "chronological" ? (
            <View>
              {/* Recent Expenses Section matching screen.png */}
              <Text style={styles.sectionHeader}>Recent Expenses</Text>

              {filteredExpenses.slice(0, 3).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemRow}
                  onPress={() =>
                    onSelectExpense({ ...item, icon: item.emoji || item.icon })
                  }
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: item.categoryBgColor || "#F1F5F9" },
                    ]}
                  >
                    {renderCategoryIcon(item.icon, item)}
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemSubtitle}>
                      {formatExpenseDate(item.date)} • Paid by {item.payer}
                    </Text>
                  </View>

                  <Text style={styles.itemAmount}>
                    {formatAmount(item.amountCents)}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* By Categories Section matching screen.png */}
              <Text style={[styles.sectionHeader, { marginTop: 24 }]}>
                By Categories
              </Text>

              {filteredExpenses.map((item) => (
                <TouchableOpacity
                  key={`bycat_${item.id}`}
                  style={styles.itemRow}
                  onPress={() =>
                    onSelectExpense({ ...item, icon: item.emoji || item.icon })
                  }
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: item.categoryBgColor || "#F1F5F9" },
                    ]}
                  >
                    {renderCategoryIcon(item.icon, item)}
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemSubtitle}>
                      {formatExpenseDate(item.date)} • Paid by {item.payer}
                    </Text>
                  </View>

                  <Text style={styles.itemAmount}>
                    {formatAmount(item.amountCents)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            /* By Category Tab View */
            <View>
              {Object.keys(categorizedExpenses).map((categoryName) => {
                const groupItems = categorizedExpenses[categoryName];
                const groupTotalCents = groupItems.reduce(
                  (sum, e) => sum + e.amountCents,
                  0,
                );

                return (
                  <View key={categoryName} style={styles.categoryBlock}>
                    <View style={styles.categoryHeaderRow}>
                      <Text style={styles.sectionHeader}>{categoryName}</Text>
                      <Text style={styles.categoryTotalAmount}>
                        {formatAmount(groupTotalCents)}
                      </Text>
                    </View>

                    {groupItems.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.itemRow}
                        onPress={() =>
                          onSelectExpense({
                            ...item,
                            icon: item.emoji || item.icon,
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.iconCircle,
                            {
                              backgroundColor:
                                item.categoryBgColor || "#F1F5F9",
                            },
                          ]}
                        >
                          {renderCategoryIcon(item.icon, item)}
                        </View>

                        <View style={styles.itemInfo}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          <Text style={styles.itemSubtitle}>
                            {formatExpenseDate(item.date)} • Paid by{" "}
                            {item.payer}
                          </Text>
                        </View>

                        <Text style={styles.itemAmount}>
                          {formatAmount(item.amountCents)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  navBarContainer: {
    backgroundColor: "#F8FAFC",
    zIndex: 50,
  },
  navBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  circleBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 0,
  },
  // Tab Switcher matching screen.png
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: "#2563EB",
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  // Sections and Lists matching screen.png
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
    marginTop: 4,
  },
  categoryBlock: {
    marginBottom: 20,
  },
  categoryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  categoryTotalAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563EB",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "400",
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  // Center / Loading / Empty States
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 10,
    fontWeight: "500",
  },
  emptyScrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyCard: {
    alignItems: "center",
    maxWidth: 320,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
  emptyActionBtn: {
    marginTop: 18,
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
});
