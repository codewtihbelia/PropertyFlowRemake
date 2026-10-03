import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { SmoothBottomSheetModal } from "./SmoothBottomSheetModal";
import { authPinService } from "../services/authPinService";
import { mobileDataService } from "../services/firebaseDataService";
import { auth } from "../firebase/config";

interface PinSetupModalProps {
  visible: boolean;
  onClose: () => void;
  uid: string;
  isChangeMode?: boolean;
  onSuccess?: () => void;
}

type SetupStep = "current" | "new" | "confirm" | "success";

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  visible,
  onClose,
  uid,
  isChangeMode = false,
  onSuccess,
}) => {
  const { isDark, colors } = useTheme();

  const [step, setStep] = useState<SetupStep>(isChangeMode ? "current" : "new");
  const [currentPinInput, setCurrentPinInput] = useState<string>("");
  const [newPinInput, setNewPinInput] = useState<string>("");
  const [confirmPinInput, setConfirmPinInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep(isChangeMode ? "current" : "new");
      setCurrentPinInput("");
      setNewPinInput("");
      setConfirmPinInput("");
      setErrorMessage("");
      setIsProcessing(false);
    }
  }, [visible, isChangeMode]);

  const triggerShake = () => {
    try {
      Vibration.vibrate(Platform.OS === "android" ? 60 : 40);
    } catch {
      // Ignore vibration error
    }
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -6,
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

  const handleKeyPress = async (digit: string) => {
    if (isProcessing) return;
    setErrorMessage("");

    if (step === "current") {
      const next = currentPinInput + digit;
      if (next.length <= 4) {
        setCurrentPinInput(next);
        if (next.length === 4) {
          setIsProcessing(true);
          const isValid = await authPinService.verifyPin(uid, next);
          if (isValid) {
            setTimeout(() => {
              setStep("new");
              setIsProcessing(false);
            }, 150);
          } else {
            triggerShake();
            setErrorMessage("Incorrect current PIN. Try again.");
            setTimeout(() => {
              setCurrentPinInput("");
              setIsProcessing(false);
            }, 300);
          }
        }
      }
    } else if (step === "new") {
      const next = newPinInput + digit;
      if (next.length <= 4) {
        setNewPinInput(next);
        if (next.length === 4) {
          setTimeout(() => {
            setStep("confirm");
          }, 150);
        }
      }
    } else if (step === "confirm") {
      const next = confirmPinInput + digit;
      if (next.length <= 4) {
        setConfirmPinInput(next);
        if (next.length === 4) {
          if (next === newPinInput) {
            setIsProcessing(true);
            try {
              await authPinService.setPin(uid, next, true);
              try {
                const profile = await mobileDataService.getUserProfile(uid);
                const fbUser = auth.currentUser;
                await authPinService.saveLastPinUser({
                  uid,
                  displayName:
                    profile?.displayName ||
                    fbUser?.displayName ||
                    fbUser?.email ||
                    "Resident",
                  email: fbUser?.email || profile?.email || "",
                  photoURL:
                    profile?.profilePicture || fbUser?.photoURL || undefined,
                  role: profile?.role || "PAYOR",
                });
              } catch (e) {
                console.warn("Save last pin user error in modal:", e);
              }
              setStep("success");
              setTimeout(() => {
                if (onSuccess) onSuccess();
                onClose();
              }, 1200);
            } catch (err) {
              setErrorMessage("Failed to save PIN. Please retry.");
              setIsProcessing(false);
            }
          } else {
            triggerShake();
            setErrorMessage("PINs do not match. Please re-enter.");
            setTimeout(() => {
              setConfirmPinInput("");
            }, 300);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    if (isProcessing) return;
    setErrorMessage("");
    if (step === "current") {
      setCurrentPinInput((p) => p.slice(0, -1));
    } else if (step === "new") {
      setNewPinInput((p) => p.slice(0, -1));
    } else if (step === "confirm") {
      setConfirmPinInput((p) => p.slice(0, -1));
    }
  };

  const currentDisplayPin =
    step === "current"
      ? currentPinInput
      : step === "new"
        ? newPinInput
        : confirmPinInput;

  const stepTitle =
    step === "current"
      ? "Enter Current PIN"
      : step === "new"
        ? isChangeMode
          ? "Create New 4-Digit PIN"
          : "Create 4-Digit PIN"
        : step === "confirm"
          ? "Confirm 4-Digit PIN"
          : "PIN Configured!";

  const stepSubtitle =
    step === "current"
      ? "Verify your existing security PIN to continue"
      : step === "new"
        ? "Choose a memorable 4-digit code for quick dashboard access"
        : step === "confirm"
          ? "Re-enter your 4-digit PIN to ensure it's accurate"
          : "Your quick access PIN is active and ready to use.";

  return (
    <SmoothBottomSheetModal
      visible={visible}
      onClose={onClose}
      variant="bottom-sheet"
      title={stepTitle}
      subtitle={stepSubtitle}
      showChipBar={true}
      showCloseBtn={step !== "success"}
      dismissible={step !== "success"}
      icon={
        <Feather
          name={step === "success" ? "check-circle" : "shield"}
          size={18}
          color={step === "success" ? "#10B981" : colors.primary}
        />
      }
    >
      {step === "success" ? (
        <View style={styles.successContainer}>
          <View
            style={[
              styles.successCircle,
              {
                backgroundColor: isDark
                  ? "rgba(16, 185, 129, 0.15)"
                  : "#ECFDF5",
              },
            ]}
          >
            <Feather
              name="check"
              size={36}
              color={isDark ? "#34D399" : "#059669"}
            />
          </View>
          <Text style={[styles.successText, isDark && { color: colors.text }]}>
            PIN Successfully Saved!
          </Text>
          <Text
            style={[
              styles.successSubtext,
              isDark && { color: colors.textSecondary },
            ]}
          >
            You can now unlock your Splitzy dashboard with this 4-digit PIN.
          </Text>
        </View>
      ) : (
        <View style={styles.modalContent}>
          {/* Step indicators (New -> Confirm) */}
          {!isChangeMode && (
            <View style={styles.stepProgressRow}>
              <View
                style={[
                  styles.stepBadge,
                  step === "new" && styles.stepBadgeActive,
                  {
                    backgroundColor:
                      step === "new"
                        ? colors.primary
                        : isDark
                          ? "rgba(255, 255, 255, 0.1)"
                          : "#E2E8F0",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stepBadgeText,
                    step === "new" && { color: "#FFFFFF" },
                  ]}
                >
                  1. Choose
                </Text>
              </View>
              <View style={styles.stepConnector} />
              <View
                style={[
                  styles.stepBadge,
                  step === "confirm" && styles.stepBadgeActive,
                  {
                    backgroundColor:
                      step === "confirm"
                        ? colors.primary
                        : isDark
                          ? "rgba(255, 255, 255, 0.1)"
                          : "#E2E8F0",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stepBadgeText,
                    step === "confirm" && { color: "#FFFFFF" },
                  ]}
                >
                  2. Confirm
                </Text>
              </View>
            </View>
          )}

          {/* PIN Dots */}
          <Animated.View
            style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
          >
            {[0, 1, 2, 3].map((index) => {
              const isFilled = currentDisplayPin.length > index;
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
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
                />
              );
            })}
          </Animated.View>

          {/* Error Message */}
          <View style={styles.errorBox}>
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
          </View>

          {/* Keypad */}
          <View style={styles.keypadWrapper}>
            {[
              ["1", "2", "3"],
              ["4", "5", "6"],
              ["7", "8", "9"],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((digit) => (
                  <TouchableOpacity
                    key={digit}
                    style={[
                      styles.keypadBtn,
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
                    onPress={() => handleKeyPress(digit)}
                  >
                    <Text
                      style={[
                        styles.keypadDigit,
                        isDark && { color: colors.text },
                      ]}
                    >
                      {digit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <View style={styles.keypadRow}>
              {step === "confirm" ? (
                <TouchableOpacity
                  style={styles.keypadSideBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    setStep("new");
                    setNewPinInput("");
                    setConfirmPinInput("");
                    setErrorMessage("");
                  }}
                >
                  <Text
                    style={[
                      styles.keypadSideText,
                      { color: isDark ? colors.accent : colors.primary },
                    ]}
                  >
                    Back
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.keypadSideBtn} />
              )}

              <TouchableOpacity
                style={[
                  styles.keypadBtn,
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
                <Text
                  style={[styles.keypadDigit, isDark && { color: colors.text }]}
                >
                  0
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.keypadSideBtn}
                activeOpacity={0.65}
                onPress={handleDelete}
              >
                <Feather
                  name="delete"
                  size={20}
                  color={isDark ? colors.text : "#0F172A"}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SmoothBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    paddingVertical: 10,
    alignItems: "center",
  },
  stepProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  stepBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepBadgeActive: {},
  stepBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  stepConnector: {
    width: 16,
    height: 1.5,
    backgroundColor: "#CBD5E1",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 18,
    marginVertical: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  errorBox: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#EF4444",
  },
  keypadWrapper: {
    width: "100%",
    maxWidth: 300,
    gap: 10,
    marginTop: 6,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  keypadBtn: {
    width: 68,
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  keypadDigit: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  keypadSideBtn: {
    width: 68,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  keypadSideText: {
    fontSize: 13,
    fontWeight: "700",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  successSubtext: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
});
