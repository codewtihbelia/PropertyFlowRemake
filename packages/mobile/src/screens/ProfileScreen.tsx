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
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UniversalLoader } from "../components/UniversalLoader";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { auth } from "../firebase/config";
import { mobileDataService } from "../services/firebaseDataService";
import { uploadImageToCloudinaryMobile } from "../services/cloudinaryService";

interface ProfileScreenProps {
  onOpenManageGroup?: (mode?: "details" | "create" | "join") => void;
  onOpenReports?: () => void;
  onOpenOnboarding?: () => void;
  onOpenHostApplication?: () => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; email: string };
  onLoaded?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onOpenManageGroup,
  onOpenReports,
  onOpenOnboarding,
  onOpenHostApplication,
  onSignOut,
  currentUser = {
    name: "Resident",
    role: "Member",
    email: "",
  },
  onLoaded,
}) => {
  const { onScroll } = useNavVisibility();
  const firebaseUser = auth.currentUser;
  const cachedProfile = mobileDataService.getCachedProfile(firebaseUser?.uid);

  const [profile, setProfile] = useState<any | null>(() => cachedProfile);
  const [household, setHousehold] = useState<any | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [loading, setLoading] = useState(true);

  const updateLoading = (val: boolean) => {
    setLoading(val);
    if (!val) {
      onLoaded?.();
    }
  };

  // Fallback safety timer
  useEffect(() => {
    const timer = setTimeout(() => {
      updateLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!firebaseUser?.uid) {
      updateLoading(false);
      return;
    }
    mobileDataService.getUserProfile(firebaseUser.uid).then((p) => {
      if (p) {
        setProfile(p);
        setDisplayNameInput(p.displayName || currentUser.name);
        updateLoading(false);
      }
    });

    const unsub = mobileDataService.listenToUserProfile(
      firebaseUser.uid,
      (p) => {
        if (p) {
          setProfile(p);
          setDisplayNameInput(p.displayName || currentUser.name);
          updateLoading(false);
        }
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
    profile?.displayName || firebaseUser?.displayName || currentUser.name;
  const userEmail = profile?.email || firebaseUser?.email || currentUser.email;
  const userRole = isHostUser ? "Host / Payor" : "Household Resident";
  const photoUrl = profile?.profilePicture || firebaseUser?.photoURL;

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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const handleSaveName = async () => {
    const clean = displayNameInput.trim();
    if (!clean || !firebaseUser?.uid) return;
    try {
      await mobileDataService.saveUserProfile({
        uid: firebaseUser.uid,
        displayName: clean,
      });
      setEditingName(false);
      Alert.alert("Updated", "Your name has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update name.");
    }
  };

  if (loading && !onLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "transparent" }}>
        <StatusBar
          barStyle="dark-content"
          translucent={true}
          backgroundColor="transparent"
        />
        <UniversalLoader
          text="Loading settings..."
          subtitle="Preparing profile details..."
          transparent={true}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Text style={styles.title}>Account & Settings</Text>

        {/* Join Request Pending Notice */}
        {profile?.joinRequestStatus === "PENDING" && (
          <View style={styles.noticeCardPending}>
            <View style={styles.noticeIconWrapPending}>
              <Feather name="clock" size={20} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitlePending}>
                Join Request Awaiting Host Approval
              </Text>
              <Text style={styles.noticeSubtitlePending}>
                You entered an invite code for{" "}
                {profile.pendingHouseholdName || "the household"}. The host must
                approve your request before you can join.
              </Text>
            </View>
          </View>
        )}

        {/* Join Request Rejected Notice */}
        {profile?.joinRequestStatus === "REJECTED" && (
          <View style={styles.noticeCardRejected}>
            <View style={styles.noticeIconWrapRejected}>
              <Feather name="alert-circle" size={20} color="#BE123C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitleRejected}>
                Join Request Declined
              </Text>
              <Text style={styles.noticeSubtitleRejected}>
                Reason: {profile.joinRejectionReason || "Declined by host"}. You
                can contact the host or try a different invite code.
              </Text>
            </View>
          </View>
        )}

        {/* Profile Hero Card with Avatar Upload */}
        <View style={styles.profileHero}>
          <View style={styles.avatarWrap}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.avatarLargeImage}
              />
            ) : (
              <View style={styles.avatarLargeFallback}>
                <Text style={styles.avatarLargeText}>
                  {displayName.charAt(0).toUpperCase() || "R"}
                </Text>
              </View>
            )}

            {/* Camera Upload Button */}
            <TouchableOpacity
              style={styles.cameraBadgeButton}
              activeOpacity={0.85}
              disabled={uploadingPhoto}
              onPress={handlePickAndUploadPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="camera" size={15} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Change Photo Pill Button */}
          <TouchableOpacity
            style={styles.changePhotoPill}
            activeOpacity={0.85}
            disabled={uploadingPhoto}
            onPress={handlePickAndUploadPhoto}
          >
            <Feather name="upload-cloud" size={13} color="#0F172A" />
            <Text style={styles.changePhotoPillText}>
              {uploadingPhoto ? "Uploading to Cloudinary..." : "Change Photo"}
            </Text>
          </TouchableOpacity>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={displayNameInput}
                onChangeText={setDisplayNameInput}
                autoFocus
              />
              <TouchableOpacity
                style={styles.saveNameBtn}
                onPress={handleSaveName}
              >
                <Feather name="check" size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelNameBtn}
                onPress={() => {
                  setDisplayNameInput(displayName);
                  setEditingName(false);
                }}
              >
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.nameRow}
              onPress={() => setEditingName(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.profileName}>{displayName}</Text>
              <Feather
                name="edit-2"
                size={14}
                color="#94A3B8"
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          )}

          <Text style={styles.profileRole}>{userRole}</Text>
          {userEmail ? (
            <Text style={styles.profileEmail}>{userEmail}</Text>
          ) : null}
        </View>

        <Text style={styles.sectionHeader}>Household & Roles</Text>
        <View style={styles.menuSection}>
          {!isHostUser && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={onOpenHostApplication}
            >
              <View style={styles.menuIconBox}>
                <Feather name="shield" size={17} color="#0F172A" />
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.menuItemText}>Apply for Host Status</Text>
                <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                  Request Super Admin approval to create and manage households
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onOpenManageGroup && onOpenManageGroup("join")}
          >
            <View style={styles.menuIconBox}>
              <Feather name="user-plus" size={17} color="#0F172A" />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.menuItemText}>Join Household with Code</Text>
              <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                Submit invite code to host for approval
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onOpenManageGroup && onOpenManageGroup("details")}
          >
            <View style={styles.menuIconBox}>
              <Feather name="users" size={17} color="#0F172A" />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.menuItemText}>
                Manage Household & Members
              </Text>
              <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                View roommates, host details, and approve pending requests
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenReports}>
            <View style={styles.menuIconBox}>
              <Feather name="bar-chart-2" size={17} color="#0F172A" />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.menuItemText}>Monthly Summary & Reports</Text>
              <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                Expense breakdowns and settlement logs
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenOnboarding}>
            <View style={styles.menuIconBox}>
              <Feather name="book-open" size={17} color="#0F172A" />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.menuItemText}>
                Welcome & Onboarding Guide
              </Text>
              <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                How split expenses and approvals work
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>System & Cloud Sync</Text>
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert(
                "Cloudinary Synced",
                "Profile pictures are synced between Web and Mobile using Cloudinary.",
              )
            }
          >
            <View style={styles.menuIconBox}>
              <Feather name="cloud" size={17} color="#0F172A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Cloudinary Image Storage</Text>
            </View>
            <Text style={styles.versionTag}>Connected</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert(
                "Firebase Firestore",
                "Realtime synchronization is active for expenses, households, and member approvals.",
              )
            }
          >
            <View style={styles.menuIconBox}>
              <Feather name="database" size={17} color="#0F172A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Firestore Sync</Text>
            </View>
            <Text style={styles.versionTag}>Active</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert("App Version", "Splitzy / PropertyFlow Mobile v1.1.0")
            }
          >
            <View style={styles.menuIconBox}>
              <Feather name="info" size={17} color="#0F172A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>App Version</Text>
            </View>
            <Text style={styles.versionTag}>v1.1.0</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 20, paddingBottom: 85 },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 18,
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
    marginBottom: 20,
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
    marginBottom: 20,
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

  profileHero: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 10,
  },
  avatarLargeImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "#EFF6FF",
  },
  avatarLargeFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#EFF6FF",
  },
  avatarLargeText: { fontSize: 36, fontWeight: "900", color: "#FFFFFF" },
  cameraBadgeButton: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 3,
  },
  changePhotoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    marginBottom: 14,
  },
  changePhotoPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nameEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#2563EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  saveNameBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    padding: 6,
  },
  cancelNameBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 6,
  },
  profileName: { fontSize: 19, fontWeight: "900", color: "#0F172A" },
  profileRole: {
    fontSize: 12,
    color: "#2563EB",
    marginTop: 4,
    fontWeight: "700",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  profileEmail: { fontSize: 12, color: "#94A3B8", marginTop: 6 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    marginTop: 8,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  menuSection: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#F8FAFC",
  },
  menuItemText: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  chevron: { fontSize: 20, color: "#94A3B8" },
  versionTag: { fontSize: 11, fontWeight: "bold", color: "#10B981" },
  signOutBtn: {
    marginTop: 14,
    backgroundColor: "#FEE2E2",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  signOutBtnText: { color: "#DC2626", fontSize: 14, fontWeight: "800" },
});
