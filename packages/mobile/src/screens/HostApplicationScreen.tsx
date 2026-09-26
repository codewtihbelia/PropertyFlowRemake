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
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { auth } from "../firebase/config";
import { mobileDataService } from "../services/firebaseDataService";
import {
  HostApplication,
  UserProfile,
  HOST_MANAGEMENT_TYPES,
} from "@propertyflow/shared";

interface HostApplicationScreenProps {
  onBack: () => void;
}

const DEFAULT_MANAGEMENT_TYPES = [
  "Utilities & Master Leaseholder (Water, WiFi, Rent)",
  "Primary Leaseholder / Master Tenant",
  "Property Owner / Landlord",
  "Property Manager / Co-living Operator",
  "Roommate Coordinator / Flat Lead",
  "Sublessor / Flat Representative",
  "Other / Independent Household Host",
];

const AVATAR_COLORS = [
  "#F59E0B",
  "#10B981",
  "#EC4899",
  "#6366F1",
  "#06B6D4",
  "#F43F5E",
];

export const HostApplicationScreen: React.FC<HostApplicationScreenProps> = ({
  onBack,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<HostApplication | null>(null);
  const [households, setHouseholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields - None prefilled, clean placeholders as requested:
  // 1. Full Name
  // 2. Contact Number
  // 3. Select Roommate Group (Optional) + Empty State if no groups created
  // 4. Property Address
  // 5. Host Management Type with dropdown
  // 6. Unit, Apt or Floor (Optional)
  // 7. Est Monthly Bills
  // 8. Why do you want to become a host
  // 9. Property Experience
  const [applicantName, setApplicantName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [roommateGroupName, setRoommateGroupName] = useState<string>("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [managementType, setManagementType] = useState<string>("");
  const [unitOrRoom, setUnitOrRoom] = useState("");
  const [monthlyRentOrShare, setMonthlyRentOrShare] = useState("");
  const [reasonForApplying, setReasonForApplying] = useState("");
  const [experience, setExperience] = useState("");
  const [activeStep, setActiveStep] = useState<number>(1);

  // Modals
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const currentUser = auth.currentUser;
  const managementTypesList = HOST_MANAGEMENT_TYPES || DEFAULT_MANAGEMENT_TYPES;

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    // Fetch user profile (to inspect existing role, do not force-fill text inputs)
    mobileDataService.getUserProfile(currentUser.uid).then((p) => {
      if (p) {
        setProfile(p as UserProfile);
      }
    });

    // Listen to user's host application
    const unsubscribeApp = mobileDataService.listenToUserHostApplication(
      currentUser.uid,
      (app) => {
        clearTimeout(safetyTimer);
        setApplication(app);
        setLoading(false);
      },
    );

    // Listen to existing households in Firestore
    const unsubscribeHh = mobileDataService.listenToHouseholds((list) => {
      setHouseholds(list || []);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeApp();
      unsubscribeHh();
    };
  }, [currentUser]);

  const handleSelectGroup = (hh: any) => {
    const hhId = hh.householdId || hh.id;
    const hhName = hh.householdName || hh.apartmentName || "Roommate Group";

    // Allow toggling off (since optional)
    if (selectedGroupId === hhId) {
      setSelectedGroupId("");
      setRoommateGroupName("");
    } else {
      setSelectedGroupId(hhId);
      setRoommateGroupName(hhName);
      if (hh.address && !propertyAddress.trim()) {
        setPropertyAddress(hh.address);
      }
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) return;

    if (!applicantName.trim()) {
      Alert.alert("Required Field", "Please enter your full name.");
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert("Required Field", "Please enter your contact number.");
      return;
    }
    if (!propertyAddress.trim()) {
      Alert.alert("Required Field", "Please enter the property address.");
      return;
    }
    if (!managementType.trim()) {
      Alert.alert("Required Field", "Please select your host management type.");
      return;
    }
    if (!reasonForApplying.trim()) {
      Alert.alert(
        "Required Field",
        "Please state why you want to become a host.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const parsedBills = monthlyRentOrShare.trim()
        ? parseFloat(monthlyRentOrShare.replace(/[^0-9.]/g, ""))
        : undefined;

      await mobileDataService.submitHostApplication({
        userId: currentUser.uid,
        userEmail: currentUser.email || profile?.email || "",
        applicantEmail: currentUser.email || profile?.email || "",
        applicantName: applicantName.trim(),
        phoneNumber: phoneNumber.trim(),
        applicantPhone: phoneNumber.trim(),
        propertyAddress: propertyAddress.trim(),
        managementType: managementType.trim(),
        selectedHouseholdId: selectedGroupId || "",
        roommateGroupName: roommateGroupName.trim(),
        unitOrRoom: unitOrRoom.trim(),
        monthlyRentOrShare: isNaN(parsedBills as number)
          ? undefined
          : parsedBills,
        estimatedMonthlyBills: isNaN(parsedBills as number)
          ? undefined
          : parsedBills,
        reason: reasonForApplying.trim(),
        reasonForApplying: reasonForApplying.trim(),
        experience: experience.trim(),
        propertyExperience: experience.trim(),
        status: "PENDING",
      });

      Alert.alert(
        "Application Submitted!",
        "Your Host application has been sent for Super Admin review. You will receive host access upon approval.",
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
      {/* Top Header Bar matching attached screenshot */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.circleIconBtn}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Host Application</Text>
        <TouchableOpacity
          style={styles.circleIconBtn}
          onPress={() => setShowInfoModal(true)}
          activeOpacity={0.7}
        >
          <Feather name="info" size={18} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingText}>
              Loading application status...
            </Text>
          </View>
        ) : isAlreadyHost ? (
          /* State 1: Already Host */
          <View style={styles.cardSuccess}>
            <View style={styles.statusRow}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={26} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardSuccessTitle}>Verified Host Admin</Text>
                <Text style={styles.cardSuccessSubtitle}>
                  You already possess Host Administrator privileges to create
                  roommate groups, manage utility splits, and verify member
                  attendance.
                </Text>
              </View>
            </View>
          </View>
        ) : application?.status === "PENDING" ? (
          /* State 2: Under Review */
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
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Full Name</Text>
                <Text style={styles.detailValue}>
                  {application.applicantName || "Not provided"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Contact Number</Text>
                <Text style={styles.detailValue}>
                  {application.phoneNumber ||
                    application.applicantPhone ||
                    "Not provided"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Property Address</Text>
                <Text style={styles.detailValue}>
                  {application.propertyAddress}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Host Management Type</Text>
                <Text
                  style={[
                    styles.detailValue,
                    { color: "#2563EB", fontWeight: "700" },
                  ]}
                >
                  {application.managementType}
                </Text>
              </View>
              {application.roommateGroupName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Roommate Group</Text>
                  <Text style={styles.detailValue}>
                    {application.roommateGroupName}
                  </Text>
                </View>
              ) : null}
              {application.unitOrRoom ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Unit, Apt or Floor</Text>
                  <Text style={styles.detailValue}>
                    {application.unitOrRoom}
                  </Text>
                </View>
              ) : null}
              {application.estimatedMonthlyBills ||
              application.monthlyRentOrShare ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Est. Monthly Bills</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: "#059669", fontWeight: "700" },
                    ]}
                  >
                    ₱
                    {application.estimatedMonthlyBills ||
                      application.monthlyRentOrShare}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.pendingNotice}>
              <Ionicons name="shield-checkmark" size={16} color="#B45309" />
              <Text style={styles.pendingNoticeText}>
                Super Administrators review host requests to protect group
                billing. You will be notified once approved.
              </Text>
            </View>
          </View>
        ) : (
          /* State 3: Requested UI Layout */
          <View style={styles.contentWrap}>
            {/* Blue Hero Card Banner */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.verifiedBadge}>
                  <View style={styles.greenPulseDot} />
                  <Text style={styles.verifiedBadgeText}>
                    VERIFIED HOST PROGRAM
                  </Text>
                </View>
                <View style={styles.heroIconBox}>
                  <MaterialCommunityIcons
                    name="office-building-outline"
                    size={22}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              <Text style={styles.heroTitle}>
                Become an Apartment{"\n"}Lead Host
              </Text>
              <Text style={styles.heroSubtitle}>
                Manage roommate utility cycles, automate bill splits, and
                collect payments seamlessly.
              </Text>
            </View>

            {/* Stepper Progress Bar */}
            <View style={styles.stepperContainer}>
              {/* Step 1 */}
              <TouchableOpacity
                style={styles.stepItem}
                onPress={() => setActiveStep(1)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.stepCircle,
                    activeStep === 1 && styles.stepCircleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepCircleText,
                      activeStep === 1 && styles.stepCircleTextActive,
                    ]}
                  >
                    1
                  </Text>
                </View>
                <View style={styles.stepTextCol}>
                  <Text
                    style={[
                      styles.stepLabel,
                      activeStep === 1 && styles.stepLabelActive,
                    ]}
                  >
                    Property &{"\n"}Terms
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Connecting Line 1 */}
              <View style={styles.stepConnector} />

              {/* Step 2 */}
              <TouchableOpacity
                style={styles.stepItem}
                onPress={() => setActiveStep(2)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.stepCircle,
                    activeStep === 2 && styles.stepCircleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepCircleText,
                      activeStep === 2 && styles.stepCircleTextActive,
                    ]}
                  >
                    2
                  </Text>
                </View>
                <View style={styles.stepTextCol}>
                  <Text
                    style={[
                      styles.stepLabel,
                      activeStep === 2 && styles.stepLabelActive,
                    ]}
                  >
                    KYC &{"\n"}Payout
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Connecting Line 2 */}
              <View style={styles.stepConnector} />

              {/* Step 3 */}
              <TouchableOpacity
                style={styles.stepItem}
                onPress={() => setActiveStep(3)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.stepCircle,
                    activeStep === 3 && styles.stepCircleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepCircleText,
                      activeStep === 3 && styles.stepCircleTextActive,
                    ]}
                  >
                    3
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* 1. Full Name */}
            <View style={styles.formFieldBlock}>
              <Text style={styles.fieldHeaderLabel}>
                Full Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputWithIcon}>
                <Feather
                  name="user"
                  size={17}
                  color="#94A3B8"
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.textInputStyle}
                  value={applicantName}
                  onChangeText={setApplicantName}
                  placeholder="e.g. Juan dela Cruz"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* 2. Contact Number */}
            <View style={styles.formFieldBlock}>
              <Text style={styles.fieldHeaderLabel}>
                Contact Number <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputWithIcon}>
                <Feather
                  name="phone"
                  size={17}
                  color="#94A3B8"
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.textInputStyle}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="e.g. +63 917 123 4567"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* 3. Select Roommate Group (Optional) + Empty State */}
            <View style={styles.formFieldBlock}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldHeaderLabel}>
                  Select Roommate Group
                </Text>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalBadgeText}>Optional</Text>
                </View>
              </View>

              {households.length === 0 ? (
                /* Empty State: No groups created yet */
                <View style={styles.emptyGroupCard}>
                  <View style={styles.emptyIconCircle}>
                    <Feather name="users" size={20} color="#64748B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.emptyGroupTitle}>
                      No Roommate Groups Available
                    </Text>
                    <Text style={styles.emptyGroupSubtitle}>
                      Non-hosts cannot create groups yet. You can submit without
                      a group and create your household once approved as a Host.
                    </Text>
                  </View>
                </View>
              ) : (
                /* Horizontal Scrollable or Card list of existing groups */
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.groupCardsScroll}
                >
                  {households.map((hh, idx) => {
                    const hhId = hh.householdId || hh.id;
                    const isSelected = selectedGroupId === hhId;
                    const membersCount = Array.isArray(hh.members)
                      ? hh.members.length
                      : typeof hh.memberCount === "number"
                        ? hh.memberCount
                        : 1;
                    const groupTitle =
                      hh.householdName || hh.apartmentName || "Roommate Group";
                    const subtitle = hh.unit
                      ? `Unit ${hh.unit} • ${membersCount} Members`
                      : `${membersCount} Members`;

                    return (
                      <TouchableOpacity
                        key={hhId}
                        style={[
                          styles.groupCard,
                          isSelected
                            ? styles.groupCardSelected
                            : styles.groupCardUnselected,
                        ]}
                        onPress={() => handleSelectGroup(hh)}
                        activeOpacity={0.88}
                      >
                        <View style={styles.groupCardTop}>
                          <Text
                            style={[
                              styles.groupTagText,
                              isSelected
                                ? styles.groupTagTextSelected
                                : styles.groupTagTextUnselected,
                            ]}
                          >
                            {idx === 0 ? "Primary Group" : "Available Group"}
                          </Text>
                          {isSelected ? (
                            <View style={styles.checkCircleFilled}>
                              <Ionicons
                                name="checkmark"
                                size={13}
                                color="#2563EB"
                              />
                            </View>
                          ) : (
                            <View style={styles.radioOutline} />
                          )}
                        </View>

                        <Text
                          style={[
                            styles.groupCardTitle,
                            isSelected
                              ? styles.groupCardTitleSelected
                              : styles.groupCardTitleUnselected,
                          ]}
                          numberOfLines={1}
                        >
                          {groupTitle}
                        </Text>
                        <Text
                          style={[
                            styles.groupCardSub,
                            isSelected
                              ? styles.groupCardSubSelected
                              : styles.groupCardSubUnselected,
                          ]}
                        >
                          {subtitle}
                        </Text>

                        <View style={styles.avatarRow}>
                          <View style={styles.avatarStack}>
                            {[0, 1, 2]
                              .slice(0, Math.min(membersCount, 3))
                              .map((mIdx) => (
                                <View
                                  key={mIdx}
                                  style={[
                                    styles.avatarCircle,
                                    {
                                      backgroundColor:
                                        AVATAR_COLORS[
                                          (idx + mIdx) % AVATAR_COLORS.length
                                        ],
                                      left: mIdx * 14,
                                      zIndex: 3 - mIdx,
                                    },
                                  ]}
                                >
                                  <Text style={styles.avatarInitials}>
                                    {groupTitle.substring(0, 1).toUpperCase()}
                                    {mIdx + 1}
                                  </Text>
                                </View>
                              ))}
                          </View>
                          {membersCount > 3 && (
                            <Text
                              style={[
                                styles.moreCountText,
                                isSelected
                                  ? styles.moreCountTextSelected
                                  : styles.moreCountTextUnselected,
                              ]}
                            >
                              +{membersCount - 3} more
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* 4. Property Address */}
            <View style={styles.formFieldBlock}>
              <Text style={styles.fieldHeaderLabel}>
                Property Address <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputWithIcon}>
                <Feather
                  name="map-pin"
                  size={17}
                  color="#94A3B8"
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.textInputStyle}
                  value={propertyAddress}
                  onChangeText={setPropertyAddress}
                  placeholder="e.g. 452 Greenfield St, Unit 402, Metro Manila"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* 5. Host Management Type with dropdowns */}
            <View style={styles.formFieldBlock}>
              <Text style={styles.fieldHeaderLabel}>
                Host Management Type <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.inputWithIcon}
                onPress={() => setShowManagementModal(true)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.selectInputText,
                    !managementType && { color: "#94A3B8" },
                  ]}
                  numberOfLines={1}
                >
                  {managementType ||
                    "Select your property management designation"}
                </Text>
                <Feather name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* 6. Unit, Apt or Floor (Optional) */}
            <View style={styles.formFieldBlock}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldHeaderLabel}>Unit, Apt or Floor</Text>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalBadgeText}>Optional</Text>
                </View>
              </View>
              <View style={styles.inputWithIcon}>
                <Feather
                  name="home"
                  size={17}
                  color="#94A3B8"
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.textInputStyle}
                  value={unitOrRoom}
                  onChangeText={setUnitOrRoom}
                  placeholder="e.g. Unit 402, 4th Floor"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* 7. Est Monthly Bills */}
            <View style={styles.formFieldBlock}>
              <Text style={styles.fieldHeaderLabel}>Est. Monthly Bills</Text>
              <View style={styles.inputWithIcon}>
                <Text style={styles.currencyPrefix}>₱</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={monthlyRentOrShare}
                  onChangeText={setMonthlyRentOrShare}
                  placeholder="e.g. 15000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* 8. Why do you want to become a host */}
            <View style={styles.formFieldBlock}>
              <Text style={styles.fieldHeaderLabel}>
                Why do you want to become a host{" "}
                <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInputStyle, styles.textAreaInput]}
                value={reasonForApplying}
                onChangeText={setReasonForApplying}
                placeholder="Explain why you want to become a host (e.g. I am the primary leaseholder and organize utility splits and water attendance for roommates)..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* 9. Property Experience */}
            <View style={styles.formFieldBlock}>
              <Text style={styles.fieldHeaderLabel}>Property Experience</Text>
              <TextInput
                style={[styles.textInputStyle, styles.textAreaInput]}
                value={experience}
                onChangeText={setExperience}
                placeholder="Describe your prior experience managing leases, collecting utility shares, or hosting shared accommodations..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Action Bar / Submit Button */}
            <TouchableOpacity
              style={[
                styles.primaryActionBtn,
                submitting && styles.btnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.btnText}>Submit Host Application</Text>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal: Host Management Type Dropdown */}
      <Modal
        visible={showManagementModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManagementModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowManagementModal(false)}
        >
          <View
            style={styles.modalSheet}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Host Management Type</Text>
                <Text style={styles.modalSubtitle}>
                  Select your property administration role
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowManagementModal(false)}
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }}>
              {managementTypesList.map((type) => {
                const isSelected = managementType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.modalOption,
                      isSelected && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setManagementType(type);
                      setShowManagementModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalOptionLeft}>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <Text
                        style={[
                          styles.modalOptionText,
                          isSelected && styles.modalOptionTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </View>
                    {isSelected && (
                      <Feather name="check" size={16} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Host Program Information */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInfoModal(false)}
        >
          <View
            style={styles.modalSheet}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Verified Host Program</Text>
                <Text style={styles.modalSubtitle}>
                  Role requirements & benefits
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowInfoModal(false)}
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 12, paddingVertical: 8 }}>
              <View style={styles.infoRow}>
                <Ionicons name="water-outline" size={20} color="#2563EB" />
                <Text style={styles.infoRowText}>
                  Set custom per-day water attendance rates and automate monthly
                  utility distribution.
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="card-outline" size={20} color="#10B981" />
                <Text style={styles.infoRowText}>
                  Receive direct roommate settlements to GCash, Maya, or
                  verified bank accounts.
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="people-outline" size={20} color="#8B5CF6" />
                <Text style={styles.infoRowText}>
                  Create, lock, and manage household roommate membership with
                  zero hassle.
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
  },
  circleIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
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
  contentWrap: {
    gap: 16,
  },

  // 1. Blue Hero Card
  heroCard: {
    backgroundColor: "#1D4ED8",
    borderRadius: 24,
    padding: 22,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 28,
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#DBEAFE",
    lineHeight: 18,
  },

  // 2. Stepper Progress
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    backgroundColor: "#2563EB",
  },
  stepCircleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
  },
  stepCircleTextActive: {
    color: "#FFFFFF",
  },
  stepTextCol: {
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    lineHeight: 14,
  },
  stepLabelActive: {
    color: "#0F172A",
    fontWeight: "800",
  },
  stepConnector: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 8,
  },

  // Section / Field Headers
  formFieldBlock: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldHeaderLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  requiredStar: {
    color: "#EF4444",
  },
  optionalBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  optionalBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },

  // Empty state for roommate group
  emptyGroupCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 12,
  },
  emptyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyGroupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 2,
  },
  emptyGroupSubtitle: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },

  // Group cards when available
  groupCardsScroll: {
    gap: 12,
    paddingVertical: 2,
  },
  groupCard: {
    width: 175,
    borderRadius: 18,
    padding: 14,
    justifyContent: "space-between",
    minHeight: 126,
  },
  groupCardSelected: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  groupCardUnselected: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  groupCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  groupTagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  groupTagTextSelected: {
    color: "#BFDBFE",
  },
  groupTagTextUnselected: {
    color: "#94A3B8",
  },
  checkCircleFilled: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOutline: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  groupCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  groupCardTitleSelected: {
    color: "#FFFFFF",
  },
  groupCardTitleUnselected: {
    color: "#0F172A",
  },
  groupCardSub: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 10,
  },
  groupCardSubSelected: {
    color: "#DBEAFE",
  },
  groupCardSubUnselected: {
    color: "#64748B",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarStack: {
    flexDirection: "row",
    height: 24,
    width: 50,
    position: "relative",
  },
  avatarCircle: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  avatarInitials: {
    fontSize: 8,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  moreCountText: {
    fontSize: 10,
    fontWeight: "700",
  },
  moreCountTextSelected: {
    color: "#FFFFFF",
  },
  moreCountTextUnselected: {
    color: "#64748B",
  },

  // Inputs
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  textInputStyle: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  textAreaInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
  },
  selectInputText: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: "800",
    color: "#059669",
    marginRight: 8,
  },

  // Primary Action Button
  primaryActionBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Info Modal Row
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoRowText: {
    flex: 1,
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },

  // Status Cards
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
  successIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
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
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
    maxWidth: "60%",
    textAlign: "right",
  },
  pendingNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#FEEBC8",
  },
  pendingNoticeText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
    lineHeight: 16,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  modalOptionSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  modalOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    gap: 10,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: "#2563EB",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  modalOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  modalOptionTextSelected: {
    color: "#2563EB",
    fontWeight: "700",
  },
});
