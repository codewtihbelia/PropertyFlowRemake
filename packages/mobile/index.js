import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LogBox,
  ActivityIndicator,
} from "react-native";
import { registerRootComponent } from "expo";
import * as WebBrowser from "expo-web-browser";
import App from "./src/App";

// Ignore expected Expo Go SDK remote notifications deprecation warnings
LogBox.ignoreLogs([
  "Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go",
  "expo-notifications: Android Push notifications",
]);

// Complete any pending browser auth sessions immediately on app launch/resume
if (typeof WebBrowser.maybeCompleteAuthSession === "function") {
  WebBrowser.maybeCompleteAuthSession();
}

// Safely probe for expo-updates
let UpdatesModule = null;
try {
  UpdatesModule = require("expo-updates");
} catch (_) {}

// Install early global JS error guard so non-fatal startup warnings never crash the native process
const globalAny = globalThis;
if (
  globalAny.ErrorUtils &&
  typeof globalAny.ErrorUtils.getGlobalHandler === "function"
) {
  const defaultHandler = globalAny.ErrorUtils.getGlobalHandler();
  globalAny.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const errorMsg = String(error?.message || error || "");
    // Prevent Expo SDK remote notification limitation from triggering RedBox dialog
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
    this.state = {
      hasError: false,
      errorMessage: "",
      isRollingBack: false,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage:
        error?.message || String(error) || "Startup error occurred.",
    };
  }

  componentDidCatch(error, info) {
    console.warn("[RootCrashBoundary] Caught startup crash:", error, info);
  }

  handleRollback = async () => {
    this.setState({ isRollingBack: true });
    try {
      if (UpdatesModule && typeof UpdatesModule.reloadAsync === "function") {
        await UpdatesModule.reloadAsync();
        return;
      }
    } catch (err) {
      console.warn("[RootCrashBoundary] Rollback reload error:", err);
    }
    this.setState({ hasError: false, errorMessage: "", isRollingBack: false });
  };

  render() {
    if (this.state.hasError) {
      const isOtaUpdate = Boolean(
        UpdatesModule &&
        UpdatesModule.isEnabled &&
        UpdatesModule.isEmbeddedLaunch === false,
      );

      return (
        <View style={styles.errorContainer}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>⚠️</Text>
          </View>
          <Text style={styles.errorTitle}>Unable to Load Screen</Text>
          <Text style={styles.errorMessage}>{this.state.errorMessage}</Text>

          {isOtaUpdate && (
            <Text style={styles.otaNotice}>
              An unexpected issue occurred after applying the latest update. You
              can restore the stable built-in version or retry.
            </Text>
          )}

          <View style={styles.actionRow}>
            {isOtaUpdate && (
              <TouchableOpacity
                style={[styles.actionButton, styles.rollbackButton]}
                onPress={this.handleRollback}
                disabled={this.state.isRollingBack}
                activeOpacity={0.8}
              >
                {this.state.isRollingBack ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.rollbackText}>Restore Stable</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.retryButton,
                !isOtaUpdate && styles.fullWidthButton,
              ]}
              onPress={() =>
                this.setState({
                  hasError: false,
                  errorMessage: "",
                  isRollingBack: false,
                })
              }
              disabled={this.state.isRollingBack}
              activeOpacity={0.8}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootBootstrap() {
  return (
    <RootCrashBoundary>
      <App />
    </RootCrashBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  otaNotice: {
    fontSize: 12,
    color: "#CBD5E1",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 17,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.5)",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    maxWidth: 320,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidthButton: {
    flex: 1,
  },
  rollbackButton: {
    backgroundColor: "#DC2626",
  },
  rollbackText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: "#2563EB",
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});

registerRootComponent(RootBootstrap);
