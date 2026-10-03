import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";

export interface PrivacyPolicyScreenProps {
  onBack: () => void;
  onAcknowledge?: () => void;
  showAcknowledgeButton?: boolean;
}

const QUICK_INDEX_ITEMS = [
  { id: "collect", label: "Data We Collect" },
  { id: "use", label: "How We Use It" },
  { id: "sharing", label: "Sharing" },
  { id: "security", label: "Security" },
  { id: "rights", label: "Your Rights" },
  { id: "dpo", label: "DPO Contact" },
];

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({
  onBack,
  onAcknowledge,
  showAcknowledgeButton = true,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const [activeTab, setActiveTab] = useState("collect");
  const sectionPositions = useRef<Record<string, number>>({});

  const handleScrollToSection = (id: string) => {
    setActiveTab(id);
    const y = sectionPositions.current[id];
    if (y !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: Math.max(0, y - 16),
        animated: true,
      });
    }
  };

  const handleExportData = () => {
    Alert.alert(
      "Export Ledger",
      "Your household's expense records and receipts will be compiled into a secure CSV/PDF package and sent to your verified email.",
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "To permanently delete your account and purge your profile from household ledgers, please proceed through Account Settings or contact support@splitzy.app.",
    );
  };

  const handleContactDPO = () => {
    Alert.alert(
      "Contact Data Protection Officer",
      "Email: support@splitzy.app\nResponse window: Within 24-48 business hours.\nSubject: Data Privacy & GDPR Request",
    );
  };

  const handleDownloadOfflinePDF = () => {
    Alert.alert(
      "Offline Copy",
      "A complete offline snapshot of the Splitzy Privacy Policy has been queued for download.",
    );
  };

  const handleAcknowledge = () => {
    if (onAcknowledge) {
      onAcknowledge();
    } else {
      onBack();
    }
  };

  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    Platform.OS === "ios" ? 44 : 20,
  );

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: isDark ? colors.background : "#F8FAFC" },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      {/* Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: topInset + 8,
            backgroundColor: isDark ? colors.surface : "#FFFFFF",
            borderBottomColor: isDark ? colors.border : "#F1F5F9",
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.headerCircleBtn,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather
            name="chevron-left"
            size={22}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? colors.text : "#0F172A" },
            ]}
          >
            Privacy Policy
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDark ? colors.textSecondary : "#64748B" },
            ]}
          >
            Splitzy Security & Trust
          </Text>
        </View>

        <View
          style={[
            styles.headerCircleBtn,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={isDark ? colors.accent : "#2563EB"}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Gradient Card: Your Privacy Matters */}
        <LinearGradient
          colors={["#1E40AF", "#2563EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          {/* Top Row: Pill and Shield Icon */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroDatePill}>
              <View style={styles.greenActiveDot} />
              <Text style={styles.heroDatePillText}>
                Last updated: October 2025
              </Text>
            </View>
            <View style={styles.heroShieldIconBox}>
              <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.heroTitle}>Your Privacy Matters</Text>
          <Text style={styles.heroBody}>
            Bank-level 256-bit encryption. Your financial breakdown and receipts
            are only visible to your confirmed roommates. Never sold, never
            monetized.
          </Text>

          {/* Bottom Tags */}
          <View style={styles.heroTagsRow}>
            <View style={styles.heroTag}>
              <Feather name="lock" size={13} color="#93C5FD" />
              <Text style={styles.heroTagText}>Zero ad-tracking</Text>
            </View>
            <View style={styles.heroTag}>
              <Feather name="cloud" size={13} color="#93C5FD" />
              <Text style={styles.heroTagText}>SOC2 Compliant Cloud</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Index Section */}
        <View style={styles.quickIndexSection}>
          <View style={styles.quickIndexHeaderRow}>
            <Text
              style={[
                styles.quickIndexHeaderTitle,
                { color: isDark ? colors.textSecondary : "#94A3B8" },
              ]}
            >
              QUICK INDEX
            </Text>
            <Text style={styles.quickIndexCountText}>6 key sections</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickIndexScroll}
          >
            {QUICK_INDEX_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.quickIndexPill,
                    {
                      backgroundColor: isActive
                        ? "#2563EB"
                        : isDark
                          ? colors.card
                          : "#FFFFFF",
                      borderColor: isActive
                        ? "#2563EB"
                        : isDark
                          ? colors.border
                          : "#E2E8F0",
                    },
                  ]}
                  onPress={() => handleScrollToSection(item.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.quickIndexPillText,
                      {
                        color: isActive
                          ? "#FFFFFF"
                          : isDark
                            ? colors.textSecondary
                            : "#475569",
                        fontWeight: isActive ? "700" : "600",
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* SECTION 1: Information We Collect */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["collect"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeaderRow}>
            <View
              style={[
                styles.sectionIconBadge,
                {
                  backgroundColor: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF",
                },
              ]}
            >
              <Feather name="folder" size={17} color="#2563EB" />
            </View>
            <View style={styles.sectionHeaderTextWrap}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                1. Information We Collect
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Only what is essential for roommate expense splits
              </Text>
            </View>
          </View>

          {/* Subcard 1: Account & Profile Details */}
          <View
            style={[
              styles.subDetailCard,
              {
                backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                borderColor: isDark ? colors.border : "#F1F5F9",
              },
            ]}
          >
            <View style={styles.subDetailIconBox}>
              <Feather name="user-check" size={16} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.subDetailTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Account & Profile Details
              </Text>
              <Text
                style={[
                  styles.subDetailBody,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Your display name, verified email, and phone number used solely
                to invite flatmates and match incoming Venmo/Zelle payment
                confirmations.
              </Text>
            </View>
          </View>

          {/* Subcard 2: Expense Logs & Receipt Media */}
          <View
            style={[
              styles.subDetailCard,
              {
                backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                borderColor: isDark ? colors.border : "#F1F5F9",
              },
            ]}
          >
            <View style={styles.subDetailIconBox}>
              <Feather name="file-text" size={16} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.subDetailTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Expense Logs & Receipt Media
              </Text>
              <Text
                style={[
                  styles.subDetailBody,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Split amounts, expense category (e.g. Groceries, WiFi,
                Utilities), itemized breakdown receipts you snap with your
                camera, and room occupancy splits.
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 2: How We Use It */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["use"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeaderRow}>
            <View
              style={[
                styles.sectionIconBadge,
                {
                  backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#ECFDF5",
                },
              ]}
            >
              <Ionicons name="grid-outline" size={17} color="#059669" />
            </View>
            <View style={styles.sectionHeaderTextWrap}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                2. How We Use It
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Smart automation to keep everyone square
              </Text>
            </View>
          </View>

          {/* 2x2 Grid of feature tiles */}
          <View style={styles.featureGrid}>
            {/* Tile 1: Fair Split Math */}
            <View
              style={[
                styles.featureTile,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                  borderColor: isDark ? colors.border : "#F1F5F9",
                },
              ]}
            >
              <Ionicons name="scale-outline" size={18} color="#059669" />
              <Text
                style={[
                  styles.featureTileTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Fair Split Math
              </Text>
              <Text
                style={[
                  styles.featureTileBody,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Calculating who owes whom using minimal transaction paths.
              </Text>
            </View>

            {/* Tile 2: Friendly Nudges */}
            <View
              style={[
                styles.featureTile,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                  borderColor: isDark ? colors.border : "#F1F5F9",
                },
              ]}
            >
              <Feather name="bell" size={18} color="#059669" />
              <Text
                style={[
                  styles.featureTileTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Friendly Nudges
              </Text>
              <Text
                style={[
                  styles.featureTileBody,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Automated rent and utility reminders before due dates.
              </Text>
            </View>

            {/* Tile 3: Monthly Summaries */}
            <View
              style={[
                styles.featureTile,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                  borderColor: isDark ? colors.border : "#F1F5F9",
                },
              ]}
            >
              <Feather name="trending-up" size={18} color="#059669" />
              <Text
                style={[
                  styles.featureTileTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Monthly Summaries
              </Text>
              <Text
                style={[
                  styles.featureTileBody,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Generating clean monthly apartment spending breakdowns.
              </Text>
            </View>

            {/* Tile 4: Secure Auth */}
            <View
              style={[
                styles.featureTile,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                  borderColor: isDark ? colors.border : "#F1F5F9",
                },
              ]}
            >
              <Feather name="lock" size={18} color="#059669" />
              <Text
                style={[
                  styles.featureTileTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Secure Auth
              </Text>
              <Text
                style={[
                  styles.featureTileBody,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Passkey and OAuth logins so no passwords are ever stored.
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 3: Information Sharing */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["sharing"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeaderRow}>
            <View
              style={[
                styles.sectionIconBadge,
                {
                  backgroundColor: isDark ? "rgba(249,115,22,0.15)" : "#FFF7ED",
                },
              ]}
            >
              <Ionicons name="people-outline" size={17} color="#EA580C" />
            </View>
            <View style={styles.sectionHeaderTextWrap}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                3. Information Sharing
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Restricted to your verified apartment space
              </Text>
            </View>
          </View>

          {/* Warm Amber Roommate Visibility Box */}
          <View
            style={[
              styles.sharingCalloutBox,
              {
                backgroundColor: isDark
                  ? "rgba(245, 158, 11, 0.12)"
                  : "#FFFBEB",
                borderColor: isDark ? "rgba(245, 158, 11, 0.28)" : "#FEF3C7",
              },
            ]}
          >
            <View style={styles.sharingCalloutHeader}>
              <Feather name="eye" size={17} color="#D97706" />
              <Text style={styles.sharingCalloutTitle}>
                Roommate Group Visibility
              </Text>
            </View>
            <Text
              style={[
                styles.sharingCalloutBody,
                { color: isDark ? "#FDE68A" : "#78350F" },
              ]}
            >
              Members accepted into your specific "Apartment Space" can view
              assigned expense logs, total group balance, and attached payment
              notes. Your private bank login credentials are never shared or
              visible to roommates or Splitzy.
            </Text>
          </View>

          {/* Green Confirmation Row */}
          <View
            style={[
              styles.neverSellRow,
              {
                backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                borderColor: isDark ? colors.border : "#F1F5F9",
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text
              style={[
                styles.neverSellText,
                { color: isDark ? colors.text : "#334155" },
              ]}
            >
              Splitzy never sells your personal habits or contact data.
            </Text>
          </View>
        </View>

        {/* SECTION 4: Data Security & Storage */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["security"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeaderRow}>
            <View
              style={[
                styles.sectionIconBadge,
                {
                  backgroundColor: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF",
                },
              ]}
            >
              <Ionicons name="shield-outline" size={17} color="#2563EB" />
            </View>
            <View style={styles.sectionHeaderTextWrap}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                4. Data Security & Storage
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Cloud protection protocols
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.securityBodyText,
              { color: isDark ? colors.textSecondary : "#475569" },
            ]}
          >
            All financial logs and receipt images are transmitted using TLS 1.3
            encryption and stored with AES-256 at rest within Google Cloud
            isolated regions. Receipt media files are automatically scrubbed of
            sensitive EXIF location metadata upon upload.
          </Text>

          {/* Cloud Sync Status Row */}
          <View
            style={[
              styles.cloudSyncBar,
              {
                backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.cloudSyncLeft}>
              <Feather name="refresh-cw" size={15} color="#2563EB" />
              <Text
                style={[
                  styles.cloudSyncTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Cloud Sync Status
              </Text>
            </View>
            <View style={styles.cloudSyncRight}>
              <View style={styles.activeGreenDot} />
              <Text style={styles.cloudSyncStatusText}>Encrypted & Active</Text>
            </View>
          </View>
        </View>

        {/* SECTION 5: Your Rights & Data Export */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["rights"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeaderRow}>
            <View
              style={[
                styles.sectionIconBadge,
                {
                  backgroundColor: isDark ? "rgba(147,51,234,0.15)" : "#FAF5FF",
                },
              ]}
            >
              <Feather name="user-check" size={17} color="#9333EA" />
            </View>
            <View style={styles.sectionHeaderTextWrap}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                5. Your Rights & Data Export
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Full ownership of your roommate ledger
              </Text>
            </View>
          </View>

          {/* Action Row: Export CSV & Delete Account */}
          <View style={styles.rightsActionRow}>
            {/* Export Tile */}
            <TouchableOpacity
              style={[
                styles.rightsTile,
                {
                  backgroundColor: isDark ? "rgba(147,51,234,0.12)" : "#FAF5FF",
                  borderColor: isDark ? "rgba(147,51,234,0.3)" : "#F3E8FF",
                },
              ]}
              onPress={handleExportData}
              activeOpacity={0.75}
            >
              <Feather name="download" size={18} color="#9333EA" />
              <Text style={styles.rightsExportTitle}>Export CSV / PDF</Text>
              <Text style={styles.rightsExportSubtitle}>
                Download full shared ledger
              </Text>
            </TouchableOpacity>

            {/* Delete Account Tile */}
            <TouchableOpacity
              style={[
                styles.rightsTile,
                {
                  backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "#FEF2F2",
                  borderColor: isDark ? "rgba(239,68,68,0.3)" : "#FEE2E2",
                },
              ]}
              onPress={handleDeleteAccount}
              activeOpacity={0.75}
            >
              <Feather name="trash-2" size={18} color="#EF4444" />
              <Text style={styles.rightsDeleteTitle}>Delete Account</Text>
              <Text style={styles.rightsDeleteSubtitle}>
                Purge your personal profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 6: Data Protection Officer */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["dpo"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.dpoHeaderRow}>
            <View
              style={[
                styles.dpoIconCircle,
                { backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9" },
              ]}
            >
              <Feather
                name="help-circle"
                size={18}
                color={isDark ? colors.text : "#0F172A"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.dpoTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Data Protection Officer
              </Text>
              <Text
                style={[
                  styles.dpoSubtitle,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Got privacy questions or GDPR inquiries?
              </Text>
            </View>
          </View>

          {/* DPO Email & Contact Button Row */}
          <View
            style={[
              styles.dpoContactRow,
              {
                backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.dpoEmailWrap}>
              <Feather name="mail" size={16} color="#2563EB" />
              <Text
                style={[
                  styles.dpoEmailText,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                support@splitzy.app
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dpoContactBtn}
              onPress={handleContactDPO}
              activeOpacity={0.8}
            >
              <Text style={styles.dpoContactBtnText}>Contact</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Primary Understand Button */}
        {showAcknowledgeButton && (
          <TouchableOpacity
            style={styles.understandBtn}
            onPress={handleAcknowledge}
            activeOpacity={0.85}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.understandBtnText}>I Understand & Accept</Text>
          </TouchableOpacity>
        )}

        {/* Download Offline PDF Copy */}
        <TouchableOpacity
          style={[
            styles.downloadOfflineBtn,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onPress={handleDownloadOfflinePDF}
          activeOpacity={0.75}
        >
          <Feather
            name="download"
            size={16}
            color={isDark ? colors.text : "#0F172A"}
          />
          <Text
            style={[
              styles.downloadOfflineBtnText,
              { color: isDark ? colors.text : "#0F172A" },
            ]}
          >
            Download Offline PDF Copy
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heroDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  greenActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },
  heroDatePillText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  heroShieldIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  heroBody: {
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 19,
    marginBottom: 16,
  },
  heroTagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  quickIndexSection: {
    gap: 10,
  },
  quickIndexHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  quickIndexHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  quickIndexCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  quickIndexScroll: {
    gap: 8,
    paddingHorizontal: 2,
  },
  quickIndexPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickIndexPillText: {
    fontSize: 12,
  },
  sectionCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderTextWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  subDetailCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  subDetailIconBox: {
    marginTop: 2,
  },
  subDetailTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  subDetailBody: {
    fontSize: 11.5,
    lineHeight: 17,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  featureTile: {
    width: "48.2%",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  featureTileTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  featureTileBody: {
    fontSize: 11,
    lineHeight: 15,
  },
  sharingCalloutBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  sharingCalloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sharingCalloutTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  sharingCalloutBody: {
    fontSize: 11.5,
    lineHeight: 17,
  },
  neverSellRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  neverSellText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  securityBodyText: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 12,
  },
  cloudSyncBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  cloudSyncLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cloudSyncTitle: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  cloudSyncRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  cloudSyncStatusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  rightsActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  rightsTile: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  rightsExportTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7E22CE",
    marginTop: 8,
  },
  rightsExportSubtitle: {
    fontSize: 10.5,
    color: "#9333EA",
    marginTop: 2,
    lineHeight: 14,
  },
  rightsDeleteTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#DC2626",
    marginTop: 8,
  },
  rightsDeleteSubtitle: {
    fontSize: 10.5,
    color: "#EF4444",
    marginTop: 2,
    lineHeight: 14,
  },
  dpoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  dpoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dpoTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  dpoSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  dpoContactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
  },
  dpoEmailWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4,
  },
  dpoEmailText: {
    fontSize: 13,
    fontWeight: "700",
  },
  dpoContactBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dpoContactBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  understandBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  understandBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  downloadOfflineBtn: {
    borderRadius: 16,
    height: 48,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  downloadOfflineBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
});
