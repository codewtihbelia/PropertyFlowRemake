import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  TouchableWithoutFeedback,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  alertService,
  CustomAlertConfig,
  CustomAlertButton,
  AlertType,
} from "../services/alertService";
import { useTheme } from "../context/ThemeContext";

export const CustomAlertModal: React.FC = () => {
  const { isDark, colors } = useTheme();
  const [config, setConfig] = useState<CustomAlertConfig | null>(null);
  const animValue = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = alertService.register((newConfig) => {
      if (newConfig) {
        isClosingRef.current = false;
        setConfig(newConfig);
        animValue.setValue(0);
        Animated.timing(animValue, {
          toValue: 1,
          duration: 260,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }).start();
      } else {
        closeWithAnimation();
      }
    });

    return unsubscribe;
  }, []);

  const closeWithAnimation = (callback?: () => void) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    Animated.timing(animValue, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setConfig(null);
      isClosingRef.current = false;
      if (callback) {
        callback();
      }
    });
  };

  const handleButtonPress = (btn: CustomAlertButton) => {
    closeWithAnimation(() => {
      if (btn.onPress) {
        btn.onPress();
      }
    });
  };

  const handleBackdropPress = () => {
    if (config?.options?.cancelable === false) {
      return;
    }
    const cancelBtn = config?.buttons?.find((b) => b.style === "cancel");
    closeWithAnimation(() => {
      if (cancelBtn?.onPress) {
        cancelBtn.onPress();
      } else if (config?.options?.onDismiss) {
        config.options.onDismiss();
      }
    });
  };

  if (!config) return null;

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const cardScale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const cardTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  const cardOpacity = animValue.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.8, 1],
  });

  const renderIcon = (type: AlertType) => {
    switch (type) {
      case "success":
        return (
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark
                  ? "rgba(16, 185, 129, 0.15)"
                  : "#F0FDF4",
                borderColor: isDark ? "rgba(16, 185, 129, 0.3)" : "#BBF7D0",
              },
            ]}
          >
            <Feather
              name="check"
              size={26}
              color={isDark ? "#34D399" : "#16A34A"}
            />
          </View>
        );
      case "error":
        return (
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA",
              },
            ]}
          >
            <Feather
              name="alert-circle"
              size={26}
              color={isDark ? "#F87171" : "#DC2626"}
            />
          </View>
        );
      case "warning":
        return (
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark
                  ? "rgba(245, 158, 11, 0.15)"
                  : "#FFFBEB",
                borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#FDE68A",
              },
            ]}
          >
            <Feather
              name="alert-triangle"
              size={24}
              color={isDark ? "#FBBF24" : "#D97706"}
            />
          </View>
        );
      case "destructive":
        return (
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FFF1F2",
                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECDD3",
              },
            ]}
          >
            <Feather
              name="trash-2"
              size={24}
              color={isDark ? "#F87171" : "#E11D48"}
            />
          </View>
        );
      case "confirm":
        return (
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark
                  ? "rgba(59, 130, 246, 0.15)"
                  : "#EFF6FF",
                borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#BFDBFE",
              },
            ]}
          >
            <Feather
              name="help-circle"
              size={26}
              color={isDark ? colors.accent : "#2563EB"}
            />
          </View>
        );
      case "info":
      default:
        return (
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark
                  ? "rgba(59, 130, 246, 0.15)"
                  : "#EFF6FF",
                borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#DBEAFE",
              },
            ]}
          >
            <Feather
              name="info"
              size={26}
              color={isDark ? colors.accent : "#2563EB"}
            />
          </View>
        );
    }
  };

  const buttons =
    config.buttons && config.buttons.length > 0
      ? config.buttons
      : [{ text: "OK", style: "default" as const }];

  const isTwoButtons = buttons.length === 2;
  const isSingleButton = buttons.length === 1;

  return (
    <Modal
      transparent
      visible={Boolean(config)}
      animationType="none"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent
    >
      <View style={styles.overlayContainer}>
        {/* Animated backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableWithoutFeedback onPress={handleBackdropPress}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Centered Alert Card */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: cardOpacity,
              transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
            },
          ]}
        >
          {/* Icon Badge */}
          {renderIcon(config.type || "info")}

          {/* Title */}
          {Boolean(config.title) && (
            <Text style={[styles.titleText, { color: colors.text }]}>
              {config.title}
            </Text>
          )}

          {/* Message Description */}
          {Boolean(config.message) && (
            <Text style={[styles.messageText, { color: colors.textSecondary }]}>
              {config.message}
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {isSingleButton ? (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => handleButtonPress(buttons[0])}
                style={[
                  styles.button,
                  {
                    backgroundColor:
                      config.type === "error" || config.type === "destructive"
                        ? "#DC2626"
                        : colors.primary,
                  },
                ]}
              >
                <Text style={styles.buttonPrimaryText}>{buttons[0].text}</Text>
              </TouchableOpacity>
            ) : isTwoButtons ? (
              <View style={styles.twoButtonRow}>
                {buttons.map((btn, index) => {
                  const isCancel =
                    btn.style === "cancel" ||
                    (index === 0 &&
                      !btn.style &&
                      buttons[1].style === "destructive");
                  const isDestructive = btn.style === "destructive";

                  return (
                    <TouchableOpacity
                      key={`${btn.text}-${index}`}
                      activeOpacity={0.82}
                      onPress={() => handleButtonPress(btn)}
                      style={[
                        styles.button,
                        styles.halfButton,
                        isCancel
                          ? {
                              backgroundColor: colors.surfaceInset,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }
                          : isDestructive
                            ? styles.buttonDestructive
                            : { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel
                            ? { color: colors.textSecondary }
                            : styles.buttonPrimaryText,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.stackedButtonCol}>
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === "cancel";
                  const isDestructive = btn.style === "destructive";

                  return (
                    <TouchableOpacity
                      key={`${btn.text}-${index}`}
                      activeOpacity={0.82}
                      onPress={() => handleButtonPress(btn)}
                      style={[
                        styles.button,
                        isCancel
                          ? {
                              backgroundColor: colors.surfaceInset,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }
                          : isDestructive
                            ? styles.buttonDestructive
                            : { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel
                            ? { color: colors.textSecondary }
                            : styles.buttonPrimaryText,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 20,
    borderWidth: 1,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginBottom: 14,
  },
  titleText: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  messageText: {
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  actionsContainer: {
    width: "100%",
    marginTop: 22,
  },
  twoButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  stackedButtonCol: {
    flexDirection: "column",
    gap: 8,
    width: "100%",
  },
  button: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  halfButton: {
    flex: 1,
  },
  buttonDestructive: {
    backgroundColor: "#DC2626",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  buttonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
