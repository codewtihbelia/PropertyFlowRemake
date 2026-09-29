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

interface TermsOfServiceScreenProps {
  onBack: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

interface SectionItem {
  id: string;
  number: string;
  title: string;
  content: string[];
  keyPoints?: string[];
}

const SECTIONS: SectionItem[] = [
  {
    id: "acceptance",
    number: "01",
    title: "Acceptance of Terms",
    content: [
      'By creating an account, downloading, or using Splitzy (the "Service"), you agree to be legally bound by these Terms of Service ("Terms"). If you do not agree with any part of these Terms, you may not access or use the Service.',
      "You must be at least 18 years of age or the legal age of majority in your jurisdiction to create an independent household. By agreeing, you represent that all registration information you submit is accurate and truthful.",
    ],
    keyPoints: [
      "Agreement is required to create a household or join as a payor.",
      "All submitted credentials and household data must be accurate.",
    ],
  },
  {
    id: "service-scope",
    number: "02",
    title: "Scope of Service & Utility Splitting",
    content: [
      "Splitzy provides a digital coordination system for roommates, housemates, and property hosts to track group expenditures, record utility meter readings, log attendance-based utility subtractions, and reconcile payment settlements.",
      "Splitzy is not a registered bank, financial institution, or money transmitter. We do not hold escrow deposits or process fiat transfers directly. All financial transactions occur between roommates or via external payment channels (e.g., GCash, Maya, bank transfer, cash).",
    ],
    keyPoints: [
      "Splitzy facilitates calculations and ledger recording only.",
      "Roommates settle balances directly through their preferred payment methods.",
    ],
  },
  {
    id: "roles",
    number: "03",
    title: "Host and Payor Responsibilities",
    content: [
      "Household Host: The designated Host administers the household space, inputs utility invoices, defines billing cycles, sets default allocation rules, and verifies payment receipts uploaded by payors. Hosts agree to input legitimate utility amounts and preserve transparent calculation logs.",
      "Roommate / Payor: Payors agree to review monthly statements promptly, declare accurate vacation dates or temporary absences before bill cycles lock, and submit legitimate proof of payment receipts upon settlement.",
    ],
    keyPoints: [
      "Hosts must upload genuine bill receipts and maintain transparent ledgers.",
      "Payors are responsible for timely review and settlement of assigned shares.",
    ],
  },
  {
    id: "centavo-math",
    number: "04",
    title: "Centavo Precision & Allocation Engine",
    content: [
      "Splitzy operates on an exact integer centavo math engine to prevent floating-point rounding errors. Bill shares are divided with mathematical precision, and any remaining fractional centavos are distributed deterministically according to our verified fairness algorithm.",
      "Attendance adjustments for utilities (such as electricity, water, and gas) calculate daily rates based on validated days present during the specific billing cycle. Fixed recurring costs (such as unit rent or broadband internet) are distributed evenly unless otherwise agreed in writing.",
    ],
    keyPoints: [
      "All calculations are performed with exact integer centavo precision.",
      "Variable utilities reflect validated attendance days; fixed fees split evenly.",
    ],
  },
  {
    id: "receipts-payments",
    number: "05",
    title: "Receipt Verification & Payment Proofs",
    content: [
      "When settling bills, members may upload digital transfer receipts or screenshots. Users guarantee that all uploaded images represent genuine payment receipts with valid transaction reference numbers.",
      "Hosts maintain final verification authority to approve or mark payments as pending upon confirming receipt of funds in their designated accounts. Splitzy maintains an immutable audit trail of all settlement actions.",
    ],
    keyPoints: [
      "Never upload fraudulent, forged, or duplicate payment receipts.",
      "Full audit logs record who uploaded, approved, or adjusted every bill.",
    ],
  },
  {
    id: "attendance-rules",
    number: "06",
    title: "Attendance Logging & Vacation Policies",
    content: [
      "Residents must mark periods of absence or vacation prior to the host finalizing the monthly billing cycle. Once a billing period is locked and archived by the Host, historical attendance adjustments cannot be retroactively applied without Host re-calculation.",
      "Hosts may configure minimum threshold rules (e.g., absences under 3 days do not qualify for utility discounts) as agreed upon within the household charter.",
    ],
    keyPoints: [
      "Absences must be logged before the billing cycle is officially finalized.",
      "Household-level custom rules govern minimum day deduction thresholds.",
    ],
  },
  {
    id: "acceptable-use",
    number: "07",
    title: "Acceptable Use & User Conduct",
    content: [
      "You agree not to use Splitzy for any unlawful purpose, money laundering, harassment of roommates, or unauthorized data scraping.",
      "Any member found intentionally fabricating billing amounts, forging receipts, or attempting to compromise the security of other households will have their account immediately suspended.",
    ],
    keyPoints: [
      "Zero tolerance for forged receipts or fraudulent expense reports.",
      "Violation results in immediate household revocation and account suspension.",
    ],
  },
  {
    id: "termination",
    number: "08",
    title: "Termination & Data Export",
    content: [
      "You may leave a household or request account deletion at any time. When leaving a household, your historical payment records remain part of the household ledger for tax and dispute accountability.",
      "Hosts wishing to close an active household must ensure all pending member dues have been marked resolved or forgiven prior to archiving the group.",
    ],
    keyPoints: [
      "You retain the right to export your billing transaction history.",
      "Archived ledger entries are retained for household accounting integrity.",
    ],
  },
  {
    id: "disclaimer",
    number: "09",
    title: "Disclaimer of Warranties & Liability",
    content: [
      'Splitzy is provided on an "AS IS" and "AS AVAILABLE" basis. While we strive for 100% calculation accuracy and high availability, we are not liable for roommate interpersonal disputes, unpaid rents, eviction proceedings, or external payment processor delays.',
      "Under no circumstances shall Splitzy, its developers, or affiliates be liable for indirect, incidental, or consequential damages resulting from household bill disputes.",
    ],
  },
  {
    id: "contact",
    number: "10",
    title: "Modifications & Contact",
    content: [
      "We reserve the right to modify these Terms at any time. We will provide in-app notification when material updates are published. Continued use after changes constitutes agreement.",
      "For questions regarding these Terms or household dispute assistance, please reach out to our team at support@splitzy.app or visit our website.",
    ],
  },
];

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({
  onBack,
  onAccept,
  showAcceptButton = false,
}) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string>("acceptance");
  const scrollViewRef = useRef<ScrollView>(null);

  const filteredSections = SECTIONS.filter(
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
              <Feather name="file-text" size={15} color="#2563EB" />
            </View>
            <Text style={styles.headerTitle}>Terms of Service</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Splitzy Roommate Expense Platform
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
          <Feather name="shield" size={13} color="#64748B" />
          <Text style={styles.metadataText}>Version 2.4</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search terms or clauses..."
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

      {/* Quick Jump Section Pills (when not searching) */}
      {searchQuery.trim().length === 0 && (
        <View style={styles.quickNavWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickNavScroll}
          >
            {SECTIONS.map((sec) => (
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
        {/* Intro Highlight Banner */}
        <View style={styles.introCard}>
          <View style={styles.introHeaderRow}>
            <Ionicons name="information-circle" size={20} color="#2563EB" />
            <Text style={styles.introTitle}>Summary for Roommates</Text>
          </View>
          <Text style={styles.introBody}>
            Splitzy is designed to foster harmony and transparency. Our software
            calculates precise mathematical splits using integer centavo
            precision and verified attendance. Please read these terms to
            understand your rights, payment settlement duties, and host
            privileges.
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

              {/* Key Takeaways if available */}
              {sec.keyPoints && sec.keyPoints.length > 0 && (
                <View style={styles.keyPointsBox}>
                  <Text style={styles.keyPointsTitle}>Key Principles:</Text>
                  {sec.keyPoints.map((point, kIdx) => (
                    <View key={kIdx} style={styles.keyPointRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={15}
                        color="#10B981"
                        style={{ marginTop: 2, marginRight: 6 }}
                      />
                      <Text style={styles.keyPointText}>{point}</Text>
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
            <Text style={styles.emptyTitle}>No matching clauses found</Text>
            <Text style={styles.emptySubtitle}>
              Try searching with different keywords like "utility", "host", or
              "payment".
            </Text>
            <TouchableOpacity
              style={styles.emptyResetBtn}
              onPress={() => setSearchQuery("")}
            >
              <Text style={styles.emptyResetText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Support & Legal Inquiries Card */}
        <View style={styles.supportCard}>
          <Feather name="mail" size={20} color="#2563EB" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.supportTitle}>
              Have questions about our Terms?
            </Text>
            <Text style={styles.supportText}>
              Reach our legal & customer success team at support@splitzy.app
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Optional Sticky Accept Button (for registration / onboarding flows) */}
      {showAcceptButton && (
        <View
          style={[
            styles.bottomStickyBar,
            { paddingBottom: Math.max(insets.bottom + 12, 20) },
          ]}
        >
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={onAccept || onBack}
            activeOpacity={0.88}
          >
            <Text style={styles.acceptButtonText}>I Agree to the Terms</Text>
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
    backgroundColor: "#EFF6FF",
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
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  quickNavText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  quickNavTextActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  introCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  introHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  introTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E40AF",
  },
  introBody: {
    fontSize: 12,
    color: "#1E3A8A",
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
    borderColor: "#93C5FD",
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
    color: "#2563EB",
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
  keyPointsBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 6,
  },
  keyPointsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  keyPointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  keyPointText: {
    flex: 1,
    fontSize: 11.5,
    color: "#0F766E",
    fontWeight: "600",
    lineHeight: 16,
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
    backgroundColor: "#EFF6FF",
  },
  emptyResetText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
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
  acceptButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
