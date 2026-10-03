// Cross-Platform Device Push & Background Notification Service
// Supports Web Notification API, PWA Service Worker Notifications, and Mobile Devices

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type NotificationPermissionStatus =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

const DISMISSED_BANNER_KEY = "splitzy_notification_banner_dismissed_v1";

class NotificationService {
  private permission: NotificationPermissionStatus = "default";
  private onNotificationClickCallback: ((data?: any) => void) | null = null;

  constructor() {
    this.checkPermission();
  }

  /**
   * Register a callback triggered when user clicks a system push notification
   */
  public setOnClickCallback(cb: (data?: any) => void) {
    this.onNotificationClickCallback = cb;
  }

  /**
   * Check if notifications are supported on this device
   */
  public isSupported(): boolean {
    try {
      return (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        typeof (window as any).Notification !== "undefined"
      );
    } catch {
      return false;
    }
  }

  /**
   * Check current device notification support and permission state
   */
  public checkPermission(): NotificationPermissionStatus {
    try {
      if (!this.isSupported()) {
        this.permission = "unsupported";
        return "unsupported";
      }

      this.permission =
        ((window as any).Notification
          ?.permission as NotificationPermissionStatus) || "default";
      return this.permission;
    } catch {
      this.permission = "unsupported";
      return "unsupported";
    }
  }

  /**
   * Request push notification permission from the user
   */
  public async requestPermission(): Promise<NotificationPermissionStatus> {
    if (!this.isSupported()) {
      this.permission = "unsupported";
      return "unsupported";
    }

    try {
      const res = await (window as any).Notification.requestPermission();
      this.permission = res as NotificationPermissionStatus;
      return this.permission;
    } catch (e) {
      console.warn("[NotificationService] Permission request error:", e);
      return this.permission;
    }
  }

  /**
   * Display a system push notification on the device
   * Shows up on phone lock screen, notification shade, or desktop banner
   */
  public async showNotification(options: {
    title: string;
    body: string;
    tag?: string;
    data?: any;
    icon?: string;
  }): Promise<boolean> {
    const currentPermission = this.checkPermission();
    if (currentPermission !== "granted") {
      return false;
    }

    const {
      title,
      body,
      tag = "splitzy-message",
      data,
      icon = "/icon-192.png",
    } = options;

    try {
      // 1. Try Service Worker registration (best for Android Chrome & mobile PWA)
      if (
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        navigator.serviceWorker.controller
      ) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && "showNotification" in registration) {
          await registration.showNotification(title, {
            body,
            icon,
            badge: icon,
            tag,
            data,
            vibrate: [100, 50, 100],
          } as any);
          return true;
        }
      }

      // 2. Standard Web Notification API fallback
      if (typeof window !== "undefined" && "Notification" in window) {
        const notif = new (window as any).Notification(title, {
          body,
          icon,
          tag,
          data,
        });

        notif.onclick = () => {
          try {
            window.focus();
            notif.close();
            if (this.onNotificationClickCallback) {
              this.onNotificationClickCallback(data);
            }
          } catch {
            // Focus ignore
          }
        };

        return true;
      }
    } catch (err) {
      console.warn("[NotificationService] showNotification error:", err);
    }

    return false;
  }

  /**
   * Send a test notification to verify device sound and lock-screen alerts
   */
  public async sendTestNotification(): Promise<boolean> {
    return this.showNotification({
      title: "Splitzy Notifications Active! 🔔",
      body: "You will now receive message alerts and bill reminders even when the app is in the background.",
      tag: "test-notification-" + Date.now(),
      data: { type: "test" },
    });
  }

  /**
   * Banner dismissal persistence
   */
  public async isBannerDismissed(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(DISMISSED_BANNER_KEY);
      return val === "true";
    } catch {
      return false;
    }
  }

  public async setBannerDismissed(dismissed: boolean): Promise<void> {
    try {
      if (dismissed) {
        await AsyncStorage.setItem(DISMISSED_BANNER_KEY, "true");
      } else {
        await AsyncStorage.removeItem(DISMISSED_BANNER_KEY);
      }
    } catch {
      // ignore
    }
  }
}

export const notificationService = new NotificationService();
