import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";

interface UniversalLoaderProps {
  text?: string;
  transparent?: boolean;
}

export const UniversalLoader: React.FC<UniversalLoaderProps> = ({
  text,
  transparent = true,
}) => {
  return (
    <View
      style={[
        styles.container,
        transparent ? styles.transparentBg : styles.solidBg,
      ]}
    >
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#2563EB" />
        {text ? <Text style={styles.text}>{text}</Text> : null}
      </View>
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
    backgroundColor: "rgba(248, 250, 252, 0.85)",
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
});
