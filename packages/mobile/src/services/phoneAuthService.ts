import { app } from "../firebase/config";

const getFirebaseApiKey = (): string => {
  return (
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    (app.options as any)?.apiKey ||
    "AIzaSyBuWDUV1wuqmbtSZ2c4l1zwuASd9wOFkHM"
  );
};

export interface SendVerificationResult {
  success: boolean;
  sessionInfo?: string;
  error?: string;
  requiresRegionConfig?: boolean;
}

export interface VerifyOtpResult {
  success: boolean;
  idToken?: string;
  refreshToken?: string;
  localId?: string;
  phoneNumber?: string;
  error?: string;
}

/**
 * Dispatches an SMS verification code via Firebase Phone Auth REST API.
 * Requires Phone provider and target country code (e.g. Philippines +63)
 * enabled in Firebase Console -> Authentication -> Settings -> SMS Region Policy.
 */
export async function sendFirebasePhoneOtp(
  phoneNumber: string,
): Promise<SendVerificationResult> {
  try {
    const apiKey = getFirebaseApiKey();
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await response.json();

    if (!response.ok) {
      const rawMsg =
        data?.error?.message || "Failed to send SMS verification code.";
      const isRegionError =
        rawMsg.includes("OPERATION_NOT_ALLOWED") ||
        rawMsg.includes("SMS unable to be sent until this region enabled");
      const isMissingClient =
        rawMsg.includes("MISSING_CLIENT_IDENTIFIER") ||
        rawMsg.includes("CAPTCHA_CHECK_FAILED");

      let userMsg = rawMsg;
      if (isRegionError) {
        userMsg =
          "SMS delivery to this country is pending developer setup. Please enable your country (+63 Philippines) in Firebase Console -> Authentication -> Settings -> SMS Region Policy.";
      } else if (isMissingClient) {
        userMsg =
          "In Expo Go, real carrier SMS requires device attestation (Play Integrity / SafetyNet) which is only available in standalone APK builds. For Expo Go testing, please configure this phone number in Firebase Console -> Authentication -> Sign-in method -> Phone -> 'Phone numbers for testing' (e.g. code: 123456).";
      } else if (rawMsg.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
        userMsg =
          "Too many attempts. Please wait a few moments before requesting a new code.";
      } else if (rawMsg.includes("INVALID_PHONE_NUMBER")) {
        userMsg =
          "Please verify that the phone number includes valid digits and international format.";
      }

      return {
        success: false,
        error: userMsg,
        requiresRegionConfig: isRegionError,
      };
    }

    return {
      success: true,
      sessionInfo: data.sessionInfo,
    };
  } catch (err: any) {
    return {
      success: false,
      error:
        err?.message ||
        "Network connection error while requesting verification code.",
    };
  }
}

/**
 * Verifies the 6-digit code received via SMS against Firebase Phone Auth.
 */
export async function verifyFirebasePhoneOtp(
  sessionInfo: string,
  code: string,
): Promise<VerifyOtpResult> {
  try {
    const apiKey = getFirebaseApiKey();
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionInfo, code }),
    });

    const data = await response.json();

    if (!response.ok) {
      const rawMsg = data?.error?.message || "Verification code failed.";
      let userMsg =
        "The verification code you entered is invalid. Please check your SMS messages.";
      if (rawMsg.includes("SESSION_EXPIRED")) {
        userMsg =
          "Your SMS verification code has expired. Please tap Resend Code to request a new one.";
      } else if (rawMsg.includes("TOO_MANY_ATTEMPTS")) {
        userMsg =
          "Too many incorrect attempts. Please wait a moment before trying again.";
      }
      return {
        success: false,
        error: userMsg,
      };
    }

    return {
      success: true,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      localId: data.localId,
      phoneNumber: data.phoneNumber,
    };
  } catch (err: any) {
    return {
      success: false,
      error:
        err?.message ||
        "Network connection error while verifying your SMS code.",
    };
  }
}
