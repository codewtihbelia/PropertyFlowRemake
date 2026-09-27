import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Platform,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  alertService,
  CustomAlertConfig,
  CustomAlertButton,
  AlertType,
} from "../services/alertService";

export const CustomAlertModal: React.FC = () => {
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
          <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
            <Feather name="check" size={26} color="#16A34A" />
          </View>
        );
      case "error":
        return (
          <View style={[styles.iconCircle, styles.iconCircleError]}>
            <Feather name="alert-circle" size={26} color="#DC2626" />
          </View>
        );
      case "warning":
        return (
          <View style={[styles.iconCircle, styles.iconCircleWarning]}>
            <Feather name="alert-triangle" size={24} color="#D97706" />
          </View>
        );
      case "destructive":
        return (
          <View style={[styles.iconCircle, styles.iconCircleDestructive]}>
            <Feather name="trash-2" size={24} color="#E11D48" />
          </View>
        );
      case "confirm":
        return (
          <View style={[styles.iconCircle, styles.iconCircleConfirm]}>
            <Feather name="help-circle" size={26} color="#2563EB" />
          </View>
        );
      case "info":
      default:
        return (
          <View style={[styles.iconCircle, styles.iconCircleInfo]}>
            <Feather name="info" size={26} color="#2563EB" />
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
              opacity: cardOpacity,
              transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
            },
          ]}
        >
          {/* Icon Badge */}
          {renderIcon(config.type || "info")}

          {/* Title */}
          {Boolean(config.title) && (
            <Text style={styles.titleText}>{config.title}</Text>
          )}

          {/* Message Description */}
          {Boolean(config.message) && (
            <Text style={styles.messageText}>{config.message}</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {isSingleButton ? (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => handleButtonPress(buttons[0])}
                style={[
                  styles.button,
                  config.type === "error" || config.type === "destructive"
                    ? styles.buttonDestructive
                    : styles.buttonPrimary,
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
                          ? styles.buttonCancel
                          : isDestructive
                            ? styles.buttonDestructive
                            : styles.buttonPrimary,
                      ]}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel
                            ? styles.buttonCancelText
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
                          ? styles.buttonCancel
                          : isDestructive
                            ? styles.buttonDestructive
                            : styles.buttonPrimary,
                      ]}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel
                            ? styles.buttonCancelText
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
    paddingHorizontal: 24,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.95)",
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
  iconCircleSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  iconCircleError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  iconCircleWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  iconCircleDestructive: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
  },
  iconCircleConfirm: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  iconCircleInfo: {
    backgroundColor: "#EFF6FF",
    borderColor: "#DBEAFE",
  },
  titleText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  messageText: {
    fontSize: 14,
    fontWeight: "400",
    color: "#64748B",
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
  buttonPrimary: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDestructive: {
    backgroundColor: "#DC2626",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonCancel: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
  buttonCancelText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
  },
});
