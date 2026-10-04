import { db } from "../firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  channelId?: string;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Checks whether a token is a valid Expo Push Token format.
 */
export function isValidExpoPushToken(token: any): boolean {
  if (typeof token !== "string") return false;
  return (
    (token.startsWith("ExponentPushToken[") ||
      token.startsWith("ExpoPushToken[")) &&
    !token.includes("dev-fallback") &&
    !token.includes("expo-go-dev")
  );
}

class PushDispatchService {
  /**
   * Fetches all registered active push tokens for a given list of user IDs.
   * Checks both direct user document fields and the devices subcollection.
   */
  public async getPushTokensForUsers(userIds: string[]): Promise<string[]> {
    if (!userIds || userIds.length === 0) return [];

    const uniqueUids = Array.from(new Set(userIds.filter(Boolean)));
    const tokenSet = new Set<string>();

    await Promise.all(
      uniqueUids.map(async (uid) => {
        try {
          // 1. Check user document directly
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (isValidExpoPushToken(userData?.pushToken)) {
              tokenSet.add(userData.pushToken);
            }
            if (Array.isArray(userData?.pushTokens)) {
              for (const t of userData.pushTokens) {
                if (isValidExpoPushToken(t)) {
                  tokenSet.add(t);
                }
              }
            }
          }

          // 2. Check devices subcollection: users/{uid}/devices
          const devSnap = await getDocs(collection(db, `users/${uid}/devices`));
          for (const d of devSnap.docs) {
            const devData = d.data();
            if (isValidExpoPushToken(devData?.pushToken)) {
              tokenSet.add(devData.pushToken);
            }
          }
        } catch (err) {
          console.warn(
            `[PushDispatch] Failed to fetch tokens for user ${uid}:`,
            err,
          );
        }
      }),
    );

    return Array.from(tokenSet);
  }

  /**
   * Sends high-priority push notifications to multiple Expo push tokens via Expo Push API.
   * Delivers notifications directly to Google Play Services (FCM) / Apple APNs
   * even when the recipient's application is closed or screen is locked.
   */
  public async sendPushToTokens(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    const validTokens = tokens.filter(isValidExpoPushToken);
    if (validTokens.length === 0) {
      return false;
    }

    const messages = validTokens.map((to) => ({
      to,
      sound: payload.sound || "default",
      priority: "high",
      channelId: payload.channelId || "high_priority",
      _displayInForeground: true,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      badge: payload.badge,
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        console.warn(
          "[PushDispatch] Expo push service responded with status:",
          response.status,
        );
        return false;
      }

      const resData = await response.json();
      return !!resData;
    } catch (error) {
      console.warn(
        "[PushDispatch] Network error dispatching push notification:",
        error,
      );
      return false;
    }
  }

  /**
   * Dispatches push notification for a new household chat message.
   * Notifies all active household members except the sender.
   */
  public async sendHouseholdMessagePush(params: {
    householdId: string;
    householdName?: string;
    senderId: string;
    senderName: string;
    text: string;
    messageId: string;
    recipientId?: string | null;
  }): Promise<void> {
    try {
      let targetUserIds: string[] = [];

      if (params.recipientId) {
        // Direct / 1-on-1 message
        targetUserIds = [params.recipientId];
      } else {
        // Group chat message: find all members of the household
        const membersSnap = await getDocs(
          collection(db, `households/${params.householdId}/members`),
        );
        targetUserIds = membersSnap.docs
          .map((d) => {
            const data = d.data();
            return data.userId || data.memberId || d.id;
          })
          .filter((uid) => uid && uid !== params.senderId);
      }

      if (targetUserIds.length === 0) return;

      const tokens = await this.getPushTokensForUsers(targetUserIds);
      if (tokens.length === 0) return;

      const groupLabel = params.householdName || "Household";
      const cleanBody =
        params.text.length > 120
          ? `${params.text.substring(0, 117)}...`
          : params.text;

      await this.sendPushToTokens(tokens, {
        title: `Splitzy • ${groupLabel}`,
        body: `${params.senderName}: ${cleanBody}`,
        data: {
          screen: "messages",
          householdId: params.householdId,
          messageId: params.messageId,
          senderId: params.senderId,
        },
        channelId: "high_priority",
        sound: "default",
      });
    } catch (err) {
      console.warn("[PushDispatch] Error sending household message push:", err);
    }
  }

  /**
   * Dispatches an instant high-priority push notification to the host
   * when a new user requests to join their household.
   */
  public async sendJoinRequestPushToHost(params: {
    hostId: string;
    householdId: string;
    householdName: string;
    applicantName: string;
    applicantUid: string;
  }): Promise<void> {
    try {
      if (!params.hostId) return;

      const tokens = await this.getPushTokensForUsers([params.hostId]);
      if (tokens.length === 0) return;

      const bodyText = `${params.applicantName} requested to join ${params.householdName}. Tap to review and approve.`;

      await this.sendPushToTokens(tokens, {
        title: "Splitzy • New Member Request",
        body: bodyText,
        data: {
          screen: "group_manage",
          initialView: "details",
          householdId: params.householdId,
          applicantUid: params.applicantUid,
        },
        channelId: "high_priority",
        sound: "default",
      });
    } catch (err) {
      console.warn(
        "[PushDispatch] Error sending join request push to host:",
        err,
      );
    }
  }

  /**
   * Dispatches a push notification to an applicant when their join request
   * is approved or declined by the host.
   */
  public async sendJoinDecisionPushToApplicant(params: {
    applicantUid: string;
    householdName: string;
    approved: boolean;
    rejectionReason?: string | null;
  }): Promise<void> {
    try {
      if (!params.applicantUid) return;

      const tokens = await this.getPushTokensForUsers([params.applicantUid]);
      if (tokens.length === 0) return;

      const title = params.approved
        ? "Splitzy • Join Request Approved!"
        : "Splitzy • Join Request Update";

      const body = params.approved
        ? `You are now a member of ${params.householdName}! Welcome aboard.`
        : `Your request to join ${params.householdName} was declined${
            params.rejectionReason ? `: "${params.rejectionReason}"` : "."
          }`;

      await this.sendPushToTokens(tokens, {
        title,
        body,
        data: {
          screen: params.approved ? "home" : "group_manage",
          approved: params.approved,
        },
        channelId: "high_priority",
        sound: "default",
      });
    } catch (err) {
      console.warn("[PushDispatch] Error sending join decision push:", err);
    }
  }
}

export const pushDispatchService = new PushDispatchService();
