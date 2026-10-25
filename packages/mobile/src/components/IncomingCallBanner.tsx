import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CallSession } from "../services/callService";

interface IncomingCallBannerProps {
  call: CallSession | null;
  onAccept: (call: CallSession) => void;
  onDecline: (call: CallSession) => void;
  onExpand: () => void;
}

export const IncomingCallBanner: React.FC<IncomingCallBannerProps> = ({
  call,
  onAccept,
  onDecline,
  onExpand,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isRinging = Boolean(call && call.status === "ringing");

  useEffect(() => {
    if (isRinging) {
      // Slide down and settle into position
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();

      // Subtle pulse animation on call beacon
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();

      return () => {
        pulseLoop.stop();
      };
    } else {
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isRinging, slideAnim, pulseAnim]);

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
    <Animated.View
      style={[
        styles.wrapper,
        {
          top: Math.max(insets.top, 12) + 6,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={onExpand}
      >
        {/* Left: Caller Avatar with live pulsing halo */}
        <View style={styles.avatarContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          {call.callerAvatar ? (
            <Image
              source={{ uri: call.callerAvatar }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.badgeIcon}>
            <Ionicons
              name={isVideo ? "videocam" : "call"}
              size={10}
              color="#FFFFFF"
            />
          </View>
        </View>

        {/* Center: Caller information */}
        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.callerName} numberOfLines={1}>
              {call.callerName}
            </Text>
            <View style={styles.liveIndicator}>
              <View style={styles.greenDot} />
              <Text style={styles.liveText}>CALLING</Text>
            </View>
          </View>
          <Text style={styles.subtext} numberOfLines={1}>
            {isVideo
              ? "Incoming Video Call · Tap to expand"
              : "Incoming Voice Call · Tap to expand"}
          </Text>
        </View>

        {/* Right: Quick Action Buttons */}
        <View style={styles.actionsRow}>
          {/* Decline Button */}
          <TouchableOpacity
            style={styles.declineButton}
            activeOpacity={0.8}
            onPress={(e) => {
              e.stopPropagation?.();
              onDecline(call);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Accept Button */}
          <TouchableOpacity
            style={styles.acceptButton}
            activeOpacity={0.8}
            onPress={(e) => {
              e.stopPropagation?.();
              onAccept(call);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Ionicons
              name={isVideo ? "videocam" : "call"}
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 99999,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0E14",
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.2,
    borderColor: "rgba(59, 130, 246, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 16,
  },
  avatarContainer: {
    position: "relative",
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(16, 185, 129, 0.25)",
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1E293B",
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  badgeIcon: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#0B0E14",
  },
  infoCol: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callerName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10B981",
  },
  liveText: {
    color: "#10B981",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  subtext: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  declineButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});
