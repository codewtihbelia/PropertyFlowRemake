import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { SmoothBottomSheetModal } from "./SmoothBottomSheetModal";

interface NewUserPinPromptModalProps {
  visible: boolean;
  userName?: string;
  userEmail?: string;
  hasExistingPin?: boolean;
  isOverride?: boolean;
  existingSavedUser?: { displayName?: string; email?: string } | null;
  onSetUpNow: () => void;
  onMaybeLater: () => void;
}

export const NewUserPinPromptModal: React.FC<NewUserPinPromptModalProps> = ({
  visible,
  userName,
  userEmail,
  hasExistingPin = false,
  isOverride = false,
  existingSavedUser,
  onSetUpNow,
  onMaybeLater,
}) => {
  const { isDark, colors } = useTheme();

  const existingName =
    existingSavedUser?.displayName ||
    existingSavedUser?.email ||
    "Another user";

  return (
    <SmoothBottomSheetModal
      visible={visible}
      onClose={onMaybeLater}
      variant="bottom-sheet"
      showChipBar={true}
      showCloseBtn={true}
      dismissible={true}
    >
      <View style={styles.content}>
        {/* Glowing Shield Icon */}
        <View style={styles.iconTitleWrapper}>
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isOverride
                  ? isDark
                    ? "rgba(245, 158, 11, 0.15)"
                    : "#FEF3C7"
                  : isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : "#EFF6FF",
                borderColor: isOverride
                  ? isDark
                    ? "rgba(245, 158, 11, 0.35)"
                    : "rgba(217, 119, 6, 0.3)"
                  : isDark
                    ? "rgba(59, 130, 246, 0.3)"
                    : "rgba(37, 99, 235, 0.2)",
              },
            ]}
          >
            <Feather
              name={isOverride ? "refresh-cw" : "shield"}
              size={22}
              color={
                isOverride
                  ? isDark
                    ? "#FBBF24"
                    : "#D97706"
                  : isDark
                    ? colors.accent
                    : colors.primary
              }
            />
          </View>

          <Text style={[styles.title, isDark && { color: colors.text }]}>
            {isOverride
              ? "Override Saved Profile?"
              : hasExistingPin
                ? "Save Profile on this Device?"
                : "Save Profile for Quick Sign-In?"}
          </Text>
        </View>
        <Text
          style={[styles.subtitle, isDark && { color: colors.textSecondary }]}
        >
          {isOverride
            ? `"${existingName}" is currently saved on this device. As Splitzy is a financial app, only one profile can be saved per device. Would you like to replace it with "${userName || userEmail}"?`
            : hasExistingPin
              ? `Quick PIN is already configured on your account. Save your profile on this device to sign in instantly with your 4-digit PIN.`
              : `Save your profile on this device for instant access. You can sign in quickly using your password or a 4-digit security PIN.`}
        </Text>

        {/* Profile preview pill */}
        {(userName || userEmail) && (
          <View
            style={[
              styles.profilePreviewPill,
              isDark
                ? {
                    backgroundColor: colors.cardSecondary,
                    borderColor: colors.border,
                  }
                : {
                    backgroundColor: "#F1F5F9",
                    borderColor: "#E2E8F0",
                  },
            ]}
          >
            <View
              style={[
                styles.profileAvatarMini,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.profileAvatarMiniText}>
                {(userName || userEmail || "R").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfoMini}>
              <Text
                style={[
                  styles.profileNameMini,
                  isDark && { color: colors.text },
                ]}
                numberOfLines={1}
              >
                {userName || "Resident"}
              </Text>
              {userEmail ? (
                <Text
                  style={[
                    styles.profileEmailMini,
                    isDark && { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {userEmail}
                </Text>
              ) : null}
            </View>
            <View style={styles.profileLockBadge}>
              <Feather
                name={hasExistingPin ? "check-circle" : "lock"}
                size={12}
                color={hasExistingPin ? "#10B981" : colors.primary}
              />
              <Text
                style={[
                  styles.profileLockBadgeText,
                  { color: hasExistingPin ? "#059669" : colors.primary },
                ]}
              >
                {isOverride
                  ? "New Profile"
                  : hasExistingPin
                    ? "PIN Ready"
                    : "Quick Access"}
              </Text>
            </View>
          </View>
        )}

        {/* Feature Highlights */}
        <View
          style={[
            styles.featuresCard,
            isDark
              ? {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                }
              : {
                  backgroundColor: "#F8FAFC",
                  borderColor: "#E2E8F0",
                },
          ]}
        >
          <View style={styles.featureRow}>
            <View
              style={[
                styles.featureIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : "#EFF6FF",
                },
              ]}
            >
              <Feather
                name="zap"
                size={16}
                color={isDark ? colors.accent : colors.primary}
              />
            </View>
            <View style={styles.featureTextWrap}>
              <Text
                style={[styles.featureTitle, isDark && { color: colors.text }]}
              >
                1-Device Security Rule
              </Text>
              <Text
                style={[
                  styles.featureDesc,
                  isDark && { color: colors.textMuted },
                ]}
              >
                Only one trusted profile per phone guarantees financial data
                safety.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View
              style={[
                styles.featureIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.15)"
                    : "#ECFDF5",
                },
              ]}
            >
              <Feather
                name="lock"
                size={16}
                color={isDark ? "#34D399" : "#059669"}
              />
            </View>
            <View style={styles.featureTextWrap}>
              <Text
                style={[styles.featureTitle, isDark && { color: colors.text }]}
              >
                Quick Return Anytime
              </Text>
              <Text
                style={[
                  styles.featureDesc,
                  isDark && { color: colors.textMuted },
                ]}
              >
                Sign back in instantly using password or your 4-digit PIN.
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
              },
            ]}
            activeOpacity={0.85}
            onPress={onSetUpNow}
          >
            <Feather
              name={
                isOverride
                  ? "check"
                  : hasExistingPin
                    ? "check-circle"
                    : "shield"
              }
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.primaryBtnText}>
              {isOverride
                ? "Override & Save Profile"
                : hasExistingPin
                  ? "Save Profile & Enable PIN"
                  : "Save Profile & Set Up PIN"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              isDark && { borderColor: colors.border },
            ]}
            activeOpacity={0.7}
            onPress={onMaybeLater}
          >
            <Text
              style={[
                styles.secondaryBtnText,
                isDark && { color: colors.textSecondary },
              ]}
            >
              {isOverride
                ? "Keep Previous (Session Only)"
                : "Not Now (Ask Next Time)"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SmoothBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 6,
    paddingBottom: 16,
    alignItems: "center",
  },
  iconTitleWrapper: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  profilePreviewPill: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
    gap: 10,
  },
  profileAvatarMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarMiniText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  profileInfoMini: {
    flex: 1,
  },
  profileNameMini: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  profileEmailMini: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  profileLockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  profileLockBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  featuresCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 22,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  featureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },
  actionButtons: {
    width: "100%",
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 48,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  secondaryBtnText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
  },
});
