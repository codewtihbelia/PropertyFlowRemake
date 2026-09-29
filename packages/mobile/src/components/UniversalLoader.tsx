import React, { useEffect, useRef } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

export type MobileSkeletonType =
  | "home"
  | "bills"
  | "attendance"
  | "profile"
  | "groups"
  | "cards"
  | "history"
  | "messages"
  | "form"
  | "reports"
  | "notifications"
  | "generic";

interface UniversalLoaderProps {
  text?: string;
  subtitle?: string;
  transparent?: boolean;
  variant?: "spinner" | "skeleton";
  type?: MobileSkeletonType;
}

export const UniversalLoader: React.FC<UniversalLoaderProps> = ({
  text,
  subtitle,
  transparent = true,
  variant = "spinner",
  type = "home",
}) => {
  const { isDark, colors } = useTheme();

  if (variant === "skeleton") {
    return <UniversalSkeleton type={type} />;
  }

  return (
    <View
      style={[
        styles.container,
        transparent
          ? isDark
            ? { backgroundColor: "rgba(0, 0, 0, 0.65)" }
            : styles.transparentBg
          : isDark
            ? { backgroundColor: colors.background }
            : styles.solidBg,
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.card,
          isDark && {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: "#000000",
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        {text ? (
          <Text style={[styles.text, isDark && { color: colors.text }]}>
            {text}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            style={[styles.subtitle, isDark && { color: colors.textSecondary }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export const UniversalSkeleton: React.FC<{ type?: MobileSkeletonType }> = ({
  type = "home",
}) => {
  const { isDark, colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.75 : 0.85,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.25 : 0.35,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, isDark]);

  const blockColor = isDark ? colors.surfaceInset : "#E2E8F0";
  const cardBorderColor = isDark ? colors.border : "#CBD5E1";
  const wrapperBg = isDark ? colors.background : "#F8FAFC";

  const blockStyle = {
    opacity: pulseAnim,
    backgroundColor: blockColor,
  };
  const cardBlockStyle = {
    opacity: pulseAnim,
    backgroundColor: isDark ? colors.card : "#E2E8F0",
    borderColor: cardBorderColor,
  };

  const dynamicCardContainer = isDark
    ? { backgroundColor: colors.card, borderColor: colors.border }
    : undefined;

  const renderContent = () => {
    if (type === "bills") {
      return (
        <View style={skStyles.wrapper}>
          <Animated.View
            style={[skStyles.pill, blockStyle, { width: 140, height: 32 }]}
          />
          <Animated.View
            style={[skStyles.card, cardBlockStyle, { height: 160 }]}
          />
          <View style={skStyles.row}>
            <Animated.View
              style={[skStyles.card, cardBlockStyle, { flex: 1, height: 75 }]}
            />
            <Animated.View
              style={[skStyles.card, cardBlockStyle, { flex: 1, height: 75 }]}
            />
            <Animated.View
              style={[skStyles.card, cardBlockStyle, { flex: 1, height: 75 }]}
            />
          </View>
          <Animated.View
            style={[
              skStyles.line,
              blockStyle,
              { width: 120, height: 20, marginTop: 10 },
            ]}
          />
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                skStyles.rowItem,
                isDark && { borderColor: colors.border },
              ]}
            >
              <Animated.View
                style={[skStyles.circle, blockStyle, { width: 44, height: 44 }]}
              />
              <View style={{ flex: 1, gap: 8 }}>
                <Animated.View
                  style={[
                    skStyles.line,
                    blockStyle,
                    { width: "55%", height: 14 },
                  ]}
                />
                <Animated.View
                  style={[
                    skStyles.line,
                    blockStyle,
                    { width: "35%", height: 11 },
                  ]}
                />
              </View>
              <Animated.View
                style={[skStyles.line, blockStyle, { width: 64, height: 16 }]}
              />
            </View>
          ))}
        </View>
      );
    }

    if (type === "attendance") {
      return (
        <View style={skStyles.wrapper}>
          <View style={skStyles.betweenRow}>
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 140, height: 24 }]}
            />
            <Animated.View
              style={[skStyles.pill, blockStyle, { width: 80, height: 28 }]}
            />
          </View>
          <View
            style={[
              skStyles.card,
              dynamicCardContainer,
              { padding: 16, gap: 12 },
            ]}
          >
            <View style={skStyles.betweenRow}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <Animated.View
                  key={i}
                  style={[skStyles.pill, blockStyle, { width: 34, height: 14 }]}
                />
              ))}
            </View>
            <View style={[skStyles.betweenRow, { flexWrap: "wrap", gap: 6 }]}>
              {Array.from({ length: 28 }).map((_, i) => (
                <Animated.View
                  key={i}
                  style={[
                    skStyles.card,
                    cardBlockStyle,
                    { width: 38, height: 38, borderRadius: 10, margin: 2 },
                  ]}
                />
              ))}
            </View>
          </View>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                skStyles.rowItem,
                isDark && { borderColor: colors.border },
              ]}
            >
              <Animated.View
                style={[skStyles.circle, blockStyle, { width: 40, height: 40 }]}
              />
              <View style={{ flex: 1, gap: 6 }}>
                <Animated.View
                  style={[
                    skStyles.line,
                    blockStyle,
                    { width: "60%", height: 13 },
                  ]}
                />
                <Animated.View
                  style={[
                    skStyles.line,
                    blockStyle,
                    { width: "40%", height: 10 },
                  ]}
                />
              </View>
              <Animated.View
                style={[skStyles.pill, blockStyle, { width: 50, height: 22 }]}
              />
            </View>
          ))}
        </View>
      );
    }

    if (type === "profile") {
      return (
        <View style={skStyles.wrapper}>
          <View style={skStyles.betweenRow}>
            <Animated.View
              style={[skStyles.circle, blockStyle, { width: 44, height: 44 }]}
            />
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 100, height: 22 }]}
            />
            <Animated.View
              style={[skStyles.circle, blockStyle, { width: 44, height: 44 }]}
            />
          </View>
          <View
            style={[
              skStyles.card,
              dynamicCardContainer,
              { padding: 22, alignItems: "center", gap: 10, borderRadius: 28 },
            ]}
          >
            <Animated.View
              style={[skStyles.circle, blockStyle, { width: 88, height: 88 }]}
            />
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 150, height: 20 }]}
            />
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 190, height: 13 }]}
            />
            <Animated.View
              style={[
                skStyles.pill,
                blockStyle,
                { width: 110, height: 28, marginTop: 4 },
              ]}
            />
            <View
              style={{
                width: "100%",
                height: 1,
                backgroundColor: isDark ? colors.border : "#F1F5F9",
                marginVertical: 6,
              }}
            />
            <View
              style={[
                skStyles.betweenRow,
                { width: "100%", paddingHorizontal: 12 },
              ]}
            >
              <View style={{ alignItems: "center", gap: 4 }}>
                <Animated.View
                  style={[skStyles.line, blockStyle, { width: 44, height: 11 }]}
                />
                <Animated.View
                  style={[skStyles.line, blockStyle, { width: 56, height: 15 }]}
                />
              </View>
              <View style={{ alignItems: "center", gap: 4 }}>
                <Animated.View
                  style={[skStyles.line, blockStyle, { width: 54, height: 11 }]}
                />
                <Animated.View
                  style={[skStyles.line, blockStyle, { width: 50, height: 15 }]}
                />
              </View>
              <View style={{ alignItems: "center", gap: 4 }}>
                <Animated.View
                  style={[skStyles.line, blockStyle, { width: 44, height: 11 }]}
                />
                <Animated.View
                  style={[skStyles.line, blockStyle, { width: 40, height: 15 }]}
                />
              </View>
            </View>
          </View>
          <Animated.View
            style={[
              skStyles.line,
              blockStyle,
              { width: 120, height: 14, marginTop: 10 },
            ]}
          />
          <View
            style={[
              skStyles.card,
              dynamicCardContainer,
              { padding: 14, gap: 12, borderRadius: 24 },
            ]}
          >
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={[skStyles.row, { alignItems: "center", gap: 12 }]}
              >
                <Animated.View
                  style={[
                    skStyles.card,
                    cardBlockStyle,
                    { width: 42, height: 42, borderRadius: 14 },
                  ]}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <Animated.View
                    style={[
                      skStyles.line,
                      blockStyle,
                      { width: "60%", height: 14 },
                    ]}
                  />
                  <Animated.View
                    style={[
                      skStyles.line,
                      blockStyle,
                      { width: "40%", height: 11 },
                    ]}
                  />
                </View>
                <Animated.View
                  style={[skStyles.line, blockStyle, { width: 16, height: 16 }]}
                />
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (type === "notifications") {
      return (
        <View style={skStyles.wrapper}>
          <View style={skStyles.betweenRow}>
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 70, height: 18 }]}
            />
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 90, height: 15 }]}
            />
          </View>
          {[1, 2, 3].map((i) => (
            <View
              key={`rec_${i}`}
              style={[
                skStyles.card,
                dynamicCardContainer,
                {
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 14,
                  borderRadius: 20,
                },
              ]}
            >
              <Animated.View
                style={[
                  skStyles.card,
                  cardBlockStyle,
                  { width: 48, height: 48, borderRadius: 15 },
                ]}
              />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={skStyles.betweenRow}>
                  <Animated.View
                    style={[
                      skStyles.line,
                      blockStyle,
                      { width: "55%", height: 15 },
                    ]}
                  />
                  <Animated.View
                    style={[
                      skStyles.line,
                      blockStyle,
                      { width: 44, height: 12 },
                    ]}
                  />
                </View>
                <Animated.View
                  style={[
                    skStyles.line,
                    blockStyle,
                    { width: "92%", height: 12 },
                  ]}
                />
                <Animated.View
                  style={[
                    skStyles.line,
                    blockStyle,
                    { width: "65%", height: 12 },
                  ]}
                />
              </View>
            </View>
          ))}
          <Animated.View
            style={[
              skStyles.line,
              blockStyle,
              { width: 65, height: 18, marginTop: 6 },
            ]}
          />
          {[1, 2].map((i) => (
            <View
              key={`ear_${i}`}
              style={[
                skStyles.card,
                dynamicCardContainer,
                {
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 14,
                  borderRadius: 20,
                },
              ]}
            >
              <Animated.View
                style={[
                  skStyles.card,
                  cardBlockStyle,
                  { width: 48, height: 48, borderRadius: 15 },
                ]}
              />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={skStyles.betweenRow}>
                  <Animated.View
                    style={[
                      skStyles.line,
                      blockStyle,
                      { width: "60%", height: 15 },
                    ]}
                  />
                  <Animated.View
                    style={[
                      skStyles.line,
                      blockStyle,
                      { width: 52, height: 12 },
                    ]}
                  />
                </View>
                <Animated.View
                  style={[
                    skStyles.line,
                    blockStyle,
                    { width: "88%", height: 12 },
                  ]}
                />
                <Animated.View
                  style={[
                    skStyles.line,
                    blockStyle,
                    { width: "50%", height: 12 },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (type === "history") {
      return (
        <View style={skStyles.wrapper}>
          <Animated.View
            style={[
              skStyles.card,
              cardBlockStyle,
              { height: 44, borderRadius: 14 },
            ]}
          />
          <View style={skStyles.row}>
            <Animated.View
              style={[skStyles.pill, blockStyle, { flex: 1, height: 38 }]}
            />
            <Animated.View
              style={[skStyles.pill, blockStyle, { flex: 1, height: 38 }]}
            />
          </View>
          <View style={[skStyles.betweenRow, { marginTop: 6 }]}>
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 110, height: 14 }]}
            />
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 50, height: 12 }]}
            />
          </View>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                skStyles.rowItem,
                isDark && { borderColor: colors.border },
              ]}
            >
              <Animated.View
                style={[
                  skStyles.card,
                  cardBlockStyle,
                  { width: 46, height: 46, borderRadius: 14 },
                ]}
              />
              <View style={{ flex: 1, gap: 6 }}>
                <Animated.View
                  style={[
                    skStyles.line,
                    blockStyle,
                    { width: "65%", height: 15 },
                  ]}
                />
                <Animated.View
                  style={[
                    skStyles.line,
                    blockStyle,
                    { width: "45%", height: 11 },
                  ]}
                />
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Animated.View
                  style={[skStyles.line, blockStyle, { width: 64, height: 16 }]}
                />
                <Animated.View
                  style={[skStyles.pill, blockStyle, { width: 44, height: 16 }]}
                />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (type === "generic" || type === "cards") {
      return (
        <View style={skStyles.wrapper}>
          <Animated.View
            style={[
              skStyles.card,
              cardBlockStyle,
              { height: 84, borderRadius: 20 },
            ]}
          />
          <View style={[skStyles.betweenRow, { marginTop: 8 }]}>
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 140, height: 18 }]}
            />
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 80, height: 14 }]}
            />
          </View>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                skStyles.card,
                dynamicCardContainer,
                {
                  padding: 18,
                  borderRadius: 20,
                  gap: 12,
                },
              ]}
            >
              <View style={skStyles.betweenRow}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Animated.View
                    style={[
                      skStyles.card,
                      cardBlockStyle,
                      { width: 44, height: 44, borderRadius: 14 },
                    ]}
                  />
                  <View style={{ gap: 6 }}>
                    <Animated.View
                      style={[
                        skStyles.line,
                        blockStyle,
                        { width: 120, height: 16 },
                      ]}
                    />
                    <Animated.View
                      style={[
                        skStyles.line,
                        blockStyle,
                        { width: 80, height: 12 },
                      ]}
                    />
                  </View>
                </View>
                <Animated.View
                  style={[skStyles.pill, blockStyle, { width: 44, height: 24 }]}
                />
              </View>
            </View>
          ))}
        </View>
      );
    }

    // Default: 'home'
    return (
      <View style={skStyles.wrapper}>
        <View style={skStyles.betweenRow}>
          <View style={{ gap: 6 }}>
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 100, height: 14 }]}
            />
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 160, height: 22 }]}
            />
          </View>
          <Animated.View
            style={[skStyles.circle, blockStyle, { width: 42, height: 42 }]}
          />
        </View>
        <Animated.View
          style={[
            skStyles.card,
            cardBlockStyle,
            { height: 170, borderRadius: 24 },
          ]}
        />
        <View style={skStyles.row}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
              <Animated.View
                style={[skStyles.circle, blockStyle, { width: 52, height: 52 }]}
              />
              <Animated.View
                style={[skStyles.line, blockStyle, { width: 44, height: 10 }]}
              />
            </View>
          ))}
        </View>
        <View style={[skStyles.betweenRow, { marginTop: 12 }]}>
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 140, height: 18 }]}
          />
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 60, height: 14 }]}
          />
        </View>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[skStyles.rowItem, isDark && { borderColor: colors.border }]}
          >
            <Animated.View
              style={[
                skStyles.card,
                cardBlockStyle,
                { width: 44, height: 44, borderRadius: 14 },
              ]}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Animated.View
                style={[
                  skStyles.line,
                  blockStyle,
                  { width: "65%", height: 14 },
                ]}
              />
              <Animated.View
                style={[
                  skStyles.line,
                  blockStyle,
                  { width: "40%", height: 11 },
                ]}
              />
            </View>
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 68, height: 16 }]}
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: wrapperBg }}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  transparentBg: {
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  solidBg: {
    backgroundColor: "#F8FAFC",
  },
  card: {
    paddingVertical: 22,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minWidth: 180,
  },
  text: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
  },
});

const skStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
    backgroundColor: "transparent",
  },
  card: {
    backgroundColor: "#E2E8F0",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  line: {
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
  },
  circle: {
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
  },
  pill: {
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  betweenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
});
