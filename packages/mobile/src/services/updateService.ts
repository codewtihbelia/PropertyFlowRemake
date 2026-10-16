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

  /**
   * Initializes silent background update check on app launch.
   * Runs non-blockingly without delaying splash screen or UI interaction.
   */
  public async initBackgroundUpdateCheck(): Promise<void> {
    if (this.hasChecked) return;
    this.hasChecked = true;

    // Updates are only active in published standalone/preview/production builds
    if (__DEV__) {
      return;
    }

    const updates = getUpdatesModule();
    if (!updates || !updates.isEnabled) {
      return;
    }

    // Defer check by 6 seconds so initial splash, audio chime, and native boot settle cleanly
    setTimeout(async () => {
      try {
        const check = await updates.checkForUpdateAsync();
        if (check.isAvailable) {
          // Silently download the new JavaScript bundle and assets in the background
          await updates.fetchUpdateAsync();
          // The downloaded bundle will automatically be mounted on the user's next app start.
        }
      } catch (err) {
        // Network failure, concurrent check, or offline mode: silently ignore so user experience is uninterrupted
        console.warn("[UpdateService] Background check notice:", err);
      }
    }, 6000);
  }

  /**
   * Manually check if an update is available (for settings/about screens).
   */
  public async checkForUpdateManually(): Promise<{
    available: boolean;
    manifest?: any;
  }> {
    if (__DEV__) {
      return { available: false };
    }

    const updates = getUpdatesModule();
    if (!updates || !updates.isEnabled) {
      return { available: false };
    }

    try {
      const check = await updates.checkForUpdateAsync();
      if (check.isAvailable) {
        await updates.fetchUpdateAsync();
        return { available: true, manifest: check.manifest };
      }
      return { available: false };
    } catch {
      return { available: false };
    }
  }

  /**
   * Immediately reloads the app to apply a staged update.
   */
  public async applyUpdateNow(): Promise<void> {
    const updates = getUpdatesModule();
    if (updates && updates.isEnabled) {
      await updates.reloadAsync();
    }
  }
}

export const updateService = new UpdateService();
