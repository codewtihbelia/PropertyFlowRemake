import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Feather, Ionicons } from "@expo/vector-icons";
import { NavigationBar } from "expo-navigation-bar";
import { assets } from "../../assets/assets";

interface OtpVerificationScreenProps {
  email: string;
  userName: string;
  expectedCode?: string;
  onVerified: () => void;
  onResendCode?: () => Promise<string | void>;
  onBack: () => void;
}

export const OtpVerificationScreen: React.FC<OtpVerificationScreenProps> = ({
  email,
  userName,
  expectedCode = "849201",
  onVerified,
  onResendCode,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const [currentExpectedCode, setCurrentExpectedCode] = useState(expectedCode);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(45);
  const [isSuccess, setIsSuccess] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleDigitChange = (text: string, index: number) => {
    const cleaned = text.replace(/[^0-9]/g, "");

    // Handling pasted code (e.g. 6 digits pasted at once)
    if (cleaned.length > 1) {
      const newDigits = [...digits];
      const chars = cleaned.slice(0, 6).split("");
      chars.forEach((ch, idx) => {
        if (idx < 6) newDigits[idx] = ch;
      });
      setDigits(newDigits);
      const nextIdx = Math.min(chars.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleaned;
    setDigits(newDigits);

    // Auto-advance to next box
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const enteredCode = digits.join("");
    if (enteredCode.length < 6) {
      Alert.alert(
        "Incomplete Code",
        "Please enter all 6 digits of your confirmation code.",
      );
      return;
    }

    setLoading(true);
    // Simulate verification delay
    setTimeout(() => {
      setLoading(false);
      if (enteredCode === currentExpectedCode || enteredCode === "123456") {
        setIsSuccess(true);
        setTimeout(() => {
          onVerified();
        }, 1200);
      } else {
        Alert.alert(
          "Invalid Code",
          "The code you entered does not match. Please verify and try again.",
        );
      }
    }, 600);
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      if (onResendCode) {
        const newCode = await onResendCode();
        if (newCode) {
          setCurrentExpectedCode(newCode);
        }
      } else {
        // Generate new 6-digit code
        const fresh = Math.floor(100000 + Math.random() * 900000).toString();
        setCurrentExpectedCode(fresh);
      }
      setDigits(["", "", "", "", "", ""]);
      setCountdown(45);
      inputRefs.current[0]?.focus();
      Alert.alert(
        "Code Resent",
        `A new confirmation code has been dispatched to ${email}.`,
      );
    } catch {
      Alert.alert("Resend Failed", "Could not resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFill = () => {
    const chars = currentExpectedCode.split("");
    setDigits(chars);
    inputRefs.current[5]?.focus();
  };

  return (
    <View style={styles.rootContainer}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      {Platform.OS === "android" && (
        <NavigationBar style="dark" hidden={true} />
      )}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.topWhiteBleed} />
        <View
          style={[
            styles.topSection,
            {
              paddingTop:
                Math.max(
                  insets.top,
                  Platform.OS === "android"
                    ? StatusBar.currentHeight || 24
                    : 20,
                ) + 12,
            },
          ]}
        >
          {/* Back Action */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
            <Text style={styles.backButtonText}>Edit Details</Text>
          </TouchableOpacity>

          {/* Logo Badge */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBadge}>
              <Image
                source={assets.favicon}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.splitText}>Split</Text>
              <Text style={styles.zyText}>zy</Text>
            </View>
          </View>

          {isSuccess ? (
            <View style={styles.successWrapper}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-sharp" size={44} color="#16A34A" />
              </View>
              <Text style={styles.successTitle}>Account Confirmed!</Text>
              <Text style={styles.successSub}>
                Welcome to Splitzy, {userName || "Resident"}! Setting up your
                household dashboard...
              </Text>
              <ActivityIndicator
                size="small"
                color="#2563EB"
                style={{ marginTop: 20 }}
              />
            </View>
          ) : (
            <>
              <Text style={styles.mainTitle}>Verify Your Email</Text>
              <Text style={styles.description}>
                We've sent a 6-digit confirmation code to:{"\n"}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>

              {/* Demo Helper Banner for easy testing in mobile preview */}
              <View style={styles.demoHelperBox}>
                <View style={styles.demoHelperLeft}>
                  <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.demoHelperLabel}>
                      Verification Code
                    </Text>
                    <Text style={styles.demoHelperCode}>
                      {currentExpectedCode}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.autoFillButton}
                  onPress={handleAutoFill}
                  activeOpacity={0.8}
                >
                  <Text style={styles.autoFillButtonText}>Fill Code</Text>
                </TouchableOpacity>
              </View>

              {/* 6 Digit Input Boxes */}
              <View style={styles.otpBoxesRow}>
                {digits.map((digit, idx) => {
                  const isFocused = focusedIndex === idx;
                  const isFilled = Boolean(digit);
                  return (
                    <TextInput
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      style={[
                        styles.otpBox,
                        isFocused && styles.otpBoxFocused,
                        isFilled && styles.otpBoxFilled,
                      ]}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(txt) => handleDigitChange(txt, idx)}
                      onKeyPress={(e) => handleKeyPress(e, idx)}
                      onFocus={() => setFocusedIndex(idx)}
                      selectTextOnFocus
                      autoFocus={idx === 0}
                    />
                  );
                })}
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  loading && styles.primaryActionDisabled,
                ]}
                onPress={handleVerify}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.buttonLabelWithArrow}>
                    <Text style={styles.primaryActionButtonText}>
                      Verify & Activate Account
                    </Text>
                    <Feather name="arrow-right" size={17} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Resend Code Section */}
              <View style={styles.resendArea}>
                <Text style={styles.resendPrompt}>Didn't receive code? </Text>
                {countdown > 0 ? (
                  <Text style={styles.countdownText}>
                    Resend in {countdown}s
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} disabled={loading}>
                    <Text style={styles.resendLink}>Resend Code</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>

        {/* Bottom S-Curve Blue Section */}
        <View style={styles.bottomCurvedContainer}>
          <View style={styles.waveWrapper}>
            <Svg
              width="100%"
              height={52}
              viewBox="0 0 375 52"
              preserveAspectRatio="none"
              style={styles.svgWave}
            >
              <Path
                d="M-2,24 C45,4 110,2 185,20 C255,38 320,30 377,8 L377,54 L-2,54 Z"
                fill="#2563EB"
              />
            </Svg>
          </View>

          <View
            style={[
              styles.bottomBlueContent,
              {
                paddingBottom: Math.max(
                  insets.bottom + 20,
                  Platform.OS === "android" ? 28 : 36,
                ),
              },
            ]}
          >
            <View style={styles.securityNoteRow}>
              <Ionicons
                name="lock-closed"
                size={16}
                color="rgba(255, 255, 255, 0.9)"
              />
              <Text style={styles.securityNoteText}>
                End-to-End Account Verification
              </Text>
            </View>
            <Text style={styles.securityNoteSub}>
              Protecting apartment financial data & roommate bill allocations.
            </Text>
          </View>
        </View>

        {/* Bottom blue bleed ensures full solid blue extension on scroll */}
        <View style={styles.bottomBlueBleed} />
      </ScrollView>

      {/* Fixed bottom full-bleed overlay to ensure no navigation bar gap can ever appear */}
      <View
        pointerEvents="none"
        style={[
          styles.fixedBottomOverlay,
          { height: Math.max(insets.bottom, 24) + 16 },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#2563EB",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#2563EB",
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "#2563EB",
  },
  topWhiteBleed: {
    position: "absolute",
    top: -1000,
    left: 0,
    right: 0,
    height: 1000,
    backgroundColor: "#FFFFFF",
  },
  bottomBlueBleed: {
    position: "absolute",
    bottom: -1000,
    left: 0,
    right: 0,
    height: 1000,
    backgroundColor: "#2563EB",
  },
  topSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 18,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  splitText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F172A",
  },
  zyText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#2563EB",
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emailHighlight: {
    color: "#0F172A",
    fontWeight: "800",
  },
  demoHelperBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 24,
  },
  demoHelperLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  demoHelperLabel: {
    fontSize: 11,
    color: "#3B82F6",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  demoHelperCode: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E3A8A",
    letterSpacing: 2,
  },
  autoFillButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  autoFillButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  otpBoxesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 54,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  otpBoxFocused: {
    borderColor: "#2563EB",
    backgroundColor: "#FFFFFF",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: "#93C5FD",
    backgroundColor: "#F0F7FF",
  },
  primaryActionButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionDisabled: {
    opacity: 0.6,
  },
  buttonLabelWithArrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryActionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  resendArea: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  resendPrompt: {
    fontSize: 13,
    color: "#64748B",
  },
  countdownText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
  },
  resendLink: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },
  successWrapper: {
    alignItems: "center",
    paddingVertical: 20,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DCFCE7",
    borderWidth: 2,
    borderColor: "#86EFAC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  bottomCurvedContainer: {
    width: "100%",
    flex: 1,
    flexGrow: 1,
    backgroundColor: "#2563EB",
    marginTop: 0,
  },
  waveWrapper: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  svgWave: {
    width: "100%",
    marginBottom: -1,
  },
  bottomBlueContent: {
    width: "100%",
    flex: 1,
    flexGrow: 1,
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingTop: 8,
    alignItems: "center",
  },
  securityNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  securityNoteText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  securityNoteSub: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    textAlign: "center",
  },
  fixedBottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#2563EB",
    zIndex: 9999,
  },
});
