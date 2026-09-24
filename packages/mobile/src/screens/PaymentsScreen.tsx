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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { formatPesos } from "@propertyflow/shared";
import { uploadToFirebaseStorageMobile } from "../services/firebaseStorageService";
import { auth } from "../firebase/config";
import { mobileDataService } from "../services/firebaseDataService";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavVisibility } from "../context/NavVisibilityContext";

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
  const [profile, setProfile] = useState<any | null>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [memberBills, setMemberBills] = useState<any[]>([]);
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

  useEffect(() => {
    let mounted = true;
    if (!currentUser?.uid) return;
    mobileDataService.getUserProfile(currentUser.uid).then((nextProfile) => {
      if (mounted) setProfile(nextProfile);
    });
    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!resolvedHouseholdId) return;
    return mobileDataService.listenToBillingCycles(
      resolvedHouseholdId,
      setCycles,
    );
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
    if (!amount && myBill?.outstandingCentavos > 0) {
      setAmount((myBill.outstandingCentavos / 100).toFixed(2));
    }
  }, [amount, myBill?.outstandingCentavos]);

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {onBack && (
          <TouchableOpacity
            style={styles.backRow}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color="#2563EB" />
            <Text style={styles.backText}>Back to Bills Overview</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.title}>Make Payment</Text>
        <Text style={styles.subtitle}>
          Settle your roommate share with Firebase proof
        </Text>

        <View style={styles.dueCard}>
          <Text style={styles.dueLabel}>Current Outstanding Dues</Text>
          <Text style={styles.dueAmount}>
            {myBill
              ? formatPesos(myBill.outstandingCentavos || 0)
              : formatPesos(0)}
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
            <Feather
              name="upload-cloud"
              size={28}
              color="#2563EB"
              style={{ marginBottom: 6 }}
            />
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 20, paddingBottom: 85 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 6,
    gap: 6,
  },
  backText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
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
    height: 120,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  uploadText: { fontSize: 13, fontWeight: "700", color: "#2563EB" },
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
