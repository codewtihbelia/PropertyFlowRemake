import { useSyncExternalStore } from "react";
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

export const DEFAULT_PLATFORM_SETTINGS: Readonly<MobilePlatformSettings> =
  Object.freeze({
    latestVersion: "2.9.5",
    minSupportedVersion: "2.0.0",
    releaseTitle:
      "Version 2.9.5 — Fair Water Splitting & Real-Time Social Chat",
    releaseNotes:
      "• Cycle-scoped water billing rules with automatic non-payor absorption\n• Messenger-style direct messaging with slide-to-reply and floating reaction bar\n• Integrated Community Reels gallery with verified full-bleed playback\n• Exact centavo-accurate fair bill splitting with remainder distribution\n• End-to-end encrypted conversations and real-time ledger synchronization",
    apkDownloadUrl:
      "https://github.com/Splitzy/Splitzy-Mobile/releases/download/v2.9.5/Splitzy.apk",
    forceUpdate: false,
    maintenanceMode: false,
    maintenanceMessage: "",
    updatedAt: "2026-10-31T00:00:00.000Z",
  });

function normalizeTimestamp(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof (value as any)?.toDate === "function") {
    try {
      return (value as any).toDate().toISOString();
    } catch {
      return "";
    }
  }
  return String(value);
}

// Singleton state to avoid duplicate Firestore listeners, memory leaks, and render loops
let cachedSettings: Readonly<MobilePlatformSettings> =
  DEFAULT_PLATFORM_SETTINGS;
const subscribers = new Set<() => void>();
let globalUnsubPrimary: (() => void) | null = null;
let globalUnsubSecondary: (() => void) | null = null;
let isListening = false;

function areSettingsEqual(
  a: MobilePlatformSettings,
  b: MobilePlatformSettings,
): boolean {
  if (a === b) return true;
  return (
    a.latestVersion === b.latestVersion &&
    a.apkDownloadUrl === b.apkDownloadUrl &&
    a.minSupportedVersion === b.minSupportedVersion &&
    a.releaseTitle === b.releaseTitle &&
    a.releaseNotes === b.releaseNotes &&
    Boolean(a.forceUpdate) === Boolean(b.forceUpdate) &&
    (a.announcementBanner || "") === (b.announcementBanner || "") &&
    Boolean(a.maintenanceMode) === Boolean(b.maintenanceMode) &&
    (a.maintenanceMessage || "") === (b.maintenanceMessage || "") &&
    normalizeTimestamp(a.updatedAt) === normalizeTimestamp(b.updatedAt)
  );
}

function notifySubscribers(newSettings: MobilePlatformSettings) {
  if (areSettingsEqual(cachedSettings, newSettings)) {
    return; // Prevent duplicate re-renders and memory growth
  }
  cachedSettings = Object.freeze({ ...newSettings });
  subscribers.forEach((notify) => {
    try {
      notify();
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
            latestVersion:
              data.latestVersion || DEFAULT_PLATFORM_SETTINGS.latestVersion,
            minSupportedVersion:
              data.minSupportedVersion ||
              DEFAULT_PLATFORM_SETTINGS.minSupportedVersion,
            releaseTitle:
              data.releaseTitle || DEFAULT_PLATFORM_SETTINGS.releaseTitle,
            releaseNotes:
              data.releaseNotes || DEFAULT_PLATFORM_SETTINGS.releaseNotes,
            apkDownloadUrl:
              data.apkDownloadUrl || DEFAULT_PLATFORM_SETTINGS.apkDownloadUrl,
            forceUpdate: Boolean(data.forceUpdate),
            announcementBanner: data.announcementBanner || "",
            maintenanceMode: Boolean(data.maintenanceMode),
            maintenanceMessage: data.maintenanceMessage || "",
            updatedAt:
              normalizeTimestamp(data.updatedAt) ||
              DEFAULT_PLATFORM_SETTINGS.updatedAt,
            updatedBy: data.updatedBy,
          });
        } else if (!hasReceivedPrimary) {
          trySecondary();
        }
      },
      (err) => {
        console.warn(
          "[platformSettingsService] Primary settings listener warning:",
          err,
        );
        if (!hasReceivedPrimary) {
          trySecondary();
        }
      },
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
              latestVersion:
                data.latestVersion || DEFAULT_PLATFORM_SETTINGS.latestVersion,
              minSupportedVersion:
                data.minSupportedVersion ||
                DEFAULT_PLATFORM_SETTINGS.minSupportedVersion,
              releaseTitle:
                data.releaseTitle || DEFAULT_PLATFORM_SETTINGS.releaseTitle,
              releaseNotes:
                data.releaseNotes || DEFAULT_PLATFORM_SETTINGS.releaseNotes,
              apkDownloadUrl:
                data.apkDownloadUrl || DEFAULT_PLATFORM_SETTINGS.apkDownloadUrl,
              forceUpdate: Boolean(data.forceUpdate),
              announcementBanner: data.announcementBanner || "",
              maintenanceMode: Boolean(data.maintenanceMode),
              maintenanceMessage: data.maintenanceMessage || "",
              updatedAt:
                normalizeTimestamp(data.updatedAt) ||
                DEFAULT_PLATFORM_SETTINGS.updatedAt,
              updatedBy: data.updatedBy,
            });
          } else {
            notifySubscribers(DEFAULT_PLATFORM_SETTINGS);
          }
        },
        () => {
          notifySubscribers(DEFAULT_PLATFORM_SETTINGS);
        },
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

export function subscribeMobilePlatformSettings(
  onStoreChange: () => void,
): () => void {
  subscribers.add(onStoreChange);
  startGlobalListener();

  return () => {
    subscribers.delete(onStoreChange);
    if (subscribers.size === 0) {
      stopGlobalListener();
    }
  };
}

export function getMobilePlatformSettingsSnapshot(): Readonly<MobilePlatformSettings> {
  return cachedSettings;
}

/**
 * React 18 useSyncExternalStore hook for mobile platform settings.
 * Completely immune to render-phase update loops (Error #301) and memory leaks.
 */
export function useMobilePlatformSettings(): Readonly<MobilePlatformSettings> {
  return useSyncExternalStore(
    subscribeMobilePlatformSettings,
    getMobilePlatformSettingsSnapshot,
    getMobilePlatformSettingsSnapshot,
  );
}

/**
 * Backwards compatible listener for external callbacks.
 * Dispatches asynchronously to prevent re-entrant render loops.
 */
export function listenToMobilePlatformSettings(
  callback: (settings: Readonly<MobilePlatformSettings>) => void,
): () => void {
  // Never fire synchronously during component render or effect setup
  queueMicrotask(() => {
    try {
      callback(cachedSettings);
    } catch (e) {
      console.error("[platformSettingsService] initial callback error:", e);
    }
  });

  const listener = () => {
    try {
      callback(cachedSettings);
    } catch (e) {
      console.error("[platformSettingsService] subscriber callback error:", e);
    }
  };

  return subscribeMobilePlatformSettings(listener);
}
