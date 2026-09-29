import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";

interface PrivacyPolicyScreenProps {
  onBack: () => void;
  onAcknowledge?: () => void;
  showAcknowledgeButton?: boolean;
}

interface SectionItem {
  id: string;
  number: string;
  title: string;
  content: string[];
  bulletPoints?: string[];
}

const PRIVACY_SECTIONS: SectionItem[] = [
  {
    id: "commitment",
    number: "01",
    title: "Our Privacy Pledge",
    content: [
      "At Splitzy, we believe financial and living arrangements among roommates require the highest degree of trust and confidentiality. We will never sell, rent, or monetize your personal or financial data to advertising networks or third-party data brokers.",
      "This Privacy Policy explains what personal information we collect, how it is used strictly to power household expense calculations, and the rights you maintain over your records.",
    ],
    bulletPoints: [
      "Zero data selling: Your records are never sold to advertisers.",
      "Strict data isolation: Household data is isolated solely to group members.",
    ],
  },
  {
    id: "information-collected",
    number: "02",
    title: "Information We Collect",
    content: [
      "To provide accurate utility allocations and billing reconciliation, we collect only necessary functional data across three categories:",
    ],
    bulletPoints: [
      "Identity & Account: Full name, verified email address, optional contact phone number, and profile avatar.",
      "Household Operations: Household room/unit names, invitation codes, member list, and assigned Host/Payor permissions.",
      "Billing & Attendance: Utility invoices, meter photos, bill amounts, due dates, attendance and vacation date logs, and settlement proof receipts.",
      "Device & Diagnostics: Push notification device tokens (Expo notifications), operating system versions, and anonymized crash analytics.",
    ],
  },
  {
    id: "how-we-use",
    number: "03",
    title: "How We Use Your Data",
    content: [
      "We process your data strictly to execute the functional promises of the application:",
      "1. Computing accurate mathematical bill splits with integer centavo precision.",
      "2. Adjusting variable utility shares (water, electricity, gas) based on verified resident attendance days.",
      "3. Sending real-time push and in-app notifications for newly posted bills, reminder alerts, and settlement confirmations.",
      "4. Displaying transparent, timestamped audit trails for all expenses and settlement receipts within your household.",
    ],
    bulletPoints: [
      "We never use your utility bills or receipts for marketing profiling.",
      "All calculations run deterministically based on input formulas.",
    ],
  },
  {
    id: "sharing-boundaries",
    number: "04",
    title: "Household Data Boundaries",
    content: [
      "Your financial and attendance information is strictly compartmentalized. Only authenticated members who have entered the unique invite code and been accepted into your specific household can view your bills, payment statuses, and logged absences.",
      "Users belonging to other households or third parties cannot view, search, or access your household's financial transactions or invoices.",
    ],
    bulletPoints: [
      "Strict perimeter around each household unit.",
      "Admins of other households cannot see your receipts or attendance.",
    ],
  },
  {
    id: "security-storage",
    number: "05",
    title: "Security & Cloud Infrastructure",
    content: [
      "Splitzy uses modern cloud architecture with industry-standard TLS 256-bit encryption in transit and AES-256 encryption at rest:",
      "• Database & Auth: Built on Google Cloud Firestore with granular, server-enforced security rules preventing unauthorized data manipulation.",
      "• Media & Receipt Storage: Receipt photos and avatars are stored securely on Cloudinary CDN with authenticated access channels.",
      "• Passwords: User passwords are encrypted via Firebase Authentication and are never accessible to Splitzy engineers or hosts in plain text.",
    ],
  },
  {
    id: "retention-rights",
    number: "06",
    title: "Your Rights & Data Retention",
    content: [
      "Under applicable data privacy regulations (including GDPR and CCPA), you hold the following rights:",
      "• Right of Access & Export: You may view and export your entire billing and payment history at any time.",
      "• Right of Rectification: You may correct your profile information directly from your settings.",
      "• Right of Erasure: You may request complete deletion of your account. When an account is deleted, personal identifiers are purged from active systems, while anonymized historical expense line items remain in household archives for ledger balance integrity.",
    ],
    bulletPoints: [
      "Full export capability for tax and rental accounting.",
      "Account deletion purges your credentials and active profile.",
    ],
  },
  {
    id: "third-parties",
    number: "07",
    title: "Third-Party Service Providers",
    content: [
      "We work with trusted infrastructure providers who adhere to strict data processing agreements:",
      "• Google Cloud & Firebase: Core database, user authentication, and hosting.",
      "• Cloudinary: Encrypted storage and CDN delivery for bill and receipt images.",
      "• Expo / Apple Push Services: Routing notification alerts to your mobile device.",
    ],
  },
  {
    id: "contact-dpo",
    number: "08",
    title: "Contact & Privacy Officer",
    content: [
      "If you have questions about how your household data is managed, or wish to exercise your data privacy rights, please contact our Data Protection Officer at privacy@splitzy.app.",
      "We respond to all verified data requests within 30 days.",
    ],
  },
];

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({
  onBack,
  onAcknowledge,
  showAcknowledgeButton = false,
}) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string>("commitment");
  const scrollViewRef = useRef<ScrollView>(null);

  const filteredSections = PRIVACY_SECTIONS.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.content.some((p) =>
        p.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <View style={styles.headerBadgeRow}>
            <View style={styles.iconSquare}>
              <Feather name="shield" size={15} color="#10B981" />
            </View>
            <Text style={styles.headerTitle}>Privacy Policy</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            How We Protect Your Household Data
          </Text>
        </View>

        <View style={styles.headerActionPlaceholder} />
      </View>

      {/* Metadata Bar */}
      <View style={styles.metadataBar}>
        <View style={styles.metadataItem}>
          <Feather name="calendar" size={13} color="#64748B" />
          <Text style={styles.metadataText}>Updated September 2026</Text>
        </View>
        <Text style={styles.metadataDot}>·</Text>
        <View style={styles.metadataItem}>
          <Feather name="lock" size={13} color="#64748B" />
          <Text style={styles.metadataText}>GDPR & CCPA Compliant</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search privacy topics..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick Jump Section Pills */}
      {searchQuery.trim().length === 0 && (
        <View style={styles.quickNavWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickNavScroll}
          >
            {PRIVACY_SECTIONS.map((sec) => (
              <TouchableOpacity
                key={sec.id}
                style={[
                  styles.quickNavPill,
                  activeSectionId === sec.id && styles.quickNavPillActive,
                ]}
                onPress={() => setActiveSectionId(sec.id)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.quickNavText,
                    activeSectionId === sec.id && styles.quickNavTextActive,
                  ]}
                >
                  {sec.number}. {sec.title.split(" ")[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content Scroll View */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 28, 40) },
        ]}
        showsVerticalScrollIndicator={true}
      >
        {/* Security Shield Banner */}
        <View style={styles.securityBanner}>
          <View style={styles.securityHeaderRow}>
            <View style={styles.securityShieldCircle}>
              <Feather name="shield" size={18} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityBannerTitle}>
                Privacy-First Architecture
              </Text>
              <Text style={styles.securityBannerSubtitle}>
                No advertising trackers. No data broker syndication.
              </Text>
            </View>
          </View>
          <Text style={styles.securityBannerBody}>
            Your utility invoices, meter readings, and attendance calendars are
            only accessible by verified roommates who have joined your
            designated household.
          </Text>
        </View>

        {/* Section Cards */}
        {filteredSections.map((sec) => {
          const isActive = activeSectionId === sec.id && !searchQuery;
          return (
            <View
              key={sec.id}
              style={[
                styles.sectionCard,
                isActive && styles.sectionCardHighlighted,
              ]}
            >
              {/* Section Header */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionNumberBadge}>
                  <Text style={styles.sectionNumberText}>{sec.number}</Text>
                </View>
                <Text style={styles.sectionTitle}>{sec.title}</Text>
              </View>

              {/* Section Body */}
              <View style={styles.sectionBody}>
                {sec.content.map((paragraph, pIdx) => (
                  <Text key={pIdx} style={styles.paragraphText}>
                    {paragraph}
                  </Text>
                ))}
              </View>

              {/* Bullet points if available */}
              {sec.bulletPoints && sec.bulletPoints.length > 0 && (
                <View style={styles.bulletBox}>
                  {sec.bulletPoints.map((point, bIdx) => (
                    <View key={bIdx} style={styles.bulletRow}>
                      <Ionicons
                        name="shield-checkmark"
                        size={15}
                        color="#059669"
                        style={{ marginTop: 2, marginRight: 6 }}
                      />
                      <Text style={styles.bulletText}>{point}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {filteredSections.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="search" size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>
              No matching privacy topics found
            </Text>
            <Text style={styles.emptySubtitle}>
              Try searching with words like "security", "receipt", "delete", or
              "data".
            </Text>
            <TouchableOpacity
              style={styles.emptyResetBtn}
              onPress={() => setSearchQuery("")}
            >
              <Text style={styles.emptyResetText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Privacy Officer Contact Card */}
        <View style={styles.supportCard}>
          <Feather name="lock" size={20} color="#059669" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.supportTitle}>Data Privacy Inquiries</Text>
            <Text style={styles.supportText}>
              Contact our Data Protection Officer at privacy@splitzy.app
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Optional Sticky Acknowledge Button */}
      {showAcknowledgeButton && (
        <View
          style={[
            styles.bottomStickyBar,
            { paddingBottom: Math.max(insets.bottom + 12, 20) },
          ]}
        >
          <TouchableOpacity
            style={styles.acknowledgeButton}
            onPress={onAcknowledge || onBack}
            activeOpacity={0.88}
          >
            <Text style={styles.acknowledgeButtonText}>I Understand</Text>
            <Feather name="check" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  headerTitleContainer: {
    alignItems: "center",
    flex: 1,
    marginHorizontal: 8,
  },
  headerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconSquare: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
    fontWeight: "500",
  },
  headerActionPlaceholder: {
    width: 40,
  },
  metadataBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 8,
  },
  metadataItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metadataText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  metadataDot: {
    color: "#94A3B8",
    fontSize: 12,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: "#FFFFFF",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    paddingVertical: 0,
  },
  quickNavWrapper: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 10,
  },
  quickNavScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  quickNavPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickNavPillActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  quickNavText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  quickNavTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  securityBanner: {
    backgroundColor: "#ECFDF5",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  securityHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  securityShieldCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  securityBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065F46",
  },
  securityBannerSubtitle: {
    fontSize: 11,
    color: "#047857",
    fontWeight: "500",
  },
  securityBannerBody: {
    fontSize: 12,
    color: "#064E3B",
    lineHeight: 18,
    fontWeight: "500",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  sectionCardHighlighted: {
    borderColor: "#A7F3D0",
    backgroundColor: "#FFFFFF",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  sectionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },
  sectionBody: {
    gap: 8,
  },
  paragraphText: {
    fontSize: 12.5,
    color: "#334155",
    lineHeight: 19,
  },
  bulletBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
    lineHeight: 17,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 260,
  },
  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
  },
  emptyResetText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 8,
  },
  supportTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  supportText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  bottomStickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  acknowledgeButton: {
    backgroundColor: "#059669",
    borderRadius: 14,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  acknowledgeButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
