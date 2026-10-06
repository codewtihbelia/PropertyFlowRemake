import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { isRunningInExpoGo } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { mobileDataService } from "./firebaseDataService";
import { doc, updateDoc, setDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase/config";

export interface PushTokenRecord {
  userId: string;
  deviceId: string;
  pushToken: string;
  platform: "android" | "ios" | "web";
  appVersion: string;
  lastActiveDate: string;
}

const DEVICE_STORAGE_KEY = "@pf_persistent_device_id";

/**
 * Returns true if running inside the Expo Go sandbox client.
 * Uses Expo's official isRunningInExpoGo() check and fallback heuristics.
 */
export function isExpoGoEnvironment(): boolean {
  try {
    if (typeof isRunningInExpoGo === "function" && isRunningInExpoGo()) {
      return true;
    }
  } catch {}

  try {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      return true;
    }
    if ((Constants as any).appOwnership === "expo") {
      return true;
    }
    if (Boolean(Constants.expoVersion)) {
      return true;
    }
  } catch {}

  return false;
}

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing) return existing;
    const generated = `${Platform.OS}_${Math.random().toString(36).substring(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `${Platform.OS}_device`;
  }
}

/**
 * Configures Android notification channels for high-priority heads-up popups with sound & vibration.
 * In Expo SDK 53, Android remote notification APIs were removed from the Expo Go sandbox client.
 * For standalone APK and EAS development builds, this configures the full native Android channels.
 */
export async function setupNotificationChannelsAsync(): Promise<void> {
  // If running inside Expo Go on Android, immediately return to avoid SDK 53 crash
  if (isExpoGoEnvironment() && Platform.OS === "android") {
    return;
  }

  try {
    const Notifications = require("expo-notifications");

    // Set foreground notification handler so notifications show cleanly
    if (typeof Notifications.setNotificationHandler === "function") {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }

    if (Platform.OS === "android") {
      // High-priority channel for messages, join approvals, and payment alerts
      await Notifications.setNotificationChannelAsync("high_priority", {
        name: "High Priority Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2563EB",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });

      // Default channel
      await Notifications.setNotificationChannelAsync("default", {
        name: "Standard Notifications",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (!msg.includes("removed from Expo Go")) {
      console.warn("[PushNotification] Notification channel notice:", err);
    }
  }
}

/**
 * Registers device for Expo Push Notifications and saves the token to Firestore.
 * Handles Expo Go gracefully (returns dev token without calling unsupported APIs),
 * and performs full FCM registration in APK / EAS builds.
 */
export async function registerForPushNotificationsAsync(
  userId: string,
): Promise<string | null> {
  const isExpoGo = isExpoGoEnvironment();

  // In Expo Go on Android (SDK 53+), remote push registration is not available in the sandbox.
  // Return safe development token immediately and bypass getExpoPushTokenAsync.
  if (isExpoGo && Platform.OS === "android") {
    return `ExponentPushToken[expo-go-dev-${userId}]`;
  }

  let token: string | null = null;

  try {
    const Notifications = require("expo-notifications");

    // Ensure channels are created first on Android for standalone / dev builds
    await setupNotificationChannelsAsync();

    const permissionStatus = (await Notifications.getPermissionsAsync()) as any;
    const existingStatus = permissionStatus?.status;
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const requestedStatus =
        (await Notifications.requestPermissionsAsync()) as any;
      finalStatus = requestedStatus?.status;
    }

    if (finalStatus !== "granted") {
      console.warn(
        "[PushNotification] Notification permission not granted. Status:",
        finalStatus,
      );
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any).easConfig?.projectId ||
      "bc0bb695-d19f-44ed-af2e-4ec21899a49a";

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenData?.data || null;

    if (token) {
      console.log("[PushNotification] Acquired valid Expo push token:", token);
      const deviceId = await getOrCreateDeviceId();
      const record: PushTokenRecord = {
        userId,
        deviceId,
        pushToken: token,
        platform: Platform.OS as any,
        appVersion: "1.0.0",
        lastActiveDate: new Date().toISOString(),
      };

      // 1. Save in users/{userId}/devices/{deviceId}
      await mobileDataService.savePushToken(record);

      // 2. Also save directly on user's primary document for fast lookup
      try {
        await setDoc(
          doc(db, "users", userId),
          {
            pushToken: token,
            pushTokens: arrayUnion(token),
            lastActiveDate: new Date().toISOString(),
          },
          { merge: true },
        );
        console.log(
          "[PushNotification] Successfully saved push token to Firestore user document for uid:",
          userId,
        );
      } catch (docErr) {
        console.warn(
          "[PushNotification] User doc push token save notice:",
          docErr,
        );
      }
    }
  } catch (error: any) {
    const msg = String(error?.message || error);
    if (!msg.includes("removed from Expo Go")) {
      console.error(
        "[PushNotification] Failed to obtain or register native push token:",
        error,
      );
    }
    token = null;
  }

  return token;
}

/**
 * Attaches a listener for when a user taps a push notification on their phone.
 */
export function setupNotificationResponseListener(
  onNotificationClick: (data: any) => void,
): () => void {
  // If running inside Expo Go on Android, skip remote response listener setup
  if (isExpoGoEnvironment() && Platform.OS === "android") {
    return () => {};
  }

  try {
    const Notifications = require("expo-notifications");
    if (
      typeof Notifications.addNotificationResponseReceivedListener ===
      "function"
    ) {
      const subscription =
        Notifications.addNotificationResponseReceivedListener(
          (response: any) => {
            const data = response?.notification?.request?.content?.data;
            if (data) {
              onNotificationClick(data);
            }
          },
        );

      return () => {
        subscription.remove();
      };
    }
  } catch {
    return () => {};
  }
  return () => {};
}
