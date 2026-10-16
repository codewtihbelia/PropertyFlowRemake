import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { mobileDataService } from "../../services/firebaseDataService";
import { formatPesos } from "@propertyflow/shared";

interface SuperAdminHostReviewsViewProps {
  applications: any[];
}

export const SuperAdminHostReviewsView: React.FC<
  SuperAdminHostReviewsViewProps
> = ({ applications }) => {
  const { isDark, colors } = useTheme();

  const [filter, setFilter] = useState<
    "PENDING" | "APPROVED" | "REJECTED" | "ALL"
  >("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT" | null>(
    null,
  );
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredApps = applications.filter((app) => {
    if (filter !== "ALL" && app.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = String(app.applicantName || "")
        .toLowerCase()
        .includes(q);
      const matchEmail = String(app.applicantEmail || app.userEmail || "")
        .toLowerCase()
        .includes(q);
      const matchProp = String(app.propertyName || app.householdName || "")
        .toLowerCase()
        .includes(q);
      const matchAddr = String(app.propertyAddress || "")
        .toLowerCase()
        .includes(q);
      return matchName || matchEmail || matchProp || matchAddr;
    }
    return true;
  });

  const pendingCount = applications.filter(
    (a) => a.status === "PENDING",
  ).length;

  const handleOpenReview = (app: any, action: "APPROVE" | "REJECT") => {
    setSelectedApp(app);
    setReviewAction(action);
    setFeedback(
      action === "APPROVE"
        ? "Application approved by Super Admin. Welcome to Splitzy Host!"
        : "Application not approved at this time. Please ensure property details and credentials are valid.",
    );
  };

  const handleConfirmReview = async () => {
    if (!selectedApp || !reviewAction) return;
    const targetId = selectedApp.applicationId || selectedApp.id;
    if (!targetId) return;

    setSubmitting(true);
    try {
      const status = reviewAction === "APPROVE" ? "APPROVED" : "REJECTED";
      await mobileDataService.reviewHostApplication(
        targetId,
        status,
        feedback.trim(),
      );

      Alert.alert(
        reviewAction === "APPROVE" ? "Host Approved!" : "Application Rejected",
        `Application for ${selectedApp.applicantName} has been ${status.toLowerCase()}.`,
        [{ text: "OK" }],
      );

      setSelectedApp(null);
      setReviewAction(null);
      setFeedback("");
    } catch (err: any) {
      Alert.alert(
        "Review Error",
        err?.message || "Failed to update host application.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
              borderColor: isDark ? "#334155" : "#E2E8F0",
            },
          ]}
        >
          <Feather
            name="search"
            size={16}
            color={isDark ? "#94A3B8" : "#64748B"}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: isDark ? "#F8FAFC" : "#0F172A" },
            ]}
            placeholder="Search by name, property, or email..."
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather
                name="x"
                size={16}
                color={isDark ? "#94A3B8" : "#64748B"}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((tab) => {
            const isActive = filter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: isActive
                      ? isDark
                        ? "#F8FAFC"
                        : "#0F172A"
                      : isDark
                        ? "#1E293B"
                        : "#FFFFFF",
                    borderColor: isActive
                      ? isDark
                        ? "#F8FAFC"
                        : "#0F172A"
                      : isDark
                        ? "#334155"
                        : "#E2E8F0",
                  },
                ]}
                onPress={() => setFilter(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    {
                      color: isActive
                        ? isDark
                          ? "#0F172A"
                          : "#FFFFFF"
                        : isDark
                          ? "#94A3B8"
                          : "#64748B",
                    },
                  ]}
                >
                  {tab === "PENDING"
                    ? `Pending (${pendingCount})`
                    : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List of Applications */}
      <ScrollView
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}
      >
        {filteredApps.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather
              name="check-circle"
              size={36}
              color={isDark ? "#475569" : "#CBD5E1"}
            />
            <Text
              style={[
                styles.emptyTitle,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              No Applications Found
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {filter === "PENDING"
                ? "All pending host applications have been reviewed."
                : "No applications match the current search criteria."}
            </Text>
          </View>
        ) : (
          filteredApps.map((app) => {
            const isPending = app.status === "PENDING";
            const isApproved = app.status === "APPROVED";
            const isRejected = app.status === "REJECTED";

            return (
              <View
                key={app.applicationId || app.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                    borderColor: isDark ? "#1E293B" : "#E2E8F0",
                  },
                ]}
              >
                {/* Top Info */}
                <View style={styles.cardHeader}>
                  <View style={styles.applicantAvatarBox}>
                    <Text style={styles.applicantAvatarText}>
                      {String(app.applicantName || "R")
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text
                      style={[
                        styles.applicantName,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      {app.applicantName || "Applicant"}
                    </Text>
                    <Text
                      style={[
                        styles.applicantMeta,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      {app.applicantEmail || app.userEmail || "No email"} ·{" "}
                      {app.phoneNumber || app.applicantPhone || "No phone"}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isPending && styles.statusBadgePending,
                      isApproved && styles.statusBadgeApproved,
                      isRejected && styles.statusBadgeRejected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isPending && styles.statusTextPending,
                        isApproved && styles.statusTextApproved,
                        isRejected && styles.statusTextRejected,
                      ]}
                    >
                      {app.status}
                    </Text>
                  </View>
                </View>

                {/* Property Details */}
                <View
                  style={[
                    styles.detailsBox,
                    {
                      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                      borderColor: isDark ? "#334155" : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={styles.detailRow}>
                    <Feather name="home" size={13} color="#6366F1" />
                    <Text
                      style={[
                        styles.detailKey,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Property:
                    </Text>
                    <Text
                      style={[
                        styles.detailVal,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      {app.propertyName ||
                        app.householdName ||
                        "Co-living Space"}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Feather name="map-pin" size={13} color="#EC4899" />
                    <Text
                      style={[
                        styles.detailKey,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Address:
                    </Text>
                    <Text
                      style={[
                        styles.detailVal,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                      numberOfLines={1}
                    >
                      {app.propertyAddress || "Not specified"}
                    </Text>
                  </View>

                  {Boolean(app.monthlyRentOrShare) && (
                    <View style={styles.detailRow}>
                      <Feather name="dollar-sign" size={13} color="#10B981" />
                      <Text
                        style={[
                          styles.detailKey,
                          { color: isDark ? "#94A3B8" : "#64748B" },
                        ]}
                      >
                        Est. Rent / Share:
                      </Text>
                      <Text
                        style={[
                          styles.detailVal,
                          { color: isDark ? "#F8FAFC" : "#0F172A" },
                        ]}
                      >
                        {formatPesos(Number(app.monthlyRentOrShare) * 100)}
                      </Text>
                    </View>
                  )}

                  {Boolean(app.reason || app.reasonForApplying) && (
                    <View
                      style={[
                        styles.detailRow,
                        { alignItems: "flex-start", marginTop: 2 },
                      ]}
                    >
                      <Feather
                        name="file-text"
                        size={13}
                        color="#F59E0B"
                        style={{ marginTop: 2 }}
                      />
                      <Text
                        style={[
                          styles.detailKey,
                          { color: isDark ? "#94A3B8" : "#64748B" },
                        ]}
                      >
                        Reason:
                      </Text>
                      <Text
                        style={[
                          styles.detailVal,
                          { color: isDark ? "#CBD5E1" : "#334155", flex: 1 },
                        ]}
                      >
                        {app.reason || app.reasonForApplying}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Review Notes if available */}
                {Boolean(app.reviewNotes || app.adminFeedback) && (
                  <View style={styles.feedbackBox}>
                    <Text style={styles.feedbackTitle}>Admin Feedback:</Text>
                    <Text style={styles.feedbackText}>
                      {app.reviewNotes || app.adminFeedback}
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.rejectBtn,
                      { opacity: isRejected ? 0.4 : 1 },
                    ]}
                    onPress={() => handleOpenReview(app, "REJECT")}
                    activeOpacity={0.7}
                  >
                    <Feather name="x-circle" size={15} color="#E11D48" />
                    <Text style={styles.rejectBtnText}>
                      {isRejected ? "Rejected" : "Reject"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.approveBtn,
                      { opacity: isApproved ? 0.4 : 1 },
                    ]}
                    onPress={() => handleOpenReview(app, "APPROVE")}
                    activeOpacity={0.7}
                  >
                    <Feather name="check-circle" size={15} color="#FFFFFF" />
                    <Text style={styles.approveBtnText}>
                      {isApproved ? "Approved Host" : "Approve as Host"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Confirmation & Review Modal */}
      <Modal
        visible={Boolean(selectedApp && reviewAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedApp(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconBox,
                  {
                    backgroundColor:
                      reviewAction === "APPROVE"
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(225, 29, 72, 0.15)",
                  },
                ]}
              >
                <Feather
                  name={
                    reviewAction === "APPROVE" ? "shield" : "alert-triangle"
                  }
                  size={22}
                  color={reviewAction === "APPROVE" ? "#10B981" : "#E11D48"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  {reviewAction === "APPROVE"
                    ? "Approve Host Application"
                    : "Reject Host Application"}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Applicant: {selectedApp?.applicantName}
                </Text>
              </View>
            </View>

            <View style={styles.modalNotice}>
              <Text style={styles.modalNoticeText}>
                {reviewAction === "APPROVE"
                  ? "Granting approval elevates this user's platform role to HOST. They will gain immediate privileges to create and manage residential co-living spaces."
                  : "Rejecting this application will inform the resident. Please specify constructive feedback below so the applicant can correct their submission."}
              </Text>
            </View>

            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? "#CBD5E1" : "#334155" },
              ]}
            >
              Reviewer Notes / Feedback:
            </Text>
            <TextInput
              style={[
                styles.feedbackInput,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  borderColor: isDark ? "#334155" : "#CBD5E1",
                },
              ]}
              multiline
              numberOfLines={3}
              placeholder="Enter feedback notes..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={feedback}
              onChangeText={setFeedback}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.cancelModalBtn,
                  { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                ]}
                onPress={() => setSelectedApp(null)}
                disabled={submitting}
              >
                <Text
                  style={[
                    styles.cancelModalBtnText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmModalBtn,
                  {
                    backgroundColor:
                      reviewAction === "APPROVE" ? "#10B981" : "#E11D48",
                  },
                ]}
                onPress={handleConfirmReview}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmModalBtnText}>
                    {reviewAction === "APPROVE"
                      ? "Confirm Approval"
                      : "Confirm Rejection"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  filterSection: {
    paddingVertical: 6,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  scrollList: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  emptyCard: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
    maxWidth: 240,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  applicantAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
  },
  applicantAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  cardHeaderText: {
    flex: 1,
  },
  applicantName: {
    fontSize: 14,
    fontWeight: "800",
  },
  applicantMeta: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgePending: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  statusBadgeApproved: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusBadgeRejected: {
    backgroundColor: "rgba(225, 29, 72, 0.15)",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  statusTextPending: {
    color: "#F59E0B",
  },
  statusTextApproved: {
    color: "#10B981",
  },
  statusTextRejected: {
    color: "#E11D48",
  },
  detailsBox: {
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailKey: {
    fontSize: 11,
    fontWeight: "600",
    minWidth: 85,
  },
  detailVal: {
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
  },
  feedbackBox: {
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    padding: 8,
    borderRadius: 8,
  },
  feedbackTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6366F1",
  },
  feedbackText: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  rejectBtn: {
    backgroundColor: "rgba(225, 29, 72, 0.1)",
  },
  rejectBtnText: {
    color: "#E11D48",
    fontSize: 12,
    fontWeight: "800",
  },
  approveBtn: {
    backgroundColor: "#10B981",
  },
  approveBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  modalNotice: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    padding: 10,
    borderRadius: 10,
  },
  modalNoticeText: {
    fontSize: 11.5,
    color: "#D97706",
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    textAlignVertical: "top",
    minHeight: 65,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  cancelModalBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  confirmModalBtn: {
    flex: 1.5,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmModalBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
