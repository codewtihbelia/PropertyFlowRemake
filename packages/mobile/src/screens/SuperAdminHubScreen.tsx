import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { mobileDataService } from "../services/firebaseDataService";
import { formatPesos } from "@propertyflow/shared";

export type AdminModuleTab =
  | "host_reviews"
  | "users"
  | "groups"
  | "maintenance";

const safeFormatPesos = (centavos: number): string => {
  try {
    if (typeof formatPesos === "function") {
      return formatPesos(centavos);
    }
  } catch {}
  const abs = Math.abs(centavos || 0);
  const p = Math.floor(abs / 100);
  const c = abs % 100;
  return `${centavos < 0 ? "-" : ""}₱${p.toLocaleString("en-PH")}.${c.toString().padStart(2, "0")}`;
};

// ==========================================
// SUB-VIEW 1: HOST APPLICATIONS REVIEW QUEUE
// ==========================================
interface HostReviewsViewProps {
  applications: any[];
}

const SuperAdminHostReviewsView: React.FC<HostReviewsViewProps> = ({
  applications,
}) => {
  const { isDark } = useTheme();

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

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
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
  }, [applications, filter, searchQuery]);

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
    <View style={viewStyles.container}>
      {/* Search Input */}
      <View style={viewStyles.searchSection}>
        <View
          style={[
            viewStyles.searchBox,
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
              viewStyles.searchInput,
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
      <View style={viewStyles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={viewStyles.filterScroll}
        >
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((tab) => {
            const isActive = filter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  viewStyles.filterBtn,
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
                    viewStyles.filterBtnText,
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

      {/* Applications List */}
      <ScrollView
        contentContainerStyle={viewStyles.scrollList}
        showsVerticalScrollIndicator={false}
      >
        {filteredApps.length === 0 ? (
          <View style={viewStyles.emptyCard}>
            <Feather
              name="check-circle"
              size={36}
              color={isDark ? "#475569" : "#CBD5E1"}
            />
            <Text
              style={[
                viewStyles.emptyTitle,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              No Applications Found
            </Text>
            <Text
              style={[
                viewStyles.emptySubtitle,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {filter === "PENDING"
                ? "All pending host applications have been reviewed."
                : "No applications match the current criteria."}
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
                  viewStyles.card,
                  {
                    backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                    borderColor: isDark ? "#1E293B" : "#E2E8F0",
                  },
                ]}
              >
                <View style={viewStyles.cardHeader}>
                  <View style={viewStyles.applicantAvatarBox}>
                    <Text style={viewStyles.applicantAvatarText}>
                      {String(app.applicantName || "R")
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={viewStyles.cardHeaderText}>
                    <Text
                      style={[
                        viewStyles.applicantName,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      {app.applicantName || "Applicant"}
                    </Text>
                    <Text
                      style={[
                        viewStyles.applicantMeta,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      {app.applicantEmail || app.userEmail || "No email"} ·{" "}
                      {app.phoneNumber || app.applicantPhone || "No phone"}
                    </Text>
                  </View>

                  <View
                    style={[
                      viewStyles.statusBadge,
                      isPending && viewStyles.statusBadgePending,
                      isApproved && viewStyles.statusBadgeApproved,
                      isRejected && viewStyles.statusBadgeRejected,
                    ]}
                  >
                    <Text
                      style={[
                        viewStyles.statusBadgeText,
                        isPending && viewStyles.statusTextPending,
                        isApproved && viewStyles.statusTextApproved,
                        isRejected && viewStyles.statusTextRejected,
                      ]}
                    >
                      {app.status}
                    </Text>
                  </View>
                </View>

                {/* Property Details */}
                <View
                  style={[
                    viewStyles.detailsBox,
                    {
                      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                      borderColor: isDark ? "#334155" : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={viewStyles.detailRow}>
                    <Feather name="home" size={13} color="#6366F1" />
                    <Text
                      style={[
                        viewStyles.detailKey,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Property:
                    </Text>
                    <Text
                      style={[
                        viewStyles.detailVal,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      {app.propertyName ||
                        app.householdName ||
                        "Co-living Space"}
                    </Text>
                  </View>

                  <View style={viewStyles.detailRow}>
                    <Feather name="map-pin" size={13} color="#EC4899" />
                    <Text
                      style={[
                        viewStyles.detailKey,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Address:
                    </Text>
                    <Text
                      style={[
                        viewStyles.detailVal,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                      numberOfLines={1}
                    >
                      {app.propertyAddress || "Not specified"}
                    </Text>
                  </View>

                  {Boolean(app.monthlyRentOrShare) && (
                    <View style={viewStyles.detailRow}>
                      <Feather name="dollar-sign" size={13} color="#10B981" />
                      <Text
                        style={[
                          viewStyles.detailKey,
                          { color: isDark ? "#94A3B8" : "#64748B" },
                        ]}
                      >
                        Est. Rent / Share:
                      </Text>
                      <Text
                        style={[
                          viewStyles.detailVal,
                          { color: isDark ? "#F8FAFC" : "#0F172A" },
                        ]}
                      >
                        {safeFormatPesos(Number(app.monthlyRentOrShare) * 100)}
                      </Text>
                    </View>
                  )}

                  {Boolean(app.reason || app.reasonForApplying) && (
                    <View
                      style={[
                        viewStyles.detailRow,
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
                          viewStyles.detailKey,
                          { color: isDark ? "#94A3B8" : "#64748B" },
                        ]}
                      >
                        Reason:
                      </Text>
                      <Text
                        style={[
                          viewStyles.detailVal,
                          { color: isDark ? "#CBD5E1" : "#334155", flex: 1 },
                        ]}
                      >
                        {app.reason || app.reasonForApplying}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Review Notes */}
                {Boolean(app.reviewNotes || app.adminFeedback) && (
                  <View style={viewStyles.feedbackBox}>
                    <Text style={viewStyles.feedbackTitle}>
                      Admin Feedback:
                    </Text>
                    <Text style={viewStyles.feedbackText}>
                      {app.reviewNotes || app.adminFeedback}
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={viewStyles.cardActions}>
                  <TouchableOpacity
                    style={[
                      viewStyles.actionBtn,
                      viewStyles.rejectBtn,
                      { opacity: isRejected ? 0.4 : 1 },
                    ]}
                    onPress={() => handleOpenReview(app, "REJECT")}
                    activeOpacity={0.7}
                  >
                    <Feather name="x-circle" size={15} color="#E11D48" />
                    <Text style={viewStyles.rejectBtnText}>
                      {isRejected ? "Rejected" : "Reject"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      viewStyles.actionBtn,
                      viewStyles.approveBtn,
                      { opacity: isApproved ? 0.4 : 1 },
                    ]}
                    onPress={() => handleOpenReview(app, "APPROVE")}
                    activeOpacity={0.7}
                  >
                    <Feather name="check-circle" size={15} color="#FFFFFF" />
                    <Text style={viewStyles.approveBtnText}>
                      {isApproved ? "Approved Host" : "Approve as Host"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Review Confirmation Modal */}
      <Modal
        visible={Boolean(selectedApp && reviewAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedApp(null)}
      >
        <View style={viewStyles.modalOverlay}>
          <View
            style={[
              viewStyles.modalCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <View style={viewStyles.modalHeader}>
              <View
                style={[
                  viewStyles.modalIconBox,
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
                    viewStyles.modalTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  {reviewAction === "APPROVE"
                    ? "Approve Host Application"
                    : "Reject Host Application"}
                </Text>
                <Text
                  style={[
                    viewStyles.modalSubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Applicant: {selectedApp?.applicantName}
                </Text>
              </View>
            </View>

            <View style={viewStyles.modalNotice}>
              <Text style={viewStyles.modalNoticeText}>
                {reviewAction === "APPROVE"
                  ? "Granting approval elevates this user's platform role to HOST. They will gain immediate privileges to create and manage residential co-living spaces."
                  : "Rejecting this application will inform the resident. Please specify constructive feedback below so the applicant can correct their submission."}
              </Text>
            </View>

            <Text
              style={[
                viewStyles.inputLabel,
                { color: isDark ? "#CBD5E1" : "#334155" },
              ]}
            >
              Reviewer Notes / Feedback:
            </Text>
            <TextInput
              style={[
                viewStyles.feedbackInput,
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

            <View style={viewStyles.modalActions}>
              <TouchableOpacity
                style={[
                  viewStyles.cancelModalBtn,
                  { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                ]}
                onPress={() => setSelectedApp(null)}
                disabled={submitting}
              >
                <Text
                  style={[
                    viewStyles.cancelModalBtnText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  viewStyles.confirmModalBtn,
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
                  <Text style={viewStyles.confirmModalBtnText}>
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

// ==========================================
// SUB-VIEW 2: PLATFORM USERS & MODERATION
// ==========================================
interface UsersViewProps {
  users: any[];
}

const SuperAdminUsersView: React.FC<UsersViewProps> = ({ users }) => {
  const { isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [moderationMode, setModerationMode] = useState<
    "STATUS" | "ROLE" | null
  >(null);
  const [targetStatus, setTargetStatus] = useState<
    "ACTIVE" | "INACTIVE" | "SUSPENDED"
  >("ACTIVE");
  const [targetRole, setTargetRole] = useState<
    "SUPER_ADMIN" | "HOST" | "PAYOR" | "NON_PAYOR"
  >("PAYOR");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter !== "ALL") {
        const uStatus = u.accountStatus || "ACTIVE";
        if (uStatus !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = String(u.displayName || u.fullName || "")
          .toLowerCase()
          .includes(q);
        const matchEmail = String(u.email || "")
          .toLowerCase()
          .includes(q);
        const matchPhone = String(u.phoneNumber || "")
          .toLowerCase()
          .includes(q);
        const matchHh = String(u.householdName || "")
          .toLowerCase()
          .includes(q);
        return matchName || matchEmail || matchPhone || matchHh;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  const handleOpenStatusModal = (user: any) => {
    setSelectedUser(user);
    setModerationMode("STATUS");
    setTargetStatus(user.accountStatus || "ACTIVE");
    setReason("");
  };

  const handleOpenRoleModal = (user: any) => {
    setSelectedUser(user);
    setModerationMode("ROLE");
    setTargetRole(user.role || "PAYOR");
    setReason("");
  };

  const handleSaveModeration = async () => {
    if (!selectedUser || !moderationMode) return;
    setSaving(true);
    try {
      if (moderationMode === "STATUS") {
        await mobileDataService.setUserAccountStatus(
          selectedUser.uid,
          targetStatus,
          reason.trim() || `Status updated to ${targetStatus}`,
        );
        Alert.alert(
          "Account Status Updated",
          `${selectedUser.displayName || "User"}'s status is now ${targetStatus}.`,
          [{ text: "OK" }],
        );
      } else if (moderationMode === "ROLE") {
        await mobileDataService.updateUserRole(
          selectedUser.uid,
          targetRole,
          reason.trim() || `Role updated to ${targetRole}`,
        );
        Alert.alert(
          "User Role Updated",
          `${selectedUser.displayName || "User"}'s role is now ${targetRole}.`,
          [{ text: "OK" }],
        );
      }
      setSelectedUser(null);
      setModerationMode(null);
      setReason("");
    } catch (err: any) {
      Alert.alert(
        "Moderation Error",
        err?.message || "Failed to update account.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={viewStyles.container}>
      {/* Search Input */}
      <View style={viewStyles.searchSection}>
        <View
          style={[
            viewStyles.searchBox,
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
              viewStyles.searchInput,
              { color: isDark ? "#F8FAFC" : "#0F172A" },
            ]}
            placeholder="Search users by name, email, or household..."
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

      {/* Role Filter Tabs */}
      <View style={viewStyles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={viewStyles.filterScroll}
        >
          {["ALL", "HOST", "PAYOR", "NON_PAYOR", "SUPER_ADMIN"].map((r) => {
            const isActive = roleFilter === r;
            return (
              <TouchableOpacity
                key={r}
                style={[
                  viewStyles.filterBtn,
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
                onPress={() => setRoleFilter(r)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    viewStyles.filterBtnText,
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
                  {r === "ALL" ? "All Roles" : r.replace("_", " ")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Users List */}
      <ScrollView
        contentContainerStyle={viewStyles.scrollList}
        showsVerticalScrollIndicator={false}
      >
        {filteredUsers.length === 0 ? (
          <View style={viewStyles.emptyCard}>
            <Feather
              name="users"
              size={36}
              color={isDark ? "#475569" : "#CBD5E1"}
            />
            <Text
              style={[
                viewStyles.emptyTitle,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              No Users Found
            </Text>
            <Text
              style={[
                viewStyles.emptySubtitle,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              No account records match your search criteria.
            </Text>
          </View>
        ) : (
          filteredUsers.map((u) => {
            const status = u.accountStatus || "ACTIVE";
            const role = u.role || "PAYOR";

            return (
              <View
                key={u.uid}
                style={[
                  viewStyles.userCard,
                  {
                    backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                    borderColor: isDark ? "#1E293B" : "#E2E8F0",
                  },
                ]}
              >
                <View style={viewStyles.cardHeader}>
                  <View
                    style={[
                      viewStyles.avatarBox,
                      {
                        backgroundColor:
                          role === "SUPER_ADMIN"
                            ? "#E11D48"
                            : role === "HOST"
                              ? "#2563EB"
                              : role === "PAYOR"
                                ? "#D97706"
                                : "#7C3AED",
                      },
                    ]}
                  >
                    <Text style={viewStyles.avatarText}>
                      {String(u.displayName || u.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={viewStyles.headerInfo}>
                    <Text
                      style={[
                        viewStyles.userName,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      {u.displayName || "Resident Member"}
                    </Text>
                    <Text
                      style={[
                        viewStyles.userEmail,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      {u.email}
                    </Text>
                  </View>

                  <View
                    style={[
                      viewStyles.statusPill,
                      status === "ACTIVE"
                        ? viewStyles.statusActive
                        : status === "SUSPENDED"
                          ? viewStyles.statusSuspended
                          : viewStyles.statusInactive,
                    ]}
                  >
                    <Text
                      style={[
                        viewStyles.statusPillText,
                        status === "ACTIVE"
                          ? viewStyles.statusTextActive
                          : status === "SUSPENDED"
                            ? viewStyles.statusTextSuspended
                            : viewStyles.statusTextInactive,
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                </View>

                {/* Metadata Row */}
                <View
                  style={[
                    viewStyles.metaRow,
                    {
                      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                      borderColor: isDark ? "#334155" : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={viewStyles.metaItem}>
                    <Text
                      style={[
                        viewStyles.metaLabel,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Role
                    </Text>
                    <Text
                      style={[
                        viewStyles.metaValue,
                        {
                          color:
                            role === "SUPER_ADMIN"
                              ? "#E11D48"
                              : role === "HOST"
                                ? "#2563EB"
                                : isDark
                                  ? "#F8FAFC"
                                  : "#0F172A",
                        },
                      ]}
                    >
                      {role.replace("_", " ")}
                    </Text>
                  </View>

                  <View style={viewStyles.metaItem}>
                    <Text
                      style={[
                        viewStyles.metaLabel,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Household
                    </Text>
                    <Text
                      style={[
                        viewStyles.metaValue,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                      numberOfLines={1}
                    >
                      {u.householdName || "None"}
                    </Text>
                  </View>

                  <View style={viewStyles.metaItem}>
                    <Text
                      style={[
                        viewStyles.metaLabel,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Joined
                    </Text>
                    <Text
                      style={[
                        viewStyles.metaValue,
                        { color: isDark ? "#CBD5E1" : "#475569" },
                      ]}
                    >
                      {u.createdDate
                        ? u.createdDate.substring(0, 10)
                        : "Recent"}
                    </Text>
                  </View>
                </View>

                {/* Action Row */}
                <View style={viewStyles.actionRow}>
                  <TouchableOpacity
                    style={[
                      viewStyles.actionBtn,
                      {
                        backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                        borderColor: isDark ? "#334155" : "#E2E8F0",
                      },
                    ]}
                    onPress={() => handleOpenRoleModal(u)}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name="shield"
                      size={14}
                      color={isDark ? "#94A3B8" : "#64748B"}
                    />
                    <Text
                      style={[
                        viewStyles.actionBtnText,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      Change Role
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      viewStyles.actionBtn,
                      status === "SUSPENDED"
                        ? viewStyles.btnActivate
                        : viewStyles.btnSuspend,
                    ]}
                    onPress={() => handleOpenStatusModal(u)}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name={status === "SUSPENDED" ? "check" : "slash"}
                      size={14}
                      color={status === "SUSPENDED" ? "#10B981" : "#E11D48"}
                    />
                    <Text
                      style={[
                        viewStyles.actionBtnText,
                        {
                          color: status === "SUSPENDED" ? "#10B981" : "#E11D48",
                        },
                      ]}
                    >
                      {status === "SUSPENDED" ? "Unsuspend" : "Set Status"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Moderation Modal */}
      <Modal
        visible={Boolean(selectedUser && moderationMode)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={viewStyles.modalOverlay}>
          <View
            style={[
              viewStyles.modalCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <View style={viewStyles.modalHeader}>
              <View
                style={[
                  viewStyles.modalIconBox,
                  {
                    backgroundColor:
                      moderationMode === "STATUS"
                        ? "rgba(225, 29, 72, 0.15)"
                        : "rgba(59, 130, 246, 0.15)",
                  },
                ]}
              >
                <Feather
                  name={moderationMode === "STATUS" ? "alert-circle" : "shield"}
                  size={22}
                  color={moderationMode === "STATUS" ? "#E11D48" : "#3B82F6"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    viewStyles.modalTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  {moderationMode === "STATUS"
                    ? "Moderate Account Status"
                    : "Update User Role"}
                </Text>
                <Text
                  style={[
                    viewStyles.modalSubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  {selectedUser?.displayName} ({selectedUser?.email})
                </Text>
              </View>
            </View>

            {moderationMode === "STATUS" ? (
              <View style={viewStyles.optionsGroup}>
                <Text
                  style={[
                    viewStyles.optionLabel,
                    { color: isDark ? "#CBD5E1" : "#334155" },
                  ]}
                >
                  Select New Account Status:
                </Text>
                <View style={viewStyles.statusOptionsRow}>
                  {(["ACTIVE", "SUSPENDED", "INACTIVE"] as const).map((s) => {
                    const isSelected = targetStatus === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[
                          viewStyles.optionPill,
                          isSelected && viewStyles.optionPillSelected,
                          {
                            backgroundColor: isSelected
                              ? isDark
                                ? "#F8FAFC"
                                : "#0F172A"
                              : isDark
                                ? "#1E293B"
                                : "#F1F5F9",
                          },
                        ]}
                        onPress={() => setTargetStatus(s)}
                      >
                        <Text
                          style={[
                            viewStyles.optionPillText,
                            {
                              color: isSelected
                                ? isDark
                                  ? "#0F172A"
                                  : "#FFFFFF"
                                : isDark
                                  ? "#94A3B8"
                                  : "#64748B",
                            },
                          ]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={viewStyles.optionsGroup}>
                <Text
                  style={[
                    viewStyles.optionLabel,
                    { color: isDark ? "#CBD5E1" : "#334155" },
                  ]}
                >
                  Select New Platform Role:
                </Text>
                <View style={viewStyles.roleOptionsGrid}>
                  {(["HOST", "PAYOR", "NON_PAYOR", "SUPER_ADMIN"] as const).map(
                    (r) => {
                      const isSelected = targetRole === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[
                            viewStyles.rolePill,
                            isSelected && viewStyles.rolePillSelected,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? "#F8FAFC"
                                  : "#0F172A"
                                : isDark
                                  ? "#1E293B"
                                  : "#F1F5F9",
                            },
                          ]}
                          onPress={() => setTargetRole(r)}
                        >
                          <Text
                            style={[
                              viewStyles.rolePillText,
                              {
                                color: isSelected
                                  ? isDark
                                    ? "#0F172A"
                                    : "#FFFFFF"
                                  : isDark
                                    ? "#94A3B8"
                                    : "#64748B",
                              },
                            ]}
                          >
                            {r.replace("_", " ")}
                          </Text>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </View>
              </View>
            )}

            <View style={viewStyles.reasonSection}>
              <Text
                style={[
                  viewStyles.optionLabel,
                  { color: isDark ? "#CBD5E1" : "#334155" },
                ]}
              >
                Audit Reason / Justification:
              </Text>
              <TextInput
                style={[
                  viewStyles.reasonInput,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    borderColor: isDark ? "#334155" : "#CBD5E1",
                  },
                ]}
                placeholder="Required for administrative audit log..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={reason}
                onChangeText={setReason}
              />
            </View>

            <View style={viewStyles.modalActions}>
              <TouchableOpacity
                style={[
                  viewStyles.cancelModalBtn,
                  { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                ]}
                onPress={() => setSelectedUser(null)}
                disabled={saving}
              >
                <Text
                  style={[
                    viewStyles.cancelModalBtnText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  viewStyles.confirmModalBtn,
                  { backgroundColor: "#E11D48" },
                ]}
                onPress={handleSaveModeration}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={viewStyles.confirmModalBtnText}>
                    Confirm Change
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

// ==========================================
// SUB-VIEW 3: HOUSEHOLDS & GROUPS GOVERNANCE
// ==========================================
interface HouseholdsViewProps {
  households: any[];
  users: any[];
}

const SuperAdminHouseholdsView: React.FC<HouseholdsViewProps> = ({
  households,
  users,
}) => {
  const { isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "ARCHIVED"
  >("ALL");

  const [selectedHh, setSelectedHh] = useState<any | null>(null);
  const [confirmArchiveModal, setConfirmArchiveModal] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const userMap = useMemo(() => {
    const map = new Map<string, any>();
    users.forEach((u) => {
      if (u.uid) map.set(u.uid, u);
    });
    return map;
  }, [users]);

  const filteredHouseholds = useMemo(() => {
    return households.filter((h) => {
      if (statusFilter !== "ALL") {
        const hStatus = h.status || "ACTIVE";
        if (hStatus !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = String(h.householdName || "")
          .toLowerCase()
          .includes(q);
        const matchApt = String(h.apartmentName || "")
          .toLowerCase()
          .includes(q);
        const matchAddr = String(h.address || "")
          .toLowerCase()
          .includes(q);
        const host = userMap.get(h.hostId);
        const matchHost = String(host?.displayName || "")
          .toLowerCase()
          .includes(q);
        return matchName || matchApt || matchAddr || matchHost;
      }
      return true;
    });
  }, [households, statusFilter, searchQuery, userMap]);

  const handleToggleArchive = (hh: any) => {
    setSelectedHh(hh);
    setReason("");
    setConfirmArchiveModal(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedHh) return;
    const currentStatus = selectedHh.status || "ACTIVE";
    const nextStatus = currentStatus === "ACTIVE" ? "ARCHIVED" : "ACTIVE";

    setSaving(true);
    try {
      await mobileDataService.setHouseholdStatus(
        selectedHh.householdId || selectedHh.id,
        nextStatus,
        reason.trim() || `Household set to ${nextStatus}`,
      );

      Alert.alert(
        "Household Status Updated",
        `Household "${selectedHh.householdName}" has been ${nextStatus.toLowerCase()}.`,
        [{ text: "OK" }],
      );

      setConfirmArchiveModal(false);
      setSelectedHh(null);
      setReason("");
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message || "Failed to update household status.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={viewStyles.container}>
      {/* Search Input */}
      <View style={viewStyles.searchSection}>
        <View
          style={[
            viewStyles.searchBox,
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
              viewStyles.searchInput,
              { color: isDark ? "#F8FAFC" : "#0F172A" },
            ]}
            placeholder="Search communities by name, apartment, or host..."
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
      <View style={viewStyles.filterSection}>
        <View style={viewStyles.filterRow}>
          {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((tab) => {
            const isActive = statusFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  viewStyles.filterBtn,
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
                onPress={() => setStatusFilter(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    viewStyles.filterBtnText,
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
                  {tab === "ALL"
                    ? "All Households"
                    : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Households List */}
      <ScrollView
        contentContainerStyle={viewStyles.scrollList}
        showsVerticalScrollIndicator={false}
      >
        {filteredHouseholds.length === 0 ? (
          <View style={viewStyles.emptyCard}>
            <Feather
              name="home"
              size={36}
              color={isDark ? "#475569" : "#CBD5E1"}
            />
            <Text
              style={[
                viewStyles.emptyTitle,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              No Households Found
            </Text>
            <Text
              style={[
                viewStyles.emptySubtitle,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              No residential groups match your query.
            </Text>
          </View>
        ) : (
          filteredHouseholds.map((hh) => {
            const status = hh.status || "ACTIVE";
            const isArchived = status === "ARCHIVED";
            const hostUser = userMap.get(hh.hostId);
            const memberCount = Array.isArray(hh.members)
              ? hh.members.length
              : hh.memberCount || 1;

            return (
              <View
                key={hh.householdId || hh.id}
                style={[
                  viewStyles.card,
                  {
                    backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                    borderColor: isDark ? "#1E293B" : "#E2E8F0",
                  },
                ]}
              >
                <View style={viewStyles.cardHeader}>
                  <View style={viewStyles.groupIconBox}>
                    <Feather name="home" size={18} color="#8B5CF6" />
                  </View>

                  <View style={viewStyles.headerInfo}>
                    <Text
                      style={[
                        viewStyles.householdName,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      {hh.householdName || "Unnamed Community"}
                    </Text>
                    <Text
                      style={[
                        viewStyles.apartmentName,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      {hh.apartmentName ? `${hh.apartmentName} · ` : ""}
                      {hh.address || "Address not set"}
                    </Text>
                  </View>

                  <View
                    style={[
                      viewStyles.statusPill,
                      isArchived
                        ? viewStyles.statusArchived
                        : viewStyles.statusActive,
                    ]}
                  >
                    <Text
                      style={[
                        viewStyles.statusPillText,
                        isArchived
                          ? viewStyles.statusTextArchived
                          : viewStyles.statusTextActive,
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                </View>

                {/* Details Strip */}
                <View
                  style={[
                    viewStyles.detailsRow,
                    {
                      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                      borderColor: isDark ? "#334155" : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={viewStyles.detailCol}>
                    <Text
                      style={[
                        viewStyles.detailKey,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Host Admin
                    </Text>
                    <Text
                      style={[
                        viewStyles.detailVal,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                      numberOfLines={1}
                    >
                      {hostUser?.displayName || "Unassigned"}
                    </Text>
                  </View>

                  <View style={viewStyles.detailCol}>
                    <Text
                      style={[
                        viewStyles.detailKey,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Invite Code
                    </Text>
                    <Text
                      style={[
                        viewStyles.detailVal,
                        { color: isDark ? "#CBD5E1" : "#334155" },
                      ]}
                    >
                      {hh.inviteCode || "None"}
                    </Text>
                  </View>

                  <View style={viewStyles.detailCol}>
                    <Text
                      style={[
                        viewStyles.detailKey,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Members
                    </Text>
                    <Text
                      style={[
                        viewStyles.detailVal,
                        { color: isDark ? "#8B5CF6" : "#7C3AED" },
                      ]}
                    >
                      {memberCount} Active
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={viewStyles.actionsRow}>
                  <TouchableOpacity
                    style={[
                      viewStyles.toggleStatusBtn,
                      isArchived
                        ? viewStyles.restoreBtn
                        : viewStyles.archiveBtn,
                    ]}
                    onPress={() => handleToggleArchive(hh)}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name={isArchived ? "rotate-ccw" : "archive"}
                      size={14}
                      color={isArchived ? "#10B981" : "#E11D48"}
                    />
                    <Text
                      style={[
                        viewStyles.toggleStatusBtnText,
                        { color: isArchived ? "#10B981" : "#E11D48" },
                      ]}
                    >
                      {isArchived ? "Restore Community" : "Archive Community"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={confirmArchiveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmArchiveModal(false)}
      >
        <View style={viewStyles.modalOverlay}>
          <View
            style={[
              viewStyles.modalCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <View style={viewStyles.modalHeader}>
              <View
                style={[
                  viewStyles.modalIconBox,
                  {
                    backgroundColor:
                      selectedHh?.status === "ARCHIVED"
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(225, 29, 72, 0.15)",
                  },
                ]}
              >
                <Feather
                  name={
                    selectedHh?.status === "ARCHIVED"
                      ? "rotate-ccw"
                      : "alert-triangle"
                  }
                  size={22}
                  color={
                    selectedHh?.status === "ARCHIVED" ? "#10B981" : "#E11D48"
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    viewStyles.modalTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  {selectedHh?.status === "ARCHIVED"
                    ? "Restore Household Group"
                    : "Archive Household Group"}
                </Text>
                <Text
                  style={[
                    viewStyles.modalSubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  {selectedHh?.householdName}
                </Text>
              </View>
            </View>

            <View style={viewStyles.modalNotice}>
              <Text style={viewStyles.modalNoticeText}>
                {selectedHh?.status === "ARCHIVED"
                  ? "Restoring this household reactivates it for the host and all members."
                  : "Archiving this group will hide it from active household views and freeze further bill creation until restored."}
              </Text>
            </View>

            <Text
              style={[
                viewStyles.inputLabel,
                { color: isDark ? "#CBD5E1" : "#334155" },
              ]}
            >
              Reason for Audit Log:
            </Text>
            <TextInput
              style={[
                viewStyles.reasonInput,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  borderColor: isDark ? "#334155" : "#CBD5E1",
                },
              ]}
              placeholder="e.g. Administrative freeze due to lease termination..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={reason}
              onChangeText={setReason}
            />

            <View style={viewStyles.modalActions}>
              <TouchableOpacity
                style={[
                  viewStyles.cancelModalBtn,
                  { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                ]}
                onPress={() => setConfirmArchiveModal(false)}
                disabled={saving}
              >
                <Text
                  style={[
                    viewStyles.cancelModalBtnText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  viewStyles.confirmModalBtn,
                  {
                    backgroundColor:
                      selectedHh?.status === "ARCHIVED" ? "#10B981" : "#E11D48",
                  },
                ]}
                onPress={handleConfirmStatusChange}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={viewStyles.confirmModalBtnText}>
                    {selectedHh?.status === "ARCHIVED"
                      ? "Confirm Restore"
                      : "Confirm Archive"}
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

// ==========================================
// SUB-VIEW 4: SYSTEM MAINTENANCE & AUDIT
// ==========================================
interface MaintenanceViewProps {
  tickets: any[];
  usersCount: number;
  householdsCount: number;
}

const SuperAdminMaintenanceView: React.FC<MaintenanceViewProps> = ({
  tickets,
  usersCount,
  householdsCount,
}) => {
  const { isDark } = useTheme();

  const [subTab, setSubTab] = useState<"SETTINGS" | "AUDIT_LOGS" | "TICKETS">(
    "SETTINGS",
  );

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [announcementBanner, setAnnouncementBanner] = useState("");
  const [minSupportedVersion, setMinSupportedVersion] = useState("1.0.0");
  const [latestVersion, setLatestVersion] = useState("1.2.0");
  const [forceUpdate, setForceUpdate] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logSearchQuery, setLogSearchQuery] = useState("");

  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [updatingTicket, setUpdatingTicket] = useState(false);

  useEffect(() => {
    const unsubSettings = mobileDataService.listenToPlatformSettings((s) => {
      if (s) {
        setMaintenanceMode(Boolean(s.maintenanceMode));
        setMaintenanceMessage(s.maintenanceMessage || "");
        setAnnouncementBanner(s.announcementBanner || "");
        setMinSupportedVersion(s.minSupportedVersion || "1.0.0");
        setLatestVersion(s.latestVersion || "1.2.0");
        setForceUpdate(Boolean(s.forceUpdate));
      }
    });

    const unsubLogs = mobileDataService.listenToAuditLogs(50, (logs) => {
      setAuditLogs(logs);
      setLoadingLogs(false);
    });

    return () => {
      unsubSettings();
      unsubLogs();
    };
  }, []);

  const handleSavePlatformSettings = async () => {
    setSavingSettings(true);
    try {
      await mobileDataService.updatePlatformSettings({
        maintenanceMode,
        maintenanceMessage: maintenanceMessage.trim(),
        announcementBanner: announcementBanner.trim(),
        minSupportedVersion: minSupportedVersion.trim(),
        latestVersion: latestVersion.trim(),
        forceUpdate,
      });

      Alert.alert(
        "Settings Saved",
        "Platform maintenance and release settings updated successfully.",
        [{ text: "OK" }],
      );
    } catch (err: any) {
      Alert.alert("Save Error", err?.message || "Failed to update settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateTicketStatus = async (
    status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
  ) => {
    if (!selectedTicket) return;
    setUpdatingTicket(true);
    try {
      await mobileDataService.updateSupportTicketStatus(
        selectedTicket.ticketId,
        status,
      );
      Alert.alert("Ticket Updated", `Ticket marked as ${status}.`, [
        { text: "OK" },
      ]);
      setSelectedTicket(null);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update ticket.");
    } finally {
      setUpdatingTicket(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (!logSearchQuery.trim()) return true;
      const q = logSearchQuery.toLowerCase();
      const matchAction = String(log.action || "")
        .toLowerCase()
        .includes(q);
      const matchActor = String(log.actorName || "")
        .toLowerCase()
        .includes(q);
      const matchEntity = String(log.entity || "")
        .toLowerCase()
        .includes(q);
      const matchReason = String(log.reason || "")
        .toLowerCase()
        .includes(q);
      return matchAction || matchActor || matchEntity || matchReason;
    });
  }, [auditLogs, logSearchQuery]);

  return (
    <View style={viewStyles.container}>
      {/* Sub-Tabs */}
      <View
        style={[
          viewStyles.subTabBar,
          {
            backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
            borderBottomColor: isDark ? "#1E293B" : "#E2E8F0",
          },
        ]}
      >
        <TouchableOpacity
          style={[
            viewStyles.subTabBtn,
            subTab === "SETTINGS" && [
              viewStyles.subTabBtnActive,
              { borderBottomColor: "#E11D48" },
            ],
          ]}
          onPress={() => setSubTab("SETTINGS")}
        >
          <Feather
            name="sliders"
            size={13}
            color={
              subTab === "SETTINGS" ? "#E11D48" : isDark ? "#94A3B8" : "#64748B"
            }
          />
          <Text
            style={[
              viewStyles.subTabText,
              {
                color:
                  subTab === "SETTINGS"
                    ? isDark
                      ? "#F8FAFC"
                      : "#0F172A"
                    : isDark
                      ? "#94A3B8"
                      : "#64748B",
              },
            ]}
          >
            System Settings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            viewStyles.subTabBtn,
            subTab === "AUDIT_LOGS" && [
              viewStyles.subTabBtnActive,
              { borderBottomColor: "#E11D48" },
            ],
          ]}
          onPress={() => setSubTab("AUDIT_LOGS")}
        >
          <Feather
            name="activity"
            size={13}
            color={
              subTab === "AUDIT_LOGS"
                ? "#E11D48"
                : isDark
                  ? "#94A3B8"
                  : "#64748B"
            }
          />
          <Text
            style={[
              viewStyles.subTabText,
              {
                color:
                  subTab === "AUDIT_LOGS"
                    ? isDark
                      ? "#F8FAFC"
                      : "#0F172A"
                    : isDark
                      ? "#94A3B8"
                      : "#64748B",
              },
            ]}
          >
            Audit Logs ({auditLogs.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            viewStyles.subTabBtn,
            subTab === "TICKETS" && [
              viewStyles.subTabBtnActive,
              { borderBottomColor: "#E11D48" },
            ],
          ]}
          onPress={() => setSubTab("TICKETS")}
        >
          <Feather
            name="help-circle"
            size={13}
            color={
              subTab === "TICKETS" ? "#E11D48" : isDark ? "#94A3B8" : "#64748B"
            }
          />
          <Text
            style={[
              viewStyles.subTabText,
              {
                color:
                  subTab === "TICKETS"
                    ? isDark
                      ? "#F8FAFC"
                      : "#0F172A"
                    : isDark
                      ? "#94A3B8"
                      : "#64748B",
              },
            ]}
          >
            Tickets ({tickets.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Tab */}
      {subTab === "SETTINGS" && (
        <ScrollView
          contentContainerStyle={viewStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Maintenance Mode Card */}
          <View
            style={[
              viewStyles.sectionCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#1E293B" : "#E2E8F0",
              },
            ]}
          >
            <View style={viewStyles.sectionHeader}>
              <View
                style={[
                  viewStyles.sectionIconBox,
                  {
                    backgroundColor: maintenanceMode
                      ? "rgba(225, 29, 72, 0.15)"
                      : "rgba(16, 185, 129, 0.15)",
                  },
                ]}
              >
                <Feather
                  name={maintenanceMode ? "alert-octagon" : "check-circle"}
                  size={18}
                  color={maintenanceMode ? "#E11D48" : "#10B981"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    viewStyles.sectionTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Platform Maintenance Mode
                </Text>
                <Text
                  style={[
                    viewStyles.sectionSubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Broadcasts emergency maintenance notice to all app users
                </Text>
              </View>
              <Switch
                value={maintenanceMode}
                onValueChange={setMaintenanceMode}
                trackColor={{ false: "#CBD5E1", true: "#E11D48" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {maintenanceMode && (
              <View style={viewStyles.inputGroup}>
                <Text
                  style={[
                    viewStyles.fieldLabel,
                    { color: isDark ? "#CBD5E1" : "#334155" },
                  ]}
                >
                  Maintenance Notice Message:
                </Text>
                <TextInput
                  style={[
                    viewStyles.textInput,
                    {
                      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      borderColor: isDark ? "#334155" : "#CBD5E1",
                    },
                  ]}
                  placeholder="e.g. Scheduled system upgrade in progress..."
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  value={maintenanceMessage}
                  onChangeText={setMaintenanceMessage}
                  multiline
                />
              </View>
            )}
          </View>

          {/* Versioning Card */}
          <View
            style={[
              viewStyles.sectionCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#1E293B" : "#E2E8F0",
              },
            ]}
          >
            <View style={viewStyles.sectionHeader}>
              <View
                style={[
                  viewStyles.sectionIconBox,
                  { backgroundColor: "rgba(59, 130, 246, 0.15)" },
                ]}
              >
                <Feather name="smartphone" size={18} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    viewStyles.sectionTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  App Release & Version Gate
                </Text>
                <Text
                  style={[
                    viewStyles.sectionSubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Enforce minimum client versions across platforms
                </Text>
              </View>
            </View>

            <View style={viewStyles.versionGrid}>
              <View style={viewStyles.versionCol}>
                <Text
                  style={[
                    viewStyles.fieldLabel,
                    { color: isDark ? "#CBD5E1" : "#334155" },
                  ]}
                >
                  Min. Supported:
                </Text>
                <TextInput
                  style={[
                    viewStyles.singleInput,
                    {
                      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      borderColor: isDark ? "#334155" : "#CBD5E1",
                    },
                  ]}
                  value={minSupportedVersion}
                  onChangeText={setMinSupportedVersion}
                  placeholder="1.0.0"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                />
              </View>

              <View style={viewStyles.versionCol}>
                <Text
                  style={[
                    viewStyles.fieldLabel,
                    { color: isDark ? "#CBD5E1" : "#334155" },
                  ]}
                >
                  Latest Version:
                </Text>
                <TextInput
                  style={[
                    viewStyles.singleInput,
                    {
                      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      borderColor: isDark ? "#334155" : "#CBD5E1",
                    },
                  ]}
                  value={latestVersion}
                  onChangeText={setLatestVersion}
                  placeholder="1.2.0"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                />
              </View>
            </View>

            <View style={viewStyles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    viewStyles.toggleLabel,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Mandatory Force-Update
                </Text>
                <Text
                  style={[
                    viewStyles.toggleDesc,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Blocks outdated app builds until updated
                </Text>
              </View>
              <Switch
                value={forceUpdate}
                onValueChange={setForceUpdate}
                trackColor={{ false: "#CBD5E1", true: "#3B82F6" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Announcement Card */}
          <View
            style={[
              viewStyles.sectionCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#1E293B" : "#E2E8F0",
              },
            ]}
          >
            <View style={viewStyles.sectionHeader}>
              <View
                style={[
                  viewStyles.sectionIconBox,
                  { backgroundColor: "rgba(139, 92, 246, 0.15)" },
                ]}
              >
                <Feather name="bell" size={18} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    viewStyles.sectionTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Global Announcement Banner
                </Text>
                <Text
                  style={[
                    viewStyles.sectionSubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Displays pinned alert across all resident home screens
                </Text>
              </View>
            </View>

            <TextInput
              style={[
                viewStyles.textInput,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  borderColor: isDark ? "#334155" : "#CBD5E1",
                },
              ]}
              placeholder="e.g. System billing calculations updated. Tap to learn more."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={announcementBanner}
              onChangeText={setAnnouncementBanner}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[viewStyles.saveBtn, { backgroundColor: "#E11D48" }]}
            onPress={handleSavePlatformSettings}
            disabled={savingSettings}
            activeOpacity={0.8}
          >
            {savingSettings ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={viewStyles.saveBtnText}>
                  Save Platform Settings
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Audit Logs Tab */}
      {subTab === "AUDIT_LOGS" && (
        <View style={{ flex: 1 }}>
          <View style={viewStyles.searchSection}>
            <View
              style={[
                viewStyles.searchBox,
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
                  viewStyles.searchInput,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
                placeholder="Search audit logs by actor, action, or entity..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={logSearchQuery}
                onChangeText={setLogSearchQuery}
              />
              {logSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setLogSearchQuery("")}>
                  <Feather
                    name="x"
                    size={16}
                    color={isDark ? "#94A3B8" : "#64748B"}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView
            contentContainerStyle={viewStyles.scrollList}
            showsVerticalScrollIndicator={false}
          >
            {loadingLogs ? (
              <View style={viewStyles.emptyCard}>
                <ActivityIndicator size="small" color="#E11D48" />
                <Text
                  style={[
                    viewStyles.emptySubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Loading audit logs...
                </Text>
              </View>
            ) : filteredLogs.length === 0 ? (
              <View style={viewStyles.emptyCard}>
                <Feather
                  name="shield"
                  size={36}
                  color={isDark ? "#475569" : "#CBD5E1"}
                />
                <Text
                  style={[
                    viewStyles.emptyTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  No Audit Logs Recorded
                </Text>
                <Text
                  style={[
                    viewStyles.emptySubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Administrative actions are recorded automatically.
                </Text>
              </View>
            ) : (
              filteredLogs.map((log) => (
                <View
                  key={log.logId || log.id}
                  style={[
                    viewStyles.logCard,
                    {
                      backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                      borderColor: isDark ? "#1E293B" : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={viewStyles.logHeader}>
                    <View style={viewStyles.logActionBox}>
                      <Text style={viewStyles.logActionText}>{log.action}</Text>
                    </View>
                    <Text
                      style={[
                        viewStyles.logTimestamp,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      {log.timestamp
                        ? log.timestamp.substring(0, 16).replace("T", " ")
                        : "Just now"}
                    </Text>
                  </View>

                  <View style={viewStyles.logBody}>
                    <Text
                      style={[
                        viewStyles.logActor,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      Actor:{" "}
                      <Text style={{ fontWeight: "700" }}>
                        {log.actorName || "Super Admin"}
                      </Text>
                    </Text>
                    <Text
                      style={[
                        viewStyles.logEntity,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Entity: {log.entity} · ID: {log.entityId}
                    </Text>
                    {Boolean(log.reason) && (
                      <Text
                        style={[
                          viewStyles.logReason,
                          { color: isDark ? "#CBD5E1" : "#334155" },
                        ]}
                      >
                        Note: {log.reason}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* Tickets Tab */}
      {subTab === "TICKETS" && (
        <ScrollView
          contentContainerStyle={viewStyles.scrollList}
          showsVerticalScrollIndicator={false}
        >
          {tickets.length === 0 ? (
            <View style={viewStyles.emptyCard}>
              <Feather
                name="check-circle"
                size={36}
                color={isDark ? "#475569" : "#CBD5E1"}
              />
              <Text
                style={[
                  viewStyles.emptyTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                No Open Tickets
              </Text>
              <Text
                style={[
                  viewStyles.emptySubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Support queue is clear.
              </Text>
            </View>
          ) : (
            tickets.map((t) => {
              const isResolved =
                t.status === "RESOLVED" || t.status === "CLOSED";

              return (
                <View
                  key={t.ticketId || t.id}
                  style={[
                    viewStyles.ticketCard,
                    {
                      backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                      borderColor: isDark ? "#1E293B" : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={viewStyles.ticketHeader}>
                    <Text
                      style={[
                        viewStyles.ticketSubject,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      {t.subject || "Support Inquiry"}
                    </Text>
                    <View
                      style={[
                        viewStyles.ticketStatusBadge,
                        isResolved
                          ? viewStyles.ticketStatusResolved
                          : viewStyles.ticketStatusOpen,
                      ]}
                    >
                      <Text
                        style={[
                          viewStyles.ticketStatusText,
                          isResolved
                            ? viewStyles.ticketStatusTextResolved
                            : viewStyles.ticketStatusTextOpen,
                        ]}
                      >
                        {t.status || "OPEN"}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      viewStyles.ticketMeta,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    User: {t.userName || "Resident"} · Category:{" "}
                    {t.category || "General"}
                  </Text>
                  <Text
                    style={[
                      viewStyles.ticketDesc,
                      { color: isDark ? "#CBD5E1" : "#334155" },
                    ]}
                  >
                    {t.description}
                  </Text>

                  <View style={viewStyles.ticketActions}>
                    <TouchableOpacity
                      style={[
                        viewStyles.ticketActionBtn,
                        {
                          backgroundColor: isResolved
                            ? "rgba(148, 163, 184, 0.15)"
                            : "#10B981",
                        },
                      ]}
                      onPress={() => {
                        setSelectedTicket(t);
                        handleUpdateTicketStatus(
                          isResolved ? "IN_PROGRESS" : "RESOLVED",
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name={isResolved ? "rotate-ccw" : "check"}
                        size={13}
                        color={
                          isResolved
                            ? isDark
                              ? "#94A3B8"
                              : "#64748B"
                            : "#FFFFFF"
                        }
                      />
                      <Text
                        style={[
                          viewStyles.ticketActionBtnText,
                          {
                            color: isResolved
                              ? isDark
                                ? "#94A3B8"
                                : "#64748B"
                              : "#FFFFFF",
                          },
                        ]}
                      >
                        {isResolved ? "Reopen Ticket" : "Mark Resolved"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

// ==========================================
// MAIN CONTAINER: SUPER ADMIN HUB SCREEN
// ==========================================
interface SuperAdminHubScreenProps {
  onBack: () => void;
  initialTab?: AdminModuleTab;
  currentUser?: { name?: string; role?: string; email?: string };
}

export const SuperAdminHubScreen: React.FC<SuperAdminHubScreenProps> = ({
  onBack,
  initialTab = "host_reviews",
  currentUser,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<AdminModuleTab>(initialTab);
  const [hostApplications, setHostApplications] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [households, setHouseholds] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 2 && mounted) {
        setLoading(false);
      }
    };

    const unsubApps = mobileDataService.listenToHostApplications((apps) => {
      if (mounted) {
        setHostApplications(apps);
        checkLoaded();
      }
    });

    const unsubUsers = mobileDataService.listenToAllUsers((u) => {
      if (mounted) {
        setUsers(u);
        checkLoaded();
      }
    });

    const unsubHouseholds = mobileDataService.listenToAllHouseholds((h) => {
      if (mounted) {
        setHouseholds(h);
      }
    });

    const unsubTickets = mobileDataService.listenToSupportTickets((t) => {
      if (mounted) {
        setSupportTickets(t);
      }
    });

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 1500);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      unsubApps();
      unsubUsers();
      unsubHouseholds();
      unsubTickets();
    };
  }, []);

  const pendingAppsCount = hostApplications.filter(
    (a) => a.status === "PENDING",
  ).length;

  const activeHouseholdsCount = households.filter(
    (h) => h.status !== "ARCHIVED",
  ).length;

  const openTicketsCount = supportTickets.filter(
    (t) => t.status === "OPEN" || t.status === "IN_PROGRESS",
  ).length;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#090D16" : "#F8FAFC" },
      ]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header Sticky Bar */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top > 0 ? insets.top + 6 : 14,
            backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
            borderBottomColor: isDark ? "#1E293B" : "#E2E8F0",
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[
              styles.backButton,
              { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
            ]}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Feather
              name="chevron-left"
              size={22}
              color={isDark ? "#F8FAFC" : "#0F172A"}
            />
          </TouchableOpacity>
          <View>
            <View style={styles.headerBadgeRow}>
              <View style={styles.superBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#E11D48" />
                <Text style={styles.superBadgeText}>SUPER ADMIN</Text>
              </View>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Platform Governance
              </Text>
            </View>
            <Text
              style={[
                styles.headerTitle,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
              numberOfLines={1}
            >
              Control Center
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View
            style={[
              styles.liveIndicator,
              {
                backgroundColor: isDark
                  ? "rgba(16, 185, 129, 0.15)"
                  : "#ECFDF5",
              },
            ]}
          >
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
      </View>

      {/* KPI Summary Strip */}
      <View
        style={[
          styles.kpiContainer,
          {
            backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
            borderBottomColor: isDark ? "#1E293B" : "#E2E8F0",
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiScroll}
        >
          <TouchableOpacity
            style={[
              styles.kpiCard,
              activeTab === "host_reviews" && styles.kpiCardActive,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor:
                  activeTab === "host_reviews"
                    ? "#E11D48"
                    : isDark
                      ? "#334155"
                      : "#E2E8F0",
              },
            ]}
            onPress={() => setActiveTab("host_reviews")}
            activeOpacity={0.7}
          >
            <View style={styles.kpiTop}>
              <Text
                style={[
                  styles.kpiLabel,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Host Queue
              </Text>
              <Feather
                name="award"
                size={14}
                color={
                  pendingAppsCount > 0
                    ? "#E11D48"
                    : isDark
                      ? "#94A3B8"
                      : "#64748B"
                }
              />
            </View>
            <Text
              style={[
                styles.kpiValue,
                pendingAppsCount > 0 && { color: "#E11D48" },
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              {pendingAppsCount}
            </Text>
            <Text
              style={[
                styles.kpiCaption,
                { color: isDark ? "#64748B" : "#94A3B8" },
              ]}
            >
              {pendingAppsCount === 1
                ? "1 Pending Review"
                : `${pendingAppsCount} Pending`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.kpiCard,
              activeTab === "users" && styles.kpiCardActive,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor:
                  activeTab === "users"
                    ? "#3B82F6"
                    : isDark
                      ? "#334155"
                      : "#E2E8F0",
              },
            ]}
            onPress={() => setActiveTab("users")}
            activeOpacity={0.7}
          >
            <View style={styles.kpiTop}>
              <Text
                style={[
                  styles.kpiLabel,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Platform Users
              </Text>
              <Feather name="users" size={14} color="#3B82F6" />
            </View>
            <Text
              style={[
                styles.kpiValue,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              {users.length}
            </Text>
            <Text
              style={[
                styles.kpiCaption,
                { color: isDark ? "#64748B" : "#94A3B8" },
              ]}
            >
              Total Accounts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.kpiCard,
              activeTab === "groups" && styles.kpiCardActive,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor:
                  activeTab === "groups"
                    ? "#8B5CF6"
                    : isDark
                      ? "#334155"
                      : "#E2E8F0",
              },
            ]}
            onPress={() => setActiveTab("groups")}
            activeOpacity={0.7}
          >
            <View style={styles.kpiTop}>
              <Text
                style={[
                  styles.kpiLabel,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Households
              </Text>
              <Feather name="home" size={14} color="#8B5CF6" />
            </View>
            <Text
              style={[
                styles.kpiValue,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              {activeHouseholdsCount}
            </Text>
            <Text
              style={[
                styles.kpiCaption,
                { color: isDark ? "#64748B" : "#94A3B8" },
              ]}
            >
              Active Groups
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.kpiCard,
              activeTab === "maintenance" && styles.kpiCardActive,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor:
                  activeTab === "maintenance"
                    ? "#F59E0B"
                    : isDark
                      ? "#334155"
                      : "#E2E8F0",
              },
            ]}
            onPress={() => setActiveTab("maintenance")}
            activeOpacity={0.7}
          >
            <View style={styles.kpiTop}>
              <Text
                style={[
                  styles.kpiLabel,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Maintenance
              </Text>
              <Feather name="settings" size={14} color="#F59E0B" />
            </View>
            <Text
              style={[
                styles.kpiValue,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              {openTicketsCount}
            </Text>
            <Text
              style={[
                styles.kpiCaption,
                { color: isDark ? "#64748B" : "#94A3B8" },
              ]}
            >
              Open Tickets
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Segmented Module Tab Bar */}
      <View
        style={[
          styles.tabBarWrapper,
          {
            backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
            borderBottomColor: isDark ? "#1E293B" : "#E2E8F0",
          },
        ]}
      >
        <View
          style={[
            styles.tabBarPillTrack,
            { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === "host_reviews" && [
                styles.tabPillActive,
                { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
              ],
            ]}
            onPress={() => setActiveTab("host_reviews")}
            activeOpacity={0.8}
          >
            <View style={styles.tabPillContent}>
              <Text
                style={[
                  styles.tabPillText,
                  {
                    color:
                      activeTab === "host_reviews"
                        ? isDark
                          ? "#F8FAFC"
                          : "#0F172A"
                        : isDark
                          ? "#94A3B8"
                          : "#64748B",
                  },
                ]}
              >
                Host Reviews
              </Text>
              {pendingAppsCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{pendingAppsCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === "users" && [
                styles.tabPillActive,
                { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
              ],
            ]}
            onPress={() => setActiveTab("users")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabPillText,
                {
                  color:
                    activeTab === "users"
                      ? isDark
                        ? "#F8FAFC"
                        : "#0F172A"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                },
              ]}
            >
              Users
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === "groups" && [
                styles.tabPillActive,
                { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
              ],
            ]}
            onPress={() => setActiveTab("groups")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabPillText,
                {
                  color:
                    activeTab === "groups"
                      ? isDark
                        ? "#F8FAFC"
                        : "#0F172A"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                },
              ]}
            >
              Groups
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === "maintenance" && [
                styles.tabPillActive,
                { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
              ],
            ]}
            onPress={() => setActiveTab("maintenance")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabPillText,
                {
                  color:
                    activeTab === "maintenance"
                      ? isDark
                        ? "#F8FAFC"
                        : "#0F172A"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                },
              ]}
            >
              Maintenance
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Module Content */}
      <View style={styles.contentBody}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E11D48" />
            <Text
              style={[
                styles.loadingText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Loading governance data...
            </Text>
          </View>
        ) : (
          <>
            {activeTab === "host_reviews" && (
              <SuperAdminHostReviewsView applications={hostApplications} />
            )}
            {activeTab === "users" && <SuperAdminUsersView users={users} />}
            {activeTab === "groups" && (
              <SuperAdminHouseholdsView households={households} users={users} />
            )}
            {activeTab === "maintenance" && (
              <SuperAdminMaintenanceView
                tickets={supportTickets}
                usersCount={users.length}
                householdsCount={households.length}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
};

export default SuperAdminHubScreen;

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  container: {
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  superBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(225, 29, 72, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  superBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#E11D48",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.5,
  },
  kpiContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  kpiScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  kpiCard: {
    width: 125,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  kpiCardActive: {
    borderWidth: 1.5,
  },
  kpiTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  kpiCaption: {
    fontSize: 9.5,
    fontWeight: "500",
    marginTop: 2,
  },
  tabBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tabBarPillTrack: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  tabPillActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabPillContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tabPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  tabBadge: {
    backgroundColor: "#E11D48",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 15,
    alignItems: "center",
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  contentBody: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
  },
});

const viewStyles = StyleSheet.create({
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
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
    borderWidth: 1,
  },
  rejectBtn: {
    backgroundColor: "rgba(225, 29, 72, 0.1)",
    borderColor: "rgba(225, 29, 72, 0.3)",
  },
  rejectBtnText: {
    color: "#E11D48",
    fontSize: 12,
    fontWeight: "800",
  },
  approveBtn: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
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

  // Users Styles
  userCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  headerInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "800",
  },
  userEmail: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusSuspended: {
    backgroundColor: "rgba(225, 29, 72, 0.15)",
  },
  statusInactive: {
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  statusArchived: {
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  statusTextActive: {
    color: "#10B981",
  },
  statusTextSuspended: {
    color: "#E11D48",
  },
  statusTextInactive: {
    color: "#94A3B8",
  },
  statusTextArchived: {
    color: "#94A3B8",
  },
  metaRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
  },
  metaItem: {
    flex: 1,
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  metaValue: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  btnActivate: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  btnSuspend: {
    backgroundColor: "rgba(225, 29, 72, 0.1)",
    borderColor: "rgba(225, 29, 72, 0.3)",
  },
  optionsGroup: {
    gap: 8,
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusOptionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  optionPill: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  optionPillSelected: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  optionPillText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  roleOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rolePill: {
    width: "48%",
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  rolePillSelected: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  rolePillText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  reasonSection: {
    gap: 6,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    height: 38,
  },

  // Groups Styles
  groupIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  householdName: {
    fontSize: 14,
    fontWeight: "800",
  },
  apartmentName: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  detailsRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
  },
  detailCol: {
    flex: 1,
    alignItems: "center",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleStatusBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  archiveBtn: {
    backgroundColor: "rgba(225, 29, 72, 0.1)",
  },
  restoreBtn: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  toggleStatusBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },

  // Maintenance Styles
  subTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  subTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  subTabBtnActive: {},
  subTabText: {
    fontSize: 11,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  sectionSubtitle: {
    fontSize: 10.5,
    fontWeight: "500",
    marginTop: 1,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
  },
  versionGrid: {
    flexDirection: "row",
    gap: 10,
  },
  versionCol: {
    flex: 1,
    gap: 6,
  },
  singleInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 9,
    fontSize: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  toggleDesc: {
    fontSize: 10.5,
    fontWeight: "500",
  },
  saveBtn: {
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  logCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 6,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logActionBox: {
    backgroundColor: "rgba(225, 29, 72, 0.1)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  logActionText: {
    color: "#E11D48",
    fontSize: 9.5,
    fontWeight: "800",
  },
  logTimestamp: {
    fontSize: 10,
    fontWeight: "500",
  },
  logBody: {
    gap: 2,
  },
  logActor: {
    fontSize: 11.5,
  },
  logEntity: {
    fontSize: 10.5,
  },
  logReason: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2,
  },
  ticketCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 6,
  },
  ticketHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ticketSubject: {
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  ticketStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ticketStatusOpen: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  ticketStatusResolved: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  ticketStatusText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  ticketStatusTextOpen: {
    color: "#F59E0B",
  },
  ticketStatusTextResolved: {
    color: "#10B981",
  },
  ticketMeta: {
    fontSize: 10.5,
  },
  ticketDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  ticketActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  ticketActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ticketActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
