import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { uploadToFirebaseStorageMobile } from "../services/firebaseStorageService";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  isPayorMember,
} from "../services/firebaseDataService";
import { BILL_CATEGORIES, getCategoryMeta } from "../services/categoryService";

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
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("Rent");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [otherCategorySpecified, setOtherCategorySpecified] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [splitMethod, setSplitMethod] = useState<"Equal" | "% Custom">("Equal");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [profile, setProfile] = useState<any | null>(null);
  const [household, setHousehold] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | undefined>(
    undefined,
  );

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
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

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
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setImageUri(result.assets[0].uri);
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
      if (isWater && nonPayorCount > 0) {
        // Water mode: non-payors incur water consumption, but are exempted; their water is absorbed and distributed fairly across payors with a proper note
        const totalPeople = Math.max(1, activeMembers.length);
        const baseShareCentavos = Math.round(amountCents / totalPeople);
        const totalNonPayorWaterCentavos = baseShareCentavos * nonPayorCount;
        const extraPerPayorCentavos = Math.round(
          totalNonPayorWaterCentavos / payorCount,
        );
        const nonPayorNames = activeNonPayors
          .map((np) => np.displayName || "Non-payor")
          .join(", ");

        splitDetails = activeMembers.map((m) => {
          const isPayor = isPayorMember(m);
          if (isPayor) {
            const payorTotal = baseShareCentavos + extraPerPayorCentavos;
            return {
              userId: m.userId || m.memberId,
              displayName: m.displayName || "Roommate",
              shareCentavos: payorTotal,
              isExempt: false,
              note: `Includes non-payor water reallocation: +₱${(extraPerPayorCentavos / 100).toFixed(2)} from ${nonPayorNames} (5/person/day rule)`,
            };
          } else {
            return {
              userId: m.userId || m.memberId,
              displayName: m.displayName || "Roommate",
              shareCentavos: 0,
              isExempt: true,
              note: `Exempted (Non-payor) — water cost of ₱${(baseShareCentavos / 100).toFixed(2)} absorbed and split among ${payorCount} payors`,
            };
          }
        });
      } else {
        // Standard bills: split strictly across payors only!
        const shareCentavos = Math.round(amountCents / payorCount);
        splitDetails = activeMembers.map((m) => {
          const isPayor = isPayorMember(m);
          if (isPayor) {
            return {
              userId: m.userId || m.memberId,
              displayName: m.displayName || "Roommate",
              shareCentavos,
              percentage: Math.round((100 / payorCount) * 10) / 10,
              isExempt: false,
              note: `Fair share among ${payorCount} payors (Non-payors exempt)`,
            };
          } else {
            return {
              userId: m.userId || m.memberId,
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
      title: `${categoryToSave} - ${selectedGroup.name}`,
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
    if (description && description.trim().length > 0) {
      expensePayload.notes = description.trim();
    }

    await mobileDataService.addExpense(expensePayload);

    setUploading(false);

    onSaveExpense({
      title: `${categoryToSave} - ${selectedGroup.name}`,
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
    <SafeAreaView style={styles.container}>
      {/* Header matching screen.png */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Bill</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {profile && !isHost && (
          <View style={styles.permissionBanner}>
            <Text style={styles.permissionTitle}>Host Permission Required</Text>
            <Text style={styles.permissionText}>
              You are signed in as a resident. Only household hosts can record
              bills. Roommates can review charges and settle their share in the
              Bills tab.
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
                    : styles.groupCardUnselected,
                ]}
                onPress={() => setSelectedGroupIndex(idx)}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    styles.groupCardTitle,
                    isSelected ? styles.textWhite : styles.textDark,
                  ]}
                  numberOfLines={1}
                >
                  {grp.name}
                </Text>

                <Text
                  style={[
                    styles.groupCardSub,
                    isSelected ? styles.textWhiteSub : styles.textMuted,
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
                          ? { backgroundColor: "#DBEAFE" }
                          : { backgroundColor: "#E2E8F0" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarBadgeText,
                          isSelected
                            ? { color: "#1D4ED8" }
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
                      : styles.cardActionBtnUnselected,
                  ]}
                  onPress={() => setSelectedGroupIndex(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cardActionBtnText}>Add Bills</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Category Field - Beautiful Dropdown Mode (Not in Modal) */}
        <View style={styles.categorySectionHeader}>
          <Text style={styles.label}>Bill Category</Text>
          <View style={styles.categoryCountPill}>
            <Text style={styles.categoryCountPillText}>
              {BILL_CATEGORIES.length} Categories
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.dropdownSelector,
            isCategoryDropdownOpen && styles.dropdownSelectorActive,
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
                <Text style={styles.dropdownTitle}>
                  {selectedCategoryId === "Others" &&
                  otherCategorySpecified.trim()
                    ? `Others: ${otherCategorySpecified.trim()}`
                    : activeCategoryMeta.name}
                </Text>
                {selectedCategoryId === "Water" && (
                  <View style={styles.waterMiniBadge}>
                    <Text style={styles.waterMiniBadgeText}>₱5/day</Text>
                  </View>
                )}
              </View>
              <Text style={styles.dropdownSubtitle} numberOfLines={1}>
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
              isCategoryDropdownOpen && styles.chevronBadgeActive,
            ]}
          >
            <Feather
              name={isCategoryDropdownOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={isCategoryDropdownOpen ? "#2563EB" : "#64748B"}
            />
          </View>
        </TouchableOpacity>

        {/* Inline Category Dropdown List (Expanded) */}
        {isCategoryDropdownOpen && (
          <View style={styles.inlineDropdownList}>
            {BILL_CATEGORIES.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.inlineDropdownItem,
                    isSelected && styles.inlineDropdownItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCategoryId(cat.id);
                    setIsCategoryDropdownOpen(false);
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
                          isSelected && styles.inlineCatNameActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                      {cat.id === "Water" && (
                        <View style={styles.waterPillTag}>
                          <Text style={styles.waterPillTagText}>
                            Attendance Mode
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.inlineCatDesc} numberOfLines={1}>
                      {cat.description}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View style={styles.selectedCheckBadge}>
                      <Feather name="check" size={13} color="#FFFFFF" />
                    </View>
                  ) : (
                    <View style={styles.unselectedRadioCircle} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* If user selects "Others", prompt them to specify */}
        {selectedCategoryId === "Others" && (
          <View style={styles.specifyCategoryCard}>
            <View style={styles.specifyCategoryHeader}>
              <View style={styles.specifyIconWrap}>
                <Feather name="edit-3" size={15} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.specifyCategoryTitle}>
                  Specify Category Name *
                </Text>
                <Text style={styles.specifyCategorySub}>
                  Please specify what this bill is for (e.g. Parking Fee, Pest
                  Control, Aircon Cleaning)
                </Text>
              </View>
            </View>
            <TextInput
              style={styles.specifyCategoryInput}
              placeholder="e.g., Parking Fee, Building Maintenance, Gym..."
              placeholderTextColor="#94A3B8"
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
                <Text style={styles.specifyCategoryTip}>
                  This custom category name will sync to all roommates' bill
                  lists.
                </Text>
              </View>
              <Text style={styles.charCountText}>
                {otherCategorySpecified.length}/40
              </Text>
            </View>
          </View>
        )}

        {/* Water Mode Indicator if Category is Water */}
        {selectedCategoryId === "Water" && (
          <View style={styles.waterInfoNotice}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <Feather name="droplet" size={15} color="#0284C7" />
              <Text style={styles.waterInfoTitle}>
                Water Billing Mode: ₱5 / person / day
              </Text>
            </View>
            <Text style={styles.waterInfoText}>
              Non-payor members are exempted. Water consumption incurred by
              non-payor members is split fairly and reallocated across paying
              roommates with an explanatory breakdown note.
            </Text>
          </View>
        )}

        {/* Amount Field matching screen.png */}
        <Text style={styles.label}>Amount</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="₱0.00"
            placeholderTextColor="#94A3B8"
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
        <Text style={styles.label}>
          Document <Text style={styles.optionalLabel}>(Optional)</Text>
        </Text>
        <TouchableOpacity
          style={styles.uploadDashedBox}
          onPress={handlePickImage}
          activeOpacity={0.8}
        >
          {imageUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <View style={styles.changeOverlay}>
                <Feather name="refresh-cw" size={14} color="#2563EB" />
                <Text style={styles.changeText}>Change Document</Text>
              </View>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <View style={styles.uploadIconCircle}>
                <Feather name="image" size={20} color="#2563EB" />
              </View>
              <Text style={styles.uploadText}>Upload Image or Video</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Description (Optional) matching screen.png */}
        <Text style={styles.label}>
          Description <Text style={styles.optionalLabel}>(Optional)</Text>
        </Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add a note or context"
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Split Method matching screen.png */}
        <Text style={styles.label}>Split Method</Text>
        <View style={styles.splitRow}>
          <TouchableOpacity
            style={[
              styles.splitOptionBtn,
              splitMethod === "Equal"
                ? styles.splitOptionActive
                : styles.splitOptionInactive,
            ]}
            onPress={() => setSplitMethod("Equal")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.splitOptionText,
                splitMethod === "Equal"
                  ? styles.splitTextActive
                  : styles.splitTextInactive,
              ]}
            >
              Equal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.splitOptionBtn,
              splitMethod === "% Custom"
                ? styles.splitOptionActive
                : styles.splitOptionInactive,
            ]}
            onPress={() => setSplitMethod("% Custom")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.splitOptionText,
                splitMethod === "% Custom"
                  ? styles.splitTextActive
                  : styles.splitTextInactive,
              ]}
            >
              % Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* Fair Split on Payors Only Info Banner */}
        <View style={styles.fairSplitBadge}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="shield" size={14} color="#2563EB" />
            <Text style={styles.fairSplitBadgeTitle}>
              Fair Split on Payors Only
            </Text>
          </View>
          <Text style={styles.fairSplitBadgeDesc}>
            {activePayors.length} active payor(s) share this bill equally.{" "}
            {activeNonPayors.length > 0
              ? `${activeNonPayors.length} non-payor member(s) are exempted.`
              : "All active roommates are payors."}
          </Text>
        </View>

        {/* Member Allocation Breakdown for Equal Split */}
        {splitMethod === "Equal" && (
          <View style={styles.equalSplitCard}>
            <Text style={styles.equalSplitHeader}>Calculated Member Share</Text>
            {activeMembers.map((m) => {
              const isPayor = isPayorMember(m);
              const isWater = isWaterCategory;
              const payorCount = Math.max(1, activePayors.length);
              const nonPayorCount = activeNonPayors.length;
              const numericAmount =
                parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
              const amountCents = Math.round(numericAmount * 100);

              let memberShareCents = 0;
              let note = "";
              if (!isPayor) {
                memberShareCents = 0;
                note = "Exempted (Non-payor)";
              } else if (isWater && nonPayorCount > 0) {
                const totalPeople = Math.max(1, activeMembers.length);
                const base = Math.round(amountCents / totalPeople);
                const extra = Math.round((base * nonPayorCount) / payorCount);
                memberShareCents = base + extra;
                note = `Includes +₱${(extra / 100).toFixed(2)} non-payor water reallocation (5/day rule)`;
              } else {
                memberShareCents = Math.round(amountCents / payorCount);
                note = "Equal payor share";
              }

              return (
                <View
                  key={m.userId || m.memberId}
                  style={styles.memberShareRow}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text style={styles.memberShareName}>
                        {m.displayName || "Roommate"}
                      </Text>
                      <View
                        style={
                          isPayor ? styles.badgePayor : styles.badgeNonPayor
                        }
                      >
                        <Text
                          style={
                            isPayor
                              ? styles.badgeTextPayor
                              : styles.badgeTextNonPayor
                          }
                        >
                          {isPayor ? "Payor" : "Non-Payor"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.memberShareNote}>{note}</Text>
                  </View>
                  <Text
                    style={[
                      styles.memberShareAmount,
                      !isPayor && styles.memberShareAmountExempt,
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
          <View style={styles.customSplitsCard}>
            <Text style={styles.customSplitsHeader}>
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
                    <Text style={styles.customSplitName}>
                      {m.displayName || "Roommate"}
                    </Text>
                    <View
                      style={isPayor ? styles.badgePayor : styles.badgeNonPayor}
                    >
                      <Text
                        style={
                          isPayor
                            ? styles.badgeTextPayor
                            : styles.badgeTextNonPayor
                        }
                      >
                        {isPayor ? "Payor" : "Exempt"}
                      </Text>
                    </View>
                  </View>
                  {isPayor ? (
                    <View style={styles.customSplitInputWrap}>
                      <TextInput
                        style={styles.customSplitInput}
                        keyboardType="number-pad"
                        value={String(currentVal)}
                        onChangeText={(txt) => {
                          const num = parseInt(txt.replace(/[^0-9]/g, "")) || 0;
                          setCustomSplits((prev) => ({ ...prev, [uid]: num }));
                        }}
                      />
                      <Text style={styles.customSplitPercent}>%</Text>
                    </View>
                  ) : (
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#64748B",
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
              backgroundColor: !isHost ? "#94A3B8" : "#2563EB",
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
    </SafeAreaView>
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
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
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
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  dropdownSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    marginTop: 8,
    padding: 6,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
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
    borderWidth: 1.5,
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
    backgroundColor: "#EFF6FF",
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
    borderWidth: 1.5,
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
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#FFFFFF",
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
    borderWidth: 1.5,
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
