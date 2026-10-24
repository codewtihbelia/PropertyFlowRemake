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
import { formatPesos } from "@propertyflow/shared";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  MobileExpense,
  MobilePayment,
  cleanBillTitle,
  isPayorMember,
  computeFairSplitShareCentavos,
  matchesMemberUid,
  evaluateHouseholdCycleSettlements,
} from "../services/firebaseDataService";
import { getCategoryMeta } from "../services/categoryService";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { useTheme } from "../context/ThemeContext";

export interface ExpensePayorBreakdownItem {
  userId: string;
  displayName: string;
  role: "HOST" | "PAYOR" | "NON_PAYOR";
  roleLabel: string;
  isPayor: boolean;
  isExempt: boolean;
  shareCentavos: number;
  percentage: number;
  isPaid: boolean;
  paidDate?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  note?: string;
  isCurrentUser?: boolean;
}

export interface ExpenseItem {
  id: string;
  householdId?: string;
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
  recordedBy: string;
  groupPayorsSummary: string;
  payorCount: number;
  myShareCents: number;
  myShareFormatted: string;
  isCurrentUserPayor: boolean;
  splitMethod: string;
  cycle: string;
  billingCycleId?: string;
  status?: "UNPAID" | "PAID";
  isPaid?: boolean;
  receiptUrl?: string;
  notes?: string;
  splitDetails?: any[];
  payorBreakdown?: ExpensePayorBreakdownItem[];
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
  const { isDark, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<"chronological" | "by_category">(
    "chronological",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [rawExpenses, setRawExpenses] = useState<MobileExpense[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<MobilePayment[]>([]);
  const [memberBills, setMemberBills] = useState<any[]>([]);
  const [waterConfig, setWaterConfig] = useState<any>(null);
  const [household, setHousehold] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [householdId, setHouseholdId] = useState<string | null>(
    () => mobileDataService.getCachedProfile()?.householdId || null,
  );

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
    else if (!householdId) setLoading(true);

    try {
      const profile = await mobileDataService.getUserProfile(currentUser.uid);
      const hid = profile?.householdId;
      if (hid) {
        setHouseholdId(hid);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.warn("[ExpenseHistoryScreen] load profile error:", err);
      setLoading(false);
    } finally {
      if (isManualRefresh) setRefreshing(false);
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
    const ready = {
      expenses: false,
      members: false,
      cycles: false,
    };
    const checkReady = () => {
      if (ready.expenses && ready.members && ready.cycles) {
        setLoading(false);
      }
    };
    const safetyTimer = setTimeout(() => setLoading(false), 2000);

    const unsubHousehold = mobileDataService.listenToHousehold(
      householdId,
      (hh) => setHousehold(hh),
    );
    const unsubExpenses = mobileDataService.listenToExpenses(
      householdId,
      (data: MobileExpense[]) => {
        setRawExpenses(data || []);
        ready.expenses = true;
        checkReady();
      },
    );
    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      householdId,
      (data: any[]) => {
        setMembers(data || []);
        ready.members = true;
        checkReady();
      },
    );
    const unsubCycles = mobileDataService.listenToBillingCycles(
      householdId,
      (data: any[]) => {
        setCycles(data || []);
        ready.cycles = true;
        checkReady();
      },
    );
    const unsubPayments = mobileDataService.listenToPayments(
      householdId,
      (data: MobilePayment[]) => {
        setPayments(data || []);
      },
    );
    const unsubWater = mobileDataService.listenToWaterConfig(
      householdId,
      (cfg: any) => {
        setWaterConfig(cfg);
      },
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubHousehold();
      unsubExpenses();
      unsubMembers();
      unsubCycles();
      unsubPayments();
      unsubWater();
    };
  }, [householdId]);

  const activeCycle = useMemo(() => {
    return cycles.find((c) => c.status === "ACTIVE") || cycles[0] || null;
  }, [cycles]);

  const oldestCycleId = useMemo(() => {
    return cycles.length > 0
      ? cycles[cycles.length - 1]?.billingCycleId
      : undefined;
  }, [cycles]);

  useEffect(() => {
    if (!householdId) {
      setMemberBills([]);
      return;
    }
    return mobileDataService.listenToMemberBills(householdId, setMemberBills);
  }, [householdId]);

  useEffect(() => {
    if (!householdId || cycles.length === 0) return;
    mobileDataService
      .reconcileStaleArrearsAndSettledCycles(householdId)
      .catch(() => {});
  }, [householdId, cycles.length, payments.length]);

  const activeMembersList = useMemo(() => {
    return members.filter(
      (m) => !m.status || m.status === "ACTIVE" || m.status === "SETTLED",
    );
  }, [members]);

  const activePayorsList = useMemo(() => {
    return activeMembersList.filter((m) => isPayorMember(m));
  }, [activeMembersList]);

  const isCurrentUserPayor = useMemo(() => {
    const me = activeMembersList.find((m) => m.userId === currentUser?.uid);
    return me ? isPayorMember(me) : true;
  }, [activeMembersList, currentUser?.uid]);

  const payorCount = useMemo(() => {
    return Math.max(
      1,
      activePayorsList.length > 0
        ? activePayorsList.length
        : activeMembersList.length,
    );
  }, [activePayorsList.length, activeMembersList.length]);

  const activeCycleExpenses = useMemo(() => {
    if (!activeCycle?.billingCycleId) return rawExpenses;
    return rawExpenses.filter(
      (e) =>
        e.billingCycleId === activeCycle.billingCycleId ||
        (!e.billingCycleId &&
          (cycles.length <= 1 || activeCycle.billingCycleId === oldestCycleId)),
    );
  }, [rawExpenses, activeCycle?.billingCycleId, cycles.length, oldestCycleId]);

  const cycleSettlement = useMemo(() => {
    return evaluateHouseholdCycleSettlements({
      cycles,
      expenses: rawExpenses,
      payments,
      allMemberBills: memberBills,
      members: activeMembersList,
    });
  }, [cycles, rawExpenses, payments, memberBills, activeMembersList]);

  const allPayorsSettledForActiveCycle = useMemo(() => {
    if (!activeCycle?.billingCycleId) return false;
    return Boolean(
      cycleSettlement.allPayorsSettledByCycle.get(activeCycle.billingCycleId),
    );
  }, [cycleSettlement, activeCycle?.billingCycleId]);

  // Build strictly PAID / SETTLED expenses with full group payor attribution & breakdown
  const paidExpenses: ExpenseItem[] = useMemo(() => {
    const hhTitle =
      household?.householdName || household?.name || "My Household";
    const isSingleCycle = cycles.length <= 1;

    const settledList: ExpenseItem[] = [];

    rawExpenses.forEach((exp) => {
      const belongsToActiveCycle =
        !activeCycle?.billingCycleId ||
        exp.billingCycleId === activeCycle.billingCycleId ||
        (!exp.billingCycleId &&
          (isSingleCycle || activeCycle.billingCycleId === oldestCycleId));

      const resolvedExpCycleId =
        exp.billingCycleId && exp.billingCycleId !== "general"
          ? exp.billingCycleId
          : oldestCycleId || activeCycle?.billingCycleId || "general";

      const isExpCycleAllSettled = Boolean(
        cycleSettlement.allPayorsSettledByCycle.get(resolvedExpCycleId),
      );

      const allSplitsPaid =
        Array.isArray(exp.splitDetails) &&
        exp.splitDetails.length > 0 &&
        exp.splitDetails.every((s: any) => s.isExempt || s.isPaid);

      const isPaid =
        exp.status === "PAID" ||
        exp.isPaid === true ||
        allSplitsPaid ||
        isExpCycleAllSettled ||
        (belongsToActiveCycle && allPayorsSettledForActiveCycle);

      // Strictly include PAID bills only in Bill History
      if (!isPaid) return;

      const meta = getCategoryMeta(exp.category);
      const rawSplits = Array.isArray(exp.splitDetails) ? exp.splitDetails : [];

      // Resolve cycle display label
      const matchedCycle = cycles.find(
        (c) => c.billingCycleId === exp.billingCycleId,
      );
      const cycleLabel =
        matchedCycle?.name ||
        activeCycle?.name ||
        (exp.billingCycleId && !exp.billingCycleId.startsWith("bc_")
          ? exp.billingCycleId
          : "Settled Cycle");

      // Build complete per-member breakdown using real household members + splitDetails + payments
      const breakdown: ExpensePayorBreakdownItem[] = [];
      const sourceMembers =
        activeMembersList.length > 0
          ? activeMembersList
          : rawSplits.map((s: any) => ({
              userId: s.userId,
              memberId: s.userId,
              displayName: s.displayName || "Roommate",
              role: s.role || (s.isExempt ? "NON_PAYOR" : "PAYOR"),
              isExempt: s.isExempt,
            }));

      const effPayors = sourceMembers.filter((m: any) => isPayorMember(m));
      const effectivePayorList =
        effPayors.length > 0 ? effPayors : sourceMembers;
      const effPayorCount = Math.max(1, effectivePayorList.length);

      const isWater = (exp.category || exp.title || "")
        .toLowerCase()
        .includes("water");
      const populatedPayorSplits = rawSplits.filter((s: any) => !s.isExempt);
      const rawSplitsSum = populatedPayorSplits.reduce(
        (acc: number, s: any) => acc + (Number(s.shareCentavos) || 0),
        0,
      );
      const hasPopulatedSplits = populatedPayorSplits.some(
        (s: any) => Number(s.shareCentavos) > 0,
      );
      const isSavedSplitExact =
        isWater ||
        (populatedPayorSplits.length === effPayorCount &&
          rawSplitsSum === (exp.amountCents || 0));

      sourceMembers.forEach((m: any) => {
        const uid = m.userId || m.memberId || m.id;
        const isPayor = isPayorMember(m);
        const splitEntry: any = rawSplits.find((s: any) =>
          matchesMemberUid(m, s.userId || s.memberId || s.id),
        );
        const isExempt = !isPayor || Boolean(splitEntry?.isExempt);

        const shareCentavos = isExempt
          ? 0
          : isSavedSplitExact &&
              splitEntry &&
              typeof splitEntry.shareCentavos === "number" &&
              (splitEntry.shareCentavos > 0 || hasPopulatedSplits)
            ? splitEntry.shareCentavos
            : computeFairSplitShareCentavos(
                exp.amountCents || 0,
                effectivePayorList,
                uid,
              );

        const percentage = isExempt
          ? 0
          : exp.amountCents > 0
            ? Math.round((shareCentavos / exp.amountCents) * 1000) / 10
            : Math.round((100 / effPayorCount) * 10) / 10;

        // Match verified payment from this payor for this cycle (including cross-cycle rollover payments)
        const matchedPayment =
          cycleSettlement.getMatchedPaymentForExpense(exp, m) ||
          payments.find((pmt) => {
            if (!matchesMemberUid(m, pmt.userId) || pmt.status === "REJECTED") {
              return false;
            }
            if (
              splitEntry?.paymentId &&
              pmt.paymentId === splitEntry.paymentId
            ) {
              return true;
            }
            if (
              Array.isArray(pmt.breakdownItems) &&
              pmt.breakdownItems.some(
                (bi) =>
                  bi.id === exp.id ||
                  (exp.billingCycleId && bi.cycleId === exp.billingCycleId),
              )
            ) {
              return true;
            }
            if (!exp.billingCycleId) return true;
            return (
              pmt.billingCycleId === exp.billingCycleId ||
              ((!pmt.billingCycleId || pmt.billingCycleId === "general") &&
                isSingleCycle)
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

        const defaultNote = isExempt
          ? "Exempted (Non-payor)"
          : `Fair share across ${effPayorCount} ${effPayorCount === 1 ? "payor" : "payors"} (${percentage}%)`;

        const isRolloverSettlement = Boolean(
          !isExempt &&
          matchedPayment?.billingCycleId &&
          exp.billingCycleId &&
          matchedPayment.billingCycleId !== "general" &&
          matchedPayment.billingCycleId !== exp.billingCycleId,
        );
        const rolloverCycleLabel = isRolloverSettlement
          ? cycles.find(
              (c) => c.billingCycleId === matchedPayment?.billingCycleId,
            )?.name ||
            matchedPayment?.billingCycleName ||
            "subsequent cycle"
          : "";
        const baseNote = splitEntry?.note || defaultNote;
        const resolvedNote =
          isRolloverSettlement && rolloverCycleLabel
            ? `${baseNote} · Settled with ${rolloverCycleLabel}`
            : baseNote;

        breakdown.push({
          userId: uid,
          displayName: memberName,
          role: roleType,
          roleLabel,
          isPayor: !isExempt,
          isExempt,
          shareCentavos,
          percentage,
          isPaid: true,
          paidDate:
            matchedPayment?.paymentDate ||
            (splitEntry?.paidDate
              ? String(splitEntry.paidDate).slice(0, 10)
              : exp.date),
          paymentMethod: matchedPayment?.paymentMethod || undefined,
          referenceNumber: matchedPayment?.referenceNumber || undefined,
          note: resolvedNote,
          isCurrentUser: Boolean(
            currentUser?.uid && matchesMemberUid(m, currentUser.uid),
          ),
        });
      });

      // Sort breakdown: current user first, then payors, then non-payors
      breakdown.sort((a, b) => {
        if (a.isCurrentUser && !b.isCurrentUser) return -1;
        if (!a.isCurrentUser && b.isCurrentUser) return 1;
        if (a.isPayor && !b.isPayor) return -1;
        if (!a.isPayor && b.isPayor) return 1;
        return a.displayName.localeCompare(b.displayName);
      });

      const contributingPayors = breakdown.filter((b) => b.isPayor);
      const payorFirstNames = contributingPayors.map(
        (p) => p.displayName.split(" ")[0] || p.displayName,
      );

      let groupPayorsSummary = "Group Payors";
      if (payorFirstNames.length === 1) {
        groupPayorsSummary = `${payorFirstNames[0]} (Group Payor)`;
      } else if (payorFirstNames.length === 2) {
        groupPayorsSummary = `${payorFirstNames[0]} & ${payorFirstNames[1]}`;
      } else if (payorFirstNames.length > 2) {
        groupPayorsSummary = `${payorFirstNames.slice(0, 2).join(", ")} +${payorFirstNames.length - 2} more`;
      }

      const myEntry = breakdown.find((b) => b.isCurrentUser);
      const myShareCents = myEntry
        ? myEntry.shareCentavos
        : isCurrentUserPayor
          ? computeFairSplitShareCentavos(
              exp.amountCents || 0,
              effectivePayorList,
              currentUser?.uid,
            )
          : 0;

      const recordedBy =
        exp.payerName &&
        exp.payerName !== "system" &&
        exp.payerName !== "Household"
          ? exp.payerName
          : household?.hostName || "Host";

      settledList.push({
        id: exp.id,
        householdId: exp.householdId || householdId || undefined,
        title: cleanBillTitle(exp.title, exp.category, hhTitle),
        category: meta.id.toLowerCase(),
        categoryLabel: exp.category || meta.name,
        icon: meta.featherIcon,
        emoji: meta.emoji,
        categoryColor: meta.color,
        categoryBgColor: meta.bgColor,
        amountCents: exp.amountCents,
        date: exp.date,
        payer: groupPayorsSummary,
        recordedBy,
        groupPayorsSummary,
        payorCount: contributingPayors.length || effPayorCount,
        myShareCents,
        myShareFormatted: formatPesos(myShareCents),
        isCurrentUserPayor: myEntry ? myEntry.isPayor : isCurrentUserPayor,
        splitMethod: exp.splitMethod || "Equal Split",
        cycle: cycleLabel,
        billingCycleId: exp.billingCycleId,
        status: "PAID",
        isPaid: true,
        receiptUrl: exp.receiptUrl,
        notes: exp.notes,
        splitDetails: exp.splitDetails,
        payorBreakdown: breakdown,
      });
    });

    settledList.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return settledList;
  }, [
    rawExpenses,
    cycles,
    activeCycle,
    oldestCycleId,
    cycleSettlement,
    allPayorsSettledForActiveCycle,
    activeMembersList,
    payments,
    household,
    householdId,
    currentUser?.uid,
    isCurrentUserPayor,
    waterConfig,
  ]);

  const handleRefresh = () => {
    loadData(true);
  };

  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return paidExpenses;
    const q = searchQuery.toLowerCase().trim();
    return paidExpenses.filter((item) => {
      const matchesPayorName = item.payorBreakdown?.some((p) =>
        p.displayName.toLowerCase().includes(q),
      );
      return (
        item.title.toLowerCase().includes(q) ||
        item.groupPayorsSummary.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        item.cycle.toLowerCase().includes(q) ||
        Boolean(matchesPayorName)
      );
    });
  }, [paidExpenses, searchQuery]);

  const totalSettledCents = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + item.amountCents, 0);
  }, [filteredExpenses]);

  const myTotalPaidShareCents = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + item.myShareCents, 0);
  }, [filteredExpenses]);

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
      return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const renderCategoryIcon = (iconName: string, item?: ExpenseItem) => {
    const meta = getCategoryMeta(item?.categoryLabel || iconName);
    return (
      <Feather
        name={meta.featherIcon as any}
        size={20}
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

  const renderPaidBillCard = (item: ExpenseItem, keyPrefix = "") => {
    const contributingPayors =
      item.payorBreakdown?.filter((b) => b.isPayor) || [];

    return (
      <TouchableOpacity
        key={`${keyPrefix}${item.id}`}
        style={[
          styles.expenseItemCard,
          isDark && {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        onPress={() =>
          onSelectExpense({ ...item, icon: item.emoji || item.icon })
        }
        activeOpacity={0.85}
      >
        {/* Left Icon Container aligned flex-start with middle contents */}
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : item.categoryBgColor || "#F1F5F9",
            },
          ]}
        >
          {renderCategoryIcon(item.icon, item)}
        </View>

        {/* Middle Title, True Group Payors & Per-Payor Share Breakdown */}
        <View style={styles.itemInfo}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.itemTitle, isDark && { color: colors.text }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <View
              style={[
                styles.paidBadge,
                isDark && {
                  backgroundColor: "rgba(16, 185, 129, 0.16)",
                  borderColor: "rgba(16, 185, 129, 0.35)",
                },
              ]}
            >
              <Text
                style={[styles.paidBadgeText, isDark && { color: "#34D399" }]}
              >
                PAID
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.itemSubtitle,
              isDark && { color: colors.textSecondary },
            ]}
          >
            {formatExpenseDate(item.date)} · Paid by {item.groupPayorsSummary}
          </Text>

          <Text
            style={[
              styles.shareHighlightText,
              isDark && { color: colors.accent },
            ]}
          >
            {item.isCurrentUserPayor
              ? `Split across ${item.payorCount} ${item.payorCount === 1 ? "payor" : "payors"} · Your share: ${item.myShareFormatted}`
              : `Exempt (Non-payor) · Paid by ${item.payorCount} group ${item.payorCount === 1 ? "payor" : "payors"}`}
          </Text>

          {/* Compact Per-Payor Breakdown Chips */}
          {contributingPayors.length > 0 && (
            <View style={styles.payorChipsWrap}>
              {contributingPayors.map((payor) => (
                <View
                  key={`${item.id}_${payor.userId}`}
                  style={[
                    styles.payorChip,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                    },
                    payor.isCurrentUser &&
                      (isDark
                        ? {
                            backgroundColor: "rgba(59, 130, 246, 0.14)",
                            borderColor: "rgba(59, 130, 246, 0.35)",
                          }
                        : {
                            backgroundColor: "#EFF6FF",
                            borderColor: "#BFDBFE",
                          }),
                  ]}
                >
                  <Feather
                    name="check-circle"
                    size={10}
                    color={isDark ? "#34D399" : "#16A34A"}
                  />
                  <Text
                    style={[
                      styles.payorChipText,
                      isDark && { color: colors.textSecondary },
                      payor.isCurrentUser && {
                        color: isDark ? "#60A5FA" : "#1D4ED8",
                        fontWeight: "700",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {payor.displayName.split(" ")[0]}:{" "}
                    {formatPesos(payor.shareCentavos)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Right Amount & Breakdown Hint centered with middle contents */}
        <View style={styles.rightAmountWrap}>
          <Text style={[styles.itemAmount, isDark && { color: colors.text }]}>
            {formatPesos(item.amountCents)}
          </Text>
          <View style={styles.breakdownHintRow}>
            <Text
              style={[styles.breakdownHintText, isDark && { color: "#34D399" }]}
            >
              Breakdown
            </Text>
            <Feather
              name="chevron-right"
              size={12}
              color={isDark ? "#34D399" : "#16A34A"}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        isDark && { backgroundColor: colors.background },
        { paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent={true}
        backgroundColor="transparent"
      />

      {/* Top Header */}
      <View
        style={[
          styles.navBarContainer,
          { paddingTop: topInset },
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <View style={styles.navBar}>
          <TouchableOpacity
            style={[
              styles.circleBackBtn,
              isDark && {
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
            onPress={() => (onBack ? onBack() : null)}
            activeOpacity={0.7}
          >
            <Feather
              name="chevron-left"
              size={24}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Text style={[styles.navTitle, isDark && { color: colors.text }]}>
              Paid Bill History
            </Text>
            {/* <Text
              style={[
                styles.navSubtitle,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Settled household bills & payor breakdowns
            </Text> */}
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[
                styles.iconNavBtn,
                isDark && {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setShowSearch(!showSearch)}
              activeOpacity={0.7}
            >
              <Feather
                name="search"
                size={20}
                color={isDark ? colors.text : "#0F172A"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.iconNavBtn,
                isDark && {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleRefresh}
              activeOpacity={0.7}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Feather
                  name="rotate-cw"
                  size={20}
                  color={isDark ? colors.text : "#0F172A"}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Expandable Search Input */}
      {showSearch && (
        <View
          style={[
            styles.searchBarContainer,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather
            name="search"
            size={16}
            color={isDark ? colors.textSecondary : "#64748B"}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={[styles.searchInput, isDark && { color: colors.text }]}
            placeholder="Search paid bills, group payors, or category..."
            placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather
                name="x"
                size={16}
                color={isDark ? colors.textSecondary : "#64748B"}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Segmented Tab Switcher */}
      <View
        style={[
          styles.tabContainer,
          isDark && {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          },
        ]}
      >
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
              isDark && { color: colors.textSecondary },
              activeTab === "chronological" && styles.tabBtnTextActive,
            ]}
          >
            Chronological ({filteredExpenses.length})
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
              isDark && { color: colors.textSecondary },
              activeTab === "by_category" && styles.tabBtnTextActive,
            ]}
          >
            By Category ({Object.keys(categorizedExpenses).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      {loading ? (
        <UniversalSkeleton type="history" />
      ) : paidExpenses.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.emptyCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIconCircle,
                isDark && { backgroundColor: colors.surfaceInset },
              ]}
            >
              <Ionicons
                name="checkmark-done-circle-outline"
                size={34}
                color={isDark ? colors.text : "#0F172A"}
              />
            </View>
            <Text style={[styles.emptyTitle, isDark && { color: colors.text }]}>
              No Paid Bills Yet
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Only completed, settled household bills appear in Bill History.
              Once your group payors settle the active cycle's upcoming bills,
              they will be archived here with full per-payor breakdowns.
            </Text>
          </View>
        </ScrollView>
      ) : filteredExpenses.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text
            style={[styles.emptySearchTitle, isDark && { color: colors.text }]}
          >
            No matching paid bills
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              isDark && { color: colors.textSecondary },
            ]}
          >
            No settled bills matched "{searchQuery}". Try searching another bill
            name or roommate.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(100, insets.bottom + 50) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="on-drag"
        >
          {/* Settled Summary Card */}
          <View
            style={[
              styles.summaryBanner,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.summaryTitleRow}>
                <Feather
                  name="check-circle"
                  size={14}
                  color={isDark ? "#34D399" : "#15803D"}
                />
                <Text
                  style={[styles.summaryLabel, isDark && { color: "#34D399" }]}
                >
                  SETTLED BILLS ARCHIVE ({filteredExpenses.length})
                </Text>
              </View>
              <Text
                style={[
                  styles.summaryTotalAmount,
                  isDark && { color: colors.text },
                ]}
              >
                {formatPesos(totalSettledCents)}
              </Text>
              <Text
                style={[
                  styles.summarySubtext,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                {isCurrentUserPayor
                  ? `Paid collectively by ${payorCount} group ${payorCount === 1 ? "payor" : "payors"} · Your total paid share: ${formatPesos(myTotalPaidShareCents)}`
                  : `Paid collectively by ${payorCount} group ${payorCount === 1 ? "payor" : "payors"} · You are exempt (Non-payor)`}
              </Text>
            </View>
          </View>

          {activeTab === "chronological" ? (
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text
                  style={[
                    styles.sectionHeader,
                    isDark && { color: colors.text },
                  ]}
                >
                  Settled Bills History
                </Text>
                <Text
                  style={[
                    styles.sectionSubCount,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Tap any bill for payor breakdown
                </Text>
              </View>

              {filteredExpenses.map((item) =>
                renderPaidBillCard(item, "chrono_"),
              )}
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
                const groupMyShareCents = groupItems.reduce(
                  (sum, e) => sum + e.myShareCents,
                  0,
                );

                return (
                  <View key={categoryName} style={styles.categoryBlock}>
                    <View style={styles.categoryHeaderRow}>
                      <View>
                        <Text
                          style={[
                            styles.sectionHeader,
                            { marginBottom: 2 },
                            isDark && { color: colors.text },
                          ]}
                        >
                          {categoryName} ({groupItems.length})
                        </Text>
                        {isCurrentUserPayor && (
                          <Text
                            style={[
                              styles.categoryShareSub,
                              isDark && { color: colors.textSecondary },
                            ]}
                          >
                            Your total share: {formatPesos(groupMyShareCents)}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.categoryTotalAmount,
                          isDark && { color: colors.accent },
                        ]}
                      >
                        {formatPesos(groupTotalCents)}
                      </Text>
                    </View>

                    {groupItems.map((item) =>
                      renderPaidBillCard(item, `cat_${categoryName}_`),
                    )}
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
    height: 58,
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
  navSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 1,
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
    borderRadius: 100,
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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 100,
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
  },
  tabBtnActive: {
    backgroundColor: "#2563EB",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 48,
  },
  summaryBanner: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#15803D",
    letterSpacing: 0.4,
  },
  summaryTotalAmount: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
  },
  summarySubtext: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionSubCount: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  categoryBlock: {
    marginBottom: 20,
  },
  categoryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  categoryShareSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  categoryTotalAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2563EB",
  },
  expenseItemCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  paidBadge: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  paidBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#15803D",
  },
  itemSubtitle: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  shareHighlightText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563EB",
    marginTop: 3,
  },
  payorChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 7,
  },
  payorChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  payorChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#334155",
  },
  rightAmountWrap: {
    alignItems: "flex-end",
    alignSelf: "center",
    justifyContent: "center",
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  breakdownHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 3,
  },
  breakdownHintText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#16A34A",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
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
    maxWidth: 330,
    backgroundColor: "#FFFFFF",
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
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
});
