import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { updateService, UpdateSyncStatus } from "../services/updateService";
import { VersionGateEvaluation } from "../utils/versionUtils";

interface AppUpdateGateModalProps {
  visible: boolean;
  evaluation: VersionGateEvaluation;
  onDismissOptional?: () => void;
}

export const AppUpdateGateModal: React.FC<AppUpdateGateModalProps> = ({
  visible,
  evaluation,
  onDismissOptional,
}) => {
  const { isDark, colors } = useTheme();
  const [updatingOta, setUpdatingOta] = useState(false);
  const [otaStatusText, setOtaStatusText] = useState("");
  const [otaErrorNotice, setOtaErrorNotice] = useState<string | null>(null);

  const {
    isMandatory,
    currentVersion,
    targetVersion,
    releaseTitle,
    releaseNotes,
    apkDownloadUrl,
  } = evaluation;

  // Subscribe to updateService status changes
  useEffect(() => {
    const unsub = updateService.subscribeStatus((status: UpdateSyncStatus) => {
      if (status === "checking") {
        setOtaStatusText("Checking Over-The-Air release channels...");
      } else if (status === "downloading") {
        setOtaStatusText("Downloading latest app update...");
      } else if (status === "reloading") {
        setOtaStatusText("Applying updates & restarting Splitzy...");
      } else if (status === "idle") {
        // idle
      }
    });
    return unsub;
  }, []);

  const handleUpdateOta = async () => {
    setUpdatingOta(true);
    setOtaErrorNotice(null);
    setOtaStatusText("Checking Over-The-Air update...");

    try {
      const res = await updateService.checkForUpdateManually();
      if (res.available) {
        setOtaStatusText("Update downloaded! Applying immediately...");
        await new Promise((r) => setTimeout(r, 400));
        await updateService.applyUpdateNow();
      } else {
        setOtaErrorNotice(
          res.error ||
            "No JavaScript OTA bundle detected for this version. Please tap 'Download APK' below to install the full package.",
        );
      }
    } catch (err: any) {
      setOtaErrorNotice(
        err?.message ||
          "Failed to fetch OTA update. Please use the direct APK download link below.",
      );
    } finally {
      setUpdatingOta(false);
    }
  };

  const handleOpenApkDownload = async () => {
    const fallbackUrl = "https://github.com/splitzy-app/releases/latest";
    const targetUrl = (apkDownloadUrl || "").trim() || fallbackUrl;

    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (canOpen) {
        await Linking.openURL(targetUrl);
      } else {
        Alert.alert(
          "Download Link",
          `Please visit the following URL in your browser to download the update:\n\n${targetUrl}`,
          [{ text: "OK" }],
        );
      }
    } catch (e: any) {
      Alert.alert(
        "Open Browser Error",
        `Could not open download link: ${e?.message || "Unknown error"}. URL: ${targetUrl}`,
      );
    }
  };

  // Default release highlights if not provided in Super Admin
  const defaultNotes = [
    "Centavo precision bill distribution & automatic balance reconciliation",
    "Real-time social stories, posts, and instant push notification delivery",
    "Enhanced security gate & performance upgrades across all views",
  ];

  const parsedNotes =
    releaseNotes && releaseNotes.trim().length > 0
      ? releaseNotes
          .split("\n")
          .map((line) => line.replace(/^[-*•]\s*/, "").trim())
          .filter(Boolean)
      : defaultNotes;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Prevent Android hardware back button from closing mandatory modal
      onRequestClose={() => {
        if (!isMandatory && onDismissOptional) {
          onDismissOptional();
        }
      }}
    >
      <View style={styles.overlay}>
        {/* Backdrop: only clickable if optional update */}
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={() => {
            if (!isMandatory && onDismissOptional) {
              onDismissOptional();
            }
          }}
        />

        {/* Bottom Sheet Card */}
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              borderColor: isDark ? "#1E293B" : "#E2E8F0",
            },
          ]}
        >
          {/* Top Drag Handle */}
          <View
            style={[
              styles.dragHandle,
              { backgroundColor: isDark ? "#334155" : "#CBD5E1" },
            ]}
          />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Status Pill Badge & Icon */}
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: isMandatory
                      ? "rgba(225, 29, 72, 0.15)"
                      : "rgba(37, 99, 235, 0.15)",
                  },
                ]}
              >
                <Ionicons
                  name={isMandatory ? "warning" : "sparkles"}
                  size={24}
                  color={isMandatory ? "#E11D48" : "#2563EB"}
                />
              </View>

              <View style={styles.headerTitles}>
                <View
                  style={[
                    styles.urgencyBadge,
                    {
                      backgroundColor: isMandatory
                        ? "rgba(225, 29, 72, 0.12)"
                        : "rgba(37, 99, 235, 0.12)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.urgencyBadgeText,
                      { color: isMandatory ? "#E11D48" : "#2563EB" },
                    ]}
                  >
                    {isMandatory
                      ? "CRITICAL UPDATE REQUIRED"
                      : "NEW UPDATE AVAILABLE"}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.sheetTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  {releaseTitle || `Splitzy v${targetVersion} is Ready`}
                </Text>

                {/* Clean unboxed version comparison */}
                <View style={styles.versionRow}>
                  <Text
                    style={[
                      styles.versionText,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    Installed:{" "}
                    <Text
                      style={{
                        color: isDark ? "#CBD5E1" : "#334155",
                        fontWeight: "700",
                      }}
                    >
                      v{currentVersion}
                    </Text>
                  </Text>
                  <Text
                    style={[
                      styles.versionSeparator,
                      { color: isDark ? "#475569" : "#CBD5E1" },
                    ]}
                  >
                    ·
                  </Text>
                  <Text
                    style={[
                      styles.versionText,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    Target:{" "}
                    <Text
                      style={{
                        color: isMandatory ? "#E11D48" : "#2563EB",
                        fontWeight: "800",
                      }}
                    >
                      v{targetVersion}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* Mandatory Blocking Notice */}
            {isMandatory && (
              <View
                style={[
                  styles.blockingNoticeBox,
                  {
                    backgroundColor: isDark
                      ? "rgba(225, 29, 72, 0.08)"
                      : "rgba(225, 29, 72, 0.06)",
                    borderColor: isDark
                      ? "rgba(225, 29, 72, 0.2)"
                      : "rgba(225, 29, 72, 0.15)",
                  },
                ]}
              >
                <Feather name="shield" size={14} color="#E11D48" />
                <Text style={styles.blockingNoticeText}>
                  This update contains essential database schema, security, and
                  billing calculations. You must update to continue using
                  Splitzy.
                </Text>
              </View>
            )}

            {/* Release Highlights Section */}
            <View
              style={[
                styles.highlightsCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
            >
              <View style={styles.highlightsHeader}>
                <Feather
                  name="zap"
                  size={14}
                  color={isDark ? "#38BDF8" : "#0284C7"}
                />
                <Text
                  style={[
                    styles.highlightsHeading,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  What's New in this Version:
                </Text>
              </View>

              {parsedNotes.map((note, index) => (
                <View key={index} style={styles.bulletRow}>
                  <View
                    style={[
                      styles.bulletPoint,
                      {
                        backgroundColor: isMandatory ? "#E11D48" : "#2563EB",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.bulletText,
                      { color: isDark ? "#CBD5E1" : "#334155" },
                    ]}
                  >
                    {note}
                  </Text>
                </View>
              ))}
            </View>

            {/* OTA Status / Loading Spinner */}
            {updatingOta && (
              <View
                style={[
                  styles.otaProgressBox,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#EFF6FF",
                    borderColor: "#3B82F6",
                  },
                ]}
              >
                <ActivityIndicator size="small" color="#2563EB" />
                <Text
                  style={[
                    styles.otaProgressText,
                    { color: isDark ? "#93C5FD" : "#1D4ED8" },
                  ]}
                >
                  {otaStatusText || "Fetching update..."}
                </Text>
              </View>
            )}

            {/* OTA Notice / Fallback Error */}
            {Boolean(otaErrorNotice) && (
              <View
                style={[
                  styles.errorNoticeBox,
                  {
                    backgroundColor: isDark
                      ? "rgba(245, 158, 11, 0.1)"
                      : "rgba(245, 158, 11, 0.08)",
                  },
                ]}
              >
                <Feather name="info" size={14} color="#D97706" />
                <Text style={styles.errorNoticeText}>{otaErrorNotice}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionSection}>
              {/* Primary In-App OTA Update Button */}
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: isMandatory ? "#E11D48" : "#2563EB",
                    opacity: updatingOta ? 0.7 : 1,
                  },
                ]}
                onPress={handleUpdateOta}
                disabled={updatingOta}
                activeOpacity={0.8}
              >
                {updatingOta ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-download" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>
                      Update Now (In-App)
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Secondary Download APK Button */}
              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                    borderColor: isDark ? "#334155" : "#CBD5E1",
                  },
                ]}
                onPress={handleOpenApkDownload}
                activeOpacity={0.8}
              >
                <Feather
                  name="external-link"
                  size={16}
                  color={isDark ? "#F8FAFC" : "#0F172A"}
                />
                <Text
                  style={[
                    styles.secondaryBtnText,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Download APK Package
                </Text>
              </TouchableOpacity>

              {/* Optional Update Dismiss */}
              {!isMandatory && onDismissOptional && (
                <TouchableOpacity
                  style={styles.laterBtn}
                  onPress={onDismissOptional}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.laterBtnText,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    Remind Me Later
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  backdropTouch: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: Platform.OS === "android" ? 24 : 34,
    maxHeight: "85%",
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  headerTitles: {
    flex: 1,
    gap: 4,
  },
  urgencyBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgencyBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  versionText: {
    fontSize: 12,
  },
  versionSeparator: {
    fontSize: 12,
    fontWeight: "bold",
  },
  blockingNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  blockingNoticeText: {
    fontSize: 11.5,
    color: "#E11D48",
    fontWeight: "600",
    flex: 1,
    lineHeight: 16,
  },
  highlightsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  highlightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  highlightsHeading: {
    fontSize: 13,
    fontWeight: "700",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  bulletText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  otaProgressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  otaProgressText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  errorNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  errorNoticeText: {
    fontSize: 11.5,
    color: "#D97706",
    flex: 1,
    lineHeight: 16,
  },
  actionSection: {
    gap: 10,
    marginTop: 6,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  laterBtn: {
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  laterBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
