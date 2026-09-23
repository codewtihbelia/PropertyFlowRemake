import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StatusBar,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { auth } from "../firebase/config";
import {
  mobileDataService,
  MobileExpense,
} from "../services/firebaseDataService";
import { formatPesos } from "@propertyflow/shared";

interface ManageGroupScreenProps {
  onBack: () => void;
  onOpenAddExpense?: () => void;
  currentUser?: { name: string; avatar: string };
  initialView?: "details" | "edit" | "create" | "join";
}

interface Participant {
  id: string;
  name: string;
  avatar: string;
  role: string;
  status: "Pending" | "Settled";
  statusDate?: string;
  owesCents: number;
  email?: string;
  phone?: string;
}

export const ManageGroupScreen: React.FC<ManageGroupScreenProps> = ({
  onBack,
  onOpenAddExpense,
  currentUser = { name: "Resident", avatar: "R" },
  initialView = "details",
}) => {
  const [viewMode, setViewMode] = useState<
    "details" | "edit" | "create" | "success" | "join"
  >(initialView);
  const [showMenu, setShowMenu] = useState(false);

  // Household & Profile state with cache initialization
  const cachedProfile = mobileDataService.getCachedProfile();
  const cachedHousehold = mobileDataService.getCachedHousehold();
  const [profile, setProfile] = useState<any | null>(() => cachedProfile);
  const [household, setHousehold] = useState<any | null>(() => cachedHousehold);
  const [expenses, setExpenses] = useState<MobileExpense[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [cloudMembers, setCloudMembers] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showCreateCycleModal, setShowCreateCycleModal] = useState(false);
  const [showEditCycleModal, setShowEditCycleModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Edit Cycle Form State
  const [editCycleName, setEditCycleName] = useState("");
  const [editCycleStart, setEditCycleStart] = useState("");
  const [editCycleEnd, setEditCycleEnd] = useState("");
  const [editCycleStatus, setEditCycleStatus] = useState("ACTIVE");

  // Create Cycle Form State
  const now = new Date();
  const defaultMonthName = now.toLocaleString("default", { month: "short" });
  const defaultYear = now.getFullYear();
  const [cycleNameInput, setCycleNameInput] = useState(
    `${defaultMonthName} ${defaultYear} Cycle`,
  );
  const [cycleStartInput, setCycleStartInput] = useState(
    new Date(defaultYear, now.getMonth(), 1).toISOString().slice(0, 10),
  );
  const [cycleEndInput, setCycleEndInput] = useState(
    new Date(defaultYear, now.getMonth() + 1, 0).toISOString().slice(0, 10),
  );

  // Invite Roommate Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteContact, setInviteContact] = useState("");

  // Create Group Form State
  const [groupNameInput, setGroupNameInput] = useState(
    () =>
      cachedHousehold?.householdName ||
      cachedHousehold?.apartmentName ||
      cachedProfile?.householdName ||
      "",
  );
  const [createdGroupName, setCreatedGroupName] = useState("");
  const [newMemberInput, setNewMemberInput] = useState("");
  const [addedMembers, setAddedMembers] = useState<
    Array<{ id: string; name: string; phone?: string }>
  >([]);

  // Join Group State
  const [joinLinkInput, setJoinLinkInput] = useState("");

  // Edit Group Form State
  const [editGroupName, setEditGroupName] = useState(
    () =>
      cachedHousehold?.householdName ||
      cachedHousehold?.apartmentName ||
      cachedProfile?.householdName ||
      "",
  );

  const firebaseUser = auth.currentUser;
  const householdId = profile?.householdId || household?.householdId || "";
  const isHost =
    profile?.role === "HOST" || profile?.hostApplicationStatus === "APPROVED";

  // Fetch profile on mount
  useEffect(() => {
    let mounted = true;
    if (!firebaseUser?.uid) return;
    mobileDataService.getUserProfile(firebaseUser.uid).then((p) => {
      if (mounted && p) {
        setProfile(p);
        const defaultApt = p.householdName || p.apartmentName || "";
        if (defaultApt) {
          setGroupNameInput((prev: string) => prev || defaultApt);
          setEditGroupName((prev: string) => prev || defaultApt);
        }
      }
    });
    const unsubProfile = mobileDataService.listenToUserProfile(
      firebaseUser.uid,
      (p) => {
        if (mounted && p) {
          setProfile(p);
          if (!p.householdId) {
            setHousehold(null);
          }
        }
      },
    );
    return () => {
      mounted = false;
      unsubProfile();
    };
  }, [firebaseUser?.uid]);

  // Set initial view mode only ONCE on mount
  const hasAppliedInitialView = useRef(false);
  useEffect(() => {
    if (!hasAppliedInitialView.current) {
      hasAppliedInitialView.current = true;
      if (initialView === "create" || (!householdId && isHost)) {
        setViewMode("create");
      }
    }
  }, [initialView, householdId, isHost]);

  // Listen to Household and sub-collections
  useEffect(() => {
    if (!householdId) return;
    const unsubHh = mobileDataService.listenToHousehold(householdId, (hh) => {
      if (hh) {
        setHousehold(hh);
        const resolved =
          hh.householdName || hh.apartmentName || "Household Group";
        setEditGroupName(resolved);
        setGroupNameInput(resolved);
      }
    });
    const unsubExp = mobileDataService.listenToExpenses(
      householdId,
      setExpenses,
    );
    const unsubCyc = mobileDataService.listenToBillingCycles(
      householdId,
      (loadedCycles) => {
        setCycles(loadedCycles);
        if (loadedCycles.length > 0 && !selectedCycleId) {
          const active =
            loadedCycles.find((c) => c.status === "ACTIVE") || loadedCycles[0];
          setSelectedCycleId(active.billingCycleId);
        }
      },
    );
    const unsubMem = mobileDataService.listenToHouseholdMembers(
      householdId,
      setCloudMembers,
    );

    return () => {
      unsubHh();
      unsubExp();
      unsubCyc();
      unsubMem();
    };
  }, [householdId]);

  // Determine active billing cycle
  const activeCycle =
    cycles.find((c) => c.billingCycleId === selectedCycleId) ||
    cycles.find((c) => c.status === "ACTIVE") ||
    cycles[0] ||
    null;

  useEffect(() => {
    if (!householdId || !activeCycle?.billingCycleId) {
      setBills([]);
      return;
    }
    return mobileDataService.listenToMemberBills(
      householdId,
      activeCycle.billingCycleId,
      setBills,
    );
  }, [householdId, activeCycle?.billingCycleId]);

  const currentGroupName =
    household?.householdName ||
    household?.apartmentName ||
    profile?.householdName ||
    profile?.apartmentName ||
    (householdId ? "Household Group" : "No Group");

  const handleBackFromCreate = () => {
    if (initialView === "create" || !householdId) {
      onBack();
    } else {
      setViewMode("details");
    }
  };

  const handleBackFromJoin = () => {
    if (!householdId) {
      onBack();
    } else {
      setViewMode("details");
    }
  };

  // Filter expenses for current cycle (or all if cycle not tied)
  const currentCycleExpenses = activeCycle
    ? expenses.filter(
        (e) =>
          !e.billingCycleId || e.billingCycleId === activeCycle.billingCycleId,
      )
    : expenses;

  // Real amounts calculated from Firestore data (Zero when nothing added, NO hardcoding)
  const totalExpenseCents = currentCycleExpenses.reduce(
    (sum, e) => sum + (e.amountCents || 0),
    0,
  );
  const totalDuesCents = bills.reduce(
    (sum, b) => sum + (b.outstandingCentavos || 0),
    0,
  );

  // Real participants list from Firestore members
  const participants: Participant[] =
    cloudMembers.length > 0
      ? cloudMembers.map((m) => {
          const userBill = bills.find(
            (b) => b.userId === (m.userId || m.memberId),
          );
          const owes = userBill ? userBill.outstandingCentavos || 0 : 0;
          const isSettled = owes <= 0 || m.status === "SETTLED";
          const displayName =
            m.displayName ||
            m.name ||
            (m.role === "HOST" ? "Host" : "Roommate");
          return {
            id: m.memberId || m.userId || String(Math.random()),
            name: displayName,
            avatar: displayName.charAt(0).toUpperCase(),
            role: m.role || "PAYOR",
            status: isSettled ? "Settled" : "Pending",
            statusDate: activeCycle
              ? formatShortDate(activeCycle.endDate || "")
              : "Current",
            owesCents: owes,
            email: m.email,
            phone: m.phoneNumber,
          };
        })
      : firebaseUser
        ? [
            {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || currentUser.name || "Host",
              avatar: (firebaseUser.displayName || currentUser.name || "H")
                .charAt(0)
                .toUpperCase(),
              role: profile?.role === "HOST" ? "HOST" : "PAYOR",
              status: "Settled",
              statusDate: "Current",
              owesCents: 0,
              email: firebaseUser.email || undefined,
            },
          ]
        : [];

  // Helper date formatting
  function formatShortDate(dateStr: string) {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  }

  // Handlers
  const handleCreateBillingCycle = async () => {
    if (!cycleNameInput.trim()) {
      Alert.alert("Validation", "Please enter a name for the cycle.");
      return;
    }
    if (!householdId) {
      Alert.alert(
        "Household Required",
        "Please ensure your household is active.",
      );
      return;
    }

    setLoading(true);
    try {
      const newCycleId = await mobileDataService.createBillingCycle(
        householdId,
        {
          name: cycleNameInput.trim(),
          startDate: cycleStartInput,
          endDate: cycleEndInput,
          status: "ACTIVE",
        },
      );
      setSelectedCycleId(newCycleId);
      setShowCreateCycleModal(false);
      setLoading(false);
      Alert.alert(
        "Billing Cycle Created",
        `Cycle "${cycleNameInput.trim()}" is now active.`,
      );
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error", err.message || "Failed to create billing cycle.");
    }
  };

  const handleOpenEditCycle = () => {
    if (!activeCycle) return;
    setEditCycleName(activeCycle.name || "");
    setEditCycleStart(activeCycle.startDate || "");
    setEditCycleEnd(activeCycle.endDate || "");
    setEditCycleStatus(activeCycle.status || "ACTIVE");
    setShowEditCycleModal(true);
  };

  const handleUpdateBillingCycle = async () => {
    if (!editCycleName.trim()) {
      Alert.alert("Validation", "Please enter a name for the cycle.");
      return;
    }
    if (!householdId || !activeCycle) return;

    setLoading(true);
    try {
      await mobileDataService.updateBillingCycle(
        householdId,
        activeCycle.billingCycleId,
        {
          name: editCycleName.trim(),
          startDate: editCycleStart,
          endDate: editCycleEnd,
          status: editCycleStatus,
        },
      );
      setShowEditCycleModal(false);
      setLoading(false);
      Alert.alert(
        "Cycle Updated",
        `Cycle "${editCycleName.trim()}" has been updated.`,
      );
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error", err.message || "Failed to update billing cycle.");
    }
  };

  const handleDeleteBillingCycle = () => {
    if (!householdId || !activeCycle) return;
    Alert.alert(
      "Delete Billing Cycle",
      `Are you sure you want to delete cycle "${activeCycle.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await mobileDataService.deleteBillingCycle(
                householdId,
                activeCycle.billingCycleId,
              );
              const remaining = cycles.filter(
                (c) => c.billingCycleId !== activeCycle.billingCycleId,
              );
              if (remaining.length > 0) {
                setSelectedCycleId(remaining[0].billingCycleId);
              } else {
                setSelectedCycleId("");
              }
              setLoading(false);
              Alert.alert("Deleted", "Billing cycle has been deleted.");
            } catch (err: any) {
              setLoading(false);
              Alert.alert(
                "Error",
                err.message || "Failed to delete billing cycle.",
              );
            }
          },
        },
      ],
    );
  };

  const handleInviteRoommate = async () => {
    if (!inviteName.trim()) {
      Alert.alert("Validation", "Please enter the roommate's name.");
      return;
    }
    if (!householdId) return;

    setLoading(true);
    try {
      await mobileDataService.inviteMemberToHousehold(householdId, {
        name: inviteName.trim(),
        phoneOrEmail: inviteContact.trim(),
        role: "PAYOR",
      });
      setInviteName("");
      setInviteContact("");
      setShowInviteModal(false);
      setLoading(false);
      Alert.alert(
        "Roommate Added",
        `${inviteName.trim()} has been invited to the household.`,
      );
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Notice", err.message || "Could not invite roommate.");
    }
  };

  const handleRemoveMember = (member: Participant) => {
    if (member.role === "HOST") {
      Alert.alert(
        "Host Protected",
        "The host cannot be removed from their household.",
      );
      return;
    }
    Alert.alert(
      "Remove Roommate",
      `Are you sure you want to remove ${member.name} from this group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (householdId && member.id) {
              await mobileDataService.removeMemberFromHousehold(
                householdId,
                member.id,
              );
            }
            Alert.alert("Removed", `${member.name} has been removed.`);
          },
        },
      ],
    );
  };

  const handleCreateGroup = async () => {
    const finalGroupName =
      groupNameInput.trim() ||
      profile?.apartmentName ||
      profile?.householdName ||
      "My Household";
    if (!finalGroupName) {
      Alert.alert("Error", "Please enter a group name.");
      return;
    }
    if (!firebaseUser?.uid) {
      Alert.alert("Auth Required", "Please sign in to create a group.");
      return;
    }

    setLoading(true);
    try {
      await mobileDataService.createHousehold({
        householdName: finalGroupName,
        apartmentName: finalGroupName,
        hostId: firebaseUser.uid,
        members: addedMembers.map((m) => ({
          name: m.name,
          phoneOrEmail: m.phone,
        })),
      });
      setCreatedGroupName(finalGroupName);
      setLoading(false);
      setViewMode("success");
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Creation Notice", err.message || "Failed to create group.");
    }
  };

  const handleUpdateGroup = async () => {
    if (!editGroupName.trim()) {
      Alert.alert("Validation", "Group name cannot be empty.");
      return;
    }
    if (householdId) {
      await mobileDataService.updateHousehold(householdId, {
        householdName: editGroupName.trim(),
        apartmentName: editGroupName.trim(),
      });
    }
    Alert.alert("Group Updated", "Apartment details updated successfully.");
    setViewMode("details");
  };

  const handleJoinGroup = async () => {
    if (!joinLinkInput.trim()) {
      Alert.alert("Input Required", "Please enter a household code or link.");
      return;
    }
    if (!firebaseUser?.uid) return;

    setLoading(true);
    let code = joinLinkInput.trim();
    if (code.includes("/")) {
      code = code.split("/").pop() || code;
    }

    const result = await mobileDataService.joinHouseholdByCode(code, {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || currentUser.name,
      email: firebaseUser.email || "",
    });

    setLoading(false);
    if (result.success) {
      Alert.alert(
        "Success",
        `You have joined ${result.household?.householdName || "the group"}!`,
      );
      setViewMode("details");
    } else {
      Alert.alert("Join Failed", result.error || "Could not find household.");
    }
  };

  const handleCopyInviteCode = () => {
    const code =
      household?.inviteCode || householdId.slice(-6).toUpperCase() || "PF-402";
    Alert.alert("Invite Code", `Share this code with your roommates: ${code}`);
    setShowMenu(false);
  };

  // --------------------------------------------------------------------------
  // VIEW: SUCCESS SCREEN
  // --------------------------------------------------------------------------
  if (viewMode === "success") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.successContainer}>
          <View style={styles.badgeWrapper}>
            <View
              style={[
                styles.sparkleDot,
                { top: 0, left: 24, backgroundColor: "#3B82F6" },
              ]}
            />
            <View
              style={[
                styles.sparkleDot,
                {
                  top: 12,
                  right: 20,
                  backgroundColor: "#60A5FA",
                  width: 8,
                  height: 8,
                },
              ]}
            />
            <View
              style={[
                styles.sparkleDot,
                {
                  bottom: 10,
                  left: 16,
                  backgroundColor: "#93C5FD",
                  width: 9,
                  height: 9,
                },
              ]}
            />
            <View
              style={[
                styles.sparkleDot,
                {
                  bottom: 6,
                  right: 28,
                  backgroundColor: "#2563EB",
                  width: 6,
                  height: 6,
                },
              ]}
            />
            <View style={styles.starBadgeCircle}>
              <Ionicons name="star" size={54} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.successTitle}>
            Your Group is Created Successfully!
          </Text>
          <Text style={styles.successSub}>
            {createdGroupName || "Your Group"} is now active. You can now add
            billing cycles, record expenses, and invite roommates.
          </Text>

          <View style={{ flex: 1 }} />

          <View style={{ width: "100%", gap: 12, marginBottom: 16 }}>
            <TouchableOpacity
              style={[styles.primaryPillBtn, { width: "100%" }]}
              onPress={() => {
                if (onOpenAddExpense) {
                  onOpenAddExpense();
                } else {
                  onBack();
                }
              }}
            >
              <Text style={styles.primaryPillBtnText}>+ Add Expense</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryPillBtn,
                {
                  width: "100%",
                  backgroundColor: "#EFF6FF",
                  borderWidth: 1,
                  borderColor: "#BFDBFE",
                },
              ]}
              onPress={onBack}
            >
              <Text style={[styles.primaryPillBtnText, { color: "#2563EB" }]}>
                Back to Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW: CREATE GROUP
  // --------------------------------------------------------------------------
  if (viewMode === "create") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.circleBackBtn}
            onPress={handleBackFromCreate}
          >
            <Feather name="chevron-left" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Create Group</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Group Name</Text>
            <TextInput
              style={styles.textInput}
              value={groupNameInput}
              onChangeText={setGroupNameInput}
              placeholder="e.g. Sunshine Residence Unit 4B"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={[styles.inputGroup, { marginTop: 24 }]}>
            <Text style={styles.inputLabel}>Add Roommates</Text>
            {addedMembers.map((m) => (
              <View key={m.id} style={styles.addedMemberRow}>
                <View style={styles.memberSmallAvatar}>
                  <Text style={styles.memberSmallAvatarText}>
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.addedMemberName}>{m.name}</Text>
                <TouchableOpacity
                  onPress={() =>
                    setAddedMembers(
                      addedMembers.filter((item) => item.id !== m.id),
                    )
                  }
                >
                  <Feather name="x" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.inviteInputRow}>
              <View style={styles.inviteInnerBox}>
                <TextInput
                  style={styles.inviteTextInput}
                  placeholder="Enter Name or Phone"
                  placeholderTextColor="#94A3B8"
                  value={newMemberInput}
                  onChangeText={setNewMemberInput}
                />
              </View>
              <TouchableOpacity
                style={styles.inviteBtn}
                onPress={() => {
                  if (newMemberInput.trim()) {
                    setAddedMembers([
                      ...addedMembers,
                      { id: `m_${Date.now()}`, name: newMemberInput.trim() },
                    ]);
                    setNewMemberInput("");
                  }
                }}
              >
                <Text style={styles.inviteBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.primaryPillBtn}
            onPress={handleCreateGroup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryPillBtnText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW: JOIN GROUP
  // --------------------------------------------------------------------------
  if (viewMode === "join") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.circleBackBtn}
            onPress={handleBackFromJoin}
          >
            <Feather name="chevron-left" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Join Group</Text>
          <View style={{ width: 42 }} />
        </View>

        <View style={[styles.scrollContent, { flex: 1 }]}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Household Code or Link</Text>
            <TextInput
              style={styles.textInput}
              value={joinLinkInput}
              onChangeText={setJoinLinkInput}
              placeholder="e.g. PF-402 or hh_..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryPillBtn, { marginTop: 24 }]}
            onPress={handleJoinGroup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryPillBtnText}>Join Group</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW: EDIT GROUP
  // --------------------------------------------------------------------------
  if (viewMode === "edit") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.circleBackBtn}
            onPress={() => setViewMode("details")}
          >
            <Feather name="chevron-left" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Edit Group</Text>
          <TouchableOpacity
            style={styles.iconNavBtn}
            onPress={() => setShowMenu(true)}
          >
            <Feather name="more-vertical" size={22} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Apartment / Group Name</Text>
            <TextInput
              style={styles.textInput}
              value={editGroupName}
              onChangeText={setEditGroupName}
              placeholder="Group or Apartment Name"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={[styles.sectionRow, { marginTop: 28 }]}>
            <Text style={styles.sectionHeading}>
              Participants ({participants.length})
            </Text>
            <TouchableOpacity onPress={() => setShowInviteModal(true)}>
              <Text style={styles.sectionActionText}>+ Invite</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.participantsList}>
            {participants.map((p) => (
              <View key={p.id} style={styles.participantRow}>
                <View style={styles.participantAvatar}>
                  <Text style={styles.participantAvatarText}>{p.avatar}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.participantName}>{p.name}</Text>
                  <Text style={styles.participantRoleTag}>
                    {p.role === "HOST" ? "Host" : "Roommate"}
                  </Text>
                </View>
                {p.role !== "HOST" && (
                  <TouchableOpacity
                    style={styles.deleteParticipantBtn}
                    onPress={() => handleRemoveMember(p)}
                  >
                    <Feather name="trash-2" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.primaryPillBtn}
            onPress={handleUpdateGroup}
          >
            <Text style={styles.primaryPillBtnText}>Update Group</Text>
          </TouchableOpacity>
        </View>

        {renderMenuModal()}
        {renderInviteModal()}
      </SafeAreaView>
    );
  }

  // If no household exists, show clean empty state instead of phantom active household
  if (!householdId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.circleBackBtn} onPress={onBack}>
            <Feather name="chevron-left" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Manage Group</Text>
          <View style={{ width: 42 }} />
        </View>

        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: 22,
              backgroundColor: "#EFF6FF",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Feather name="home" size={32} color="#2563EB" />
          </View>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#0F172A",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            No Household Group
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: "#64748B",
              textAlign: "center",
              marginBottom: 28,
              lineHeight: 22,
              maxWidth: 300,
            }}
          >
            {isHost
              ? "You haven't created a household group yet. Create your group to invite roommates and organize billing cycles."
              : "You are not a member of any active household yet. Join with an invite code or contact your host."}
          </Text>
          {isHost ? (
            <TouchableOpacity
              style={styles.primaryPillBtn}
              onPress={() => setViewMode("create")}
            >
              <Text style={styles.primaryPillBtnText}>+ Create Group</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryPillBtn}
              onPress={() => setViewMode("join")}
            >
              <Text style={styles.primaryPillBtnText}>
                Join with Invite Code
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW: GROUP DETAILS (Default View - Matched to Image)
  // --------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header with Circular Back Button */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.circleBackBtn} onPress={onBack}>
          <Feather name="chevron-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Manage Group</Text>
        <TouchableOpacity
          style={styles.iconNavBtn}
          onPress={() => setShowMenu(true)}
        >
          <Feather name="more-vertical" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Group Selector Pills - Exactly matching user image */}
        <View style={styles.groupPillsContainer}>
          <TouchableOpacity style={[styles.groupPill, styles.groupPillActive]}>
            <Text style={[styles.groupPillTitle, styles.groupPillTitleActive]}>
              {currentGroupName}
            </Text>
            <Text style={[styles.groupPillSub, styles.groupPillSubActive]}>
              Active Household
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.groupPill}
            onPress={() => setViewMode("create")}
          >
            <Text style={styles.groupPillTitle}>+ New Group</Text>
            <Text style={styles.groupPillSub}>Create or Join</Text>
          </TouchableOpacity>
        </View>

        {/* Billing Cycle Section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeading}>Billing Cycle</Text>
          <TouchableOpacity onPress={() => setShowCreateCycleModal(true)}>
            <Text style={styles.sectionActionText}>+ Add Cycle</Text>
          </TouchableOpacity>
        </View>

        {cycles.length === 0 ? (
          /* Dashed Card for Empty Cycle - styled like image document upload */
          <TouchableOpacity
            style={styles.emptyCycleDashedBox}
            onPress={() => setShowCreateCycleModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.cycleIconBadge}>
              <Ionicons name="calendar-outline" size={24} color="#2563EB" />
            </View>
            <Text style={styles.emptyCycleTitle}>No Active Billing Cycle</Text>
            <Text style={styles.emptyCycleSub}>
              Tap to create a billing cycle (Cycle Name, Start & End Date) to
              calculate roommate dues and track expenses.
            </Text>
            <View style={styles.createCyclePillBtn}>
              <Text style={styles.createCyclePillBtnText}>
                + Create Billing Cycle
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          /* Horizontal Cycle Selector Pills */
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cycleChipsScroll}
            >
              {cycles.map((c) => {
                const isSelected =
                  c.billingCycleId === (activeCycle?.billingCycleId || "");
                return (
                  <TouchableOpacity
                    key={c.billingCycleId}
                    style={[
                      styles.cycleChip,
                      isSelected && styles.cycleChipActive,
                    ]}
                    onPress={() => setSelectedCycleId(c.billingCycleId)}
                  >
                    <Text
                      style={[
                        styles.cycleChipText,
                        isSelected && styles.cycleChipTextActive,
                      ]}
                    >
                      {c.name || "Cycle"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.cycleChip, { borderStyle: "dashed" }]}
                onPress={() => setShowCreateCycleModal(true)}
              >
                <Text style={[styles.cycleChipText, { color: "#2563EB" }]}>
                  + New Cycle
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Date Range Badge for Selected Cycle & Host Actions */}
            {activeCycle && (
              <View style={{ marginVertical: 10 }}>
                <View style={styles.dateRangeRow}>
                  <View style={styles.datePill}>
                    <Feather
                      name="calendar"
                      size={13}
                      color="#64748B"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.datePillText}>
                      {formatShortDate(activeCycle.startDate)}
                    </Text>
                  </View>
                  <Feather
                    name="arrow-right"
                    size={14}
                    color="#94A3B8"
                    style={{ marginHorizontal: 10 }}
                  />
                  <View style={styles.datePill}>
                    <Feather
                      name="calendar"
                      size={13}
                      color="#64748B"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.datePillText}>
                      {formatShortDate(activeCycle.endDate)}
                    </Text>
                  </View>
                </View>

                {isHost && (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 10,
                      marginTop: 4,
                    }}
                  >
                    <TouchableOpacity
                      onPress={handleOpenEditCycle}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 14,
                        backgroundColor: "#EFF6FF",
                        borderWidth: 1,
                        borderColor: "#BFDBFE",
                      }}
                    >
                      <Feather
                        name="edit-2"
                        size={12}
                        color="#2563EB"
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#2563EB",
                        }}
                      >
                        Edit Cycle
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleDeleteBillingCycle}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 14,
                        backgroundColor: "#FEF2F2",
                        borderWidth: 1,
                        borderColor: "#FECACA",
                      }}
                    >
                      <Feather
                        name="trash-2"
                        size={12}
                        color="#DC2626"
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#DC2626",
                        }}
                      >
                        Delete Cycle
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Two Metric Cards - Real Calculated Values (Zero if empty) */}
        <View style={styles.metricCardsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="wallet-outline" size={20} color="#2563EB" />
            </View>
            <Text style={styles.metricValue}>
              {formatPesos(totalDuesCents)}
            </Text>
            <Text style={styles.metricLabel}>Total Dues</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="receipt-outline" size={20} color="#2563EB" />
            </View>
            <Text style={styles.metricValue}>
              {formatPesos(totalExpenseCents)}
            </Text>
            <Text style={styles.metricLabel}>Total Expense</Text>
          </View>
        </View>

        {/* Expenses Section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeading}>
            Expenses ({currentCycleExpenses.length})
          </Text>
          <TouchableOpacity
            onPress={() =>
              onOpenAddExpense
                ? onOpenAddExpense()
                : Alert.alert("Add Expense", "Opening expense modal...")
            }
          >
            <Text style={styles.sectionActionText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.expenseBox}>
          {currentCycleExpenses.length === 0 ? (
            <View style={styles.emptyExpenseBox}>
              <Text style={styles.emptyExpenseText}>
                No expenses logged for this cycle yet.
              </Text>
              <TouchableOpacity
                style={styles.addExpenseInlineBtn}
                onPress={() =>
                  onOpenAddExpense
                    ? onOpenAddExpense()
                    : Alert.alert("Add Expense", "Opening expense modal...")
                }
              >
                <Text style={styles.addExpenseInlineBtnText}>
                  + Add First Expense
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            currentCycleExpenses.slice(0, 5).map((exp) => {
              const isExpensePaid =
                exp.status === "PAID" || exp.isPaid === true;
              return (
                <View key={exp.id} style={styles.expenseItemRow}>
                  <Text style={styles.expenseCategoryIcon}>
                    {exp.category === "Rent"
                      ? "🏠"
                      : exp.category === "Groceries"
                        ? "🛒"
                        : exp.category === "Electricity"
                          ? "⚡"
                          : exp.category === "Water"
                            ? "💧"
                            : exp.category === "Wifi" ||
                                exp.category === "Wifi Bills"
                              ? "📶"
                              : "📄"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text style={styles.expenseItemTitle}>{exp.title}</Text>
                      <View
                        style={
                          isExpensePaid
                            ? styles.statusBadgePaid
                            : styles.statusBadgeUnpaid
                        }
                      >
                        <Text
                          style={
                            isExpensePaid
                              ? styles.statusBadgeTextPaid
                              : styles.statusBadgeTextUnpaid
                          }
                        >
                          {isExpensePaid ? "PAID" : "UNPAID"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.expenseItemSub}>
                      {isExpensePaid
                        ? `${exp.payerName || "Household"} • Paid`
                        : `Unpaid Bill • Added by ${exp.payerName || "Host"}`}{" "}
                      • {formatShortDate(exp.date)}
                    </Text>
                  </View>
                  <Text style={styles.expenseItemAmount}>
                    {formatPesos(exp.amountCents)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Total Participants Section */}
        <View style={[styles.sectionRow, { marginTop: 24 }]}>
          <Text style={styles.sectionHeading}>
            Total Participants ({participants.length})
          </Text>
          <TouchableOpacity onPress={() => setShowInviteModal(true)}>
            <Text style={styles.sectionActionText}>+ Invite</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.participantsList}>
          {participants.length === 0 ? (
            <View style={styles.emptyExpenseBox}>
              <Text style={styles.emptyExpenseText}>
                No roommates added yet.
              </Text>
            </View>
          ) : (
            participants.map((p) => (
              <View key={p.id} style={styles.participantRow}>
                <View style={styles.participantAvatar}>
                  <Text style={styles.participantAvatarText}>{p.avatar}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={styles.participantName}>{p.name}</Text>
                    {p.role === "HOST" && (
                      <View style={styles.hostBadge}>
                        <Text style={styles.hostBadgeText}>HOST</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.statusDotRow}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            p.status === "Settled" ? "#10B981" : "#F43F5E",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: p.status === "Settled" ? "#059669" : "#E11D48",
                        },
                      ]}
                    >
                      {p.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.participantOwesText}>
                  {p.owesCents > 0
                    ? `Owes ${formatPesos(p.owesCents)}`
                    : "Settled"}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom Floating Bar */}
      <View style={styles.bottomBar}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            style={[styles.primaryPillBtn, { flex: 1 }]}
            onPress={() => setViewMode("edit")}
          >
            <Feather
              name="edit-2"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.primaryPillBtnText}>Edit Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryPillBtn, { flex: 1 }]}
            onPress={handleCopyInviteCode}
          >
            <Feather
              name="share-2"
              size={16}
              color="#2563EB"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.secondaryPillBtnText}>Invite Code</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL: Create Billing Cycle */}
      {renderCreateCycleModal()}

      {/* MODAL: Edit Billing Cycle */}
      {renderEditCycleModal()}

      {/* MODAL: Invite Roommate */}
      {renderInviteModal()}

      {/* MODAL: Menu Actions */}
      {renderMenuModal()}
    </SafeAreaView>
  );

  function renderCreateCycleModal() {
    return (
      <Modal
        visible={showCreateCycleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateCycleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Create Billing Cycle</Text>
              <TouchableOpacity onPress={() => setShowCreateCycleModal(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetSub}>
              Set up a billing cycle (e.g. monthly) to track rent, electricity,
              and water dues for your apartment.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cycle Name</Text>
              <TextInput
                style={styles.textInput}
                value={cycleNameInput}
                onChangeText={setCycleNameInput}
                placeholder="e.g. October 2026 Cycle"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  value={cycleStartInput}
                  onChangeText={setCycleStartInput}
                  placeholder="2026-10-01"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  value={cycleEndInput}
                  onChangeText={setCycleEndInput}
                  placeholder="2026-10-31"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryPillBtn, { marginTop: 24 }]}
              onPress={handleCreateBillingCycle}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryPillBtnText}>Create Cycle</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  function renderEditCycleModal() {
    return (
      <Modal
        visible={showEditCycleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditCycleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit Billing Cycle</Text>
              <TouchableOpacity onPress={() => setShowEditCycleModal(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetSub}>
              Update the name, duration dates, or billing status of this cycle.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cycle Name</Text>
              <TextInput
                style={styles.textInput}
                value={editCycleName}
                onChangeText={setEditCycleName}
                placeholder="e.g. October 2026 Cycle"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  value={editCycleStart}
                  onChangeText={setEditCycleStart}
                  placeholder="2026-10-01"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  value={editCycleEnd}
                  onChangeText={setEditCycleEnd}
                  placeholder="2026-10-31"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text style={styles.inputLabel}>Status</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                {["ACTIVE", "FINALIZED", "ARCHIVED"].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      borderRadius: 12,
                      alignItems: "center",
                      backgroundColor:
                        editCycleStatus === status ? "#EFF6FF" : "#F8FAFC",
                      borderWidth: 1,
                      borderColor:
                        editCycleStatus === status ? "#2563EB" : "#E2E8F0",
                    }}
                    onPress={() => setEditCycleStatus(status)}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color:
                          editCycleStatus === status ? "#2563EB" : "#64748B",
                      }}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryPillBtn, { marginTop: 24 }]}
              onPress={handleUpdateBillingCycle}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryPillBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  function renderInviteModal() {
    return (
      <Modal
        visible={showInviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Invite Roommate</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Roommate Name</Text>
              <TextInput
                style={styles.textInput}
                value={inviteName}
                onChangeText={setInviteName}
                placeholder="e.g. John Doe"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text style={styles.inputLabel}>Email or Phone (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={inviteContact}
                onChangeText={setInviteContact}
                placeholder="e.g. roommate@email.com or +63 912..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryPillBtn, { marginTop: 24 }]}
              onPress={handleInviteRoommate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryPillBtnText}>Send Invitation</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  function renderMenuModal() {
    return (
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuCard}>
            <Text style={styles.menuHeader}>Group Options</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setViewMode("edit");
              }}
            >
              <Feather name="edit-3" size={18} color="#0F172A" />
              <Text style={styles.menuItemText}>Edit Apartment & Members</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setShowCreateCycleModal(true);
              }}
            >
              <Feather name="calendar" size={18} color="#0F172A" />
              <Text style={styles.menuItemText}>Create New Billing Cycle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setViewMode("create");
              }}
            >
              <Feather name="plus-circle" size={18} color="#0F172A" />
              <Text style={styles.menuItemText}>Create Another Group</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setViewMode("join");
              }}
            >
              <Feather name="link" size={18} color="#0F172A" />
              <Text style={styles.menuItemText}>Join with Code or Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleCopyInviteCode}
            >
              <Feather name="copy" size={18} color="#2563EB" />
              <Text
                style={[
                  styles.menuItemText,
                  { color: "#2563EB", fontWeight: "700" },
                ]}
              >
                Copy Household Code
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  navBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  circleBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  // Top Group Selector Pills - Exactly matching screenshot
  groupPillsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  groupPill: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  groupPillActive: {
    backgroundColor: "#2563EB",
  },
  groupPillTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
  },
  groupPillTitleActive: {
    color: "#FFFFFF",
  },
  groupPillSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  groupPillSubActive: {
    color: "rgba(255,255,255,0.85)",
  },
  // Cycle chips
  cycleChipsScroll: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 8,
  },
  cycleChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cycleChipActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  cycleChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  cycleChipTextActive: {
    color: "#2563EB",
  },
  // Empty Cycle Dashed Box
  emptyCycleDashedBox: {
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 20,
    alignItems: "center",
    marginVertical: 8,
  },
  cycleIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyCycleTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 6,
  },
  emptyCycleSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 14,
  },
  createCyclePillBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createCyclePillBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  // Metric Cards
  metricCardsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  expenseBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  emptyExpenseBox: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyExpenseText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  addExpenseInlineBtn: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 10,
  },
  addExpenseInlineBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },
  expenseItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  expenseCategoryIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  expenseItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  expenseItemSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  expenseItemAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563EB",
    marginLeft: 8,
  },
  statusBadgeUnpaid: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  statusBadgeTextUnpaid: {
    color: "#B91C1C",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusBadgePaid: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  statusBadgeTextPaid: {
    color: "#047857",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  participantsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  participantAvatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#334155",
  },
  participantName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  hostBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  hostBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#1E40AF",
  },
  participantRoleTag: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  participantOwesText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
  },
  deleteParticipantBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  primaryPillBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  primaryPillBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryPillBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  secondaryPillBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563EB",
  },
  inputGroup: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  addedMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  memberSmallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  memberSmallAvatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  addedMemberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  inviteInputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  inviteInnerBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  inviteTextInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  inviteBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  badgeWrapper: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 28,
  },
  starBadgeCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  sparkleDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 10,
  },
  successSub: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  sheetSub: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  menuHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
});
