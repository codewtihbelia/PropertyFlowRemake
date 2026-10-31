import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

export interface MobilePlatformSettings {
  latestVersion: string;
  minSupportedVersion?: string;
  releaseTitle?: string;
  releaseNotes?: string;
  apkDownloadUrl?: string;
  forceUpdate?: boolean;
  announcementBanner?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_PLATFORM_SETTINGS: MobilePlatformSettings = {
  latestVersion: "2.9.5",
  minSupportedVersion: "2.0.0",
  releaseTitle: "Version 2.9.5 — Fair Water Splitting & Real-Time Social Chat",
  releaseNotes:
    "• Cycle-scoped water billing rules with automatic non-payor absorption\n• Messenger-style direct messaging with slide-to-reply and floating reaction bar\n• Integrated Community Reels gallery with verified full-bleed playback\n• Exact centavo-accurate fair bill splitting with remainder distribution\n• End-to-end encrypted conversations and real-time ledger synchronization",
  apkDownloadUrl:
    "https://github.com/Splitzy/Splitzy-Mobile/releases/download/v2.9.5/Splitzy.apk",
  forceUpdate: false,
  maintenanceMode: false,
  maintenanceMessage: "",
  updatedAt: new Date().toISOString(),
};

// Singleton state to avoid multiple duplicate Firestore WebSocket listeners and memory leaks
let cachedSettings: MobilePlatformSettings = { ...DEFAULT_PLATFORM_SETTINGS };
const subscribers = new Set<(settings: MobilePlatformSettings) => void>();
let globalUnsubPrimary: (() => void) | null = null;
let globalUnsubSecondary: (() => void) | null = null;
let isListening = false;

function areSettingsEqual(a: MobilePlatformSettings, b: MobilePlatformSettings): boolean {
  return (
    a.latestVersion === b.latestVersion &&
    a.apkDownloadUrl === b.apkDownloadUrl &&
    a.minSupportedVersion === b.minSupportedVersion &&
    a.releaseTitle === b.releaseTitle &&
    a.releaseNotes === b.releaseNotes &&
    a.forceUpdate === b.forceUpdate &&
    a.announcementBanner === b.announcementBanner &&
    a.maintenanceMode === b.maintenanceMode &&
    a.maintenanceMessage === b.maintenanceMessage &&
    a.updatedAt === b.updatedAt
  );
}

function notifySubscribers(newSettings: MobilePlatformSettings) {
  if (areSettingsEqual(cachedSettings, newSettings)) {
    return; // Prevent duplicate re-renders and memory growth
  }
  cachedSettings = newSettings;
  subscribers.forEach((cb) => {
    try {
      cb(cachedSettings);
    } catch (e) {
      console.error("[platformSettingsService] subscriber callback error:", e);
    }
  });
}

function startGlobalListener() {
  if (isListening) return;
  isListening = true;

  let hasReceivedPrimary = false;

  try {
    const primaryRef = doc(db, "platform_settings", "global");
    globalUnsubPrimary = onSnapshot(
      primaryRef,
      (snap) => {
        if (snap.exists()) {
          hasReceivedPrimary = true;
          const data = snap.data();
          notifySubscribers({
            latestVersion: data.latestVersion || DEFAULT_PLATFORM_SETTINGS.latestVersion,
            minSupportedVersion: data.minSupportedVersion || DEFAULT_PLATFORM_SETTINGS.minSupportedVersion,
            releaseTitle: data.releaseTitle || DEFAULT_PLATFORM_SETTINGS.releaseTitle,
            releaseNotes: data.releaseNotes || DEFAULT_PLATFORM_SETTINGS.releaseNotes,
            apkDownloadUrl: data.apkDownloadUrl || DEFAULT_PLATFORM_SETTINGS.apkDownloadUrl,
            forceUpdate: Boolean(data.forceUpdate),
            announcementBanner: data.announcementBanner || "",
            maintenanceMode: Boolean(data.maintenanceMode),
            maintenanceMessage: data.maintenanceMessage || "",
            updatedAt: data.updatedAt || DEFAULT_PLATFORM_SETTINGS.updatedAt,
            updatedBy: data.updatedBy,
          });
        } else if (!hasReceivedPrimary) {
          trySecondary();
        }
      },
      (err) => {
        console.warn("[platformSettingsService] Primary settings listener warning:", err);
        if (!hasReceivedPrimary) {
          trySecondary();
        }
      }
    );
  } catch (err) {
    console.warn("[platformSettingsService] Primary setup error:", err);
    trySecondary();
  }

  function trySecondary() {
    if (globalUnsubSecondary) return;
    try {
      const secondaryRef = doc(db, "systemSettings", "platform");
      globalUnsubSecondary = onSnapshot(
        secondaryRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            notifySubscribers({
              latestVersion: data.latestVersion || DEFAULT_PLATFORM_SETTINGS.latestVersion,
              minSupportedVersion: data.minSupportedVersion || DEFAULT_PLATFORM_SETTINGS.minSupportedVersion,
              releaseTitle: data.releaseTitle || DEFAULT_PLATFORM_SETTINGS.releaseTitle,
              releaseNotes: data.releaseNotes || DEFAULT_PLATFORM_SETTINGS.releaseNotes,
              apkDownloadUrl: data.apkDownloadUrl || DEFAULT_PLATFORM_SETTINGS.apkDownloadUrl,
              forceUpdate: Boolean(data.forceUpdate),
              announcementBanner: data.announcementBanner || "",
              maintenanceMode: Boolean(data.maintenanceMode),
              maintenanceMessage: data.maintenanceMessage || "",
              updatedAt: data.updatedAt || DEFAULT_PLATFORM_SETTINGS.updatedAt,
              updatedBy: data.updatedBy,
            });
          } else {
            notifySubscribers(DEFAULT_PLATFORM_SETTINGS);
          }
        },
        () => {
          notifySubscribers(DEFAULT_PLATFORM_SETTINGS);
        }
      );
    } catch {
      notifySubscribers(DEFAULT_PLATFORM_SETTINGS);
    }
  }
}

function stopGlobalListener() {
  if (!isListening) return;
  if (globalUnsubPrimary) {
    globalUnsubPrimary();
    globalUnsubPrimary = null;
  }
  if (globalUnsubSecondary) {
    globalUnsubSecondary();
    globalUnsubSecondary = null;
  }
  isListening = false;
}

/**
 * Listens to real-time platform settings updates configured by the Super Admin in the mobile app.
 * Uses a deduplicated singleton listener to prevent multiple simultaneous WebSocket connections and memory leaks.
 */
export function listenToMobilePlatformSettings(
  callback: (settings: MobilePlatformSettings) => void
): () => void {
  // Immediately supply latest cached settings
  try {
    callback(cachedSettings);
  } catch (e) {
    console.error("[platformSettingsService] initial callback error:", e);
  }

  subscribers.add(callback);
  startGlobalListener();

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0) {
      stopGlobalListener();
    }
  };
}
