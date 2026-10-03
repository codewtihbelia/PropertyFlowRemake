import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Share,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";

export interface TermsOfServiceScreenProps {
  onBack: () => void;
  onAccept?: () => void;
  onOpenPrivacyPolicy?: () => void;
  showAcceptButton?: boolean;
}

const QUICK_NAV_ITEMS = [
  { id: "acceptance", label: "1. Acceptance" },
  { id: "accounts", label: "2. Accounts" },
  { id: "splits", label: "3. Expense Splits" },
  { id: "payments", label: "4. Payments & Non-Banking" },
  { id: "conduct", label: "5. Conduct" },
  { id: "modifications", label: "6. Termination" },
];

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({
  onBack,
  onAccept,
  onOpenPrivacyPolicy,
  showAcceptButton = true,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const [activeNav, setActiveNav] = useState("acceptance");
  const [isAgreed, setIsAgreed] = useState(false);
  const sectionPositions = useRef<Record<string, number>>({});

  const handleShare = async () => {
    try {
      await Share.share({
        title: "Splitzy Terms of Service",
        message:
          "Splitzy Legal Agreement & Household Expense Splitting Protocols: https://splitzy.app/terms",
      });
    } catch {
      // Ignore cancel
    }
  };

  const handleScrollToSection = (id: string) => {
    setActiveNav(id);
    const y = sectionPositions.current[id];
    if (y !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: Math.max(0, y - 16),
        animated: true,
      });
    }
  };

  const handleAccept = () => {
    if (!isAgreed) {
      Alert.alert(
        "Agreement Required",
        "Please confirm that you have reviewed and agree to the Splitzy Terms of Service before continuing.",
      );
      return;
    }
    if (onAccept) {
      onAccept();
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
            Terms of Service
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDark ? colors.textSecondary : "#64748B" },
            ]}
          >
            Splitzy Legal Agreement
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.headerCircleBtn,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Feather
            name="share"
            size={18}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>
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
        {/* Top Meta Pill Row */}
        <View style={styles.metaRow}>
          <View
            style={[
              styles.versionPill,
              {
                backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "#EFF6FF",
                borderColor: isDark ? "rgba(37, 99, 235, 0.3)" : "#DBEAFE",
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={14} color="#2563EB" />
            <Text style={styles.versionPillText}>
              Version 3.4 • Last updated: Oct 2025
            </Text>
          </View>
          <Text
            style={[
              styles.readTimeText,
              { color: isDark ? colors.textSecondary : "#94A3B8" },
            ]}
          >
            6 min read
          </Text>
        </View>

        {/* Hero Gradient Card: Roommate Harmony First */}
        <LinearGradient
          colors={["#2563EB", "#1D4ED8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroIconBox}>
            <MaterialCommunityIcons
              name="handshake-outline"
              size={22}
              color="#FFFFFF"
            />
          </View>
          <Text style={styles.heroTitle}>Roommate Harmony First</Text>
          <Text style={styles.heroBody}>
            Welcome to Splitzy. By logging rent, utilities, groceries, and
            managing shared expenses, you agree to these legal conditions
            designed to keep household finances transparent, fair, and
            dispute-free.
          </Text>
        </LinearGradient>

        {/* Quick Navigation Header & Pills */}
        <View style={styles.quickNavSection}>
          <View style={styles.quickNavHeaderRow}>
            <Text
              style={[
                styles.quickNavHeaderTitle,
                { color: isDark ? colors.textSecondary : "#94A3B8" },
              ]}
            >
              QUICK NAVIGATION
            </Text>
            <Text style={styles.quickNavTapToJump}>Tap to jump</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickNavScroll}
          >
            {QUICK_NAV_ITEMS.map((item) => {
              const isActive = activeNav === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.quickNavPill,
                    {
                      backgroundColor: isActive
                        ? isDark
                          ? "#2563EB"
                          : "#EFF6FF"
                        : isDark
                          ? colors.card
                          : "#FFFFFF",
                      borderColor: isActive
                        ? "#93C5FD"
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
                      styles.quickNavPillText,
                      {
                        color: isActive
                          ? isDark
                            ? "#FFFFFF"
                            : "#2563EB"
                          : isDark
                            ? colors.textSecondary
                            : "#64748B",
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

        {/* SECTION 1: Acceptance of Terms & Eligibility */}
        <View
          style={[
            styles.clauseCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["acceptance"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.clauseHeaderRow}>
            <View style={styles.clauseBadge}>
              <Text style={styles.clauseBadgeText}>1</Text>
            </View>
            <Text
              style={[
                styles.clauseTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Acceptance of Terms & Eligibility
            </Text>
          </View>
          <Text
            style={[
              styles.clauseBody,
              { color: isDark ? colors.textSecondary : "#334155" },
            ]}
          >
            By downloading, accessing, or using the Splitzy application, you
            represent that you are at least 18 years old and legally competent
            to enter into this contract. Splitzy is intended exclusively for
            non-commercial residential roommates, household members, and
            domestic partners to balance communal overheads.
          </Text>

          {/* Info Callout */}
          <View
            style={[
              styles.infoCallout,
              {
                backgroundColor: isDark ? "rgba(37, 99, 235, 0.12)" : "#EFF6FF",
                borderColor: isDark ? "rgba(37, 99, 235, 0.25)" : "#BFDBFE",
              },
            ]}
          >
            <Feather
              name="info"
              size={16}
              color="#2563EB"
              style={{ marginTop: 2 }}
            />
            <Text
              style={[
                styles.infoCalloutText,
                { color: isDark ? "#93C5FD" : "#1E40AF" },
              ]}
            >
              If you do not agree with any clause within this document, you must
              immediately deactivate your household group and uninstall the
              application.
            </Text>
          </View>
        </View>

        {/* SECTION 2: Account Security & Roommate Groups */}
        <View
          style={[
            styles.clauseCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["accounts"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.clauseHeaderRow}>
            <View style={styles.clauseBadge}>
              <Text style={styles.clauseBadgeText}>2</Text>
            </View>
            <Text
              style={[
                styles.clauseTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Account Security & Roommate Groups
            </Text>
          </View>
          <Text
            style={[
              styles.clauseBody,
              { color: isDark ? colors.textSecondary : "#334155" },
            ]}
          >
            You must provide true and verified contact information (phone number
            and active email address). You are solely responsible for all
            entries and approvals made under your credentials.
          </Text>

          {/* Sub Grid Tiles */}
          <View style={styles.subGridRow}>
            <View
              style={[
                styles.subGridTile,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                  borderColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <Text
                style={[
                  styles.subGridTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Invites & Keys
              </Text>
              <Text
                style={[
                  styles.subGridText,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                Only share household join codes with verified co-tenants.
              </Text>
            </View>

            <View
              style={[
                styles.subGridTile,
                {
                  backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                  borderColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <Text
                style={[
                  styles.subGridTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Group Admin
              </Text>
              <Text
                style={[
                  styles.subGridText,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                The leaseholder or creator holds authority to archive rooms.
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 3: Expense Splitting & Calculation Rules */}
        <View
          style={[
            styles.clauseCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["splits"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.clauseHeaderRow}>
            <View style={styles.clauseBadge}>
              <Text style={styles.clauseBadgeText}>3</Text>
            </View>
            <Text
              style={[
                styles.clauseTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Expense Splitting & Calculation Rules
            </Text>
          </View>

          <Text
            style={[
              styles.clauseLeadText,
              { color: isDark ? colors.textSecondary : "#475569" },
            ]}
          >
            Splitzy offers multiple calculation paradigms:
          </Text>

          <View style={styles.ruleBulletList}>
            <View style={styles.ruleBulletRow}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#2563EB"
                style={{ marginTop: 1 }}
              />
              <Text
                style={[
                  styles.ruleBulletText,
                  { color: isDark ? colors.text : "#334155" },
                ]}
              >
                <Text style={{ fontWeight: "700" }}>Equal Distribution: </Text>
                Total receipt sum divided evenly across all active household
                members.
              </Text>
            </View>

            <View style={styles.ruleBulletRow}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#2563EB"
                style={{ marginTop: 1 }}
              />
              <Text
                style={[
                  styles.ruleBulletText,
                  { color: isDark ? colors.text : "#334155" },
                ]}
              >
                <Text style={{ fontWeight: "700" }}>
                  Custom Ratios & Sq. Footage:{" "}
                </Text>
                Room-based percentages determined during initial room
                configuration.
              </Text>
            </View>

            <View style={styles.ruleBulletRow}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#2563EB"
                style={{ marginTop: 1 }}
              />
              <Text
                style={[
                  styles.ruleBulletText,
                  { color: isDark ? colors.text : "#334155" },
                ]}
              >
                <Text style={{ fontWeight: "700" }}>
                  Attendance Utility Offsets:{" "}
                </Text>
                Prorated metrics when a tenant is absent for prolonged periods
                (as configured by group consent).
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.italicAuditNote,
              { color: isDark ? colors.textSecondary : "#64748B" },
            ]}
          >
            All roommates share joint responsibility for auditing receipts
            within 14 calendar days of upload.
          </Text>
        </View>

        {/* SECTION 4: Payments, Ledger & Non-Banking Status */}
        <View
          style={[
            styles.clauseCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["payments"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.clauseHeaderRow}>
            <View style={styles.clauseBadge}>
              <Text style={styles.clauseBadgeText}>4</Text>
            </View>
            <Text
              style={[
                styles.clauseTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Payments, Ledger & Non-Banking Status
            </Text>
          </View>

          {/* Warm Amber Bank Warning Box */}
          <View
            style={[
              styles.bankingWarningBox,
              {
                backgroundColor: isDark
                  ? "rgba(245, 158, 11, 0.12)"
                  : "#FFFBEB",
                borderColor: isDark ? "rgba(245, 158, 11, 0.28)" : "#FEF3C7",
              },
            ]}
          >
            <View style={styles.bankingWarningHeader}>
              <MaterialCommunityIcons
                name="bank-outline"
                size={20}
                color="#B45309"
              />
              <Text style={styles.bankingWarningTitle}>
                Splitzy is Not a Banking Institution
              </Text>
            </View>
            <Text
              style={[
                styles.bankingWarningBody,
                { color: isDark ? "#FDE68A" : "#78350F" },
              ]}
            >
              Splitzy does not store user deposits, issue loans, or hold escrow
              funds. Our application operates solely as a synchronization{" "}
              <Text style={{ fontWeight: "700" }}>
                ledger for recordkeeping
              </Text>
              .
            </Text>
          </View>

          <Text
            style={[
              styles.clauseBody,
              { color: isDark ? colors.textSecondary : "#334155" },
            ]}
          >
            When marking a debt as "Settled via Cash", "Venmo", "Zelle", or
            "Bank Transfer", you confirm that the underlying physical or digital
            fiat transaction has been fully executed outside the application.
            Splitzy bears no liability for unfulfilled promises or incorrect
            peer-to-peer external routing.
          </Text>
        </View>

        {/* SECTION 5: Prohibited Conduct */}
        <View
          style={[
            styles.clauseCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["conduct"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.clauseHeaderRow}>
            <View style={styles.clauseBadge}>
              <Text style={styles.clauseBadgeText}>5</Text>
            </View>
            <Text
              style={[
                styles.clauseTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Prohibited Conduct
            </Text>
          </View>
          <Text
            style={[
              styles.clauseBody,
              { color: isDark ? colors.textSecondary : "#334155" },
            ]}
          >
            Users agree not to exploit the platform for money laundering,
            recording fictitious fraudulent debts to coerce roommates,
            generating harassing expense descriptions, or reverse engineering
            application algorithms.
          </Text>
        </View>

        {/* SECTION 6: Modifications & Termination */}
        <View
          style={[
            styles.clauseCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onLayout={(e) => {
            sectionPositions.current["modifications"] = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.clauseHeaderRow}>
            <View style={styles.clauseBadge}>
              <Text style={styles.clauseBadgeText}>6</Text>
            </View>
            <Text
              style={[
                styles.clauseTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Modifications & Termination
            </Text>
          </View>
          <Text
            style={[
              styles.clauseBody,
              { color: isDark ? colors.textSecondary : "#334155" },
            ]}
          >
            We reserve the right to revise these terms to reflect local tenancy
            guidelines or software enhancements. Continued usage 30 days after
            in-app push notification represents binding consent.
          </Text>
        </View>

        {/* Security Badge */}
        <View style={styles.encryptionBadgeRow}>
          <Feather name="lock" size={14} color="#94A3B8" />
          <Text
            style={[
              styles.encryptionBadgeText,
              { color: isDark ? colors.textSecondary : "#64748B" },
            ]}
          >
            256-Bit Encrypted Household Ledgers
          </Text>
        </View>

        {/* Agreement Checkbox Card */}
        <TouchableOpacity
          style={[
            styles.checkboxCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isAgreed
                ? "#2563EB"
                : isDark
                  ? colors.border
                  : "#E2E8F0",
            },
          ]}
          onPress={() => setIsAgreed(!isAgreed)}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.checkboxBox,
              {
                borderColor: isAgreed ? "#2563EB" : "#CBD5E1",
                backgroundColor: isAgreed ? "#2563EB" : "transparent",
              },
            ]}
          >
            {isAgreed && <Feather name="check" size={13} color="#FFFFFF" />}
          </View>
          <Text
            style={[
              styles.checkboxLabel,
              { color: isDark ? colors.text : "#334155" },
            ]}
          >
            I confirm that I have reviewed the Splitzy Terms of Service and
            agree to <Text style={{ fontWeight: "700" }}>abide</Text> by the
            household expense splitting protocols.
          </Text>
        </TouchableOpacity>

        {/* Primary CTA Button */}
        {showAcceptButton && (
          <TouchableOpacity
            style={[
              styles.acceptBtn,
              {
                opacity: isAgreed ? 1 : 0.65,
              },
            ]}
            onPress={handleAccept}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptBtnText}>Accept & Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Secondary Links */}
        <View style={styles.secondaryLinksRow}>
          <TouchableOpacity
            onPress={() => {
              if (onOpenPrivacyPolicy) {
                onOpenPrivacyPolicy();
              } else {
                Alert.alert(
                  "Privacy Policy",
                  "Review Splitzy Privacy & Security Trust protocols in your profile settings.",
                );
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.secondaryDot}>•</Text>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "Roommate Dispute FAQ",
                "Splitzy provides calculation logs and audit timestamps to help tenants resolve discrepancies peacefully. In case of disagreement, consult the timestamped ledger in Group Reports.",
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryLinkText}>Roommate Dispute FAQ</Text>
          </TouchableOpacity>
        </View>
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  versionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  versionPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#2563EB",
  },
  readTimeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
  },
  heroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  heroBody: {
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 19,
  },
  quickNavSection: {
    gap: 10,
  },
  quickNavHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  quickNavHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  quickNavTapToJump: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  quickNavScroll: {
    gap: 8,
    paddingHorizontal: 2,
  },
  quickNavPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickNavPillText: {
    fontSize: 12,
  },
  clauseCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
  },
  clauseHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  clauseBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  clauseBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },
  clauseTitle: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
    letterSpacing: -0.2,
  },
  clauseBody: {
    fontSize: 12.5,
    lineHeight: 19,
  },
  infoCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  infoCalloutText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "500",
  },
  subGridRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  subGridTile: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  subGridTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  subGridText: {
    fontSize: 11,
    lineHeight: 16,
  },
  clauseLeadText: {
    fontSize: 12.5,
    fontWeight: "600",
    marginBottom: 8,
  },
  ruleBulletList: {
    gap: 8,
    marginBottom: 8,
  },
  ruleBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  ruleBulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  italicAuditNote: {
    fontSize: 11.5,
    fontStyle: "italic",
    lineHeight: 17,
    marginTop: 8,
  },
  bankingWarningBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  bankingWarningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  bankingWarningTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#92400E",
  },
  bankingWarningBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  encryptionBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  encryptionBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  checkboxCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  acceptBtn: {
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
  acceptBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  secondaryLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  secondaryDot: {
    fontSize: 12,
    color: "#94A3B8",
  },
});
