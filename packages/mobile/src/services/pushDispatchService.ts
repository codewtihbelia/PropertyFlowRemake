import { db } from "../firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
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

export interface FriendRequestPushParams {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
}

export class PushDispatchService {
  /**
   * Fetches all registered active push tokens for a given list of user IDs.
   * Checks both direct user document fields and the devices subcollection.
   */
  public async getPushTokensForUsers(userIds: string[]): Promise<string[]> {
    if (!userIds || userIds.length === 0) return [];

    const uniqueUids = Array.from(
      new Set(
        userIds
          .map((u) =>
            String(u || "")
              .replace(/^mem_/, "")
              .trim(),
          )
          .filter(Boolean),
      ),
    );
    const tokenSet = new Set<string>();

    await Promise.all(
      uniqueUids.map(async (uid) => {
        // 1. Check user document directly
        try {
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
        } catch (err) {
          // Direct user doc read error handled gracefully
        }

        // 2. Check devices subcollection: users/{uid}/devices
        try {
          const devSnap = await getDocs(collection(db, `users/${uid}/devices`));
          for (const d of devSnap.docs) {
            const devData = d.data();
            if (isValidExpoPushToken(devData?.pushToken)) {
              tokenSet.add(devData.pushToken);
            }
          }
        } catch (err) {
          // Devices subcollection read error handled gracefully
        }
      }),
    );

    const tokens = Array.from(tokenSet);
    console.log(
      `[PushDispatch] Resolved ${tokens.length} token(s) for user(s) [${uniqueUids.join(", ")}]:`,
      tokens,
    );
    return tokens;
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
      console.warn(
        "[PushDispatch] No valid registered Expo push tokens found for recipient(s). Tokens provided:",
        tokens,
      );
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
      console.log(
        `[PushDispatch] Dispatching push notification "${payload.title}" to ${validTokens.length} token(s)...`,
      );
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
        console.error(
          "[PushDispatch] Expo push service responded with error status:",
          response.status,
        );
        return false;
      }

      const resData = await response.json();
      console.log(
        "[PushDispatch] Expo push service response receipt:",
        JSON.stringify(resData),
      );

      if (Array.isArray(resData?.data)) {
        resData.data.forEach((ticket: any, index: number) => {
          if (ticket.status === "error") {
            console.error(
              `[PushDispatch] Expo ticket ERROR for token ${validTokens[index]}: ${ticket.message} (${ticket.details?.error})`,
            );
          } else if (ticket.status === "ok") {
            console.log(
              `[PushDispatch] Expo ticket OK for token ${validTokens[index]}, ticket ID: ${ticket.id}`,
            );
          }
        });
      }

      return !!resData;
    } catch (error) {
      console.error(
        "[PushDispatch] Network error dispatching push notification:",
        error,
      );
      return false;
    }
  }

  /**
   * Dispatches high-priority push notification when an incoming voice or video call is placed.
   * Rings recipient's phone with heads-up alert and opens call on tap even if app is backgrounded or closed.
   */
  public async sendIncomingCallPush(params: {
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    receiverId: string;
    callType: "voice" | "video";
  }): Promise<boolean> {
    try {
      const cleanReceiverId = params.receiverId.replace(/^mem_/, "").trim();
      const tokens = await this.getPushTokensForUsers([cleanReceiverId]);
      if (tokens.length === 0) {
        console.log(
          `[PushDispatch] No push tokens found for call recipient: ${cleanReceiverId}`,
        );
        return false;
      }

      const isVideo = params.callType === "video";
      const title = isVideo
        ? "🎦 Incoming Video Call"
        : "📞 Incoming Voice Call";
      const body = `${params.callerName} is calling you on Splitzy...`;

      return await this.sendPushToTokens(tokens, {
        title,
        body,
        channelId: "high_priority",
        sound: "default",
        data: {
          type: "incoming_call",
          callId: params.callId,
          callerId: params.callerId,
          callerName: params.callerName,
          callerAvatar: params.callerAvatar || "",
          callType: params.callType,
          screen: "incoming_call",
        },
      });
    } catch (err) {
      console.warn(
        "[PushDispatch] Error sending incoming call push notification:",
        err,
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
            const raw = data.userId || data.memberId;
            return raw ? String(raw).replace(/^mem_/, "").trim() : null;
          })
          .filter((uid): uid is string =>
            Boolean(uid && uid !== params.senderId),
          );
      }

      if (targetUserIds.length === 0) return;

      const tokens = await this.getPushTokensForUsers(targetUserIds);
      if (tokens.length === 0) return;

      const groupLabel = params.householdName || "New Message";
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
   * Dispatches a high-priority push notification to all household members
   * when a new bill or expense is added.
   * Delivers to the lock screen / notification shade even when the app is closed.
   */
  public async sendNewBillPush(params: {
    householdId: string;
    householdName?: string;
    payerId: string;
    payerName: string;
    billTitle: string;
    amountCents: number;
    expenseId: string;
    recipientUserIds?: string[];
  }): Promise<void> {
    try {
      let targetUserIds = (params.recipientUserIds || [])
        .map((u) =>
          String(u || "")
            .replace(/^mem_/, "")
            .trim(),
        )
        .filter(Boolean);

      if (targetUserIds.length === 0) {
        const membersSnap = await getDocs(
          collection(db, `households/${params.householdId}/members`),
        );
        targetUserIds = membersSnap.docs
          .map((d) => {
            const data = d.data();
            const raw = data.userId || data.memberId;
            return raw ? String(raw).replace(/^mem_/, "").trim() : null;
          })
          .filter((uid): uid is string =>
            Boolean(uid && uid !== params.payerId),
          );
      }

      if (targetUserIds.length === 0) return;

      const tokens = await this.getPushTokensForUsers(targetUserIds);
      if (tokens.length === 0) return;

      const groupLabel = params.householdName || "Household";
      const pesos = (params.amountCents / 100).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      await this.sendPushToTokens(tokens, {
        title: `Splitzy • New Bill in ${groupLabel}`,
        body: `${params.payerName} added ₱${pesos} for "${params.billTitle}". Tap to check your split.`,
        data: {
          screen: "billing",
          householdId: params.householdId,
          expenseId: params.expenseId,
        },
        channelId: "high_priority",
        sound: "default",
      });
    } catch (err) {
      console.warn("[PushDispatch] Error sending new bill push:", err);
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

  /**
   * Dispatches a high-priority push notification to the host when a resident submits a payment.
   */
  public async sendPaymentSubmittedPush(params: {
    hostId: string;
    payerName: string;
    amountCentavos: number;
    paymentMethod: string;
    householdName?: string;
    paymentId: string;
  }): Promise<void> {
    try {
      if (!params.hostId) return;

      const tokens = await this.getPushTokensForUsers([params.hostId]);
      if (tokens.length === 0) return;

      const pesos = (params.amountCentavos / 100).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const groupLabel = params.householdName || "Household";

      await this.sendPushToTokens(tokens, {
        title: `Splitzy • New Payment in ${groupLabel}`,
        body: `${params.payerName} submitted a payment of ₱${pesos} via ${params.paymentMethod}. Tap to view receipt and verify.`,
        data: {
          screen: "payments",
          paymentId: params.paymentId,
          hostId: params.hostId,
        },
        channelId: "high_priority",
        sound: "default",
      });
    } catch (err) {
      console.warn("[PushDispatch] Error sending payment submitted push:", err);
    }
  }

  /**
   * Dispatches a push notification to a payor when the host verifies or rejects their payment.
   */
  public async sendPaymentDecisionPush(params: {
    payerId: string;
    approved: boolean;
    amountCentavos: number;
    paymentMethod: string;
    rejectionReason?: string | null;
    householdName?: string;
    paymentId: string;
  }): Promise<void> {
    try {
      if (!params.payerId) return;

      const tokens = await this.getPushTokensForUsers([params.payerId]);
      if (tokens.length === 0) return;

      const pesos = (params.amountCentavos / 100).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const title = params.approved
        ? "Splitzy • Payment Approved! 🎉"
        : "Splitzy • Payment Update";

      const body = params.approved
        ? `Your payment of ₱${pesos} via ${params.paymentMethod} has been approved by your Host.`
        : `Your payment of ₱${pesos} was declined${
            params.rejectionReason
              ? `: "${params.rejectionReason}"`
              : ". Please verify reference details."
          }`;

      await this.sendPushToTokens(tokens, {
        title,
        body,
        data: {
          screen: "payments",
          paymentId: params.paymentId,
          approved: params.approved,
        },
        channelId: "high_priority",
        sound: "default",
      });
    } catch (err) {
      console.warn("[PushDispatch] Error sending payment decision push:", err);
    }
  }

  /**
   * Universal notification dispatcher that delivers a push alert to any set of recipients.
   */
  public async sendGenericNotificationPush(params: {
    recipientUserIds: string[];
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: string;
  }): Promise<void> {
    try {
      if (!params.recipientUserIds || params.recipientUserIds.length === 0)
        return;

      const tokens = await this.getPushTokensForUsers(params.recipientUserIds);
      if (tokens.length === 0) return;

      await this.sendPushToTokens(tokens, {
        title: params.title,
        body: params.body,
        data: params.data || {},
        channelId: params.channelId || "high_priority",
        sound: "default",
      });
    } catch (err) {
      console.warn(
        "[PushDispatch] Error sending generic notification push:",
        err,
      );
    }
  }

  /**
   * Resolves recipient user IDs for a community author.
   * Fetches:
   * 1. All accepted friends from communityFriendships (bidirectional)
   * 2. All members of the author's household (if householdId is provided or detected)
   * Excludes the author and strips any "mem_" prefixes.
   */
  public async getCommunityRecipientsForAuthor(
    authorId: string,
    householdId?: string,
  ): Promise<string[]> {
    if (!authorId) return [];

    const cleanAuthorId = String(authorId).replace(/^mem_/, "").trim();
    const recipientSet = new Set<string>();

    // 1. Fetch accepted friends from communityFriendships (where senderId == authorId OR receiverId == authorId)
    try {
      const friendshipsRef = collection(db, "communityFriendships");

      const [sentSnap, receivedSnap] = await Promise.all([
        getDocs(
          query(
            friendshipsRef,
            where("senderId", "==", cleanAuthorId),
            where("status", "==", "accepted"),
          ),
        ),
        getDocs(
          query(
            friendshipsRef,
            where("receiverId", "==", cleanAuthorId),
            where("status", "==", "accepted"),
          ),
        ),
      ]);

      sentSnap.docs.forEach((d) => {
        const data = d.data();
        const friendId = String(data.receiverId || "")
          .replace(/^mem_/, "")
          .trim();
        if (friendId && friendId !== cleanAuthorId) {
          recipientSet.add(friendId);
        }
      });

      receivedSnap.docs.forEach((d) => {
        const data = d.data();
        const friendId = String(data.senderId || "")
          .replace(/^mem_/, "")
          .trim();
        if (friendId && friendId !== cleanAuthorId) {
          recipientSet.add(friendId);
        }
      });
    } catch (err) {
      console.warn(
        "[PushDispatch] Error resolving accepted friends for push:",
        err,
      );
    }

    // 2. Fetch household roommates
    try {
      let activeHouseholdId = householdId;
      if (!activeHouseholdId) {
        // Look up the author's user document
        const userDoc = await getDoc(doc(db, "users", cleanAuthorId)).catch(
          () => null,
        );
        if (userDoc?.exists()) {
          const userData = userDoc.data();
          activeHouseholdId =
            userData?.householdId || userData?.currentHouseholdId;
        }
      }

      if (activeHouseholdId) {
        const membersSnap = await getDocs(
          collection(db, `households/${activeHouseholdId}/members`),
        );
        membersSnap.docs.forEach((d) => {
          const mData = d.data();
          const raw = mData.userId || mData.memberId || d.id;
          const cleanId = String(raw || "")
            .replace(/^mem_/, "")
            .trim();
          if (cleanId && cleanId !== cleanAuthorId) {
            recipientSet.add(cleanId);
          }
        });
      }
    } catch (err) {
      console.warn(
        "[PushDispatch] Error resolving household members for push:",
        err,
      );
    }

    const recipientList = Array.from(recipientSet);
    console.log(
      `[PushDispatch] Resolved ${recipientList.length} community recipient(s) for author ${cleanAuthorId}:`,
      recipientList,
    );
    return recipientList;
  }

  /**
   * Logs a persistent notification entry in Firestore's `notifications` collection
   * so it appears in the user's in-app Notifications screen list.
   */
  public async logNotificationToFirestore(params: {
    recipientId: string;
    type: string;
    title: string;
    message: string;
    category?: string;
    relatedItemId?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    try {
      const cleanRecipientId = String(params.recipientId || "")
        .replace(/^mem_/, "")
        .trim();
      if (!cleanRecipientId) return;

      const notifRef = doc(collection(db, "notifications"));
      const now = new Date().toISOString();

      await setDoc(notifRef, {
        id: notifRef.id,
        notificationId: notifRef.id,
        recipientId: cleanRecipientId,
        type: params.type,
        title: params.title,
        message: params.message,
        category: params.category || "reminder",
        relatedItemId: params.relatedItemId || notifRef.id,
        createdTimestamp: now,
        createdAt: now,
        readStatus: false,
        data: params.data || {},
      });
    } catch (err) {
      console.warn(
        "[PushDispatch] Failed to log notification to Firestore:",
        err,
      );
    }
  }

  /**
   * Dispatches high-priority push notifications and logs a persistent notification
   * when a user receives a new friend request.
   */
  public async sendFriendRequestPush(params: {
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    receiverId: string;
  }): Promise<void> {
    try {
      const cleanSenderId = String(params.senderId || "")
        .replace(/^mem_/, "")
        .trim();
      const cleanReceiverId = String(params.receiverId || "")
        .replace(/^mem_/, "")
        .trim();
      if (!cleanReceiverId || cleanReceiverId === cleanSenderId) return;

      const title = "New Friend Request";
      const message = `${params.senderName} sent you a friend request on Splitzy.`;

      // 1. Log to Firestore `notifications` collection
      await this.logNotificationToFirestore({
        recipientId: cleanReceiverId,
        type: "FRIEND_REQUEST",
        title,
        message,
        category: "group_invite",
        relatedItemId: `friend_req_${cleanSenderId}`,
        data: {
          screen: "community",
          type: "friend_request",
          senderId: cleanSenderId,
          senderName: params.senderName,
          senderAvatar: params.senderAvatar || "",
        },
      });

      // 2. Dispatch push notification to recipient's registered device tokens
      const tokens = await this.getPushTokensForUsers([cleanReceiverId]);
      if (tokens.length > 0) {
        await this.sendPushToTokens(tokens, {
          title: "Friend Request • Splitzy",
          body: `${params.senderName} sent you a friend request. Tap to respond!`,
          data: {
            screen: "community",
            type: "friend_request",
            senderId: cleanSenderId,
            senderName: params.senderName,
          },
          channelId: "high_priority",
          sound: "default",
        });
      }
    } catch (err) {
      console.warn("[PushDispatch] Error sending friend request push:", err);
    }
  }

  /**
   * Dispatches high-priority push notifications to friends & household roommates
   * when a user creates a new community post, and logs to Notifications screen.
   */
  public async sendCommunityPostPush(params: {
    postId: string;
    authorId: string;
    authorName: string;
    content: string;
    category?: string;
    householdId?: string;
  }): Promise<void> {
    try {
      const recipientUserIds = await this.getCommunityRecipientsForAuthor(
        params.authorId,
        params.householdId,
      );
      if (recipientUserIds.length === 0) return;

      const cleanSnippet =
        params.content.length > 90
          ? `${params.content.substring(0, 87)}...`
          : params.content;

      const title = `Splitzy Community • ${params.authorName}`;
      const body = cleanSnippet
        ? `${params.authorName} posted: "${cleanSnippet}"`
        : `${params.authorName} shared a new post!`;

      // Log notification in Firestore for every recipient
      await Promise.all(
        recipientUserIds.map((recId) =>
          this.logNotificationToFirestore({
            recipientId: recId,
            type: "COMMUNITY_POST",
            title,
            message: body,
            category: "reminder",
            relatedItemId: params.postId,
            data: {
              screen: "community",
              type: "post",
              postId: params.postId,
              authorId: params.authorId,
            },
          }),
        ),
      );

      // Dispatch native push
      const tokens = await this.getPushTokensForUsers(recipientUserIds);
      if (tokens.length > 0) {
        await this.sendPushToTokens(tokens, {
          title,
          body,
          data: {
            screen: "community",
            type: "post",
            postId: params.postId,
            authorId: params.authorId,
          },
          channelId: "high_priority",
          sound: "default",
        });
      }
    } catch (err) {
      console.warn("[PushDispatch] Error sending community post push:", err);
    }
  }

  /**
   * Dispatches high-priority push notifications to friends & household roommates
   * when a user creates a new 24h story, and logs to Notifications screen.
   */
  public async sendCommunityStoryPush(params: {
    storyId: string;
    authorId: string;
    authorName: string;
    caption?: string;
    householdId?: string;
  }): Promise<void> {
    try {
      const recipientUserIds = await this.getCommunityRecipientsForAuthor(
        params.authorId,
        params.householdId,
      );
      if (recipientUserIds.length === 0) return;

      const captionSnippet =
        params.caption && params.caption.trim().length > 0
          ? ` "${params.caption.length > 60 ? `${params.caption.substring(0, 57)}...` : params.caption}"`
          : "";

      const title = `New Story • ${params.authorName}`;
      const body = `${params.authorName} shared a new story${captionSnippet}. Tap to view before it expires!`;

      // Log notification in Firestore for every recipient
      await Promise.all(
        recipientUserIds.map((recId) =>
          this.logNotificationToFirestore({
            recipientId: recId,
            type: "COMMUNITY_STORY",
            title,
            message: body,
            category: "reminder",
            relatedItemId: params.storyId,
            data: {
              screen: "community",
              type: "story",
              storyId: params.storyId,
              authorId: params.authorId,
            },
          }),
        ),
      );

      // Dispatch native push
      const tokens = await this.getPushTokensForUsers(recipientUserIds);
      if (tokens.length > 0) {
        await this.sendPushToTokens(tokens, {
          title,
          body,
          data: {
            screen: "community",
            type: "story",
            storyId: params.storyId,
            authorId: params.authorId,
          },
          channelId: "high_priority",
          sound: "default",
        });
      }
    } catch (err) {
      console.warn("[PushDispatch] Error sending community story push:", err);
    }
  }

  /**
   * Dispatches push notification when someone comments on a community post.
   * Alerts the post author directly and logs to Notifications screen.
   */
  public async sendCommunityCommentPush(params: {
    postId: string;
    postAuthorId: string;
    commentId: string;
    commenterId: string;
    commenterName: string;
    commentText: string;
    postSnippet?: string;
  }): Promise<void> {
    try {
      const cleanAuthorId = String(params.postAuthorId || "")
        .replace(/^mem_/, "")
        .trim();
      const cleanCommenterId = String(params.commenterId || "")
        .replace(/^mem_/, "")
        .trim();

      // Do not notify self
      if (!cleanAuthorId || cleanAuthorId === cleanCommenterId) return;

      const cleanComment =
        params.commentText.length > 90
          ? `${params.commentText.substring(0, 87)}...`
          : params.commentText;

      const title = "New Comment on Your Post";
      const message = `${params.commenterName} commented: "${cleanComment}"`;

      // 1. Log to Firestore `notifications` collection
      await this.logNotificationToFirestore({
        recipientId: cleanAuthorId,
        type: "COMMUNITY_COMMENT",
        title,
        message,
        category: "reminder",
        relatedItemId: params.postId,
        data: {
          screen: "community",
          type: "comment",
          postId: params.postId,
          commentId: params.commentId,
          commenterId: cleanCommenterId,
        },
      });

      // 2. Dispatch native push
      const tokens = await this.getPushTokensForUsers([cleanAuthorId]);
      if (tokens.length > 0) {
        await this.sendPushToTokens(tokens, {
          title: "Splitzy Community",
          body: `${params.commenterName} commented on your post: "${cleanComment}"`,
          data: {
            screen: "community",
            type: "comment",
            postId: params.postId,
            commentId: params.commentId,
            commenterId: cleanCommenterId,
          },
          channelId: "high_priority",
          sound: "default",
        });
      }
    } catch (err) {
      console.warn("[PushDispatch] Error sending community comment push:", err);
    }
  }

  /**
   * Dispatches push notification when someone reacts to a community post,
   * and logs to Notifications screen.
   */
  public async sendCommunityReactionPush(params: {
    postId: string;
    postAuthorId: string;
    reactorId: string;
    reactorName: string;
    reactionType: string;
    postSnippet?: string;
  }): Promise<void> {
    try {
      const cleanAuthorId = String(params.postAuthorId || "")
        .replace(/^mem_/, "")
        .trim();
      const cleanReactorId = String(params.reactorId || "")
        .replace(/^mem_/, "")
        .trim();

      // Do not notify self
      if (!cleanAuthorId || cleanAuthorId === cleanReactorId) return;

      const emojiMap: Record<string, string> = {
        like: "👍",
        love: "❤️",
        care: "🥰",
        haha: "😆",
        wow: "😮",
        sad: "😢",
        angry: "😡",
      };
      const reactionEmoji = emojiMap[params.reactionType] || "❤️";

      const snippet = params.postSnippet
        ? `: "${params.postSnippet.length > 50 ? `${params.postSnippet.substring(0, 47)}...` : params.postSnippet}"`
        : ".";

      const title = "New Reaction on Your Post";
      const message = `${params.reactorName} reacted ${reactionEmoji} to your post${snippet}`;

      // 1. Log to Firestore `notifications` collection
      await this.logNotificationToFirestore({
        recipientId: cleanAuthorId,
        type: "COMMUNITY_REACTION",
        title,
        message,
        category: "reminder",
        relatedItemId: params.postId,
        data: {
          screen: "community",
          type: "reaction",
          postId: params.postId,
          reactionType: params.reactionType,
          reactorId: cleanReactorId,
        },
      });

      // 2. Dispatch native push
      const tokens = await this.getPushTokensForUsers([cleanAuthorId]);
      if (tokens.length > 0) {
        await this.sendPushToTokens(tokens, {
          title: "Splitzy Community",
          body: `${params.reactorName} reacted ${reactionEmoji} to your post${snippet}`,
          data: {
            screen: "community",
            type: "reaction",
            postId: params.postId,
            reactionType: params.reactionType,
            reactorId: cleanReactorId,
          },
          channelId: "high_priority",
          sound: "default",
        });
      }
    } catch (err) {
      console.warn(
        "[PushDispatch] Error sending community reaction push:",
        err,
      );
    }
  }
}

export const pushDispatchService = new PushDispatchService();
