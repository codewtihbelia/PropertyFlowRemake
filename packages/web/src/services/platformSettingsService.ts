import { doc, onSnapshot, getDoc } from "firebase/firestore";
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

/**
 * Listens to real-time platform settings updates configured by the Super Admin in the mobile app.
 * Automatically tries primary `platform_settings/global` and falls back to `systemSettings/platform`.
 */
export function listenToMobilePlatformSettings(
  callback: (settings: MobilePlatformSettings) => void
): () => void {
  let unsubPrimary: (() => void) | null = null;
  let unsubSecondary: (() => void) | null = null;
  let hasReceivedPrimary = false;

  try {
    const primaryRef = doc(db, "platform_settings", "global");
    unsubPrimary = onSnapshot(
      primaryRef,
      (snap) => {
        if (snap.exists()) {
          hasReceivedPrimary = true;
          const data = snap.data();
          callback({
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
          // If primary doesn't exist, try fallback
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
    try {
      const secondaryRef = doc(db, "systemSettings", "platform");
      unsubSecondary = onSnapshot(
        secondaryRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            callback({
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
            callback(DEFAULT_PLATFORM_SETTINGS);
          }
        },
        () => {
          callback(DEFAULT_PLATFORM_SETTINGS);
        }
      );
    } catch {
      callback(DEFAULT_PLATFORM_SETTINGS);
    }
  }

  return () => {
    if (unsubPrimary) unsubPrimary();
    if (unsubSecondary) unsubSecondary();
  };
}
