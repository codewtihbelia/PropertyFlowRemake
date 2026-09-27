import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  Animated,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const SPLASH_CHIME_ASSET = require("../../assets/splash-chime.wav");

export const SplashScreen: React.FC<{ onFinish: () => void }> = ({
  onFinish,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const cleanupAudioRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;

    const playSplashSound = async () => {
      try {
        // Lazy-require expo-audio inside try/catch so top-level bundle evaluation never fails
        // and any missing native module error on older dev clients is safely caught.
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

    const timer = setTimeout(() => {
      onFinish();
    }, 2200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
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
    marginBottom: 24,
  },
  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
});
