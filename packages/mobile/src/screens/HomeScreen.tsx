import React, { useEffect, useState, useMemo, useRef } from "react";
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
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  mobileDataService,
  MobileExpense,
  isPayorMember,
} from "../services/firebaseDataService";
import { auth } from "../firebase/config";
import { formatPesos } from "@propertyflow/shared";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { UniversalLoader } from "../components/UniversalLoader";
import { Ionicons, Feather } from "@expo/vector-icons";
import { getCategoryMeta } from "../services/categoryService";

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
  onOpenAddExpense?: () => void;
  onOpenSettleDues?: () => void;
  onOpenExpenseHistory?: () => void;
  onOpenManageGroup?: (mode?: "details" | "create" | "join") => void;
  onOpenReports?: () => void;
  onOpenHostApplication?: () => void;
  currentUser?: { name: string; avatar: string };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenAddExpense,
  onOpenSettleDues,
  onOpenExpenseHistory,
  onOpenManageGroup,
  onOpenReports,
  onOpenHostApplication,
  currentUser = { name: "Resident", avatar: "R" },
}) => {
  const firebaseUser = auth.currentUser;
  const cachedInitialProfile = mobileDataService.getCachedProfile(
    firebaseUser?.uid,
  );
  const cachedInitialHousehold = cachedInitialProfile
    ? mobileDataService.getCachedHousehold()
    : null;
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
  const [members, setMembers] = useState<any[]>([]);
  const [memberBills, setMemberBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [showActivitiesModal, setShowActivitiesModal] =
    useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [showHostRequiredModal, setShowHostRequiredModal] =
    useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>("");
  const [joinLoading, setJoinLoading] = useState<boolean>(false);

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
    profile?.role === "HOST" ||
    profile?.role === "SUPER_ADMIN" ||
    profile?.hostApplicationStatus === "APPROVED";
  const hasGroup = Boolean(household?.householdId || profile?.householdId);

  const handleCreateGroupPress = () => {
    if (!isHost) {
      setShowHostRequiredModal(true);
      return;
    }
    if (onOpenManageGroup) {
      onOpenManageGroup("create");
    } else {
      onNavigate("manage_group");
    }
  };

  const fadeAnim = useRef(
    new Animated.Value(cachedInitialProfile ? 1 : 0),
  ).current;
  const slideAnim = useRef(
    new Animated.Value(cachedInitialProfile ? 0 : 14),
  ).current;

  // Fallback timer for loading screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialLoading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [initialLoading]);

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
      setMembers([]);
      setPayments([]);
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
    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      householdId,
      setMembers,
    );
    const unsubPayments = mobileDataService.listenToPayments(
      householdId,
      setPayments,
    );
    return () => {
      unsubHousehold();
      unsubExpenses();
      unsubCycles();
      unsubMembers();
      unsubPayments();
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
      displayName:
        profile?.displayName || firebaseUser.displayName || currentUser.name,
      email: firebaseUser.email || "",
      photoURL: profile?.profilePicture || firebaseUser.photoURL || "",
    });

    setJoinLoading(false);
    if (result.success) {
      setShowJoinModal(false);
      setJoinCodeInput("");
      Alert.alert(
        "Request Sent",
        `Your request to join "${result.household?.householdName || "the household"}" has been sent! The host must approve your request before you can access the group.`,
      );
    } else {
      Alert.alert(
        "Could Not Join",
        result.error || "No household found matching that code.",
      );
    }
  };

  // User display name from profile, current user, or firebase auth
  const greetingName = useMemo(() => {
    if (profile?.displayName) return profile.displayName.split(" ")[0];
    if (profile?.fullName) return profile.fullName.split(" ")[0];
    if (
      currentUser?.name &&
      currentUser.name !== "Resident" &&
      currentUser.name !== "Member" &&
      currentUser.name !== "Arafat"
    ) {
      return currentUser.name.split(" ")[0];
    }
    if (firebaseUser?.displayName)
      return firebaseUser.displayName.split(" ")[0];
    if (firebaseUser?.email) return firebaseUser.email.split("@")[0];
    return "Resident";
  }, [profile, currentUser?.name, firebaseUser]);

  // Formatted display amounts in Philippine Pesos (₱)
  const group1TotalDisplay =
    totalExpenses > 0 ? formatPesos(totalExpenses) : "₱0.00";
  const group1Title =
    household?.householdName ||
    household?.name ||
    profile?.householdName ||
    profile?.apartmentName ||
    (hasGroup ? "My Household" : "Create a Group");
  const group1Subtitle = hasGroup
    ? `Total Expenses: ${group1TotalDisplay}`
    : "No group yet · Set up your room";

  // Outstanding update banner & calculation values
  const activeMembersList = members.filter((m) => m.status === "ACTIVE");
  const activePayorsList = activeMembersList.filter((m) => isPayorMember(m));
  const isCurrentUserPayor = isPayorMember(
    activeMembersList.find((m) => m.userId === firebaseUser?.uid),
  );
  const payorCount = Math.max(
    1,
    activePayorsList.length > 0
      ? activePayorsList.length
      : activeMembersList.length,
  );

  // Map real Firestore expenses to UI items
  const realExpensesMapped = useMemo(() => {
    return expenses.map((exp) => {
      const categoryMeta = getCategoryMeta(exp.category);

      const isPaid = exp.status === "PAID" || exp.isPaid === true;
      const formatted = isPaid
        ? `-₱${(exp.amountCents / 100).toFixed(2)}`
        : `₱${(exp.amountCents / 100).toFixed(2)}`;

      // Calculate roommate's specific share for this bill
      let myShareCents = 0;
      if (isCurrentUserPayor) {
        const mySplit = exp.splitDetails?.find(
          (s: any) => s.userId === firebaseUser?.uid,
        );
        myShareCents =
          mySplit?.shareCentavos ?? Math.round(exp.amountCents / payorCount);
      }

      return {
        id: exp.id,
        rawExpense: exp,
        title: exp.title,
        category: exp.category || "General",
        categoryMeta,
        date: exp.date || "Recent",
        payerName: exp.payerName || "Roommate",
        amountCents: exp.amountCents,
        amountFormatted: formatted,
        myShareCents,
        myShareFormatted: formatPesos(myShareCents),
        isPaid,
        status: exp.status || (isPaid ? "PAID" : "UNPAID"),
      };
    });
  }, [expenses, isCurrentUserPayor, payorCount, firebaseUser?.uid]);

  const allDisplayExpenses = realExpensesMapped;

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

  // Separate Upcoming (Unpaid) Bills from Settled Expenses
  const upcomingBills = useMemo(() => {
    return filteredExpenses.filter((e) => !e.isPaid);
  }, [filteredExpenses]);

  const settledExpenses = useMemo(() => {
    return filteredExpenses.filter((e) => e.isPaid);
  }, [filteredExpenses]);

  // Unpaid total dues calculation
  const unpaidExpenses = expenses.filter(
    (e) => e.status !== "PAID" && !e.isPaid,
  );

  const liveShareCents = isCurrentUserPayor
    ? unpaidExpenses.reduce((sum, e) => {
        if (
          e.splitDetails &&
          Array.isArray(e.splitDetails) &&
          e.splitDetails.length > 0
        ) {
          const mySplit = e.splitDetails.find(
            (s: any) => s.userId === firebaseUser?.uid,
          );
          if (mySplit && typeof mySplit.shareCentavos === "number")
            return sum + mySplit.shareCentavos;
        }
        return sum + Math.round(e.amountCents / payorCount);
      }, 0)
    : 0;

  const outstandingAmount = !isCurrentUserPayor
    ? "₱0.00"
    : myBill &&
        typeof myBill.outstandingCentavos === "number" &&
        myBill.outstandingCentavos > 0
      ? formatPesos(myBill.outstandingCentavos)
      : liveShareCents > 0
        ? formatPesos(liveShareCents)
        : "₱0.00";

  // Dynamic real activities feed combining payments and added bills
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      type: "payment" | "bill_added" | "bill_settled";
      title: string;
      desc: string;
      timestamp: string;
      dateFormatted: string;
      amountFormatted: string;
      actionText: string;
      onAction: () => void;
      icon: "check-circle" | "file-text" | "alert-circle";
      color: string;
    }> = [];

    // 1. Payments recorded in Firebase
    payments.forEach((p) => {
      const isApproved = p.status === "APPROVED";
      const isPending = p.status === "SUBMITTED" || p.status === "PENDING";
      const payerName = p.payerName || "Roommate";
      const amtStr = formatPesos(p.amountCentavos);
      const isCurrentUser = p.userId === firebaseUser?.uid;

      list.push({
        id: `pay_${p.paymentId}`,
        type: "payment",
        title: isApproved
          ? `${payerName} Settled a Payment!`
          : isCurrentUser
            ? `You Submitted a Payment!`
            : `${payerName} Made a Payment!`,
        desc: `${amtStr} via ${p.paymentMethod || "GCash / Bank"}${
          isPending && isHost
            ? " · Awaiting your verification"
            : " · Payment recorded"
        }.`,
        timestamp: p.createdDate || p.paymentDate || "",
        dateFormatted: p.paymentDate || "Recent",
        amountFormatted: amtStr,
        actionText: isHost && isPending ? "Review" : "View Payments",
        onAction: () => onNavigate("payments"),
        icon: "check-circle",
        color: "#10B981",
      });
    });

    // 2. Added Bills & Expenses in Firebase
    expenses.forEach((exp) => {
      const isPaid = exp.status === "PAID" || exp.isPaid;
      const amtStr = formatPesos(exp.amountCents);
      const payer = exp.payerName || "Host";
      const isMePayer = exp.payerId === firebaseUser?.uid;

      // Calculate my share for this bill if payor
      let myShareStr = "";
      if (isCurrentUserPayor) {
        const mySplit = exp.splitDetails?.find(
          (s: any) => s.userId === firebaseUser?.uid,
        );
        const myShareCents =
          mySplit?.shareCentavos ?? Math.round(exp.amountCents / payorCount);
        myShareStr = `Your share: ${formatPesos(myShareCents)}`;
      }

      if (isPaid) {
        list.push({
          id: `exp_settled_${exp.id}`,
          type: "bill_settled",
          title: `${payer} Paid ${exp.title}`,
          desc: `${amtStr} settled in full for the household.`,
          timestamp: exp.createdAt || exp.date || "",
          dateFormatted: exp.date || "Recent",
          amountFormatted: amtStr,
          actionText: "View History",
          onAction: () =>
            onOpenExpenseHistory ? onOpenExpenseHistory() : onNavigate("bills"),
          icon: "check-circle",
          color: "#2563EB",
        });
      } else {
        list.push({
          id: `exp_new_${exp.id}`,
          type: "bill_added",
          title: isMePayer
            ? `You Added Bill: ${exp.title}`
            : `${payer} Added Bill: ${exp.title}`,
          desc: `Total: ${amtStr}${myShareStr ? ` · ${myShareStr}` : ""}.`,
          timestamp: exp.createdAt || exp.date || "",
          dateFormatted: exp.date || "Recent",
          amountFormatted: amtStr,
          actionText: isCurrentUserPayor ? "Settle Now" : "View Bill",
          onAction: () =>
            isCurrentUserPayor && onOpenSettleDues
              ? onOpenSettleDues()
              : onNavigate("bills"),
          icon: "file-text",
          color: "#D97706",
        });
      }
    });

    // Sort by timestamp newest first
    list.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return list;
  }, [
    payments,
    expenses,
    firebaseUser?.uid,
    isHost,
    isCurrentUserPayor,
    payorCount,
    onNavigate,
    onOpenExpenseHistory,
    onOpenSettleDues,
  ]);

  const latestActivity = recentActivities[0];

  const recentPayerName =
    payments.length > 0 && payments[0]?.payerName
      ? payments[0].payerName
      : expenses.length > 0 && expenses[0]?.payerName
        ? expenses[0].payerName
        : hasGroup
          ? "All settled"
          : "None";

  const bannerActivity = latestActivity || {
    id: "default",
    type: "bill_added",
    title: hasGroup
      ? "No Recent Updates"
      : isHost
        ? "Start a Household Group"
        : "Household Group",
    desc: hasGroup
      ? "Add a household bill to start tracking room expenses."
      : isHost
        ? "Create your shared apartment group or enter an invite code."
        : "Join your household with an invite code, or apply to be a Host.",
    actionText: hasGroup
      ? "Add Bills"
      : isHost
        ? "Create Group"
        : "Join / Host",
    onAction: () =>
      hasGroup
        ? onOpenAddExpense
          ? onOpenAddExpense()
          : onNavigate("bills")
        : handleCreateGroupPress(),
    icon: hasGroup ? "file-text" : isHost ? "users" : "shield",
    color: "#2563EB",
  };

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

      {/* Semi-transparent loading Splitzy overlay when loading */}
      {initialLoading && !profile && (
        <UniversalLoader text="Loading Splitzy..." transparent={true} />
      )}

      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        {/* Fixed Status Bar Shield & Top Bar: Splitzy Logo & Actions */}
        <View
          style={[styles.fixedHeaderContainer, { paddingTop: topInset + 6 }]}
        >
          <View style={styles.topBar}>
            <Text style={styles.logoText}>Splitzy</Text>

            <View style={styles.topBarActions}>
              {/* Notification Bell with red dot */}
              <TouchableOpacity
                style={styles.iconCircleButton}
                activeOpacity={0.8}
                onPress={() => {
                  setShowActivitiesModal(true);
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
                {profile?.profilePicture || firebaseUser?.photoURL ? (
                  <Image
                    source={{
                      uri: profile?.profilePicture || firebaseUser?.photoURL,
                    }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarInitialWrap}>
                    <Text style={styles.avatarInitialText}>
                      {(profile?.displayName || currentUser.name || "R")
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}
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
            <Text style={styles.greetingTitle}>Hi {greetingName}!</Text>
            <Text style={styles.greetingSubtitle}>
              Control your expenses here.
            </Text>
          </View>

          {/* Pending Request Status Notice */}
          {profile?.joinRequestStatus === "PENDING" && (
            <View style={styles.noticeBannerPending}>
              <Feather name="clock" size={20} color="#D97706" />
              <View style={styles.noticeBannerTextWrap}>
                <Text style={styles.noticeBannerTitle}>
                  Join Request Pending Approval
                </Text>
                <Text style={styles.noticeBannerSubtitle}>
                  Waiting for the host of{" "}
                  {profile.pendingHouseholdName || "the household"} to approve
                  your request.
                </Text>
              </View>
            </View>
          )}

          {profile?.joinRequestStatus === "REJECTED" && (
            <View style={styles.noticeBannerRejected}>
              <Feather name="alert-circle" size={20} color="#E11D48" />
              <View style={styles.noticeBannerTextWrap}>
                <Text style={styles.noticeBannerRejectedTitle}>
                  Join Request Declined
                </Text>
                <Text style={styles.noticeBannerRejectedSubtitle}>
                  Reason: {profile.joinRejectionReason || "Declined by host"}.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  mobileDataService.saveUserProfile({
                    uid: firebaseUser!.uid,
                    joinRequestStatus: undefined,
                    joinRejectionReason: undefined,
                  })
                }
              >
                <Feather name="x" size={16} color="#E11D48" />
              </TouchableOpacity>
            </View>
          )}

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
              onPress={() => {
                if (recentActivities.length > 0) {
                  setShowActivitiesModal(true);
                } else if (onOpenExpenseHistory) {
                  onOpenExpenseHistory();
                } else {
                  onNavigate("bills");
                }
              }}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Updates Banner Card */}
          <View style={styles.recentUpdateCard}>
            <View style={styles.recentUpdateTextWrap}>
              <Text style={styles.recentUpdateTitle} numberOfLines={1}>
                {bannerActivity.title}
              </Text>
              <Text style={styles.recentUpdateDesc} numberOfLines={2}>
                {bannerActivity.desc}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.settleNowButton}
              activeOpacity={0.85}
              onPress={bannerActivity.onAction}
            >
              <Text style={styles.settleNowButtonText}>
                {bannerActivity.actionText}
              </Text>
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
            {/* Card 1: Vibrant Blue Card (Active Household) */}
            <TouchableOpacity
              style={styles.groupCardBlue}
              activeOpacity={0.92}
              onPress={() => {
                if (hasGroup) {
                  onOpenManageGroup
                    ? onOpenManageGroup("details")
                    : onNavigate("manage_group");
                } else {
                  handleCreateGroupPress();
                }
              }}
            >
              <Text style={styles.groupCardBlueTitle} numberOfLines={1}>
                {group1Title}
              </Text>
              <Text style={styles.groupCardBlueSubtitle}>{group1Subtitle}</Text>

              {/* Roommate Avatars: if no members yet, only room host is shown */}
              <View style={styles.avatarStackRow}>
                {(() => {
                  if (!hasGroup) {
                    return (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <View
                          style={[
                            styles.stackAvatarFallback,
                            {
                              backgroundColor: "rgba(255,255,255,0.2)",
                              borderColor: "rgba(255,255,255,0.4)",
                            },
                          ]}
                        >
                          <Feather
                            name={isHost ? "plus" : "shield"}
                            size={14}
                            color="#FFFFFF"
                          />
                        </View>
                        <Text
                          style={{
                            fontSize: 11,
                            color: "rgba(255, 255, 255, 0.9)",
                            fontWeight: "600",
                          }}
                        >
                          {isHost
                            ? "Tap to create a household"
                            : "Host status required to create"}
                        </Text>
                      </View>
                    );
                  }

                  const hostId =
                    household?.hostId || (isHost ? firebaseUser?.uid : "");
                  const hostDisplayName =
                    household?.hostName ||
                    (isHost
                      ? profile?.displayName || currentUser.name
                      : "Room Host");
                  const hostPhoto = isHost
                    ? profile?.profilePicture || firebaseUser?.photoURL
                    : household?.hostPhoto ||
                      members.find((m) => m.role === "HOST")?.profilePicture;

                  const hostObj = {
                    memberId: hostId || "host",
                    displayName: hostDisplayName,
                    profilePicture: hostPhoto,
                    role: "HOST",
                  };

                  // Strictly approved, active members that are NOT the host
                  const otherActiveMembers = members.filter(
                    (m) =>
                      m.status === "ACTIVE" &&
                      m.role !== "HOST" &&
                      m.userId !== hostId &&
                      m.memberId !== hostId,
                  );

                  // If no members yet, only show room host profile!
                  if (otherActiveMembers.length === 0) {
                    return (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {hostObj.profilePicture ? (
                          <Image
                            source={{ uri: hostObj.profilePicture }}
                            style={[
                              styles.stackAvatarImage,
                              { borderColor: "#2563EB" },
                            ]}
                          />
                        ) : (
                          <View
                            style={[
                              styles.stackAvatarFallback,
                              { borderColor: "#2563EB" },
                            ]}
                          >
                            <Text style={styles.stackAvatarFallbackText}>
                              {hostObj.displayName.charAt(0).toUpperCase() ||
                                "H"}
                            </Text>
                          </View>
                        )}
                        <Text
                          style={{
                            fontSize: 11,
                            color: "rgba(255, 255, 255, 0.9)",
                            fontWeight: "700",
                          }}
                        >
                          Host: {hostObj.displayName}
                        </Text>
                      </View>
                    );
                  }

                  // If there are approved members, show host + up to 3 members
                  const displayedList = [
                    hostObj,
                    ...otherActiveMembers.slice(0, 3),
                  ];
                  const extraRoommatesCount = Math.max(
                    0,
                    otherActiveMembers.length - 3,
                  );

                  return (
                    <>
                      {displayedList.map((m: any, idx: number) => {
                        if (m.profilePicture) {
                          return (
                            <Image
                              key={`g1-avatar-${m.memberId || m.userId || idx}`}
                              source={{ uri: m.profilePicture }}
                              style={[
                                styles.stackAvatarImage,
                                idx > 0 && styles.stackAvatarOverlap,
                                { borderColor: "#2563EB" },
                              ]}
                            />
                          );
                        }
                        const initial = (
                          m.displayName ||
                          m.name ||
                          (m.role === "HOST" ? "H" : "M")
                        )
                          .charAt(0)
                          .toUpperCase();
                        return (
                          <View
                            key={`g1-avatar-${m.memberId || m.userId || idx}`}
                            style={[
                              styles.stackAvatarFallback,
                              idx > 0 && styles.stackAvatarOverlap,
                              { borderColor: "#2563EB" },
                            ]}
                          >
                            <Text style={styles.stackAvatarFallbackText}>
                              {initial}
                            </Text>
                          </View>
                        );
                      })}
                      {extraRoommatesCount > 0 && (
                        <View
                          style={[
                            styles.stackCounterBadge,
                            styles.stackAvatarOverlap,
                          ]}
                        >
                          <Text style={styles.stackCounterText}>
                            +{extraRoommatesCount}
                          </Text>
                        </View>
                      )}
                    </>
                  );
                })()}
              </View>

              {/* Add Bills or Create Group Button */}
              <TouchableOpacity
                style={styles.groupCardBlueButton}
                activeOpacity={0.85}
                onPress={() => {
                  if (hasGroup) {
                    if (onOpenAddExpense) onOpenAddExpense();
                    else onNavigate("bills");
                  } else {
                    handleCreateGroupPress();
                  }
                }}
              >
                <Text style={styles.groupCardBlueButtonText}>
                  {hasGroup
                    ? "Add Bills"
                    : isHost
                      ? "Create Group"
                      : "Join Household"}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Card 2: Clean Join Card */}
            <TouchableOpacity
              style={styles.groupCardLight}
              activeOpacity={0.92}
              onPress={() => setShowJoinModal(true)}
            >
              <View style={styles.groupCardLightHeader}>
                <Text style={styles.groupCardLightTitle} numberOfLines={1}>
                  Join a Room
                </Text>
                <View style={styles.groupCardLightIconWrap}>
                  <Feather name="user-plus" size={16} color="#2563EB" />
                </View>
              </View>
              <Text style={styles.groupCardLightSubtitle}>
                Have an invite code from your host?
              </Text>

              <View style={styles.joinCodePillPreview}>
                <Feather name="hash" size={13} color="#2563EB" />
                <Text style={styles.joinCodePillText}>Invite Code</Text>
              </View>

              <TouchableOpacity
                style={styles.groupCardLightButton}
                activeOpacity={0.85}
                onPress={() => setShowJoinModal(true)}
              >
                <Text style={styles.groupCardLightButtonText}>Enter Code</Text>
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Card 3: Create Household Button Card */}
            <TouchableOpacity
              style={[
                styles.groupCardAdd,
                !isHost && {
                  borderColor: "#E2E8F0",
                  backgroundColor: "#F8FAFC",
                },
              ]}
              activeOpacity={0.85}
              onPress={handleCreateGroupPress}
            >
              <View
                style={[
                  styles.groupCardAddIconWrap,
                  !isHost && { backgroundColor: "#EEF2FF" },
                ]}
              >
                <Feather
                  name={isHost ? "plus" : "shield"}
                  size={22}
                  color="#2563EB"
                />
              </View>
              <Text style={styles.groupCardAddTitle}>Create Group</Text>
              <Text style={styles.groupCardAddSubtitle}>
                {isHost ? "Start New Household" : "Host Access Only"}
              </Text>
              {!isHost && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: "#EFF6FF",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 12,
                    marginTop: 6,
                    borderWidth: 1,
                    borderColor: "#BFDBFE",
                  }}
                >
                  <Feather name="lock" size={10} color="#2563EB" />
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: "#2563EB",
                    }}
                  >
                    Host Guard
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* Upcoming Bills Section */}
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={styles.sectionTitle}>Upcoming Bills</Text>
              {upcomingBills.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {upcomingBills.length}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => onNavigate("bills")}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {/* Upcoming Bills List */}
          <View style={styles.expenseList}>
            {upcomingBills.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name="checkmark-done-circle-outline"
                    size={24}
                    color="#10B981"
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery.trim()
                    ? "No matching upcoming bills"
                    : "No upcoming bills right now"}
                </Text>
                <Text style={styles.emptySub}>
                  {searchQuery.trim()
                    ? "Try searching another keyword or clear your query."
                    : hasGroup
                      ? "All household bills have been settled or none are currently pending."
                      : "Join a household above to view upcoming shared bills."}
                </Text>
              </View>
            ) : (
              upcomingBills.map((bill) => {
                return (
                  <TouchableOpacity
                    key={`bill_${bill.id}`}
                    style={styles.upcomingBillCard}
                    activeOpacity={0.85}
                    onPress={() => onNavigate("bills")}
                  >
                    {/* Left Icon Container - aligned flex-start with title */}
                    <View
                      style={[
                        styles.upcomingBillIconContainer,
                        { backgroundColor: bill.categoryMeta.bgColor },
                      ]}
                    >
                      <Feather
                        name={bill.categoryMeta.featherIcon as any}
                        size={20}
                        color={bill.categoryMeta.color}
                      />
                    </View>

                    {/* Middle Title & Details - aligned flex-start */}
                    <View style={styles.upcomingBillDetailsWrap}>
                      <Text style={styles.upcomingBillTitle} numberOfLines={2}>
                        {bill.title}
                      </Text>
                      <Text
                        style={styles.upcomingBillSubtitle}
                        numberOfLines={1}
                      >
                        {bill.date} · Billed by {bill.payerName}
                      </Text>
                      {isCurrentUserPayor && bill.myShareCents > 0 && (
                        <Text style={styles.upcomingBillShareText}>
                          Your share: {bill.myShareFormatted}
                        </Text>
                      )}
                    </View>

                    {/* Right Column - DUE badge at upper-right, Amount + Status at bottom-right */}
                    <View style={styles.upcomingBillRightCol}>
                      <View style={styles.badgeUnpaid}>
                        <Text style={styles.badgeUnpaidText}>DUE</Text>
                      </View>
                      <View style={styles.upcomingBillAmountWrap}>
                        <Text style={styles.billTotalAmountText}>
                          {formatPesos(bill.amountCents)}
                        </Text>
                        <Text style={styles.billDueLabel}>Unpaid</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Recent Expenses Section (Settled & Paid items) */}
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
            <TouchableOpacity onPress={onOpenExpenseHistory}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {/* Settled Expense Items List */}
          <View style={styles.expenseList}>
            {settledExpenses.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="receipt-outline" size={24} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery.trim()
                    ? "No matching paid expenses"
                    : "No paid expenses recorded yet"}
                </Text>
                <Text style={styles.emptySub}>
                  {searchQuery.trim()
                    ? "Try searching another keyword or clear your search."
                    : "Once upcoming bills are settled, they will appear here as completed expenses."}
                </Text>
              </View>
            ) : (
              settledExpenses.map((expense) => {
                return (
                  <TouchableOpacity
                    key={`exp_${expense.id}`}
                    style={styles.expenseItemCard}
                    activeOpacity={0.85}
                    onPress={onOpenExpenseHistory}
                  >
                    {/* Left Icon Container */}
                    <View
                      style={[
                        styles.expenseIconContainer,
                        { backgroundColor: expense.categoryMeta.bgColor },
                      ]}
                    >
                      <Feather
                        name={expense.categoryMeta.featherIcon as any}
                        size={20}
                        color={expense.categoryMeta.color}
                      />
                    </View>

                    {/* Middle Title & Details */}
                    <View style={styles.expenseDetailsWrap}>
                      <Text style={styles.expenseTitle}>{expense.title}</Text>
                      <Text style={styles.expenseSubtitle}>
                        {expense.date} · Paid by {expense.payerName}
                      </Text>
                    </View>

                    {/* Right Negative Amount in Pesos */}
                    <Text style={styles.expenseAmountText}>
                      {expense.amountFormatted}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </Animated.View>

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

      {/* Recent Updates Activity Feed Modal */}
      <Modal
        visible={showActivitiesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowActivitiesModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Feather name="activity" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>Recent Updates</Text>
                <Text style={styles.modalSubtitle}>
                  Real-time activity feed for your room
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowActivitiesModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ marginTop: 8 }}
            >
              {recentActivities.length === 0 ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: "#94A3B8" }}>
                    No recent activities yet.
                  </Text>
                </View>
              ) : (
                recentActivities.map((act) => (
                  <TouchableOpacity
                    key={act.id}
                    style={styles.activityRow}
                    activeOpacity={0.8}
                    onPress={() => {
                      setShowActivitiesModal(false);
                      act.onAction();
                    }}
                  >
                    <View
                      style={[
                        styles.activityIconCircle,
                        { backgroundColor: `${act.color}15` },
                      ]}
                    >
                      <Feather name={act.icon} size={16} color={act.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                      <Text style={styles.activityTitle}>{act.title}</Text>
                      <Text style={styles.activityDesc} numberOfLines={2}>
                        {act.desc}
                      </Text>
                      <Text style={styles.activityTime}>
                        {act.dateFormatted}
                      </Text>
                    </View>
                    <View style={styles.activityActionBtn}>
                      <Text style={styles.activityActionText}>
                        {act.actionText}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Host Privileges Guard Modal */}
      <Modal
        visible={showHostRequiredModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHostRequiredModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <View style={{ alignItems: "center", paddingVertical: 10 }}>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  backgroundColor: "#EFF6FF",
                  borderWidth: 2,
                  borderColor: "#BFDBFE",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <Feather name="shield" size={28} color="#2563EB" />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: "#0F172A",
                  textAlign: "center",
                  marginBottom: 6,
                }}
              >
                Host Privileges Required
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: "#64748B",
                  textAlign: "center",
                  lineHeight: 19,
                  paddingHorizontal: 8,
                  marginBottom: 18,
                }}
              >
                Only verified Property Hosts can create and manage new household
                groups. Non-hosts can join an existing room with an invite code.
              </Text>

              {/* Informational Guidance Box */}
              <View
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                  padding: 12,
                  width: "100%",
                  marginBottom: 18,
                  gap: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <Feather
                    name="home"
                    size={16}
                    color="#2563EB"
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: "#1E293B",
                      }}
                    >
                      Are you the Property Host?
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#64748B",
                        marginTop: 1,
                        lineHeight: 15,
                      }}
                    >
                      Apply to get verified. Approved hosts can create household
                      groups, set rules, and split utilities.
                    </Text>
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: "#E2E8F0" }} />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <Feather
                    name="users"
                    size={16}
                    color="#059669"
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: "#1E293B",
                      }}
                    >
                      Are you a Roommate or Tenant?
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#64748B",
                        marginTop: 1,
                        lineHeight: 15,
                      }}
                    >
                      Ask your property host for your household’s invite code
                      (e.g. PF-402) to join immediately.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                style={{
                  width: "100%",
                  backgroundColor: "#2563EB",
                  paddingVertical: 13,
                  borderRadius: 12,
                  alignItems: "center",
                  marginBottom: 10,
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
                onPress={() => {
                  setShowHostRequiredModal(false);
                  if (onOpenHostApplication) {
                    onOpenHostApplication();
                  } else {
                    onNavigate("profile");
                  }
                }}
              >
                <Feather name="shield" size={16} color="#FFFFFF" />
                <Text
                  style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}
                >
                  Apply to Become a Host
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  width: "100%",
                  backgroundColor: "#EFF6FF",
                  borderWidth: 1,
                  borderColor: "#BFDBFE",
                  paddingVertical: 13,
                  borderRadius: 12,
                  alignItems: "center",
                  marginBottom: 8,
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
                onPress={() => {
                  setShowHostRequiredModal(false);
                  setShowJoinModal(true);
                }}
              >
                <Feather name="hash" size={15} color="#2563EB" />
                <Text
                  style={{ color: "#2563EB", fontWeight: "700", fontSize: 14 }}
                >
                  Join with Invite Code
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingVertical: 8 }}
                onPress={() => setShowHostRequiredModal(false)}
              >
                <Text
                  style={{ color: "#94A3B8", fontWeight: "600", fontSize: 13 }}
                >
                  Dismiss
                </Text>
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
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarInitialWrap: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Notice Banners
  noticeBannerPending: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
    gap: 12,
  },
  noticeBannerRejected: {
    backgroundColor: "#FFE4E6",
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
    gap: 12,
  },
  noticeBannerTextWrap: {
    flex: 1,
  },
  noticeBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E",
  },
  noticeBannerSubtitle: {
    fontSize: 11,
    color: "#B45309",
    marginTop: 2,
  },
  noticeBannerRejectedTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9F1239",
  },
  noticeBannerRejectedSubtitle: {
    fontSize: 11,
    color: "#BE123C",
    marginTop: 2,
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
    borderColor: "#E2E8F0",
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
  stackAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1D4ED8",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stackAvatarFallbackText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
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

  // Group Card Light (Join Group)
  groupCardLight: {
    width: 195,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  groupCardLightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  groupCardLightIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  joinCodePillPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginVertical: 10,
  },
  joinCodePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  groupCardLightTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
  },
  groupCardLightSubtitle: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "left",
    width: "100%",
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
    padding: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
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
  upcomingBillCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minHeight: 86,
  },
  upcomingBillIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  upcomingBillDetailsWrap: {
    flex: 1,
    paddingRight: 8,
    justifyContent: "flex-start",
  },
  upcomingBillTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 20,
  },
  upcomingBillSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
    fontWeight: "400",
  },
  upcomingBillShareText: {
    fontSize: 11,
    color: "#2563EB",
    fontWeight: "700",
    marginTop: 4,
  },
  upcomingBillRightCol: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "stretch",
    minHeight: 58,
    paddingLeft: 4,
  },
  upcomingBillAmountWrap: {
    alignItems: "flex-end",
    marginTop: 6,
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
  countBadge: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },
  badgeUnpaid: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  badgeUnpaidText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
  },
  expenseMyShare: {
    fontSize: 11,
    color: "#2563EB",
    fontWeight: "700",
    marginTop: 2,
  },
  billTotalAmountText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  billDueLabel: {
    fontSize: 11,
    color: "#D97706",
    fontWeight: "700",
    marginTop: 2,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  activityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  activityDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  activityTime: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 3,
  },
  activityActionBtn: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  activityActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
});
