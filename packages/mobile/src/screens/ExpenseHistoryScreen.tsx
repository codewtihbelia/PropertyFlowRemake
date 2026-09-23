import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatPesos } from "@propertyflow/shared";

interface ExpenseItem {
  id: string;
  title: string;
  category:
    | "rent"
    | "electricity"
    | "water"
    | "internet"
    | "groceries"
    | "other";
  categoryLabel: string;
  icon: string;
  amountCents: number;
  date: string;
  payer: string;
  splitMethod: string;
  cycle: string;
  receiptUrl?: string;
  notes?: string;
}

const SAMPLE_EXPENSES: ExpenseItem[] = [
  {
    id: "exp_1",
    title: "Unit 402 Rent (August)",
    category: "rent",
    categoryLabel: "Rent",
    icon: "🏠",
    amountCents: 1400000,
    date: "Aug 13, 2026",
    payer: "Alice Santos (Host)",
    splitMethod: "4 Payors Equal (₱3,500.00 each)",
    cycle: "Aug 13 – Sep 12",
    notes: "Official landlord rent payment.",
  },
  {
    id: "exp_2",
    title: "Meralco Electricity (Sub-meter 140 kWh)",
    category: "electricity",
    categoryLabel: "Electricity",
    icon: "⚡",
    amountCents: 224000,
    date: "Aug 18, 2026",
    payer: "Alice Santos",
    splitMethod: "4 Payors Equal (₱560.00 each)",
    cycle: "Aug 13 – Sep 12",
    notes:
      "Sub-meter reading: Previous 1210.4, Current 1350.4 (140.0 kWh @ ₱16.00/kWh).",
  },
  {
    id: "exp_3",
    title: "Fiber Internet 300 Mbps",
    category: "internet",
    categoryLabel: "Internet",
    icon: "📶",
    amountCents: 150000,
    date: "Aug 20, 2026",
    payer: "Bea Alonzo",
    splitMethod: "4 Payors Equal (₱375.00 each)",
    cycle: "Aug 13 – Sep 12",
    notes: "PLDT Home Fiber Monthly Subscription.",
  },
  {
    id: "exp_4",
    title: "Daily Water Attendance (31 Days)",
    category: "water",
    categoryLabel: "Water",
    icon: "💧",
    amountCents: 98500,
    date: "Aug 25, 2026",
    payer: "Alice Santos",
    splitMethod: "Per-Day Present (₱5.00/day/person)",
    cycle: "Aug 13 – Sep 12",
    notes: "Calculated from roommate daily attendance matrix.",
  },
  {
    id: "exp_5",
    title: "Household Cleaning & Supplies",
    category: "groceries",
    categoryLabel: "Groceries",
    icon: "🛒",
    amountCents: 125000,
    date: "Aug 28, 2026",
    payer: "Charlie Cruz",
    splitMethod: "Equal Split",
    cycle: "Aug 13 – Sep 12",
    notes: "Detergent, trash bags, dish soap, mop refills.",
  },
];

interface ExpenseHistoryScreenProps {
  onBack: () => void;
  onSelectExpense: (expense: ExpenseItem) => void;
}

export const ExpenseHistoryScreen: React.FC<ExpenseHistoryScreenProps> = ({
  onBack,
  onSelectExpense,
}) => {
  const [activeTab, setActiveTab] = useState<"chronological" | "by_category">(
    "chronological",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>("all");

  const filteredExpenses = SAMPLE_EXPENSES.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.payer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === "all" ||
      item.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: "all", label: "All" },
    { id: "rent", label: "🏠 Rent" },
    { id: "electricity", label: "⚡ Power" },
    { id: "internet", label: "📶 Internet" },
    { id: "water", label: "💧 Water" },
    { id: "groceries", label: "🛒 Supplies" },
  ];

  // Group expenses by category for 'by_category' tab
  const categoriesList = [
    "rent",
    "electricity",
    "internet",
    "water",
    "groceries",
    "other",
  ] as const;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense History</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs: Chronological vs By Category matching proposedUI */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "chronological" && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab("chronological")}
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

      {/* Search Input */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍  Search by title or payer..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryChips}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.chip,
              selectedCategoryFilter === cat.id && styles.chipActive,
            ]}
            onPress={() => setSelectedCategoryFilter(cat.id)}
          >
            <Text
              style={[
                styles.chipText,
                selectedCategoryFilter === cat.id && styles.chipTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "chronological" ? (
          <View>
            <Text style={styles.monthHeader}>August 2026</Text>
            {filteredExpenses.map((exp) => (
              <TouchableOpacity
                key={exp.id}
                style={styles.card}
                onPress={() => onSelectExpense(exp)}
              >
                <View style={styles.cardIconWrap}>
                  <Text style={{ fontSize: 22 }}>{exp.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{exp.title}</Text>
                  <Text style={styles.cardSubtitle}>
                    {exp.date} · Paid by {exp.payer}
                  </Text>
                  <Text style={styles.cardSplit}>{exp.splitMethod}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.cardAmount}>
                    {formatPesos(exp.amountCents)}
                  </Text>
                  <Text style={styles.cardChevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View>
            {categoriesList.map((catKey) => {
              const catItems = filteredExpenses.filter(
                (e) => e.category === catKey,
              );
              if (catItems.length === 0) return null;
              const totalCategoryCents = catItems.reduce(
                (acc, cur) => acc + cur.amountCents,
                0,
              );

              return (
                <View key={catKey} style={styles.categoryGroup}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryGroupTitle}>
                      {catItems[0]?.icon} {catItems[0]?.categoryLabel}
                    </Text>
                    <Text style={styles.categoryGroupTotal}>
                      {formatPesos(totalCategoryCents)}
                    </Text>
                  </View>
                  {catItems.map((exp) => (
                    <TouchableOpacity
                      key={exp.id}
                      style={styles.card}
                      onPress={() => onSelectExpense(exp)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{exp.title}</Text>
                        <Text style={styles.cardSubtitle}>
                          {exp.date} · {exp.payer}
                        </Text>
                      </View>
                      <Text style={styles.cardAmount}>
                        {formatPesos(exp.amountCents)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  tabBtnTextActive: { color: "#2563EB" },
  searchWrap: { marginHorizontal: 20, marginTop: 12 },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  categoryChips: { paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  chipTextActive: { color: "#FFFFFF", fontWeight: "bold" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  monthHeader: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  cardSubtitle: { fontSize: 12, color: "#64748B", marginTop: 2 },
  cardSplit: {
    fontSize: 11,
    color: "#2563EB",
    marginTop: 2,
    fontWeight: "600",
  },
  cardAmount: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  cardChevron: { fontSize: 18, color: "#94A3B8", marginTop: 4 },
  categoryGroup: { marginBottom: 16 },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 6,
  },
  categoryGroupTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  categoryGroupTotal: { fontSize: 14, fontWeight: "800", color: "#2563EB" },
});
