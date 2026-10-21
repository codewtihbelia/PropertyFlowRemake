/**
 * Service to manage Over-The-Air (OTA) updates using EAS Update.
 * Supports:
 * 1. Startup check with strict 5-second deadline during SplashScreen (download + reloadAsync).
 * 2. Background check for active sessions (deferred by 25s so it never collides with startup).
 * 3. Manual check from settings/maintenance views with one-tap reload.
 */

interface SafeUpdatesModule {
  isEnabled: boolean;
  isEmbeddedLaunch?: boolean;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean; manifest?: any }>;
  fetchUpdateAsync: () => Promise<any>;
  reloadAsync: () => Promise<void>;
}

function getUpdatesModule(): SafeUpdatesModule | null {
  try {
    return require("expo-updates");
  } catch {
    return null;
  }
}

export type UpdateSyncStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "reloading";

class UpdateService {
  private hasCheckedStartup = false;
  private isFetching = false;
  private statusListeners: Set<(status: UpdateSyncStatus) => void> = new Set();

  public subscribeStatus(
    listener: (status: UpdateSyncStatus) => void,
  ): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(status: UpdateSyncStatus) {
    this.statusListeners.forEach((fn) => {
      try {
        fn(status);
      } catch (_) {}
    });
  }

  /**
   * Checks for and immediately applies any newly published EAS update during the startup splash window.
   * Strictly respects the 5-second deadline so users are never blocked or stuck on splash.
   * If an update is fetched, immediately reloads into the fresh bundle.
   */
  public async checkAndApplyStartupUpdate(
    timeoutMs = 5000,
  ): Promise<{ updated: boolean }> {
    if (this.hasCheckedStartup || this.isFetching) {
      return { updated: false };
    }
    this.hasCheckedStartup = true;

    // Updates are only active in published standalone/preview/production builds
    if (__DEV__) {
      return { updated: false };
    }

    const updates = getUpdatesModule();
    if (!updates || !updates.isEnabled) {
      return { updated: false };
    }

    this.isFetching = true;
    const startTime = Date.now();

    try {
      this.notifyStatus("checking");

      // Check for update raced against deadline
      const checkPromise = updates.checkForUpdateAsync();
      const checkTimeout = new Promise<{ isAvailable: boolean }>((resolve) =>
        setTimeout(() => resolve({ isAvailable: false }), timeoutMs),
      );

      const checkResult = await Promise.race([checkPromise, checkTimeout]);

      if (checkResult && checkResult.isAvailable) {
        this.notifyStatus("downloading");

        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(1000, timeoutMs - elapsed);

        const fetchPromise = updates.fetchUpdateAsync();
        const fetchTimeout = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), remainingTime),
        );

        const fetchResult = await Promise.race([fetchPromise, fetchTimeout]);

        if (fetchResult !== null) {
          this.notifyStatus("reloading");
          // Short delay to display reload indicator smoothly
          await new Promise((r) => setTimeout(r, 250));
          await updates.reloadAsync();
          return { updated: true };
        }
      }
    } catch (err: any) {
      console.warn(
        "[UpdateService] Startup check warning:",
        err?.message || err,
      );
    } finally {
      this.isFetching = false;
      this.notifyStatus("idle");
    }

    return { updated: false };
  }

  /**
   * Initializes silent background update check on app launch for prolonged sessions.
   * Defers by 25 seconds so startup and splash settle cleanly.
   */
  public async initBackgroundUpdateCheck(): Promise<void> {
    if (__DEV__) {
      return;
    }

    const updates = getUpdatesModule();
    if (!updates || !updates.isEnabled) {
      return;
    }

    // Defer check by 25 seconds to avoid colliding with startup flow
    setTimeout(async () => {
      if (this.isFetching) return;
      this.isFetching = true;

      try {
        const check = await updates.checkForUpdateAsync();
        if (check.isAvailable) {
          const fetchPromise = updates.fetchUpdateAsync();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Update fetch timeout (25s)")),
              25000,
            ),
          );

          await Promise.race([fetchPromise, timeoutPromise]);
          // The downloaded bundle will cleanly mount on next launch
        }
      } catch (err: any) {
        console.warn(
          "[UpdateService] Background update check notice:",
          err?.message || err,
        );
      } finally {
        this.isFetching = false;
      }
    }, 25000);
  }

  /**
   * Manually check if an update is available (for settings/about screens).
   */
  public async checkForUpdateManually(): Promise<{
    available: boolean;
    manifest?: any;
    error?: string;
  }> {
    if (__DEV__) {
      return { available: false };
    }

    const updates = getUpdatesModule();
    if (!updates || !updates.isEnabled) {
      return {
        available: false,
        error: "Updates not enabled in current environment",
      };
    }

    if (this.isFetching) {
      return {
        available: false,
        error: "An update is currently being processed",
      };
    }

    this.isFetching = true;
    try {
      const check = await updates.checkForUpdateAsync();
      if (check.isAvailable) {
        const fetchPromise = updates.fetchUpdateAsync();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Download timed out (30s)")),
            30000,
          ),
        );
        await Promise.race([fetchPromise, timeoutPromise]);
        return { available: true, manifest: check.manifest };
      }
      return { available: false };
    } catch (err: any) {
      return {
        available: false,
        error: err?.message || "Failed to download update",
      };
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Immediately reloads the app to apply a staged update.
   */
  public async applyUpdateNow(): Promise<void> {
    const updates = getUpdatesModule();
    if (updates && updates.isEnabled) {
      try {
        await updates.reloadAsync();
      } catch (e) {
        console.warn("[UpdateService] Reload warning:", e);
      }
    }
  }
}

export const updateService = new UpdateService();
