import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Animated,
  Image,
  Platform,
  Vibration,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { authPinService } from "../services/authPinService";

interface AuthPinScreenProps {
  user: {
    uid: string;
    displayName?: string;
    email?: string;
    photoURL?: string;
  };
  onUnlockSuccess: (pin?: string) => void;
  onSwitchAccount: () => void;
  onBack?: () => void;
}

export const AuthPinScreen: React.FC<AuthPinScreenProps> = ({
  user,
  onUnlockSuccess,
  onSwitchAccount,
  onBack,
}) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [pin, setPin] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(5);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotScaleAnim = [
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
  ];

  const triggerShake = () => {
    try {
      Vibration.vibrate(Platform.OS === "android" ? 70 : 50);
    } catch {
      // Ignore vibration errors
    }

    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 12,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -12,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 4,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateDot = (index: number) => {
    if (dotScaleAnim[index]) {
      Animated.sequence([
        Animated.spring(dotScaleAnim[index], {
          toValue: 1.35,
          friction: 4,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.spring(dotScaleAnim[index], {
          toValue: 1,
          friction: 5,
          tension: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleKeyPress = (digit: string) => {
    if (isVerifying || pin.length >= 4) return;

    setErrorMessage("");
    const newPin = pin + digit;
    const nextIndex = newPin.length - 1;
    animateDot(nextIndex);
    setPin(newPin);

    if (newPin.length === 4) {
      verifyCompletedPin(newPin);
    }
  };

  const handleDelete = () => {
    if (isVerifying || pin.length === 0) return;
    setErrorMessage("");
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isVerifying) return;
    setErrorMessage("");
    setPin("");
  };

  const verifyCompletedPin = async (candidatePin: string) => {
    setIsVerifying(true);
    try {
      const isValid = await authPinService.verifyPin(user.uid, candidatePin);
      if (isValid) {
        // Subtle success delay for great feel
        setTimeout(() => {
          onUnlockSuccess(candidatePin);
        }, 120);
      } else {
        triggerShake();
        const nextAttempts = Math.max(0, attemptsRemaining - 1);
        setAttemptsRemaining(nextAttempts);
        setErrorMessage(
          nextAttempts <= 1
            ? "Incorrect PIN. 1 attempt left before reset."
            : `Incorrect PIN. Please try again.`,
        );
        setTimeout(() => {
          setPin("");
          setIsVerifying(false);
        }, 400);
      }
    } catch {
      triggerShake();
      setErrorMessage("Verification error. Please retry.");
      setPin("");
      setIsVerifying(false);
    }
  };

  const displayName =
    user.displayName || user.email?.split("@")[0] || "Resident";
  const userInitial = displayName.charAt(0).toUpperCase();

  // Compact layout check for smaller screens
  const isCompact = height < 700;

  const KEYPAD_ROWS = [
    [
      { digit: "1", letters: "" },
      { digit: "2", letters: "ABC" },
      { digit: "3", letters: "DEF" },
    ],
    [
      { digit: "4", letters: "GHI" },
      { digit: "5", letters: "JKL" },
      { digit: "6", letters: "MNO" },
    ],
    [
      { digit: "7", letters: "PQRS" },
      { digit: "8", letters: "TUV" },
      { digit: "9", letters: "WXYZ" },
    ],
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.background : "#F8FAFC",
          paddingTop: insets.top + (isCompact ? 10 : 28),
          paddingBottom: Math.max(insets.bottom, 16) + 12,
        },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      {/* Optional Top Navigation Row */}
      {onBack && (
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={[
              styles.backNavBtn,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Feather
              name="arrow-left"
              size={18}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Top Header & Avatar */}
      <View style={styles.headerSection}>
        <View
          style={[
            styles.avatarWrapper,
            isDark && {
              backgroundColor: colors.card,
              borderColor: "rgba(59, 130, 246, 0.3)",
            },
          ]}
        >
          {user.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {userInitial}
            </Text>
          )}
          <View
            style={[
              styles.lockBadge,
              {
                backgroundColor: colors.primary,
                borderColor: isDark ? colors.background : "#FFFFFF",
              },
            ]}
          >
            <Feather name="lock" size={10} color="#FFFFFF" />
          </View>
        </View>

        <Text style={[styles.welcomeTitle, isDark && { color: colors.text }]}>
          Welcome Back
        </Text>
        <Text
          style={[
            styles.welcomeSubtitle,
            isDark && { color: colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {displayName}
        </Text>

        <Text
          style={[styles.pinInstruction, isDark && { color: colors.textMuted }]}
        >
          Enter your 4-digit PIN
        </Text>
      </View>

      {/* PIN Dots with Shake Animation */}
      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {[0, 1, 2, 3].map((index) => {
          const isFilled = pin.length > index;
          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  transform: [{ scale: dotScaleAnim[index] }],
                  borderColor: errorMessage
                    ? "#EF4444"
                    : isFilled
                      ? colors.primary
                      : isDark
                        ? "rgba(255, 255, 255, 0.2)"
                        : "#CBD5E1",
                  backgroundColor: isFilled
                    ? errorMessage
                      ? "#EF4444"
                      : colors.primary
                    : isDark
                      ? "rgba(255, 255, 255, 0.04)"
                      : "#FFFFFF",
                },
              ]}
            >
              {isFilled && (
                <View
                  style={[
                    styles.dotInner,
                    {
                      backgroundColor: errorMessage
                        ? "#EF4444"
                        : colors.primary,
                    },
                  ]}
                />
              )}
            </Animated.View>
          );
        })}
      </Animated.View>

      {/* Error Message */}
      <View style={styles.errorContainer}>
        {errorMessage ? (
          <View style={styles.errorPill}>
            <Feather name="alert-circle" size={13} color="#EF4444" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>

      {/* Numeric Keypad */}
      <View style={styles.keypadContainer}>
        {KEYPAD_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((item) => (
              <TouchableOpacity
                key={item.digit}
                style={[
                  styles.keyButton,
                  isDark
                    ? {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }
                    : {
                        backgroundColor: "#FFFFFF",
                        borderColor: "#E2E8F0",
                      },
                ]}
                activeOpacity={0.65}
                onPress={() => handleKeyPress(item.digit)}
              >
                <Text
                  style={[styles.keyDigit, isDark && { color: colors.text }]}
                >
                  {item.digit}
                </Text>
                {item.letters ? (
                  <Text
                    style={[
                      styles.keyLetters,
                      isDark && { color: colors.textMuted },
                    ]}
                  >
                    {item.letters}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Bottom Row: Clear, 0, Backspace */}
        <View style={styles.keypadRow}>
          <TouchableOpacity
            style={[
              styles.keyButtonSide,
              { opacity: pin.length > 0 ? 1 : 0.4 },
            ]}
            activeOpacity={0.65}
            onPress={handleClear}
            disabled={pin.length === 0}
          >
            <Text
              style={[
                styles.keySideText,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Clear
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.keyButton,
              isDark
                ? {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }
                : {
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                  },
            ]}
            activeOpacity={0.65}
            onPress={() => handleKeyPress("0")}
          >
            <Text style={[styles.keyDigit, isDark && { color: colors.text }]}>
              0
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.keyButtonSide,
              { opacity: pin.length > 0 ? 1 : 0.4 },
            ]}
            activeOpacity={0.65}
            onPress={handleDelete}
            disabled={pin.length === 0}
          >
            <Feather
              name="delete"
              size={22}
              color={isDark ? colors.text : "#0F172A"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Switch Account / Password fallback */}
      <View style={styles.footerSection}>
        <TouchableOpacity
          style={styles.switchAccountBtn}
          activeOpacity={0.7}
          onPress={onSwitchAccount}
        >
          <MaterialCommunityIcons
            name="rotate-3d-variant"
            size={14}
            color={isDark ? colors.accent : colors.primary}
          />
          <Text
            style={[
              styles.switchAccountText,
              { color: isDark ? colors.accent : colors.primary },
            ]}
          >
            Switch Account or Sign In with Password
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  topNavRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 6,
  },
  backNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSection: {
    alignItems: "center",
  },
  avatarWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EFF6FF",
    borderWidth: 2,
    borderColor: "rgba(37, 99, 235, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative",
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "800",
  },
  lockBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  pinInstruction: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 14,
    fontWeight: "500",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginVertical: 14,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  errorContainer: {
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  errorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#EF4444",
  },
  keypadContainer: {
    width: "100%",
    maxWidth: 340,
    alignSelf: "center",
    gap: 12,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keyDigit: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
  },
  keyLetters: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
    marginTop: -2,
  },
  keyButtonSide: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  keySideText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  footerSection: {
    alignItems: "center",
    marginTop: 8,
  },
  switchAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  switchAccountText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
