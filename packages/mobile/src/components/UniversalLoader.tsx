import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Path } from "react-native-svg";

export interface UniversalLoaderProps {
  text?: string;
  subtitle?: string;
  transparent?: boolean;
  icon?: "google" | "splitzy" | "spinner" | "auto";
  showDots?: boolean;
  isExiting?: boolean;
}

export const GoogleLogoIcon = ({ size = 26 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <Path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <Path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <Path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </Svg>
);

export const SplitzyLogoIcon = ({ size = 26 }: { size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: "#2563EB",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Text
      style={{
        color: "#FFFFFF",
        fontSize: size * 0.58,
        fontWeight: "900",
        lineHeight: size * 0.7,
      }}
    >
      S
    </Text>
  </View>
);

export const UniversalLoader: React.FC<UniversalLoaderProps> = ({
  text = "Completing Google sign in...",
  subtitle,
  transparent = true,
  icon = "auto",
  showDots = true,
  isExiting = false,
}) => {
  // Continuous rotation for spinner ring
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Staggered pulsation for 3 bottom dots
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  // Card entrance/exit animation
  const cardScale = useRef(new Animated.Value(0.96)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Snappy entrance animation
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Continuous spinner rotation
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinLoop.start();

    // 3. Staggered pulsating dots
    const createDotLoop = (anim: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 320,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 320,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.delay(140),
          ]),
        ),
      ]);
    };

    const dot1Loop = createDotLoop(dot1Anim, 0);
    const dot2Loop = createDotLoop(dot2Anim, 140);
    const dot3Loop = createDotLoop(dot3Anim, 280);

    dot1Loop.start();
    dot2Loop.start();
    dot3Loop.start();

    return () => {
      spinLoop.stop();
      dot1Loop.stop();
      dot2Loop.stop();
      dot3Loop.stop();
    };
  }, []);

  useEffect(() => {
    if (isExiting) {
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 0.94,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isExiting]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Resolve icon type: auto-detect Google if text mentions Google
  const isGoogle =
    icon === "google" ||
    (icon === "auto" && text.toLowerCase().includes("google"));

  // Resolve subtitle: if text is google and subtitle empty, use Google sign-in subtitle
  const resolvedSubtitle =
    subtitle !== undefined
      ? subtitle
      : isGoogle
        ? "Verifying your account details"
        : "Please wait a moment...";

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        translucent={true}
        backgroundColor="transparent"
      />

      {/* Backdrop: Lightweight translucent overlay for maximum 60fps performance */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: transparent
              ? "rgba(15, 23, 42, 0.28)"
              : "rgba(248, 250, 252, 0.96)",
          },
        ]}
      />

      {/* White Loader Card */}
      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        {/* Spinner Ring with Centered Brand Icon */}
        <View style={styles.spinnerWrapper}>
          {/* Static subtle circular track */}
          <View style={styles.spinnerTrack} />

          {/* Animated spinning arc */}
          <Animated.View
            style={[
              styles.spinnerArc,
              {
                transform: [{ rotate: spinInterpolate }],
              },
            ]}
          />

          {/* Center Icon */}
          <View style={styles.centerIconWrap}>
            {isGoogle ? (
              <GoogleLogoIcon size={24} />
            ) : icon === "splitzy" ? (
              <SplitzyLogoIcon size={24} />
            ) : (
              <SplitzyLogoIcon size={24} />
            )}
          </View>
        </View>

        {/* Title */}
        {text ? <Text style={styles.titleText}>{text}</Text> : null}

        {/* Subtitle */}
        {resolvedSubtitle ? (
          <Text style={styles.subtitleText}>{resolvedSubtitle}</Text>
        ) : null}

        {/* Three Animated Bouncing Dots */}
        {showDots && (
          <View style={styles.dotsRow}>
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: dot1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 1],
                  }),
                  transform: [
                    {
                      scale: dot1Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.75, 1.25],
                      }),
                    },
                    {
                      translateY: dot1Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -3],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: dot2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 1],
                  }),
                  transform: [
                    {
                      scale: dot2Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.75, 1.25],
                      }),
                    },
                    {
                      translateY: dot2Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -3],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: dot3Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 1],
                  }),
                  transform: [
                    {
                      scale: dot3Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.75, 1.25],
                      }),
                    },
                    {
                      translateY: dot3Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -3],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
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
    right: 0,
    bottom: 0,
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  card: {
    width: 280,
    maxWidth: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 12,
  },
  spinnerWrapper: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  spinnerTrack: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3.5,
    borderColor: "#EEF2F6",
  },
  spinnerArc: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3.5,
    borderColor: "transparent",
    borderTopColor: "#2563EB",
    borderRightColor: "#3B82F6",
  },
  centerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    marginTop: 18,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  subtitleText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "400",
    color: "#64748B",
    textAlign: "center",
    letterSpacing: -0.1,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#2563EB",
  },
});
