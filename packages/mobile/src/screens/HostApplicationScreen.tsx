import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { auth } from "../firebase/config";
import { mobileDataService } from "../services/firebaseDataService";
import { HostApplication, UserProfile } from "@propertyflow/shared";

interface HostApplicationScreenProps {
  onBack: () => void;
}

export const HostApplicationScreen: React.FC<HostApplicationScreenProps> = ({
  onBack,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<HostApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [applicantName, setApplicantName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [unitOrRoom, setUnitOrRoom] = useState("");
  const [monthlyRentOrShare, setMonthlyRentOrShare] = useState("");
  const [reasonForApplying, setReasonForApplying] = useState("");
  const [experience, setExperience] = useState("");

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    mobileDataService.getUserProfile(currentUser.uid).then((p) => {
      if (p) {
        setProfile(p as UserProfile);
        setApplicantName(p.fullName || p.displayName || "");
        if (p.phoneNumber) setPhoneNumber(p.phoneNumber);
      }
    });

    const unsubscribe = mobileDataService.listenToUserHostApplication(
      currentUser.uid,
      (app) => {
        clearTimeout(safetyTimer);
        setApplication(app);
        setLoading(false);
      },
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [currentUser]);

  const handleSubmit = async () => {
    if (!currentUser) return;
    if (!propertyAddress.trim()) {
      Alert.alert(
        "Required Field",
        "Please enter the managed property address.",
      );
      return;
    }
    if (!reasonForApplying.trim()) {
      Alert.alert(
        "Required Field",
        "Please explain why you want to become a Host Admin.",
      );
      return;
    }

    setSubmitting(true);
    try {
      await mobileDataService.submitHostApplication({
        userId: currentUser.uid,
        userEmail: currentUser.email || profile?.email || "",
        applicantEmail: currentUser.email || profile?.email || "",
        applicantName:
          applicantName.trim() || profile?.displayName || "Resident Applicant",
        phoneNumber: phoneNumber.trim(),
        applicantPhone: phoneNumber.trim(),
        propertyAddress: propertyAddress.trim(),
        unitOrRoom: unitOrRoom.trim(),
        monthlyRentOrShare: monthlyRentOrShare
          ? parseFloat(monthlyRentOrShare)
          : undefined,
        reason: reasonForApplying.trim(),
        reasonForApplying: reasonForApplying.trim(),
        experience: experience.trim(),
        status: "PENDING",
      });

      Alert.alert(
        "Application Submitted!",
        "Your Host application has been sent for Super Admin review. You will receive access once approved.",
      );
    } catch (err: any) {
      Alert.alert(
        "Submission Error",
        err.message || "Failed to submit host application. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isAlreadyHost =
    profile?.role === "HOST" || profile?.role === "SUPER_ADMIN";

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Host Application</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingText}>Loading status...</Text>
          </View>
        ) : isAlreadyHost ? (
          /* State 1: Already a Host */
          <View style={styles.cardSuccess}>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={28} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardSuccessTitle}>Verified Host Admin</Text>
                <Text style={styles.cardSuccessSubtitle}>
                  You already possess Host Administrator privileges for managing
                  households, bill splits, and member approvals.
                </Text>
              </View>
            </View>
          </View>
        ) : application?.status === "PENDING" ? (
          /* State 2: Application Pending */
          <View style={styles.cardPending}>
            <View style={styles.statusRow}>
              <View style={styles.pendingIconWrap}>
                <Ionicons name="time" size={24} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardPendingTitle}>
                  Application Under Review
                </Text>
                <Text style={styles.cardPendingSubtitle}>
                  Submitted on{" "}
                  {new Date(
                    application.createdAt ||
                      application.submittedAt ||
                      Date.now(),
                  ).toLocaleDateString()}
                </Text>
              </View>
            </View>

            <View style={styles.pendingDetailsBox}>
              <Text style={styles.detailItem}>
                <Text style={styles.detailLabel}>Property: </Text>
                {application.propertyAddress}
              </Text>
              {application.unitOrRoom ? (
                <Text style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Unit: </Text>
                  {application.unitOrRoom}
                </Text>
              ) : null}
              {application.phoneNumber || application.applicantPhone ? (
                <Text style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Contact: </Text>
                  {application.phoneNumber || application.applicantPhone}
                </Text>
              ) : null}
              {application.monthlyRentOrShare ? (
                <Text style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Est. Expenses: </Text>$
                  {application.monthlyRentOrShare}
                </Text>
              ) : null}
              <Text style={styles.detailItem}>
                <Text style={styles.detailLabel}>Reason: </Text>
                {application.reasonForApplying ||
                  application.reason ||
                  "Not provided"}
              </Text>
            </View>

            <View style={styles.pendingNotice}>
              <Ionicons name="shield-checkmark" size={16} color="#B45309" />
              <Text style={styles.pendingNoticeText}>
                Splitzy Super Administrators review applications to ensure
                secure community billing. You will be notified once reviewed.
              </Text>
            </View>
          </View>
        ) : (
          /* State 3: Fill Application Form */
          <View style={styles.formContainer}>
            {application?.status === "REJECTED" && (
              <View style={styles.rejectedBanner}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rejectedTitle}>
                    Previous Application Revision
                  </Text>
                  <Text style={styles.rejectedText}>
                    {application.adminFeedback ||
                      "Your previous application required further details. You can submit an updated request below."}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.introHeading}>Become a Household Host</Text>
            <Text style={styles.introBody}>
              Standard accounts are created as resident members. If you manage a
              lease or want to host a household with automated utility
              breakdowns and water attendance logs, submit this brief request.
            </Text>

            {/* Applicant Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={applicantName}
                onChangeText={setApplicantName}
                placeholder="e.g. Alex Rivera"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Phone Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contact Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="e.g. +1 (555) 234-5678"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
            </View>

            {/* Property Address */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Managed Property Address *</Text>
              <TextInput
                style={styles.input}
                value={propertyAddress}
                onChangeText={setPropertyAddress}
                placeholder="e.g. 742 Evergreen Terrace, Springfield"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Unit / Room */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Unit, Apt, or Floor (Optional)</Text>
              <TextInput
                style={styles.input}
                value={unitOrRoom}
                onChangeText={setUnitOrRoom}
                placeholder="e.g. Apt 4B"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Monthly Rent or Expenses */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Est. Monthly Household Rent/Expenses
              </Text>
              <TextInput
                style={styles.input}
                value={monthlyRentOrShare}
                onChangeText={setMonthlyRentOrShare}
                placeholder="e.g. 2400"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
            </View>

            {/* Reason for Applying */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Why do you want to become a Host? *
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={reasonForApplying}
                onChangeText={setReasonForApplying}
                placeholder="e.g. I am the primary leaseholder and organize bills for 4 roommates..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Experience */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Property / Household Experience (Optional)
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={experience}
                onChangeText={setExperience}
                placeholder="Prior experience managing expenses, leases, or shared homes..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.submitInner}>
                  <Text style={styles.submitButtonText}>
                    Submit Application
                  </Text>
                  <Feather name="arrow-right" size={17} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  centerLoading: {
    padding: 40,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  cardSuccess: {
    backgroundColor: "#ECFDF5",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardSuccessTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#065F46",
    marginBottom: 4,
  },
  cardSuccessSubtitle: {
    fontSize: 13,
    color: "#047857",
    lineHeight: 18,
  },
  cardPending: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 20,
    gap: 16,
  },
  pendingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  cardPendingTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#92400E",
  },
  cardPendingSubtitle: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 2,
  },
  pendingDetailsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 8,
  },
  detailItem: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  detailLabel: {
    fontWeight: "700",
    color: "#0F172A",
  },
  pendingNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  pendingNoticeText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
    lineHeight: 16,
  },
  rejectedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  rejectedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991B1B",
  },
  rejectedText: {
    fontSize: 12,
    color: "#B91C1C",
    marginTop: 2,
    lineHeight: 16,
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
    gap: 16,
  },
  introHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  introBody: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
