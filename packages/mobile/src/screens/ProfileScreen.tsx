import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavVisibility } from "../context/NavVisibilityContext";

interface ProfileScreenProps {
  onOpenManageGroup?: (mode?: "details" | "create" | "join") => void;
  onOpenReports?: () => void;
  onOpenOnboarding?: () => void;
  onOpenHostApplication?: () => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; email: string };
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
}) => {
  const { onScroll } = useNavVisibility();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Text style={styles.title}>Account & Settings</Text>

        <View style={styles.profileHero}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {currentUser.name.charAt(0) || "R"}
            </Text>
          </View>
          <Text style={styles.profileName}>{currentUser.name}</Text>
          <Text style={styles.profileRole}>{currentUser.role}</Text>
          <Text style={styles.profileEmail}>{currentUser.email}</Text>
        </View>

        <Text style={styles.sectionHeader}>Household & Roles</Text>
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={onOpenHostApplication}
          >
            <View>
              <Text style={styles.menuItemText}>Apply for Host Status</Text>
              <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                Request Super Admin approval to manage household
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onOpenManageGroup && onOpenManageGroup("join")}
          >
            <View>
              <Text style={styles.menuItemText}>Join Household with Code</Text>
              <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                Enter invite code or group ID shared by your Host
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onOpenManageGroup && onOpenManageGroup("details")}
          >
            <Text style={styles.menuItemText}>Manage Household & Members</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenReports}>
            <Text style={styles.menuItemText}>Monthly Summary & Reports</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenOnboarding}>
            <Text style={styles.menuItemText}>Welcome & Onboarding Guide</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>System & Preferences</Text>
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert(
                "Notifications",
                "Push notifications are connected through Expo and Firebase.",
              )
            }
          >
            <Text style={styles.menuItemText}>Push Notifications</Text>
            <Text style={styles.versionTag}>Active</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert(
                "Firebase Storage",
                "Firebase Storage is active for receipts and documents.",
              )
            }
          >
            <Text style={styles.menuItemText}>Cloud Storage</Text>
            <Text style={styles.versionTag}>Connected</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert("App Version", "PropertyFlow / Splitzy Mobile v1.0.0")
            }
          >
            <Text style={styles.menuItemText}>App Version</Text>
            <Text style={styles.versionTag}>v1.0.0</Text>
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
    marginBottom: 20,
  },
  profileHero: { alignItems: "center", marginBottom: 24 },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarLargeText: { fontSize: 32, fontWeight: "bold", color: "#2563EB" },
  profileName: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  profileRole: { fontSize: 12, color: "#64748B", marginTop: 2 },
  profileEmail: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuSection: {
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  menuItemText: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  chevron: { fontSize: 18, color: "#94A3B8" },
  versionTag: { fontSize: 11, fontWeight: "bold", color: "#10B981" },
  signOutBtn: {
    marginTop: 24,
    backgroundColor: "#FEE2E2",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  signOutBtnText: { color: "#DC2626", fontSize: 14, fontWeight: "800" },
});
