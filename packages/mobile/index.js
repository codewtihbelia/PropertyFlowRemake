import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, LogBox } from "react-native";
import { registerRootComponent } from "expo";
import * as WebBrowser from "expo-web-browser";

// Ignore expected Expo Go SDK 53 remote notifications deprecation warnings
LogBox.ignoreLogs([
  "Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go",
  "expo-notifications: Android Push notifications",
]);

// Complete any pending browser auth sessions immediately on app launch/resume
if (typeof WebBrowser.maybeCompleteAuthSession === "function") {
  WebBrowser.maybeCompleteAuthSession();
}

// Install early global JS error guard so non-fatal startup warnings never crash the native process
const globalAny = globalThis;
if (
  globalAny.ErrorUtils &&
  typeof globalAny.ErrorUtils.getGlobalHandler === "function"
) {
  const defaultHandler = globalAny.ErrorUtils.getGlobalHandler();
  globalAny.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const errorMsg = String(error?.message || error || "");
    // Prevent Expo SDK 53 remote notification limitation from triggering RedBox dialog
    if (errorMsg.includes("removed from Expo Go")) {
      return;
    }
    console.warn(
      "[GlobalErrorGuard] Caught error (fatal=" + Boolean(isFatal) + "):",
      error,
    );
    if (defaultHandler && !isFatal) {
      defaultHandler(error, isFatal);
    }
  });
}

class RootCrashBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage:
        error?.message || String(error) || "Startup error occurred.",
    };
  }

  componentDidCatch(error, info) {
    console.warn("[RootCrashBoundary] Caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to Load Screen</Text>
          <Text style={styles.errorMessage}>{this.state.errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, errorMessage: "" })}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

let CachedAppComponent = null;

function LazyAppLoader() {
  if (!CachedAppComponent) {
    const mod = require("./src/App");
    CachedAppComponent = mod.default || mod;
  }
  const AppComponent = CachedAppComponent;
  return <AppComponent />;
}

function RootBootstrap() {
  return (
    <RootCrashBoundary>
      <LazyAppLoader />
    </RootCrashBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});

registerRootComponent(RootBootstrap);
