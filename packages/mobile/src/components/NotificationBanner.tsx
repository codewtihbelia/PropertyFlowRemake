import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import {
  notificationService,
  NotificationPermissionStatus,
} from "../services/notificationService";
import { playMessengerPopChime } from "../utils/soundEffects";

interface NotificationBannerProps {
  onNotificationGranted?: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  onNotificationGranted,
}) => {
  const { isDark } = useTheme();
  const [permission, setPermission] =
    useState<NotificationPermissionStatus>("default");
  const [isDismissed, setIsDismissed] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showTestSuccess, setShowTestSuccess] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const status = notificationService.checkPermission();
    setPermission(status);

    if (
      status === "granted" ||
      status === "denied" ||
      status === "unsupported"
    ) {
      setIsDismissed(true);
      return;
    }

    const dismissed = await notificationService.isBannerDismissed();
    setIsDismissed(dismissed);
  };

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const res = await notificationService.requestPermission();
      setPermission(res);
      if (res === "granted") {
        playMessengerPopChime();
        await notificationService.sendTestNotification();
        setShowTestSuccess(true);
        setTimeout(() => {
          setIsDismissed(true);
          notificationService.setBannerDismissed(true);
        }, 3500);
        if (onNotificationGranted) {
          onNotificationGranted();
        }
      } else if (res === "denied") {
        setIsDismissed(true);
      }
    } catch (e) {
      console.warn("Failed to request notifications:", e);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = async () => {
    setIsDismissed(true);
    await notificationService.setBannerDismissed(true);
  };

  const handleSendTest = async () => {
    playMessengerPopChime();
    await notificationService.sendTestNotification();
    setShowTestSuccess(true);
    setTimeout(() => setShowTestSuccess(false), 3000);
  };

  // If already granted, don't show the setup banner
  if (isDismissed && permission !== "granted") {
    return null;
  }

  // If dismissed or granted without test mode, don't show
  if (isDismissed) {
    return null;
  }

  return (
    <View
      style={[
        styles.bannerCard,
        {
          backgroundColor: isDark ? "#1E222B" : "#EFF6FF",
          borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#BFDBFE",
        },
      ]}
    >
      <View style={styles.contentRow}>
        {/* Left Icon Badge */}
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: isDark ? "rgba(37, 99, 235, 0.25)" : "#DBEAFE",
            },
          ]}
        >
          <Ionicons
            name="notifications"
            size={22}
            color={isDark ? "#60A5FA" : "#2563EB"}
          />
        </View>

        {/* Text info */}
        <View style={styles.textColumn}>
          <Text
            style={[
              styles.bannerTitle,
              { color: isDark ? "#FFFFFF" : "#0F172A" },
            ]}
          >
            {showTestSuccess
              ? "Push Notifications Active! 🔔"
              : "Enable Phone Notifications"}
          </Text>
          <Text
            style={[
              styles.bannerSubtitle,
              { color: isDark ? "#94A3B8" : "#475569" },
            ]}
          >
            {showTestSuccess
              ? "Test notification sent! You will be alerted when new roommate messages or bill requests arrive."
              : "Get notified about messages, thought notes, and bill splits even when the app is in the background."}
          </Text>
        </View>

        {/* Dismiss Button */}
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.dismissBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={18} color={isDark ? "#64748B" : "#94A3B8"} />
        </TouchableOpacity>
      </View>

      {/* Action Buttons Row */}
      {!showTestSuccess && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.enableBtn, isRequesting && { opacity: 0.6 }]}
            onPress={handleEnable}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="bell" size={14} color="#FFFFFF" />
                <Text style={styles.enableBtnText}>Enable Notifications</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.notNowBtn} onPress={handleDismiss}>
            <Text
              style={[
                styles.notNowBtnText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Not now
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  bannerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  dismissBtn: {
    padding: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingLeft: 52,
  },
  enableBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  enableBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },
  notNowBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  notNowBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
