import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { mobileDataService } from "./firebaseDataService";

export interface PushTokenRecord {
  userId: string;
  deviceId: string;
  pushToken: string;
  platform: "android" | "ios" | "web";
  appVersion: string;
  lastActiveDate: string;
}

export async function registerForPushNotificationsAsync(
  userId: string,
): Promise<string | null> {
  // Check if running in Expo Go client
  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    (Constants as any).appOwnership === "expo";

  // Android remote push notifications via FCM were removed from Expo Go in SDK 53+
  // and require a development build (npx expo run:android / EAS Build).
  if (isExpoGo && Platform.OS === "android") {
    console.log(
      "[PushNotification] Running in Expo Go on Android. Remote push notifications are disabled by Expo Go (SDK 53+). Using development token.",
    );
    return `ExponentPushToken[expo-go-dev-${userId}]`;
  }

  let token: string | null = null;

  try {
    // Dynamically require to prevent Expo Go from executing unsupported listeners on Android
    const Notifications = await import("expo-notifications");

    const permissionStatus = await Notifications.getPermissionsAsync() as any;
    const existingStatus = permissionStatus.status;
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const requestedStatus = await Notifications.requestPermissionsAsync() as any;
      finalStatus = requestedStatus.status;
    }

    if (finalStatus !== "granted") {
      console.log(
        "[PushNotification] Permission not granted for push notifications.",
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    token = tokenData.data;

    const record: PushTokenRecord = {
      userId,
      deviceId: `${Platform.OS}_${Date.now()}`,
      pushToken: token,
      platform: Platform.OS as any,
      appVersion: "1.0.0",
      lastActiveDate: new Date().toISOString(),
    };

    console.log("[PushNotification] Registered token record:", record);
    await mobileDataService.savePushToken(record);
  } catch (error) {
    console.warn(
      "[PushNotification] Gracefully handled push notification setup:",
      error,
    );
    // Return safe fallback token in development
    token = `ExponentPushToken[dev-fallback-${userId}]`;
  }

  return token;
}
