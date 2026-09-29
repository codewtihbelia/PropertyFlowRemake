import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  StatusBar,
  Platform,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { formatPesos } from "@propertyflow/shared";
import { uploadToFirebaseStorageMobile } from "../services/firebaseStorageService";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  isPayorMember,
  HostPaymentMethod,
  DEFAULT_HOST_PAYMENT_METHODS,
} from "../services/firebaseDataService";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { useTheme } from "../context/ThemeContext";

export interface PaymentsScreenProps {
  householdId?: string;
  billingCycleId?: string;
  onBack?: () => void;
}

export const PaymentsScreen: React.FC<PaymentsScreenProps> = ({
  householdId,
  billingCycleId,
  onBack,
}) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    Platform.OS === "ios" ? 44 : 20,
  );
  const [showMenu, setShowMenu] = useState(false);
  const { onScroll } = useNavVisibility();
  const [method, setMethod] = useState<
    "GCash" | "Maya" | "Cash" | "Bank Transfer"
  >("GCash");
  const [hostPaymentMethods, setHostPaymentMethods] = useState<
    HostPaymentMethod[]
  >(DEFAULT_HOST_PAYMENT_METHODS);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [previewQrModal, setPreviewQrModal] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [amount, setAmount] = useState("");
  const [refNum, setRefNum] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(() => !householdId);
  const [profile, setProfile] = useState<any | null>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [memberBills, setMemberBills] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const currentUser = auth.currentUser;

  const activeMethod: HostPaymentMethod = useMemo(() => {
    if (selectedMethodId) {
      const found = hostPaymentMethods.find((m) => m.id === selectedMethodId);
      if (found) return found;
    }
    return hostPaymentMethods[0] || DEFAULT_HOST_PAYMENT_METHODS[0];
  }, [hostPaymentMethods, selectedMethodId]);

  const getMethodBadge = (type: string) => {
    switch (type) {
      case "GCASH":
        return {
          icon: "credit-card",
          color: "#0284C7",
          bgColor: isDark ? "rgba(2, 132, 199, 0.16)" : "#E0F2FE",
          label: "GCash",
        };
      case "MAYA":
        return {
          icon: "smartphone",
          color: "#059669",
          bgColor: isDark ? "rgba(5, 150, 105, 0.16)" : "#D1FAE5",
          label: "Maya",
        };
      case "BANK_TRANSFER":
        return {
          icon: "briefcase",
          color: "#7C3AED",
          bgColor: isDark ? "rgba(124, 58, 237, 0.16)" : "#EDE9FE",
          label: "Bank Transfer",
        };
      case "CASH":
        return {
          icon: "dollar-sign",
          color: "#D97706",
          bgColor: isDark ? "rgba(217, 119, 6, 0.16)" : "#FEF3C7",
          label: "Cash",
        };
      default:
        return {
          icon: "credit-card",
          color: "#475569",
          bgColor: isDark ? "rgba(71, 85, 105, 0.16)" : "#F1F5F9",
          label: "Other",
        };
    }
  };

  const handleCopyAccountNumber = (accountNumber: string) => {
    if (!accountNumber) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(accountNumber);
    }
    setCopiedSuccess(true);
    Alert.alert(
      "Copied to Clipboard",
      `Account number copied: ${accountNumber}`,
    );
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const resolvedHouseholdId = householdId || profile?.householdId || "";
  const activeCycle = useMemo(
    () =>
      cycles.find((c) => c.billingCycleId === billingCycleId) ||
      cycles.find((c) => c.status === "ACTIVE" || c.status === "FINALIZED") ||
      cycles[0],
    [billingCycleId, cycles],
  );
  const resolvedBillingCycleId =
    billingCycleId || activeCycle?.billingCycleId || "";

  const activePayors = useMemo(() => {
    const list = members.filter(
      (m) => m.status === "ACTIVE" && isPayorMember(m),
    );
    return list.length > 0
      ? list
      : members.filter((m) => m.status === "ACTIVE");
  }, [members]);

  const liveOutstandingCentavos = useMemo(() => {
    const payorCount = Math.max(1, activePayors.length);
    const unpaidExpenses = expenses.filter(
      (e) => e.status !== "PAID" && !e.isPaid,
    );
    const liveShare = unpaidExpenses.reduce((sum, e) => {
      const splitPayors = e.splitDetails
        ? e.splitDetails.filter((s: any) => !s.isExempt && s.shareCentavos > 0)
        : [];
      const isSplitStale =
        splitPayors.length > 0 && splitPayors.length !== payorCount;
      if (
        !isSplitStale &&
        e.splitDetails &&
        currentUser?.uid &&
        typeof e.splitDetails.find((s: any) => s.userId === currentUser.uid)
          ?.shareCentavos === "number"
      ) {
        const mySplit = e.splitDetails.find(
          (s: any) => s.userId === currentUser.uid,
        );
        if (mySplit?.isPaid) return sum;
        return sum + (mySplit?.shareCentavos || 0);
      }
      return sum + Math.round(e.amountCents / payorCount);
    }, 0);

    const userPaidCentavos = payments
      .filter((p) => p.userId === currentUser?.uid)
      .reduce((sum, p) => sum + (p.amountCentavos || 0), 0);

    return Math.max(0, liveShare - userPaidCentavos);
  }, [expenses, activePayors, currentUser?.uid, payments]);

  useEffect(() => {
    if (liveOutstandingCentavos > 0 && !amount) {
      setAmount((liveOutstandingCentavos / 100).toFixed(2));
    }
  }, [liveOutstandingCentavos]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    mobileDataService.getUserProfile(currentUser.uid).then((p) => {
      if (p) setProfile(p);
    });
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!resolvedHouseholdId) return;
    setLoading(true);

    const unsubExpenses = mobileDataService.listenToExpenses(
      resolvedHouseholdId,
      (data: any) => {
        setExpenses(data);
        setLoading(false);
      },
    );

    const unsubCycles = mobileDataService.listenToBillingCycles(
      resolvedHouseholdId,
      (data: any) => setCycles(data),
    );

    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      resolvedHouseholdId,
      (data: any) => setMembers(data),
    );

    const unsubPayments = mobileDataService.listenToPayments(
      resolvedHouseholdId,
      (data: any) => setPayments(data),
    );

    const unsubHousehold = mobileDataService.listenToHousehold(
      resolvedHouseholdId,
      (hh) => {
        if (
          hh &&
          Array.isArray(hh.paymentMethods) &&
          hh.paymentMethods.length > 0
        ) {
          const enabledOnly = hh.paymentMethods.filter(
            (m: HostPaymentMethod) => m.isEnabled !== false,
          );
          setHostPaymentMethods(
            enabledOnly.length > 0 ? enabledOnly : hh.paymentMethods,
          );
        } else {
          setHostPaymentMethods(DEFAULT_HOST_PAYMENT_METHODS);
        }
      },
    );

    return () => {
      unsubExpenses();
      unsubCycles();
      unsubMembers();
      unsubPayments();
      unsubHousehold();
    };
  }, [resolvedHouseholdId]);

  const handlePickReceipt = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow Splitzy access to your photos to upload receipts.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Error", "Could not pick image. Please try again.");
    }
  };

  const handleSubmit = async () => {
    if (!currentUser?.uid || !resolvedHouseholdId) {
      Alert.alert(
        "Missing Information",
        "Could not verify current user or household ID.",
      );
      return;
    }

    const effectiveAmountStr =
      amount.trim() ||
      (liveOutstandingCentavos > 0
        ? (liveOutstandingCentavos / 100).toFixed(2)
        : "");

    if (
      !effectiveAmountStr ||
      isNaN(parseFloat(effectiveAmountStr)) ||
      parseFloat(effectiveAmountStr) <= 0
    ) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
      return;
    }

    const finalRef =
      refNum.trim() ||
      `${activeMethod.type || "PAY"}-${Math.floor(100000 + Math.random() * 900000)}`;

    setUploading(true);
    let uploadedReceiptUrl: string | undefined;

    try {
      if (imageUri) {
        try {
          uploadedReceiptUrl = await uploadToFirebaseStorageMobile(
            imageUri,
            `payment_proofs/${resolvedHouseholdId}/mobile`,
          );
        } catch (storageErr) {
          console.warn("[PaymentsScreen] Storage upload notice:", storageErr);
          uploadedReceiptUrl =
            imageUri.startsWith("data:") || imageUri.startsWith("http")
              ? imageUri
              : undefined;
        }
      }

      const amountCentavos = Math.round(parseFloat(effectiveAmountStr) * 100);
      await mobileDataService.submitPayment({
        householdId: resolvedHouseholdId,
        billingCycleId: resolvedBillingCycleId,
        userId: currentUser.uid,
        userName: currentUser.displayName || profile?.displayName || "Resident",
        amountCentavos,
        paymentMethod: activeMethod.type || "GCASH",
        referenceNumber: finalRef,
        proofOfPaymentUrl: uploadedReceiptUrl,
        notes: notes.trim()
          ? `${activeMethod.name} (${activeMethod.accountNumber || "QR"}): ${notes.trim()}`
          : `Paid via ${activeMethod.name}`,
      });

      setSubmitted(true);
      Alert.alert(
        "Payment Recorded 🎉",
        `Your payment of ${formatPesos(amountCentavos)} via ${activeMethod.name} (Ref: ${finalRef}) has been successfully recorded and credited to your household bills.`,
        [
          {
            text: "View Bills",
            onPress: () => {
              if (onBack) onBack();
            },
          },
        ],
      );
    } catch (saveErr: any) {
      console.error("[PaymentsScreen] Submit error:", saveErr);
      Alert.alert(
        "Payment Error",
        saveErr?.message ||
          "Could not save this payment in Firebase. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading && !resolvedHouseholdId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={colors.statusBar}
          translucent={true}
          backgroundColor="transparent"
        />
        <View
          style={[
            styles.navBarContainer,
            {
              paddingTop: topInset,
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.navBar}>
            <TouchableOpacity
              style={[
                styles.circleBackBtn,
                {
                  backgroundColor: isDark
                    ? colors.card
                    : "rgba(15, 23, 42, 0.05)",
                  borderColor: colors.border,
                  borderWidth: isDark ? 1 : 0,
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
            <Text style={[styles.navTitle, { color: colors.text }]}>
              Make Payment
            </Text>
            <View style={{ width: 44 }} />
          </View>
        </View>
        <UniversalSkeleton type="bills" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.statusBar}
        translucent={true}
        backgroundColor="transparent"
      />

      {/* Top Header */}
      <View
        style={[
          styles.navBarContainer,
          {
            paddingTop: topInset,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.navBar}>
          <TouchableOpacity
            style={[
              styles.circleBackBtn,
              {
                backgroundColor: isDark
                  ? colors.card
                  : "rgba(15, 23, 42, 0.05)",
                borderColor: colors.border,
                borderWidth: isDark ? 1 : 0,
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
          <Text style={[styles.navTitle, { color: colors.text }]}>
            Make Payment
          </Text>
          <TouchableOpacity
            style={[
              styles.iconNavBtn,
              {
                backgroundColor: isDark
                  ? colors.card
                  : "rgba(15, 23, 42, 0.05)",
                borderColor: colors.border,
                borderWidth: isDark ? 1 : 0,
              },
            ]}
            onPress={() => setShowMenu(true)}
            activeOpacity={0.7}
          >
            <Feather
              name="more-vertical"
              size={22}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Text style={[styles.title, { color: colors.text }]}>Settle Dues</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Settle your roommate share with payment proof
        </Text>

        <View
          style={[
            styles.dueCard,
            {
              backgroundColor: isDark ? colors.card : "#EFF6FF",
              borderColor: isDark ? colors.border : "#DBEAFE",
            },
          ]}
        >
          <Text
            style={[styles.dueLabel, { color: isDark ? "#60A5FA" : "#1E40AF" }]}
          >
            Current Outstanding Dues
          </Text>
          <Text
            style={[
              styles.dueAmount,
              { color: isDark ? colors.text : "#1E3A8A" },
            ]}
          >
            {formatPesos(liveOutstandingCentavos)}
          </Text>
          <Text
            style={[
              styles.dueNote,
              { color: isDark ? colors.textSecondary : "#3B82F6" },
            ]}
          >
            {activeCycle
              ? `${activeCycle.name || "Active billing cycle"} from Firebase`
              : "No active Firebase billing cycle found"}
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Payment Method
        </Text>

        {/* Dropdown Style Payment Method Selector */}
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              showMethodDropdown && styles.dropdownTriggerOpen,
              {
                backgroundColor: colors.card,
                borderColor: showMethodDropdown
                  ? colors.primary
                  : colors.border,
              },
            ]}
            onPress={() => setShowMethodDropdown(!showMethodDropdown)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.methodIconBadgeSmall,
                {
                  backgroundColor: getMethodBadge(activeMethod.type).bgColor,
                },
              ]}
            >
              <Feather
                name={getMethodBadge(activeMethod.type).icon as any}
                size={16}
                color={getMethodBadge(activeMethod.type).color}
              />
            </View>

            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                style={[styles.dropdownSelectedTitle, { color: colors.text }]}
              >
                {activeMethod.name}
              </Text>
              <Text
                style={[
                  styles.dropdownSelectedSubtitle,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {activeMethod.accountName
                  ? `${activeMethod.accountName} • ${activeMethod.accountNumber || "QR Ready"}`
                  : activeMethod.accountNumber || "Host Payment Channel"}
              </Text>
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {activeMethod.qrCodeUrl ? (
                <View
                  style={[
                    styles.qrIndicatorTag,
                    isDark && {
                      backgroundColor: "rgba(59, 130, 246, 0.15)",
                      borderColor: "rgba(59, 130, 246, 0.3)",
                    },
                  ]}
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={11}
                    color={isDark ? colors.accent : "#2563EB"}
                  />
                  <Text
                    style={[
                      styles.qrIndicatorTagText,
                      isDark && { color: colors.accent },
                    ]}
                  >
                    QR
                  </Text>
                </View>
              ) : null}
              <Feather
                name={showMethodDropdown ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textSecondary}
              />
            </View>
          </TouchableOpacity>

          {/* Dropdown Menu Options */}
          {showMethodDropdown && (
            <View
              style={[
                styles.dropdownMenu,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.dropdownMenuHeader,
                  { color: colors.textSecondary },
                ]}
              >
                HOST CONFIGURED PAYMENT METHODS
              </Text>
              {hostPaymentMethods.map((m) => {
                const isSelected = activeMethod.id === m.id;
                const badge = getMethodBadge(m.type);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.dropdownMenuItem,
                      isSelected && {
                        backgroundColor: isDark
                          ? "rgba(59, 130, 246, 0.15)"
                          : "#EFF6FF",
                      },
                      isDark && { borderBottomColor: colors.border },
                    ]}
                    onPress={() => {
                      setSelectedMethodId(m.id);
                      setShowMethodDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.methodIconBadgeSmall,
                        { backgroundColor: badge.bgColor },
                      ]}
                    >
                      <Feather
                        name={badge.icon as any}
                        size={15}
                        color={badge.color}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemTitle,
                            {
                              color: isSelected ? colors.primary : colors.text,
                            },
                            isSelected && { fontWeight: "800" },
                          ]}
                        >
                          {m.name}
                        </Text>
                        {m.qrCodeUrl ? (
                          <View
                            style={[
                              styles.qrIndicatorTag,
                              isDark && {
                                backgroundColor: "rgba(59, 130, 246, 0.15)",
                                borderColor: "rgba(59, 130, 246, 0.3)",
                              },
                            ]}
                          >
                            <Ionicons
                              name="qr-code-outline"
                              size={10}
                              color={isDark ? colors.accent : "#2563EB"}
                            />
                            <Text
                              style={[
                                styles.qrIndicatorTagText,
                                isDark && { color: colors.accent },
                              ]}
                            >
                              QR
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text
                        style={[
                          styles.dropdownItemSub,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {m.accountName
                          ? `${m.accountName} • ${m.accountNumber || "Direct Payment"}`
                          : m.accountNumber || "Pay via this channel"}
                      </Text>
                    </View>

                    {isSelected && (
                      <Feather
                        name="check"
                        size={18}
                        color={colors.primary}
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Host Payment Details Card: QR & Account Number */}
        <View
          style={[
            styles.hostPaymentInfoCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.hostPaymentInfoHeader}>
            <View
              style={[
                styles.verifiedHostBadge,
                isDark && {
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  borderColor: "rgba(16, 185, 129, 0.3)",
                },
              ]}
            >
              <Feather
                name="shield"
                size={12}
                color={isDark ? colors.success : "#10B981"}
              />
              <Text
                style={[
                  styles.verifiedHostBadgeText,
                  { color: isDark ? colors.success : "#059669" },
                ]}
              >
                Host Verified Payment
              </Text>
            </View>
            <Text
              style={[
                styles.hostMethodTypeTag,
                { color: colors.textSecondary },
              ]}
            >
              {activeMethod.name}
            </Text>
          </View>

          {/* Account Details with Copy Button */}
          {activeMethod.accountNumber ? (
            <View
              style={[
                styles.accountNumberCopyBox,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.accountLabelText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {activeMethod.accountName
                    ? `${activeMethod.accountName} (Receiver)`
                    : "Account / Mobile Number"}
                </Text>
                <Text
                  style={[styles.accountNumberText, { color: colors.text }]}
                  selectable
                >
                  {activeMethod.accountNumber}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.copyAccountBtn,
                  copiedSuccess && styles.copyAccountBtnSuccess,
                  isDark &&
                    !copiedSuccess && {
                      backgroundColor: "rgba(59, 130, 246, 0.15)",
                      borderColor: "rgba(59, 130, 246, 0.3)",
                    },
                ]}
                onPress={() =>
                  handleCopyAccountNumber(activeMethod.accountNumber)
                }
                activeOpacity={0.8}
              >
                <Feather
                  name={copiedSuccess ? "check" : "copy"}
                  size={13}
                  color={
                    copiedSuccess
                      ? "#FFFFFF"
                      : isDark
                        ? colors.accent
                        : "#2563EB"
                  }
                />
                <Text
                  style={[
                    styles.copyAccountBtnText,
                    copiedSuccess && { color: "#FFFFFF" },
                    isDark &&
                      !copiedSuccess && {
                        color: colors.accent,
                      },
                  ]}
                >
                  {copiedSuccess ? "Copied!" : "Copy"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* QR Code Display if available */}
          {activeMethod.qrCodeUrl ? (
            <View
              style={[
                styles.qrDisplayBox,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.qrImageClickable}
                onPress={() =>
                  setPreviewQrModal(activeMethod.qrCodeUrl || null)
                }
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: activeMethod.qrCodeUrl }}
                  style={styles.qrDisplayImage}
                  resizeMode="contain"
                />
                <View style={styles.qrEnlargeHintBadge}>
                  <Feather name="maximize-2" size={11} color="#FFFFFF" />
                  <Text style={styles.qrEnlargeHintText}>Tap to Enlarge</Text>
                </View>
              </TouchableOpacity>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.qrTitle, { color: colors.text }]}>
                  Scan Host QR Code
                </Text>
                <Text
                  style={[styles.qrSubtitle, { color: colors.textSecondary }]}
                >
                  Open {activeMethod.name} or banking app and scan this QR to
                  pay directly without manual errors.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Notes / Special Instructions from Host */}
          {Boolean(activeMethod.notes) && (
            <View
              style={[
                styles.hostNotesNotice,
                isDark && {
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  borderColor: "rgba(59, 130, 246, 0.25)",
                },
              ]}
            >
              <Feather
                name="info"
                size={14}
                color={isDark ? colors.accent : "#2563EB"}
                style={{ marginTop: 1 }}
              />
              <Text
                style={[
                  styles.hostNotesNoticeText,
                  { color: isDark ? colors.text : "#1E293B" },
                ]}
              >
                {activeMethod.notes}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Amount to Pay (PHP)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceInset,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Transaction Reference
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceInset,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder="Enter transaction reference"
          placeholderTextColor={colors.textMuted}
          value={refNum}
          onChangeText={setRefNum}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Upload Receipt Proof
        </Text>
        {imageUri ? (
          <View
            style={[
              styles.imagePreviewContainer,
              { borderColor: colors.border },
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setImageUri(null)}
            >
              <Text style={styles.removeImageText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.uploadBox,
              {
                backgroundColor: colors.surfaceInset,
                borderColor: colors.border,
              },
            ]}
            onPress={handlePickReceipt}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.uploadIconWrap,
                {
                  backgroundColor: isDark
                    ? colors.card
                    : "rgba(15, 23, 42, 0.05)",
                  borderColor: colors.border,
                  borderWidth: isDark ? 1 : 0,
                },
              ]}
            >
              <Feather
                name="upload-cloud"
                size={22}
                color={isDark ? colors.accent : "#0F172A"}
              />
            </View>
            <Text style={[styles.uploadText, { color: colors.text }]}>
              Upload Receipt / Screenshot
            </Text>
            <Text style={[styles.uploadSub, { color: colors.textSecondary }]}>
              Tap to select image to store securely
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Description / Notes (Optional)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              height: 64,
              backgroundColor: colors.surfaceInset,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          multiline
          placeholder="Add memo for roommate host"
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[
            styles.submitBtn,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            },
            uploading && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.submitBtnText}>Uploading Receipt...</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>
              {submitted ? "Payment Submitted" : "Submit Payment Proof"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Menu Modal matching elevated bottom sheet design */}
      <SmoothBottomSheetModal
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Payment Options"
        subtitle="Quick actions for your payment submission"
        icon={<Feather name="credit-card" size={18} color={colors.accent} />}
      >
        <View style={{ paddingTop: 6, paddingBottom: 10 }}>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => {
              setShowMenu(false);
              setAmount(
                liveOutstandingCentavos > 0
                  ? (liveOutstandingCentavos / 100).toFixed(2)
                  : "0.00",
              );
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDark ? colors.surfaceInset : "#EFF6FF",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather name="dollar-sign" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Autofill Outstanding Balance
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                Insert {formatPesos(liveOutstandingCentavos)} into amount field
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => {
              setShowMenu(false);
              setAmount("");
              setRefNum("");
              setNotes("");
              setImageUri(null);
              setSubmitted(false);
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.14)" : "#FFF1F2",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather name="trash-2" size={18} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Clear Form
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                Reset receipt photo, reference, and amount
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={() => {
              setShowMenu(false);
              Alert.alert(
                "Billing Information",
                activeCycle
                  ? `Current Cycle: ${activeCycle.name || "Active Cycle"}\nDates: ${activeCycle.startDate} to ${activeCycle.endDate}`
                  : "No active cycle is currently selected.",
              );
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather
                name="info"
                size={18}
                color={isDark ? colors.text : "#0F172A"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Billing Cycle Details
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                View active cycle dates and period status
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* Lightbox for QR code */}
      <Modal
        visible={Boolean(previewQrModal)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewQrModal(null)}
      >
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setPreviewQrModal(null)}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {previewQrModal ? (
            <Image
              source={{ uri: previewQrModal }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBarContainer: {
    borderBottomWidth: 1,
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
    alignItems: "center",
    justifyContent: "center",
  },
  iconNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  scrollContent: { padding: 20, paddingBottom: 85 },
  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { fontSize: 12, marginTop: 2, marginBottom: 16 },
  dueCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
  },
  dueLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dueAmount: {
    fontSize: 26,
    fontWeight: "900",
    marginVertical: 4,
  },
  dueNote: { fontSize: 11 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  },
  dropdownContainer: {
    marginBottom: 12,
    position: "relative",
    zIndex: 20,
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  dropdownTriggerOpen: {
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  methodIconBadgeSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownSelectedTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  dropdownSelectedSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  qrIndicatorTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  qrIndicatorTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563EB",
  },
  dropdownMenu: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  dropdownMenuHeader: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  dropdownMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownItemTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  dropdownItemSub: {
    fontSize: 11,
    marginTop: 1,
  },
  hostPaymentInfoCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  hostPaymentInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  verifiedHostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  verifiedHostBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  hostMethodTypeTag: {
    fontSize: 11,
    fontWeight: "700",
  },
  accountNumberCopyBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
  },
  accountLabelText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  accountNumberText: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  copyAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  copyAccountBtnSuccess: {
    backgroundColor: "#10B981",
    borderColor: "#059669",
  },
  copyAccountBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  qrDisplayBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginTop: 10,
  },
  qrImageClickable: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  qrDisplayImage: {
    width: "100%",
    height: "100%",
  },
  qrEnlargeHintBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  qrEnlargeHintText: {
    fontSize: 7,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  qrTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  qrSubtitle: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },
  hostNotesNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  hostNotesNoticeText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  lightboxCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 10,
  },
  lightboxImage: {
    width: "85%",
    height: "60%",
    borderRadius: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  uploadBox: {
    height: 128,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uploadText: { fontSize: 13, fontWeight: "700" },
  uploadSub: { fontSize: 11, marginTop: 2 },
  imagePreviewContainer: {
    position: "relative",
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  previewImage: { width: "100%", height: "100%" },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  removeImageText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  submitBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "bold" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
