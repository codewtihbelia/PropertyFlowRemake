import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  Alert,
  Modal,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { uploadToFirebaseStorageMobile } from "../services/firebaseStorageService";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  isPayorMember,
  computeCycleWaterBreakdown,
  computeFairSplitShareCentavos,
  matchesMemberUid,
} from "../services/firebaseDataService";
import { BILL_CATEGORIES, getCategoryMeta } from "../services/categoryService";
import { useTheme } from "../context/ThemeContext";

interface AddExpenseScreenProps {
  onBack: () => void;
  onSaveExpense: (expense: {
    title: string;
    amount: number;
    category: string;
    splitMethod: "Equal" | "% Custom";
    documentUrl?: string;
    description?: string;
    status?: "UNPAID" | "PAID";
    splitDetails?: Array<{
      userId: string;
      displayName: string;
      shareCentavos: number;
      percentage?: number;
      isExempt?: boolean;
      note?: string;
    }>;
  }) => void;
}

const AVATAR_COLORS = [
  "#F59E0B",
  "#8B5CF6",
  "#10B981",
  "#EC4899",
  "#3B82F6",
  "#06B6D4",
];

export const AddExpenseScreen: React.FC<AddExpenseScreenProps> = ({
  onBack,
  onSaveExpense,
}) => {
  const { isDark, colors } = useTheme();
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("Rent");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    Platform.OS === "ios" ? 44 : 20,
  );
  const [otherCategorySpecified, setOtherCategorySpecified] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [splitMethod, setSplitMethod] = useState<"Equal" | "% Custom">("Equal");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [profile, setProfile] = useState<any | null>(null);
  const [household, setHousehold] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | undefined>(
    undefined,
  );
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [electricityConfig, setElectricityConfig] = useState<any | null>(null);
  const [elecPrevReading, setElecPrevReading] = useState<string>("0");
  const [elecCurrReading, setElecCurrReading] = useState<string>("0");
  const [elecRatePerKwh, setElecRatePerKwh] = useState<string>("12.00");
  const [hasLoadedElecDefaults, setHasLoadedElecDefaults] = useState(false);
  const [cycleAttendance, setCycleAttendance] = useState<any[]>([]);
  const [attendanceSubmissions, setAttendanceSubmissions] = useState<
    Record<string, any>
  >({});

  // Custom split percentages state
  const [customSplits, setCustomSplits] = useState<Record<string, number>>({});

  const activeCategoryMeta = useMemo(() => {
    return (
      BILL_CATEGORIES.find((c) => c.id === selectedCategoryId) ||
      BILL_CATEGORIES[0]
    );
  }, [selectedCategoryId]);

  const finalCategory = useMemo(() => {
    if (selectedCategoryId === "Others") {
      return otherCategorySpecified.trim();
    }
    return selectedCategoryId;
  }, [selectedCategoryId, otherCategorySpecified]);

  const isWaterCategory = useMemo(() => {
    return (
      selectedCategoryId === "Water" ||
      finalCategory.toLowerCase().includes("water")
    );
  }, [selectedCategoryId, finalCategory]);

  const isElectricityCategory = useMemo(() => {
    return (
      selectedCategoryId === "Electricity" ||
      finalCategory.toLowerCase() === "electricity"
    );
  }, [selectedCategoryId, finalCategory]);

  const parsedElecPrev = useMemo(() => {
    const n = parseFloat(elecPrevReading.replace(/[^0-9.]/g, ""));
    return isNaN(n) || n < 0 ? 0 : n;
  }, [elecPrevReading]);

  const parsedElecCurr = useMemo(() => {
    const n = parseFloat(elecCurrReading.replace(/[^0-9.]/g, ""));
    return isNaN(n) || n < 0 ? 0 : n;
  }, [elecCurrReading]);

  const parsedElecRate = useMemo(() => {
    const n = parseFloat(elecRatePerKwh.replace(/[^0-9.]/g, ""));
    return isNaN(n) || n < 0 ? 0 : n;
  }, [elecRatePerKwh]);

  const isElecReadingInvalid =
    elecCurrReading.trim().length > 0 &&
    elecPrevReading.trim().length > 0 &&
    parsedElecCurr < parsedElecPrev;

  const consumedKwh = useMemo(() => {
    if (parsedElecCurr < parsedElecPrev) return 0;
    return Math.round((parsedElecCurr - parsedElecPrev) * 100) / 100;
  }, [parsedElecPrev, parsedElecCurr]);

  const computedElecPesos = useMemo(() => {
    return Math.round(consumedKwh * parsedElecRate * 100) / 100;
  }, [consumedKwh, parsedElecRate]);

  const updateAmountFromElectricity = (
    nextPrevStr: string,
    nextCurrStr: string,
    nextRateStr: string,
  ) => {
    const p = Math.max(0, parseFloat(nextPrevStr.replace(/[^0-9.]/g, "")) || 0);
    const c = Math.max(0, parseFloat(nextCurrStr.replace(/[^0-9.]/g, "")) || 0);
    const r = Math.max(0, parseFloat(nextRateStr.replace(/[^0-9.]/g, "")) || 0);
    if (c >= p && r > 0) {
      const kwh = Math.round((c - p) * 100) / 100;
      const total = Math.round(kwh * r * 100) / 100;
      setAmount(total > 0 ? `₱${total.toFixed(2)}` : "");
    }
  };

  const currentUser = auth.currentUser;

  useEffect(() => {
    let mounted = true;
    if (!currentUser?.uid) return;

    mobileDataService.getUserProfile(currentUser.uid).then((nextProfile) => {
      if (mounted && nextProfile) {
        setProfile(nextProfile);
        const hhId = nextProfile.householdId;
        if (hhId) {
          mobileDataService.listenToHousehold(hhId, (hh) => {
            if (mounted) setHousehold(hh);
          });
          mobileDataService.listenToHouseholdMembers(hhId, (mems) => {
            if (mounted) setMembers(mems);
          });
          mobileDataService.listenToExpenses(hhId, (exps) => {
            if (mounted) setExpenses(exps);
          });
          mobileDataService.listenToBillingCycles(hhId, (cycles) => {
            if (mounted) {
              const active =
                cycles.find((c) => c.status === "ACTIVE") || cycles[0];
              if (active) setActiveCycleId(active.billingCycleId);
            }
          });
          mobileDataService.listenToWaterConfig(hhId, (cfg) => {
            if (mounted) setWaterConfig(cfg);
          });
          mobileDataService.listenToElectricityConfig(hhId, (cfg) => {
            if (mounted && cfg) {
              setElectricityConfig(cfg);
              setHasLoadedElecDefaults((already) => {
                if (!already) {
                  const prev = Number(
                    cfg.lastCurrentReadingKwh ??
                      cfg.currentReadingKwh ??
                      cfg.previousReadingKwh ??
                      0,
                  );
                  const curr = prev;
                  const rate = Number(cfg.rateCentavosPerKwh ?? 1200) / 100;
                  setElecPrevReading(String(prev));
                  setElecCurrReading(String(curr));
                  setElecRatePerKwh(rate.toFixed(2));
                }
                return true;
              });
            }
          });
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    const hhId = profile?.householdId || household?.householdId;
    if (!hhId || !activeCycleId) {
      setCycleAttendance([]);
      setAttendanceSubmissions({});
      return;
    }
    const unsubAtt = mobileDataService.listenToHouseholdCycleAttendance(
      hhId,
      activeCycleId,
      setCycleAttendance,
    );
    const unsubSub = mobileDataService.listenToAttendanceSubmissions(
      hhId,
      activeCycleId,
      setAttendanceSubmissions,
    );
    return () => {
      unsubAtt();
      unsubSub();
    };
  }, [profile?.householdId, household?.householdId, activeCycleId]);

  const getMemberDays = (targetUid: string): number => {
    const fromAtt = cycleAttendance.filter(
      (a) => a.userId === targetUid && a.status === "PRESENT",
    ).length;
    const fromSub = attendanceSubmissions[targetUid]?.daysPresent || 0;
    return fromAtt > 0 ? fromAtt : fromSub;
  };

  // Active approved roommates
  const activeMembers = useMemo(() => {
    const list = members.filter((m) => m.status === "ACTIVE");
    if (list.length > 0) return list;
    if (currentUser?.uid) {
      return [
        {
          userId: currentUser.uid,
          memberId: currentUser.uid,
          displayName:
            currentUser.displayName || profile?.displayName || "Host",
          role: "HOST",
          status: "ACTIVE",
          photoURL: currentUser.photoURL || profile?.profilePicture,
        },
      ];
    }
    return [];
  }, [members, currentUser, profile]);

  // Active payors and non-payors
  const activePayors = useMemo(() => {
    const list = activeMembers.filter((m) => isPayorMember(m));
    return list.length > 0 ? list : activeMembers;
  }, [activeMembers]);

  const activeNonPayors = useMemo(() => {
    return activeMembers.filter((m) => !isPayorMember(m));
  }, [activeMembers]);

  // Total bills of active household
  const totalBillsCents = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  }, [expenses]);

  const primaryGroupName =
    household?.householdName ||
    household?.apartmentName ||
    profile?.householdName ||
    "Apartment Roommate";
  const primaryTotalFormatted =
    totalBillsCents > 0
      ? `₱${(totalBillsCents / 100).toLocaleString()}`
      : "₱0.00";

  // Group definitions matching the screen revision
  const groupsList = useMemo(
    () => [
      {
        id: "primary",
        name: primaryGroupName,
        totalExpenses: primaryTotalFormatted,
        members:
          activeMembers.length > 0
            ? activeMembers
            : [
                { displayName: "JD", userId: "1", color: "#F59E0B" },
                { displayName: "EM", userId: "2", color: "#8B5CF6" },
                { displayName: "MK", userId: "3", color: "#10B981" },
              ],
        extraCount: Math.max(
          0,
          (activeMembers.length > 0 ? activeMembers.length : 7) - 3,
        ),
      },
      {
        id: "secondary",
        name: "Apartment Roommate",
        totalExpenses: "₱1,240.00",
        members: [
          { displayName: "AL", userId: "al", color: "#F43F5E" },
          { displayName: "CH", userId: "ch", color: "#06B6D4" },
          { displayName: "JH", userId: "jh", color: "#8B5CF6" },
        ],
        extraCount: 4,
      },
    ],
    [primaryGroupName, primaryTotalFormatted, activeMembers],
  );

  // Initialize custom splits for payors
  useEffect(() => {
    if (activePayors.length > 0) {
      const defaultPct = Math.round(100 / activePayors.length);
      const initialSplits: Record<string, number> = {};
      activePayors.forEach((m) => {
        initialSplits[m.userId || m.memberId] = defaultPct;
      });
      setCustomSplits(initialSplits);
    }
  }, [activePayors]);

  const handlePickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Denied",
          "Please grant photo library access to upload documents or receipts.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setImageBase64(result.assets[0].base64 || null);
      }
    } catch (err) {
      console.warn("Image picker error:", err);
    }
  };

  const handleSave = async () => {
    const isHost =
      profile?.role === "HOST" || profile?.hostApplicationStatus === "APPROVED";
    if (!isHost) {
      Alert.alert(
        "Host Permission Required",
        "Only household hosts can add expenses and record bills. Roommates can view charges and settle balances under Bills.",
      );
      return;
    }

    const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid expense amount.");
      return;
    }

    if (selectedCategoryId === "Others" && !otherCategorySpecified.trim()) {
      Alert.alert(
        "Specify Category",
        "Please specify what this 'Others' bill is for (e.g., Parking Fee, Pest Control, Aircon Cleaning).",
      );
      return;
    }

    if (isElectricityCategory && isElecReadingInvalid) {
      Alert.alert(
        "Invalid Meter Reading",
        "Current Reading (kWh) must be greater than or equal to Previous Reading (kWh).",
      );
      return;
    }

    setUploading(true);
    let documentUrl = "";
    let householdId = profile?.householdId || household?.householdId;

    if (!householdId && currentUser?.uid && isHost) {
      const ensured = await mobileDataService.ensureHostHousehold(
        currentUser.uid,
        profile,
      );
      if (ensured?.householdId) {
        householdId = ensured.householdId;
        setProfile(ensured);
      }
    }

    if (!currentUser?.uid || !householdId) {
      setUploading(false);
      Alert.alert(
        "Missing Cloud Setup",
        "Your account is not connected to a Firebase household yet.",
      );
      return;
    }

    if (imageUri) {
      documentUrl = await uploadToFirebaseStorageMobile(
        imageUri,
        `households/${householdId}/mobile_expenses`,
        imageBase64 || undefined,
      );
    }

    const amountCents = Math.round(numericAmount * 100);
    const selectedGroup = groupsList[selectedGroupIndex];
    const categoryToSave = finalCategory;

    // Compute splits fairly on payors only, with water non-payor absorption rule
    const isWater = isWaterCategory;
    const payorCount = Math.max(1, activePayors.length);
    const nonPayorCount = activeNonPayors.length;
    let splitDetails: Array<{
      userId: string;
      displayName: string;
      shareCentavos: number;
      percentage?: number;
      isExempt?: boolean;
      note?: string;
    }> = [];

    if (splitMethod === "Equal") {
      if (isWater) {
        // Water mode: payors pay their own water + water from non-payors (honoring custom/specific allocations)
        const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
        const { membersBreakdown } = computeCycleWaterBreakdown(
          activeMembers,
          cycleAttendance,
          attendanceSubmissions,
          rate,
        );

        splitDetails = membersBreakdown.map((item) => ({
          userId: item.userId,
          displayName: item.displayName,
          shareCentavos: item.shareCentavos,
          ownWaterCentavos: item.ownWaterCentavos,
          nonPayorWaterCentavos: item.nonPayorWaterCentavos,
          daysPresent: item.daysPresent,
          rateCentavosPerDay: item.rateCentavosPerDay,
          isExempt: item.isExempt,
          note: item.note,
        }));
      } else {
        // Standard bills: split strictly across payors only with exact centavo remainder allocation!
        const elecMeterSummary = isElectricityCategory
          ? `${consumedKwh} kWh (${parsedElecPrev} → ${parsedElecCurr} kWh) @ ₱${parsedElecRate.toFixed(2)}/kWh`
          : "";
        splitDetails = activeMembers.map((m) => {
          const uid = m.userId || m.memberId || m.id || "";
          const isPayor = isPayorMember(m);
          if (isPayor) {
            const shareCentavos = computeFairSplitShareCentavos(
              amountCents,
              activePayors,
              uid,
            );
            return {
              userId: uid,
              displayName: m.displayName || "Roommate",
              shareCentavos,
              percentage: Math.round((100 / payorCount) * 10) / 10,
              isExempt: false,
              note: isElectricityCategory
                ? `${elecMeterSummary} · Split among ${payorCount} payors`
                : `Fair share among ${payorCount} payors (Non-payors exempt)`,
            };
          } else {
            return {
              userId: uid,
              displayName: m.displayName || "Roommate",
              shareCentavos: 0,
              percentage: 0,
              isExempt: true,
              note: "Exempted (Non-payor)",
            };
          }
        });
      }
    } else {
      // Custom split: allocate to payors
      splitDetails = activeMembers.map((m) => {
        const uid = m.userId || m.memberId;
        const isPayor = isPayorMember(m);
        if (isPayor) {
          const pct = customSplits[uid] || Math.round(100 / payorCount);
          const shareCentavos = Math.round((amountCents * pct) / 100);
          return {
            userId: uid,
            displayName: m.displayName || "Roommate",
            shareCentavos,
            percentage: pct,
            isExempt: false,
            note: `Custom share (${pct}%)`,
          };
        } else {
          return {
            userId: uid,
            displayName: m.displayName || "Roommate",
            shareCentavos: 0,
            percentage: 0,
            isExempt: true,
            note: "Exempted (Non-payor)",
          };
        }
      });
    }

    const expensePayload: any = {
      householdId,
      title: categoryToSave,
      category: categoryToSave,
      amountCents,
      date: new Date().toISOString().slice(0, 10),
      payerName: currentUser.displayName || profile?.displayName || "Host",
      payerId: currentUser.uid,
      recordedBy: currentUser.displayName || profile?.displayName || "Host",
      status: "UNPAID",
      isPaid: false,
      splitMethod,
      splitDetails,
    };

    if (activeCycleId) {
      expensePayload.billingCycleId = activeCycleId;
    }
    if (documentUrl && documentUrl.trim().length > 0) {
      expensePayload.receiptUrl = documentUrl.trim();
    }
    if (isElectricityCategory) {
      const rateCentavosPerKwh = Math.round(parsedElecRate * 100);
      const meterNote = `Prev: ${parsedElecPrev} kWh → Curr: ${parsedElecCurr} kWh (${consumedKwh} kWh × ₱${parsedElecRate.toFixed(2)}/kWh)`;
      expensePayload.previousReadingKwh = parsedElecPrev;
      expensePayload.currentReadingKwh = parsedElecCurr;
      expensePayload.consumedKwh = consumedKwh;
      expensePayload.rateCentavosPerKwh = rateCentavosPerKwh;
      expensePayload.notes =
        description && description.trim().length > 0
          ? `${meterNote} • ${description.trim()}`
          : meterNote;
      await mobileDataService.saveElectricityConfig(
        householdId,
        {
          previousReadingKwh: parsedElecPrev,
          currentReadingKwh: parsedElecCurr,
          rateCentavosPerKwh,
          consumedKwh,
          totalAmountCentavos: amountCents,
          billingCycleId: activeCycleId || "",
        },
        {
          billingCycleId: activeCycleId || "",
          skipExpenseSync: true,
        },
      );
    } else if (description && description.trim().length > 0) {
      expensePayload.notes = description.trim();
    }

    await mobileDataService.addExpense(expensePayload);

    setUploading(false);

    onSaveExpense({
      title: categoryToSave,
      amount: numericAmount,
      category: categoryToSave,
      splitMethod,
      documentUrl: documentUrl || undefined,
      description: description || undefined,
      status: "UNPAID",
      splitDetails,
    });

    const firstPayorShare =
      splitDetails.find((s) => !s.isExempt)?.shareCentavos || 0;
    const perMemberText = `₱${(firstPayorShare / 100).toFixed(2)}`;

    Alert.alert(
      "Bill Added",
      `₱${numericAmount.toFixed(2)} bill recorded for ${selectedGroup.name} and automatically split fairly among ${payorCount} payors (${nonPayorCount} non-payors exempted). It is now live in Bills & Dues.`,
    );
    onBack();
  };

  const isHost = profile
    ? profile.role === "HOST" || profile.hostApplicationStatus === "APPROVED"
    : true;

  return (
    <View
      style={[
        styles.container,
        isDark && { backgroundColor: colors.background },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent={true}
        backgroundColor="transparent"
      />
      {/* Header matching screen.png */}
      <View
        style={[
          styles.header,
          { paddingTop: topInset + 6 },
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backBtn,
            isDark && { backgroundColor: "rgba(255, 255, 255, 0.08)" },
          ]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Feather
            name="chevron-left"
            size={24}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && { color: colors.text }]}>
          Add Bill
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(80, insets.bottom + 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {profile && !isHost && (
            <View
              style={[
                styles.permissionBanner,
                isDark && {
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  borderColor: "rgba(239, 68, 68, 0.25)",
                },
              ]}
            >
              <Text
                style={[styles.permissionTitle, isDark && { color: "#FCA5A5" }]}
              >
                Host Permission Required
              </Text>
              <Text
                style={[styles.permissionText, isDark && { color: "#F87171" }]}
              >
                You are signed in as a resident. Only household hosts can record
                bills. Roommates can review charges and settle their share in
                the Bills tab.
              </Text>
            </View>
          )}

          {/* Group Cards Horizontal Carousel matching screen.png */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.groupsCarousel}
            contentContainerStyle={{ paddingRight: 16, gap: 14 }}
          >
            {groupsList.map((grp, idx) => {
              const isSelected = selectedGroupIndex === idx;

              return (
                <TouchableOpacity
                  key={grp.id}
                  style={[
                    styles.groupCard,
                    isSelected
                      ? styles.groupCardSelected
                      : [
                          styles.groupCardUnselected,
                          isDark && {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ],
                  ]}
                  onPress={() => setSelectedGroupIndex(idx)}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.groupCardTitle,
                      isSelected
                        ? styles.textWhite
                        : [styles.textDark, isDark && { color: colors.text }],
                    ]}
                    numberOfLines={1}
                  >
                    {grp.name}
                  </Text>

                  <Text
                    style={[
                      styles.groupCardSub,
                      isSelected
                        ? styles.textWhiteSub
                        : [
                            styles.textMuted,
                            isDark && { color: colors.textSecondary },
                          ],
                    ]}
                  >
                    Total Bills: {grp.totalExpenses}
                  </Text>

                  {/* Overlapping member avatars matching screen.png */}
                  <View style={styles.avatarStackRow}>
                    {grp.members.slice(0, 3).map((m: any, mIdx: number) => {
                      const photo = m.profilePicture || m.photoURL;
                      const initials = (m.displayName || "M")
                        .slice(0, 2)
                        .toUpperCase();
                      const bgColor =
                        m.color || AVATAR_COLORS[mIdx % AVATAR_COLORS.length];

                      return photo ? (
                        <Image
                          key={m.userId || mIdx}
                          source={{ uri: photo }}
                          style={[
                            styles.avatarCircle,
                            isDark && {
                              borderColor: isSelected ? "#2563EB" : colors.card,
                            },
                            { marginLeft: mIdx === 0 ? 0 : -8 },
                          ]}
                        />
                      ) : (
                        <View
                          key={m.userId || mIdx}
                          style={[
                            styles.avatarCircle,
                            {
                              backgroundColor: bgColor,
                              marginLeft: mIdx === 0 ? 0 : -8,
                              borderColor: isDark
                                ? isSelected
                                  ? "#2563EB"
                                  : colors.card
                                : "#FFFFFF",
                            },
                          ]}
                        >
                          <Text style={styles.avatarInitials}>{initials}</Text>
                        </View>
                      );
                    })}

                    {grp.extraCount > 0 && (
                      <View
                        style={[
                          styles.avatarCircle,
                          styles.avatarBadgeExtra,
                          { marginLeft: -8 },
                          isSelected
                            ? {
                                backgroundColor: "#DBEAFE",
                                borderColor: isDark ? "#2563EB" : "#FFFFFF",
                              }
                            : isDark
                              ? {
                                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                                  borderColor: colors.card,
                                }
                              : { backgroundColor: "#E2E8F0" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarBadgeText,
                            isSelected
                              ? { color: "#1D4ED8" }
                              : isDark
                                ? { color: colors.textSecondary }
                                : { color: "#475569" },
                          ]}
                        >
                          +{grp.extraCount}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Add Bills Button inside Card matching screen.png */}
                  <TouchableOpacity
                    style={[
                      styles.cardActionBtn,
                      isSelected
                        ? styles.cardActionBtnSelected
                        : [
                            styles.cardActionBtnUnselected,
                            isDark && {
                              backgroundColor: "rgba(59, 130, 246, 0.15)",
                            },
                          ],
                    ]}
                    onPress={() => setSelectedGroupIndex(idx)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.cardActionBtnText,
                        !isSelected && isDark && { color: colors.primary },
                      ]}
                    >
                      Add Bills
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Category Field - Beautiful Dropdown Mode (Not in Modal) */}
          <View style={styles.categorySectionHeader}>
            <Text style={[styles.label, isDark && { color: colors.text }]}>
              Bill Category
            </Text>
            <View
              style={[
                styles.categoryCountPill,
                isDark && { backgroundColor: "rgba(255, 255, 255, 0.08)" },
              ]}
            >
              <Text
                style={[
                  styles.categoryCountPillText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                {BILL_CATEGORIES.length} Categories
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.dropdownSelector,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              isCategoryDropdownOpen &&
                (isDark
                  ? {
                      borderColor: colors.primary,
                      backgroundColor: "rgba(59, 130, 246, 0.1)",
                    }
                  : styles.dropdownSelectorActive),
            ]}
            onPress={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownLeftWrap}>
              <View
                style={[
                  styles.dropdownIconBadge,
                  { backgroundColor: activeCategoryMeta.bgColor },
                ]}
              >
                <Ionicons
                  name={activeCategoryMeta.ionicon as any}
                  size={18}
                  color={activeCategoryMeta.color}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text
                    style={[
                      styles.dropdownTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {selectedCategoryId === "Others" &&
                    otherCategorySpecified.trim()
                      ? `Others: ${otherCategorySpecified.trim()}`
                      : activeCategoryMeta.name}
                  </Text>
                  {selectedCategoryId === "Water" && (
                    <View
                      style={[
                        styles.waterMiniBadge,
                        isDark && { backgroundColor: "rgba(2, 132, 199, 0.2)" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.waterMiniBadgeText,
                          isDark && { color: "#38BDF8" },
                        ]}
                      >
                        ₱5/day
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.dropdownSubtitle,
                    isDark && { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {selectedCategoryId === "Others" &&
                  otherCategorySpecified.trim()
                    ? `Custom category specified: "${otherCategorySpecified.trim()}"`
                    : activeCategoryMeta.description}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.chevronBadge,
                isDark && { backgroundColor: "rgba(255, 255, 255, 0.08)" },
                isCategoryDropdownOpen &&
                  (isDark
                    ? { backgroundColor: "rgba(59, 130, 246, 0.2)" }
                    : styles.chevronBadgeActive),
              ]}
            >
              <Feather
                name={isCategoryDropdownOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={
                  isCategoryDropdownOpen
                    ? isDark
                      ? colors.primary
                      : "#2563EB"
                    : isDark
                      ? colors.textSecondary
                      : "#64748B"
                }
              />
            </View>
          </TouchableOpacity>

          {/* Inline Category Dropdown List (Expanded) */}
          {isCategoryDropdownOpen && (
            <View
              style={[
                styles.inlineDropdownList,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              {BILL_CATEGORIES.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.inlineDropdownItem,
                      isSelected &&
                        (isDark
                          ? {
                              backgroundColor: "rgba(59, 130, 246, 0.15)",
                              borderWidth: 1,
                              borderColor: "rgba(59, 130, 246, 0.35)",
                            }
                          : styles.inlineDropdownItemActive),
                    ]}
                    onPress={() => {
                      setSelectedCategoryId(cat.id);
                      setIsCategoryDropdownOpen(false);
                      if (cat.id === "Electricity") {
                        updateAmountFromElectricity(
                          elecPrevReading,
                          elecCurrReading,
                          elecRatePerKwh,
                        );
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.inlineCatIconWrap,
                        { backgroundColor: cat.bgColor },
                      ]}
                    >
                      <Ionicons
                        name={cat.ionicon as any}
                        size={16}
                        color={cat.color}
                      />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text
                          style={[
                            styles.inlineCatName,
                            isDark && { color: colors.text },
                            isSelected &&
                              (isDark
                                ? { color: colors.primary }
                                : styles.inlineCatNameActive),
                          ]}
                        >
                          {cat.name}
                        </Text>
                        {cat.id === "Water" && (
                          <View
                            style={[
                              styles.waterPillTag,
                              isDark && {
                                backgroundColor: "rgba(2, 132, 199, 0.2)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.waterPillTagText,
                                isDark && { color: "#38BDF8" },
                              ]}
                            >
                              Attendance Mode
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.inlineCatDesc,
                          isDark && { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {cat.description}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedCheckBadge}>
                        <Feather name="check" size={13} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.unselectedRadioCircle,
                          isDark && { borderColor: colors.border },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* If user selects "Others", prompt them to specify */}
          {selectedCategoryId === "Others" && (
            <View
              style={[
                styles.specifyCategoryCard,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.specifyCategoryHeader}>
                <View
                  style={[
                    styles.specifyIconWrap,
                    isDark && { backgroundColor: "rgba(255, 255, 255, 0.08)" },
                  ]}
                >
                  <Feather
                    name="edit-3"
                    size={15}
                    color={isDark ? colors.text : "#0F172A"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.specifyCategoryTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    Specify Category Name *
                  </Text>
                  <Text
                    style={[
                      styles.specifyCategorySub,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Please specify what this bill is for (e.g. Parking Fee, Pest
                    Control, Aircon Cleaning)
                  </Text>
                </View>
              </View>
              <TextInput
                style={[
                  styles.specifyCategoryInput,
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: "rgba(59, 130, 246, 0.4)",
                    color: colors.text,
                  },
                ]}
                placeholder="e.g., Parking Fee, Building Maintenance, Gym..."
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                value={otherCategorySpecified}
                onChangeText={setOtherCategorySpecified}
                maxLength={40}
                autoCapitalize="words"
              />
              <View style={styles.specifyCategoryFooter}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    flex: 1,
                  }}
                >
                  <Feather name="tag" size={12} color="#0284C7" />
                  <Text
                    style={[
                      styles.specifyCategoryTip,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    This custom category name will sync to all roommates' bill
                    lists.
                  </Text>
                </View>
                <Text
                  style={[
                    styles.charCountText,
                    isDark && { color: colors.textMuted },
                  ]}
                >
                  {otherCategorySpecified.length}/40
                </Text>
              </View>
            </View>
          )}

          {/* Water Mode Indicator if Category is Water */}
          {selectedCategoryId === "Water" && (
            <View
              style={[
                styles.waterInfoNotice,
                isDark && {
                  backgroundColor: "rgba(2, 132, 199, 0.12)",
                  borderColor: "rgba(2, 132, 199, 0.25)",
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <Feather name="droplet" size={15} color="#0284C7" />
                <Text
                  style={[
                    styles.waterInfoTitle,
                    isDark && { color: "#38BDF8" },
                  ]}
                >
                  Water Billing Mode: ₱5 / person / day
                </Text>
              </View>
              <Text
                style={[styles.waterInfoText, isDark && { color: "#BAE6FD" }]}
              >
                Non-payor members are exempted. Water consumption incurred by
                non-payor members is split fairly and reallocated across paying
                roommates with an explanatory breakdown note.
              </Text>
            </View>
          )}

          {/* Electricity Meter Calculator if Category is Electricity */}
          {selectedCategoryId === "Electricity" && (
            <View
              style={[
                styles.specifyCategoryCard,
                {
                  borderColor: isDark ? "rgba(245, 158, 11, 0.35)" : "#FDE68A",
                  backgroundColor: isDark ? colors.card : "#FFFBEB",
                },
              ]}
            >
              <View style={styles.specifyCategoryHeader}>
                <View
                  style={[
                    styles.specifyIconWrap,
                    {
                      backgroundColor: isDark
                        ? "rgba(245, 158, 11, 0.16)"
                        : "#FEF3C7",
                    },
                  ]}
                >
                  <Feather
                    name="zap"
                    size={15}
                    color={isDark ? "#FBBF24" : "#D97706"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.specifyCategoryTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    Electricity Meter Calculator (kWh)
                  </Text>
                  <Text
                    style={[
                      styles.specifyCategorySub,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    (Current Reading - Previous Reading) × Rate per kWh = Total
                    Electricity Bill
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: isDark ? colors.textSecondary : "#475569",
                      marginBottom: 4,
                    }}
                  >
                    Previous Reading (kWh)
                  </Text>
                  <TextInput
                    style={[
                      styles.specifyCategoryInput,
                      { marginTop: 0 },
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                    value={elecPrevReading}
                    onChangeText={(val) => {
                      setElecPrevReading(val);
                      updateAmountFromElectricity(
                        val,
                        elecCurrReading,
                        elecRatePerKwh,
                      );
                    }}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: isDark ? colors.textSecondary : "#475569",
                      marginBottom: 4,
                    }}
                  >
                    Current Reading (kWh)
                  </Text>
                  <TextInput
                    style={[
                      styles.specifyCategoryInput,
                      { marginTop: 0 },
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                      isElecReadingInvalid && {
                        borderColor: "#EF4444",
                      },
                    ]}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                    value={elecCurrReading}
                    onChangeText={(val) => {
                      setElecCurrReading(val);
                      updateAmountFromElectricity(
                        elecPrevReading,
                        val,
                        elecRatePerKwh,
                      );
                    }}
                  />
                </View>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: isDark ? colors.textSecondary : "#475569",
                    marginBottom: 4,
                  }}
                >
                  Configurable Amount per Kilowatt-Hour (₱ / kWh)
                </Text>
                <TextInput
                  style={[
                    styles.specifyCategoryInput,
                    { marginTop: 0 },
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  keyboardType="decimal-pad"
                  placeholder="12.00"
                  placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                  value={elecRatePerKwh}
                  onChangeText={(val) => {
                    setElecRatePerKwh(val);
                    updateAmountFromElectricity(
                      elecPrevReading,
                      elecCurrReading,
                      val,
                    );
                  }}
                />
              </View>

              {isElecReadingInvalid ? (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "#EF4444",
                    marginTop: 8,
                  }}
                >
                  Current reading must be greater than or equal to previous
                  reading ({parsedElecPrev} kWh).
                </Text>
              ) : (
                <View
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: isDark
                      ? "rgba(245, 158, 11, 0.14)"
                      : "#FEF3C7",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isDark ? "#FBBF24" : "#92400E",
                      }}
                    >
                      ({parsedElecCurr} - {parsedElecPrev} kWh) × ₱
                      {parsedElecRate.toFixed(2)}/kWh
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: isDark ? "#FDE68A" : "#B45309",
                        marginTop: 2,
                      }}
                    >
                      Consumption: {consumedKwh} kWh
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: isDark ? "#FBBF24" : "#B45309",
                    }}
                  >
                    ₱{computedElecPesos.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Amount Field matching screen.png */}
          <Text style={[styles.label, isDark && { color: colors.text }]}>
            Amount
          </Text>
          <View
            style={[
              styles.inputContainer,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <TextInput
              style={[styles.input, isDark && { color: colors.text }]}
              placeholder="₱0.00"
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(val) => {
                // Format with leading ₱ if typed cleanly
                if (!val) {
                  setAmount("");
                } else if (val.startsWith("₱")) {
                  setAmount(val);
                } else {
                  setAmount(`₱${val}`);
                }
              }}
            />
          </View>

          {/* Document (Optional) matching screen.png */}
          <Text style={[styles.label, isDark && { color: colors.text }]}>
            Document{" "}
            <Text
              style={[
                styles.optionalLabel,
                isDark && { color: colors.textMuted },
              ]}
            >
              (Optional)
            </Text>
          </Text>
          <TouchableOpacity
            style={[
              styles.uploadDashedBox,
              isDark && {
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                borderColor: "rgba(59, 130, 246, 0.3)",
              },
            ]}
            onPress={handlePickImage}
            activeOpacity={0.8}
          >
            {imageUri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
                <View style={styles.changeOverlay}>
                  <Feather
                    name="refresh-cw"
                    size={14}
                    color={isDark ? colors.primary : "#2563EB"}
                  />
                  <Text
                    style={[
                      styles.changeText,
                      isDark && { color: colors.primary },
                    ]}
                  >
                    Change Document
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <View
                  style={[
                    styles.uploadIconCircle,
                    isDark && { backgroundColor: "rgba(255, 255, 255, 0.08)" },
                  ]}
                >
                  <Feather
                    name="image"
                    size={20}
                    color={isDark ? colors.text : "#0F172A"}
                  />
                </View>
                <Text
                  style={[
                    styles.uploadText,
                    isDark && { color: colors.primary },
                  ]}
                >
                  Upload Image or Video
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Description (Optional) matching screen.png */}
          <Text style={[styles.label, isDark && { color: colors.text }]}>
            Description{" "}
            <Text
              style={[
                styles.optionalLabel,
                isDark && { color: colors.textMuted },
              ]}
            >
              (Optional)
            </Text>
          </Text>
          <View
            style={[
              styles.inputContainer,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <TextInput
              style={[styles.input, isDark && { color: colors.text }]}
              placeholder="Add a note or context"
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Split Method matching screen.png */}
          <Text style={[styles.label, isDark && { color: colors.text }]}>
            Split Method
          </Text>
          <View style={styles.splitRow}>
            <TouchableOpacity
              style={[
                styles.splitOptionBtn,
                splitMethod === "Equal"
                  ? [
                      styles.splitOptionActive,
                      isDark && {
                        backgroundColor: "rgba(59, 130, 246, 0.18)",
                        borderColor: colors.primary,
                      },
                    ]
                  : [
                      styles.splitOptionInactive,
                      isDark && {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ],
              ]}
              onPress={() => setSplitMethod("Equal")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.splitOptionText,
                  splitMethod === "Equal"
                    ? [
                        styles.splitTextActive,
                        isDark && { color: colors.primary },
                      ]
                    : [
                        styles.splitTextInactive,
                        isDark && { color: colors.textSecondary },
                      ],
                ]}
              >
                Equal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.splitOptionBtn,
                splitMethod === "% Custom"
                  ? [
                      styles.splitOptionActive,
                      isDark && {
                        backgroundColor: "rgba(59, 130, 246, 0.18)",
                        borderColor: colors.primary,
                      },
                    ]
                  : [
                      styles.splitOptionInactive,
                      isDark && {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ],
              ]}
              onPress={() => setSplitMethod("% Custom")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.splitOptionText,
                  splitMethod === "% Custom"
                    ? [
                        styles.splitTextActive,
                        isDark && { color: colors.primary },
                      ]
                    : [
                        styles.splitTextInactive,
                        isDark && { color: colors.textSecondary },
                      ],
                ]}
              >
                % Custom
              </Text>
            </TouchableOpacity>
          </View>

          {/* Fair Split on Payors Only Info Banner */}
          <View
            style={[
              styles.fairSplitBadge,
              isDark && {
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                borderColor: "rgba(16, 185, 129, 0.25)",
              },
            ]}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Feather
                name="shield"
                size={14}
                color={isDark ? "#34D399" : "#2563EB"}
              />
              <Text
                style={[
                  styles.fairSplitBadgeTitle,
                  isDark && { color: "#34D399" },
                ]}
              >
                Fair Split on Payors Only
              </Text>
            </View>
            <Text
              style={[
                styles.fairSplitBadgeDesc,
                isDark && { color: "#A7F3D0" },
              ]}
            >
              {activePayors.length} active payor(s) share this bill equally.{" "}
              {activeNonPayors.length > 0
                ? `${activeNonPayors.length} non-payor member(s) are exempted.`
                : "All active roommates are payors."}
            </Text>
          </View>

          {/* Member Allocation Breakdown for Equal Split */}
          {splitMethod === "Equal" && (
            <View
              style={[
                styles.equalSplitCard,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.equalSplitHeader,
                  isDark && { color: colors.text },
                ]}
              >
                Calculated Member Share
              </Text>
              {activeMembers.map((m) => {
                const uid = m.userId || m.memberId || m.id || "";
                const isPayor = isPayorMember(m);
                const isWater = isWaterCategory;
                const numericAmount =
                  parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
                const amountCents = Math.round(numericAmount * 100);

                let memberShareCents = 0;
                let note = "";
                if (!isPayor) {
                  memberShareCents = 0;
                  if (isWater) {
                    const rate = Number(
                      waterConfig?.rateCentavosPerPersonPerDay ?? 500,
                    );
                    const { membersBreakdown } = computeCycleWaterBreakdown(
                      activeMembers,
                      cycleAttendance,
                      attendanceSubmissions,
                      rate,
                    );
                    const npItem = membersBreakdown.find((b) =>
                      matchesMemberUid(m, b.userId),
                    );
                    note =
                      npItem?.nonPayorAllocationSummary ||
                      "Exempted (Non-payor)";
                  } else {
                    note = "Exempted (Non-payor)";
                  }
                } else if (isWater) {
                  const rate = Number(
                    waterConfig?.rateCentavosPerPersonPerDay ?? 500,
                  );
                  const { membersBreakdown } = computeCycleWaterBreakdown(
                    activeMembers,
                    cycleAttendance,
                    attendanceSubmissions,
                    rate,
                  );
                  const pItem = membersBreakdown.find((b) =>
                    matchesMemberUid(m, b.userId),
                  );
                  memberShareCents = pItem?.shareCentavos || 0;
                  const days = pItem?.daysPresent || 0;
                  const ownCost = pItem?.ownWaterCentavos || 0;
                  const extra = pItem?.nonPayorWaterCentavos || 0;
                  note =
                    extra > 0
                      ? `${days}d own (₱${(ownCost / 100).toFixed(2)}) + ₱${(extra / 100).toFixed(2)} non-payor share`
                      : `${days}d own @ ₱${rate / 100}/day`;
                } else {
                  memberShareCents = computeFairSplitShareCentavos(
                    amountCents,
                    activePayors,
                    uid,
                  );
                  note = "Equal payor share";
                }

                return (
                  <View
                    key={m.userId || m.memberId}
                    style={[
                      styles.memberShareRow,
                      isDark && { borderBottomColor: colors.borderSubtle },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text
                          style={[
                            styles.memberShareName,
                            isDark && { color: colors.text },
                          ]}
                        >
                          {m.displayName || "Roommate"}
                        </Text>
                        <View
                          style={
                            isPayor
                              ? [
                                  styles.badgePayor,
                                  isDark && {
                                    backgroundColor: "rgba(59, 130, 246, 0.2)",
                                  },
                                ]
                              : [
                                  styles.badgeNonPayor,
                                  isDark && {
                                    backgroundColor:
                                      "rgba(255, 255, 255, 0.08)",
                                  },
                                ]
                          }
                        >
                          <Text
                            style={
                              isPayor
                                ? [
                                    styles.badgeTextPayor,
                                    isDark && { color: "#93C5FD" },
                                  ]
                                : [
                                    styles.badgeTextNonPayor,
                                    isDark && { color: colors.textSecondary },
                                  ]
                            }
                          >
                            {isPayor ? "Payor" : "Non-Payor"}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.memberShareNote,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        {note}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.memberShareAmount,
                        isDark && { color: colors.primary },
                        !isPayor &&
                          (isDark
                            ? { color: colors.textMuted }
                            : styles.memberShareAmountExempt),
                      ]}
                    >
                      ₱{(memberShareCents / 100).toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Custom Split breakdown if % Custom is selected */}
          {splitMethod === "% Custom" && (
            <View
              style={[
                styles.customSplitsCard,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.customSplitsHeader,
                  isDark && { color: colors.text },
                ]}
              >
                Roommate Split Allocation (%)
              </Text>
              {activeMembers.map((m) => {
                const uid = m.userId || m.memberId;
                const currentVal =
                  customSplits[uid] ??
                  Math.round(100 / Math.max(1, activePayors.length));
                const isPayor = isPayorMember(m);

                return (
                  <View key={uid} style={styles.customSplitRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={[
                          styles.customSplitName,
                          isDark && { color: colors.text },
                        ]}
                      >
                        {m.displayName || "Roommate"}
                      </Text>
                      <View
                        style={
                          isPayor
                            ? [
                                styles.badgePayor,
                                isDark && {
                                  backgroundColor: "rgba(59, 130, 246, 0.2)",
                                },
                              ]
                            : [
                                styles.badgeNonPayor,
                                isDark && {
                                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                                },
                              ]
                        }
                      >
                        <Text
                          style={
                            isPayor
                              ? [
                                  styles.badgeTextPayor,
                                  isDark && { color: "#93C5FD" },
                                ]
                              : [
                                  styles.badgeTextNonPayor,
                                  isDark && { color: colors.textSecondary },
                                ]
                          }
                        >
                          {isPayor ? "Payor" : "Exempt"}
                        </Text>
                      </View>
                    </View>
                    {isPayor ? (
                      <View
                        style={[
                          styles.customSplitInputWrap,
                          isDark && {
                            backgroundColor: colors.surfaceInset,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <TextInput
                          style={[
                            styles.customSplitInput,
                            isDark && { color: colors.text },
                          ]}
                          keyboardType="number-pad"
                          value={String(currentVal)}
                          onChangeText={(txt) => {
                            const num =
                              parseInt(txt.replace(/[^0-9]/g, "")) || 0;
                            setCustomSplits((prev) => ({
                              ...prev,
                              [uid]: num,
                            }));
                          }}
                        />
                        <Text
                          style={[
                            styles.customSplitPercent,
                            isDark && { color: colors.textSecondary },
                          ]}
                        >
                          %
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={{
                          fontSize: 12,
                          color: isDark ? colors.textMuted : "#64748B",
                          fontWeight: "600",
                        }}
                      >
                        ₱0.00 (Exempt)
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Primary Bottom Action Button matching screen.png */}
          <TouchableOpacity
            style={[
              styles.updateBtn,
              (!isHost || uploading) && {
                opacity: 0.6,
                backgroundColor: !isHost
                  ? isDark
                    ? "rgba(255, 255, 255, 0.15)"
                    : "#94A3B8"
                  : "#2563EB",
              },
            ]}
            onPress={handleSave}
            disabled={uploading || !isHost}
            activeOpacity={0.85}
          >
            <Text style={styles.updateBtnText}>
              {!isHost
                ? "Host Permission Required"
                : uploading
                  ? "Saving..."
                  : "Add Bill"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  permissionBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#991B1B",
    marginBottom: 2,
  },
  permissionText: {
    fontSize: 12,
    color: "#B91C1C",
    lineHeight: 16,
  },
  // Group Cards Carousel matching image.png
  groupsCarousel: {
    marginBottom: 16,
    marginTop: 6,
  },
  groupCard: {
    width: 185,
    borderRadius: 20,
    padding: 16,
  },
  groupCardSelected: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  groupCardUnselected: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  groupCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  textWhite: {
    color: "#FFFFFF",
  },
  textDark: {
    color: "#0F172A",
  },
  groupCardSub: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 12,
  },
  textWhiteSub: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  textMuted: {
    color: "#64748B",
  },
  avatarStackRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  avatarBadgeExtra: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  cardActionBtn: {
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  cardActionBtnSelected: {
    backgroundColor: "#FFFFFF",
  },
  cardActionBtnUnselected: {
    backgroundColor: "#EFF6FF",
  },
  cardActionBtnText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
  },
  // Form Labels matching image.png
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 14,
    marginBottom: 8,
  },
  optionalLabel: {
    fontWeight: "400",
    color: "#94A3B8",
  },
  // Category Header and Dropdown Selector
  categorySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 8,
  },
  categoryCountPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  categoryCountPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
  dropdownSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    // shadowColor: "#0F172A",
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.04,
    // shadowRadius: 3,
    // elevation: 1,
  },
  dropdownSelectorActive: {
    borderColor: "#2563EB",
    backgroundColor: "#F8FAFC",
  },
  dropdownLeftWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  dropdownIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownIconEmoji: {
    fontSize: 20,
  },
  dropdownTitle: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "700",
  },
  dropdownSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  waterMiniBadge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  waterMiniBadgeText: {
    fontSize: 10,
    color: "#0284C7",
    fontWeight: "800",
  },
  chevronBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  chevronBadgeActive: {
    backgroundColor: "#EFF6FF",
  },
  // Inline Dropdown List Container
  inlineDropdownList: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    marginTop: 8,
    padding: 6,
    // shadowColor: "#0F172A",
    // shadowOffset: { width: 0, height: 4 },
    // shadowOpacity: 0.08,
    // shadowRadius: 10,
    // elevation: 3,
  },
  inlineDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginVertical: 2,
  },
  inlineDropdownItemActive: {
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  inlineCatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  inlineCatEmoji: {
    fontSize: 18,
  },
  inlineCatName: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
  },
  inlineCatNameActive: {
    color: "#2563EB",
    fontWeight: "800",
  },
  waterPillTag: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  waterPillTagText: {
    fontSize: 10,
    color: "#0284C7",
    fontWeight: "700",
  },
  inlineCatDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  selectedCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  unselectedRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  // Specify Category Card
  specifyCategoryCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  specifyCategoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  specifyIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  specifyCategoryTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  specifyCategorySub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  specifyCategoryInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#93C5FD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  specifyCategoryFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  specifyCategoryTip: {
    fontSize: 11,
    color: "#64748B",
    flex: 1,
  },
  charCountText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    marginLeft: 6,
  },
  // Input fields matching image.png
  inputContainer: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    justifyContent: "center",
  },
  input: {
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 0,
  },
  // Dashed upload box matching image.png
  uploadDashedBox: {
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
    borderRadius: 16,
    backgroundColor: "#FAFCFF",
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadPlaceholder: {
    alignItems: "center",
  },
  uploadIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  uploadText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "600",
  },
  previewContainer: {
    width: "100%",
    paddingHorizontal: 14,
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    resizeMode: "cover",
  },
  changeOverlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  changeText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "600",
  },
  // Split Method segmented control matching image.png
  splitRow: {
    flexDirection: "row",
    gap: 12,
  },
  splitOptionBtn: {
    flex: 1,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  splitOptionActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#2563EB",
  },
  splitOptionInactive: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },
  splitOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  splitTextActive: {
    color: "#2563EB",
  },
  splitTextInactive: {
    color: "#64748B",
  },
  // Custom Splits Breakdown
  customSplitsCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  customSplitsHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 10,
  },
  customSplitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  customSplitName: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  customSplitInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 64,
    justifyContent: "space-between",
  },
  customSplitInput: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    padding: 0,
    width: 32,
    textAlign: "center",
  },
  customSplitPercent: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  // Bottom Primary Button matching screen.png
  updateBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },
  updateBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  // Water Info Banner
  waterInfoNotice: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  waterInfoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0369A1",
  },
  waterInfoText: {
    fontSize: 12,
    color: "#0C4A6E",
    lineHeight: 17,
  },
  // Fair Split Badge
  fairSplitBadge: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  fairSplitBadgeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#15803D",
  },
  fairSplitBadgeDesc: {
    fontSize: 12,
    color: "#166534",
    marginTop: 2,
    lineHeight: 16,
  },
  // Equal Split Member Breakdown
  equalSplitCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  equalSplitHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  memberShareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  memberShareName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  memberShareNote: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  memberShareAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563EB",
  },
  memberShareAmountExempt: {
    color: "#94A3B8",
  },
  badgePayor: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  badgeNonPayor: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  badgeTextPayor: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  badgeTextNonPayor: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
});
