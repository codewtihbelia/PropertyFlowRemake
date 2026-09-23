import React, { useEffect, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  mobileDataService,
  MobileExpense,
} from "../services/firebaseDataService";
import { auth } from "../firebase/config";
import { formatPesos } from "@propertyflow/shared";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { UniversalLoader } from "../components/UniversalLoader";
import { Ionicons, Feather } from "@expo/vector-icons";

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
  onOpenAddExpense?: () => void;
  onOpenSettleDues?: () => void;
  onOpenExpenseHistory?: () => void;
  onOpenManageGroup?: (mode?: "details" | "create" | "join") => void;
  onOpenReports?: () => void;
  currentUser?: { name: string; avatar: string };
}

// Roommate avatar photos for the group stacks matching the design
const ROOMMATE_AVATARS_GROUP1 = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80",
];

const ROOMMATE_AVATARS_GROUP2 = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80",
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenAddExpense,
  onOpenSettleDues,
  onOpenExpenseHistory,
  onOpenManageGroup,
  onOpenReports,
  currentUser = { name: "Arafat", avatar: "A" },
}) => {
  const cachedInitialProfile = mobileDataService.getCachedProfile();
  const cachedInitialHousehold = mobileDataService.getCachedHousehold();
  const [profile, setProfile] = useState<any | null>(
    () => cachedInitialProfile,
  );
  const [household, setHousehold] = useState<any | null>(
    () => cachedInitialHousehold,
  );
  const [initialLoading, setInitialLoading] = useState<boolean>(
    () => !cachedInitialProfile,
  );
  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [memberBills, setMemberBills] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>("");
  const [joinLoading, setJoinLoading] = useState<boolean>(false);

  const firebaseUser = auth.currentUser;
  const householdId = profile?.householdId || household?.householdId || "";
  const activeCycle =
    cycles.find((c) => c.status === "ACTIVE" || c.status === "FINALIZED") ||
    cycles[0];
  const myBill = memberBills.find((bill) => bill.userId === firebaseUser?.uid);
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amountCents,
    0,
  );
  const { onScroll } = useNavVisibility();
  const insets = useSafeAreaInsets();
  const isHost =
    profile?.role === "HOST" || profile?.hostApplicationStatus === "APPROVED";
  const hasGroup = Boolean(household?.householdId);

  // Fallback timer for loading screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!firebaseUser?.uid) return;
    mobileDataService.getUserProfile(firebaseUser.uid).then((nextProfile) => {
      if (mounted) {
        setProfile(nextProfile);
        setInitialLoading(false);
      }
    });
    const unsubProfile = mobileDataService.listenToUserProfile(
      firebaseUser.uid,
      (nextProfile) => {
        if (mounted) {
          setProfile(nextProfile);
          setInitialLoading(false);
          if (!nextProfile?.householdId) {
            setHousehold(null);
          }
        }
      },
    );
    return () => {
      mounted = false;
      unsubProfile();
    };
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!householdId) {
      setHousehold(null);
      setExpenses([]);
      setCycles([]);
      return;
    }
    const unsubHousehold = mobileDataService.listenToHousehold(
      householdId,
      setHousehold,
    );
    const unsubExpenses = mobileDataService.listenToExpenses(
      householdId,
      setExpenses,
    );
    const unsubCycles = mobileDataService.listenToBillingCycles(
      householdId,
      setCycles,
    );
    return () => {
      unsubHousehold();
      unsubExpenses();
      unsubCycles();
    };
  }, [householdId]);

  useEffect(() => {
    if (!householdId || !activeCycle?.billingCycleId) {
      setMemberBills([]);
      return;
    }
    return mobileDataService.listenToMemberBills(
      householdId,
      activeCycle.billingCycleId,
      setMemberBills,
    );
  }, [activeCycle?.billingCycleId, householdId]);

  const handleJoinByCode = async () => {
    const clean = joinCodeInput.trim();
    if (!clean) {
      Alert.alert(
        "Input Required",
        "Please enter a household invite code (e.g. PF-402).",
      );
      return;
    }
    if (!firebaseUser?.uid) {
      Alert.alert(
        "Sign In Required",
        "Please sign in before joining a household.",
      );
      return;
    }

    setJoinLoading(true);
    let code = clean;
    if (code.includes("/")) {
      code = code.split("/").pop() || code;
    }

    const result = await mobileDataService.joinHouseholdByCode(code, {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || currentUser.name,
      email: firebaseUser.email || "",
    });

    setJoinLoading(false);
    if (result.success) {
      setShowJoinModal(false);
      setJoinCodeInput("");
      Alert.alert(
        "Welcome! 🎉",
        `You have joined "${result.household?.householdName || "the household"}"!`,
      );
    } else {
      Alert.alert(
        "Could Not Join",
        result.error || "No household found matching that code.",
      );
    }
  };

  // User display name (use Arafat if default / Resident to match mockup, or current user)
  const greetingName =
    currentUser.name &&
    currentUser.name !== "Resident" &&
    currentUser.name !== "Member"
      ? currentUser.name.split(" ")[0]
      : "Arafat";

  // Formatted display amounts
  const group1TotalDisplay =
    totalExpenses > 0
      ? `$${Math.round(totalExpenses / 100).toLocaleString()}`
      : "$1,240";
  const group1Title = household?.householdName || "Apartment Roommate";

  // Demo + Real Expenses combined for authentic Splitzy experience
  const defaultExpenses = [
    {
      id: "demo-exp-1",
      title: "Groceries",
      category: "groceries",
      date: "2 Jan",
      payerName: "Emily",
      amountFormatted: "-$90.00",
      iconType: "cart",
    },
    {
      id: "demo-exp-2",
      title: "Wifi Bills",
      category: "internet",
      date: "30 Dec",
      payerName: "Farhan",
      amountFormatted: "-$38.00",
      iconType: "wifi",
    },
    {
      id: "demo-exp-3",
      title: "Groceries",
      category: "groceries",
      date: "24 Dec",
      payerName: "Emily",
      amountFormatted: "-$90.00",
      iconType: "cart",
    },
  ];

  // Map real Firestore expenses to UI items
  const realExpensesMapped = useMemo(() => {
    return expenses.map((exp) => {
      const lowerCat = (exp.category || "").toLowerCase();
      let iconType: "cart" | "wifi" | "flash" | "water" | "other" = "cart";
      if (lowerCat.includes("wifi") || lowerCat.includes("internet"))
        iconType = "wifi";
      else if (lowerCat.includes("electric") || lowerCat.includes("power"))
        iconType = "flash";
      else if (lowerCat.includes("water")) iconType = "water";
      else if (lowerCat.includes("grocer") || lowerCat.includes("food"))
        iconType = "cart";

      const formatted = `-$${(exp.amountCents / 100).toFixed(2)}`;
      return {
        id: exp.id,
        title: exp.title,
        category: exp.category,
        date: exp.date || "Recent",
        payerName: exp.payerName || "Roommate",
        amountFormatted: formatted,
        iconType,
      };
    });
  }, [expenses]);

  const allDisplayExpenses =
    realExpensesMapped.length > 0 ? realExpensesMapped : defaultExpenses;

  // Filter expenses by search query
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return allDisplayExpenses;
    const q = searchQuery.toLowerCase();
    return allDisplayExpenses.filter(
      (exp) =>
        exp.title.toLowerCase().includes(q) ||
        exp.category.toLowerCase().includes(q) ||
        exp.payerName.toLowerCase().includes(q),
    );
  }, [allDisplayExpenses, searchQuery]);

  // Outstanding update banner values
  const outstandingAmount =
    myBill && myBill.outstandingCentavos > 0
      ? `$${(myBill.outstandingCentavos / 100).toFixed(0)}`
      : "$85";
  const recentPayerName =
    expenses.length > 0 ? expenses[0].payerName || "Jumman" : "Jumman";

  if (initialLoading && !profile) {
    return (
      <View style={styles.loaderScreenContainer}>
        <StatusBar barStyle="dark-content" />
        <UniversalLoader text="Loading Splitzy..." transparent={false} />
      </View>
    );
  }

  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    24,
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Fixed Status Bar Shield & Top Bar: Splitzy Logo & Actions */}
      <View style={[styles.fixedHeaderContainer, { paddingTop: topInset + 6 }]}>
        <View style={styles.topBar}>
          <Text style={styles.logoText}>Splitzy</Text>

          <View style={styles.topBarActions}>
            {/* Notification Bell with red dot */}
            <TouchableOpacity
              style={styles.iconCircleButton}
              activeOpacity={0.8}
              onPress={() => {
                Alert.alert(
                  "Recent Updates",
                  `${recentPayerName} settled dues recently. Outstanding: ${outstandingAmount}.`,
                );
              }}
            >
              <Feather name="bell" size={20} color="#0F172A" />
              <View style={styles.notificationDot} />
            </TouchableOpacity>

            {/* Profile Avatar Image */}
            <TouchableOpacity
              style={styles.avatarButton}
              activeOpacity={0.85}
              onPress={() => onNavigate("profile")}
            >
              <Image
                source={{
                  uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
                }}
                style={styles.avatarImage}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 14) + 72,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>Hi {greetingName}! 👋</Text>
          <Text style={styles.greetingSubtitle}>
            Control your expenses here.
          </Text>
        </View>

        {/* Search Bar Capsule */}
        <View style={styles.searchBarContainer}>
          <Feather
            name="search"
            size={19}
            color="#64748B"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search group or expenses"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Updates Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Updates</Text>
          <TouchableOpacity
            onPress={() =>
              onOpenExpenseHistory
                ? onOpenExpenseHistory()
                : onNavigate("bills")
            }
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Updates Banner Card */}
        <View style={styles.recentUpdateCard}>
          <View style={styles.recentUpdateTextWrap}>
            <Text style={styles.recentUpdateTitle}>
              {recentPayerName} Made a Payment!
            </Text>
            <Text style={styles.recentUpdateDesc}>
              Review and settle — {outstandingAmount}.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.settleNowButton}
            activeOpacity={0.85}
            onPress={() =>
              onOpenSettleDues ? onOpenSettleDues() : onNavigate("payments")
            }
          >
            <Text style={styles.settleNowButtonText}>Settle Now</Text>
          </TouchableOpacity>
        </View>

        {/* My Groups Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          <TouchableOpacity
            onPress={() =>
              onOpenManageGroup
                ? onOpenManageGroup("details")
                : onNavigate("manage_group")
            }
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Groups Horizontal Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupsScrollContent}
        >
          {/* Card 1: Vibrant Blue Card (Apartment Roommate) */}
          <TouchableOpacity
            style={styles.groupCardBlue}
            activeOpacity={0.92}
            onPress={() =>
              onOpenManageGroup
                ? onOpenManageGroup("details")
                : onNavigate("manage_group")
            }
          >
            <Text style={styles.groupCardBlueTitle} numberOfLines={1}>
              {group1Title}
            </Text>
            <Text style={styles.groupCardBlueSubtitle}>
              Total Expenses: {group1TotalDisplay}
            </Text>

            {/* Overlapping Roommate Avatars */}
            <View style={styles.avatarStackRow}>
              {ROOMMATE_AVATARS_GROUP1.map((url, idx) => (
                <Image
                  key={`g1-avatar-${idx}`}
                  source={{ uri: url }}
                  style={[
                    styles.stackAvatarImage,
                    idx > 0 && styles.stackAvatarOverlap,
                    { borderColor: "#2563EB" },
                  ]}
                />
              ))}
              <View
                style={[styles.stackCounterBadge, styles.stackAvatarOverlap]}
              >
                <Text style={styles.stackCounterText}>+4</Text>
              </View>
            </View>

            {/* Add Expenses Button */}
            <TouchableOpacity
              style={styles.groupCardBlueButton}
              activeOpacity={0.85}
              onPress={() =>
                onOpenAddExpense ? onOpenAddExpense() : onNavigate("bills")
              }
            >
              <Text style={styles.groupCardBlueButtonText}>Add Expenses</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Card 2: Light White Slate Card (Trip Expense) */}
          <TouchableOpacity
            style={styles.groupCardLight}
            activeOpacity={0.92}
            onPress={() =>
              onOpenManageGroup
                ? onOpenManageGroup("details")
                : onNavigate("manage_group")
            }
          >
            <Text style={styles.groupCardLightTitle} numberOfLines={1}>
              Trip Expense
            </Text>
            <Text style={styles.groupCardLightSubtitle}>
              Total Expenses: $873
            </Text>

            {/* Overlapping Avatars for Trip */}
            <View style={styles.avatarStackRow}>
              {ROOMMATE_AVATARS_GROUP2.map((url, idx) => (
                <Image
                  key={`g2-avatar-${idx}`}
                  source={{ uri: url }}
                  style={[
                    styles.stackAvatarImage,
                    idx > 0 && styles.stackAvatarOverlap,
                    { borderColor: "#FFFFFF" },
                  ]}
                />
              ))}
              <View
                style={[
                  styles.stackCounterBadge,
                  styles.stackAvatarOverlap,
                  { backgroundColor: "#F1F5F9" },
                ]}
              >
                <Text style={[styles.stackCounterText, { color: "#475569" }]}>
                  +2
                </Text>
              </View>
            </View>

            {/* Light Blue Button */}
            <TouchableOpacity
              style={styles.groupCardLightButton}
              activeOpacity={0.85}
              onPress={() =>
                onOpenAddExpense ? onOpenAddExpense() : onNavigate("bills")
              }
            >
              <Text style={styles.groupCardLightButtonText}>Add Expenses</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Card 3: Connect / Join Household Button Card */}
          <TouchableOpacity
            style={styles.groupCardAdd}
            activeOpacity={0.85}
            onPress={() => setShowJoinModal(true)}
          >
            <View style={styles.groupCardAddIconWrap}>
              <Feather name="plus" size={22} color="#2563EB" />
            </View>
            <Text style={styles.groupCardAddTitle}>Join Group</Text>
            <Text style={styles.groupCardAddSubtitle}>Enter Invite Code</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Recent Expenses Section */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          <TouchableOpacity onPress={onOpenExpenseHistory}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Expense Items List */}
        <View style={styles.expenseList}>
          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No matching expenses found</Text>
              <Text style={styles.emptySub}>
                Try searching another keyword or add a new expense.
              </Text>
            </View>
          ) : (
            filteredExpenses.map((expense) => {
              return (
                <TouchableOpacity
                  key={expense.id}
                  style={styles.expenseItemCard}
                  activeOpacity={0.85}
                  onPress={onOpenExpenseHistory}
                >
                  {/* Left Icon Container */}
                  <View style={styles.expenseIconContainer}>
                    {expense.iconType === "wifi" ? (
                      <Feather name="wifi" size={20} color="#64748B" />
                    ) : expense.iconType === "flash" ? (
                      <Ionicons
                        name="flash-outline"
                        size={20}
                        color="#64748B"
                      />
                    ) : expense.iconType === "water" ? (
                      <Ionicons
                        name="water-outline"
                        size={20}
                        color="#64748B"
                      />
                    ) : (
                      <Feather name="shopping-cart" size={20} color="#64748B" />
                    )}
                  </View>

                  {/* Middle Title & Details */}
                  <View style={styles.expenseDetailsWrap}>
                    <Text style={styles.expenseTitle}>{expense.title}</Text>
                    <Text style={styles.expenseSubtitle}>
                      {expense.date} {"  "}Paid by {expense.payerName}
                    </Text>
                  </View>

                  {/* Right Negative Amount */}
                  <Text style={styles.expenseAmountText}>
                    {expense.amountFormatted}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Join Household with Code Modal */}
      <Modal
        visible={showJoinModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="key" size={22} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>Join Household Group</Text>
                <Text style={styles.modalSubtitle}>
                  Enter invite code or group ID
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowJoinModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Household Code (e.g. PF-402)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. PF-402"
              placeholderTextColor="#94A3B8"
              value={joinCodeInput}
              onChangeText={setJoinCodeInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Text style={styles.inputHint}>
              Ask your host or roommate to check their Household settings or
              invite code.
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowJoinModal(false)}
                disabled={joinLoading}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, joinLoading && { opacity: 0.7 }]}
                onPress={handleJoinByCode}
                disabled={joinLoading}
              >
                {joinLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Join Group</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loaderScreenContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  // Fixed Header Shield
  fixedHeaderContainer: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
    paddingBottom: 4,
    zIndex: 50,
  },

  // Top Bar
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  logoText: {
    fontSize: 27,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: -0.8,
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  // Greeting
  greetingSection: {
    marginBottom: 4,
  },
  greetingTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "400",
  },

  // Search Bar
  searchBarContainer: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
    paddingVertical: 0,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  viewAllText: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "700",
  },

  // Recent Updates Banner Card
  recentUpdateCard: {
    backgroundColor: "#DBEAFE",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  recentUpdateTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  recentUpdateTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  recentUpdateDesc: {
    fontSize: 12,
    color: "#475569",
    marginTop: 4,
    fontWeight: "500",
  },
  settleNowButton: {
    backgroundColor: "#FBBF24",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  settleNowButtonText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 12,
  },

  // Groups Section
  groupsScrollContent: {
    paddingRight: 10,
    gap: 14,
  },
  groupCardBlue: {
    width: 195,
    backgroundColor: "#2563EB",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  groupCardBlueTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  groupCardBlueSubtitle: {
    color: "#BFDBFE",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 3,
    textAlign: "center",
  },
  avatarStackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
  },
  stackAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  stackAvatarOverlap: {
    marginLeft: -8,
  },
  stackCounterBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  stackCounterText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2563EB",
  },
  groupCardBlueButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 9,
    alignItems: "center",
    width: "100%",
  },
  groupCardBlueButtonText: {
    color: "#2563EB",
    fontWeight: "800",
    fontSize: 12,
  },

  // Group Card Light (Trip Expense)
  groupCardLight: {
    width: 195,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  groupCardLightTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  groupCardLightSubtitle: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 3,
    textAlign: "center",
  },
  groupCardLightButton: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    paddingVertical: 9,
    alignItems: "center",
    width: "100%",
  },
  groupCardLightButtonText: {
    color: "#2563EB",
    fontWeight: "800",
    fontSize: 12,
  },

  // Group Card Add / Join
  groupCardAdd: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
  },
  groupCardAddIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  groupCardAddTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  groupCardAddSubtitle: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },

  // Recent Expenses
  expenseList: {
    gap: 12,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  emptySub: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "center",
  },
  expenseItemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  expenseIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  expenseDetailsWrap: {
    flex: 1,
    paddingRight: 8,
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  expenseSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
    fontWeight: "400",
  },
  expenseAmountText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  modalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 1,
  },
  inputHint: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
    lineHeight: 16,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
  modalCancelBtnText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 13,
  },
  modalSubmitBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },
  modalSubmitBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
});
