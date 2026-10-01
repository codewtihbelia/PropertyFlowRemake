import React, { useState, useEffect } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { auth } from "../firebase/config";
import { mobileDataService } from "../services/firebaseDataService";
import { uploadImageToCloudinaryMobile } from "../services/cloudinaryService";
import { UniversalSkeleton } from "../components/UniversalLoader";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { useTheme } from "../context/ThemeContext";

interface ProfileScreenProps {
  onBack?: () => void;
  onOpenViewGroup?: () => void;
  onOpenManageGroup?: (mode?: "details" | "create" | "join") => void;
  onOpenReports?: () => void;
  onOpenOnboarding?: () => void;
  onOpenHostApplication?: () => void;
  onOpenTermsOfService?: () => void;
  onOpenPrivacyPolicy?: () => void;
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
  onOpenTermsOfService,
  onOpenPrivacyPolicy,
  onSignOut,
  currentUser = {
    name: "Resident",
    role: "Member",
    email: "",
  },
}) => {
  const { onScroll } = useNavVisibility();
  const { isDark, toggleTheme, cycleTheme, themeMode, setThemeMode, colors } =
    useTheme();
  const firebaseUser = auth.currentUser;
  const cachedProfile = mobileDataService.getCachedProfile(firebaseUser?.uid);

  const [profile, setProfile] = useState<any | null>(() => cachedProfile);
  const [loading, setLoading] = useState(() => !cachedProfile);
  const [household, setHousehold] = useState<any | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Preference switches & values matching design
  const [defaultCurrency, setDefaultCurrency] = useState("USD ($)");
  const [defaultCurrencyFull, setDefaultCurrencyFull] = useState(
    "United States Dollar (USD)",
  );
  const [defaultSplitRule, setDefaultSplitRule] = useState("Equal");
  const [billReminders, setBillReminders] = useState(true);
  const [biometricSecurity, setBiometricSecurity] = useState(true);

  // Modals
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showSplitRuleModal, setShowSplitRuleModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Editable Form Inputs
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("0917-123-4567");

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    mobileDataService.getUserProfile(firebaseUser.uid).then((p) => {
      if (p) {
        setProfile(p);
        setDisplayNameInput(p.displayName || currentUser.name);
        if (p.phoneNumber) setPhoneInput(p.phoneNumber);
        if (p.preferredCurrency) {
          setDefaultCurrency(p.preferredCurrency);
          setDefaultCurrencyFull(
            p.preferredCurrency === "PHP (₱)"
              ? "Philippine Peso (PHP)"
              : "United States Dollar (USD)",
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
          setDisplayNameInput(p.displayName || currentUser.name);
          if (p.phoneNumber) setPhoneInput(p.phoneNumber);
        }
        setLoading(false);
      },
    );

    return () => unsub();
  }, [firebaseUser?.uid]);

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

  const displayName =
    profile?.displayName ||
    firebaseUser?.displayName ||
    currentUser.name ||
    "Mainul Islam Arafat";
  const userEmail =
    profile?.email ||
    firebaseUser?.email ||
    currentUser.email ||
    "arafat@splitzy.app";
  const photoUrl = profile?.profilePicture || firebaseUser?.photoURL;

  // Handle derived from name
  const usernameHandle =
    (displayName || "arafat")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 16) || "arafat";

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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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

          {/* Edit Profile Pill Button */}
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

          {/* Thin Divider */}
          <View
            style={[
              styles.heroDivider,
              isDark && { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* 3 Column Statistics */}
          <View style={styles.heroStatsRow}>
            {/* Column 1: Groups */}
            <TouchableOpacity
              style={styles.statCol}
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
              >
                {profile?.householdId ? "1 Active" : "3 Active"}
              </Text>
            </TouchableOpacity>

            {/* Vertical Separator */}
            <View
              style={[
                styles.statVerticalDivider,
                isDark && { backgroundColor: colors.borderSubtle },
              ]}
            />

            {/* Column 2: Total Paid */}
            <View style={styles.statCol}>
              <Text
                style={[
                  styles.statLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Total Paid
              </Text>
              <Text style={styles.statValueGreen}>$1,405</Text>
            </View>

            {/* Vertical Separator */}
            <View
              style={[
                styles.statVerticalDivider,
                isDark && { backgroundColor: colors.borderSubtle },
              ]}
            />

            {/* Column 3: Settled */}
            <View style={styles.statCol}>
              <Text
                style={[
                  styles.statLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Settled
              </Text>
              <Text style={styles.statValueBlue}>98%</Text>
            </View>
          </View>
        </View>

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
          onPress={onSignOut}
          activeOpacity={0.8}
        >
          <Feather
            name="log-out"
            size={16}
            color={isDark ? "#F87171" : "#DC2626"}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.signOutBtnText, isDark && { color: "#F87171" }]}>
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
          style={{ maxHeight: 480 }}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
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
    marginTop: 14,
    marginBottom: 20,
  },
  editProfilePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
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
