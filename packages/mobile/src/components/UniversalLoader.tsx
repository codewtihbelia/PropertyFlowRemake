import React, { useEffect, useRef } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from "react-native";

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
  | "reports";

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
  if (variant === "skeleton") {
    return <UniversalSkeleton type={type} />;
  }

  return (
    <View
      style={[
        styles.container,
        transparent ? styles.transparentBg : styles.solidBg,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#2563EB" />
        {text ? <Text style={styles.text}>{text}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

export const UniversalSkeleton: React.FC<{ type?: MobileSkeletonType }> = ({
  type = "home",
}) => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const blockStyle = { opacity: pulseAnim };

  if (type === "bills") {
    return (
      <View style={skStyles.wrapper}>
        {/* Cycle selector pill */}
        <Animated.View
          style={[skStyles.pill, blockStyle, { width: 140, height: 32 }]}
        />

        {/* Big Balance Card */}
        <Animated.View style={[skStyles.card, blockStyle, { height: 160 }]} />

        {/* 3 Metric Pills */}
        <View style={skStyles.row}>
          <Animated.View
            style={[skStyles.card, blockStyle, { flex: 1, height: 75 }]}
          />
          <Animated.View
            style={[skStyles.card, blockStyle, { flex: 1, height: 75 }]}
          />
          <Animated.View
            style={[skStyles.card, blockStyle, { flex: 1, height: 75 }]}
          />
        </View>

        {/* List Header */}
        <Animated.View
          style={[
            skStyles.line,
            blockStyle,
            { width: 120, height: 20, marginTop: 10 },
          ]}
        />

        {/* Bill Rows */}
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={skStyles.rowItem}>
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
        {/* Month selector header */}
        <View style={skStyles.betweenRow}>
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 140, height: 24 }]}
          />
          <Animated.View
            style={[skStyles.pill, blockStyle, { width: 80, height: 28 }]}
          />
        </View>

        {/* Calendar Grid Box */}
        <View style={[skStyles.card, { padding: 16, gap: 12 }]}>
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
                  blockStyle,
                  { width: 38, height: 38, borderRadius: 10, margin: 2 },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Roommates attendance rows */}
        {[1, 2, 3].map((i) => (
          <View key={i} style={skStyles.rowItem}>
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
        {/* Top Header Bar */}
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

        {/* Profile Hero Card */}
        <View
          style={[
            skStyles.card,
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

          {/* Divider */}
          <View
            style={{
              width: "100%",
              height: 1,
              backgroundColor: "#F1F5F9",
              marginVertical: 6,
            }}
          />

          {/* 3 Stats Columns */}
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

        {/* Section: Account & Money */}
        <Animated.View
          style={[
            skStyles.line,
            blockStyle,
            { width: 120, height: 14, marginTop: 10 },
          ]}
        />
        <View
          style={[skStyles.card, { padding: 14, gap: 12, borderRadius: 24 }]}
        >
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[skStyles.row, { alignItems: "center", gap: 12 }]}
            >
              <Animated.View
                style={[
                  skStyles.card,
                  blockStyle,
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

        {/* Section: Split & Preferences */}
        <Animated.View
          style={[
            skStyles.line,
            blockStyle,
            { width: 140, height: 14, marginTop: 8 },
          ]}
        />
        <View
          style={[skStyles.card, { padding: 14, gap: 12, borderRadius: 24 }]}
        >
          {[1, 2].map((i) => (
            <View
              key={i}
              style={[skStyles.row, { alignItems: "center", gap: 12 }]}
            >
              <Animated.View
                style={[
                  skStyles.card,
                  blockStyle,
                  { width: 42, height: 42, borderRadius: 14 },
                ]}
              />
              <View style={{ flex: 1, gap: 6 }}>
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
                    { width: "45%", height: 11 },
                  ]}
                />
              </View>
              <Animated.View
                style={[skStyles.pill, blockStyle, { width: 46, height: 24 }]}
              />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (type === "groups" || type === "cards") {
    return (
      <View style={skStyles.wrapper}>
        {/* Header bar */}
        <View style={skStyles.betweenRow}>
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 150, height: 24 }]}
          />
          <Animated.View
            style={[skStyles.circle, blockStyle, { width: 38, height: 38 }]}
          />
        </View>

        {/* Group Hero Banner */}
        <View
          style={[skStyles.card, { padding: 20, gap: 12, borderRadius: 22 }]}
        >
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 180, height: 22 }]}
          />
          <Animated.View
            style={[skStyles.line, blockStyle, { width: "80%", height: 13 }]}
          />
          <View style={[skStyles.row, { marginTop: 6 }]}>
            <Animated.View
              style={[skStyles.pill, blockStyle, { width: 110, height: 28 }]}
            />
            <Animated.View
              style={[skStyles.pill, blockStyle, { width: 90, height: 28 }]}
            />
          </View>
        </View>

        {/* Section title & count */}
        <View style={skStyles.betweenRow}>
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 130, height: 18 }]}
          />
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 60, height: 14 }]}
          />
        </View>

        {/* Member cards */}
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              skStyles.card,
              {
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              },
            ]}
          >
            <Animated.View
              style={[skStyles.circle, blockStyle, { width: 44, height: 44 }]}
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
              style={[skStyles.pill, blockStyle, { width: 68, height: 24 }]}
            />
          </View>
        ))}
      </View>
    );
  }

  if (type === "history") {
    return (
      <View style={skStyles.wrapper}>
        {/* Search Input Skeleton */}
        <Animated.View
          style={[skStyles.card, blockStyle, { height: 44, borderRadius: 14 }]}
        />

        {/* Filter Pills */}
        <View style={skStyles.row}>
          <Animated.View
            style={[skStyles.pill, blockStyle, { flex: 1, height: 38 }]}
          />
          <Animated.View
            style={[skStyles.pill, blockStyle, { flex: 1, height: 38 }]}
          />
        </View>

        {/* Section Date Header */}
        <View style={[skStyles.betweenRow, { marginTop: 6 }]}>
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 110, height: 14 }]}
          />
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 50, height: 12 }]}
          />
        </View>

        {/* Expense History List Items */}
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={skStyles.rowItem}>
            <Animated.View
              style={[
                skStyles.card,
                blockStyle,
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

  if (type === "messages") {
    return (
      <View style={skStyles.wrapper}>
        {/* Chat Header */}
        <View style={skStyles.betweenRow}>
          <View style={{ gap: 6 }}>
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 130, height: 20 }]}
            />
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 90, height: 12 }]}
            />
          </View>
          <Animated.View
            style={[skStyles.circle, blockStyle, { width: 36, height: 36 }]}
          />
        </View>

        {/* Message Bubbles */}
        <View style={{ flex: 1, gap: 14, marginTop: 10 }}>
          {/* Them */}
          <View
            style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}
          >
            <Animated.View
              style={[skStyles.circle, blockStyle, { width: 32, height: 32 }]}
            />
            <Animated.View
              style={[
                skStyles.card,
                blockStyle,
                { width: "65%", height: 56, borderRadius: 18 },
              ]}
            />
          </View>
          {/* Me */}
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Animated.View
              style={[
                skStyles.card,
                blockStyle,
                { width: "60%", height: 46, borderRadius: 18 },
              ]}
            />
          </View>
          {/* Them */}
          <View
            style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}
          >
            <Animated.View
              style={[skStyles.circle, blockStyle, { width: 32, height: 32 }]}
            />
            <Animated.View
              style={[
                skStyles.card,
                blockStyle,
                { width: "75%", height: 68, borderRadius: 18 },
              ]}
            />
          </View>
          {/* Me */}
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Animated.View
              style={[
                skStyles.card,
                blockStyle,
                { width: "50%", height: 42, borderRadius: 18 },
              ]}
            />
          </View>
        </View>

        {/* Bottom Input Bar */}
        <View style={[skStyles.row, { paddingBottom: 16 }]}>
          <Animated.View
            style={[
              skStyles.card,
              blockStyle,
              { flex: 1, height: 44, borderRadius: 22 },
            ]}
          />
          <Animated.View
            style={[skStyles.circle, blockStyle, { width: 44, height: 44 }]}
          />
        </View>
      </View>
    );
  }

  if (type === "form") {
    return (
      <View style={skStyles.wrapper}>
        {/* Header */}
        <View style={skStyles.betweenRow}>
          <Animated.View
            style={[skStyles.circle, blockStyle, { width: 36, height: 36 }]}
          />
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 140, height: 20 }]}
          />
          <Animated.View
            style={[skStyles.circle, blockStyle, { width: 36, height: 36 }]}
          />
        </View>

        {/* Notice Card */}
        <Animated.View
          style={[skStyles.card, blockStyle, { height: 90, borderRadius: 18 }]}
        />

        {/* Form Inputs */}
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ gap: 8 }}>
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 100, height: 13 }]}
            />
            <Animated.View
              style={[
                skStyles.card,
                blockStyle,
                { height: 48, borderRadius: 14 },
              ]}
            />
          </View>
        ))}

        {/* Submit button */}
        <Animated.View
          style={[skStyles.pill, blockStyle, { height: 50, marginTop: 12 }]}
        />
      </View>
    );
  }

  if (type === "reports") {
    return (
      <View style={skStyles.wrapper}>
        {/* Header & Month Selector */}
        <View style={skStyles.betweenRow}>
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 140, height: 22 }]}
          />
          <Animated.View
            style={[skStyles.pill, blockStyle, { width: 90, height: 30 }]}
          />
        </View>

        {/* Total Summary Card */}
        <View
          style={[skStyles.card, { padding: 20, gap: 8, borderRadius: 22 }]}
        >
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 120, height: 13 }]}
          />
          <Animated.View
            style={[skStyles.line, blockStyle, { width: 180, height: 28 }]}
          />
          <Animated.View
            style={[skStyles.line, blockStyle, { width: "70%", height: 12 }]}
          />
        </View>

        {/* Bar Chart Simulation */}
        <View
          style={[
            skStyles.card,
            { padding: 18, height: 150, justifyContent: "flex-end" },
          ]}
        >
          <View
            style={[
              skStyles.betweenRow,
              { alignItems: "flex-end", height: 110, paddingHorizontal: 10 },
            ]}
          >
            {[80, 110, 45, 60, 95].map((h, i) => (
              <Animated.View
                key={i}
                style={[
                  skStyles.card,
                  blockStyle,
                  { width: 34, height: h, borderRadius: 8 },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Breakdown List */}
        <Animated.View
          style={[
            skStyles.line,
            blockStyle,
            { width: 130, height: 16, marginTop: 6 },
          ]}
        />
        {[1, 2, 3].map((i) => (
          <View key={i} style={skStyles.rowItem}>
            <Animated.View
              style={[skStyles.circle, blockStyle, { width: 38, height: 38 }]}
            />
            <View style={{ flex: 1, gap: 6 }}>
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
                  { width: "35%", height: 10 },
                ]}
              />
            </View>
            <Animated.View
              style={[skStyles.line, blockStyle, { width: 60, height: 16 }]}
            />
          </View>
        ))}
      </View>
    );
  }

  // Default: 'home'
  return (
    <View style={skStyles.wrapper}>
      {/* Top Welcome & Notification Bar */}
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

      {/* Main Household / Balance Card */}
      <Animated.View
        style={[skStyles.card, blockStyle, { height: 170, borderRadius: 24 }]}
      />

      {/* Quick Action Buttons */}
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

      {/* Section Header */}
      <View style={[skStyles.betweenRow, { marginTop: 12 }]}>
        <Animated.View
          style={[skStyles.line, blockStyle, { width: 140, height: 18 }]}
        />
        <Animated.View
          style={[skStyles.line, blockStyle, { width: 60, height: 14 }]}
        />
      </View>

      {/* Activity / Expense Items */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={skStyles.rowItem}>
          <Animated.View
            style={[
              skStyles.card,
              blockStyle,
              { width: 44, height: 44, borderRadius: 14 },
            ]}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Animated.View
              style={[skStyles.line, blockStyle, { width: "65%", height: 14 }]}
            />
            <Animated.View
              style={[skStyles.line, blockStyle, { width: "40%", height: 11 }]}
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
    backgroundColor: "#F8FAFC",
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
