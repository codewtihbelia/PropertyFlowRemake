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
  useWindowDimensions,
  Image,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationBar } from "../utils/safeNavigationBar";
import Svg, { Path } from "react-native-svg";
import { auth } from "../firebase/config";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { mobileDataService } from "../services/firebaseDataService";
import { assets } from "../../assets/assets";
import { Feather, Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { BlurView } from "expo-blur";
import { authPinService, StoredPinUser } from "../services/authPinService";
import { AuthPinScreen } from "./AuthPinScreen";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import { EmailVerificationScreen } from "./EmailVerificationScreen";
import { OtpVerificationScreen } from "./OtpVerificationScreen";
import { TermsOfServiceScreen } from "./TermsOfServiceScreen";
import { PrivacyPolicyScreen } from "./PrivacyPolicyScreen";

interface AuthScreenProps {
  onLoginSuccess: (user: {
    uid: string;
    displayName: string;
    email: string;
    role?: string;
    isNewSignup?: boolean;
  }) => void;
  initialTab?: "signin" | "signup";
  onBackToSavedProfile?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  initialTab,
  onBackToSavedProfile,
}) => {
  const { isDark, colors, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [authView, setAuthView] = useState<
    | "auth"
    | "pin_auth"
    | "forgot_password"
    | "email_verification"
    | "otp_verification"
    | "terms_of_service"
    | "privacy_policy"
  >("auth");
  const [activeTab, setActiveTab] = useState<"signin" | "signup">(
    initialTab || "signin",
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<{
    fbUser: any;
    name: string;
    email: string;
    role: string;
  } | null>(null);

  const bottomBgColor = isDark ? "#141C2B" : "#2563EB";

  const googleAndroidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined;
  const googleWebClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined;
  const googleIosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined;

  const isGoogleConfigured = Boolean(
    Platform.OS === "android"
      ? googleAndroidClientId || googleWebClientId
      : googleIosClientId || googleWebClientId,
  );

  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setStyle("light");
      NavigationBar.setHidden(true);

      return () => {
        NavigationBar.setStyle(isDark ? "light" : "dark");
        NavigationBar.setHidden(true);
      };
    }
  }, [isDark]);

  const completeLogin = async (
    fbUser: any,
    fallbackRole: string = "PAYOR",
    isNewSignup: boolean = false,
  ) => {
    try {
      const existingProfile = await Promise.race([
        mobileDataService.getUserProfile(fbUser.uid),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
      const displayName =
        existingProfile?.displayName ||
        fbUser.displayName ||
        name.trim() ||
        fbUser.email ||
        "Resident";
      const userRole =
        existingProfile?.role === "SUPER_ADMIN"
          ? "SUPER_ADMIN"
          : existingProfile?.role === "HOST" ||
              existingProfile?.hostApplicationStatus === "APPROVED"
            ? "HOST"
            : existingProfile?.role || fallbackRole;

      // Non-blocking sync to cloud so dashboard navigation is immediate
      mobileDataService
        .syncUserProfile({
          uid: fbUser.uid,
          displayName,
          email: fbUser.email || email.trim(),
          role: userRole,
        })
        .catch((e) => console.warn("Background syncUserProfile warning:", e));

      // Cache session password in authPinService for secure PIN credential encryption if user chooses to save
      if (password) {
        authPinService.setSessionPassword(fbUser.uid, password);
      }

      await onLoginSuccess({
        uid: fbUser.uid,
        displayName,
        email: fbUser.email || email.trim(),
        role: userRole,
        isNewSignup,
      });
    } catch (err) {
      console.warn("completeLogin fallback warning:", err);
      await onLoginSuccess({
        uid: fbUser.uid,
        displayName:
          fbUser.displayName || name.trim() || fbUser.email || "Resident",
        email: fbUser.email || email.trim(),
        role: fallbackRole,
        isNewSignup,
      });
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Validation Error", "Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (activeTab === "signup") {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        const fbUser = userCredential.user;

        if (name.trim()) {
          try {
            await updateProfile(fbUser, { displayName: name.trim() });
          } catch (e) {
            console.log("Profile name update notice:", e);
          }
        }

        try {
          await sendEmailVerification(fbUser);
        } catch (e) {
          console.log("Email verification dispatch notice:", e);
        }

        setPendingSignup({
          fbUser,
          name: name.trim(),
          email: email.trim(),
          role: "PAYOR",
        });
        setAuthView("email_verification");
      } else {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );

        // Complete login directly with primary credentials (email & password)
        await completeLogin(userCredential.user, "PAYOR");
      }
    } catch (err: any) {
      let message = err.message || "Authentication failed. Please try again.";
      if (err.code === "auth/user-not-found")
        message = "No account found with this email.";
      if (err.code === "auth/wrong-password")
        message = "Incorrect password. Please try again.";
      if (err.code === "auth/email-already-in-use")
        message = "This email is already registered. Please sign in.";
      if (err.code === "auth/invalid-email")
        message = "Please enter a valid email address.";
      Alert.alert("Authentication Notice", message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isGoogleConfigured) {
      Alert.alert(
        "Google Sign-In Setup Required",
        "To enable Google Sign-In on Android, please configure EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in packages/mobile/.env.\n\nIn the meantime, you can sign in directly using Email & Password!",
      );
      return;
    }

    setGoogleLoading(true);
    try {
      const AuthSession = require("expo-auth-session");
      const WebBrowser = require("expo-web-browser");
      if (typeof WebBrowser.maybeCompleteAuthSession === "function") {
        WebBrowser.maybeCompleteAuthSession();
      }
      // Note: For browser-based OAuth endpoints (expo-auth-session), Google requires a Web Client ID.
      // Passing an Android-specific client ID to accounts.google.com/o/oauth2/v2/auth triggers Error 400: invalid_request.
      const clientId =
        googleWebClientId ||
        (Platform.OS === "android" ? googleAndroidClientId : googleIosClientId);

      // Use the registered redirect URI matching Google Cloud Console:
      // Google Cloud has 'https://auth.expo.io/@splitzy01/splitzy-mobile' registered
      const configuredRedirectUri =
        process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI?.trim();
      const redirectUri =
        configuredRedirectUri ||
        (Platform.OS === "web"
          ? AuthSession.makeRedirectUri()
          : "https://auth.expo.io/@splitzy01/splitzy-mobile");

      const discovery = {
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
        revocationEndpoint: "https://oauth2.googleapis.com/revoke",
      };
      const request = new AuthSession.AuthRequest({
        clientId: clientId!,
        scopes: ["openid", "profile", "email"],
        redirectUri,
        responseType: AuthSession.ResponseType.IdToken,
        usePKCE: false,
        extraParams: {
          nonce: Math.random().toString(36).substring(2, 12),
          prompt: "select_account",
        },
      });
      const result = await request.promptAsync(discovery);
      if (result.type !== "success") return;

      const idToken = result.params?.id_token;
      if (!idToken) throw new Error("Google did not return an ID token.");

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      await completeLogin(userCredential.user, "PAYOR");
    } catch (err: any) {
      Alert.alert(
        "Google Sign-In Failed",
        err.message || "Unable to sign in with Google.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = () => {
    Alert.alert(
      "Apple Sign-In",
      "Apple Sign-In is supported on registered iOS devices.",
    );
  };

  if (authView === "forgot_password") {
    return (
      <ForgotPasswordScreen
        initialEmail={email}
        onBack={() => setAuthView("auth")}
        onSuccess={(confirmedEmail) => {
          setEmail(confirmedEmail);
        }}
      />
    );
  }

  if (authView === "email_verification" && pendingSignup) {
    return (
      <EmailVerificationScreen
        email={pendingSignup.email}
        userName={pendingSignup.name}
        onVerified={async () => {
          try {
            await completeLogin(pendingSignup.fbUser, pendingSignup.role, true);
          } catch (e) {
            console.warn("onVerified completeLogin notice:", e);
            onLoginSuccess({
              uid: pendingSignup.fbUser.uid,
              displayName: pendingSignup.name || "Resident",
              email: pendingSignup.email,
              role: pendingSignup.role,
              isNewSignup: true,
            });
          }
        }}
        onBack={() => {
          setAuthView("auth");
          setActiveTab("signin");
        }}
      />
    );
  }

  if (authView === "otp_verification") {
    return (
      <OtpVerificationScreen
        email={email}
        userName={name.trim() || "Resident"}
        onVerified={async () => {
          if (pendingSignup) {
            try {
              await completeLogin(pendingSignup.fbUser, pendingSignup.role);
            } catch (e) {
              console.warn("onVerified completeLogin notice:", e);
              onLoginSuccess({
                uid: pendingSignup.fbUser.uid,
                displayName: pendingSignup.name || "Resident",
                email: pendingSignup.email,
                role: pendingSignup.role,
              });
            }
          } else {
            onLoginSuccess({
              uid: "resident-verified",
              displayName: name.trim() || "Resident",
              email: email,
              role: "PAYOR",
            });
          }
        }}
        onBack={() => {
          setAuthView("auth");
          setActiveTab("signin");
        }}
      />
    );
  }

  if (authView === "terms_of_service") {
    return (
      <TermsOfServiceScreen
        onBack={() => setAuthView("auth")}
        showAcceptButton={activeTab === "signup"}
        onAccept={() => setAuthView("auth")}
      />
    );
  }

  if (authView === "privacy_policy") {
    return (
      <PrivacyPolicyScreen
        onBack={() => setAuthView("auth")}
        showAcknowledgeButton={activeTab === "signup"}
        onAcknowledge={() => setAuthView("auth")}
      />
    );
  }

  return (
    <View style={[styles.rootContainer, { backgroundColor: bottomBgColor }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent={true}
      />
      {Platform.OS === "android" && (
        <NavigationBar style="light" hidden={true} />
      )}
      <ScrollView
        style={[styles.scrollView, { backgroundColor: bottomBgColor }]}
        contentContainerStyle={[
          styles.scrollContent,
          { backgroundColor: bottomBgColor },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top bleed ensures no blue sliver on drag */}
        <View
          style={[
            styles.topWhiteBleed,
            isDark && { backgroundColor: colors.background },
          ]}
        />

        {/* ================= TOP / UPPER SECTION ================= */}
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
                ) + 16,
            },
            isDark && { backgroundColor: colors.background },
          ]}
        >
          {/* Top Bar with Brand and Theme Toggle */}
          <View style={styles.topBarRow}>
            {onBackToSavedProfile ? (
              <TouchableOpacity
                style={styles.backToSavedBtn}
                onPress={onBackToSavedProfile}
                activeOpacity={0.7}
                accessibilityLabel="Back to saved profile"
              >
                <Feather
                  name="arrow-left"
                  size={20}
                  color={isDark ? colors.text : "#0F172A"}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.topBarSpacer} />
            )}

            {/* Logo Badge */}
            <View style={styles.logoContainer}>
              <View style={styles.logoBadge}>
                <Image
                  source={assets.sBlueLogo}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>

              {/* App Title */}
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

            {/* Theme Toggle Button */}
            <TouchableOpacity
              style={[
                styles.themeToggleBtn,
                isDark && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={toggleTheme}
              activeOpacity={0.7}
              accessibilityLabel="Toggle Theme"
            >
              <Feather
                name={isDark ? "sun" : "moon"}
                size={18}
                color={isDark ? "#F59E0B" : "#64748B"}
              />
            </TouchableOpacity>
          </View>

          {/* Tagline */}
          <Text
            style={[styles.tagline, isDark && { color: colors.textSecondary }]}
          >
            Manage, split bills, and track group expenses{"\n"}effortlessly.
          </Text>

          {/* Form Fields */}
          <View style={styles.formArea}>
            {activeTab === "signup" && (
              <View style={styles.fieldGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Full Name
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
                    name="user"
                    size={17}
                    color={isDark ? colors.textMuted : "#94A3B8"}
                    style={styles.vectorIcon}
                  />
                  <TextInput
                    style={[styles.textInput, isDark && { color: colors.text }]}
                    placeholder="Rommel Belia"
                    placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            {/* Email Address */}
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
                  size={17}
                  color={isDark ? colors.textMuted : "#94A3B8"}
                  style={styles.vectorIcon}
                />
                <TextInput
                  style={[styles.textInput, isDark && { color: colors.text }]}
                  placeholder="rommel.belia@example.com"
                  placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <View style={styles.passwordLabelRow}>
                <Text
                  style={[
                    styles.inputLabel,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Password
                </Text>
                {activeTab === "signin" && (
                  <TouchableOpacity
                    onPress={() => setAuthView("forgot_password")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.forgotPasswordText,
                        isDark && { color: colors.accent },
                      ]}
                    >
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

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
                  name="lock"
                  size={17}
                  color={isDark ? colors.textMuted : "#94A3B8"}
                  style={styles.vectorIcon}
                />
                <TextInput
                  style={[styles.textInput, isDark && { color: colors.text }]}
                  placeholder="Enter password"
                  placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.6}
                >
                  <Feather
                    name={showPassword ? "eye" : "eye-off"}
                    size={17}
                    color={isDark ? colors.textMuted : "#94A3B8"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Primary Action Button ("Sign In ->" or "Sign Up ->") */}
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                isDark && {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                },
                (loading || googleLoading) && styles.primaryActionDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || googleLoading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.buttonLabelWithArrow}>
                  <Text style={styles.primaryActionButtonText}>
                    {activeTab === "signin" ? "Sign In" : "Sign Up"}
                  </Text>
                  <Feather name="arrow-right" size={17} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ================= BOTTOM SECTION WITH FLUID WAVY TOP ================= */}
        <View
          style={[
            styles.bottomCurvedContainer,
            { backgroundColor: bottomBgColor },
          ]}
        >
          {/* Fluid S-Curve SVG Wave */}
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
                paddingBottom: Math.max(insets.bottom + 36, 56),
              },
            ]}
          >
            {/* Divider "OR CONTINUE WITH" */}
            <View style={styles.orDividerContainer}>
              <View
                style={[
                  styles.orDividerLine,
                  isDark && { backgroundColor: "rgba(255, 255, 255, 0.12)" },
                ]}
              />
              <Text
                style={[
                  styles.orDividerText,
                  isDark && { color: "rgba(255, 255, 255, 0.65)" },
                ]}
              >
                OR CONTINUE WITH
              </Text>
              <View
                style={[
                  styles.orDividerLine,
                  isDark && { backgroundColor: "rgba(255, 255, 255, 0.12)" },
                ]}
              />
            </View>

            {/* Google Auth Button */}
            <TouchableOpacity
              style={[
                styles.socialButtonWhite,
                isDark && {
                  backgroundColor: colors.cardElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading}
              activeOpacity={0.88}
            >
              {googleLoading ? (
                <ActivityIndicator
                  color={isDark ? "#FFFFFF" : "#0F172A"}
                  size="small"
                />
              ) : (
                <View style={styles.socialButtonInner}>
                  <View style={styles.googleGContainer}>
                    <Image
                      source={assets.google}
                      style={styles.googleLogo}
                      resizeMode="cover"
                    />
                  </View>
                  <Text
                    style={[
                      styles.socialButtonTextDark,
                      isDark && { color: colors.text },
                    ]}
                  >
                    Continue with Google
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Apple Auth Button */}
            <TouchableOpacity
              style={[
                styles.socialButtonBlack,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleAppleSignIn}
              activeOpacity={0.88}
            >
              <View style={styles.socialButtonInner}>
                <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                <Text style={styles.socialButtonTextLight}>
                  Continue with Apple
                </Text>
              </View>
            </TouchableOpacity>

            {/* Terms & Privacy Notice */}
            <Text
              style={[
                styles.termsText,
                isDark && { color: "rgba(255, 255, 255, 0.65)" },
              ]}
            >
              By continuing, you agree to Splitzy's{" "}
              <Text
                style={[styles.termsLink, isDark && { color: colors.text }]}
                onPress={() => setAuthView("terms_of_service")}
                suppressHighlighting={false}
              >
                Terms of Service
              </Text>{" "}
              and{" "}
              <Text
                style={[styles.termsLink, isDark && { color: colors.text }]}
                onPress={() => setAuthView("privacy_policy")}
                suppressHighlighting={false}
              >
                Privacy Policy
              </Text>
              .
            </Text>

            {/* Switch Mode Prompt: "Don't have an account? Sign up" */}
            <View style={styles.switchModePrompt}>
              <Text
                style={[
                  styles.switchModeLead,
                  isDark && { color: "rgba(255, 255, 255, 0.8)" },
                ]}
              >
                {activeTab === "signin"
                  ? "Don't have an account? "
                  : "Already have an account? "}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setActiveTab(activeTab === "signin" ? "signup" : "signin")
                }
              >
                <Text
                  style={[
                    styles.switchModeLink,
                    isDark && { color: colors.accent },
                  ]}
                >
                  {activeTab === "signin" ? "Sign up" : "Sign in"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bottom bleed ensures full solid extension on scroll */}
        <View
          style={[styles.bottomBlueBleed, { backgroundColor: bottomBgColor }]}
        />
      </ScrollView>

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

  /* Top Section */
  topSection: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 22,
    backgroundColor: "#FFFFFF",
  },
  topBarRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  topBarSpacer: {
    width: 38,
    height: 38,
  },
  backToSavedBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  themeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  logoBadge: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  splitText: {
    fontSize: 40,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  zyText: {
    fontSize: 40,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 18,
    maxWidth: 290,
  },

  /* Segmented Control */
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#EEF2F6",
    borderRadius: 14,
    padding: 3,
    width: "100%",
    marginTop: 22,
    marginBottom: 18,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#64748B",
  },
  segmentTextActive: {
    color: "#0F172A",
  },

  /* Form Fields */
  formArea: {
    width: "100%",
  },
  fieldGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 48,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIconText: {
    fontSize: 15,
    color: "#94A3B8",
    marginRight: 10,
  },
  vectorIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
  },
  eyeToggleBtn: {
    padding: 4,
  },
  eyeIconText: {
    fontSize: 15,
    color: "#94A3B8",
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  roleButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  roleButtonText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#64748B",
  },
  roleButtonTextActive: {
    color: "#FFFFFF",
  },

  /* Primary Button */
  primaryActionButton: {
    backgroundColor: "#2563EB",
    borderRadius: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryActionDisabled: {
    opacity: 0.7,
  },
  buttonLabelWithArrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryActionButtonText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  buttonArrowIcon: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  /* Bottom Blue Section */
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
    paddingTop: 6,
    alignItems: "center",
  },
  orDividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 18,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  orDividerText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1,
    marginHorizontal: 12,
  },
  socialButtonWhite: {
    backgroundColor: "#FFFFFF",
    borderRadius: 48,
    height: 48,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  socialButtonBlack: {
    backgroundColor: "#0F172A",
    borderRadius: 48,
    height: 48,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  socialButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleGContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  googleLogo: {
    width: 18,
    height: 18,
  },
  googleGLetter: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  socialButtonTextDark: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  appleIconGlyph: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  socialButtonTextLight: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  termsText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    maxWidth: 290,
    marginBottom: 16,
  },
  termsLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
    color: "#FFFFFF",
  },
  switchModePrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  switchModeLead: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 13,
    fontWeight: "500",
  },
  switchModeLink: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  fixedBottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#2563EB",
    zIndex: 9999,
  },
  inlineQuickPinCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inlineQuickPinLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  inlineQuickPinAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  inlineQuickPinAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  inlineQuickPinAvatarText: {
    fontSize: 16,
    fontWeight: "800",
  },
  inlineQuickPinInfo: {
    flex: 1,
    gap: 2,
  },
  inlineQuickPinHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineQuickPinTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  inlineQuickPinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  inlineQuickPinBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#2563EB",
  },
  inlineQuickPinSubtitle: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#64748B",
  },
  inlineQuickPinChevronBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  otherWaysInlineTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  otherWaysInlineBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  otherWaysInlineText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  otherWaysModalBody: {
    gap: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  otherWaysOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  otherWaysOptionIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  otherWaysOptionInfo: {
    flex: 1,
    gap: 2,
  },
  otherWaysTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  otherWaysOptionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  configuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  configuredBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#059669",
  },
  otherWaysOptionSubtitle: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#475569",
  },
  otherWaysOptionHint: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  cancelOtherWaysBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelOtherWaysText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
});
