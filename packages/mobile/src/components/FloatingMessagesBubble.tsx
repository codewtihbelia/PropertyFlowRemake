import React, { useRef, useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { playMessengerPopChime, unlockAudioNow } from "../utils/soundEffects";

export interface FloatingMessagesBubbleProps {
  onPress: () => void;
  unreadCount?: number;
  latestUnreadMessage?: {
    id: string;
    senderName: string;
    text: string;
  } | null;
}

const BUBBLE_SIZE = 56;
const EDGE_MARGIN = 16;

export const FloatingMessagesBubble: React.FC<FloatingMessagesBubbleProps> = ({
  onPress,
  unreadCount = 0,
  latestUnreadMessage,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  // Synchronous window dimensions as reliable baseline
  const windowDims = Dimensions.get("window");
  const screenWidth = windowDims.width > 0 ? windowDims.width : 390;
  const screenHeight = windowDims.height > 0 ? windowDims.height : 844;

  // Compute safe boundaries
  const minY = Math.max(insets.top + 16, 50);
  const maxY = screenHeight - insets.bottom - 110;
  const minX = EDGE_MARGIN;
  const maxX = Math.max(screenWidth - BUBBLE_SIZE - EDGE_MARGIN, minX);

  // Initial position: docked on the right side, around 52% of the screen height
  const initialX = maxX;
  const initialY = Math.min(Math.max(screenHeight * 0.52, minY), maxY);

  const pan = useRef(
    new Animated.ValueXY({ x: initialX, y: initialY }),
  ).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isDragging, setIsDragging] = useState(false);

  // Keep track of current coordinates
  const currentCoord = useRef({ x: initialX, y: initialY });
  const [currentXPos, setCurrentXPos] = useState(initialX);
  const hasMounted = useRef(false);

  // Callout popup state (auto-dismisses after 6 seconds)
  const [showCallout, setShowCallout] = useState(false);
  const calloutFadeAnim = useRef(new Animated.Value(0)).current;
  const lastShownMsgId = useRef<string | null>(null);

  // Trigger callout when a new unread message appears
  useEffect(() => {
    if (
      latestUnreadMessage?.id &&
      unreadCount > 0 &&
      latestUnreadMessage.id !== lastShownMsgId.current
    ) {
      lastShownMsgId.current = latestUnreadMessage.id;
      setShowCallout(true);
      playMessengerPopChime();
      Animated.timing(calloutFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(calloutFadeAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }).start(() => {
          setShowCallout(false);
        });
      }, 6000);

      return () => clearTimeout(timer);
    } else if (unreadCount === 0) {
      setShowCallout(false);
    }
  }, [latestUnreadMessage?.id, unreadCount]);

  // Guard against initial zero/offscreen dimension issues
  useEffect(() => {
    const freshDims = Dimensions.get("window");
    const validWidth = freshDims.width > 0 ? freshDims.width : screenWidth;
    const validHeight = freshDims.height > 0 ? freshDims.height : screenHeight;
    const validMaxX = Math.max(
      validWidth - BUBBLE_SIZE - EDGE_MARGIN,
      EDGE_MARGIN,
    );
    const validY = Math.min(Math.max(validHeight * 0.52, minY), maxY);

    const currX = (pan.x as any)._value;

    if (
      !hasMounted.current ||
      currX <= 0 ||
      currX > validWidth ||
      isNaN(currX)
    ) {
      pan.setValue({ x: validMaxX, y: validY });
      currentCoord.current = { x: validMaxX, y: validY };
      setCurrentXPos(validMaxX);
      hasMounted.current = true;
    }
  }, [screenWidth, screenHeight, minY, maxY, pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        unlockAudioNow();
        Animated.spring(scaleAnim, {
          toValue: 1.12,
          useNativeDriver: false,
          friction: 6,
        }).start();

        pan.setOffset({
          x: currentCoord.current.x,
          y: currentCoord.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        pan.flattenOffset();

        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: false,
        }).start();

        // If gesture was a quick tap (< 8px movement), trigger click
        const totalDistance = Math.hypot(gestureState.dx, gestureState.dy);
        if (totalDistance < 8) {
          unlockAudioNow();
          onPress();
          return;
        }

        // Calculate clamped position and snap to nearest edge
        const rawX = currentCoord.current.x + gestureState.dx;
        const rawY = currentCoord.current.y + gestureState.dy;

        const freshDims = Dimensions.get("window");
        const currentScreenWidth =
          freshDims.width > 0 ? freshDims.width : screenWidth;
        const targetX =
          rawX + BUBBLE_SIZE / 2 < currentScreenWidth / 2 ? minX : maxX;
        const targetY = Math.min(Math.max(rawY, minY), maxY);

        currentCoord.current = { x: targetX, y: targetY };
        setCurrentXPos(targetX);

        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          friction: 7,
          tension: 45,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        pan.flattenOffset();
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  // Synchronize listener to keep currentCoord up to date
  useEffect(() => {
    const listenerId = pan.addListener((value) => {
      currentCoord.current = value;
    });
    return () => {
      pan.removeListener(listenerId);
    };
  }, [pan]);

  const isDockedOnRight = currentXPos > screenWidth / 2;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 99999,
          elevation: 99999,
        },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: scaleAnim },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Floating draggable Bubble Circle */}
        <View
          style={[
            styles.bubbleCircle,
            {
              backgroundColor: isDark ? "#1E222B" : "#FFFFFF",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.15)"
                : "rgba(37, 99, 235, 0.2)",
              shadowColor: isDark ? "#000000" : "#2563EB",
            },
            isDragging && styles.bubbleDragging,
          ]}
          {...panResponder.panHandlers}
        >
          {/* Inner royal blue accent core with message icon */}
          <View style={styles.iconWrapper}>
            <Ionicons
              name="chatbubbles"
              size={26}
              color={isDark ? "#60A5FA" : "#2563EB"}
            />
          </View>

          {/* Unread badge indicator */}
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </View>

        {/* Auto-Dismissing Callout Speech Bubble (fades after 6 seconds) */}
        {showCallout && latestUnreadMessage && !isDragging && (
          <Animated.View
            style={[
              styles.calloutCard,
              isDockedOnRight ? styles.calloutToLeft : styles.calloutToRight,
              {
                opacity: calloutFadeAnim,
                backgroundColor: isDark ? "#1E222B" : "#FFFFFF",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.14)"
                  : "rgba(37, 99, 235, 0.18)",
              },
            ]}
          >
            <TouchableOpacity
              style={styles.calloutInner}
              activeOpacity={0.85}
              onPress={() => {
                unlockAudioNow();
                onPress();
              }}
            >
              <View style={styles.calloutTopRow}>
                <View style={styles.calloutSenderWrap}>
                  <View style={styles.calloutDot} />
                  <Text
                    style={[
                      styles.calloutSender,
                      { color: isDark ? "#60A5FA" : "#2563EB" },
                    ]}
                    numberOfLines={1}
                  >
                    {latestUnreadMessage.senderName}
                  </Text>
                </View>

                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  {/* Replay / Test Chime button */}
                  <TouchableOpacity
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      unlockAudioNow();
                      playMessengerPopChime();
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.calloutCloseBtn}
                  >
                    <Feather
                      name="volume-2"
                      size={13}
                      color={isDark ? "#60A5FA" : "#2563EB"}
                    />
                  </TouchableOpacity>

                  {/* Dismiss button */}
                  <TouchableOpacity
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      Animated.timing(calloutFadeAnim, {
                        toValue: 0,
                        duration: 150,
                        useNativeDriver: true,
                      }).start(() => setShowCallout(false));
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.calloutCloseBtn}
                  >
                    <Feather
                      name="x"
                      size={13}
                      color={isDark ? "#94A3B8" : "#64748B"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <Text
                style={[
                  styles.calloutSnippet,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
                numberOfLines={2}
              >
                {latestUnreadMessage.text}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    zIndex: 99999,
    elevation: 99999,
  },
  bubbleCircle: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 12,
  },
  bubbleDragging: {
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 16,
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#EF4444",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    includeFontPadding: false,
  },

  /* CALLOUT PREVIEW BUBBLE POPUP */
  calloutCard: {
    position: "absolute",
    top: 2,
    width: 200,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1.2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  calloutToLeft: {
    right: BUBBLE_SIZE + 10,
  },
  calloutToRight: {
    left: BUBBLE_SIZE + 10,
  },
  calloutInner: {
    gap: 4,
  },
  calloutTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calloutSenderWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    marginRight: 6,
  },
  calloutDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  calloutSender: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  calloutCloseBtn: {
    padding: 2,
  },
  calloutSnippet: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
});
