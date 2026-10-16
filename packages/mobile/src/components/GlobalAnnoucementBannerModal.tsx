import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { mobileDataService } from "../services/firebaseDataService";
import { auth } from "../firebase/config";

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  priority?: "INFO" | "ALERT" | "UPDATE" | "EVENT";
  actionLabel?: string;
  actionTarget?: string;
  createdAt?: string;
  isActive?: boolean;
}

interface GlobalAnnouncementBannerModalProps {
  onOpenNotifications?: () => void;
  onNavigate?: (tab: string) => void;
}

const STORAGE_KEY_PREFIX = "@splitzy_dismissed_announcements_";

export const GlobalAnnouncementBannerModal: React.FC<
  GlobalAnnouncementBannerModalProps
> = ({ onOpenNotifications, onNavigate }) => {
  const insets = useSafeAreaInsets();
  const currentUid = auth.currentUser?.uid || "guest";
  const storageKey = `${STORAGE_KEY_PREFIX}${currentUid}`;

  const [activeAnnouncement, setActiveAnnouncement] =
    useState<AnnouncementItem | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(false);

  // Animation values
  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  // Load dismissed announcement IDs from local AsyncStorage
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setDismissedIds(new Set(parsed));
          }
        }
      } catch (e) {
        console.warn("[Announcement] Load dismissed IDs notice:", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  // Listen to system announcements and platform settings real-time
  useEffect(() => {
    let isMounted = true;

    // 1. Subscribe to systemAnnouncements collection
    const unsubAnnouncements = mobileDataService.listenToSystemAnnouncements(
      (list) => {
        if (!isMounted) return;
        const valid = list.filter((a) => a.isActive !== false && a.message);
        if (valid.length > 0) {
          // Pick newest active announcement
          const newest = valid[0];
          evaluateAnnouncement(newest);
        } else {
          // Check platform settings fallback
          checkPlatformFallback();
        }
      },
    );

    // 2. Subscribe to platform settings fallback
    const checkPlatformFallback = () => {
      mobileDataService.listenToPlatformSettings((settings) => {
        if (!isMounted) return;
        if (settings?.latestAnnouncement) {
          evaluateAnnouncement(settings.latestAnnouncement);
        } else if (settings?.announcementBanner?.trim()) {
          // If simple string banner in platform settings
          const synthetic: AnnouncementItem = {
            id: `banner_${settings.announcementBanner.slice(0, 16).replace(/\s+/g, "_")}`,
            title: "Splitzy News",
            message: settings.announcementBanner.trim(),
            priority: "INFO",
            createdAt: settings.updatedAt || new Date().toISOString(),
          };
          evaluateAnnouncement(synthetic);
        }
      });
    };

    const evaluateAnnouncement = (item: AnnouncementItem) => {
      if (!item || !item.id || !item.message) return;
      if (dismissedIds.has(item.id)) {
        // User already saw and dismissed this announcement
        if (activeAnnouncement?.id === item.id) {
          hideBanner();
        }
        return;
      }
      setActiveAnnouncement(item);
      showBanner();
    };

    return () => {
      isMounted = false;
      unsubAnnouncements();
    };
  }, [dismissedIds]);

  const showBanner = useCallback(() => {
    setIsVisible(true);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 45,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity, scale]);

  const hideBanner = useCallback(
    (onComplete?: () => void) => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -150,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsVisible(false);
        setActiveAnnouncement(null);
        if (onComplete) onComplete();
      });
    },
    [translateY, opacity, scale],
  );

  const handleDismiss = async () => {
    if (!activeAnnouncement) return;
    const annId = activeAnnouncement.id;

    // 1. Immediately animate dismiss
    hideBanner();

    // 2. Persist locally to AsyncStorage so user never sees it again on home screen
    try {
      const nextDismissed = new Set(dismissedIds);
      nextDismissed.add(annId);
      setDismissedIds(nextDismissed);
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify(Array.from(nextDismissed)),
      );
    } catch (e) {
      console.warn("[Announcement] Save dismissed ID notice:", e);
    }
  };

  const handleAction = async () => {
    if (!activeAnnouncement) return;
    const target = activeAnnouncement.actionTarget;

    // Dismiss banner locally
    await handleDismiss();

    // Navigate to requested target or notifications
    if (target === "notifications" && onOpenNotifications) {
      onOpenNotifications();
    } else if (target && onNavigate) {
      onNavigate(target);
    } else if (onOpenNotifications) {
      onOpenNotifications();
    }
  };

  if (!isVisible || !activeAnnouncement) {
    return null;
  }

  const priority = activeAnnouncement.priority || "INFO";
  const priorityConfig = getPriorityConfig(priority);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlayContainer,
        {
          top: Math.max(insets.top, Platform.OS === "android" ? 14 : 10) + 4,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.sheetCard,
          {
            transform: [{ translateY }, { scale }],
            opacity,
          },
        ]}
      >
        {/* Glowing Royal Blue Top Accent Line */}
        {/* <View style={styles.topAccentGlow} /> */}

        {/* Card Content Container */}
        <View style={styles.innerContainer}>
          {/* Header Row: Megaphone Icon, Priority Badge, Title & Close */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: priorityConfig.iconBg },
                ]}
              >
                <Ionicons
                  name={priorityConfig.iconName as any}
                  size={18}
                  color={priorityConfig.accentColor}
                />
              </View>
              <View style={styles.badgeAndTitle}>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: priorityConfig.badgeBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityBadgeText,
                        { color: priorityConfig.accentColor },
                      ]}
                    >
                      {priorityConfig.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.announcementTitle} numberOfLines={1}>
                  {activeAnnouncement.title || "Platform Announcement"}
                </Text>
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={handleDismiss}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="x" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Message Body */}
          <Text style={styles.announcementBody} numberOfLines={3}>
            {activeAnnouncement.message}
          </Text>

          {/* Footer Action Row: Secondary Info/Action + "Got It" Button */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => {
                if (onOpenNotifications) {
                  handleDismiss();
                  onOpenNotifications();
                }
              }}
              activeOpacity={0.65}
              style={styles.notificationLink}
            >
              <Feather name="bell" size={13} color="#60A5FA" />
              <Text style={styles.notificationLinkText}>
                View in Notifications
              </Text>
            </TouchableOpacity>

            <View style={styles.buttonsRight}>
              {Boolean(activeAnnouncement.actionLabel) && (
                <TouchableOpacity
                  onPress={handleAction}
                  style={styles.secondaryActionBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryActionText}>
                    {activeAnnouncement.actionLabel}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Got It Button */}
              <TouchableOpacity
                onPress={handleDismiss}
                style={styles.gotItButton}
                activeOpacity={0.85}
              >
                <Text style={styles.gotItText}>Got It</Text>
                <Feather name="check" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

function getPriorityConfig(priority: string) {
  switch (priority) {
    case "ALERT":
      return {
        label: "IMPORTANT",
        iconName: "alert-circle",
        accentColor: "#F43F5E",
        iconBg: "rgba(244, 63, 94, 0.16)",
        badgeBg: "rgba(244, 63, 94, 0.14)",
      };
    case "UPDATE":
      return {
        label: "APP UPDATE",
        iconName: "sparkles",
        accentColor: "#10B981",
        iconBg: "rgba(16, 185, 129, 0.16)",
        badgeBg: "rgba(16, 185, 129, 0.14)",
      };
    case "EVENT":
      return {
        label: "EVENT",
        iconName: "calendar",
        accentColor: "#F59E0B",
        iconBg: "rgba(245, 158, 11, 0.16)",
        badgeBg: "rgba(245, 158, 11, 0.14)",
      };
    case "INFO":
    default:
      return {
        label: "ANNOUNCEMENT",
        iconName: "megaphone",
        accentColor: "#3B82F6",
        iconBg: "rgba(59, 130, 246, 0.16)",
        badgeBg: "rgba(59, 130, 246, 0.14)",
      };
  }
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 9999,
    alignItems: "center",
  },
  sheetCard: {
    width: "100%",
    backgroundColor: "#12131A", // Splitzy Warm Obsidian
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: "rgba(59, 130, 246, 0.35)", // Royal Blue subtle edge
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
  // topAccentGlow: {
  //   height: 3,
  //   backgroundColor: "#2563EB", // Royal Blue
  //   width: "100%",
  // },
  innerContainer: {
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeAndTitle: {
    flex: 1,
    gap: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priorityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  broadcastTag: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
  },
  announcementTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  announcementBody: {
    fontSize: 12.5,
    color: "#94A3B8",
    lineHeight: 18,
    fontWeight: "400",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  notificationLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
  },
  notificationLinkText: {
    fontSize: 11,
    color: "#60A5FA",
    fontWeight: "600",
  },
  buttonsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  secondaryActionText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  gotItButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2563EB", // Royal Blue
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  gotItText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
