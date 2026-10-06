import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ViewStyle,
  StyleProp,
  Keyboard,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

export interface SmoothBottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  variant?: "bottom-sheet" | "center";
  showChipBar?: boolean;
  showCloseBtn?: boolean;
  maxHeight?: number | `${number}%`;
  sheetStyle?: StyleProp<ViewStyle>;
  dismissible?: boolean;
}

export const SmoothBottomSheetModal: React.FC<SmoothBottomSheetModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  headerRight,
  children,
  variant = "bottom-sheet",
  showChipBar = true,
  showCloseBtn,
  maxHeight = "90%",
  sheetStyle,
  dismissible = true,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const [isRendered, setIsRendered] = useState(visible);
  const animValue = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Track native keyboard height dynamically on both iOS and Android
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: any) => {
      setKeyboardHeight(e?.endCoordinates?.height || 0);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Compute adaptive maxHeight so the sheet never blows past the top of the screen when elevated
  const { height: windowHeight } = Dimensions.get("window");
  const computedMaxHeight = useMemo(() => {
    let base = windowHeight * 0.9;
    if (typeof maxHeight === "number") {
      base = maxHeight;
    } else if (typeof maxHeight === "string" && maxHeight.endsWith("%")) {
      const pct = parseFloat(maxHeight) / 100;
      if (!isNaN(pct)) base = windowHeight * pct;
    }

    if (keyboardHeight > 0) {
      const safeTop = insets.top + (Platform.OS === "android" ? 12 : 20);
      const availableSpace = windowHeight - keyboardHeight - safeTop;
      return Math.min(base, Math.max(220, availableSpace));
    }
    return base;
  }, [maxHeight, keyboardHeight, windowHeight, insets.top]);

  // Decide if close button should be shown
  const shouldShowCloseBtn =
    showCloseBtn !== undefined
      ? showCloseBtn
      : Boolean(title || icon || subtitle);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 280,
        easing: Easing.bezier(0.2, 0.9, 0.3, 1),
        useNativeDriver: true,
      }).start();
    } else if (isRendered) {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setIsRendered(false);
      });
    }
  }, [visible]);

  if (!isRendered) return null;

  const isCenter = variant === "center";

  // Backdrop fade
  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Slide up & fade in
  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [isCenter ? 40 : 160, 0],
  });

  const cardOpacity = animValue.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.8, 1],
  });

  const cardScale = isCenter
    ? animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.94, 1],
      })
    : 1;

  const handleDismiss = () => {
    if (!dismissible) return;
    Animated.timing(animValue, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsRendered(false);
      onClose();
    });
  };

  const hasHeader = Boolean(
    title || icon || subtitle || shouldShowCloseBtn || headerRight,
  );

  return (
    <Modal
      transparent
      visible={isRendered}
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardContainer}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableWithoutFeedback onPress={handleDismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        <View
          style={[
            styles.wrapper,
            isCenter ? styles.wrapperCenter : styles.wrapperBottom,
            !isCenter &&
              keyboardHeight > 0 && {
                paddingBottom: Platform.OS === "android" ? keyboardHeight : 0,
              },
            isCenter &&
              keyboardHeight > 0 && {
                paddingBottom: keyboardHeight / 2,
              },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              isCenter ? styles.centerCard : styles.bottomSheetCard,
              !isCenter && {
                paddingBottom:
                  keyboardHeight > 0
                    ? 16
                    : Math.max(
                        insets.bottom,
                        Platform.OS === "android" ? 24 : 16,
                      ) + 16,
              },
              {
                maxHeight: computedMaxHeight,
                opacity: cardOpacity,
                transform: [{ translateY }, { scale: cardScale }],
              },
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderTopColor: colors.border,
              },
              sheetStyle,
            ]}
          >
            {/* Top Chip Bar (Pull Handle / Indicator) */}
            {showChipBar && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleDismiss}
                style={styles.chipBarContainer}
                accessibilityLabel="Modal drag handle"
              >
                <View
                  style={[
                    styles.chipBar,
                    isDark && { backgroundColor: "rgba(255, 255, 255, 0.2)" },
                  ]}
                />
              </TouchableOpacity>
            )}

            {/* Optional Header */}
            {hasHeader && (
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  {icon && (
                    <View
                      style={[
                        styles.iconWrap,
                        isDark && {
                          backgroundColor: colors.surfaceInset,
                        },
                      ]}
                    >
                      {icon}
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    {title && (
                      <Text
                        style={[
                          styles.titleText,
                          isDark && { color: colors.text },
                        ]}
                      >
                        {title}
                      </Text>
                    )}
                    {subtitle && (
                      <Text
                        style={[
                          styles.subtitleText,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        {subtitle}
                      </Text>
                    )}
                  </View>
                </View>

                {headerRight && (
                  <View style={{ marginRight: 8 }}>{headerRight}</View>
                )}

                {shouldShowCloseBtn && (
                  <TouchableOpacity
                    onPress={handleDismiss}
                    style={[
                      styles.closeBtn,
                      isDark && {
                        backgroundColor: colors.surfaceInset,
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Close modal"
                  >
                    <Feather
                      name="x"
                      size={19}
                      color={isDark ? colors.text : "#64748B"}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Main Modal Body */}
            {children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    position: "relative",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.54)",
  },
  wrapper: {
    flex: 1,
  },
  wrapperBottom: {
    justifyContent: "flex-end",
  },
  wrapperCenter: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  bottomSheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 38 : 28,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(226, 232, 240, 0.8)",
  },
  centerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 390,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
  },
  chipBarContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 14,
  },
  chipBar: {
    width: 44,
    height: 5,
    borderRadius: 9999,
    backgroundColor: "#CBD5E1",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    gap: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
});
