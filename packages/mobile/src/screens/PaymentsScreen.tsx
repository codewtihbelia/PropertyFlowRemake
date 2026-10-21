import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Share,
  Keyboard,
  NativeModules,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, {
  Rect,
  Circle,
  Path,
  Line,
  Text as SvgText,
} from "react-native-svg";
import { formatPesos } from "@propertyflow/shared";
import { uploadToFirebaseStorageMobile } from "../services/firebaseStorageService";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  isPayorMember,
  isCyclePaymentsLocked,
  HostPaymentMethod,
  DEFAULT_HOST_PAYMENT_METHODS,
  computeCycleWaterBreakdown,
  matchesMemberUid,
} from "../services/firebaseDataService";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { useTheme } from "../context/ThemeContext";

export interface PaymentsScreenProps {
  householdId?: string;
  billingCycleId?: string;
  initialAmountCentavos?: number;
  initialAmount?: string;
  onBack?: () => void;
}

interface CompletedPaymentReceipt {
  amountCentavos: number;
  referenceNumber: string;
  paymentMethodName: string;
  paymentMethodType: string;
  receiverAccountName: string;
  receiverAccountNumber: string;
  payerName: string;
  payerEmail: string;
  householdName: string;
  hostName: string;
  billingCycleName: string;
  billingCyclePeriod: string;
  remainingBalanceCentavos: number;
  notes?: string;
  proofUrl?: string;
  formattedDate: string;
  formattedTime: string;
}

export const PaymentsScreen: React.FC<PaymentsScreenProps> = ({
  householdId,
  billingCycleId,
  initialAmountCentavos,
  initialAmount,
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
  const { onScroll, hideNav, showNav, keyboardHeight, isKeyboardVisible } =
    useNavVisibility();
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
  const [copiedRefSuccess, setCopiedRefSuccess] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [receiptSaved, setReceiptSaved] = useState(false);
  const [completedPayment, setCompletedPayment] =
    useState<CompletedPaymentReceipt | null>(null);
  const successScrollRef = useRef<ScrollView | null>(null);
  const hasScrolledSuccessTopRef = useRef<boolean>(false);
  const receiptCaptureRef = useRef<View | null>(null);
  const svgReceiptRef = useRef<any>(null);
  const [amount, setAmount] = useState(() => {
    if (initialAmount) return initialAmount;
    if (
      typeof initialAmountCentavos === "number" &&
      initialAmountCentavos > 0
    ) {
      return (initialAmountCentavos / 100).toFixed(2);
    }
    return "";
  });
  const [refNum, setRefNum] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(() => !householdId);
  const [profile, setProfile] = useState<any | null>(null);
  const [household, setHousehold] = useState<any | null>(() =>
    mobileDataService.getCachedHousehold(),
  );
  const [cycles, setCycles] = useState<any[]>([]);
  const [memberBills, setMemberBills] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [cycleAttendance, setCycleAttendance] = useState<any[]>([]);
  const [attendanceSubmissions, setAttendanceSubmissions] = useState<
    Record<string, any>
  >({});
  const [payments, setPayments] = useState<any[]>([]);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (completedPayment) {
      Keyboard.dismiss();
      hideNav();
      hasScrolledSuccessTopRef.current = false;
      successScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      const t1 = setTimeout(() => {
        successScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      }, 0);
      const t2 = setTimeout(() => {
        successScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      }, 60);
      const t3 = setTimeout(() => {
        successScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      }, 150);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        showNav();
      };
    } else {
      showNav();
    }
    return () => {
      showNav();
    };
  }, [completedPayment, hideNav, showNav]);

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
  const isHostUser =
    profile?.role === "HOST" ||
    profile?.role === "SUPER_ADMIN" ||
    Boolean(currentUser?.uid && household?.hostId === currentUser.uid);
  const isPaymentsLocked =
    isCyclePaymentsLocked(activeCycle, household) && !isHostUser;

  const activePayors = useMemo(() => {
    const seen = new Set<string>();
    const deduplicated: any[] = [];
    members.forEach((m) => {
      const canonical =
        (m.userId || "").replace(/^mem_/, "").trim() ||
        (m.memberId || "").replace(/^mem_/, "").trim() ||
        (m.id || "").replace(/^mem_/, "").trim();
      const email = (m.email || "").trim().toLowerCase();
      const key = canonical || email || m.id;
      if (!seen.has(key)) {
        seen.add(key);
        if (canonical) seen.add(canonical);
        if (email) seen.add(email);
        deduplicated.push(m);
      }
    });
    const list = deduplicated.filter(
      (m) => m.status === "ACTIVE" && isPayorMember(m),
    );
    return list.length > 0
      ? list
      : deduplicated.filter((m) => m.status === "ACTIVE");
  }, [members]);

  const currentCycleExpenses = useMemo(() => {
    return resolvedBillingCycleId
      ? expenses.filter((e) =>
          e.billingCycleId
            ? e.billingCycleId === resolvedBillingCycleId
            : cycles.length <= 1,
        )
      : expenses;
  }, [expenses, resolvedBillingCycleId, cycles.length]);

  const liveOutstandingCentavos = useMemo(() => {
    const payorCount = Math.max(1, activePayors.length);
    const unpaidExpenses = currentCycleExpenses.filter(
      (e) => e.status !== "PAID" && !e.isPaid,
    );
    const liveShare = unpaidExpenses.reduce((sum, e) => {
      const isWater = (e.category || "").toLowerCase().includes("water");
      if (isWater) {
        const isPersonDayMode =
          waterConfig?.pricingModel === "PER_PERSON_DAY" ||
          !waterConfig?.pricingModel;
        if (isPersonDayMode) {
          const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
          const { getPayorShareCentavos } = computeCycleWaterBreakdown(
            members,
            cycleAttendance,
            attendanceSubmissions,
            rate,
            e.splitDetails,
          );
          return sum + getPayorShareCentavos(currentUser?.uid);
        }
        if (waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH") {
          return sum + Number(waterConfig?.fixedPerPersonAmountCentavos || 0);
        }
        const mySplit = e.splitDetails?.find((s: any) =>
          matchesMemberUid(s, currentUser?.uid),
        );
        if (mySplit && typeof mySplit.shareCentavos === "number") {
          return sum + mySplit.shareCentavos;
        }
        return sum + Math.round((e.amountCents || 0) / payorCount);
      }

      const splitPayors = e.splitDetails
        ? e.splitDetails.filter((s: any) => !s.isExempt && s.shareCentavos > 0)
        : [];
      const isSplitStale =
        splitPayors.length > 0 && splitPayors.length !== payorCount;
      if (
        !isSplitStale &&
        e.splitDetails &&
        currentUser?.uid &&
        typeof e.splitDetails.find((s: any) =>
          matchesMemberUid(s, currentUser.uid),
        )?.shareCentavos === "number"
      ) {
        const mySplit = e.splitDetails.find((s: any) =>
          matchesMemberUid(s, currentUser.uid),
        );
        if (mySplit?.isPaid) return sum;
        return sum + (mySplit?.shareCentavos || 0);
      }
      return sum + Math.round(e.amountCents / payorCount);
    }, 0);

    const userPaidCentavos = payments
      .filter(
        (p) =>
          p.userId === currentUser?.uid &&
          (!resolvedBillingCycleId ||
            p.billingCycleId === resolvedBillingCycleId),
      )
      .reduce((sum, p) => sum + (p.amountCentavos || 0), 0);

    return Math.max(0, liveShare - userPaidCentavos);
  }, [
    currentCycleExpenses,
    activePayors,
    members,
    cycleAttendance,
    attendanceSubmissions,
    waterConfig,
    currentUser?.uid,
    payments,
    resolvedBillingCycleId,
  ]);

  useEffect(() => {
    if (
      typeof initialAmountCentavos === "number" &&
      initialAmountCentavos > 0
    ) {
      setAmount((initialAmountCentavos / 100).toFixed(2));
    } else if (liveOutstandingCentavos > 0 && !amount) {
      setAmount((liveOutstandingCentavos / 100).toFixed(2));
    }
  }, [liveOutstandingCentavos, initialAmountCentavos]);

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

    const unsubWater = mobileDataService.listenToWaterConfig(
      resolvedHouseholdId,
      setWaterConfig,
    );

    const unsubPayments = mobileDataService.listenToPayments(
      resolvedHouseholdId,
      (data: any) => setPayments(data),
    );

    const unsubHousehold = mobileDataService.listenToHousehold(
      resolvedHouseholdId,
      (hh) => {
        setHousehold(hh);
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
      unsubWater();
      unsubPayments();
      unsubHousehold();
    };
  }, [resolvedHouseholdId]);

  useEffect(() => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId) return;
    const unsubAtt = mobileDataService.listenToHouseholdCycleAttendance(
      resolvedHouseholdId,
      resolvedBillingCycleId,
      setCycleAttendance,
    );
    const unsubSubs = mobileDataService.listenToAttendanceSubmissions(
      resolvedHouseholdId,
      resolvedBillingCycleId,
      setAttendanceSubmissions,
    );
    return () => {
      unsubAtt();
      unsubSubs();
    };
  }, [resolvedHouseholdId, resolvedBillingCycleId]);

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
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
        setImageBase64(result.assets[0].base64 || null);
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

    if (isPaymentsLocked) {
      Alert.alert(
        "Payments Locked by Host",
        "Your household host has not opened payments for this billing cycle yet. Please wait until bills are finalized and opened by the host.",
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
            imageBase64 || undefined,
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

      const now = new Date();
      const formattedDate = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const formattedTime = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      const hostMemberObj = members.find((m: any) => m.role === "HOST");
      const resolvedHostName =
        household?.hostName ||
        hostMemberObj?.displayName ||
        hostMemberObj?.name ||
        "Property Host";
      const resolvedGroupName =
        household?.householdName ||
        household?.name ||
        profile?.householdName ||
        profile?.apartmentName ||
        "Household Group";
      const resolvedPayerName =
        profile?.displayName ||
        profile?.fullName ||
        currentUser.displayName ||
        "Resident";
      const remainingAfterPayment = Math.max(
        0,
        liveOutstandingCentavos - amountCentavos,
      );

      setSubmitted(true);
      setReceiptSaved(false);
      setCopiedRefSuccess(false);
      setCompletedPayment({
        amountCentavos,
        referenceNumber: finalRef,
        paymentMethodName: activeMethod.name,
        paymentMethodType: activeMethod.type || "GCASH",
        receiverAccountName: activeMethod.accountName || resolvedHostName,
        receiverAccountNumber:
          activeMethod.accountNumber ||
          (activeMethod.qrCodeUrl ? "Host QR Code" : "Direct Handover"),
        payerName: resolvedPayerName,
        payerEmail: currentUser.email || profile?.email || "",
        householdName: resolvedGroupName,
        hostName: resolvedHostName,
        billingCycleName: activeCycle?.name || "Active Billing Cycle",
        billingCyclePeriod:
          activeCycle?.startDate && activeCycle?.endDate
            ? `${activeCycle.startDate} to ${activeCycle.endDate}`
            : "Current Period",
        remainingBalanceCentavos: remainingAfterPayment,
        notes: notes.trim() || undefined,
        proofUrl: imageUri || uploadedReceiptUrl || undefined,
        formattedDate,
        formattedTime,
      });
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

  const handleCopyReference = (refCode: string) => {
    if (!refCode) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(refCode);
    }
    setCopiedRefSuccess(true);
    setTimeout(() => setCopiedRefSuccess(false), 2500);
  };

  const handleSaveReceiptSnapshot = async () => {
    if (!completedPayment || savingReceipt) return;
    setSavingReceipt(true);

    try {
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        const scale = 2;
        const width = 460;
        const height = completedPayment.notes ? 720 : 670;
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.scale(scale, scale);

          // Background
          ctx.fillStyle = "#F8FAFC";
          ctx.fillRect(0, 0, width, height);

          // Receipt Outer Card
          const cardX = 24;
          const cardY = 24;
          const cardW = width - 48;
          const cardH = height - 48;

          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "#E2E8F0";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, 24);
          ctx.fill();
          ctx.stroke();

          // Sparkle dots matching Create Group Success Screen
          const cx = width / 2;
          const badgeY = cardY + 58;
          const sparkles = [
            { dx: -24, dy: -36, r: 3, color: "#34D399" },
            { dx: 34, dy: -24, r: 4, color: "#10B981" },
            { dx: -36, dy: 22, r: 3.5, color: "#6EE7B7" },
            { dx: 26, dy: 34, r: 2.5, color: "#34D399" },
            { dx: -44, dy: -4, r: 2, color: "#10B981" },
            { dx: 44, dy: 4, r: 2.5, color: "#6EE7B7" },
          ];
          sparkles.forEach((s) => {
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(cx + s.dx, badgeY + s.dy, s.r, 0, Math.PI * 2);
            ctx.fill();
          });

          // Green Star Badge Circle
          ctx.save();
          ctx.shadowColor = "rgba(16, 185, 129, 0.35)";
          ctx.shadowBlur = 16;
          ctx.shadowOffsetY = 6;
          ctx.fillStyle = "#10B981";
          ctx.beginPath();
          ctx.arc(cx, badgeY, 30, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Checkmark inside circle
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 3.5;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(cx - 10, badgeY + 1);
          ctx.lineTo(cx - 3, badgeY + 8);
          ctx.lineTo(cx + 11, badgeY - 7);
          ctx.stroke();

          // Title & Subtitle
          ctx.fillStyle = "#0F172A";
          ctx.font =
            "800 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Payment Recorded Successfully", cx, badgeY + 58);

          ctx.fillStyle = "#64748B";
          ctx.font =
            "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText(
            `OFFICIAL PAYMENT RECEIPT • ${completedPayment.householdName.toUpperCase()}`,
            cx,
            badgeY + 78,
          );

          // Dashed Amount & Reference Box
          const boxX = cardX + 22;
          const boxY = badgeY + 96;
          const boxW = cardW - 44;
          const boxH = 108;

          ctx.save();
          ctx.fillStyle = "#F0FDF4";
          ctx.strokeStyle = "#86EFAC";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 16);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = "#15803D";
          ctx.font =
            "800 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("TOTAL AMOUNT PAID", cx, boxY + 24);

          ctx.fillStyle = "#0F172A";
          ctx.font =
            "900 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText(
            formatPesos(completedPayment.amountCentavos),
            cx,
            boxY + 60,
          );

          ctx.fillStyle = "#047857";
          ctx.font = "700 12px monospace";
          ctx.fillText(
            `REF: ${completedPayment.referenceNumber}`,
            cx,
            boxY + 88,
          );

          // Detail Rows
          const rows: Array<{
            label: string;
            value: string;
            highlight?: boolean;
          }> = [
            {
              label: "Date & Time",
              value: `${completedPayment.formattedDate} • ${completedPayment.formattedTime}`,
            },
            {
              label: "Paid By (Payor)",
              value: completedPayment.payerEmail
                ? `${completedPayment.payerName} (${completedPayment.payerEmail})`
                : completedPayment.payerName,
            },
            {
              label: "Household Group",
              value: `${completedPayment.householdName} (Host: ${completedPayment.hostName})`,
            },
            {
              label: "Billing Cycle",
              value: `${completedPayment.billingCycleName} (${completedPayment.billingCyclePeriod})`,
            },
            {
              label: "Payment Channel",
              value: completedPayment.paymentMethodName,
            },
            {
              label: "Receiver Account",
              value: `${completedPayment.receiverAccountName} • ${completedPayment.receiverAccountNumber}`,
            },
            {
              label: "Remaining Cycle Balance",
              value:
                completedPayment.remainingBalanceCentavos <= 0
                  ? "₱0.00 (Fully Settled)"
                  : formatPesos(completedPayment.remainingBalanceCentavos),
              highlight: completedPayment.remainingBalanceCentavos <= 0,
            },
          ];

          if (completedPayment.notes) {
            rows.push({
              label: "Payment Memo",
              value: completedPayment.notes,
            });
          }

          let currentY = boxY + boxH + 28;
          rows.forEach((r, idx) => {
            ctx.textAlign = "left";
            ctx.fillStyle = "#64748B";
            ctx.font =
              "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.fillText(r.label, boxX, currentY);

            ctx.textAlign = "right";
            ctx.fillStyle = r.highlight ? "#059669" : "#0F172A";
            ctx.font =
              "700 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            const maxValChars = 36;
            const valStr =
              r.value.length > maxValChars
                ? r.value.slice(0, maxValChars - 1) + "…"
                : r.value;
            ctx.fillText(valStr, boxX + boxW, currentY);

            if (idx < rows.length - 1) {
              ctx.strokeStyle = "#F1F5F9";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(boxX, currentY + 12);
              ctx.lineTo(boxX + boxW, currentY + 12);
              ctx.stroke();
            }
            currentY += 34;
          });

          // Footer verification stamp
          ctx.textAlign = "center";
          ctx.fillStyle = "#10B981";
          ctx.font =
            "700 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText(
            "✓ Verified & Recorded on Splitzy Household Ledger",
            cx,
            cardY + cardH - 22,
          );

          const dataUrl = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.download = `Splitzy-Receipt-${completedPayment.referenceNumber}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        setReceiptSaved(true);
      } else {
        const getOptionalExpoModule = (name: string): any => {
          try {
            return (
              (globalThis as any)?.expo?.modules?.[name] ??
              (NativeModules as any)?.[name] ??
              null
            );
          } catch {
            return null;
          }
        };

        const nativeFS = getOptionalExpoModule("ExponentFileSystem");
        const normalizeDir = (p?: string | null) =>
          p ? p.replace(/\/*$/, "") + "/" : "";

        const fileBaseName = `Splitzy-Receipt-${completedPayment.referenceNumber}`;
        const fileName = `${fileBaseName}.png`;
        const cacheDir =
          normalizeDir(nativeFS?.cacheDirectory) ||
          normalizeDir(nativeFS?.documentDirectory);
        const localFileUri = cacheDir ? `${cacheDir}${fileName}` : "";

        let base64Png: string | null = null;
        let capturedFileUri: string | null = null;

        // 1. Try native RNViewShot ONLY if its native module is compiled into the binary
        const hasNativeViewShot = Boolean(getOptionalExpoModule("RNViewShot"));
        if (hasNativeViewShot && receiptCaptureRef.current) {
          try {
            const ViewShot = require("react-native-view-shot");
            const captureFn =
              ViewShot.captureRef || ViewShot.default?.captureRef;
            if (captureFn) {
              await new Promise((res) => setTimeout(res, 50));
              base64Png = await captureFn(receiptCaptureRef, {
                format: "png",
                quality: 1,
                result: "base64",
              });
            }
          } catch {
            // Silently fall back to react-native-svg toDataURL
          }
        }

        // 2. Built-in native rasterizer via react-native-svg (already compiled in APK)
        if (!base64Png && svgReceiptRef.current?.toDataURL) {
          try {
            base64Png = await new Promise<string | null>((resolve) => {
              let settled = false;
              const timer = setTimeout(() => {
                if (!settled) {
                  settled = true;
                  resolve(null);
                }
              }, 2500);
              svgReceiptRef.current.toDataURL(
                (data: string) => {
                  if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(data ? data.replace(/\s+/g, "") : null);
                  }
                },
                {
                  width: 920,
                  height: (completedPayment.notes ? 720 : 670) * 2,
                },
              );
            });
          } catch {
            base64Png = null;
          }
        }

        if (base64Png) {
          const cleanB64 = base64Png.replace(/^data:image\/\w+;base64,/, "");
          base64Png = cleanB64;
          if (localFileUri && nativeFS?.writeAsStringAsync) {
            try {
              await nativeFS.writeAsStringAsync(localFileUri, cleanB64, {
                encoding: "base64",
              });
              capturedFileUri = localFileUri;
            } catch {
              capturedFileUri = null;
            }
          }
        }

        let savedToGallery = false;

        // 3A. Check silently via globalThis.expo.modules so it NEVER throws
        // "Cannot find native module 'ExpoMediaLibraryNext'" when not compiled in APK
        const nativeMediaLib = getOptionalExpoModule("ExpoMediaLibrary");

        if (nativeMediaLib && capturedFileUri) {
          try {
            let perm: any;
            try {
              perm = await nativeMediaLib.requestPermissionsAsync(true);
            } catch {
              perm = await nativeMediaLib.requestPermissionsAsync(false);
            }
            if (perm?.granted) {
              await nativeMediaLib.saveToLibraryAsync(capturedFileUri);
              savedToGallery = true;
            }
          } catch {
            // Fall through to StorageAccessFramework
          }
        }

        // 3B. Android StorageAccessFramework fallback (compiled into existing APK via ExponentFileSystem)
        if (
          !savedToGallery &&
          Platform.OS === "android" &&
          base64Png &&
          nativeFS?.createSAFFileAsync &&
          nativeFS?.writeAsStringAsync
        ) {
          const SAF_KEY = "@splitzy_receipt_gallery_dir_uri";
          let targetDirUri = await AsyncStorage.getItem(SAF_KEY);

          if (targetDirUri) {
            try {
              const safFileUri = await nativeFS.createSAFFileAsync(
                targetDirUri,
                fileBaseName,
                "image/png",
              );
              await nativeFS.writeAsStringAsync(safFileUri, base64Png, {
                encoding: "base64",
              });
              savedToGallery = true;
            } catch {
              targetDirUri = null;
            }
          }

          if (!savedToGallery && nativeFS?.requestDirectoryPermissionsAsync) {
            try {
              const defaultPicturesUri =
                "content://com.android.externalstorage.documents/tree/primary:Pictures/document/primary:Pictures";
              const dirPerm =
                await nativeFS.requestDirectoryPermissionsAsync(
                  defaultPicturesUri,
                );
              if (dirPerm?.granted && dirPerm?.directoryUri) {
                await AsyncStorage.setItem(SAF_KEY, dirPerm.directoryUri);
                const safFileUri = await nativeFS.createSAFFileAsync(
                  dirPerm.directoryUri,
                  fileBaseName,
                  "image/png",
                );
                await nativeFS.writeAsStringAsync(safFileUri, base64Png, {
                  encoding: "base64",
                });
                savedToGallery = true;
              }
            } catch {
              // Fall through if user cancels directory picker
            }
          }
        }

        if (savedToGallery) {
          setReceiptSaved(true);
          Alert.alert(
            "Saved to Gallery",
            `Receipt snapshot (${fileName}) has been downloaded to your photo gallery.`,
          );
        } else if (capturedFileUri) {
          // If user dismissed SAF folder prompt or on iOS without MediaLibrary linked
          await Share.share({
            title: fileName,
            url: capturedFileUri,
            message: `Official Splitzy Payment Receipt (${completedPayment.referenceNumber})`,
          });
          setReceiptSaved(true);
        }
      }
    } catch (err) {
      console.warn("[PaymentsScreen] Receipt snapshot save error:", err);
      Alert.alert(
        "Could Not Save Snapshot",
        "Unable to save the receipt snapshot right now. Please try again.",
      );
    } finally {
      setSavingReceipt(false);
    }
  };

  // --------------------------------------------------------------------------
  // VIEW: FULL-SCREEN PAYMENT SUCCESS & RECEIPT (Modeled after Create Group Success)
  // --------------------------------------------------------------------------
  if (completedPayment) {
    return (
      <View
        key="payment-success-root"
        style={[
          styles.container,
          { backgroundColor: isDark ? colors.background : "#F8FAFC" },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent={true}
          backgroundColor="transparent"
        />

        {/* Top Minimal Header */}
        <View
          style={[
            styles.navBarContainer,
            {
              paddingTop: topInset,
              backgroundColor: isDark ? colors.background : "#F8FAFC",
              borderBottomColor: isDark ? colors.border : "#E2E8F0",
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
              onPress={() => {
                setCompletedPayment(null);
                if (onBack) onBack();
              }}
              activeOpacity={0.7}
            >
              <Feather
                name="chevron-left"
                size={24}
                color={isDark ? colors.text : "#0F172A"}
              />
            </TouchableOpacity>
            <Text style={[styles.navTitle, { color: colors.text }]}>
              Payment Receipt
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
              onPress={handleSaveReceiptSnapshot}
              activeOpacity={0.7}
            >
              <Feather
                name={receiptSaved ? "check" : "download"}
                size={20}
                color={
                  receiptSaved ? "#10B981" : isDark ? colors.text : "#0F172A"
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          key={`payment-success-scroll-${completedPayment.referenceNumber}`}
          ref={successScrollRef}
          contentOffset={{ x: 0, y: 0 }}
          onLayout={() => {
            if (!hasScrolledSuccessTopRef.current) {
              successScrollRef.current?.scrollTo({
                x: 0,
                y: 0,
                animated: false,
              });
            }
          }}
          onContentSizeChange={() => {
            if (!hasScrolledSuccessTopRef.current) {
              hasScrolledSuccessTopRef.current = true;
              successScrollRef.current?.scrollTo({
                x: 0,
                y: 0,
                animated: false,
              });
            }
          }}
          contentContainerStyle={[
            styles.successScrollContent,
            { paddingBottom: Math.max(insets.bottom + 48, 80) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Capturable Receipt Snapshot Region for Gallery Download */}
          <View
            ref={receiptCaptureRef}
            collapsable={false}
            style={[
              styles.capturableReceiptWrap,
              { backgroundColor: isDark ? colors.background : "#F8FAFC" },
            ]}
          >
            {/* Celebratory Green Star Badge with Sparkles (Matched to Create Group Success Screen) */}
            <View style={styles.badgeWrapper}>
              <View
                style={[
                  styles.sparkleDot,
                  {
                    top: 4,
                    left: 26,
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#34D399",
                  },
                ]}
              />
              <View
                style={[
                  styles.sparkleDot,
                  {
                    top: 18,
                    right: 10,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#10B981",
                  },
                ]}
              />
              <View
                style={[
                  styles.sparkleDot,
                  {
                    bottom: 16,
                    left: 8,
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: "#6EE7B7",
                  },
                ]}
              />
              <View
                style={[
                  styles.sparkleDot,
                  {
                    bottom: 6,
                    right: 24,
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: "#34D399",
                  },
                ]}
              />
              <View
                style={[
                  styles.sparkleDot,
                  {
                    top: 42,
                    left: 2,
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "#10B981",
                  },
                ]}
              />
              <View
                style={[
                  styles.sparkleDot,
                  {
                    top: 48,
                    right: 2,
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: "#6EE7B7",
                  },
                ]}
              />

              <View style={styles.starBadgeCircle}>
                <Feather name="check" size={32} color="#FFFFFF" />
              </View>
            </View>

            <Text style={[styles.successTitle, { color: colors.text }]}>
              Payment Recorded Successfully
            </Text>
            <Text
              style={[styles.successSubtitle, { color: colors.textSecondary }]}
            >
              Your payment of{" "}
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {formatPesos(completedPayment.amountCentavos)}
              </Text>{" "}
              for{" "}
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {completedPayment.householdName}
              </Text>{" "}
              has been recorded and credited to your billing cycle.
            </Text>

            {/* Dashed Reference & Hero Amount Box (Matched to Create Group Success Invite Box) */}
            <View
              style={[
                styles.receiptHeroBox,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.receiptStatusBadge}>
                <Feather name="check-circle" size={12} color="#059669" />
                <Text style={styles.receiptStatusBadgeText}>
                  RECORDED & CREDITED
                </Text>
              </View>

              <Text
                style={[
                  styles.receiptHeroLabel,
                  { color: colors.textSecondary },
                ]}
              >
                TOTAL AMOUNT PAID
              </Text>
              <Text style={[styles.receiptHeroAmount, { color: colors.text }]}>
                {formatPesos(completedPayment.amountCentavos)}
              </Text>

              <View
                style={[
                  styles.receiptHeroDivider,
                  { backgroundColor: isDark ? colors.border : "#E2E8F0" },
                ]}
              />

              <Text
                style={[
                  styles.receiptHeroLabel,
                  { color: colors.textSecondary },
                ]}
              >
                TRANSACTION REFERENCE
              </Text>
              <Text
                style={[
                  styles.receiptRefCodeText,
                  { color: isDark ? colors.accent : "#0F172A" },
                ]}
                selectable
              >
                {completedPayment.referenceNumber}
              </Text>

              <TouchableOpacity
                style={[
                  styles.copyRefBtn,
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                  },
                  copiedRefSuccess && styles.copyRefBtnSuccess,
                ]}
                onPress={() =>
                  handleCopyReference(completedPayment.referenceNumber)
                }
                activeOpacity={0.8}
              >
                <Feather
                  name={copiedRefSuccess ? "check" : "copy"}
                  size={14}
                  color={
                    copiedRefSuccess
                      ? "#FFFFFF"
                      : isDark
                        ? colors.text
                        : "#0F172A"
                  }
                />
                <Text
                  style={[
                    styles.copyRefBtnText,
                    isDark && { color: colors.text },
                    copiedRefSuccess && { color: "#FFFFFF" },
                  ]}
                >
                  {copiedRefSuccess ? "Reference Copied!" : "Copy Reference"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Full Payment Information Receipt Card */}
            <View
              style={[
                styles.receiptDetailsCard,
                {
                  backgroundColor: isDark ? colors.card : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <View
                style={[
                  styles.receiptCardHeader,
                  { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                ]}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={[
                      styles.receiptCardHeaderIcon,
                      {
                        backgroundColor: isDark
                          ? "rgba(16, 185, 129, 0.15)"
                          : "#ECFDF5",
                      },
                    ]}
                  >
                    <Ionicons
                      name="receipt-outline"
                      size={16}
                      color={isDark ? "#34D399" : "#059669"}
                    />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.receiptCardHeaderTitle,
                        { color: colors.text },
                      ]}
                    >
                      Full Payment Information
                    </Text>
                    <Text
                      style={[
                        styles.receiptCardHeaderSub,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Official Splitzy Household Receipt
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.receiptVerifiedTag,
                    isDark && {
                      backgroundColor: "rgba(59, 130, 246, 0.15)",
                      borderColor: "rgba(59, 130, 246, 0.3)",
                    },
                  ]}
                >
                  <Feather
                    name="shield"
                    size={11}
                    color={isDark ? colors.accent : "#2563EB"}
                  />
                  <Text
                    style={[
                      styles.receiptVerifiedTagText,
                      { color: isDark ? colors.accent : "#2563EB" },
                    ]}
                  >
                    Verified
                  </Text>
                </View>
              </View>

              {/* Detail Rows */}
              <View style={styles.receiptRowsContainer}>
                <View
                  style={[
                    styles.receiptInfoRow,
                    { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                  ]}
                >
                  <Text
                    style={[
                      styles.receiptInfoLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Date & Time
                  </Text>
                  <Text
                    style={[styles.receiptInfoValue, { color: colors.text }]}
                  >
                    {completedPayment.formattedDate} •{" "}
                    {completedPayment.formattedTime}
                  </Text>
                </View>

                <View
                  style={[
                    styles.receiptInfoRow,
                    { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                  ]}
                >
                  <Text
                    style={[
                      styles.receiptInfoLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Paid By (Payor)
                  </Text>
                  <View
                    style={{ alignItems: "flex-end", flex: 1, marginLeft: 12 }}
                  >
                    <Text
                      style={[styles.receiptInfoValue, { color: colors.text }]}
                    >
                      {completedPayment.payerName}
                    </Text>
                    {completedPayment.payerEmail ? (
                      <Text
                        style={[
                          styles.receiptInfoSubValue,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {completedPayment.payerEmail}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View
                  style={[
                    styles.receiptInfoRow,
                    { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                  ]}
                >
                  <Text
                    style={[
                      styles.receiptInfoLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Household Group
                  </Text>
                  <View
                    style={{ alignItems: "flex-end", flex: 1, marginLeft: 12 }}
                  >
                    <Text
                      style={[styles.receiptInfoValue, { color: colors.text }]}
                    >
                      {completedPayment.householdName}
                    </Text>
                    <Text
                      style={[
                        styles.receiptInfoSubValue,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Host: {completedPayment.hostName}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.receiptInfoRow,
                    { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                  ]}
                >
                  <Text
                    style={[
                      styles.receiptInfoLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Billing Cycle
                  </Text>
                  <View
                    style={{ alignItems: "flex-end", flex: 1, marginLeft: 12 }}
                  >
                    <Text
                      style={[styles.receiptInfoValue, { color: colors.text }]}
                    >
                      {completedPayment.billingCycleName}
                    </Text>
                    <Text
                      style={[
                        styles.receiptInfoSubValue,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {completedPayment.billingCyclePeriod}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.receiptInfoRow,
                    { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                  ]}
                >
                  <Text
                    style={[
                      styles.receiptInfoLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Payment Method
                  </Text>
                  <Text
                    style={[styles.receiptInfoValue, { color: colors.text }]}
                  >
                    {completedPayment.paymentMethodName}
                  </Text>
                </View>

                <View
                  style={[
                    styles.receiptInfoRow,
                    { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                  ]}
                >
                  <Text
                    style={[
                      styles.receiptInfoLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Receiver Account
                  </Text>
                  <View
                    style={{ alignItems: "flex-end", flex: 1, marginLeft: 12 }}
                  >
                    <Text
                      style={[styles.receiptInfoValue, { color: colors.text }]}
                    >
                      {completedPayment.receiverAccountName}
                    </Text>
                    <Text
                      style={[
                        styles.receiptInfoSubValue,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {completedPayment.receiverAccountNumber}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.receiptInfoRow,
                    !completedPayment.notes &&
                      !completedPayment.proofUrl && { borderBottomWidth: 0 },
                    { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                  ]}
                >
                  <Text
                    style={[
                      styles.receiptInfoLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Remaining Cycle Dues
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={[
                        styles.receiptInfoValue,
                        {
                          color:
                            completedPayment.remainingBalanceCentavos <= 0
                              ? isDark
                                ? "#34D399"
                                : "#059669"
                              : colors.text,
                        },
                      ]}
                    >
                      {formatPesos(completedPayment.remainingBalanceCentavos)}
                    </Text>
                    {completedPayment.remainingBalanceCentavos <= 0 && (
                      <View style={styles.settledMiniPill}>
                        <Text style={styles.settledMiniPillText}>
                          Fully Settled
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {completedPayment.notes ? (
                  <View
                    style={[
                      styles.receiptInfoRow,
                      !completedPayment.proofUrl && { borderBottomWidth: 0 },
                      { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.receiptInfoLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Payment Memo
                    </Text>
                    <Text
                      style={[
                        styles.receiptInfoValue,
                        {
                          color: colors.text,
                          flex: 1,
                          textAlign: "right",
                          marginLeft: 16,
                        },
                      ]}
                    >
                      {completedPayment.notes}
                    </Text>
                  </View>
                ) : null}

                {completedPayment.proofUrl ? (
                  <View style={styles.receiptProofSection}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={[
                          styles.receiptInfoLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Attached Payment Proof
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setPreviewQrModal(completedPayment.proofUrl || null)
                        }
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: isDark ? colors.accent : "#2563EB",
                          }}
                        >
                          Tap to Enlarge
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.receiptProofThumbWrap,
                        { borderColor: isDark ? colors.border : "#E2E8F0" },
                      ]}
                      activeOpacity={0.85}
                      onPress={() =>
                        setPreviewQrModal(completedPayment.proofUrl || null)
                      }
                    >
                      <Image
                        source={{ uri: completedPayment.proofUrl }}
                        style={styles.receiptProofThumb}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Snapshot Saved Confirmation Banner */}
          {receiptSaved && (
            <View
              style={[
                styles.snapshotSavedBanner,
                isDark && {
                  backgroundColor: "rgba(16, 185, 129, 0.14)",
                  borderColor: "rgba(16, 185, 129, 0.35)",
                },
              ]}
            >
              <Feather
                name="check-circle"
                size={16}
                color={isDark ? "#34D399" : "#059669"}
              />
              <Text
                style={[
                  styles.snapshotSavedBannerText,
                  { color: isDark ? "#34D399" : "#065F46" },
                ]}
              >
                Receipt snapshot automatically downloaded to your gallery (
                <Text style={{ fontWeight: "800" }}>
                  Splitzy-Receipt-{completedPayment.referenceNumber}.png
                </Text>
                )
              </Text>
            </View>
          )}

          {/* Action Buttons (Matched to Create Group Success Screen) */}
          <View style={{ width: "100%", gap: 12 }}>
            <TouchableOpacity
              style={[
                styles.successPrimaryPillBtn,
                receiptSaved && {
                  backgroundColor: "#10B981",
                  shadowColor: "#10B981",
                },
                !receiptSaved &&
                  isDark && {
                    backgroundColor: colors.primary,
                    shadowColor: colors.primary,
                  },
              ]}
              onPress={handleSaveReceiptSnapshot}
              disabled={savingReceipt}
              activeOpacity={0.85}
            >
              {savingReceipt ? (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.successPrimaryPillBtnText}>
                    Downloading Snapshot to Gallery...
                  </Text>
                </View>
              ) : (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Feather
                    name={receiptSaved ? "check-circle" : "download"}
                    size={17}
                    color="#FFFFFF"
                  />
                  <Text style={styles.successPrimaryPillBtnText}>
                    {receiptSaved
                      ? "Saved to Gallery • Download Again"
                      : "Save Receipt Snapshot"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.successSecondaryOutlineBtn,
                {
                  backgroundColor: isDark ? colors.card : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                },
              ]}
              onPress={() => {
                setCompletedPayment(null);
                if (onBack) onBack();
              }}
              activeOpacity={0.85}
            >
              <Feather
                name="check"
                size={16}
                color={isDark ? colors.text : "#0F172A"}
              />
              <Text
                style={[
                  styles.successSecondaryOutlineBtnText,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Done • Back to Bills
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.successTertiaryTextBtn}
              onPress={() => {
                setCompletedPayment(null);
                setSubmitted(false);
                setRefNum("");
                setNotes("");
                setImageUri(null);
                setImageBase64(null);
                setReceiptSaved(false);
              }}
            >
              <Text
                style={[
                  styles.successTertiaryTextBtnLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Record Another Payment
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Offscreen Native Vector Receipt Renderer (react-native-svg toDataURL) */}
        <View
          pointerEvents="none"
          collapsable={false}
          style={{
            position: "absolute",
            left: -2000,
            top: 0,
            width: 460,
            height: completedPayment.notes ? 720 : 670,
            opacity: 0,
          }}
        >
          {(() => {
            const svgW = 460;
            const svgH = completedPayment.notes ? 720 : 670;
            const cardX = 24;
            const cardY = 24;
            const cardW = svgW - 48;
            const cardH = svgH - 48;
            const cx = svgW / 2;
            const badgeY = cardY + 58;
            const boxX = cardX + 22;
            const boxY = badgeY + 96;
            const boxW = cardW - 44;
            const boxH = 108;

            const svgRows: Array<{
              label: string;
              value: string;
              highlight?: boolean;
            }> = [
              {
                label: "Date & Time",
                value: `${completedPayment.formattedDate} • ${completedPayment.formattedTime}`,
              },
              {
                label: "Paid By (Payor)",
                value: completedPayment.payerEmail
                  ? `${completedPayment.payerName} (${completedPayment.payerEmail})`
                  : completedPayment.payerName,
              },
              {
                label: "Household Group",
                value: `${completedPayment.householdName} (Host: ${completedPayment.hostName})`,
              },
              {
                label: "Billing Cycle",
                value: `${completedPayment.billingCycleName} (${completedPayment.billingCyclePeriod})`,
              },
              {
                label: "Payment Channel",
                value: completedPayment.paymentMethodName,
              },
              {
                label: "Receiver Account",
                value: `${completedPayment.receiverAccountName} • ${completedPayment.receiverAccountNumber}`,
              },
              {
                label: "Remaining Cycle Balance",
                value:
                  completedPayment.remainingBalanceCentavos <= 0
                    ? "₱0.00 (Fully Settled)"
                    : formatPesos(completedPayment.remainingBalanceCentavos),
                highlight: completedPayment.remainingBalanceCentavos <= 0,
              },
            ];

            if (completedPayment.notes) {
              svgRows.push({
                label: "Payment Memo",
                value: completedPayment.notes,
              });
            }

            return (
              <Svg
                ref={svgReceiptRef}
                width={svgW}
                height={svgH}
                viewBox={`0 0 ${svgW} ${svgH}`}
              >
                <Rect x={0} y={0} width={svgW} height={svgH} fill="#F8FAFC" />
                <Rect
                  x={cardX}
                  y={cardY}
                  width={cardW}
                  height={cardH}
                  rx={24}
                  ry={24}
                  fill="#FFFFFF"
                  stroke="#E2E8F0"
                  strokeWidth={1.5}
                />
                <Circle cx={cx - 24} cy={badgeY - 36} r={3} fill="#34D399" />
                <Circle cx={cx + 34} cy={badgeY - 24} r={4} fill="#10B981" />
                <Circle cx={cx - 36} cy={badgeY + 22} r={3.5} fill="#6EE7B7" />
                <Circle cx={cx + 26} cy={badgeY + 34} r={2.5} fill="#34D399" />
                <Circle cx={cx} cy={badgeY} r={30} fill="#10B981" />
                <Path
                  d={`M ${cx - 10} ${badgeY + 1} L ${cx - 3} ${badgeY + 8} L ${cx + 11} ${badgeY - 7}`}
                  stroke="#FFFFFF"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <SvgText
                  x={cx}
                  y={badgeY + 58}
                  fill="#0F172A"
                  fontSize="19"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  Payment Recorded Successfully
                </SvgText>
                <SvgText
                  x={cx}
                  y={badgeY + 78}
                  fill="#64748B"
                  fontSize="11"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {`OFFICIAL PAYMENT RECEIPT • ${completedPayment.householdName.toUpperCase()}`}
                </SvgText>
                <Rect
                  x={boxX}
                  y={boxY}
                  width={boxW}
                  height={boxH}
                  rx={16}
                  ry={16}
                  fill="#F0FDF4"
                  stroke="#86EFAC"
                  strokeWidth={1.5}
                  strokeDasharray="5, 4"
                />
                <SvgText
                  x={cx}
                  y={boxY + 24}
                  fill="#15803D"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  TOTAL AMOUNT PAID
                </SvgText>
                <SvgText
                  x={cx}
                  y={boxY + 60}
                  fill="#0F172A"
                  fontSize="28"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {formatPesos(completedPayment.amountCentavos)}
                </SvgText>
                <SvgText
                  x={cx}
                  y={boxY + 88}
                  fill="#047857"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {`REF: ${completedPayment.referenceNumber}`}
                </SvgText>

                {svgRows.map((r, idx) => {
                  const rowY = boxY + boxH + 28 + idx * 34;
                  const maxValChars = 36;
                  const valStr =
                    r.value.length > maxValChars
                      ? r.value.slice(0, maxValChars - 1) + "…"
                      : r.value;
                  return (
                    <React.Fragment key={r.label}>
                      <SvgText
                        x={boxX}
                        y={rowY}
                        fill="#64748B"
                        fontSize="12"
                        fontWeight="600"
                        textAnchor="start"
                      >
                        {r.label}
                      </SvgText>
                      <SvgText
                        x={boxX + boxW}
                        y={rowY}
                        fill={r.highlight ? "#059669" : "#0F172A"}
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="end"
                      >
                        {valStr}
                      </SvgText>
                      {idx < svgRows.length - 1 ? (
                        <Line
                          x1={boxX}
                          y1={rowY + 12}
                          x2={boxX + boxW}
                          y2={rowY + 12}
                          stroke="#F1F5F9"
                          strokeWidth={1}
                        />
                      ) : null}
                    </React.Fragment>
                  );
                })}

                <SvgText
                  x={cx}
                  y={cardY + cardH - 22}
                  fill="#10B981"
                  fontSize="11"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ✓ Verified & Recorded on Splitzy Household Ledger
                </SvgText>
              </Svg>
            );
          })()}
        </View>

        {/* Lightbox for Proof Preview */}
        <Modal
          visible={Boolean(previewQrModal)}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewQrModal(null)}
          statusBarTranslucent={true}
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
  }

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
    <View
      key="payment-form-root"
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingBottom: insets.bottom },
      ]}
    >
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? topInset : 0}
      >
        <ScrollView
          key="payment-form-scroll"
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Math.max(
                120,
                insets.bottom + (isKeyboardVisible ? keyboardHeight + 40 : 95),
              ),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            Settle Dues
          </Text>
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
              style={[
                styles.dueLabel,
                { color: isDark ? "#60A5FA" : "#1E40AF" },
              ]}
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
              {activeMethod.customIconUrl ? (
                <View
                  style={[
                    styles.customIconBadgeSmall,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: activeMethod.customIconUrl }}
                    style={styles.customIconImgSmall}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <View
                  style={[
                    styles.methodIconBadgeSmall,
                    {
                      backgroundColor: getMethodBadge(activeMethod.type)
                        .bgColor,
                    },
                  ]}
                >
                  <Feather
                    name={getMethodBadge(activeMethod.type).icon as any}
                    size={16}
                    color={getMethodBadge(activeMethod.type).color}
                  />
                </View>
              )}

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
                      {m.customIconUrl ? (
                        <View
                          style={[
                            styles.customIconBadgeSmall,
                            isDark && {
                              backgroundColor: colors.surfaceInset,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Image
                            source={{ uri: m.customIconUrl }}
                            style={styles.customIconImgSmall}
                            resizeMode="cover"
                          />
                        </View>
                      ) : (
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
                      )}

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
                                color: isSelected
                                  ? colors.primary
                                  : colors.text,
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
              {/* <View
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
              </View> */}
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                {activeMethod.customIconUrl ? (
                  <View
                    style={[
                      styles.customIconBadgeSmall,
                      { width: 32, height: 24 },
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: activeMethod.customIconUrl }}
                      style={styles.customIconImgSmall}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}
                <Text
                  style={[
                    styles.hostMethodTypeTag,
                    { color: colors.textSecondary },
                  ]}
                >
                  {activeMethod.name}
                </Text>
              </View>
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
                  {/* <Text
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
                  </Text> */}
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

          {isPaymentsLocked ? (
            <View
              style={[
                styles.submitBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(245, 158, 11, 0.15)"
                    : "#FEF3C7",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(245, 158, 11, 0.35)" : "#FCD34D",
                  shadowOpacity: 0,
                  elevation: 0,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                },
              ]}
            >
              <Feather
                name="lock"
                size={16}
                color={isDark ? "#FBBF24" : "#B45309"}
              />
              <Text
                style={[
                  styles.submitBtnText,
                  { color: isDark ? "#FBBF24" : "#92400E" },
                ]}
              >
                Bills Under Review · Payments Locked
              </Text>
            </View>
          ) : (
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
          )}
        </ScrollView>
      </KeyboardAvoidingView>

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
        statusBarTranslucent={true}
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
  scrollContent: { padding: 20, paddingBottom: 96 },
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
  customIconBadgeSmall: {
    width: 38,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  customIconImgSmall: {
    width: "100%",
    height: "100%",
  },
  // Full-Screen Payment Success & Receipt Styles (Modeled after Create Group Success)
  successScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: "center",
  },
  capturableReceiptWrap: {
    width: "100%",
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  badgeWrapper: {
    width: 110,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  sparkleDot: {
    position: "absolute",
    backgroundColor: "#34D399",
  },
  starBadgeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  receiptHeroBox: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    marginBottom: 18,
  },
  receiptStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  receiptStatusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.6,
  },
  receiptHeroLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#64748B",
    marginBottom: 4,
  },
  receiptHeroAmount: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 4,
  },
  receiptHeroDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 14,
  },
  receiptRefCodeText: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#0F172A",
    marginBottom: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  copyRefBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  copyRefBtnSuccess: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  copyRefBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  receiptDetailsCard: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 18,
  },
  receiptCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  receiptCardHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptCardHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  receiptCardHeaderSub: {
    fontSize: 11,
    marginTop: 1,
  },
  receiptVerifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  receiptVerifiedTagText: {
    fontSize: 10,
    fontWeight: "800",
  },
  receiptRowsContainer: {
    paddingHorizontal: 16,
  },
  receiptInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  receiptInfoLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  receiptInfoValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  receiptInfoSubValue: {
    fontSize: 11,
    marginTop: 2,
  },
  settledMiniPill: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  settledMiniPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },
  receiptProofSection: {
    paddingVertical: 12,
  },
  receiptProofThumbWrap: {
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  receiptProofThumb: {
    width: "100%",
    height: "100%",
  },
  snapshotSavedBanner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
  },
  snapshotSavedBannerText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 17,
  },
  successPrimaryPillBtn: {
    width: "100%",
    backgroundColor: "#0F172A",
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  successPrimaryPillBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  successSecondaryOutlineBtn: {
    width: "100%",
    borderRadius: 999,
    paddingVertical: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  successSecondaryOutlineBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  successTertiaryTextBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  successTertiaryTextBtnLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});
