import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  Switch,
  Modal,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  HostPaymentMethod,
  DEFAULT_HOST_PAYMENT_METHODS,
} from "../services/firebaseDataService";
import { uploadToFirebaseStorageMobile } from "../services/firebaseStorageService";
import {
  POPULAR_BANK_PRESETS,
  BankPreset,
  findBankPresetByNameOrType,
} from "../utils/bankIcons";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { useTheme } from "../context/ThemeContext";
import { assets } from "../../assets/assets";

export interface PaymentMethodConfigurationScreenProps {
  onBack: () => void;
  householdId?: string;
  onOpenHostApplication?: () => void;
}

export const PaymentMethodConfigurationScreen: React.FC<
  PaymentMethodConfigurationScreenProps
> = ({ onBack, householdId: propHouseholdId, onOpenHostApplication }) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const firebaseUser = auth.currentUser;

  const cachedProfile = mobileDataService.getCachedProfile(firebaseUser?.uid);
  const cachedHousehold = cachedProfile
    ? mobileDataService.getCachedHousehold()
    : null;

  const [profile, setProfile] = useState<any | null>(() => cachedProfile);
  const [household, setHousehold] = useState<any | null>(() => cachedHousehold);
  const [methods, setMethods] = useState<HostPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit / Add Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [formType, setFormType] = useState<
    "GCASH" | "MAYA" | "BANK_TRANSFER" | "CASH" | "OTHER"
  >("GCASH");
  const [formName, setFormName] = useState("GCash");
  const [formAccountName, setFormAccountName] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formQrCodeUrl, setFormQrCodeUrl] = useState<string | undefined>(
    undefined,
  );
  const [formCustomIconUrl, setFormCustomIconUrl] = useState<
    string | undefined
  >(undefined);
  const [formNotes, setFormNotes] = useState("");
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // QR Lightbox preview
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);

  const resolvedHouseholdId =
    propHouseholdId ||
    profile?.householdId ||
    household?.householdId ||
    household?.id ||
    "";

  const isHost = Boolean(
    profile?.role === "HOST" ||
    profile?.role === "SUPER_ADMIN" ||
    profile?.hostApplicationStatus === "APPROVED" ||
    (household?.hostId &&
      firebaseUser?.uid &&
      household.hostId === firebaseUser.uid),
  );

  // Profile and Household listeners
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    const unsubProfile = mobileDataService.listenToUserProfile(
      firebaseUser.uid,
      (p) => {
        setProfile(p);
      },
    );
    return () => unsubProfile();
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!resolvedHouseholdId) {
      setLoading(false);
      return;
    }
    const unsubHousehold = mobileDataService.listenToHousehold(
      resolvedHouseholdId,
      (hh) => {
        setHousehold(hh);
        if (hh && Array.isArray(hh.paymentMethods)) {
          setMethods(hh.paymentMethods);
        } else {
          setMethods(DEFAULT_HOST_PAYMENT_METHODS);
        }
        setLoading(false);
      },
    );
    return () => unsubHousehold();
  }, [resolvedHouseholdId]);

  const handleOpenAddModal = (
    defaultType:
      | "GCASH"
      | "MAYA"
      | "BANK_TRANSFER"
      | "CASH"
      | "OTHER" = "GCASH",
  ) => {
    setEditingMethodId(null);
    setFormType(defaultType);
    const defaultNames = {
      GCASH: "GCash",
      MAYA: "Maya",
      BANK_TRANSFER: "Bank Transfer",
      CASH: "Cash Handover",
      OTHER: "Other E-Wallet / Bank",
    };
    setFormName(defaultNames[defaultType] || "Payment Method");
    setFormAccountName(profile?.displayName || profile?.name || "");
    setFormAccountNumber("");
    setFormQrCodeUrl(undefined);
    setFormCustomIconUrl(undefined);
    setFormNotes(
      defaultType === "CASH"
        ? "Please pay directly to the property host and request confirmation."
        : "Please include your room number in transfer remarks.",
    );
    setFormIsEnabled(true);
    setShowEditModal(true);
  };

  const handleOpenEditModal = (method: HostPaymentMethod) => {
    setEditingMethodId(method.id);
    setFormType(method.type);
    setFormName(method.name);
    setFormAccountName(method.accountName);
    setFormAccountNumber(method.accountNumber);
    setFormQrCodeUrl(method.qrCodeUrl);
    setFormCustomIconUrl(method.customIconUrl);
    setFormNotes(method.notes || "");
    setFormIsEnabled(method.isEnabled);
    setShowEditModal(true);
  };

  const handlePickQrImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please grant photo library access to upload your payment QR code.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const localUri = result.assets[0].uri;
        const base64 = result.assets[0].base64;
        setUploadingQr(true);
        try {
          const downloadUrl = await uploadToFirebaseStorageMobile(
            localUri,
            `payment_qr_codes/${resolvedHouseholdId || "general"}`,
            base64 || undefined,
          );
          setFormQrCodeUrl(downloadUrl);
          setUploadingQr(false);
          Alert.alert("QR Code Uploaded", "Your payment QR code is ready.");
        } catch (uploadErr: any) {
          setUploadingQr(false);
          Alert.alert(
            "Upload Notice",
            uploadErr?.message || "Using photo representation for QR code.",
          );
          if (localUri) setFormQrCodeUrl(localUri);
        }
      }
    } catch {
      setUploadingQr(false);
      Alert.alert("Error", "Could not pick image. Please try again.");
    }
  };

  const handlePickCustomIconImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please grant photo library access to upload a custom bank/channel icon.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const localUri = result.assets[0].uri;
        const base64 = result.assets[0].base64;
        setUploadingIcon(true);
        try {
          const downloadUrl = await uploadToFirebaseStorageMobile(
            localUri,
            `payment_bank_icons/${resolvedHouseholdId || "general"}`,
            base64 || undefined,
          );
          setFormCustomIconUrl(downloadUrl);
          setUploadingIcon(false);
          Alert.alert("Bank Icon Set", "Custom icon attached successfully.");
        } catch (uploadErr: any) {
          setUploadingIcon(false);
          Alert.alert(
            "Upload Notice",
            uploadErr?.message ||
              "Using local image representation for bank icon.",
          );
          if (localUri) setFormCustomIconUrl(localUri);
        }
      }
    } catch {
      setUploadingIcon(false);
      Alert.alert("Error", "Could not pick image. Please try again.");
    }
  };

  const handleToggleMethod = async (id: string, currentEnabled: boolean) => {
    if (!resolvedHouseholdId) return;
    const updated = methods.map((m) =>
      m.id === id ? { ...m, isEnabled: !currentEnabled } : m,
    );
    setMethods(updated);
    try {
      await mobileDataService.updateHouseholdPaymentMethods(
        resolvedHouseholdId,
        updated,
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update payment method.");
    }
  };

  const handleDeleteMethod = (id: string, name: string) => {
    if (!resolvedHouseholdId) return;
    Alert.alert(
      "Delete Payment Method",
      `Are you sure you want to remove "${name}"? Payors will no longer see this option when settling dues.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updated = methods.filter((m) => m.id !== id);
            setMethods(updated);
            try {
              await mobileDataService.updateHouseholdPaymentMethods(
                resolvedHouseholdId,
                updated,
              );
              Alert.alert("Deleted", `"${name}" removed successfully.`);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete method.");
            }
          },
        },
      ],
    );
  };

  const handleSaveMethod = async () => {
    if (!resolvedHouseholdId) {
      Alert.alert("Missing Household", "No active household found.");
      return;
    }

    if (!formName.trim()) {
      Alert.alert("Required", "Please provide a name for this payment method.");
      return;
    }

    if (formType !== "CASH" && !formAccountNumber.trim() && !formQrCodeUrl) {
      Alert.alert(
        "Account Details Needed",
        "Please provide an account number or upload a QR code so payors know where to send money.",
      );
      return;
    }

    setSaving(true);
    try {
      let updatedMethods: HostPaymentMethod[];
      if (editingMethodId) {
        // Edit existing
        updatedMethods = methods.map((m) => {
          if (m.id === editingMethodId) {
            return {
              ...m,
              type: formType,
              name: formName.trim(),
              accountName: formAccountName.trim(),
              accountNumber: formAccountNumber.trim(),
              qrCodeUrl: formQrCodeUrl,
              customIconUrl: formCustomIconUrl || undefined,
              notes: formNotes.trim(),
              isEnabled: formIsEnabled,
              updatedAt: new Date().toISOString(),
            };
          }
          return m;
        });
      } else {
        // Add new
        const newMethod: HostPaymentMethod = {
          id: `pm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: formType,
          name: formName.trim(),
          accountName: formAccountName.trim(),
          accountNumber: formAccountNumber.trim(),
          qrCodeUrl: formQrCodeUrl,
          customIconUrl: formCustomIconUrl || undefined,
          notes: formNotes.trim(),
          isEnabled: formIsEnabled,
          updatedAt: new Date().toISOString(),
        };
        updatedMethods = [...methods, newMethod];
      }

      await mobileDataService.updateHouseholdPaymentMethods(
        resolvedHouseholdId,
        updatedMethods,
      );
      setMethods(updatedMethods);
      setSaving(false);
      setShowEditModal(false);
      Alert.alert(
        "Success",
        editingMethodId
          ? "Payment method updated successfully."
          : "New payment method added for your household.",
      );
    } catch (err: any) {
      setSaving(false);
      Alert.alert("Error", err.message || "Could not save payment method.");
    }
  };

  const getMethodVisuals = (type: string) => {
    switch (type) {
      case "GCASH":
        return {
          icon: "credit-card",
          color: "#0284C7",
          bgColor: isDark ? "rgba(2, 132, 199, 0.16)" : "#E0F2FE",
          borderColor: isDark ? "rgba(2, 132, 199, 0.3)" : "#BAE6FD",
          badgeText: "GCash",
        };
      case "MAYA":
        return {
          icon: "smartphone",
          color: "#059669",
          bgColor: isDark ? "rgba(5, 150, 105, 0.16)" : "#D1FAE5",
          borderColor: isDark ? "rgba(5, 150, 105, 0.3)" : "#A7F3D0",
          badgeText: "Maya",
        };
      case "BANK_TRANSFER":
        return {
          icon: "briefcase",
          color: "#7C3AED",
          bgColor: isDark ? "rgba(124, 58, 237, 0.16)" : "#EDE9FE",
          borderColor: isDark ? "rgba(124, 58, 237, 0.3)" : "#DDD6FE",
          badgeText: "Bank",
        };
      case "CASH":
        return {
          icon: "dollar-sign",
          color: "#D97706",
          bgColor: isDark ? "rgba(217, 119, 6, 0.16)" : "#FEF3C7",
          borderColor: isDark ? "rgba(217, 119, 6, 0.3)" : "#FDE68A",
          badgeText: "Cash",
        };
      default:
        return {
          icon: "credit-card",
          color: "#475569",
          bgColor: isDark ? "rgba(71, 85, 105, 0.16)" : "#F1F5F9",
          borderColor: isDark ? "rgba(71, 85, 105, 0.3)" : "#E2E8F0",
          badgeText: "Other",
        };
    }
  };

  // Host Guard: If user is verified non-host, show restriction guard
  if (!loading && !isHost) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent
          backgroundColor="transparent"
        />
        <View style={styles.header}>
          <TouchableOpacity
            style={[
              styles.backBtn,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={onBack}
          >
            <Feather
              name="arrow-left"
              size={20}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && { color: colors.text }]}>
            Payment Methods
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.restrictedContainer}>
          <View
            style={[
              styles.restrictedIconWrap,
              isDark && {
                backgroundColor: "rgba(217, 119, 6, 0.15)",
                borderColor: "rgba(217, 119, 6, 0.3)",
              },
            ]}
          >
            <Feather
              name="lock"
              size={36}
              color={isDark ? colors.warning : "#D97706"}
            />
          </View>
          <Text
            style={[styles.restrictedTitle, isDark && { color: colors.text }]}
          >
            Host Privilege Required
          </Text>
          <Text
            style={[
              styles.restrictedSubtitle,
              isDark && { color: colors.textSecondary },
            ]}
          >
            Only verified Property Hosts can configure household payment
            methods, account numbers, and QR codes for roommate rent and utility
            bills.
          </Text>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { marginTop: 24, width: "100%" },
              isDark && { backgroundColor: colors.primary },
            ]}
            onPress={onBack}
          >
            <Text style={styles.primaryBtnText}>Return to Group Screen</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        isDark && { backgroundColor: colors.background },
      ]}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* Top Header */}
      <View
        style={[
          styles.header,
          isDark && {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backBtn,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Feather
            name="chevron-left"
            size={20}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.headerTitle, isDark && { color: colors.text }]}>
            Payment Configuration
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              isDark && { color: colors.textSecondary },
            ]}
          >
            Host Accounts & QR Codes
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.addHeaderBtn,
            isDark && {
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              borderColor: "rgba(59, 130, 246, 0.3)",
            },
          ]}
          onPress={() => handleOpenAddModal("GCASH")}
          activeOpacity={0.8}
        >
          <Feather
            name="plus"
            size={18}
            color={isDark ? colors.accent : "#2563EB"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(90, insets.bottom + 40) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Guide Card */}
        <View
          style={[
            styles.heroCard,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.heroIconBadge,
                isDark && {
                  backgroundColor: "rgba(59, 130, 246, 0.18)",
                  borderColor: "rgba(59, 130, 246, 0.35)",
                },
              ]}
            >
              <Ionicons
                name="qr-code-outline"
                size={22}
                color={isDark ? colors.accent : "#2563EB"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.heroTitle, isDark && { color: colors.text }]}
              >
                Direct Roommate Payments
              </Text>
              <Text
                style={[
                  styles.heroDesc,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Configure the payment channels (GCash, Maya, Bank, Cash) and
                upload QR codes so payors can effortlessly scan and pay their
                dues.
              </Text>
            </View>
          </View>

          {/* Quick Template Buttons */}
          <View style={styles.quickAddRow}>
            <TouchableOpacity
              style={[
                styles.quickAddChip,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleOpenAddModal("GCASH")}
            >
              <Image
                source={assets.gcashLogo}
                style={styles.quickAddLogo}
                resizeMode="contain"
              />
              <Text
                style={[
                  styles.quickAddChipText,
                  isDark && { color: colors.text },
                ]}
              >
                GCash
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAddChip,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleOpenAddModal("MAYA")}
            >
              <Image
                source={assets.mayaLogo}
                style={styles.quickAddLogo}
                resizeMode="contain"
              />
              <Text
                style={[
                  styles.quickAddChipText,
                  isDark && { color: colors.text },
                ]}
              >
                Maya
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAddChip,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleOpenAddModal("BANK_TRANSFER")}
            >
              <Image
                source={assets.bankLogo}
                style={styles.quickAddLogo}
                resizeMode="contain"
              />
              <Text
                style={[
                  styles.quickAddChipText,
                  isDark && { color: colors.text },
                ]}
              >
                Bank
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAddChip,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleOpenAddModal("CASH")}
            >
              <Image
                source={assets.cashLogo}
                style={styles.quickAddLogo}
                resizeMode="contain"
              />
              <Text
                style={[
                  styles.quickAddChipText,
                  isDark && { color: colors.text },
                ]}
              >
                Cash
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Heading */}
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[styles.sectionHeading, isDark && { color: colors.text }]}
          >
            Configured Methods ({methods.length})
          </Text>
          <Text
            style={[
              styles.sectionHint,
              isDark && { color: colors.textSecondary },
            ]}
          >
            Toggle to enable for roommates
          </Text>
        </View>

        {/* Loading skeleton */}
        {loading ? (
          <View style={{ gap: 12 }}>
            <UniversalSkeleton type="generic" />
          </View>
        ) : methods.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather
              name="credit-card"
              size={36}
              color={isDark ? colors.textMuted : "#94A3B8"}
            />
            <Text style={[styles.emptyTitle, isDark && { color: colors.text }]}>
              No Payment Methods Configured
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Add your GCash, Maya, or bank account so roommates can pay rent
              and bills directly to you.
            </Text>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { marginTop: 14 },
                isDark && { backgroundColor: colors.primary },
              ]}
              onPress={() => handleOpenAddModal("GCASH")}
            >
              <Feather
                name="plus"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.primaryBtnText}>Add First Method</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.methodsList}>
            {methods.map((method) => {
              const visual = getMethodVisuals(method.type);
              return (
                <View
                  key={method.id}
                  style={[
                    styles.methodCard,
                    isDark && {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    !method.isEnabled && styles.methodCardDisabled,
                  ]}
                >
                  <View style={styles.methodHeaderRow}>
                    {method.customIconUrl ? (
                      <View
                        style={[
                          styles.methodCustomIconWrap,
                          isDark && {
                            backgroundColor: colors.surfaceInset,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Image
                          source={{ uri: method.customIconUrl }}
                          style={styles.methodCustomIcon}
                          resizeMode="cover"
                        />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.methodIconBadge,
                          {
                            backgroundColor: visual.bgColor,
                            borderColor: visual.borderColor,
                          },
                        ]}
                      >
                        <Feather
                          name={visual.icon as any}
                          size={18}
                          color={visual.color}
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
                            styles.methodName,
                            isDark && { color: colors.text },
                            !method.isEnabled && {
                              color: isDark ? colors.textMuted : "#94A3B8",
                            },
                          ]}
                        >
                          {method.name}
                        </Text>
                        <View
                          style={[
                            styles.typeBadge,
                            {
                              backgroundColor: visual.bgColor,
                              borderColor: visual.borderColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeBadgeText,
                              { color: visual.color },
                            ]}
                          >
                            {visual.badgeText}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.accountHolder,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        {method.accountName || "Account Holder Not Set"}
                      </Text>
                    </View>

                    {/* Enable / Disable Switch */}
                    <Switch
                      value={method.isEnabled}
                      onValueChange={() =>
                        handleToggleMethod(method.id, method.isEnabled)
                      }
                      trackColor={{
                        false: isDark ? "#334155" : "#E2E8F0",
                        true: isDark ? colors.accent : "#2563EB",
                      }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {/* Account Number & QR Box */}
                  <View
                    style={[
                      styles.methodDetailsBox,
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.detailLabel,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        Account Number
                      </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          isDark && { color: colors.text },
                        ]}
                        selectable
                      >
                        {method.accountNumber || "Not Provided"}
                      </Text>

                      {Boolean(method.notes) && (
                        <Text
                          style={[
                            styles.methodNotesText,
                            isDark && { color: colors.textSecondary },
                          ]}
                        >
                          💬 {method.notes}
                        </Text>
                      )}
                    </View>

                    {/* QR Code Preview Thumbnail */}
                    {method.qrCodeUrl ? (
                      <TouchableOpacity
                        style={styles.qrThumbnailWrap}
                        onPress={() =>
                          setPreviewQrUrl(method.qrCodeUrl || null)
                        }
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: method.qrCodeUrl }}
                          style={styles.qrThumbnailImage}
                          resizeMode="cover"
                        />
                        <View style={styles.qrThumbnailOverlay}>
                          <Feather
                            name="maximize-2"
                            size={12}
                            color="#FFFFFF"
                          />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={[
                          styles.noQrBadge,
                          isDark && {
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Feather
                          name="image"
                          size={14}
                          color={isDark ? colors.textMuted : "#94A3B8"}
                        />
                        <Text
                          style={[
                            styles.noQrText,
                            isDark && { color: colors.textMuted },
                          ]}
                        >
                          No QR
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Card Actions Footer */}
                  <View
                    style={[
                      styles.methodActionsFooter,
                      isDark && { borderTopColor: colors.border },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.cardActionBtn,
                        isDark && {
                          backgroundColor: "rgba(59, 130, 246, 0.12)",
                          borderColor: "rgba(59, 130, 246, 0.25)",
                        },
                      ]}
                      onPress={() => handleOpenEditModal(method)}
                    >
                      <Feather
                        name="edit-2"
                        size={13}
                        color={isDark ? colors.accent : "#2563EB"}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.cardActionBtn,
                        styles.cardActionBtnDelete,
                        isDark && {
                          backgroundColor: "rgba(239, 68, 68, 0.12)",
                          borderColor: "rgba(239, 68, 68, 0.25)",
                        },
                      ]}
                      onPress={() => handleDeleteMethod(method.id, method.name)}
                    >
                      <Feather
                        name="trash-2"
                        size={13}
                        color={isDark ? colors.danger : "#EF4444"}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Add Payment Method Button */}
        <TouchableOpacity
          style={[
            styles.addMethodBottomBtn,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          onPress={() => handleOpenAddModal("GCASH")}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.addMethodIconCircle,
              isDark && { backgroundColor: "rgba(59, 130, 246, 0.2)" },
            ]}
          >
            <Feather
              name="plus"
              size={18}
              color={isDark ? colors.accent : "#2563EB"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.addMethodBtnTitle,
                isDark && { color: colors.text },
              ]}
            >
              Add New Payment Method
            </Text>
            <Text
              style={[
                styles.addMethodBtnSub,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Include e-wallets, bank accounts, or physical cash handover
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={18}
            color={isDark ? colors.textMuted : "#94A3B8"}
          />
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL: Add / Edit Payment Method */}
      <SmoothBottomSheetModal
        visible={showEditModal}
        onClose={() => {
          if (!saving && !uploadingQr) {
            setShowEditModal(false);
          }
        }}
        variant="bottom-sheet"
        showChipBar={true}
        title={editingMethodId ? "Edit Payment Method" : "Add Payment Method"}
        subtitle="Configure account number and QR code for roommate payments"
        icon={
          <Feather
            name="credit-card"
            size={18}
            color={isDark ? colors.accent : "#2563EB"}
          />
        }
      >
        <ScrollView
          style={{ maxHeight: 520 }}
          contentContainerStyle={{
            paddingBottom: Math.max(40, insets.bottom + 24),
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingTop: 4 }}>
            {/* Payment Type Selection */}
            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Channel Type
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {(
                  [
                    { id: "GCASH", label: "GCash", icon: "credit-card" },
                    { id: "MAYA", label: "Maya", icon: "smartphone" },
                    {
                      id: "BANK_TRANSFER",
                      label: "Bank Transfer",
                      icon: "briefcase",
                    },
                    { id: "CASH", label: "Cash Handover", icon: "dollar-sign" },
                    { id: "OTHER", label: "Other", icon: "more-horizontal" },
                  ] as const
                ).map((t) => {
                  const isSelected = formType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.typeSelectChip,
                        isSelected && styles.typeSelectChipActive,
                        isDark &&
                          !isSelected && {
                            backgroundColor: colors.surfaceInset,
                            borderColor: colors.border,
                          },
                        isDark &&
                          isSelected && {
                            backgroundColor: "rgba(59, 130, 246, 0.2)",
                            borderColor: colors.accent,
                          },
                      ]}
                      onPress={() => {
                        setFormType(t.id);
                        if (!editingMethodId) {
                          setFormName(t.label);
                        }
                      }}
                    >
                      <Feather
                        name={t.icon as any}
                        size={13}
                        color={
                          isSelected
                            ? isDark
                              ? colors.accent
                              : "#2563EB"
                            : isDark
                              ? colors.textSecondary
                              : "#64748B"
                        }
                      />
                      <Text
                        style={[
                          styles.typeSelectChipText,
                          isSelected && {
                            color: isDark ? colors.accent : "#2563EB",
                            fontWeight: "700",
                          },
                          isDark &&
                            !isSelected && {
                              color: colors.textSecondary,
                            },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Display / Channel Name */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Method / Bank Name
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. GCash, Maya, BDO Unibank, BPI"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>

            {/* Custom Bank / E-Wallet Logo / Icon */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={[styles.inputLabel, isDark && { color: colors.text }]}
                >
                  Bank / Channel Logo (Optional)
                </Text>
                {formCustomIconUrl ? (
                  <TouchableOpacity
                    onPress={() => setFormCustomIconUrl(undefined)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isDark ? colors.danger : "#EF4444",
                      }}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text
                style={[
                  styles.inputHelperText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Upload your bank's logo or select a quick preset so roommates
                recognize the channel easily.
              </Text>

              {/* Active Icon Display or Upload Trigger */}
              {formCustomIconUrl ? (
                <View
                  style={[
                    styles.bankIconActiveBox,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.bankIconThumbWrap}>
                    <Image
                      source={{ uri: formCustomIconUrl }}
                      style={styles.bankIconThumbImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[
                        styles.bankIconActiveTitle,
                        isDark && { color: colors.text },
                      ]}
                    >
                      Custom Bank Icon Set
                    </Text>
                    <Text
                      style={[
                        styles.bankIconActiveSub,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      Roommates will see this when selecting payment method
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.bankIconChangeBtn,
                      isDark && {
                        backgroundColor: "rgba(59, 130, 246, 0.15)",
                        borderColor: "rgba(59, 130, 246, 0.3)",
                      },
                    ]}
                    onPress={handlePickCustomIconImage}
                    disabled={uploadingIcon}
                  >
                    {uploadingIcon ? (
                      <ActivityIndicator
                        size="small"
                        color={isDark ? colors.accent : "#2563EB"}
                      />
                    ) : (
                      <>
                        <Feather
                          name="upload"
                          size={12}
                          color={isDark ? colors.accent : "#2563EB"}
                        />
                        <Text
                          style={[
                            styles.bankIconChangeBtnText,
                            isDark && { color: colors.accent },
                          ]}
                        >
                          Replace
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.uploadBankIconBtn,
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={handlePickCustomIconImage}
                    disabled={uploadingIcon}
                    activeOpacity={0.8}
                  >
                    {uploadingIcon ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          paddingVertical: 4,
                          gap: 8,
                        }}
                      >
                        <ActivityIndicator
                          size="small"
                          color={isDark ? colors.accent : "#2563EB"}
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: isDark ? colors.textSecondary : "#64748B",
                          }}
                        >
                          Uploading custom bank icon...
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={[
                            styles.uploadIconBadge,
                            isDark && {
                              backgroundColor: "rgba(59, 130, 246, 0.2)",
                            },
                          ]}
                        >
                          <Feather
                            name="image"
                            size={16}
                            color={isDark ? colors.accent : "#2563EB"}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.uploadBankIconTitle,
                              isDark && { color: colors.text },
                            ]}
                          >
                            Upload Custom Bank / E-Wallet Logo
                          </Text>
                          <Text
                            style={[
                              styles.uploadBankIconSub,
                              isDark && { color: colors.textSecondary },
                            ]}
                          >
                            PNG, JPG, or WebP from your photo library
                          </Text>
                        </View>
                        <Feather
                          name="plus"
                          size={16}
                          color={isDark ? colors.accent : "#2563EB"}
                        />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Preset Quick Chips */}
                  <View style={{ marginTop: 4 }}>
                    <Text
                      style={[
                        styles.presetSectionLabel,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      Popular bank presets:
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{
                        gap: 6,
                        paddingTop: 6,
                        paddingBottom: 4,
                      }}
                    >
                      {POPULAR_BANK_PRESETS.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.presetBankChip,
                            isDark && {
                              backgroundColor: colors.surfaceInset,
                              borderColor: colors.border,
                            },
                          ]}
                          onPress={() => {
                            if (
                              !formName ||
                              formName === "Payment Method" ||
                              formName === "Bank Transfer"
                            ) {
                              setFormName(p.name);
                            }
                            setFormType(p.type);
                            if (p.defaultNotes && !formNotes) {
                              setFormNotes(p.defaultNotes);
                            }
                          }}
                        >
                          <View
                            style={[
                              styles.presetDot,
                              { backgroundColor: p.color },
                            ]}
                          />
                          <Text
                            style={[
                              styles.presetChipText,
                              isDark && { color: colors.text },
                            ]}
                          >
                            {p.shortCode}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}
            </View>

            {/* Account Holder Name */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Account Holder Name
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={formAccountName}
                onChangeText={setFormAccountName}
                placeholder="e.g. Juan Dela Cruz"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>

            {/* Account / Mobile Number */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Account Number or Mobile Number
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={formAccountNumber}
                onChangeText={setFormAccountNumber}
                placeholder={
                  formType === "GCASH" || formType === "MAYA"
                    ? "09XX XXX XXXX"
                    : formType === "CASH"
                      ? "Pay in person to host"
                      : "Account Number (e.g. 1092 3847 2910)"
                }
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                keyboardType={formType === "CASH" ? "default" : "phone-pad"}
              />
            </View>

            {/* QR Code Upload Section */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Payment QR Code (Optional, Recommended)
              </Text>
              <Text
                style={[
                  styles.inputHelperText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Upload your GCash QR, Maya QR, or InstaPay QR so roommates can
                scan to pay directly without typing numbers.
              </Text>

              {formQrCodeUrl ? (
                <View
                  style={[
                    styles.qrPreviewBox,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: formQrCodeUrl }}
                    style={styles.qrImageLarge}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
                    <Text
                      style={[
                        styles.qrStatusText,
                        isDark && { color: colors.text },
                      ]}
                    >
                      QR Code Active
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={[
                          styles.qrActionBtnSmall,
                          isDark && {
                            backgroundColor: "rgba(59, 130, 246, 0.15)",
                            borderColor: "rgba(59, 130, 246, 0.3)",
                          },
                        ]}
                        onPress={handlePickQrImage}
                        disabled={uploadingQr}
                      >
                        <Feather
                          name="refresh-cw"
                          size={12}
                          color={isDark ? colors.accent : "#2563EB"}
                        />
                        <Text
                          style={[
                            styles.qrActionBtnText,
                            isDark && { color: colors.accent },
                          ]}
                        >
                          Replace
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.qrActionBtnSmall,
                          styles.qrActionBtnSmallDelete,
                          isDark && {
                            backgroundColor: "rgba(239, 68, 68, 0.15)",
                            borderColor: "rgba(239, 68, 68, 0.3)",
                          },
                        ]}
                        onPress={() => setFormQrCodeUrl(undefined)}
                        disabled={uploadingQr}
                      >
                        <Feather
                          name="trash-2"
                          size={12}
                          color={isDark ? colors.danger : "#EF4444"}
                        />
                        <Text
                          style={[
                            styles.qrActionBtnText,
                            styles.qrActionBtnTextDelete,
                            isDark && { color: colors.danger },
                          ]}
                        >
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.uploadQrPlaceholder,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={handlePickQrImage}
                  disabled={uploadingQr}
                  activeOpacity={0.8}
                >
                  {uploadingQr ? (
                    <ActivityIndicator
                      color={isDark ? colors.accent : "#2563EB"}
                    />
                  ) : (
                    <>
                      <View
                        style={[
                          styles.uploadQrIconWrap,
                          isDark && {
                            backgroundColor: "rgba(59, 130, 246, 0.15)",
                          },
                        ]}
                      >
                        <Feather
                          name="upload-cloud"
                          size={20}
                          color={isDark ? colors.accent : "#2563EB"}
                        />
                      </View>
                      <Text
                        style={[
                          styles.uploadQrTitle,
                          isDark && { color: colors.text },
                        ]}
                      >
                        Upload QR Code Image
                      </Text>
                      <Text
                        style={[
                          styles.uploadQrSub,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        PNG, JPG from your gallery
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Special Instructions / Notes */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text
                style={[styles.inputLabel, isDark && { color: colors.text }]}
              >
                Payment Notes / Remarks (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { minHeight: 65, textAlignVertical: "top" },
                  isDark && {
                    backgroundColor: colors.surfaceInset,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="e.g. Include your room number in transfer remarks, send receipt screenshot..."
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                multiline
              />
            </View>

            {/* Active Toggle */}
            <View
              style={[
                styles.switchRow,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.switchLabel, isDark && { color: colors.text }]}
                >
                  Enable for Roommates
                </Text>
                <Text
                  style={[
                    styles.switchSub,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Payors can choose this method in the payment dropdown
                </Text>
              </View>
              <Switch
                value={formIsEnabled}
                onValueChange={setFormIsEnabled}
                trackColor={{
                  false: isDark ? "#334155" : "#E2E8F0",
                  true: isDark ? colors.accent : "#2563EB",
                }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { marginTop: 22 },
                isDark && { backgroundColor: colors.primary },
              ]}
              onPress={handleSaveMethod}
              disabled={saving || uploadingQr}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {editingMethodId ? "Save Changes" : "Add Payment Method"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SmoothBottomSheetModal>

      {/* QR Lightbox Fullscreen Modal */}
      <Modal
        visible={Boolean(previewQrUrl)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewQrUrl(null)}
      >
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setPreviewQrUrl(null)}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {previewQrUrl ? (
            <Image
              source={{ uri: previewQrUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  addHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 20,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  heroDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 3,
  },
  quickAddRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
  },
  quickAddChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickAddLogo: {
    width: 20,
    height: 20,
    marginRight: 8,
    borderRadius: 4,
  },
  quickAddChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionHint: {
    fontSize: 11,
    color: "#64748B",
  },
  methodsList: {
    gap: 12,
  },
  methodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  methodCardDisabled: {
    opacity: 0.6,
  },
  methodHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  methodIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  methodName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 5,
    fontWeight: "800",
  },
  accountHolder: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  methodDetailsBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginTop: 12,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  methodNotesText: {
    fontSize: 11,
    color: "#475569",
    marginTop: 6,
    lineHeight: 16,
  },
  qrThumbnailWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginLeft: 10,
  },
  qrThumbnailImage: {
    width: "100%",
    height: "100%",
  },
  qrThumbnailOverlay: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
    padding: 2,
  },
  noQrBadge: {
    alignItems: "center",
    justifyContent: "center",
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    marginLeft: 10,
  },
  noQrText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    marginTop: 2,
  },
  methodActionsFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  cardActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  cardActionBtnDelete: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  cardActionBtnTextDelete: {
    color: "#EF4444",
  },
  addMethodBottomBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginTop: 16,
    gap: 12,
  },
  addMethodIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  addMethodBtnTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  addMethodBtnSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Form Styles
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
  },
  inputHelperText: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  typeSelectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  typeSelectChipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  typeSelectChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  uploadQrPlaceholder: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  uploadQrIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  uploadQrTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  uploadQrSub: {
    fontSize: 11,
    color: "#64748B",
  },
  qrPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  qrImageLarge: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  qrStatusText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  qrActionBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  qrActionBtnSmallDelete: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  qrActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  qrActionBtnTextDelete: {
    color: "#EF4444",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginTop: 14,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  switchSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  // Lightbox
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
  // Restricted
  restrictedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  restrictedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  restrictedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  restrictedSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  // Custom Bank Icon Styles
  methodCustomIconWrap: {
    width: 44,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  methodCustomIcon: {
    width: "100%",
    height: "100%",
  },
  bankIconActiveBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  bankIconThumbWrap: {
    width: 56,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  bankIconThumbImage: {
    width: "100%",
    height: "100%",
  },
  bankIconActiveTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  bankIconActiveSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  bankIconChangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  bankIconChangeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  uploadBankIconBtn: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  uploadIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBankIconTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  uploadBankIconSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  presetSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  presetBankChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  presetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
});
