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
  useWindowDimensions,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationBar } from "expo-navigation-bar";
import Svg, { Path } from "react-native-svg";
import * as Google from "expo-auth-session/providers/google";
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
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import { EmailVerificationScreen } from "./EmailVerificationScreen";
import { OtpVerificationScreen } from "./OtpVerificationScreen";

interface AuthScreenProps {
  onLoginSuccess: (user: {
    uid: string;
    displayName: string;
    email: string;
    role?: string;
  }) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [authView, setAuthView] = useState<
    "auth" | "forgot_password" | "email_verification" | "otp_verification"
  >("auth");
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
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

  const googleAndroidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined;
  const googleWebClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined;
  const googleIosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined;

  const isGoogleConfigured = Boolean(
    googleAndroidClientId || googleWebClientId || googleIosClientId,
  );

  useEffect(() => {
    if (Platform.OS === "android") {
      try {
        NavigationBar.setStyle("dark");
        NavigationBar.setHidden(true);
      } catch {
        // Fallback safely in environments without native nav bar control
      }

      return () => {
        try {
          NavigationBar.setStyle("light");
          NavigationBar.setHidden(true);
        } catch {
          // Fallback safely
        }
      };
    }
  }, []);

  const [googleRequest, , promptGoogleAsync] = Google.useIdTokenAuthRequest({
    clientId: googleWebClientId || googleAndroidClientId || googleIosClientId,
    androidClientId: googleAndroidClientId,
    iosClientId: googleIosClientId,
    webClientId: googleWebClientId,
    selectAccount: true,
  });

  const completeLogin = async (fbUser: any, fallbackRole: string = "PAYOR") => {
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

      onLoginSuccess({
        uid: fbUser.uid,
        displayName,
        email: fbUser.email || email.trim(),
        role: userRole,
      });
    } catch (err) {
      console.warn("completeLogin fallback warning:", err);
      onLoginSuccess({
        uid: fbUser.uid,
        displayName:
          fbUser.displayName || name.trim() || fbUser.email || "Resident",
        email: fbUser.email || email.trim(),
        role: fallbackRole,
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

        // If unverified, guide user to email verification
        if (!userCredential.user.emailVerified) {
          try {
            await sendEmailVerification(userCredential.user);
          } catch (e) {
            console.log("Email verification dispatch on signin notice:", e);
          }
          setPendingSignup({
            fbUser: userCredential.user,
            name: name.trim(),
            email: email.trim(),
            role: "PAYOR",
          });
          setAuthView("email_verification");
          return;
        }

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
        "To enable Google Sign-In, please add your Google OAuth Web Client ID (from Google Cloud Console / Firebase Authentication) to EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in packages/mobile/.env.\n\nIn the meantime, you can sign in directly using Email & Password!",
      );
      return;
    }

    if (!googleRequest) {
      Alert.alert(
        "Google Sign-In",
        "Google sign-in is initializing. Please try again in a moment.",
      );
      return;
    }

    setGoogleLoading(true);
    try {
      const result = await promptGoogleAsync();
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
        {/* Top white bleed ensures no blue sliver on drag */}
        <View style={styles.topWhiteBleed} />

        {/* ================= TOP / UPPER SECTION (White Canvas) ================= */}
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
          ]}
        >
          {/* Logo Badge */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBadge}>
              <Image
                source={assets.favicon}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>

            {/* App Title */}
            <View style={styles.brandTitleRow}>
              <Text style={styles.splitText}>Split</Text>
              <Text style={styles.zyText}>zy</Text>
            </View>
          </View>

          {/* Tagline */}
          <Text style={styles.tagline}>
            Manage, split bills, and track group expenses{"\n"}effortlessly.
          </Text>

          {/* Segmented Tab Switcher */}
          {/* <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentTab,
                activeTab === "signin" && styles.segmentTabActive,
              ]}
              onPress={() => setActiveTab("signin")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeTab === "signin" && styles.segmentTextActive,
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentTab,
                activeTab === "signup" && styles.segmentTabActive,
              ]}
              onPress={() => setActiveTab("signup")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeTab === "signup" && styles.segmentTextActive,
                ]}
              >
                Sign Up
              </Text>
            </TouchableOpacity>
          </View> */}

          {/* Form Fields */}
          <View style={styles.formArea}>
            {activeTab === "signup" && (
              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <Feather
                    name="user"
                    size={17}
                    color="#94A3B8"
                    style={styles.vectorIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Rommel Belia"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            {/* Email Address */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Feather
                  name="mail"
                  size={17}
                  color="#94A3B8"
                  style={styles.vectorIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="rommel.belia@example.com"
                  placeholderTextColor="#94A3B8"
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
                <Text style={styles.inputLabel}>Password</Text>
                {activeTab === "signin" && (
                  <TouchableOpacity
                    onPress={() => setAuthView("forgot_password")}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot?</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputWrapper}>
                <Feather
                  name="lock"
                  size={17}
                  color="#94A3B8"
                  style={styles.vectorIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter password"
                  placeholderTextColor="#94A3B8"
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
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Primary Action Button ("Sign In ->" or "Sign Up ->") */}
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
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

        {/* ================= BOTTOM BLUE SECTION WITH FLUID WAVY TOP ================= */}
        <View style={styles.bottomCurvedContainer}>
          {/* Fluid S-Curve SVG Wave: top transparent area shows pure white to seamlessly connect with topSection, curve fills with solid blue */}
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
              { paddingBottom: Math.max(insets.bottom + 24, 42) },
            ]}
          >
            {/* Divider "OR CONTINUE WITH" */}
            <View style={styles.orDividerContainer}>
              <View style={styles.orDividerLine} />
              <Text style={styles.orDividerText}>OR CONTINUE WITH</Text>
              <View style={styles.orDividerLine} />
            </View>

            {/* Google Auth Button */}
            <TouchableOpacity
              style={styles.socialButtonWhite}
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading}
              activeOpacity={0.88}
            >
              {googleLoading ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : (
                <View style={styles.socialButtonInner}>
                  {/* Google*/}
                  <View style={styles.googleGContainer}>
                    <Image
                      source={assets.google}
                      style={styles.googleLogo}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.socialButtonTextDark}>
                    Continue with Google
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Apple Auth Button */}
            <TouchableOpacity
              style={styles.socialButtonBlack}
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
            <Text style={styles.termsText}>
              By continuing, you agree to Splitzy's{" "}
              <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>

            {/* Switch Mode Prompt: "Don't have an account? Sign up" */}
            <View style={styles.switchModePrompt}>
              <Text style={styles.switchModeLead}>
                {activeTab === "signin"
                  ? "Don't have an account? "
                  : "Already have an account? "}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setActiveTab(activeTab === "signin" ? "signup" : "signin")
                }
              >
                <Text style={styles.switchModeLink}>
                  {activeTab === "signin" ? "Sign up" : "Sign in"}
                </Text>
              </TouchableOpacity>
            </View>
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

  /* Top Section */
  topSection: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 22,
    backgroundColor: "#FFFFFF",
  },
  logoContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
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
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    borderRadius: 14,
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
    borderRadius: 16,
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
    borderRadius: 16,
    height: 48,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  socialButtonBlack: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    height: 48,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
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
});
