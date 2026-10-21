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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { updateService, UpdateSyncStatus } from "../services/updateService";

const { width } = Dimensions.get("window");
const SPLASH_CHIME_ASSET = require("../../assets/splash-chime.wav");

export const SplashScreen: React.FC<{ onFinish: () => void }> = ({
  onFinish,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const cleanupAudioRef = useRef<(() => void) | null>(null);
  const [syncStatus, setSyncStatus] = useState<UpdateSyncStatus>("idle");

  useEffect(() => {
    let isMounted = true;
    let hasFinished = false;

    // Subscribe to real-time update sync state
    const unsubscribeStatus = updateService.subscribeStatus((status) => {
      if (isMounted) {
        setSyncStatus(status);
      }
    });

    const finishSafely = () => {
      if (!hasFinished && isMounted) {
        hasFinished = true;
        onFinish();
      }
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

        if (!isMounted) return;

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
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
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
        finishSafely();
      },
    );

    // Hard fallback timer ensures splash screen NEVER blocks under any network condition
    const hardFallbackTimer = setTimeout(() => {
      finishSafely();
    }, 5200);

    return () => {
      isMounted = false;
      unsubscribeStatus();
      clearTimeout(hardFallbackTimer);
      if (cleanupAudioRef.current) {
        cleanupAudioRef.current();
        cleanupAudioRef.current = null;
      }
    };
  }, [fadeAnim, scaleAnim, textFadeAnim, onFinish]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Smooth vertical background gradient matching the proposed UI design */}
      <LinearGradient
        colors={["#5497F8", "#3E8EEF", "#2782EA", "#207AE7"]}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.content}>
        {/* Optical center for the modern geometric interlocking Splitzy ribbon mark */}
        <View style={styles.centerContainer}>
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
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
        <Animated.View style={[styles.footer, { opacity: textFadeAnim }]}>
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
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -20,
  },
  logoWrapper: {
    width: Math.min(width * 0.32, 130),
    height: Math.min(width * 0.32, 130),
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
