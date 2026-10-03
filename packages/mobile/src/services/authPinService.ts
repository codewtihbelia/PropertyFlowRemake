import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { mobileDataService } from "./firebaseDataService";
import { auth } from "../firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";

const PIN_HASH_PREFIX = "@splitzy_auth_pin_hash_";
const PIN_ENABLED_PREFIX = "@splitzy_pin_enabled_";
const DEVICE_SAVED_PROFILE_PREFIX = "@splitzy_device_saved_profile_";
const PIN_PROMPT_DISMISSED_PREFIX = "@splitzy_pin_prompt_dismissed_";
const CREDENTIAL_STORAGE_PREFIX = "@splitzy_auth_cred_";
const DEVICE_AVATAR_PREFIX = "@splitzy_saved_avatar_";
const LAST_PIN_USER_KEY = "@splitzy_last_pin_user";

/**
 * Pure JavaScript hex-based XOR cipher for encrypting/decrypting cached credentials
 * keyed exclusively by the user's SHA-256 PIN hash.
 */
function cipherText(text: string, key: string): string {
  let hex = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    hex += charCode.toString(16).padStart(4, "0");
  }
  return hex;
}

function decipherText(hex: string, key: string): string {
  let result = "";
  let keyIndex = 0;
  for (let i = 0; i < hex.length; i += 4) {
    const code = parseInt(hex.substring(i, i + 4), 16);
    const origCode = code ^ key.charCodeAt(keyIndex % key.length);
    result += String.fromCharCode(origCode);
    keyIndex++;
  }
  return result;
}

export interface StoredPinUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role?: string;
}

class AuthPinService {
  private sessionPasswordCache = new Map<string, string>();

  /**
   * Sets temporary in-memory session password so it can be encrypted if PIN is set or enabled
   */
  setSessionPassword(uid: string, password: string): void {
    if (!uid || !password) return;
    this.sessionPasswordCache.set(uid, password);
  }

  /**
   * Gets temporary in-memory session password
   */
  getSessionPassword(uid: string): string | undefined {
    return this.sessionPasswordCache.get(uid);
  }
  /**
   * Hashes a 4-digit PIN using SHA-256 with a UID-specific salt
   */
  async hashPin(uid: string, pin: string): Promise<string> {
    const salt = `splitzy_salt_${uid}_perm_pin`;
    const input = `${salt}:${pin}:${salt}`;
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      input,
    );
  }

  /**
   * Checks whether the user has a PIN configured locally or in their profile (read-only, no silent writes)
   */
  async hasPinConfigured(uid: string): Promise<boolean> {
    if (!uid) return false;
    try {
      const localHash = await AsyncStorage.getItem(`${PIN_HASH_PREFIX}${uid}`);
      if (localHash) return true;

      // Pure read-only check of cached or remote profile (does not write to local storage)
      const profile = await mobileDataService.getUserProfile(uid);
      if (profile?.authPinHash) {
        return true;
      }
    } catch (e) {
      console.warn("hasPinConfigured check notice:", e);
    }
    return false;
  }

  /**
   * Checks whether the user has explicitly approved saving their profile on this device
   */
  async isDeviceProfileSaved(uid: string): Promise<boolean> {
    if (!uid) return false;
    try {
      const savedUser = await this.getSavedDeviceProfile();
      return Boolean(savedUser && savedUser.uid === uid);
    } catch {
      return false;
    }
  }

  /**
   * Legacy alias: checks if user profile is saved on device
   */
  async isUserSavedOnDevice(uid: string): Promise<boolean> {
    return await this.isDeviceProfileSaved(uid);
  }

  /**
   * Checks whether the PIN security feature is actively enabled on this device for the user
   */
  async isPinEnabled(uid: string): Promise<boolean> {
    if (!uid) return false;
    try {
      // Must be explicitly saved on this device
      const isDeviceSaved = await this.isDeviceProfileSaved(uid);
      if (!isDeviceSaved) return false;

      const localEnabled = await AsyncStorage.getItem(
        `${PIN_ENABLED_PREFIX}${uid}`,
      );
      if (localEnabled !== "true") return false;

      // Verify PIN is actually configured
      return await this.hasPinConfigured(uid);
    } catch (e) {
      console.warn("isPinEnabled check notice:", e);
    }
    return false;
  }

  /**
   * Verifies an entered PIN against the stored hash
   */
  async verifyPin(uid: string, pin: string): Promise<boolean> {
    if (!uid || !pin || pin.length !== 4) return false;
    try {
      const computedHash = await this.hashPin(uid, pin);
      let storedHash = await AsyncStorage.getItem(`${PIN_HASH_PREFIX}${uid}`);

      if (!storedHash) {
        const profile = await mobileDataService.getUserProfile(uid);
        storedHash = profile?.authPinHash || null;
      }

      const isValid = storedHash === computedHash;
      if (isValid) {
        // Auto-save encrypted credential if session password exists in memory
        const cachedPassword = this.sessionPasswordCache.get(uid);
        if (cachedPassword) {
          const savedUser = await this.getSavedDeviceProfile();
          const email = savedUser?.email || auth.currentUser?.email;
          if (email) {
            await this.saveEncryptedCredential(uid, pin, email, cachedPassword);
          }
        }
      }
      return isValid;
    } catch (e) {
      console.warn("verifyPin notice:", e);
      return false;
    }
  }

  /**
   * Encrypts and securely caches the user's password keyed by the 4-digit PIN hash
   */
  async saveEncryptedCredential(
    uid: string,
    pin: string,
    email: string,
    password?: string,
  ): Promise<void> {
    if (!uid || !pin || pin.length !== 4) return;
    const pwd = password || this.sessionPasswordCache.get(uid);
    if (!pwd) return;
    try {
      const key = await this.hashPin(uid, pin);
      const encrypted = cipherText(pwd, key);
      await AsyncStorage.setItem(
        `${CREDENTIAL_STORAGE_PREFIX}${uid}`,
        JSON.stringify({ email: email.trim(), encrypted }),
      );
    } catch (e) {
      console.warn("saveEncryptedCredential error:", e);
    }
  }

  /**
   * Seamlessly restores or signs into the Firebase Auth session using the verified 4-digit PIN
   */
  async restoreFirebaseSessionWithPin(
    uid: string,
    pin: string,
  ): Promise<{ success: boolean; user?: any; error?: string }> {
    if (!uid || !pin || pin.length !== 4) {
      return { success: false, error: "invalid_pin" };
    }
    try {
      // 1. If currently authenticated user matches, return immediately
      if (auth.currentUser && auth.currentUser.uid === uid) {
        return { success: true, user: auth.currentUser };
      }

      // 2. If a different user is active, force sign out to prevent data collision
      if (auth.currentUser && auth.currentUser.uid !== uid) {
        console.warn(
          "Signing out active mismatched user before restoring PIN session for:",
          uid,
        );
        await auth.signOut();
        mobileDataService.clearCache();
      }

      // 3. Read stored encrypted credentials specifically for this user
      const raw = await AsyncStorage.getItem(
        `${CREDENTIAL_STORAGE_PREFIX}${uid}`,
      );
      if (!raw) {
        return { success: false, error: "no_stored_credentials" };
      }

      const data = JSON.parse(raw);
      if (!data?.email || !data?.encrypted) {
        return { success: false, error: "invalid_stored_credentials" };
      }

      const key = await this.hashPin(uid, pin);
      const password = decipherText(data.encrypted, key);

      // 4. Authenticate directly with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        data.email,
        password,
      );

      // 5. Strict verification: ensure the authenticated UID matches the saved user
      if (userCredential.user.uid !== uid) {
        console.error(
          "Restored session UID mismatch! Expected",
          uid,
          "got",
          userCredential.user.uid,
        );
        await auth.signOut();
        mobileDataService.clearCache();
        return { success: false, error: "uid_mismatch" };
      }

      return { success: true, user: userCredential.user };
    } catch (e: any) {
      console.warn("restoreFirebaseSessionWithPin error:", e);
      return { success: false, error: e?.message || "auth_failed" };
    }
  }

  /**
   * Sets and enables a new permanent 4-digit PIN for the user
   */
  async setPin(
    uid: string,
    pin: string,
    enable: boolean = true,
  ): Promise<void> {
    if (!uid || !pin || pin.length !== 4) {
      throw new Error("PIN must be exactly 4 digits.");
    }
    try {
      const hash = await this.hashPin(uid, pin);

      // Save locally
      await AsyncStorage.setItem(`${PIN_HASH_PREFIX}${uid}`, hash);
      await AsyncStorage.setItem(
        `${PIN_ENABLED_PREFIX}${uid}`,
        enable ? "true" : "false",
      );
      if (enable) {
        await AsyncStorage.setItem(
          `${DEVICE_SAVED_PROFILE_PREFIX}${uid}`,
          "true",
        );

        // Encrypt credentials if cached password exists
        const cachedPassword = this.sessionPasswordCache.get(uid);
        const email = auth.currentUser?.email;
        if (cachedPassword && email) {
          await this.saveEncryptedCredential(uid, pin, email, cachedPassword);
        }
      }

      // Sync to cloud profile
      await mobileDataService.saveUserProfile({
        uid,
        authPinHash: hash,
        authPinEnabled: enable,
      });
    } catch (e) {
      console.error("setPin error:", e);
      throw e;
    }
  }

  /**
   * Toggles the PIN security feature ON or OFF
   */
  async setPinEnabled(uid: string, enabled: boolean): Promise<void> {
    if (!uid) return;
    try {
      await AsyncStorage.setItem(
        `${PIN_ENABLED_PREFIX}${uid}`,
        enabled ? "true" : "false",
      );
      if (!enabled) {
        await AsyncStorage.removeItem(`${DEVICE_SAVED_PROFILE_PREFIX}${uid}`);
      } else {
        await AsyncStorage.setItem(
          `${DEVICE_SAVED_PROFILE_PREFIX}${uid}`,
          "true",
        );
      }
      await mobileDataService.saveUserProfile({
        uid,
        authPinEnabled: enabled,
      });
    } catch (e) {
      console.warn("setPinEnabled notice:", e);
    }
  }

  /**
   * Explicitly saves user profile and enables PIN for this device upon user consent
   */
  async saveDeviceProfile(
    user: StoredPinUser,
    customPinHash?: string,
  ): Promise<void> {
    if (!user || !user.uid) return;
    try {
      await AsyncStorage.setItem(
        `${DEVICE_SAVED_PROFILE_PREFIX}${user.uid}`,
        "true",
      );
      await AsyncStorage.setItem(`${PIN_ENABLED_PREFIX}${user.uid}`, "true");

      // Store PIN hash locally if provided or retrieve from cloud profile
      if (customPinHash) {
        await AsyncStorage.setItem(
          `${PIN_HASH_PREFIX}${user.uid}`,
          customPinHash,
        );
      } else {
        const profile = await mobileDataService.getUserProfile(user.uid);
        if (profile?.authPinHash) {
          await AsyncStorage.setItem(
            `${PIN_HASH_PREFIX}${user.uid}`,
            profile.authPinHash,
          );
        }
      }

      await this.saveLastPinUser(user);

      // Sync cloud status
      await mobileDataService.saveUserProfile({
        uid: user.uid,
        authPinEnabled: true,
      });
    } catch (e) {
      console.error("saveDeviceProfile error:", e);
      throw e;
    }
  }

  /**
   * Legacy alias: saveProfileAndEnableExistingPin
   */
  async saveProfileAndEnableExistingPin(user: StoredPinUser): Promise<void> {
    await this.saveDeviceProfile(user);
  }

  /**
   * Caches the user's avatar image URL locally for instant display on device auth screens
   */
  async cacheUserAvatar(uid: string, avatarUrl: string): Promise<void> {
    if (!uid || !avatarUrl) return;
    try {
      await AsyncStorage.setItem(`${DEVICE_AVATAR_PREFIX}${uid}`, avatarUrl);
      // If current saved device profile matches, also ensure its photoURL is up to date
      const raw = await AsyncStorage.getItem(LAST_PIN_USER_KEY);
      if (raw) {
        const saved: StoredPinUser = JSON.parse(raw);
        if (saved && saved.uid === uid && saved.photoURL !== avatarUrl) {
          saved.photoURL = avatarUrl;
          await AsyncStorage.setItem(LAST_PIN_USER_KEY, JSON.stringify(saved));
        }
      }
    } catch (e) {
      console.warn("cacheUserAvatar error:", e);
    }
  }

  /**
   * Retrieves the locally cached avatar image URL for a user
   */
  async getCachedUserAvatar(uid: string): Promise<string | null> {
    if (!uid) return null;
    try {
      return await AsyncStorage.getItem(`${DEVICE_AVATAR_PREFIX}${uid}`);
    } catch {
      return null;
    }
  }

  /**
   * Removes explicit saved profile state from this device
   */
  async removeDeviceProfile(uid: string): Promise<void> {
    if (!uid) return;
    try {
      await AsyncStorage.removeItem(`${DEVICE_SAVED_PROFILE_PREFIX}${uid}`);
      await AsyncStorage.removeItem(`${PIN_HASH_PREFIX}${uid}`);
      await AsyncStorage.removeItem(`${PIN_ENABLED_PREFIX}${uid}`);
      await AsyncStorage.removeItem(`${CREDENTIAL_STORAGE_PREFIX}${uid}`);
      await AsyncStorage.removeItem(`${DEVICE_AVATAR_PREFIX}${uid}`);
      this.sessionPasswordCache.delete(uid);
      const lastUser = await this.getLastPinUser();
      if (lastUser?.uid === uid) {
        await this.clearLastPinUser();
      }
    } catch (e) {
      console.warn("removeDeviceProfile notice:", e);
    }
  }

  /**
   * Completely clears and disables the PIN for this user
   */
  async removePin(uid: string): Promise<void> {
    if (!uid) return;
    try {
      await AsyncStorage.removeItem(`${PIN_HASH_PREFIX}${uid}`);
      await AsyncStorage.setItem(`${PIN_ENABLED_PREFIX}${uid}`, "false");
      await AsyncStorage.removeItem(`${DEVICE_SAVED_PROFILE_PREFIX}${uid}`);
      await AsyncStorage.removeItem(`${CREDENTIAL_STORAGE_PREFIX}${uid}`);
      this.sessionPasswordCache.delete(uid);
      await mobileDataService.saveUserProfile({
        uid,
        authPinHash: null as any,
        authPinEnabled: false,
      });
      await this.clearLastPinUser();
    } catch (e) {
      console.warn("removePin notice:", e);
    }
  }

  /**
   * Saves or updates the saved device profile (with guard against accidental overwrite of different user)
   */
  async saveLastPinUser(user: StoredPinUser): Promise<void> {
    if (!user || !user.uid) return;
    try {
      const existing = await this.getSavedDeviceProfile();
      if (existing && existing.uid !== user.uid) {
        console.warn(
          "Blocked silent overwrite of saved device profile for different user:",
          existing.email,
          "by",
          user.email,
        );
        return;
      }

      // Self-heal avatar if missing in payload but present in local avatar cache
      if (!user.photoURL) {
        const cachedAvatar = await this.getCachedUserAvatar(user.uid);
        if (cachedAvatar) {
          user.photoURL = cachedAvatar;
        }
      } else {
        // Cache avatar locally for reliable offline/logged-out display
        await AsyncStorage.setItem(
          `${DEVICE_AVATAR_PREFIX}${user.uid}`,
          user.photoURL,
        );
      }

      await AsyncStorage.setItem(
        `${DEVICE_SAVED_PROFILE_PREFIX}${user.uid}`,
        "true",
      );
      await AsyncStorage.setItem(LAST_PIN_USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn("saveLastPinUser error:", e);
    }
  }

  /**
   * Returns the single explicitly saved profile on this device (supports quick password or PIN)
   */
  async getSavedDeviceProfile(): Promise<StoredPinUser | null> {
    try {
      const raw = await AsyncStorage.getItem(LAST_PIN_USER_KEY);
      if (raw) {
        const user: StoredPinUser = JSON.parse(raw);
        if (user?.uid) {
          // Self-heal: ensure device saved flag is in sync
          await AsyncStorage.setItem(
            `${DEVICE_SAVED_PROFILE_PREFIX}${user.uid}`,
            "true",
          );
          // Self-heal avatar if user.photoURL is missing but cached avatar exists
          if (!user.photoURL) {
            const cachedAvatar = await AsyncStorage.getItem(
              `${DEVICE_AVATAR_PREFIX}${user.uid}`,
            );
            if (cachedAvatar) {
              user.photoURL = cachedAvatar;
            }
          }
          return user;
        }
      }
    } catch (e) {
      console.warn("getSavedDeviceProfile check notice:", e);
    }
    return null;
  }

  /**
   * Alias: Returns the explicitly saved profile on this device
   */
  async getLastPinUser(): Promise<StoredPinUser | null> {
    return await this.getSavedDeviceProfile();
  }

  /**
   * Explicitly overrides the device profile with a new user account after user confirmation
   */
  async overrideDeviceProfile(
    newUser: StoredPinUser,
    customPinHash?: string,
  ): Promise<void> {
    if (!newUser || !newUser.uid) return;
    try {
      const existing = await this.getSavedDeviceProfile();
      if (existing && existing.uid !== newUser.uid) {
        await this.removeDeviceProfile(existing.uid);
      }
      await this.saveDeviceProfile(newUser, customPinHash);
    } catch (e) {
      console.error("overrideDeviceProfile error:", e);
      throw e;
    }
  }

  /**
   * Clears remembered PIN user from this device
   */
  async clearLastPinUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_PIN_USER_KEY);
    } catch (e) {
      console.warn("clearLastPinUser error:", e);
    }
  }

  /**
   * Checks if user should be prompted to save their profile and configure/enable PIN on this device
   */
  async shouldPromptSaveProfile(uid: string): Promise<boolean> {
    if (!uid) return false;
    try {
      const isSaved = await this.isDeviceProfileSaved(uid);
      if (isSaved) return false;

      const dismissed = await AsyncStorage.getItem(
        `${PIN_PROMPT_DISMISSED_PREFIX}${uid}`,
      );
      return dismissed !== "true";
    } catch {
      return false;
    }
  }

  /**
   * Checks if a new user should be prompted to set up their PIN
   */
  async shouldPromptNewUser(uid: string): Promise<boolean> {
    return await this.shouldPromptSaveProfile(uid);
  }

  /**
   * Records that the user clicked "Maybe Later" on the prompt
   */
  async dismissNewUserPrompt(uid: string): Promise<void> {
    if (!uid) return;
    try {
      await AsyncStorage.setItem(
        `${PIN_PROMPT_DISMISSED_PREFIX}${uid}`,
        "true",
      );
    } catch (e) {
      console.warn("dismissNewUserPrompt notice:", e);
    }
  }
}

export const authPinService = new AuthPinService();
