import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Image,
  Animated,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { CallSession, tonePlayer } from "../services/callService";

interface IncomingCallModalProps {
  call: CallSession | null;
  onAccept: (call: CallSession) => void;
  onDecline: (call: CallSession) => void;
  onMinimize?: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  call,
  onAccept,
  onDecline,
  onMinimize,
}) => {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (call && call.status === "ringing") {
      tonePlayer.playIncomingRing();

      // Pulsing avatar ring animation
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();

      return () => {
        pulseLoop.stop();
        tonePlayer.stop();
      };
    } else {
      tonePlayer.stop();
    }
  }, [call, pulseAnim]);

  if (!call || call.status !== "ringing") {
    return null;
  }

  const isVideo = call.callType === "video";
  const initials = call.callerName
    ? call.callerName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "R";

  return (
    <Modal visible={true} transparent={false} animationType="slide">
      <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />
      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 24) + 16,
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          },
        ]}
      >
        {/* Ambient background glow */}
        <View style={styles.ambientGlow} />

        {/* Top Minimize Control */}
        {onMinimize && (
          <TouchableOpacity
            style={[styles.minimizeBtn, { top: Math.max(insets.top, 16) + 12 }]}
            onPress={onMinimize}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            <Text style={styles.minimizeText}>Banner</Text>
          </TouchableOpacity>
        )}

        {/* Top Header Information */}
        <View style={styles.header}>
          <View style={styles.callTypeBadge}>
            <Ionicons
              name={isVideo ? "videocam" : "call"}
              size={14}
              color="#60A5FA"
            />
            <Text style={styles.callTypeBadgeText}>
              {isVideo ? "Incoming Video Call" : "Incoming Voice Call"}
            </Text>
          </View>
          <Text style={styles.callerName} numberOfLines={1}>
            {call.callerName}
          </Text>
          <Text style={styles.callSubtext}>Splitzy Roommate · Ringing...</Text>
        </View>

        {/* Center Avatar with Pulsing Halo */}
        <View style={styles.centerSection}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRingOuter,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <View style={styles.avatarWrap}>
            {call.callerAvatar ? (
              <Image
                source={{ uri: call.callerAvatar }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Actions: Decline (Red) and Accept (Green) */}
        <View style={styles.actionsRow}>
          {/* Decline Action */}
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={() => onDecline(call)}
              activeOpacity={0.8}
              accessibilityLabel="Decline Call"
            >
              <Ionicons
                name="call"
                size={28}
                color="#FFFFFF"
                style={styles.declineIcon}
              />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          {/* Accept Action */}
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => onAccept(call)}
              activeOpacity={0.8}
              accessibilityLabel="Accept Call"
            >
              <Ionicons
                name={isVideo ? "videocam" : "call"}
                size={28}
                color="#FFFFFF"
              />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E14",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  ambientGlow: {
    position: "absolute",
    top: "20%",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    ...Platform.select({
      web: {
        filter: "blur(70px)",
      } as any,
    }),
  },
  header: {
    alignItems: "center",
    marginTop: 20,
  },
  callTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(37, 99, 235, 0.18)",
    borderColor: "rgba(96, 165, 250, 0.3)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 14,
  },
  callTypeBadgeText: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "600",
  },
  callerName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F8FAFC",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 6,
  },
  callSubtext: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
  },
  centerSection: {
    alignItems: "center",
    justifyContent: "center",
    width: 200,
    height: 200,
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: "rgba(37, 99, 235, 0.4)",
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  pulseRingOuter: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  avatarWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#60A5FA",
    fontSize: 36,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    marginBottom: 20,
  },
  actionItem: {
    alignItems: "center",
    gap: 10,
  },
  actionBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  declineBtn: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
  },
  declineIcon: {
    transform: [{ rotate: "135deg" }],
  },
  acceptBtn: {
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
  },
  actionLabel: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
  },
  minimizeBtn: {
    position: "absolute",
    left: 20,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(30, 41, 59, 0.75)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  minimizeText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
});
