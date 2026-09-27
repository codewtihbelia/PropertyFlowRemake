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
} from "../services/firebaseDataService";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";

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
  const currentUser = auth.currentUser;

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
  const myBill = memberBills.find((bill) => bill.userId === currentUser?.uid);

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
        Array.isArray(e.splitDetails) &&
        e.splitDetails.length > 0
      ) {
        const mySplit = e.splitDetails.find(
          (s: any) => s.userId === currentUser?.uid,
        );
        if (mySplit && typeof mySplit.shareCentavos === "number") {
          return sum + mySplit.shareCentavos;
        }
      }
      return sum + Math.round(e.amountCents / payorCount);
    }, 0);
    const paidCentavos =
      myBill && typeof myBill.totalPaidCentavos === "number"
        ? myBill.totalPaidCentavos
        : 0;
    return Math.max(0, liveShare - paidCentavos);
  }, [activePayors, expenses, currentUser?.uid, myBill]);

  useEffect(() => {
    let mounted = true;
    if (!currentUser?.uid) return;
    mobileDataService.getUserProfile(currentUser.uid).then((nextProfile) => {
      if (mounted) {
        setProfile(nextProfile);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!resolvedHouseholdId) return;
    const unsubCycles = mobileDataService.listenToBillingCycles(
      resolvedHouseholdId,
      setCycles,
    );
    const unsubExp = mobileDataService.listenToExpenses(
      resolvedHouseholdId,
      setExpenses,
    );
    const unsubMem = mobileDataService.listenToHouseholdMembers(
      resolvedHouseholdId,
      setMembers,
    );
    return () => {
      unsubCycles();
      unsubExp();
      unsubMem();
    };
  }, [resolvedHouseholdId]);

  useEffect(() => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId) return;
    return mobileDataService.listenToMemberBills(
      resolvedHouseholdId,
      resolvedBillingCycleId,
      setMemberBills,
    );
  }, [resolvedBillingCycleId, resolvedHouseholdId]);

  useEffect(() => {
    if (!amount && liveOutstandingCentavos > 0) {
      setAmount((liveOutstandingCentavos / 100).toFixed(2));
    }
  }, [amount, liveOutstandingCentavos]);

  const handlePickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Denied",
        "Please grant photo library access to upload payment receipts.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser?.uid || !resolvedHouseholdId || !resolvedBillingCycleId) {
      Alert.alert(
        "Missing Cloud Setup",
        "Your account is not connected to a Firebase household and billing cycle yet.",
      );
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
      return;
    }
    if (!refNum.trim()) {
      Alert.alert(
        "Missing Reference",
        "Please enter the transaction reference number.",
      );
      return;
    }

    setUploading(true);
    let uploadedReceiptUrl: string | undefined;

    try {
      if (imageUri) {
        uploadedReceiptUrl = await uploadToFirebaseStorageMobile(
          imageUri,
          `payment_proofs/${resolvedHouseholdId}/mobile`,
        );
      }

      const paymentMethodMap = {
        GCash: "GCASH",
        Maya: "MAYA",
        Cash: "CASH",
        "Bank Transfer": "BANK_TRANSFER",
      } as const;

      const amountCentavos = Math.round(parseFloat(amount) * 100);
      await mobileDataService.submitPayment({
        householdId: resolvedHouseholdId,
        billingCycleId: resolvedBillingCycleId,
        userId: currentUser.uid,
        userName: currentUser.displayName || profile?.displayName || "Resident",
        amountCentavos,
        paymentMethod: paymentMethodMap[method],
        referenceNumber: refNum.trim(),
        proofOfPaymentUrl: uploadedReceiptUrl,
        notes,
      });

      setSubmitted(true);
      Alert.alert(
        "Payment Submitted",
        `Your payment of ${formatPesos(amountCentavos)} via ${method} has been submitted for host verification.`,
      );
    } catch {
      Alert.alert(
        "Upload Error",
        "Could not save this payment in Firebase. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading && !resolvedHouseholdId) {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          translucent={true}
          backgroundColor="transparent"
        />
        <View style={[styles.navBarContainer, { paddingTop: topInset }]}>
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.circleBackBtn}
              onPress={() => (onBack ? onBack() : null)}
              activeOpacity={0.7}
            >
              <Feather name="chevron-left" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.navTitle}>Make Payment</Text>
            <View style={{ width: 44 }} />
          </View>
        </View>
        <UniversalSkeleton type="bills" />
      </View>
    );
  }

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
          <Text style={styles.navTitle}>Make Payment</Text>
          <TouchableOpacity
            style={styles.iconNavBtn}
            onPress={() => setShowMenu(true)}
            activeOpacity={0.7}
          >
            <Feather name="more-vertical" size={22} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Text style={styles.title}>Settle Dues</Text>
        <Text style={styles.subtitle}>
          Settle your roommate share with payment proof
        </Text>

        <View style={styles.dueCard}>
          <Text style={styles.dueLabel}>Current Outstanding Dues</Text>
          <Text style={styles.dueAmount}>
            {formatPesos(liveOutstandingCentavos)}
          </Text>
          <Text style={styles.dueNote}>
            {activeCycle
              ? `${activeCycle.name || "Active billing cycle"} from Firebase`
              : "No active Firebase billing cycle found"}
          </Text>
        </View>

        <Text style={styles.label}>Payment Method</Text>
        <View style={styles.methodList}>
          {(["GCash", "Maya", "Cash", "Bank Transfer"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.methodItem,
                method === m && styles.methodItemSelected,
              ]}
              onPress={() => setMethod(m)}
            >
              <Text
                style={[
                  styles.methodText,
                  method === m && styles.methodTextSelected,
                ]}
              >
                {m}
              </Text>
              <View
                style={[
                  styles.radioCircle,
                  method === m && styles.radioCircleSelected,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Amount to Pay (PHP)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>Transaction Reference</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter transaction reference"
          value={refNum}
          onChangeText={setRefNum}
        />

        <Text style={styles.label}>Upload Receipt Proof</Text>
        {imageUri ? (
          <View style={styles.imagePreviewContainer}>
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
            style={styles.uploadBox}
            onPress={handlePickReceipt}
          >
            <View style={styles.uploadIconWrap}>
              <Feather name="upload-cloud" size={24} color="#0F172A" />
            </View>
            <Text style={styles.uploadText}>Upload Receipt / Screenshot</Text>
            <Text style={styles.uploadSub}>
              Tap to select image to store securely
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Description / Notes (Optional)</Text>
        <TextInput
          style={[styles.input, { height: 60 }]}
          multiline
          placeholder="Add memo for roommate host"
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
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
        icon={<Feather name="credit-card" size={18} color="#2563EB" />}
      >
        <View style={{ paddingTop: 6, paddingBottom: 10 }}>
          <TouchableOpacity
            style={styles.menuItem}
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
                backgroundColor: "#EFF6FF",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather name="dollar-sign" size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>
                Autofill Outstanding Balance
              </Text>
              <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                Insert {formatPesos(liveOutstandingCentavos)} into amount field
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
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
                backgroundColor: "#FFF1F2",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather name="trash-2" size={18} color="#E11D48" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Clear Form</Text>
              <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                Reset receipt photo, reference, and amount
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
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
                backgroundColor: "#F8FAFC",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather name="info" size={18} color="#0F172A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Billing Cycle Details</Text>
              <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                View active cycle dates and period status
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  menuHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  scrollContent: { padding: 20, paddingBottom: 85 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 6,
    gap: 8,
  },
  backIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  title: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 2, marginBottom: 16 },
  dueCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  dueLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E40AF",
    textTransform: "uppercase",
  },
  dueAmount: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1E3A8A",
    marginVertical: 4,
  },
  dueNote: { fontSize: 11, color: "#3B82F6" },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginTop: 14,
    marginBottom: 6,
  },
  methodList: { gap: 8, marginBottom: 6 },
  methodItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  methodItemSelected: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  methodText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  methodTextSelected: { color: "#2563EB", fontWeight: "bold" },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
  },
  radioCircleSelected: { borderColor: "#2563EB", backgroundColor: "#2563EB" },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  uploadBox: {
    height: 128,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  uploadIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uploadText: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  uploadSub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  imagePreviewContainer: {
    position: "relative",
    height: 160,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    backgroundColor: "#2563EB",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#2563EB",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "bold" },
});
