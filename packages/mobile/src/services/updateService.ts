/**
 * Service to manage silent background Over-The-Air (OTA) updates using EAS Update.
 * Safely resolves expo-updates dynamically to prevent compilation errors if the module
 * has not yet been installed locally, while functioning seamlessly in compiled builds.
 */

interface SafeUpdatesModule {
  isEnabled: boolean;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean; manifest?: any }>;
  fetchUpdateAsync: () => Promise<any>;
  reloadAsync: () => Promise<void>;
}

function getUpdatesModule(): SafeUpdatesModule | null {
  try {
    // Dynamic require so missing local dependencies or type definitions don't block development
    return require("expo-updates");
  } catch {
    return null;
  }
}

class UpdateService {
  private hasChecked = false;
  private isFetching = false;

  /**
   * Initializes silent background update check on app launch.
   * Runs non-blockingly without delaying splash screen or UI interaction.
   * Includes concurrency guard and timeout to avoid hanging or corrupted downloads.
   */
  public async initBackgroundUpdateCheck(): Promise<void> {
    if (this.hasChecked || this.isFetching) return;
    this.hasChecked = true;

    // Updates are only active in published standalone/preview/production builds
    if (__DEV__) {
      return;
    }

    const updates = getUpdatesModule();
    if (!updates || !updates.isEnabled) {
      return;
    }

    // Defer check by 8 seconds so initial splash, audio chime, and native boot settle cleanly
    setTimeout(async () => {
      if (this.isFetching) return;
      this.isFetching = true;

      try {
        const check = await updates.checkForUpdateAsync();
        if (check.isAvailable) {
          // Wrap fetch in a timeout so poor connections don't hang indefinitely or corrupt bundles
          const fetchPromise = updates.fetchUpdateAsync();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Update fetch timeout (25s)")),
              25000,
            ),
          );

          await Promise.race([fetchPromise, timeoutPromise]);
          // The downloaded bundle will cleanly mount on the user's next app start.
        }
      } catch (err: any) {
        // Network timeout, offline mode, or concurrent fetch: silently ignore so user experience is uninterrupted
        console.warn(
          "[UpdateService] Background update check notice:",
          err?.message || err,
        );
      } finally {
        this.isFetching = false;
      }
    }, 8000);
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
        error: "An update is currently being downloaded",
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
