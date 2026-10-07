import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Feather, Ionicons } from "@expo/vector-icons";
import { NavigationBar } from "../utils/safeNavigationBar";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import { assets } from "../../assets/assets";
import { useTheme } from "../context/ThemeContext";

interface ForgotPasswordScreenProps {
  initialEmail?: string;
  onBack: () => void;
  onSuccess?: (email: string) => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  initialEmail = "",
  onBack,
  onSuccess,
}) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const bottomBgColor = isDark ? "#141C2B" : "#2563EB";

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  const handleSendReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Required", "Please enter your registered email address.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setIsSent(true);
      setCountdown(45);
      if (onSuccess) onSuccess(trimmed);
    } catch (err: any) {
      let msg = "Could not send password reset instructions.";
      if (err.code === "auth/user-not-found") {
        msg = "No account found with this email address.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please provide a valid email address.";
      } else if (err.message) {
        msg = err.message;
      }
      Alert.alert("Reset Notice", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.rootContainer, { backgroundColor: bottomBgColor }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent={true}
      />
      {Platform.OS === "android" && (
        <NavigationBar style="light" hidden={false} />
      )}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          style={[styles.scrollView, { backgroundColor: bottomBgColor }]}
          contentContainerStyle={[
            styles.scrollContent,
            {
              backgroundColor: bottomBgColor,
              paddingBottom: Math.max(90, insets.bottom + 50),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View
            style={[
              styles.topWhiteBleed,
              isDark && { backgroundColor: colors.background },
            ]}
          />
          {/* Top Section */}
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
              isDark && { backgroundColor: colors.background },
            ]}
          >
            {/* Header Navigation */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.backButtonIconCircle,
                  isDark && {
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Feather
                  name="chevron-left"
                  size={20}
                  color={isDark ? colors.text : "#0F172A"}
                />
              </View>
              <Text
                style={[
                  styles.backButtonText,
                  isDark && { color: colors.text },
                ]}
              >
                Back
              </Text>
            </TouchableOpacity>

            {/* Logo Badge */}
            <View style={styles.logoContainer}>
              <View style={styles.logoBadge}>
                <Image
                  source={assets.sBlueLogo}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.brandTitleRow}>
                <Text
                  style={[styles.splitText, isDark && { color: colors.text }]}
                >
                  Split
                </Text>
                <Text
                  style={[styles.zyText, isDark && { color: colors.primary }]}
                >
                  zy
                </Text>
              </View>
            </View>

            {!isSent ? (
              <>
                <Text
                  style={[styles.mainTitle, isDark && { color: colors.text }]}
                >
                  Forgot Password?
                </Text>
                <Text
                  style={[
                    styles.description,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Don't worry! Enter the email associated with your Splitzy
                  account and we'll send you a password recovery link.
                </Text>

                <View style={styles.formArea}>
                  <View style={styles.fieldGroup}>
                    <Text
                      style={[
                        styles.inputLabel,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      Email Address
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        isDark && {
                          backgroundColor: colors.surfaceInset,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Feather
                        name="mail"
                        size={18}
                        color={isDark ? colors.textMuted : "#94A3B8"}
                        style={styles.vectorIcon}
                      />
                      <TextInput
                        style={[
                          styles.textInput,
                          isDark && { color: colors.text },
                        ]}
                        placeholder="e.g. rommel.belia@example.com"
                        placeholderTextColor={
                          isDark ? colors.textMuted : "#94A3B8"
                        }
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoFocus
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryActionButton,
                      isDark && {
                        backgroundColor: colors.primary,
                        shadowColor: colors.primary,
                      },
                      loading && styles.primaryActionDisabled,
                    ]}
                    onPress={handleSendReset}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <View style={styles.buttonLabelWithArrow}>
                        <Text style={styles.primaryActionButtonText}>
                          Send Reset Link
                        </Text>
                        <Feather name="send" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.successCard}>
                <View
                  style={[
                    styles.successIconCircle,
                    isDark && {
                      backgroundColor: "rgba(59, 130, 246, 0.16)",
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="mail-unread-outline"
                    size={36}
                    color={isDark ? colors.accent : "#0F172A"}
                  />
                </View>

                <Text
                  style={[
                    styles.successTitle,
                    isDark && { color: colors.text },
                  ]}
                >
                  Check Your Inbox
                </Text>
                <Text
                  style={[
                    styles.successSubtitle,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  We've sent a password reset link to:{"\n"}
                  <Text
                    style={[
                      styles.emailHighlight,
                      isDark && { color: colors.text },
                    ]}
                  >
                    {email.trim()}
                  </Text>
                </Text>

                <View
                  style={[
                    styles.infoTipBox,
                    isDark && {
                      backgroundColor: "rgba(16, 185, 129, 0.14)",
                      borderColor: "rgba(16, 185, 129, 0.3)",
                    },
                  ]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={isDark ? "#34D399" : "#2563EB"}
                    style={{ marginTop: 2 }}
                  />
                  <Text
                    style={[styles.infoTipText, isDark && { color: "#34D399" }]}
                  >
                    Click the link inside the email to choose a new password. If
                    you don't see it within a minute, please check your spam
                    folder.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryActionButton,
                    isDark && {
                      backgroundColor: colors.primary,
                      shadowColor: colors.primary,
                    },
                  ]}
                  onPress={onBack}
                  activeOpacity={0.88}
                >
                  <View style={styles.buttonLabelWithArrow}>
                    <Text style={styles.primaryActionButtonText}>
                      Back to Sign In
                    </Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                <View style={styles.resendArea}>
                  <Text
                    style={[
                      styles.resendPrompt,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Didn't receive the email?{" "}
                  </Text>
                  {countdown > 0 ? (
                    <Text
                      style={[
                        styles.countdownText,
                        isDark && { color: colors.textMuted },
                      ]}
                    >
                      Resend in {countdown}s
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={handleSendReset}
                      disabled={loading}
                    >
                      <Text
                        style={[
                          styles.resendLink,
                          isDark && { color: colors.accent },
                        ]}
                      >
                        Resend Email
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Bottom Section with S-Curve wave */}
          <View
            style={[
              styles.bottomCurvedContainer,
              { backgroundColor: bottomBgColor },
            ]}
          >
            <View
              style={[
                styles.waveWrapper,
                isDark && { backgroundColor: colors.background },
              ]}
            >
              <Svg
                width="100%"
                height={52}
                viewBox="0 0 375 52"
                preserveAspectRatio="none"
                style={styles.svgWave}
              >
                <Path
                  d="M-2,24 C45,4 110,2 185,20 C255,38 320,30 377,8 L377,54 L-2,54 Z"
                  fill={bottomBgColor}
                />
              </Svg>
            </View>

            <View
              style={[
                styles.bottomBlueContent,
                {
                  backgroundColor: bottomBgColor,
                  paddingBottom: Math.max(insets.bottom + 20, 36),
                },
              ]}
            >
              <Text style={styles.bottomNeedHelpText}>
                Need help signing in?
              </Text>
              <Text
                style={[
                  styles.bottomHelpSubtext,
                  isDark && { color: "rgba(255, 255, 255, 0.7)" },
                ]}
              >
                Contact your apartment host or Splitzy support for identity
                verification.
              </Text>

              <TouchableOpacity
                style={[
                  styles.returnSignInBtn,
                  isDark && {
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    borderColor: "rgba(255, 255, 255, 0.18)",
                  },
                ]}
                onPress={onBack}
                activeOpacity={0.8}
              >
                <Text style={styles.returnSignInBtnText}>
                  Return to Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom bleed ensures full solid extension on scroll */}
          <View
            style={[styles.bottomBlueBleed, { backgroundColor: bottomBgColor }]}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed bottom full-bleed overlay to ensure no navigation bar gap can ever appear */}
      <View
        pointerEvents="none"
        style={[
          styles.fixedBottomOverlay,
          {
            backgroundColor: bottomBgColor,
            height: Math.max(insets.bottom, 24) + 16,
          },
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
    gap: 8,
    marginBottom: 16,
  },
  backButtonIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
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
    gap: 4,
    marginBottom: 20,
  },
  logoBadge: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 60,
    height: 60,
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
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  formArea: {
    width: "100%",
  },
  fieldGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 50,
    paddingHorizontal: 14,
    height: 50,
  },
  vectorIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    height: "100%",
  },
  primaryActionButton: {
    width: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
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
  successCard: {
    alignItems: "center",
    paddingTop: 10,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
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
  successSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  emailHighlight: {
    color: "#0F172A",
    fontWeight: "800",
  },
  infoTipBox: {
    flexDirection: "row",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  infoTipText: {
    flex: 1,
    fontSize: 12,
    color: "#166534",
    lineHeight: 18,
  },
  resendArea: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
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
  bottomNeedHelpText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  bottomHelpSubtext: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  returnSignInBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  returnSignInBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
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
