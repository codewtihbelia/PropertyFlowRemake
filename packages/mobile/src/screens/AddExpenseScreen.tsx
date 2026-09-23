import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { uploadToFirebaseStorageMobile } from "../services/firebaseStorageService";
import { auth } from "../firebase/config";
import { mobileDataService } from "../services/firebaseDataService";

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
  }) => void;
}

export const AddExpenseScreen: React.FC<AddExpenseScreenProps> = ({
  onBack,
  onSaveExpense,
}) => {
  const [group, setGroup] = useState("Apartment Roommate");
  const [category, setCategory] = useState("Rent");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [splitMethod, setSplitMethod] = useState<"Equal" | "% Custom">("Equal");
  const [expenseStatus, setExpenseStatus] = useState<"UNPAID" | "PAID">("UNPAID");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<any | null>(null);
  const [activeCycleId, setActiveCycleId] = useState<string | undefined>(undefined);
  const currentApartmentName = profile?.householdName || profile?.apartmentName || "Apartment Roommate";

  const categories = [
    "Rent",
    "Wifi Bills",
    "Groceries",
    "Electricity",
    "Water",
    "Cleaning",
    "Other",
  ];

  useEffect(() => {
    let mounted = true;
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;
    mobileDataService.getUserProfile(currentUser.uid).then((nextProfile) => {
      if (mounted && nextProfile) {
        setProfile(nextProfile);
        const apt = nextProfile.householdName || nextProfile.apartmentName || "Apartment Roommate";
        setGroup(apt);
        if (nextProfile.householdId) {
          mobileDataService.listenToBillingCycles(nextProfile.householdId, (cycles) => {
            if (mounted) {
              const active = cycles.find((c) => c.status === "ACTIVE") || cycles[0];
              if (active) setActiveCycleId(active.billingCycleId);
            }
          });
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handlePickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Denied",
          "Please grant photo library access to upload documents.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    const isHost = profile?.role === "HOST" || profile?.hostApplicationStatus === "APPROVED";
    if (!isHost) {
      Alert.alert(
        "Host Permission Required",
        "Only household hosts can add expenses and record bills. Roommates can view charges and settle balances under Bills."
      );
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid expense amount.");
      return;
    }

    setUploading(true);
    let documentUrl = "";
    const currentUser = auth.currentUser;
    let householdId = profile?.householdId;

    if (!householdId && currentUser?.uid && isHost) {
      const ensured = await mobileDataService.ensureHostHousehold(currentUser.uid, profile);
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

    const expensePayload: any = {
      householdId,
      title: `${category} - ${group}`,
      category,
      amountCents: Math.round(parseFloat(amount) * 100),
      date: new Date().toISOString().slice(0, 10),
      payerName: currentUser.displayName || profile?.displayName || "Host",
      payerId: currentUser.uid,
      recordedBy: currentUser.displayName || profile?.displayName || "Host",
      status: expenseStatus,
      isPaid: expenseStatus === "PAID",
      splitMethod,
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
      title: `${category} - ${group}`,
      amount: parseFloat(amount),
      category,
      splitMethod,
      documentUrl: documentUrl || undefined,
      description: description || undefined,
      status: expenseStatus,
    });

    Alert.alert(
      "Expense Added",
      expenseStatus === "UNPAID"
        ? `₱${amount} added as an UNPAID bill to ${group}. Roommates can settle their share via the Bills & Payments screen.`
        : `₱${amount} successfully logged as paid.`
    );
    onBack();
  };

  const isHost = profile ? (profile.role === "HOST" || profile.hostApplicationStatus === "APPROVED") : true;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Expense</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {profile && !isHost && (
          <View style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 14, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#991B1B", marginBottom: 2 }}>Host Permission Required</Text>
            <Text style={{ fontSize: 12, color: "#B91C1C", lineHeight: 16 }}>
              You are signed in as a resident. Only household hosts can add expenses and record bills. Roommates can review charges and pay their share in the Bills tab.
            </Text>
          </View>
        )}
        {/* Groups Horizontal Selector matching proposedUI */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.groupsRow}
        >
          <TouchableOpacity
            style={[
              styles.groupPill,
              (group === currentApartmentName || group === "Apartment Roommate") && styles.groupPillActive,
            ]}
            onPress={() => setGroup(currentApartmentName)}
          >
            <Text
              style={[
                styles.groupPillTitle,
                (group === currentApartmentName || group === "Apartment Roommate") && styles.groupPillTitleActive,
              ]}
            >
              {currentApartmentName}
            </Text>
            <Text
              style={[
                styles.groupPillSub,
                (group === currentApartmentName || group === "Apartment Roommate") && styles.groupPillSubActive,
              ]}
            >
              Active Household
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.groupPill,
              group === "Trip Expense" && styles.groupPillActive,
            ]}
            onPress={() => setGroup("Trip Expense")}
          >
            <Text
              style={[
                styles.groupPillTitle,
                group === "Trip Expense" && styles.groupPillTitleActive,
              ]}
            >
              Trip Expense
            </Text>
            <Text
              style={[
                styles.groupPillSub,
                group === "Trip Expense" && styles.groupPillSubActive,
              ]}
            >
              Total Expenses: ₱873
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Category Dropdown/Selector */}
        <Text style={styles.label}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesRow}
        >
          {categories.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.catBtn, category === c && styles.catBtnActive]}
              onPress={() => setCategory(c)}
            >
              <Text
                style={[
                  styles.catBtnText,
                  category === c && styles.catBtnTextActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Amount Field */}
        <Text style={styles.label}>Amount (₱ Pesos)</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        {/* Firebase Storage Document / Image Upload matching proposedUI */}
        <Text style={styles.label}>Document (Optional)</Text>
        <TouchableOpacity
          style={styles.uploadDashedBox}
          onPress={handlePickImage}
        >
          {imageUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <Text style={styles.changeText}>Tap to change receipt</Text>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <View style={styles.uploadIconWrap}>
                <Text style={{ fontSize: 22 }}>🖼️</Text>
              </View>
              <Text style={styles.uploadTitle}>Upload Image or Receipt</Text>
              <Text style={styles.uploadSub}>
                Stored securely in Firebase Storage
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Description Input */}
        <Text style={styles.label}>Description (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Master room rent share or Wifi monthly dues"
          value={description}
          onChangeText={setDescription}
        />

        {/* Split Method matching proposedUI */}
        <Text style={styles.label}>Split Method</Text>
        <View style={styles.splitToggleWrap}>
          <TouchableOpacity
            style={[
              styles.splitBtn,
              splitMethod === "Equal" && styles.splitBtnActive,
            ]}
            onPress={() => setSplitMethod("Equal")}
          >
            <Text
              style={[
                styles.splitBtnText,
                splitMethod === "Equal" && styles.splitBtnTextActive,
              ]}
            >
              Equal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.splitBtn,
              splitMethod === "% Custom" && styles.splitBtnActive,
            ]}
            onPress={() => setSplitMethod("% Custom")}
          >
            <Text
              style={[
                styles.splitBtnText,
                splitMethod === "% Custom" && styles.splitBtnTextActive,
              ]}
            >
              % Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bill Payment Status Selector */}
        <Text style={styles.label}>Bill Payment Status</Text>
        <View style={styles.statusToggleWrap}>
          <TouchableOpacity
            style={[
              styles.statusToggleBtn,
              expenseStatus === "UNPAID" && styles.statusToggleBtnUnpaidActive,
            ]}
            onPress={() => setExpenseStatus("UNPAID")}
          >
            <Text
              style={[
                styles.statusToggleText,
                expenseStatus === "UNPAID" && styles.statusToggleTextUnpaidActive,
              ]}
            >
              ⏳ Unpaid Bill (To Collect)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusToggleBtn,
              expenseStatus === "PAID" && styles.statusToggleBtnPaidActive,
            ]}
            onPress={() => setExpenseStatus("PAID")}
          >
            <Text
              style={[
                styles.statusToggleText,
                expenseStatus === "PAID" && styles.statusToggleTextPaidActive,
              ]}
            >
              ✓ Already Paid
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.statusHelperText}>
          {expenseStatus === "UNPAID"
            ? "• Default for cycle expenses. Logged as an UNPAID bill. Roommates will see this in Bills & Dues and pay their share through their Payment screens."
            : "• This bill has already been settled upfront in full."}
        </Text>

        {/* Action Button matching proposedUI */}
        <TouchableOpacity
          style={[styles.updateBtn, (!isHost || uploading) && { opacity: 0.6, backgroundColor: !isHost ? '#94A3B8' : '#2563EB' }]}
          onPress={handleSave}
          disabled={uploading || !isHost}
        >
          <Text style={styles.updateBtnText}>
            {!isHost ? "Host Permission Required" : uploading ? "Uploading..." : "Save Expense"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  backBtnText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: -2,
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  scrollContent: { padding: 20 },
  groupsRow: { marginBottom: 16 },
  groupPill: {
    backgroundColor: "#F1F5F9",
    borderRadius: 18,
    padding: 14,
    marginRight: 10,
    minWidth: 160,
  },
  groupPillActive: { backgroundColor: "#2563EB" },
  groupPillTitle: { fontSize: 12, fontWeight: "800", color: "#334155" },
  groupPillTitleActive: { color: "#FFFFFF" },
  groupPillSub: { fontSize: 10, color: "#64748B", marginTop: 2 },
  groupPillSubActive: { color: "#DBEAFE" },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginTop: 14,
    marginBottom: 8,
  },
  categoriesRow: { flexDirection: "row", marginBottom: 4 },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 8,
  },
  catBtnActive: { backgroundColor: "#EFF6FF", borderColor: "#2563EB" },
  catBtnText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  catBtnTextActive: { color: "#2563EB", fontWeight: "800" },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  uploadDashedBox: {
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadPlaceholder: { alignItems: "center" },
  uploadIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  uploadTitle: { color: "#2563EB", fontSize: 13, fontWeight: "800" },
  uploadSub: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  previewContainer: { alignItems: "center", width: "100%" },
  previewImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    resizeMode: "cover",
  },
  changeText: {
    color: "#2563EB",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
  splitToggleWrap: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
  },
  splitBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  splitBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  splitBtnText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  splitBtnTextActive: { color: "#2563EB" },
  statusToggleWrap: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  statusToggleBtnUnpaidActive: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statusToggleBtnPaidActive: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statusToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  statusToggleTextUnpaidActive: {
    color: "#B91C1C",
  },
  statusToggleTextPaidActive: {
    color: "#047857",
  },
  statusHelperText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 6,
    lineHeight: 16,
  },
  updateBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  updateBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
