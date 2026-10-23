import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SmoothBottomSheetModal } from "./SmoothBottomSheetModal";
import { useTheme } from "../context/ThemeContext";

export interface OfflineCallPromptModalProps {
  visible: boolean;
  onClose: () => void;
  contactName: string;
  contactAvatar?: string;
  lastActiveLabel?: string;
  callType: "voice" | "video";
  onRingAnyway: () => void;
  onSendMessage: () => void;
}

export const OfflineCallPromptModal: React.FC<OfflineCallPromptModalProps> = ({
  visible,
  onClose,
  contactName,
  contactAvatar,
  lastActiveLabel = "Offline",
  callType,
  onRingAnyway,
  onSendMessage,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const initials = contactName
    ? contactName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "R";

  const isVideo = callType === "video";
  const firstName = contactName.split(" ")[0] || "Contact";

  return (
    <SmoothBottomSheetModal
      visible={visible}
      onClose={onClose}
      title={`${firstName} is Offline`}
      subtitle={`Last seen ${lastActiveLabel.toLowerCase().replace("active ", "")}.`}
      icon={<Feather name="moon" size={20} color="#F59E0B" />}
      maxHeight="80%"
      showChipBar={true}
    >
      <View
        style={[
          styles.contentContainer,
          {
            paddingBottom: Math.max(insets.bottom, 20) + 12,
          },
        ]}
      >
        {/* Contact Info Card */}
        <View
          style={[
            styles.contactCard,
            {
              backgroundColor: isDark ? "#181A20" : "#F8FAFC",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
            },
          ]}
        >
          {/* Avatar with offline indicator */}
          <View style={styles.avatarWrap}>
            {contactAvatar ? (
              <Image source={{ uri: contactAvatar }} style={styles.avatarImg} />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  { backgroundColor: isDark ? "#242731" : "#E2E8F0" },
                ]}
              >
                <Text
                  style={[
                    styles.avatarFallbackText,
                    { color: isDark ? "#60A5FA" : "#2563EB" },
                  ]}
                >
                  {initials}
                </Text>
              </View>
            )}
            <View style={styles.offlineStatusDot}>
              <View style={styles.offlineStatusInner} />
            </View>
          </View>

          <View style={styles.contactDetails}>
            <Text
              style={[
                styles.contactNameText,
                { color: isDark ? "#FFFFFF" : "#0F172A" },
              ]}
              numberOfLines={1}
            >
              {contactName}
            </Text>
            <View style={styles.presenceRow}>
              <Feather name="clock" size={13} color="#F59E0B" />
              <Text style={styles.presenceText}>{lastActiveLabel}</Text>
            </View>
          </View>
        </View>

        {/* Informative Guidance */}
        <View
          style={[
            styles.noticeBox,
            {
              backgroundColor: isDark ? "rgba(245, 158, 11, 0.08)" : "#FFFBEB",
              borderColor: isDark ? "rgba(245, 158, 11, 0.2)" : "#FDE68A",
            },
          ]}
        >
          <Feather
            name="alert-circle"
            size={18}
            color="#D97706"
            style={{ marginTop: 2 }}
          />
          <Text
            style={[
              styles.noticeText,
              { color: isDark ? "#FDE68A" : "#92400E" },
            ]}
          >
            {firstName} is not actively in the app. You can leave a direct chat
            message, or ring anyway to dispatch a high-priority push
            notification to their device.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsColumn}>
          {/* Send Message (Primary Action) */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={onSendMessage}
            activeOpacity={0.85}
            accessibilityLabel="Send Message"
          >
            <Ionicons name="chatbubble-ellipses" size={19} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Send Message Instead</Text>
          </TouchableOpacity>

          {/* Ring Anyway (High-priority alert) */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.secondaryBtn,
              {
                backgroundColor: isDark ? "#242731" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.14)" : "#CBD5E1",
              },
            ]}
            onPress={onRingAnyway}
            activeOpacity={0.8}
            accessibilityLabel="Ring Anyway"
          >
            <Ionicons
              name={isVideo ? "videocam" : "call"}
              size={18}
              color={isDark ? "#93C5FD" : "#2563EB"}
            />
            <Text
              style={[
                styles.secondaryBtnText,
                { color: isDark ? "#FFFFFF" : "#0F172A" },
              ]}
            >
              Ring Anyway (Push Wakeup)
            </Text>
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Cancel Call"
          >
            <Text
              style={[
                styles.cancelBtnText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SmoothBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 4,
    gap: 16,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  avatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    position: "relative",
  },
  avatarImg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    resizeMode: "cover",
  },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 20,
    fontWeight: "700",
  },
  offlineStatusDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  offlineStatusInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F59E0B",
  },
  contactDetails: {
    flex: 1,
    gap: 4,
  },
  contactNameText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  presenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  presenceText: {
    fontSize: 13,
    color: "#F59E0B",
    fontWeight: "600",
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  actionsColumn: {
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryBtn: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryBtn: {
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  cancelBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
