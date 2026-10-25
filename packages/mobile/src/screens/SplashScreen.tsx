import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  Animated,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { updateService, UpdateSyncStatus } from "../services/updateService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SCREEN_MAX = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT);
// Sizing square so that even when rotated at 25deg, scale >= 1.1 completely blankets the viewport
const SQUARE_SIZE = Math.round(SCREEN_MAX * 1.85);

const SPLASH_CHIME_ASSET = require("../../assets/splash-chime.wav");

// 5-Color Blue Palette strictly matching the user's attached swatch:
// #1E3A8A (Deep Navy) -> #2563EB (Splitzy Primary) -> #60A5FA (Sky Blue) -> #93C5FD (Soft Blue) -> #BFDBFE (Ice Blue)
const FIVE_COLOR_PALETTE = [
  "#1E3A8A", // 0: Deep Royal Navy (from image #1E3A8A)
  "#2563EB", // 1: Splitzy Primary Royal Blue (#2563EB)
  "#60A5FA", // 2: Sky Blue (from image #60A5FA)
  "#93C5FD", // 3: Soft Blue (from image #93C5FD)
  "#BFDBFE", // 4: Ice Blue (from image #BFDBFE - final full-screen blanket)
];

export const SplashScreen: React.FC<{ onFinish: () => void }> = ({
  onFinish,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;

  // Concentric squares zoom tunnel animation (0 -> 1)
  const squaresZoomAnim = useRef(new Animated.Value(0)).current;
  const [isZooming, setIsZooming] = useState(false);

  const isMountedRef = useRef(true);
  const isZoomingRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const cleanupAudioRef = useRef<(() => void) | null>(null);
  const [syncStatus, setSyncStatus] = useState<UpdateSyncStatus>("idle");

  useEffect(() => {
    isMountedRef.current = true;

    // Subscribe to real-time update sync state
    const unsubscribeStatus = updateService.subscribeStatus((status) => {
      if (isMountedRef.current) {
        setSyncStatus(status);
      }
    });

    const finishSafely = () => {
      if (!hasFinishedRef.current && isMountedRef.current) {
        hasFinishedRef.current = true;
        onFinish();
      }
    };

    const startZoomIntro = () => {
      if (
        isZoomingRef.current ||
        hasFinishedRef.current ||
        !isMountedRef.current
      ) {
        return;
      }
      isZoomingRef.current = true;
      setIsZooming(true);

      // Skip logo zoom: directly start expanding squares once splash is loaded (~1700ms)
      Animated.timing(squaresZoomAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: Platform.OS !== "web",
      }).start(({ finished }) => {
        if (finished && isMountedRef.current) {
          finishSafely();
        }
      });
    };

    const playSplashSound = async () => {
      try {
        const ExpoAudio = require("expo-audio") as typeof import("expo-audio");

        if (typeof ExpoAudio.setAudioModeAsync === "function") {
          await ExpoAudio.setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            interruptionMode: "mixWithOthers",
            interruptionModeAndroid: "duckOthers",
          }).catch(() => {});
        }

        if (!isMountedRef.current) return;

        if (typeof ExpoAudio.createAudioPlayer === "function") {
          const player = ExpoAudio.createAudioPlayer(SPLASH_CHIME_ASSET);
          player.volume = 0.75;
          player.play();

          cleanupAudioRef.current = () => {
            try {
              player.pause();
              player.remove();
            } catch {
              // Ignore cleanup errors
            }
          };
        }
      } catch {
        // Silently ignore audio errors if the native module is unavailable in the current client
      }
    };

    playSplashSound();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    // Check for OTA update on launch with a strict 5-second deadline
    const minSplashPromise = new Promise((resolve) =>
      setTimeout(resolve, 2000),
    );
    const startupUpdatePromise = updateService.checkAndApplyStartupUpdate(5000);

    Promise.allSettled([minSplashPromise, startupUpdatePromise]).then(
      (results) => {
        const updateResult = results[1];
        if (
          updateResult.status === "fulfilled" &&
          updateResult.value &&
          updateResult.value.updated
        ) {
          // App is reloading into fresh OTA bundle; don't trigger finish
          return;
        }
        startZoomIntro();
      },
    );

    // Hard fallback timer ensures splash screen NEVER blocks under any network condition
    const hardFallbackTimer = setTimeout(() => {
      startZoomIntro();
    }, 5200);

    return () => {
      isMountedRef.current = false;
      unsubscribeStatus();
      clearTimeout(hardFallbackTimer);
      if (cleanupAudioRef.current) {
        cleanupAudioRef.current();
        cleanupAudioRef.current = null;
      }
    };
  }, [fadeAnim, scaleAnim, textFadeAnim, squaresZoomAnim, onFinish]);

  // Fade logo and footer out quickly as the squares burst from the center
  const logoFadeDuringZoom = squaresZoomAnim.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [1, 0, 0],
  });
  const footerZoomFade = squaresZoomAnim.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [1, 0, 0],
  });

  // Concentric squares zoom tunnel interpolations (strictly 5 colors)
  // 1. Zoom container entrance
  const zoomOverlayOpacity = squaresZoomAnim.interpolate({
    inputRange: [0, 0.03, 1],
    outputRange: [0, 1, 1],
  });

  // 2. Subtle organic rotation matching the reference video (18deg to 28deg)
  const squareRotate = squaresZoomAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["18deg", "28deg"],
  });

  // 3. Staggered scale interpolations for the 5 concentric layers:
  // Layer 0: #1E3A8A (Deep Navy)
  const layer0Scale = squaresZoomAnim.interpolate({
    inputRange: [0, 0.28, 0.55, 1],
    outputRange: [0.38, 1.25, 3.2, 7.5],
  });
  const layer0Opacity = squaresZoomAnim.interpolate({
    inputRange: [0, 0.03, 0.8, 1],
    outputRange: [0, 1, 1, 1],
  });

  // Layer 1: #2563EB (Splitzy Primary Royal Blue)
  const layer1Scale = squaresZoomAnim.interpolate({
    inputRange: [0, 0.22, 0.48, 0.75, 1],
    outputRange: [0.22, 0.45, 1.25, 3.2, 7.5],
  });
  const layer1Opacity = squaresZoomAnim.interpolate({
    inputRange: [0, 0.05, 0.85, 1],
    outputRange: [0, 1, 1, 1],
  });

  // Layer 2: #60A5FA (Sky Blue)
  const layer2Scale = squaresZoomAnim.interpolate({
    inputRange: [0, 0.38, 0.68, 0.88, 1],
    outputRange: [0.12, 0.3, 1.25, 3.2, 7.0],
  });
  const layer2Opacity = squaresZoomAnim.interpolate({
    inputRange: [0, 0.08, 0.9, 1],
    outputRange: [0, 1, 1, 1],
  });

  // Layer 3: #93C5FD (Soft Blue)
  const layer3Scale = squaresZoomAnim.interpolate({
    inputRange: [0, 0.55, 0.84, 0.96, 1],
    outputRange: [0.06, 0.18, 1.25, 2.8, 6.5],
  });
  const layer3Opacity = squaresZoomAnim.interpolate({
    inputRange: [0, 0.12, 0.95, 1],
    outputRange: [0, 1, 1, 1],
  });

  // Layer 4: #BFDBFE (Ice Blue - final full-screen blanket)
  const layer4Scale = squaresZoomAnim.interpolate({
    inputRange: [0, 0.72, 0.92, 1],
    outputRange: [0.025, 0.1, 0.9, 2.4],
  });
  const layer4Opacity = squaresZoomAnim.interpolate({
    inputRange: [0, 0.18, 0.95, 1],
    outputRange: [0, 1, 1, 1],
  });

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* 1. Base gradient background */}
      <LinearGradient
        colors={["#5497F8", "#3E8EEF", "#2782EA", "#207AE7"]}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Concentric Tilted Zooming Squares Overlay (Exactly 5 Colors) */}
      <Animated.View
        style={[
          styles.zoomContainer,
          {
            opacity: zoomOverlayOpacity,
          },
        ]}
        pointerEvents="none"
      >
        {/* Layer 0: Deep Royal Navy (#1E3A8A) */}
        <Animated.View
          style={[
            styles.zoomSquare,
            {
              backgroundColor: FIVE_COLOR_PALETTE[0],
              opacity: layer0Opacity,
              transform: [{ rotate: squareRotate }, { scale: layer0Scale }],
            },
          ]}
        />

        {/* Layer 1: Splitzy Primary Royal Blue (#2563EB) */}
        <Animated.View
          style={[
            styles.zoomSquare,
            {
              backgroundColor: FIVE_COLOR_PALETTE[1],
              opacity: layer1Opacity,
              transform: [{ rotate: squareRotate }, { scale: layer1Scale }],
            },
          ]}
        />

        {/* Layer 2: Sky Blue (#60A5FA) */}
        <Animated.View
          style={[
            styles.zoomSquare,
            {
              backgroundColor: FIVE_COLOR_PALETTE[2],
              opacity: layer2Opacity,
              transform: [{ rotate: squareRotate }, { scale: layer2Scale }],
            },
          ]}
        />

        {/* Layer 3: Soft Blue (#93C5FD) */}
        <Animated.View
          style={[
            styles.zoomSquare,
            {
              backgroundColor: FIVE_COLOR_PALETTE[3],
              opacity: layer3Opacity,
              transform: [{ rotate: squareRotate }, { scale: layer3Scale }],
            },
          ]}
        />

        {/* Layer 4: Ice Blue (#BFDBFE - Final Blanket) */}
        <Animated.View
          style={[
            styles.zoomSquare,
            {
              backgroundColor: FIVE_COLOR_PALETTE[4],
              opacity: layer4Opacity,
              transform: [{ rotate: squareRotate }, { scale: layer4Scale }],
            },
          ]}
        />
      </Animated.View>

      {/* 3. Foreground Content (Logo & Typography) */}
      <SafeAreaView style={styles.content}>
        {/* Optical center for the modern geometric interlocking Splitzy ribbon mark */}
        <View style={styles.centerContainer}>
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                opacity: isZooming ? logoFadeDuringZoom : fadeAnim,
                transform: [
                  {
                    scale: scaleAnim,
                  },
                ],
              },
            ]}
          >
            <Image
              source={require("../../assets/splash-logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Clean footer wordmark matching the proposed typography */}
        <Animated.View
          style={[
            styles.footer,
            {
              opacity: isZooming ? footerZoomFade : textFadeAnim,
            },
          ]}
        >
          <Text style={styles.appName}>Splitzy</Text>

          {/* Discreet sync status indicator if an update is actively downloading/reloading */}
          {(syncStatus === "downloading" || syncStatus === "reloading") && (
            <View style={styles.syncRow}>
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.syncText}>
                {syncStatus === "downloading"
                  ? "Downloading update..."
                  : "Applying update..."}
              </Text>
            </View>
          )}

          <View style={styles.homeIndicator} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2782EA",
    overflow: "hidden",
  },
  zoomContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    overflow: "hidden",
  },
  zoomSquare: {
    position: "absolute",
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    // Optical vertical centering alignment to align with -20px offset of the logo
    top: "50%",
    left: "50%",
    marginTop: -SQUARE_SIZE / 2 - 20,
    marginLeft: -SQUARE_SIZE / 2,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -20,
  },
  logoWrapper: {
    width: Math.min(SCREEN_WIDTH * 0.32, 130),
    height: Math.min(SCREEN_WIDTH * 0.32, 130),
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  footer: {
    alignItems: "center",
    paddingBottom: 28,
  },
  appName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  syncText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    marginTop: 12,
  },
});
