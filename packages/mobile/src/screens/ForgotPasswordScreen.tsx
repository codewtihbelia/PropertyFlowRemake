import React, { useState, useEffect } from "react";
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
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import { assets } from "../../assets/assets";

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
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
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
        {/* Top White Section */}
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
          {/* Header Navigation */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <View style={styles.backButtonIconCircle}>
              <Feather name="chevron-left" size={20} color="#0F172A" />
            </View>
            <Text style={styles.backButtonText}>Back</Text>
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

          {!isSent ? (
            <>
              <Text style={styles.mainTitle}>Forgot Password?</Text>
              <Text style={styles.description}>
                Don't worry! Enter the email associated with your Splitzy
                account and we'll send you a password recovery link.
              </Text>

              <View style={styles.formArea}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Feather
                      name="mail"
                      size={18}
                      color="#94A3B8"
                      style={styles.vectorIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. rommel.belia@example.com"
                      placeholderTextColor="#94A3B8"
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
              <View style={styles.successIconCircle}>
                <Ionicons
                  name="mail-unread-outline"
                  size={36}
                  color="#0F172A"
                />
              </View>

              <Text style={styles.successTitle}>Check Your Inbox</Text>
              <Text style={styles.successSubtitle}>
                We've sent a password reset link to:{"\n"}
                <Text style={styles.emailHighlight}>{email.trim()}</Text>
              </Text>

              <View style={styles.infoTipBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#2563EB"
                  style={{ marginTop: 2 }}
                />
                <Text style={styles.infoTipText}>
                  Click the link inside the email to choose a new password. If
                  you don't see it within a minute, please check your spam
                  folder.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.primaryActionButton}
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
                <Text style={styles.resendPrompt}>
                  Didn't receive the email?{" "}
                </Text>
                {countdown > 0 ? (
                  <Text style={styles.countdownText}>
                    Resend in {countdown}s
                  </Text>
                ) : (
                  <TouchableOpacity
                    onPress={handleSendReset}
                    disabled={loading}
                  >
                    <Text style={styles.resendLink}>Resend Email</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Bottom Blue Section with S-Curve wave */}
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
              { paddingBottom: Math.max(insets.bottom + 20, 36) },
            ]}
          >
            <Text style={styles.bottomNeedHelpText}>Need help signing in?</Text>
            <Text style={styles.bottomHelpSubtext}>
              Contact your apartment host or Splitzy support for identity
              verification.
            </Text>

            <TouchableOpacity
              style={styles.returnSignInBtn}
              onPress={onBack}
              activeOpacity={0.8}
            >
              <Text style={styles.returnSignInBtnText}>Return to Sign In</Text>
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
    gap: 10,
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
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
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
    borderRadius: 14,
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
    borderRadius: 12,
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
