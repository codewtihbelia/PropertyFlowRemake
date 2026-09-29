import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { mobileDataService } from "./firebaseDataService";

export interface PushTokenRecord {
  userId: string;
  deviceId: string;
  pushToken: string;
  platform: "android" | "ios" | "web";
  appVersion: string;
  lastActiveDate: string;
}

const DEVICE_STORAGE_KEY = "@pf_persistent_device_id";

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

export async function registerForPushNotificationsAsync(
  userId: string,
): Promise<string | null> {
  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    (Constants as any).appOwnership === "expo";

  if (isExpoGo && Platform.OS === "android") {
    return `ExponentPushToken[expo-go-dev-${userId}]`;
  }

  let token: string | null = null;

  try {
    const Notifications = require("expo-notifications");

    const permissionStatus = (await Notifications.getPermissionsAsync()) as any;
    const existingStatus = permissionStatus?.status;
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const requestedStatus =
        (await Notifications.requestPermissionsAsync()) as any;
      finalStatus = requestedStatus?.status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any).easConfig?.projectId ||
      "bc0bb695-d19f-44ed-af2e-4ec21899a49a";

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenData?.data || null;

    if (token) {
      const deviceId = await getOrCreateDeviceId();
      const record: PushTokenRecord = {
        userId,
        deviceId,
        pushToken: token,
        platform: Platform.OS as any,
        appVersion: "1.0.0",
        lastActiveDate: new Date().toISOString(),
      };
      await mobileDataService.savePushToken(record);
    }
  } catch (error) {
    console.warn(
      "[PushNotification] Gracefully handled push notification setup:",
      error,
    );
    token = `ExponentPushToken[dev-fallback-${userId}]`;
  }

  return token;
}
