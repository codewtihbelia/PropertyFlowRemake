import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
  Switch,
  Modal,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { formatPesos } from "@propertyflow/shared";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { auth } from "../firebase/config";
import { mobileDataService } from "../services/firebaseDataService";
import { uploadImageToCloudinaryMobile } from "../services/cloudinaryService";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { useTheme } from "../context/ThemeContext";
import { authPinService } from "../services/authPinService";
import { PinSetupModal } from "../components/PinSetupModal";

interface ProfileScreenProps {
  onBack?: () => void;
  onOpenViewGroup?: () => void;
  onOpenManageGroup?: (mode?: "details" | "create" | "join") => void;
  onOpenReports?: () => void;
  onOpenOnboarding?: () => void;
  onOpenHostApplication?: () => void;
  onOpenSuperAdminHub?: () => void;
  onOpenTermsOfService?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenCommunity?: () => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; email: string };
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBack,
  onOpenViewGroup,
  onOpenManageGroup,
  onOpenReports,
  onOpenOnboarding,
  onOpenHostApplication,
  onOpenSuperAdminHub,
  onOpenTermsOfService,
  onOpenPrivacyPolicy,
  onOpenCommunity,
  onSignOut,
  currentUser = {
    name: "Resident",
    role: "Member",
    email: "",
  },
}) => {
  const insets = useSafeAreaInsets();
  const { onScroll } = useNavVisibility();
  const { isDark, toggleTheme, cycleTheme, themeMode, setThemeMode, colors } =
    useTheme();
  const firebaseUser = auth.currentUser;
  const cachedProfile = mobileDataService.getCachedProfile(firebaseUser?.uid);

  const [profile, setProfile] = useState<any | null>(() => cachedProfile);
  const [loading, setLoading] = useState(() => !cachedProfile);
  const [household, setHousehold] = useState<any | null>(null);
  const [households, setHouseholds] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Preference switches & values matching design (defaulting to Philippine Peso)
  const [defaultCurrency, setDefaultCurrency] = useState("PHP (₱)");
  const [defaultCurrencyFull, setDefaultCurrencyFull] = useState(
    "Philippine Peso (PHP)",
  );
  const [defaultSplitRule, setDefaultSplitRule] = useState("Equal");
  const [billReminders, setBillReminders] = useState(true);
  const [biometricSecurity, setBiometricSecurity] = useState(true);
  const [authPinEnabled, setAuthPinEnabled] = useState(false);
  const [hasAuthPinConfigured, setHasAuthPinConfigured] = useState(false);
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [isPinChangeMode, setIsPinChangeMode] = useState(false);

  // Modals
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showSplitRuleModal, setShowSplitRuleModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Editable Form Inputs
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    mobileDataService.getUserProfile(firebaseUser.uid).then((p) => {
      if (p) {
        setProfile(p);
        setDisplayNameInput(p.displayName || currentUser.name || "Resident");
        if (p.phoneNumber) setPhoneInput(p.phoneNumber);
        if (p.preferredCurrency) {
          setDefaultCurrency(p.preferredCurrency);
          setDefaultCurrencyFull(
            p.preferredCurrency === "USD ($)"
              ? "United States Dollar (USD)"
              : "Philippine Peso (PHP)",
          );
        }
        if (p.defaultSplitRule) setDefaultSplitRule(p.defaultSplitRule);
        if (p.billReminders !== undefined) setBillReminders(p.billReminders);
        if (p.biometricSecurity !== undefined)
          setBiometricSecurity(p.biometricSecurity);
      }
      setLoading(false);
    });

    const unsub = mobileDataService.listenToUserProfile(
      firebaseUser.uid,
      (p) => {
        if (p) {
          setProfile(p);
          setDisplayNameInput(p.displayName || currentUser.name || "Resident");
          if (p.phoneNumber) setPhoneInput(p.phoneNumber);
        }
        setLoading(false);
      },
    );

    return () => unsub();
  }, [firebaseUser?.uid]);

  // Listen to all households on the cloud to determine user's real groups
  useEffect(() => {
    const unsubHouseholds = mobileDataService.listenToHouseholds(
      (list: any[]) => {
        setHouseholds(list || []);
      },
    );
    return () => unsubHouseholds();
  }, []);

  useEffect(() => {
    const hhId = profile?.householdId;
    if (!hhId) {
      setHousehold(null);
      return;
    }
    const unsubHh = mobileDataService.listenToHousehold(hhId, (hh) => {
      setHousehold(hh);
      if (hh && hh.hostId === firebaseUser?.uid && profile?.role !== "HOST") {
        mobileDataService
          .saveUserProfile({ uid: firebaseUser!.uid, role: "HOST" })
          .catch(() => {});
      }
    });
    return () => unsubHh();
  }, [profile?.householdId, firebaseUser?.uid]);

  const isHostUser = Boolean(
    profile?.role === "HOST" ||
    profile?.hostApplicationStatus === "APPROVED" ||
    (household && household.hostId === firebaseUser?.uid) ||
    currentUser.role === "HOST",
  );

  const isSuperAdmin = Boolean(
    profile?.role === "SUPER_ADMIN" ||
    currentUser.role === "SUPER_ADMIN" ||
    cachedProfile?.role === "SUPER_ADMIN" ||
    firebaseUser?.email === "cebutitans07@gmail.com" ||
    currentUser.email === "cebutitans07@gmail.com" ||
    profile?.email === "cebutitans07@gmail.com",
  );

  const displayName =
    profile?.displayName ||
    firebaseUser?.displayName ||
    currentUser.name ||
    "Resident";
  const userEmail =
    profile?.email || firebaseUser?.email || currentUser.email || "";
  const photoUrl = profile?.profilePicture || firebaseUser?.photoURL;

  // Handle derived from name
  const usernameHandle =
    (displayName || "resident")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 16) || "resident";

  // Derive all active households/groups associated with the user in Firestore
  const userGroups = useMemo(() => {
    if (!firebaseUser?.uid) return [];
    const uid = firebaseUser.uid;
    const emailLower = (userEmail || "").trim().toLowerCase();

    return households.filter((h: any) => {
      const isHost = h.hostId === uid || h.hostUid === uid;
      const isPrimary =
        h.householdId === profile?.householdId || h.id === profile?.householdId;
      const isInHouseholdIds =
        Array.isArray(profile?.householdIds) &&
        (profile.householdIds.includes(h.householdId) ||
          profile.householdIds.includes(h.id));
      const isInMembers =
        Array.isArray(h.members) &&
        h.members.some(
          (m: any) =>
            m.id === uid ||
            m.userId === uid ||
            m.memberId === uid ||
            (m.email && emailLower && m.email.toLowerCase() === emailLower),
        );
      const isInMemberUids =
        Array.isArray(h.memberUids) && h.memberUids.includes(uid);

      return (
        isHost || isPrimary || isInHouseholdIds || isInMembers || isInMemberUids
      );
    });
  }, [
    households,
    firebaseUser?.uid,
    profile?.householdId,
    profile?.householdIds,
    userEmail,
  ]);

  // Real count of active groups from the cloud
  const groupsCount = useMemo(() => {
    if (userGroups.length > 0) return userGroups.length;
    if (
      Array.isArray(profile?.householdIds) &&
      profile.householdIds.length > 0
    ) {
      return profile.householdIds.length;
    }
    if (profile?.householdId) return 1;
    return 0;
  }, [userGroups.length, profile?.householdIds, profile?.householdId]);

  const groupsLabel = useMemo(() => {
    return groupsCount === 1 ? "1 Active" : `${groupsCount} Active`;
  }, [groupsCount]);

  // Subscribe to real cloud payments and expenses for all user households
  useEffect(() => {
    const hhIds = new Set<string>();
    if (profile?.householdId) hhIds.add(profile.householdId);
    if (Array.isArray(profile?.householdIds)) {
      profile.householdIds.forEach((id: string) => id && hhIds.add(id));
    }
    userGroups.forEach((h: any) => {
      const id = h.householdId || h.id;
      if (id) hhIds.add(id);
    });

    if (hhIds.size === 0) {
      setPayments([]);
      setExpenses([]);
      return;
    }

    const unsubs: (() => void)[] = [];
    const paymentsByHh: Record<string, any[]> = {};
    const expensesByHh: Record<string, any[]> = {};

    hhIds.forEach((hhId) => {
      const unsubP = mobileDataService.listenToPayments(hhId, (items) => {
        paymentsByHh[hhId] = items || [];
        setPayments(Object.values(paymentsByHh).flat());
      });
      const unsubE = mobileDataService.listenToExpenses(hhId, (items) => {
        expensesByHh[hhId] = items || [];
        setExpenses(Object.values(expensesByHh).flat());
      });
      unsubs.push(unsubP, unsubE);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [profile?.householdId, profile?.householdIds, userGroups]);

  // Compute Total Paid in Philippine Pesos based on real payment records on the cloud
  const totalPaidCentavos = useMemo(() => {
    if (!firebaseUser?.uid) return 0;
    const uid = firebaseUser.uid;
    const emailLower = (userEmail || "").trim().toLowerCase();

    const userPayments = payments.filter((p: any) => {
      if (p.status === "REJECTED") return false;
      return (
        p.userId === uid ||
        (p.userEmail && emailLower && p.userEmail.toLowerCase() === emailLower)
      );
    });

    return userPayments.reduce(
      (sum, p) => sum + (Number(p.amountCentavos) || 0),
      0,
    );
  }, [payments, firebaseUser?.uid, userEmail]);

  const totalPaidDisplay = useMemo(() => {
    return formatPesos(totalPaidCentavos);
  }, [totalPaidCentavos]);

  // Compute Settled percentage based on real cloud bills and expenses
  const settledPercentage = useMemo(() => {
    if (!firebaseUser?.uid) return 100;
    const uid = firebaseUser.uid;
    const emailLower = (userEmail || "").trim().toLowerCase();

    let userAssignedExpenseCount = 0;
    let userSettledExpenseCount = 0;
    let totalAssignedShareCentavos = 0;
    let settledShareCentavos = 0;

    expenses.forEach((exp: any) => {
      let userSplit: any = null;
      if (Array.isArray(exp.splitDetails) && exp.splitDetails.length > 0) {
        userSplit = exp.splitDetails.find(
          (s: any) =>
            s.userId === uid ||
            s.memberId === uid ||
            (s.email && emailLower && s.email.toLowerCase() === emailLower),
        );
      }

      if (Array.isArray(exp.splitDetails) && exp.splitDetails.length > 0) {
        if (!userSplit || userSplit.isExempt) return;
      }

      userAssignedExpenseCount++;

      const share =
        userSplit && typeof userSplit.shareCentavos === "number"
          ? userSplit.shareCentavos
          : typeof exp.amountCents === "number"
            ? exp.amountCents
            : 0;

      totalAssignedShareCentavos += share;

      const isExpenseFullyPaid = exp.status === "PAID" || exp.isPaid === true;
      const isSplitPaid =
        userSplit && (userSplit.isPaid === true || userSplit.status === "PAID");

      if (isExpenseFullyPaid || isSplitPaid) {
        userSettledExpenseCount++;
        settledShareCentavos += share;
      }
    });

    // If user has 0 assigned expenses:
    if (userAssignedExpenseCount === 0) {
      if (isHostUser && expenses.length > 0) {
        const paidExp = expenses.filter(
          (e: any) => e.status === "PAID" || e.isPaid === true,
        ).length;
        return Math.round((paidExp / expenses.length) * 100);
      }
      return 100; // All dues clear
    }

    // If total payments cover all assigned shares, user is 100% settled
    if (
      totalPaidCentavos >= totalAssignedShareCentavos &&
      totalAssignedShareCentavos > 0
    ) {
      return 100;
    }

    if (totalAssignedShareCentavos > 0) {
      const effectiveSettled = Math.max(
        settledShareCentavos,
        totalPaidCentavos,
      );
      return Math.min(
        100,
        Math.max(
          0,
          Math.round((effectiveSettled / totalAssignedShareCentavos) * 100),
        ),
      );
    }

    return Math.round(
      (userSettledExpenseCount / userAssignedExpenseCount) * 100,
    );
  }, [expenses, firebaseUser?.uid, userEmail, isHostUser, totalPaidCentavos]);

  const handlePickAndUploadPhoto = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Please grant camera roll permissions in settings to upload your profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setUploadingPhoto(true);

      const secureUrl = await uploadImageToCloudinaryMobile({
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType || "image/jpeg",
      });

      if (firebaseUser?.uid) {
        await mobileDataService.updateUserProfilePicture(
          firebaseUser.uid,
          secureUrl,
          profile?.householdId,
        );
        setProfile((prev: any) =>
          prev ? { ...prev, profilePicture: secureUrl } : null,
        );
        // Sync to device saved profile
        const savedUser = await authPinService.getSavedDeviceProfile();
        if (savedUser && savedUser.uid === firebaseUser.uid) {
          await authPinService.saveLastPinUser({
            ...savedUser,
            photoURL: secureUrl,
          });
        }
      }

      Alert.alert(
        "Photo Updated",
        "Your profile picture has been synced via Cloudinary!",
      );
    } catch (err: any) {
      console.error("[ProfileScreen] Photo upload error:", err);
      Alert.alert(
        "Upload Failed",
        err.message ||
          "Failed to upload photo to Cloudinary. Please try again.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfileDetails = async () => {
    const cleanName = displayNameInput.trim();
    if (!cleanName || !firebaseUser?.uid) return;
    setSavingProfile(true);
    try {
      await mobileDataService.saveUserProfile({
        uid: firebaseUser.uid,
        displayName: cleanName,
        phoneNumber: phoneInput.trim(),
        preferredCurrency: defaultCurrency,
        defaultSplitRule,
        billReminders,
        biometricSecurity,
      });
      setProfile((prev: any) => ({
        ...prev,
        displayName: cleanName,
        phoneNumber: phoneInput.trim(),
      }));
      setShowEditProfileModal(false);
      Alert.alert("Success", "Profile information updated successfully.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleBillReminders = (val: boolean) => {
    setBillReminders(val);
    if (firebaseUser?.uid) {
      mobileDataService
        .saveUserProfile({ uid: firebaseUser.uid, billReminders: val })
        .catch(() => {});
    }
  };

  const handleToggleBiometric = (val: boolean) => {
    setBiometricSecurity(val);
    if (firebaseUser?.uid) {
      mobileDataService
        .saveUserProfile({ uid: firebaseUser.uid, biometricSecurity: val })
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    authPinService.isPinEnabled(firebaseUser.uid).then(setAuthPinEnabled);
    authPinService
      .hasPinConfigured(firebaseUser.uid)
      .then(setHasAuthPinConfigured);
  }, [firebaseUser?.uid]);

  const proceedEnableAuthPin = async () => {
    if (!firebaseUser?.uid) return;
    const hasPin = await authPinService.hasPinConfigured(firebaseUser.uid);
    if (!hasPin) {
      setIsPinChangeMode(false);
      setShowPinSetupModal(true);
      return;
    }
    setAuthPinEnabled(true);
    await authPinService.setPinEnabled(firebaseUser.uid, true);
    await authPinService.saveDeviceProfile({
      uid: firebaseUser.uid,
      displayName:
        profile?.displayName ||
        firebaseUser.displayName ||
        firebaseUser.email ||
        "Resident",
      email: firebaseUser.email || profile?.email || "",
      photoURL: profile?.profilePicture || firebaseUser.photoURL || undefined,
      role: profile?.role || "PAYOR",
    });
  };

  const handleToggleAuthPin = async (val: boolean) => {
    if (!firebaseUser?.uid) return;
    if (val) {
      const existingSaved = await authPinService.getSavedDeviceProfile();
      if (existingSaved && existingSaved.uid !== firebaseUser.uid) {
        const existingName =
          existingSaved.displayName || existingSaved.email || "Another account";
        Alert.alert(
          "Override Saved Profile?",
          `"${existingName}" is currently saved on this device. As Splitzy is a financial app, only one profile can be saved per device.\n\nEnabling PIN for your account will replace "${existingName}" as the saved profile on this device. Do you want to continue?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Override & Continue",
              style: "destructive",
              onPress: async () => {
                await authPinService.removeDeviceProfile(existingSaved.uid);
                await proceedEnableAuthPin();
              },
            },
          ],
        );
        return;
      }
      await proceedEnableAuthPin();
    } else {
      setAuthPinEnabled(false);
      await authPinService.setPinEnabled(firebaseUser.uid, false);
    }
  };

  const handleOpenChangePin = () => {
    setIsPinChangeMode(true);
    setShowPinSetupModal(true);
  };

  if (loading && !profile && !cachedProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <UniversalSkeleton type="profile" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Top Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.headerCircleBtn,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {
            if (onBack) {
              onBack();
            } else {
              Alert.alert("Settings", "You are viewing Account & Settings.");
            }
          }}
          activeOpacity={0.7}
        >
          <Feather
            name="chevron-left"
            size={22}
            color={isDark ? "#FFFFFF" : "#0F172A"}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Settings
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            style={[
              styles.headerCircleBtn,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={cycleTheme}
            activeOpacity={0.7}
            accessibilityLabel={`Theme mode ${themeMode}`}
          >
            {themeMode === "light" ? (
              <Feather name="sun" size={18} color="#D97706" />
            ) : themeMode === "dark" ? (
              <Feather name="moon" size={18} color="#60A5FA" />
            ) : (
              <Ionicons
                name="phone-portrait-outline"
                size={17}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(120, insets.bottom + 95) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Join Request Pending Notice */}
        {profile?.joinRequestStatus === "PENDING" && (
          <View
            style={[
              styles.noticeCardPending,
              isDark && {
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                borderColor: "rgba(245, 158, 11, 0.25)",
              },
            ]}
          >
            <View style={styles.noticeIconWrapPending}>
              <Feather name="clock" size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.noticeTitlePending,
                  isDark && { color: "#FBBF24" },
                ]}
              >
                Join Request Awaiting Host Approval
              </Text>
              <Text
                style={[
                  styles.noticeSubtitlePending,
                  isDark && { color: "#FCD34D" },
                ]}
              >
                You entered an invite code for{" "}
                {profile.pendingHouseholdName || "the household"}. The host must
                approve your request before you can join.
              </Text>
            </View>
          </View>
        )}

        {/* Join Request Rejected Notice */}
        {profile?.joinRequestStatus === "REJECTED" && (
          <View
            style={[
              styles.noticeCardRejected,
              isDark && {
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                borderColor: "rgba(239, 68, 68, 0.25)",
              },
            ]}
          >
            <View style={styles.noticeIconWrapRejected}>
              <Feather name="alert-circle" size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.noticeTitleRejected,
                  isDark && { color: "#F87171" },
                ]}
              >
                Join Request Declined
              </Text>
              <Text
                style={[
                  styles.noticeSubtitleRejected,
                  isDark && { color: "#FCA5A5" },
                ]}
              >
                Reason: {profile.joinRejectionReason || "Declined by host"}. You
                can contact the host or try a different invite code.
              </Text>
            </View>
          </View>
        )}

        {/* Profile Hero Card with Avatar & 3-Column Stats */}
        <View
          style={[
            styles.profileHero,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Avatar with Online Active Indicator */}
          <TouchableOpacity
            style={styles.avatarWrap}
            activeOpacity={0.9}
            onPress={handlePickAndUploadPhoto}
          >
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.avatarLargeImage}
              />
            ) : (
              <View style={styles.avatarLargeFallback}>
                <Text style={styles.avatarLargeText}>
                  {displayName.charAt(0).toUpperCase() || "M"}
                </Text>
              </View>
            )}

            {/* Emerald Active Status Dot */}
            <View
              style={[
                styles.activeStatusDot,
                isDark && { borderColor: colors.card },
              ]}
            />

            {/* Uploading Spinner */}
            {uploadingPhoto && (
              <View style={styles.avatarUploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          {/* User Full Name */}
          <Text style={[styles.profileName, isDark && { color: colors.text }]}>
            {displayName}
          </Text>

          {/* Handle and Email */}
          <Text
            style={[
              styles.profileHandleEmail,
              isDark && { color: colors.textSecondary },
            ]}
          >
            @{usernameHandle} • {userEmail}
          </Text>

          {/* Hero Action Buttons Row */}
          <View style={styles.heroButtonRow}>
            <TouchableOpacity
              style={[
                styles.editProfilePill,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.75}
              onPress={() => {
                setDisplayNameInput(displayName);
                setShowEditProfileModal(true);
              }}
            >
              <Feather
                name="edit-3"
                size={13}
                color={isDark ? colors.text : "#0F172A"}
              />
              <Text
                style={[
                  styles.editProfilePillText,
                  isDark && { color: colors.text },
                ]}
              >
                Edit Profile
              </Text>
            </TouchableOpacity>

            {onOpenCommunity && (
              <TouchableOpacity
                style={[
                  styles.communityProfilePill,
                  isDark && {
                    backgroundColor: "rgba(37, 99, 235, 0.15)",
                    borderColor: "rgba(37, 99, 235, 0.35)",
                  },
                ]}
                activeOpacity={0.75}
                onPress={onOpenCommunity}
              >
                <Ionicons name="globe-outline" size={14} color="#2563EB" />
                <Text style={styles.communityProfilePillText}>Community</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Thin Divider */}
          <View
            style={[
              styles.heroDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* 3 Column Statistics - Real Cloud Data */}
          <View style={styles.heroStatsRow}>
            {/* Column 1: Groups */}
            <TouchableOpacity
              style={styles.statCol}
              onPress={() => {
                if (groupsCount > 0) {
                  if (isHostUser) {
                    onOpenManageGroup && onOpenManageGroup("details");
                  } else if (onOpenViewGroup) {
                    onOpenViewGroup();
                  } else {
                    onOpenManageGroup && onOpenManageGroup("details");
                  }
                } else {
                  onOpenManageGroup && onOpenManageGroup("join");
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.statLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Groups
              </Text>
              <Text
                style={[styles.statValueDark, isDark && { color: colors.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {groupsLabel}
              </Text>
            </TouchableOpacity>

            {/* Vertical Separator */}
            <View
              style={[
                styles.statVerticalDivider,
                isDark && { backgroundColor: colors.borderSubtle },
              ]}
            />

            {/* Column 2: Total Paid (Philippine Peso) */}
            <TouchableOpacity
              style={styles.statCol}
              onPress={() => {
                Alert.alert(
                  "Total Paid",
                  `You have completed a total of ${totalPaidDisplay} in payments recorded on the cloud.`,
                );
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.statLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Total Paid
              </Text>
              <Text
                style={styles.statValueGreen}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {totalPaidDisplay}
              </Text>
            </TouchableOpacity>

            {/* Vertical Separator */}
            <View
              style={[
                styles.statVerticalDivider,
                isDark && { backgroundColor: colors.borderSubtle },
              ]}
            />

            {/* Column 3: Settled */}
            <TouchableOpacity
              style={styles.statCol}
              onPress={() => {
                Alert.alert(
                  "Settlement Rate",
                  `Your shared bills and expenses are currently ${settledPercentage}% settled.`,
                );
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.statLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Settled
              </Text>
              <Text
                style={styles.statValueBlue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {settledPercentage}%
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Community Profile & Public Feed Quick Shortcut Banner */}
        {onOpenCommunity && (
          <TouchableOpacity
            style={[
              styles.communityBannerCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={onOpenCommunity}
            activeOpacity={0.8}
          >
            <View style={styles.communityBannerIconWrap}>
              <Ionicons name="people" size={20} color="#2563EB" />
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text
                  style={[
                    styles.communityBannerTitle,
                    isDark && { color: colors.text },
                  ]}
                >
                  Community Profile & Posts
                </Text>
                <View style={styles.communityLiveBadge}>
                  <Text style={styles.communityLiveBadgeText}>SOCIAL</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.communityBannerSub,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                View your public posts, roommate connections & friendships
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#94A3B8"}
            />
          </TouchableOpacity>
        )}

        {/* SECTION: ACCOUNT & MONEY */}
        <Text
          style={[
            styles.sectionHeader,
            isDark && { color: colors.textSecondary },
          ]}
        >
          Account & Money
        </Text>
        <View
          style={[
            styles.groupedCard,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Personal Information */}
          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={() => {
              setDisplayNameInput(displayName);
              setShowEditProfileModal(true);
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : "#EFF6FF",
                },
              ]}
            >
              <Feather
                name="user"
                size={18}
                color={isDark ? colors.accent : "#2563EB"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Personal Information
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Name, phone number & email
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#CBD5E1"}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.itemDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* Payment Methods */}
          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={() => setShowPaymentMethodsModal(true)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(99, 102, 241, 0.15)"
                    : "#EEF2FF",
                },
              ]}
            >
              <Feather
                name="credit-card"
                size={18}
                color={isDark ? "#818CF8" : "#4F46E5"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Payment Methods
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Visa ending in 4092
              </Text>
            </View>
            <View
              style={[
                styles.activeBadge,
                isDark && {
                  backgroundColor: "rgba(16, 185, 129, 0.14)",
                },
              ]}
            >
              <Text
                style={[styles.activeBadgeText, isDark && { color: "#34D399" }]}
              >
                Active
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#CBD5E1"}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.itemDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* Default Currency */}
          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={() => setShowCurrencyModal(true)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(245, 158, 11, 0.15)"
                    : "#FEF3C7",
                },
              ]}
            >
              <Feather
                name="dollar-sign"
                size={18}
                color={isDark ? "#FBBF24" : "#D97706"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Default Currency
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                {defaultCurrencyFull}
              </Text>
            </View>
            <Text
              style={[
                styles.currencyTag,
                isDark && { color: colors.textSecondary },
              ]}
            >
              {defaultCurrency}
            </Text>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#CBD5E1"}
            />
          </TouchableOpacity>
        </View>

        {/* SECTION: SPLIT & PREFERENCES */}
        <Text
          style={[
            styles.sectionHeader,
            isDark && { color: colors.textSecondary },
          ]}
        >
          Split & Preferences
        </Text>
        <View
          style={[
            styles.groupedCard,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Default Split Rule */}
          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={() => setShowSplitRuleModal(true)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(14, 165, 233, 0.15)"
                    : "#E0F2FE",
                },
              ]}
            >
              <Feather
                name="layout"
                size={18}
                color={isDark ? "#38BDF8" : "#0284C7"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Default Split Rule
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Auto-apply to new expenses
              </Text>
            </View>
            <View
              style={[
                styles.splitRulePill,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.splitRulePillText,
                  isDark && { color: colors.accent },
                ]}
              >
                {defaultSplitRule}
              </Text>
            </View>
          </TouchableOpacity>

          <View
            style={[
              styles.itemDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* Bill Reminders */}
          <View style={styles.cardItemRow}>
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(168, 85, 247, 0.15)"
                    : "#F3E8FF",
                },
              ]}
            >
              <Feather
                name="bell"
                size={18}
                color={isDark ? "#C084FC" : "#9333EA"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Bill Reminders
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Notify 2 days before rent is due
              </Text>
            </View>
            <Switch
              value={billReminders}
              onValueChange={handleToggleBillReminders}
              trackColor={{
                false: isDark ? "#2A2D35" : "#E2E8F0",
                true: colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View
            style={[
              styles.itemDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* Face ID / Security */}
          <View style={styles.cardItemRow}>
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.15)"
                    : "#D1FAE5",
                },
              ]}
            >
              <Feather
                name="shield"
                size={18}
                color={isDark ? "#34D399" : "#059669"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Face ID / Security
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Require for approving payments
              </Text>
            </View>
            <Switch
              value={biometricSecurity}
              onValueChange={handleToggleBiometric}
              trackColor={{
                false: isDark ? "#2A2D35" : "#E2E8F0",
                true: colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View
            style={[
              styles.itemDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* 4-Digit Quick Access PIN */}
          <View style={styles.cardItemRow}>
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : "#EFF6FF",
                },
              ]}
            >
              <Feather
                name="lock"
                size={18}
                color={isDark ? colors.accent : colors.primary}
              />
            </View>
            <View style={styles.itemContent}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text
                  style={[styles.itemTitle, isDark && { color: colors.text }]}
                >
                  4-Digit Access PIN
                </Text>
                {authPinEnabled && hasAuthPinConfigured && (
                  <View
                    style={{
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.15)"
                        : "#DCFCE7",
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: isDark ? "#34D399" : "#16A34A",
                      }}
                    >
                      ACTIVE ✓
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                {hasAuthPinConfigured
                  ? authPinEnabled
                    ? "Unlock dashboard with permanent PIN"
                    : "Configured but currently disabled"
                  : "Quick dashboard entry without password"}
              </Text>
            </View>
            <Switch
              value={authPinEnabled}
              onValueChange={handleToggleAuthPin}
              trackColor={{
                false: isDark ? "#2A2D35" : "#E2E8F0",
                true: colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Change PIN option when PIN is configured */}
          {hasAuthPinConfigured && (
            <>
              <View
                style={[
                  styles.itemDivider,
                  isDark && { backgroundColor: colors.borderSubtle },
                ]}
              />
              <TouchableOpacity
                style={styles.cardItemRow}
                activeOpacity={0.7}
                onPress={handleOpenChangePin}
              >
                <View
                  style={[
                    styles.itemIconBox,
                    {
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.06)"
                        : "#F1F5F9",
                    },
                  ]}
                >
                  <Feather
                    name="key"
                    size={16}
                    color={isDark ? colors.textSecondary : "#64748B"}
                  />
                </View>
                <View style={styles.itemContent}>
                  <Text
                    style={[styles.itemTitle, isDark && { color: colors.text }]}
                  >
                    Change 4-Digit PIN
                  </Text>
                  <Text
                    style={[
                      styles.itemSubtitle,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Update your permanent security passcode
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={isDark ? colors.textMuted : "#94A3B8"}
                />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* SECTION: DISPLAY & APPEARANCE */}
        <Text
          style={[
            styles.sectionHeader,
            isDark && { color: colors.textSecondary },
          ]}
        >
          Display & Appearance
        </Text>
        <View
          style={[
            styles.groupedCard,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Quick Dark Mode Toggle Row */}
          <View style={styles.cardItemRow}>
            <View
              style={[
                styles.itemIconBox,
                { backgroundColor: isDark ? "#1E293B" : "#FEF3C7" },
              ]}
            >
              {isDark ? (
                <Feather name="moon" size={18} color="#60A5FA" />
              ) : (
                <Feather name="sun" size={18} color="#D97706" />
              )}
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Dark Mode
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textMuted },
                ]}
              >
                {isDark
                  ? "Warm charcoal obsidian theme enabled"
                  : "Standard light theme"}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{
                false: isDark ? "#2A2D35" : "#E2E8F0",
                true: colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View
            style={[
              styles.itemDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* 3-Mode Segmented Control: Light, Dark, System */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: isDark ? "#94A3B8" : "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Theme Mode
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.primary,
                }}
              >
                {themeMode === "dark"
                  ? "Dark"
                  : themeMode === "light"
                    ? "Light"
                    : "System Default"}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                borderRadius: 14,
                padding: 4,
                gap: 4,
                borderWidth: isDark ? 1 : 0,
                borderColor: colors.border,
              }}
            >
              <TouchableOpacity
                onPress={() => setThemeMode("light")}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 9,
                  borderRadius: 10,
                  backgroundColor:
                    themeMode === "light"
                      ? isDark
                        ? colors.cardElevated
                        : "#FFFFFF"
                      : "transparent",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: themeMode === "light" ? 0.08 : 0,
                  shadowRadius: 2,
                  elevation: themeMode === "light" ? 1 : 0,
                  gap: 6,
                }}
              >
                <Feather
                  name="sun"
                  size={14}
                  color={
                    themeMode === "light"
                      ? "#D97706"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B"
                  }
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color:
                      themeMode === "light"
                        ? isDark
                          ? "#FFFFFF"
                          : "#0F172A"
                        : isDark
                          ? "#94A3B8"
                          : "#64748B",
                  }}
                >
                  Light
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setThemeMode("dark")}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 9,
                  borderRadius: 10,
                  backgroundColor:
                    themeMode === "dark" ? colors.primary : "transparent",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: themeMode === "dark" ? 0.15 : 0,
                  shadowRadius: 2,
                  elevation: themeMode === "dark" ? 1 : 0,
                  gap: 6,
                }}
              >
                <Feather
                  name="moon"
                  size={14}
                  color={
                    themeMode === "dark"
                      ? "#FFFFFF"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B"
                  }
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color:
                      themeMode === "dark"
                        ? "#FFFFFF"
                        : isDark
                          ? "#94A3B8"
                          : "#64748B",
                  }}
                >
                  Dark
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setThemeMode("system")}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 9,
                  borderRadius: 10,
                  backgroundColor:
                    themeMode === "system"
                      ? isDark
                        ? colors.cardElevated
                        : "#FFFFFF"
                      : "transparent",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: themeMode === "system" ? 0.08 : 0,
                  shadowRadius: 2,
                  elevation: themeMode === "system" ? 1 : 0,
                  gap: 6,
                }}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={14}
                  color={
                    themeMode === "system"
                      ? isDark
                        ? "#FFFFFF"
                        : "#0F172A"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B"
                  }
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color:
                      themeMode === "system"
                        ? isDark
                          ? "#FFFFFF"
                          : "#0F172A"
                        : isDark
                          ? "#94A3B8"
                          : "#64748B",
                  }}
                >
                  System
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* SECTION: COMMUNITY & SOCIAL */}
        <Text
          style={[
            styles.sectionHeader,
            isDark && { color: colors.textSecondary },
          ]}
        >
          Community & Social
        </Text>
        <View
          style={[
            styles.groupedCard,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={() => onOpenCommunity && onOpenCommunity()}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark ? "#1E3A8A40" : "#EFF6FF",
                },
              ]}
            >
              <Ionicons name="globe-outline" size={20} color="#2563EB" />
            </View>
            <View style={styles.itemContent}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text
                  style={[styles.itemTitle, isDark && { color: colors.text }]}
                >
                  Splitzy Community
                </Text>
                <View
                  style={{
                    backgroundColor: "#2563EB",
                    paddingHorizontal: 6,
                    paddingVertical: 1.5,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    HUB
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Share posts, meet new friends & connect across Splitzy
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#CBD5E1"}
            />
          </TouchableOpacity>
        </View>

        {/* SECTION: HOUSEHOLD & MANAGEMENT */}
        <Text
          style={[
            styles.sectionHeader,
            isDark && { color: colors.textSecondary },
          ]}
        >
          Household & Management
        </Text>
        <View
          style={[
            styles.groupedCard,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={() => {
              if (isHostUser) {
                onOpenManageGroup && onOpenManageGroup("details");
              } else if (onOpenViewGroup) {
                onOpenViewGroup();
              } else {
                onOpenManageGroup && onOpenManageGroup("details");
              }
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                },
              ]}
            >
              <Feather
                name="users"
                size={18}
                color={isDark ? colors.text : "#0F172A"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                {isHostUser
                  ? "Manage Household & Members"
                  : "View Household & Members"}
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                {isHostUser
                  ? "View roommates, host details & join requests"
                  : "View group overview, billing cycle & roommates"}
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#CBD5E1"}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.itemDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={() => onOpenManageGroup && onOpenManageGroup("join")}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                },
              ]}
            >
              <Feather
                name="user-plus"
                size={18}
                color={isDark ? colors.text : "#0F172A"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Join Household with Code
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Submit invite code to host for approval
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#CBD5E1"}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.itemDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={onOpenReports}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : "#F1F5F9",
                },
              ]}
            >
              <Feather
                name="bar-chart-2"
                size={18}
                color={isDark ? colors.accent : "#0F172A"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Monthly Summary & Reports
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Financial analytics & audit history
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#CBD5E1"}
            />
          </TouchableOpacity>

          {!isHostUser && (
            <>
              <View
                style={[
                  styles.itemDivider,
                  isDark && { backgroundColor: colors.borderSubtle },
                ]}
              />
              <TouchableOpacity
                style={styles.cardItemRow}
                onPress={onOpenHostApplication}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.itemIconBox,
                    {
                      backgroundColor: isDark
                        ? "rgba(239, 68, 68, 0.15)"
                        : "#FEF2F2",
                    },
                  ]}
                >
                  <Feather
                    name="award"
                    size={18}
                    color={isDark ? "#F87171" : "#DC2626"}
                  />
                </View>
                <View style={styles.itemContent}>
                  <Text
                    style={[styles.itemTitle, isDark && { color: colors.text }]}
                  >
                    Apply for Host Status
                  </Text>
                  <Text
                    style={[
                      styles.itemSubtitle,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Request Super Admin approval to create spaces
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={isDark ? colors.textMuted : "#CBD5E1"}
                />
              </TouchableOpacity>
            </>
          )}

          {isSuperAdmin && (
            <>
              <View
                style={[
                  styles.itemDivider,
                  isDark && { backgroundColor: colors.borderSubtle },
                ]}
              />
              <TouchableOpacity
                style={styles.cardItemRow}
                onPress={onOpenSuperAdminHub}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.itemIconBox,
                    {
                      backgroundColor: isDark
                        ? "rgba(225, 29, 72, 0.15)"
                        : "#FFF1F2",
                    },
                  ]}
                >
                  <Ionicons name="shield-checkmark" size={18} color="#E11D48" />
                </View>
                <View style={styles.itemContent}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={[
                        styles.itemTitle,
                        isDark && { color: colors.text },
                      ]}
                    >
                      Super Admin Hub
                    </Text>
                    <View
                      style={{
                        backgroundColor: "rgba(225, 29, 72, 0.12)",
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "800",
                          color: "#E11D48",
                          letterSpacing: 0.5,
                        }}
                      >
                        PLATFORM
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.itemSubtitle,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Host approvals, users, groups & maintenance
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={isDark ? colors.textMuted : "#CBD5E1"}
                />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* SECTION: SYSTEM & GUIDE */}
        <Text
          style={[
            styles.sectionHeader,
            isDark && { color: colors.textSecondary },
          ]}
        >
          System & Guide
        </Text>
        <View
          style={[
            styles.groupedCard,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={onOpenOnboarding}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                },
              ]}
            >
              <Feather
                name="book-open"
                size={18}
                color={isDark ? colors.text : "#0F172A"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Welcome & Onboarding Guide
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                How billing cycles and split calculation work
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#CBD5E1"}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.itemDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={() =>
              Alert.alert(
                "Cloud & Data Sync",
                "Firestore realtime listeners and Cloudinary CDN storage are fully operational.",
              )
            }
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                },
              ]}
            >
              <Feather
                name="cloud"
                size={18}
                color={isDark ? colors.text : "#0F172A"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Cloud & Realtime Sync
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Cloudinary + Firebase Active
              </Text>
            </View>
            <View
              style={[
                styles.connectedTag,
                isDark && {
                  backgroundColor: "rgba(59, 130, 246, 0.15)",
                },
              ]}
            >
              <Text
                style={[
                  styles.connectedTagText,
                  isDark && { color: colors.accent },
                ]}
              >
                Active
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* SECTION: LEGAL & COMPLIANCE */}
        <Text
          style={[
            styles.sectionHeader,
            isDark && { color: colors.textSecondary },
          ]}
        >
          Legal & Compliance
        </Text>
        <View
          style={[
            styles.groupedCard,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Terms of Service */}
          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={onOpenTermsOfService}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : "#EFF6FF",
                },
              ]}
            >
              <Feather
                name="file-text"
                size={18}
                color={isDark ? colors.accent : "#2563EB"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Terms of Service
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Rules, centavo math, and host duties
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#CBD5E1"}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.itemDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* Privacy Policy */}
          <TouchableOpacity
            style={styles.cardItemRow}
            onPress={onOpenPrivacyPolicy}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.itemIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.15)"
                    : "#ECFDF5",
                },
              ]}
            >
              <Feather
                name="shield"
                size={18}
                color={isDark ? "#34D399" : "#059669"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, isDark && { color: colors.text }]}
              >
                Privacy Policy
              </Text>
              <Text
                style={[
                  styles.itemSubtitle,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Data protection, GDPR & CCPA rights
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? colors.textMuted : "#CBD5E1"}
            />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[
            styles.signOutBtn,
            isDark && {
              backgroundColor: "rgba(239, 68, 68, 0.14)",
              borderWidth: 1,
              borderColor: "rgba(239, 68, 68, 0.28)",
            },
          ]}
          onPress={() => {
            Alert.alert("Sign Out", "Are you sure you want to sign out?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign Out",
                style: "destructive",
                onPress: () => {
                  if (onSignOut) onSignOut();
                },
              },
            ]);
          }}
          activeOpacity={0.8}
        >
          <Feather
            name="log-out"
            size={16}
            color={isDark ? "#F87171" : "#DC2626"}
            style={{ marginRight: 8 }}
          />
          <Text
            style={[
              styles.signOutBtnText,
              { color: isDark ? "#F87171" : "#DC2626" },
            ]}
          >
            Sign Out
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL: EDIT PROFILE / PERSONAL INFORMATION */}
      <SmoothBottomSheetModal
        visible={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Personal Information"
        subtitle="Update your profile photo, name, and phone"
        icon={<Feather name="user" size={18} color={colors.accent} />}
        maxHeight="90%"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          style={{ flexShrink: 1 }}
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: Math.max(80, insets.bottom + 60),
          }}
        >
          {/* Photo Avatar In Modal */}
          <View
            style={[
              styles.modalAvatarRow,
              isDark && { borderColor: colors.border },
            ]}
          >
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.modalAvatarImage}
              />
            ) : (
              <View style={styles.modalAvatarFallback}>
                <Text style={styles.modalAvatarText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.modalPhotoChangeBtn,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
              onPress={handlePickAndUploadPhoto}
              disabled={uploadingPhoto}
            >
              <Feather
                name="camera"
                size={14}
                color={isDark ? colors.accent : "#2563EB"}
              />
              <Text
                style={[
                  styles.modalPhotoChangeText,
                  isDark && { color: colors.accent },
                ]}
              >
                {uploadingPhoto ? "Uploading..." : "Change Photo"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Full Name Input */}
          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.inputLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Full Name
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={displayNameInput}
              onChangeText={setDisplayNameInput}
              placeholder="Enter full name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Phone Number Input */}
          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.inputLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Phone Number
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="e.g. 0917-123-4567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          {/* Email (Readonly) */}
          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.inputLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Email Address
            </Text>
            <View
              style={[
                styles.modalInput,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                  borderColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <Text
                style={{
                  color: isDark ? colors.textSecondary : "#64748B",
                  fontSize: 14,
                }}
              >
                {userEmail}
              </Text>
            </View>
          </View>

          {/* Save Buttons */}
          <View style={[styles.modalButtonsRow, { marginTop: 22 }]}>
            <TouchableOpacity
              style={[
                styles.modalCancelBtn,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setShowEditProfileModal(false)}
            >
              <Text
                style={[
                  styles.modalCancelBtnText,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalSaveBtn,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={handleSaveProfileDetails}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSaveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SmoothBottomSheetModal>

      {/* MODAL: PAYMENT METHODS */}
      <SmoothBottomSheetModal
        visible={showPaymentMethodsModal}
        onClose={() => setShowPaymentMethodsModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Payment Methods"
        subtitle="Configured cards and digital wallets"
        icon={<Feather name="credit-card" size={18} color={colors.accent} />}
      >
        <View style={{ paddingTop: 6, paddingBottom: 8 }}>
          <View style={{ gap: 12 }}>
            <View
              style={[
                styles.paymentMethodItem,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.itemIconBox,
                  {
                    backgroundColor: isDark
                      ? "rgba(59, 130, 246, 0.15)"
                      : "#EFF6FF",
                  },
                ]}
              >
                <Feather
                  name="credit-card"
                  size={18}
                  color={isDark ? colors.accent : "#2563EB"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: isDark ? colors.text : "#0F172A",
                  }}
                >
                  Visa ending in 4092
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? colors.textSecondary : "#64748B",
                  }}
                >
                  Expires 09/28 • Default
                </Text>
              </View>
              <View
                style={[
                  styles.activeBadge,
                  isDark && {
                    backgroundColor: "rgba(16, 185, 129, 0.14)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.activeBadgeText,
                    isDark && { color: "#34D399" },
                  ]}
                >
                  Active
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.paymentMethodItem,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.itemIconBox,
                  {
                    backgroundColor: isDark
                      ? "rgba(16, 185, 129, 0.15)"
                      : "#F0FDF4",
                  },
                ]}
              >
                <Feather name="smartphone" size={18} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: isDark ? colors.text : "#0F172A",
                  }}
                >
                  GCash / Maya Digital Wallet
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? colors.textSecondary : "#64748B",
                  }}
                >
                  Connected to {phoneInput || "Mobile"}
                </Text>
              </View>
              <Feather name="check-circle" size={18} color="#16A34A" />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.modalSaveBtn,
              {
                backgroundColor: colors.primary,
                marginTop: 24,
              },
            ]}
            onPress={() => {
              setShowPaymentMethodsModal(false);
              Alert.alert(
                "Payment Methods",
                "Your payment preferences are up to date.",
              );
            }}
          >
            <Text style={styles.modalSaveBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* MODAL: DEFAULT CURRENCY */}
      <SmoothBottomSheetModal
        visible={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Select Currency"
        subtitle="Choose your preferred currency symbol"
        icon={<Feather name="dollar-sign" size={18} color={colors.accent} />}
      >
        <View style={{ paddingTop: 6, paddingBottom: 8 }}>
          <View style={{ gap: 10 }}>
            {[
              { code: "USD ($)", full: "United States Dollar (USD)" },
              { code: "PHP (₱)", full: "Philippine Peso (PHP)" },
              { code: "EUR (€)", full: "Euro (EUR)" },
            ].map((c) => {
              const isActive = defaultCurrency === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.selectionRow,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                    },
                    isActive &&
                      (isDark
                        ? {
                            backgroundColor: "rgba(59, 130, 246, 0.14)",
                            borderColor: colors.primary,
                          }
                        : styles.selectionRowActive),
                  ]}
                  onPress={() => {
                    setDefaultCurrency(c.code);
                    setDefaultCurrencyFull(c.full);
                    if (firebaseUser?.uid) {
                      mobileDataService
                        .saveUserProfile({
                          uid: firebaseUser.uid,
                          preferredCurrency: c.code,
                        })
                        .catch(() => {});
                    }
                    setShowCurrencyModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.selectionRowText,
                      isDark && { color: colors.text },
                      isActive && {
                        color: colors.primary,
                        fontWeight: "800",
                      },
                    ]}
                  >
                    {c.full}
                  </Text>
                  {isActive && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SmoothBottomSheetModal>

      {/* MODAL: DEFAULT SPLIT RULE */}
      <SmoothBottomSheetModal
        visible={showSplitRuleModal}
        onClose={() => setShowSplitRuleModal(false)}
        variant="bottom-sheet"
        showChipBar={true}
        title="Default Split Rule"
        subtitle="Choose how expenses are divided among roommates"
        icon={<Feather name="pie-chart" size={18} color={colors.accent} />}
      >
        <View style={{ paddingTop: 6, paddingBottom: 8 }}>
          <View style={{ gap: 10 }}>
            {[
              {
                title: "Equal",
                desc: "Even split among all active household roommates",
              },
              {
                title: "By Attendance",
                desc: "Calculated based on actual days marked present",
              },
              {
                title: "Percentage / Custom",
                desc: "Configured individual ratios for bills",
              },
            ].map((r) => {
              const isActive = defaultSplitRule === r.title;
              return (
                <TouchableOpacity
                  key={r.title}
                  style={[
                    styles.selectionRow,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                    },
                    isActive &&
                      (isDark
                        ? {
                            backgroundColor: "rgba(59, 130, 246, 0.14)",
                            borderColor: colors.primary,
                          }
                        : styles.selectionRowActive),
                  ]}
                  onPress={() => {
                    setDefaultSplitRule(r.title);
                    if (firebaseUser?.uid) {
                      mobileDataService
                        .saveUserProfile({
                          uid: firebaseUser.uid,
                          defaultSplitRule: r.title,
                        })
                        .catch(() => {});
                    }
                    setShowSplitRuleModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.selectionRowText,
                        isDark && { color: colors.text },
                        isActive && {
                          color: colors.primary,
                          fontWeight: "800",
                        },
                      ]}
                    >
                      {r.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: isDark ? colors.textSecondary : "#64748B",
                        marginTop: 2,
                      }}
                    >
                      {r.desc}
                    </Text>
                  </View>
                  {isActive && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SmoothBottomSheetModal>

      {/* 4-Digit PIN Setup / Change Modal */}
      {firebaseUser?.uid && (
        <PinSetupModal
          visible={showPinSetupModal}
          onClose={() => setShowPinSetupModal(false)}
          uid={firebaseUser.uid}
          isChangeMode={isPinChangeMode}
          onSuccess={() => {
            setAuthPinEnabled(true);
            setHasAuthPinConfigured(true);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  // Top Header Bar
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#F8FAFC",
  },
  headerCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Notice Banners
  noticeCardPending: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  noticeIconWrapPending: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
  noticeTitlePending: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  noticeSubtitlePending: {
    fontSize: 11,
    color: "#B45309",
    marginTop: 3,
    lineHeight: 16,
  },

  noticeCardRejected: {
    backgroundColor: "#FFE4E6",
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  noticeIconWrapRejected: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FECDD3",
    alignItems: "center",
    justifyContent: "center",
  },
  noticeTitleRejected: {
    fontSize: 13,
    fontWeight: "800",
    color: "#9F1239",
  },
  noticeSubtitleRejected: {
    fontSize: 11,
    color: "#BE123C",
    marginTop: 3,
    lineHeight: 16,
  },

  // Profile Hero Card
  profileHero: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingTop: 26,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  avatarWrap: {
    position: "relative",
    width: 88,
    height: 88,
  },
  avatarLargeImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#E2E8F0",
  },
  avatarLargeFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLargeText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  activeStatusDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "#10B981",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
  },
  avatarUploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },

  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 14,
    textAlign: "center",
  },
  profileHandleEmail: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },

  heroButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 20,
  },
  editProfilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  editProfilePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  communityProfilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.25)",
  },
  communityProfilePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },

  communityBannerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  communityBannerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  communityBannerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  communityLiveBadge: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  communityLiveBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  communityBannerSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },

  heroDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 16,
  },

  heroStatsRow: {
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    marginBottom: 4,
  },
  statValueDark: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  statValueGreen: {
    fontSize: 15,
    fontWeight: "800",
    color: "#059669",
  },
  statValueBlue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2563EB",
  },
  statVerticalDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#F1F5F9",
  },

  // Section Headers
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
    marginTop: 22,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Grouped Card
  groupedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
  },
  cardItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemDivider: {
    height: 1,
    backgroundColor: "#F8FAFC",
    marginLeft: 70,
  },
  itemIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  itemContent: {
    flex: 1,
    paddingRight: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  itemSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  activeBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#16A34A",
  },

  currencyTag: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginRight: 6,
  },

  splitRulePill: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  splitRulePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },

  connectedTag: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  connectedTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },

  lockProfileBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 15,
    borderRadius: 18,
  },
  lockProfileBtnText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "800",
  },
  signOutBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    paddingVertical: 15,
    borderRadius: 18,
  },
  signOutBtnText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "800",
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalContentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  modalAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E2E8F0",
  },
  modalAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  modalAvatarText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalPhotoChangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
  },
  modalPhotoChangeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  modalSaveBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  paymentMethodItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  selectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  selectionRowActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  selectionRowText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
});
