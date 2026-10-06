import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StatusBar,
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { assets } from "../../assets/assets";
import { auth } from "../firebase/config";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { authPinService, StoredPinUser } from "../services/authPinService";
import { mobileDataService } from "../services/firebaseDataService";

interface FloatingBadgeConfig {
  id: string;
  top: number;
  left?: number;
  right?: number;
  size: number;
  baseRotate: number;
  floatRange: number;
  rotateDelta: number;
  duration: number;
  delay: number;
}

const FLOATING_BADGES: FloatingBadgeConfig[] = [
  // 1. Top-Left
  {
    id: "top-left",
    top: -46,
    left: -48,
    size: 34,
    baseRotate: -16,
    floatRange: 5,
    rotateDelta: 4,
    duration: 3200,
    delay: 0,
  },
  // 2. Top-Center-Left
  {
    id: "top-center-left",
    top: -56,
    left: 24,
    size: 30,
    baseRotate: 5,
    floatRange: 5,
    rotateDelta: 3,
    duration: 3600,
    delay: 400,
  },
  // 3. Top-Right
  {
    id: "top-right",
    top: -44,
    right: -46,
    size: 32,
    baseRotate: 14,
    floatRange: 5,
    rotateDelta: 4,
    duration: 2900,
    delay: 800,
  },
  // 4. Mid-Right
  {
    id: "mid-right",
    top: 36,
    right: -62,
    size: 28,
    baseRotate: -8,
    floatRange: 5,
    rotateDelta: 3,
    duration: 3400,
    delay: 200,
  },
  // 5. Lower-Right
  {
    id: "lower-right",
    top: 98,
    right: -52,
    size: 30,
    baseRotate: 20,
    floatRange: 6,
    rotateDelta: 5,
    duration: 3100,
    delay: 600,
  },
  // 6. Mid-Left
  {
    id: "mid-left",
    top: 28,
    left: -62,
    size: 30,
    baseRotate: 9,
    floatRange: 5,
    rotateDelta: 4,
    duration: 3300,
    delay: 1000,
  },
];

const FloatingBadgeItem: React.FC<{
  config: FloatingBadgeConfig;
  isDark: boolean;
}> = ({ config, isDark }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: config.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: config.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const timer = setTimeout(() => {
      loop.start();
    }, config.delay);

    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [config.duration, config.delay]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -config.floatRange],
  });

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      `${config.baseRotate}deg`,
      `${config.baseRotate + config.rotateDelta}deg`,
    ],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floatingBadgeItem,
        {
          top: config.top,
          ...(config.left !== undefined ? { left: config.left } : {}),
          ...(config.right !== undefined ? { right: config.right } : {}),
          width: config.size,
          height: config.size,
          borderRadius: Math.round(config.size * 0.28),
          backgroundColor: isDark ? "rgba(30, 41, 59, 0.88)" : "#FFFFFF",
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.16)"
            : "rgba(37, 99, 235, 0.22)",
          transform: [{ translateY }, { rotate }],
        },
      ]}
    >
      <Image
        source={assets.favicon}
        style={{
          width: config.size - 8,
          height: config.size - 8,
          borderRadius: Math.round((config.size - 8) * 0.24),
        }}
        resizeMode="cover"
      />
    </Animated.View>
  );
};

interface SavedProfileAuthScreenProps {
  user: StoredPinUser;
  onContinueWithPin: () => void;
  onPasswordLoginSuccess: (user: {
    uid: string;
    displayName: string;
    email: string;
    role?: string;
  }) => void;
  onUseAnotherProfile: () => void;
  onCreateNewAccount: () => void;
  onProfileRemoved: () => void;
}

export const SavedProfileAuthScreen: React.FC<SavedProfileAuthScreenProps> = ({
  user,
  onContinueWithPin,
  onPasswordLoginSuccess,
  onUseAnotherProfile,
  onCreateNewAccount,
  onProfileRemoved,
}) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [isPasswordExpanded, setIsPasswordExpanded] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>("");
  const [showOptionsMenu, setShowOptionsMenu] = useState<boolean>(false);
  const [isResettingPassword, setIsResettingPassword] =
    useState<boolean>(false);
  const [hasPinConfigured, setHasPinConfigured] = useState<boolean>(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    user?.photoURL,
  );
  const [imageLoadFailed, setImageLoadFailed] = useState<boolean>(false);

  useEffect(() => {
    setImageLoadFailed(false);
    if (user?.photoURL) {
      setAvatarUrl(user.photoURL);
    } else if (user?.uid) {
      authPinService.getCachedUserAvatar(user.uid).then((cached) => {
        if (cached) {
          setAvatarUrl(cached);
        }
      });
    }
  }, [user?.photoURL, user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      authPinService.isPinEnabled(user.uid).then((enabled) => {
        setHasPinConfigured(enabled);
      });

      // Check persistent local avatar cache first (accessible without Firebase Auth)
      authPinService.getCachedUserAvatar(user.uid).then((cached) => {
        if (cached && !avatarUrl) {
          setAvatarUrl(cached);
        }
      });

      // If user is currently authenticated with Firebase, refresh remote profile picture
      if (auth.currentUser && auth.currentUser.uid === user.uid) {
        mobileDataService
          .getUserProfile(user.uid)
          .then((p) => {
            const pic = p?.profilePicture || p?.photoURL;
            if (pic) {
              setAvatarUrl(pic);
              setImageLoadFailed(false);
              authPinService.cacheUserAvatar(user.uid, pic);
            }
          })
          .catch(() => {});
      }
    }
  }, [user?.uid]);

  // Inline expansion animation
  const expandAnim = useRef(new Animated.Value(0)).current;
  const passwordInputRef = useRef<TextInput>(null);

  const togglePasswordExpand = () => {
    if (!isPasswordExpanded) {
      setIsPasswordExpanded(true);
      setPasswordError("");
      Animated.timing(expandAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: false,
      }).start(() => {
        passwordInputRef.current?.focus();
      });
    } else {
      handlePasswordSignIn();
    }
  };

  const handlePasswordSignIn = async () => {
    if (!password.trim()) {
      setPasswordError("Please enter your password.");
      return;
    }

    setPasswordError("");
    setIsLoggingIn(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        user.email,
        password,
      );
      const fbUser = userCredential.user;
      authPinService.setSessionPassword(fbUser.uid, password);
      onPasswordLoginSuccess({
        uid: fbUser.uid,
        displayName: fbUser.displayName || user.displayName || "Resident",
        email: fbUser.email || user.email,
        role: user.role || "PAYOR",
      });
    } catch (err: any) {
      console.warn("Password sign-in error:", err);
      let msg = "Incorrect password. Please try again.";
      if (err.code === "auth/too-many-requests") {
        msg = "Too many attempts. Please try again later or use your PIN.";
      } else if (err.code === "auth/user-disabled") {
        msg = "This account has been disabled.";
      } else if (err.code === "auth/invalid-credential") {
        msg = "Incorrect password. Please try again.";
      }
      setPasswordError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user.email) return;
    setIsResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert(
        "Reset Link Sent",
        `We've sent a password reset email to ${user.email}. Check your inbox to choose a new password.`,
      );
    } catch (e: any) {
      Alert.alert(
        "Notice",
        e?.message || "Could not send password reset link. Please try again.",
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleRemoveProfile = async () => {
    setShowOptionsMenu(false);
    Alert.alert(
      "Remove Profile from Device?",
      `This will remove ${user.displayName}'s saved account and PIN from this device. You will need to enter your email and password next time you sign in.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove Profile",
          style: "destructive",
          onPress: async () => {
            try {
              await authPinService.removeDeviceProfile(user.uid);
              onProfileRemoved();
            } catch (err) {
              console.warn("Remove profile error:", err);
            }
          },
        },
      ],
    );
  };

  // Color tokens
  const bgColor = isDark ? "#0B1120" : "#F8FAFC";
  const cardColor = isDark ? "#141E33" : "#FFFFFF";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const secondaryTextColor = isDark ? "#94A3B8" : "#64748B";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: bgColor }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      {/* Top Header Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBarLeftSpacer} />

        {/* Three-dots menu button */}
        <TouchableOpacity
          style={[
            styles.optionsIconButton,
            { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9" },
          ]}
          onPress={() => setShowOptionsMenu(true)}
          activeOpacity={0.7}
          accessibilityLabel="Options"
        >
          <Feather
            name="more-horizontal"
            size={22}
            color={isDark ? "#FFFFFF" : "#0F172A"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(80, insets.bottom + 40),
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mainContent}>
          {/* Avatar with Surrounding Floating Splitzy Badges */}
          <View style={styles.avatarWrapper}>
            {/* 6 Surrounding Floating Badges at Highlighted Zones */}
            {FLOATING_BADGES.map((config) => (
              <FloatingBadgeItem
                key={config.id}
                config={config}
                isDark={isDark}
              />
            ))}

            {/* Clean Avatar Circle (no badge on profile image) */}
            <View
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
                  borderColor: isDark ? "#334155" : "#CBD5E1",
                },
              ]}
            >
              {avatarUrl && !imageLoadFailed ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={() => {
                    setImageLoadFailed(true);
                  }}
                />
              ) : (
                <Text
                  style={[
                    styles.avatarInitial,
                    { color: isDark ? "#60A5FA" : "#2563EB" },
                  ]}
                >
                  {(user.displayName || user.email || "U")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              )}
            </View>
          </View>

          {/* User Display Name */}
          <Text style={[styles.userNameText, { color: textColor }]}>
            {user.displayName || "Resident"}
          </Text>

          {/* Notification / Saved badge pill */}
          <View style={styles.savedStatusRow}>
            <View style={styles.activeGreenDot} />
            <Text
              style={[styles.savedStatusText, { color: secondaryTextColor }]}
            >
              Saved on this device
            </Text>
          </View>

          {/* Hairline Divider */}
          <View
            style={[styles.hairlineDivider, { backgroundColor: borderColor }]}
          />

          {/* Trust Notice Text */}
          <Text style={[styles.noticeText, { color: secondaryTextColor }]}>
            Splitzy securely remembers this account so you can unlock your
            dashboard quickly without retyping your email.
          </Text>

          {/* Smoothly Expanded Password Input Block */}
          {isPasswordExpanded && (
            <Animated.View
              style={[
                styles.passwordExpandContainer,
                {
                  opacity: expandAnim,
                  transform: [
                    {
                      translateY: expandAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.passwordInputWrapper,
                  {
                    backgroundColor: cardColor,
                    borderColor: passwordError ? "#EF4444" : borderColor,
                  },
                ]}
              >
                <Feather
                  name="lock"
                  size={18}
                  color={isDark ? "#94A3B8" : "#64748B"}
                  style={styles.passwordLockIcon}
                />
                <TextInput
                  ref={passwordInputRef}
                  style={[styles.passwordTextInput, { color: textColor }]}
                  placeholder="Enter your password"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (passwordError) setPasswordError("");
                  }}
                  onSubmitEditing={handlePasswordSignIn}
                  returnKeyType="done"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.passwordEyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.6}
                >
                  <Feather
                    name={showPassword ? "eye" : "eye-off"}
                    size={18}
                    color={isDark ? "#94A3B8" : "#64748B"}
                  />
                </TouchableOpacity>
              </View>

              {passwordError ? (
                <Text style={styles.passwordErrorText}>{passwordError}</Text>
              ) : null}

              {/* Forgot password link */}
              <TouchableOpacity
                style={styles.forgotPasswordRow}
                onPress={handleForgotPassword}
                disabled={isResettingPassword}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordLink}>
                  {isResettingPassword
                    ? "Sending reset link..."
                    : "Forgot password?"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Action Buttons Section */}
          <View style={styles.actionsContainer}>
            {/* Primary "Continue" Button */}
            <TouchableOpacity
              style={[
                styles.continuePrimaryBtn,
                isLoggingIn && styles.continueBtnDisabled,
              ]}
              onPress={togglePasswordExpand}
              disabled={isLoggingIn}
              activeOpacity={0.85}
            >
              {isLoggingIn ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.continuePrimaryBtnText}>
                  {isPasswordExpanded ? "Sign In" : "Continue"}
                </Text>
              )}
            </TouchableOpacity>

            {/* "Continue with PIN" Button (shown only if PIN configured) */}
            {hasPinConfigured && (
              <TouchableOpacity
                style={[
                  styles.continueWithPinBtn,
                  {
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "#F1F5F9",
                    borderColor: isDark ? "rgba(255,255,255,0.12)" : "#E2E8F0",
                  },
                ]}
                onPress={onContinueWithPin}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="keypad-outline"
                  size={17}
                  color={isDark ? "#60A5FA" : "#2563EB"}
                  style={styles.shieldIcon}
                />
                <Text
                  style={[
                    styles.continueWithPinText,
                    { color: isDark ? "#FFFFFF" : "#0F172A" },
                  ]}
                >
                  Continue with PIN
                </Text>
              </TouchableOpacity>
            )}

            {/* "Use another profile" Link */}
            <TouchableOpacity
              style={styles.useAnotherProfileBtn}
              onPress={onUseAnotherProfile}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.useAnotherProfileText,
                  { color: isDark ? "#CBD5E1" : "#475569" },
                ]}
              >
                Use another profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* "Create new account" Pill Button */}
          <TouchableOpacity
            style={[
              styles.createAccountBtn,
              {
                borderColor: isDark ? "#3B82F6" : "#2563EB",
                backgroundColor: isDark
                  ? "rgba(59, 130, 246, 0.08)"
                  : "rgba(37, 99, 235, 0.04)",
              },
            ]}
            onPress={onCreateNewAccount}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.createAccountBtnText,
                { color: isDark ? "#60A5FA" : "#2563EB" },
              ]}
            >
              Create new account
            </Text>
          </TouchableOpacity>

          {/* Footer Branding */}
          <View style={styles.footerBrandingRow}>
            <Image
              source={assets.favicon}
              style={styles.footerLogoGlyph}
              resizeMode="contain"
            />
            <Text
              style={[styles.footerBrandText, { color: secondaryTextColor }]}
            >
              Splitzy
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Top-Right Three-Dots Options Modal */}
      <Modal
        visible={showOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View
            style={[
              styles.menuSheetCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: borderColor,
              },
            ]}
          >
            <View style={styles.menuSheetHandle} />

            <Text
              style={[styles.menuSheetTitle, { color: textColor }]}
              numberOfLines={1}
            >
              {user.displayName || "Account Options"}
            </Text>
            <Text
              style={[styles.menuSheetSubtitle, { color: secondaryTextColor }]}
            >
              {user.email}
            </Text>

            <View
              style={[styles.menuItemDivider, { backgroundColor: borderColor }]}
            />

            {/* Option: Switch Account */}
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => {
                setShowOptionsMenu(false);
                onUseAnotherProfile();
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.menuItemIconBox,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "#F1F5F9",
                  },
                ]}
              >
                <Feather
                  name="users"
                  size={18}
                  color={isDark ? "#FFFFFF" : "#0F172A"}
                />
              </View>
              <View style={styles.menuItemTextBox}>
                <Text style={[styles.menuItemTitle, { color: textColor }]}>
                  Switch to another account
                </Text>
                <Text
                  style={[
                    styles.menuItemDescription,
                    { color: secondaryTextColor },
                  ]}
                >
                  Log in with a different email or password
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option: Remove Profile */}
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={handleRemoveProfile}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.menuItemIconBox,
                  {
                    backgroundColor: isDark
                      ? "rgba(239, 68, 68, 0.15)"
                      : "#FEE2E2",
                  },
                ]}
              >
                <Feather name="trash-2" size={18} color="#EF4444" />
              </View>
              <View style={styles.menuItemTextBox}>
                <Text style={[styles.menuItemTitle, { color: "#EF4444" }]}>
                  Remove profile from this device
                </Text>
                <Text
                  style={[
                    styles.menuItemDescription,
                    { color: secondaryTextColor },
                  ]}
                >
                  Forgets saved profile and 4-digit PIN on this phone
                </Text>
              </View>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[
                styles.menuCancelBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "#F1F5F9",
                },
              ]}
              onPress={() => setShowOptionsMenu(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuCancelText, { color: textColor }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarLeftSpacer: {
    width: 40,
  },
  optionsIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  mainContent: {
    alignItems: "center",
    paddingTop: 16,
  },
  avatarWrapper: {
    position: "relative",
    marginTop: 64,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: "800",
  },
  floatingBadgeItem: {
    position: "absolute",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 5,
  },
  userNameText: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginTop: 14,
    textAlign: "center",
  },
  savedStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  activeGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  savedStatusText: {
    fontSize: 13,
    fontWeight: "500",
  },
  hairlineDivider: {
    width: "100%",
    height: 1,
    marginTop: 22,
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  passwordExpandContainer: {
    width: "100%",
    marginBottom: 16,
  },
  passwordInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 48,
    paddingHorizontal: 14,
    height: 50,
  },
  passwordLockIcon: {
    marginRight: 10,
  },
  passwordTextInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  passwordEyeBtn: {
    padding: 6,
  },
  passwordErrorText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 6,
    marginLeft: 4,
  },
  forgotPasswordRow: {
    alignSelf: "flex-end",
    marginTop: 8,
    paddingVertical: 4,
  },
  forgotPasswordLink: {
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: "600",
  },
  actionsContainer: {
    width: "100%",
    gap: 12,
    marginTop: 4,
  },
  continuePrimaryBtn: {
    backgroundColor: "#2563EB",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnDisabled: {
    opacity: 0.7,
  },
  continuePrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  continueWithPinBtn: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  shieldIcon: {
    marginRight: 8,
  },
  continueWithPinText: {
    fontSize: 15,
    fontWeight: "600",
  },
  useAnotherProfileBtn: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  useAnotherProfileText: {
    fontSize: 14,
    fontWeight: "600",
  },
  bottomSection: {
    alignItems: "center",
    paddingTop: 28,
    gap: 16,
  },
  createAccountBtn: {
    width: "100%",
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  createAccountBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  footerBrandingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerLogoGlyph: {
    width: 16,
    height: 16,
    opacity: 0.8,
  },
  footerBrandText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  menuSheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  menuSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148, 163, 184, 0.4)",
    alignSelf: "center",
    marginBottom: 16,
  },
  menuSheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  menuSheetSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 12,
  },
  menuItemDivider: {
    height: 1,
    width: "100%",
    marginBottom: 10,
  },
  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuItemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuItemTextBox: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  menuItemDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  menuCancelBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
