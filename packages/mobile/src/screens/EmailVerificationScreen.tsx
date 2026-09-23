import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  AppState,
  AppStateStatus,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Feather, Ionicons } from "@expo/vector-icons";
import { NavigationBar } from "expo-navigation-bar";
import { auth } from "../firebase/config";
import { sendEmailVerification } from "firebase/auth";
import { assets } from "../../assets/assets";

interface EmailVerificationScreenProps {
  email: string;
  userName?: string;
  onVerified: () => void;
  onBack: () => void;
}

export const EmailVerificationScreen: React.FC<
  EmailVerificationScreenProps
> = ({ email, userName, onVerified, onBack }) => {
  const insets = useSafeAreaInsets();
  const [isVerified, setIsVerified] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(45);
  const [resending, setResending] = useState(false);
  const hasTriggeredRef = useRef(false);

  // 1. Resend timer countdown
  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // 2. Continuous polling & AppState foreground listener
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      if (hasTriggeredRef.current) return;
      try {
        if (!auth.currentUser) return;
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          if (isMounted) {
            setIsVerified(true);
          }
          setTimeout(() => {
            onVerified();
          }, 800);
        }
      } catch (err) {
        // Silent reload error
      }
    };

    // Polling every 2.5s
    const interval = setInterval(checkStatus, 2500);

    // Immediate check when user switches back into the app
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          checkStatus();
        }
      },
    );

    return () => {
      isMounted = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [onVerified]);

  const handleManualCheck = async () => {
    if (checking || hasTriggeredRef.current) return;
    setChecking(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          setIsVerified(true);
          setTimeout(() => {
            onVerified();
          }, 600);
          return;
        }
      }
      Alert.alert(
        "Not Yet Verified",
        "We haven't detected your email verification yet. Please open your email inbox, tap the verification link, and then tap this button again.",
      );
    } catch (err: any) {
      Alert.alert(
        "Verification Check",
        "Could not verify status. Please check your network connection and try again.",
      );
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || resending) return;
    setResending(true);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      }
      setResendCountdown(45);
      Alert.alert(
        "Verification Email Sent",
        `A fresh verification link has been dispatched to ${email}. Please check your inbox and spam folder.`,
      );
    } catch (err: any) {
      Alert.alert(
        "Notice",
        err.message || "Failed to resend verification email.",
      );
    } finally {
      setResending(false);
    }
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
        {/* Top Header Card */}
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
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color="#1E293B" />
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

          {/* Main Illustration Badge */}
          <View style={styles.illustrationWrap}>
            <View
              style={[
                styles.iconCircle,
                isVerified ? styles.iconCircleSuccess : styles.iconCircleActive,
              ]}
            >
              <Ionicons
                name={isVerified ? "checkmark-circle" : "mail"}
                size={44}
                color={isVerified ? "#059669" : "#2563EB"}
              />
            </View>
          </View>

          {/* Title & Description */}
          <Text style={styles.titleText}>
            {isVerified ? "Email Verified!" : "Verify Your Email"}
          </Text>

          <Text style={styles.bodyDescription}>
            {isVerified
              ? "Your account has been confirmed! Redirecting to your dashboard..."
              : `We've sent a verification link to:\n`}
            {!isVerified && <Text style={styles.boldEmail}>{email}</Text>}
          </Text>

          {/* Verified Success Box */}
          {isVerified ? (
            <View style={styles.verifiedSuccessBox}>
              <Ionicons name="checkmark-circle" size={22} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.verifiedTitle}>Email Confirmed!</Text>
                <Text style={styles.verifiedSubtitle}>
                  Opening your dashboard now...
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => onVerified()}
                style={{
                  backgroundColor: "#059669",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}
                >
                  Open →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Step Instructions Card */}
              <View style={styles.instructionsCard}>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumBadge}>
                    <Text style={styles.stepNumText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Open your email inbox (check Spam if needed).
                  </Text>
                </View>

                <View style={styles.stepRow}>
                  <View style={styles.stepNumBadge}>
                    <Text style={styles.stepNumText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Click the verification link from Splitzy.
                  </Text>
                </View>

                <View style={styles.stepRow}>
                  <View style={styles.stepNumBadge}>
                    <Text style={styles.stepNumText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Return here — verification is detected automatically.
                  </Text>
                </View>
              </View>

              {/* Real-time Listening Pill */}
              <View style={styles.statusPill}>
                <View style={styles.pulseDot} />
                <Text style={styles.statusPillText}>
                  Waiting for verification link click...
                </Text>
              </View>

              {/* Manual Confirmation Button */}
              <TouchableOpacity
                style={styles.primaryCheckBtn}
                onPress={handleManualCheck}
                disabled={checking}
                activeOpacity={0.88}
              >
                {checking ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnRow}>
                    <Text style={styles.primaryCheckBtnText}>
                      I've Clicked the Link
                    </Text>
                    <Feather name="check" size={17} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Resend Action */}
              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResend}
                disabled={resendCountdown > 0 || resending}
                activeOpacity={0.7}
              >
                {resending ? (
                  <ActivityIndicator color="#2563EB" size="small" />
                ) : (
                  <Text
                    style={[
                      styles.resendBtnText,
                      resendCountdown > 0 && styles.resendBtnDisabled,
                    ]}
                  >
                    {resendCountdown > 0
                      ? `Resend email in ${resendCountdown}s`
                      : "Resend Verification Email"}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Bottom Curved Wave Container */}
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
            <TouchableOpacity
              style={styles.returnToAuthBtn}
              onPress={onBack}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={15} color="#FFFFFF" />
              <Text style={styles.returnToAuthText}>Return to Sign In</Text>
            </TouchableOpacity>
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
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    alignSelf: "flex-start",
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  logoImage: {
    width: 22,
    height: 22,
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  splitText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  zyText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: -0.5,
  },
  illustrationWrap: {
    marginTop: 8,
    marginBottom: 16,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 2,
    borderColor: "#BFDBFE",
  },
  iconCircleSuccess: {
    backgroundColor: "#ECFDF5",
    borderWidth: 2,
    borderColor: "#A7F3D0",
  },
  titleText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  bodyDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
    maxWidth: 320,
  },
  boldEmail: {
    fontWeight: "700",
    color: "#0F172A",
  },
  instructionsCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
    fontWeight: "500",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 16,
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E40AF",
  },
  primaryCheckBtn: {
    width: "100%",
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryCheckBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  resendBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  resendBtnDisabled: {
    color: "#94A3B8",
    fontWeight: "500",
  },
  verifiedSuccessBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    padding: 16,
    marginVertical: 12,
  },
  verifiedTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#065F46",
  },
  verifiedSubtitle: {
    fontSize: 12,
    color: "#047857",
    marginTop: 2,
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
    paddingTop: 12,
    alignItems: "center",
  },
  returnToAuthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  returnToAuthText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
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
