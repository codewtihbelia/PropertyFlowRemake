import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  deleteField,
  onSnapshot,
  where,
  query,
  orderBy,
  writeBatch,
  arrayUnion,
  limit,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { updateProfile as updateAuthProfile } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  formatPesos,
  resolveCycleWaterConfig,
  type CycleWaterConfig,
} from "@propertyflow/shared";
import { db, auth, functions } from "../firebase/config";
import { pushDispatchService } from "./pushDispatchService";
import { encryptMessage, decryptMessage } from "../utils/cryptoUtils";
export {
  uploadImageToCloudinaryMobile,
  uploadImageToCloudinary,
} from "./cloudinaryService";
export { encryptMessage, decryptMessage } from "../utils/cryptoUtils";
export { resolveCycleWaterConfig, type CycleWaterConfig };

// Quota exhaustion handling & rate limiting for free-tier sustainability
let _lastHeartbeatTimestamps: Record<string, number> = {};
const HEARTBEAT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes (saves 95% of background writes)

export const PRESENCE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes presence cache (reduces reads)
const _presenceCache = new Map<string, { data: any; timestamp: number }>();

export function getCachedUserPresence(userId: string): any | null {
  const clean = String(userId || "")
    .replace(/^mem_/, "")
    .trim();
  const entry = _presenceCache.get(clean);
  if (entry && Date.now() - entry.timestamp < PRESENCE_CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

let _markNotificationsReadTimer: any = null;
let _pendingUserReadMapUpdates: Record<string, Record<string, boolean>> = {};

let _isQuotaExceeded = false;
type QuotaExceededListener = (exceeded: boolean) => void;
const _quotaSubscribers = new Set<QuotaExceededListener>();

export function isQuotaExceededError(error: any): boolean {
  if (!error) return false;
  const msg = String(
    error?.message || error?.code || error || "",
  ).toLowerCase();
  return (
    msg.includes("resource-exhausted") ||
    msg.includes("quota limit exceeded") ||
    msg.includes("quota exceeded")
  );
}

export function notifyQuotaExceeded() {
  if (!_isQuotaExceeded) {
    _isQuotaExceeded = true;
    _quotaSubscribers.forEach((cb) => {
      try {
        cb(true);
      } catch {}
    });
  }
}

export function subscribeToQuotaExceeded(
  cb: QuotaExceededListener,
): () => void {
  _quotaSubscribers.add(cb);
  cb(_isQuotaExceeded);
  return () => {
    _quotaSubscribers.delete(cb);
  };
}

export type NotificationCategory =
  | "reminder"
  | "expense_added"
  | "payment_received"
  | "water_calculated"
  | "group_invite"
  | "announcement";

export interface NotificationTextSpan {
  text: string;
  bold?: boolean;
  color?: string;
}

export type NotificationActionTarget =
  | "settle_dues"
  | "bills"
  | "payments"
  | "attendance"
  | "groups"
  | "community"
  | "messages"
  | (string & {});

export interface MobileNotificationItem {
  id: string;
  cloudDocId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  spans: NotificationTextSpan[];
  timeLabel: string;
  timestampMs: number;
  createdTimestamp: string;
  section: "recent" | "earlier";
  defaultUnread: boolean;
  relatedEntityId?: string;
  actionTarget?: NotificationActionTarget;
  data?: any;
}

export const READ_NOTIFICATIONS_STORAGE_KEY =
  "@splitzy_read_notification_ids_v2";

export function getReadNotificationsStorageKey(uid?: string): string {
  const safeUid = (uid || auth.currentUser?.uid || "").trim();
  return safeUid
    ? `${READ_NOTIFICATIONS_STORAGE_KEY}_${safeUid}`
    : READ_NOTIFICATIONS_STORAGE_KEY;
}

export function getScopedNotificationReadKey(
  uid: string | undefined,
  id: string | undefined,
): string {
  const safeUid = (uid || auth.currentUser?.uid || "").trim();
  const safeId = (id || "").trim();
  if (!safeUid || !safeId) return safeId;
  return `v2_${safeUid}_${safeId}`;
}

export function formatNotificationRelativeTime(dateInput?: any): {
  label: string;
  timestampMs: number;
  isoString: string;
  isRecent: boolean;
} {
  let parsed: Date | null = null;
  if (dateInput) {
    if (typeof dateInput?.toDate === "function") {
      parsed = dateInput.toDate();
    } else if (typeof dateInput?.seconds === "number") {
      parsed = new Date(dateInput.seconds * 1000);
    } else if (typeof dateInput === "number") {
      parsed = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      parsed = dateInput;
    } else if (typeof dateInput === "string") {
      const d = new Date(dateInput);
      if (!isNaN(d.getTime())) {
        parsed = d;
      }
    }
  }

  if (!parsed || isNaN(parsed.getTime())) {
    const fallbackMs = Date.now() - 60_000;
    return {
      label: "1m ago",
      timestampMs: fallbackMs,
      isoString: new Date(fallbackMs).toISOString(),
      isRecent: true,
    };
  }

  const nowMs = Date.now();
  const diffMs = Math.max(0, nowMs - parsed.getTime());
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3600_000);
  const diffDays = Math.floor(diffMs / 86400_000);

  if (diffMinutes < 1) {
    return {
      label: "Just now",
      timestampMs: parsed.getTime(),
      isoString: parsed.toISOString(),
      isRecent: true,
    };
  }
  if (diffMinutes < 60) {
    return {
      label: `${diffMinutes}m ago`,
      timestampMs: parsed.getTime(),
      isoString: parsed.toISOString(),
      isRecent: true,
    };
  }
  if (diffHours < 24) {
    return {
      label: `${diffHours}h ago`,
      timestampMs: parsed.getTime(),
      isoString: parsed.toISOString(),
      isRecent: true,
    };
  }
  if (diffDays === 1) {
    return {
      label: "Yesterday",
      timestampMs: parsed.getTime(),
      isoString: parsed.toISOString(),
      isRecent: false,
    };
  }
  return {
    label: `${diffDays}d ago`,
    timestampMs: parsed.getTime(),
    isoString: parsed.toISOString(),
    isRecent: false,
  };
}

export function isNotificationItemUnread(
  item: MobileNotificationItem,
  readIds: Record<string, boolean>,
  uid?: string,
): boolean {
  if (!item) return false;
  const effectiveUid = (uid || auth.currentUser?.uid || "").trim();
  if (effectiveUid) {
    const scopedItemKey = getScopedNotificationReadKey(effectiveUid, item.id);
    const scopedCloudKey = item.cloudDocId
      ? getScopedNotificationReadKey(effectiveUid, item.cloudDocId)
      : "";
    if (
      (scopedItemKey && readIds[scopedItemKey]) ||
      (scopedCloudKey && readIds[scopedCloudKey])
    ) {
      return false;
    }
    return Boolean(item.defaultUnread);
  }
  if (readIds[item.id] || (item.cloudDocId && readIds[item.cloudDocId])) {
    return false;
  }
  return Boolean(item.defaultUnread);
}

export function buildRealNotificationsList(params: {
  uid?: string;
  householdId?: string;
  groupName: string;
  expenses: MobileExpense[];
  payments: any[];
  cycles: any[];
  cycleAttendance: any[];
  members: any[];
  cloudNotifications?: any[];
}): MobileNotificationItem[] {
  const {
    uid,
    groupName,
    expenses = [],
    payments = [],
    cycles = [],
    cycleAttendance = [],
    members = [],
    cloudNotifications = [],
  } = params;

  const effectiveUid = (uid || auth.currentUser?.uid || "").trim();
  const uidPrefix = effectiveUid || "user";

  const isCloudDocReadByCurrentUser = (cloudDoc: any): boolean => {
    if (!cloudDoc || cloudDoc.readStatus !== true) return false;
    if (!effectiveUid) return false;
    return cloudDoc.readByRecipientId === effectiveUid;
  };

  const cloudByItemId = new Map<string, any>();
  const matchedCloudDocIds = new Set<string>();

  cloudNotifications.forEach((cn) => {
    if (effectiveUid && cn.recipientId && cn.recipientId !== effectiveUid) {
      return;
    }
    const docId = cn.id || cn.notificationId;
    if (docId) {
      cloudByItemId.set(docId, cn);
    }
    if (cn.relatedItemId) {
      cloudByItemId.set(cn.relatedItemId, cn);
    }
  });

  const sortedCycles = sortBillingCyclesNewest(cycles);
  const activeCycle = sortedCycles[0];
  const isSingleCycle = sortedCycles.length <= 1;

  const items: MobileNotificationItem[] = [];

  // 1. Real Unpaid Bill / Rent Due Reminder from Firestore expenses in active cycle
  const unpaidExpenses = expenses.filter(
    (e) =>
      e.status !== "PAID" &&
      !e.isPaid &&
      (!activeCycle?.billingCycleId ||
        e.billingCycleId === activeCycle.billingCycleId ||
        (!e.billingCycleId && isSingleCycle)),
  );
  if (unpaidExpenses.length > 0) {
    const topBill =
      unpaidExpenses.find((e) =>
        (e.category || e.title || "").toLowerCase().includes("rent"),
      ) || unpaidExpenses[0];
    const billName =
      cleanBillTitle(topBill.title, topBill.category, groupName) ||
      topBill.category ||
      "Bill";
    const itemId = `reminder_${topBill.id}`;
    const cloudDocId = `notif_${uidPrefix}_${itemId}`;
    const cloudDoc = cloudByItemId.get(cloudDocId) || cloudByItemId.get(itemId);
    if (cloudDoc)
      matchedCloudDocIds.add(cloudDoc.id || cloudDoc.notificationId);

    // Compute due days from bill dueDate or active cycle dueDate/endDate
    const dueRaw =
      (topBill as any).dueDate ||
      (topBill as any).due_date ||
      activeCycle?.dueDate ||
      activeCycle?.endDate;
    let dueText = `Don't forget! ${billName} is due soon. Tap to check your share.`;
    if (dueRaw) {
      const dueDate = new Date(dueRaw);
      if (!isNaN(dueDate.getTime())) {
        const now = new Date();
        const todayMidnight = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const dueMidnight = new Date(
          dueDate.getFullYear(),
          dueDate.getMonth(),
          dueDate.getDate(),
        );
        const diffDays = Math.round(
          (dueMidnight.getTime() - todayMidnight.getTime()) / 86400_000,
        );
        if (diffDays > 0) {
          dueText = `Don't forget! ${billName} is due in ${diffDays} ${
            diffDays === 1 ? "day" : "days"
          }. Tap to check your share.`;
        } else {
          dueText = `Don't forget! ${billName} is due now. Tap to check your share.`;
        }
      }
    }

    const rel = formatNotificationRelativeTime(
      cloudDoc?.createdTimestamp || topBill.createdAt || topBill.date,
    );

    items.push({
      id: itemId,
      cloudDocId,
      category: "reminder",
      title: `${billName} Reminder`,
      message: dueText,
      spans: [{ text: dueText }],
      timeLabel: rel.label,
      timestampMs: rel.timestampMs + 1, // Keep reminder slightly above same-timestamp expense
      createdTimestamp: rel.isoString,
      section: rel.isRecent ? "recent" : "earlier",
      defaultUnread: cloudDoc ? !isCloudDocReadByCurrentUser(cloudDoc) : true,
      relatedEntityId: topBill.id,
      actionTarget: "settle_dues",
    });
  }

  // 2. Real Added Expenses from Firestore
  expenses.slice(0, 10).forEach((exp) => {
    const cleanTitle =
      cleanBillTitle(exp.title, exp.category, groupName) ||
      exp.category ||
      "Expense";
    const amtStr = formatPesos(exp.amountCents);
    const payer = exp.payerName || "Host";
    const itemId = `exp_${exp.id}`;
    const cloudDocId = `notif_${uidPrefix}_${itemId}`;
    const cloudDoc = cloudByItemId.get(cloudDocId) || cloudByItemId.get(itemId);
    if (cloudDoc)
      matchedCloudDocIds.add(cloudDoc.id || cloudDoc.notificationId);

    const rel = formatNotificationRelativeTime(
      exp.createdAt || exp.date || cloudDoc?.createdTimestamp,
    );
    const message = `${payer} added "${amtStr} for ${cleanTitle}" in ${groupName} group.`;

    items.push({
      id: itemId,
      cloudDocId,
      category: "expense_added",
      title: "New Expense Added!",
      message,
      spans: [
        { text: `${payer} added ` },
        {
          text: `"${amtStr} for ${cleanTitle}"`,
          bold: true,
          color: "#334155",
        },
        { text: ` in ${groupName} group.` },
      ],
      timeLabel: rel.label,
      timestampMs: rel.timestampMs,
      createdTimestamp: rel.isoString,
      section: rel.isRecent ? "recent" : "earlier",
      defaultUnread: cloudDoc ? !isCloudDocReadByCurrentUser(cloudDoc) : true,
      relatedEntityId: exp.id,
      actionTarget: "bills",
    });
  });

  // 3. Real Payments Received / Settled from Firestore
  payments.slice(0, 10).forEach((pay, idx) => {
    const payer = pay.userName || (pay as any).payerName || "Roommate";
    const amtStr = formatPesos(pay.amountCentavos || 0);
    const methodRaw = String(pay.paymentMethod || "BANK_TRANSFER").replace(
      /_/g,
      " ",
    );
    const methodLabel =
      methodRaw.toUpperCase() === "GCASH"
        ? "GCash"
        : methodRaw
            .toLowerCase()
            .replace(/\b\w/g, (l: string) => l.toUpperCase());
    const payKey = pay.paymentId || `${pay.userId || "u"}_${idx}`;
    const itemId = `pay_${payKey}`;
    const cloudDocId = `notif_${uidPrefix}_${itemId}`;
    const cloudDoc = cloudByItemId.get(cloudDocId) || cloudByItemId.get(itemId);
    if (cloudDoc)
      matchedCloudDocIds.add(cloudDoc.id || cloudDoc.notificationId);

    const rel = formatNotificationRelativeTime(
      pay.createdDate || pay.paymentDate || cloudDoc?.createdTimestamp,
    );
    const actionVerb =
      pay.status === "PENDING"
        ? "submitted a payment of "
        : "settled their pending dues of ";
    const message = `${payer} ${actionVerb}${amtStr} via ${methodLabel}.`;

    items.push({
      id: itemId,
      cloudDocId,
      category: "payment_received",
      title:
        pay.status === "PENDING" ? "Payment Submitted" : "Payment Received",
      message,
      spans: [
        { text: `${payer} ${actionVerb}` },
        { text: amtStr, bold: true, color: "#10B981" },
        { text: ` via ${methodLabel}.` },
      ],
      timeLabel: rel.label,
      timestampMs: rel.timestampMs,
      createdTimestamp: rel.isoString,
      section: rel.isRecent ? "recent" : "earlier",
      defaultUnread: cloudDoc ? !isCloudDocReadByCurrentUser(cloudDoc) : true,
      relatedEntityId: pay.paymentId || payKey,
      actionTarget: "payments",
    });
  });

  // 4. Real Water Bill Calculated from Firestore attendance / water expense
  const presentRecords = cycleAttendance.filter((a) => a.status === "PRESENT");
  const waterExpense = expenses.find((e) =>
    (e.category || "").toLowerCase().includes("water"),
  );
  const splitDaysSum = Array.isArray(waterExpense?.splitDetails)
    ? waterExpense!.splitDetails.reduce(
        (sum, s) => sum + (Number(s.daysPresent) || 0),
        0,
      )
    : 0;
  const effectivePresentDays =
    presentRecords.length > 0 ? presentRecords.length : splitDaysSum;

  if (effectivePresentDays > 0 || waterExpense) {
    const cycleNameStr =
      activeCycle?.name ||
      activeCycle?.cycleName ||
      new Date().toLocaleDateString("en-US", { month: "long" });
    const cycleMonthName = cycleNameStr.split(" ")[0];
    const cycleKey =
      activeCycle?.billingCycleId || waterExpense?.id || "current";
    const itemId = `water_${cycleKey}`;
    const cloudDocId = `notif_${uidPrefix}_${itemId}`;
    const cloudDoc = cloudByItemId.get(cloudDocId) || cloudByItemId.get(itemId);
    if (cloudDoc)
      matchedCloudDocIds.add(cloudDoc.id || cloudDoc.notificationId);

    const latestAttTimestamp = presentRecords.reduce((latest, rec) => {
      const t = rec.modifiedTimestamp || rec.date || "";
      return String(t) > latest ? String(t) : latest;
    }, "");

    const rel = formatNotificationRelativeTime(
      latestAttTimestamp ||
        (waterExpense as any)?.updatedAt ||
        waterExpense?.createdAt ||
        cloudDoc?.createdTimestamp ||
        activeCycle?.updatedDate ||
        activeCycle?.createdDate,
    );

    const message =
      effectivePresentDays > 0
        ? `Attendance calculated: ${effectivePresentDays} active ${
            effectivePresentDays === 1 ? "day" : "days"
          } logged for ${cycleMonthName} cycle.`
        : `Water bill (${formatPesos(
            waterExpense?.amountCents || 0,
          )}) calculated for ${cycleMonthName} cycle.`;

    items.push({
      id: itemId,
      cloudDocId,
      category: "water_calculated",
      title: "Water Bill Calculated",
      message,
      spans: [{ text: message }],
      timeLabel: rel.label,
      timestampMs: rel.timestampMs,
      createdTimestamp: rel.isoString,
      section: rel.isRecent ? "recent" : "earlier",
      defaultUnread: cloudDoc ? !isCloudDocReadByCurrentUser(cloudDoc) : true,
      relatedEntityId: cycleKey,
      actionTarget: "attendance",
    });
  }

  // 5. Real Group Members / Invites from Firestore members
  const nonHostMembers = members.filter(
    (m) =>
      m.role !== "HOST" && (m.status === "ACTIVE" || m.status === "PENDING"),
  );
  nonHostMembers.slice(0, 5).forEach((m) => {
    const memberName = m.displayName || m.name || "Roommate";
    const memKey = m.memberId || m.userId || memberName;
    const statusKey = m.status || "ACTIVE";
    const itemId = `member_${memKey}_${statusKey}`;
    const cloudDocId = `notif_${uidPrefix}_${itemId}`;
    const cloudDoc = cloudByItemId.get(cloudDocId) || cloudByItemId.get(itemId);
    if (cloudDoc)
      matchedCloudDocIds.add(cloudDoc.id || cloudDoc.notificationId);

    const rel = formatNotificationRelativeTime(
      m.joinedDate || m.requestedDate || cloudDoc?.createdTimestamp,
    );

    const isPending = statusKey === "PENDING";
    const title = isPending ? "Group Join Request" : "Group Invite Accepted";
    const actionPhrase = isPending ? " requested to join the " : " joined the ";
    const message = `${memberName}${actionPhrase}"${groupName}" group.`;

    items.push({
      id: itemId,
      cloudDocId,
      category: "group_invite",
      title,
      message,
      spans: [
        { text: `${memberName}${actionPhrase}` },
        { text: `"${groupName}"`, bold: true, color: "#334155" },
        { text: " group." },
      ],
      timeLabel: rel.label,
      timestampMs: rel.timestampMs,
      createdTimestamp: rel.isoString,
      section: rel.isRecent ? "recent" : "earlier",
      defaultUnread: cloudDoc ? !isCloudDocReadByCurrentUser(cloudDoc) : true,
      relatedEntityId: memKey,
      actionTarget: "groups",
    });
  });

  // 6. Direct Standalone Cloud Notifications from Firestore `notifications` collection
  cloudNotifications.forEach((cn) => {
    if (
      effectiveUid &&
      cn.recipientId &&
      cn.recipientId !== effectiveUid &&
      cn.recipientId !== "ALL" &&
      !cn.isBroadcast
    ) {
      return;
    }
    const docId = cn.id || cn.notificationId;
    if (!docId || matchedCloudDocIds.has(docId)) return;
    if (cn.relatedItemId && items.some((it) => it.id === cn.relatedItemId)) {
      return;
    }

    const rel = formatNotificationRelativeTime(cn.createdTimestamp);
    let category: NotificationCategory = cn.category || "reminder";
    let actionTarget: MobileNotificationItem["actionTarget"] = "bills";

    if (
      cn.type === "ANNOUNCEMENT" ||
      cn.type === "BROADCAST" ||
      cn.category === "announcement" ||
      cn.isBroadcast
    ) {
      category = "announcement";
      actionTarget = cn.actionTarget || "announcement";
    } else if (cn.type === "FRIEND_REQUEST") {
      category = "group_invite";
      actionTarget = "community";
    } else if (
      cn.type === "COMMUNITY_POST" ||
      cn.type === "COMMUNITY_STORY" ||
      cn.type === "COMMUNITY_COMMENT" ||
      cn.type === "COMMUNITY_REACTION"
    ) {
      category = "reminder";
      actionTarget = "community";
    } else if (!cn.category && cn.type) {
      if (
        cn.type === "PAYMENT_SUBMITTED" ||
        cn.type === "PAYMENT_VERIFIED" ||
        cn.type === "PAYMENT_REJECTED"
      ) {
        category = "payment_received";
        actionTarget = "payments";
      } else if (cn.type === "ATTENDANCE_UPDATED") {
        category = "water_calculated";
        actionTarget = "attendance";
      } else if (cn.type === "INVITATION_RECEIVED") {
        category = "group_invite";
        actionTarget = "groups";
      } else if (cn.type === "BILL_UPDATED") {
        category = "expense_added";
        actionTarget = "bills";
      } else {
        category = "reminder";
        actionTarget = "settle_dues";
      }
    }

    const spans: NotificationTextSpan[] =
      Array.isArray(cn.spans) && cn.spans.length > 0
        ? cn.spans
        : [{ text: cn.message || cn.title || "" }];

    items.push({
      id: cn.relatedItemId || docId,
      cloudDocId: docId,
      category,
      title: cn.title || "Notification",
      message: cn.message || "",
      spans,
      timeLabel: rel.label,
      timestampMs: rel.timestampMs,
      createdTimestamp: rel.isoString,
      section: rel.isRecent ? "recent" : "earlier",
      defaultUnread: !isCloudDocReadByCurrentUser(cn),
      relatedEntityId: cn.relatedEntityId,
      actionTarget,
      data: cn.data,
    });
  });

  // Sort newest first
  items.sort((a, b) => b.timestampMs - a.timestampMs);

  // If there are items but none fell into the last-24h window, place the newest up to 3 in 'recent'
  if (items.length > 0 && !items.some((it) => it.section === "recent")) {
    items.forEach((it, idx) => {
      it.section = idx < Math.min(3, items.length) ? "recent" : "earlier";
    });
  }

  return items;
}

export function isPayorMember(member: any): boolean {
  if (!member) return true;
  if (
    member.role === "NON_PAYOR" ||
    member.role === "RESIDENT_NON_PAYOR" ||
    member.isPayor === false
  ) {
    return false;
  }
  if (
    member.role === "PAYOR" ||
    member.role === "HOST" ||
    member.isPayor === true
  ) {
    return true;
  }
  return member.role !== "NON_PAYOR";
}

export function getMemberPrimaryId(member: any): string {
  return String(member?.userId || member?.memberId || member?.id || "").trim();
}

export function matchesMemberUid(
  member: any,
  targetId?: string | null,
): boolean {
  if (!member || !targetId) return false;
  const cleanTarget = String(targetId).trim();
  if (!cleanTarget) return false;
  const strippedTarget = cleanTarget.replace(/^mem_/, "");
  const candidates = [member.userId, member.memberId, member.id]
    .filter(Boolean)
    .map((v) => String(v).trim());
  return candidates.some(
    (c) => c === cleanTarget || c.replace(/^mem_/, "") === strippedTarget,
  );
}

/**
 * Computes the exact centavo share for a payor at `payorIndex` out of `payorCount` payors
 * using floor division + remainder distribution so the sum of all payor shares equals
 * `totalCentavos` to the exact centavo (e.g., ₱800.00 / 3 => ₱266.67, ₱266.67, ₱266.66).
 */
export function getFairSplitShareAtIndex(
  totalCentavos: number,
  payorCount: number,
  payorIndex: number,
): number {
  const count = Math.max(1, Math.floor(Number(payorCount) || 1));
  const total = Math.max(0, Math.round(Number(totalCentavos) || 0));
  const safeIndex =
    payorIndex >= 0 && payorIndex < count ? Math.floor(payorIndex) : 0;
  const baseShare = Math.floor(total / count);
  const remainder = total % count;
  return safeIndex < remainder ? baseShare + 1 : baseShare;
}

/**
 * Resolves a specific payor's exact centavo fair share from a payors list.
 * Matches `targetUid` against `payors` (via userId/memberId/id) to find their deterministic index.
 */
export function computeFairSplitShareCentavos(
  totalCentavos: number,
  payors: any[],
  targetUid?: string | null,
  fallbackIndex: number = 0,
): number {
  const safePayors = Array.isArray(payors) ? payors : [];
  const count = Math.max(1, safePayors.length);
  let idx = fallbackIndex;
  if (targetUid && safePayors.length > 0) {
    const foundIdx = safePayors.findIndex((p) =>
      matchesMemberUid(p, targetUid),
    );
    if (foundIdx >= 0) {
      idx = foundIdx;
    }
  }
  return getFairSplitShareAtIndex(totalCentavos, count, idx);
}

function getPayorMapValue(
  mapObj: Record<string, any> | undefined | null,
  payorMember: any,
): number {
  if (!mapObj || typeof mapObj !== "object") return 0;
  for (const [k, v] of Object.entries(mapObj)) {
    if (matchesMemberUid(payorMember, k)) {
      const num = Number(v);
      return Number.isFinite(num) && num > 0 ? num : 0;
    }
  }
  return 0;
}

export interface ComputedWaterMemberBreakdown {
  userId: string;
  displayName: string;
  role: string;
  isPayor: boolean;
  isExempt: boolean;
  daysPresent: number;
  rateCentavosPerDay: number;
  ownWaterCentavos: number;
  nonPayorWaterCentavos: number;
  nonPayorWaterNotes: string[];
  nonPayorAllocationSummary: string;
  shareCentavos: number;
  note: string;
}
// CycleWaterConfig and resolveCycleWaterConfig are exported from @propertyflow/shared at top of module

/**
 * Shared deterministic calculator for PER_PERSON_DAY water attendance shares.
 * Honors each Non-Payor's saved allocationMode (FAIR_SPLIT, SPECIFIC_PAYOR, CUSTOM_SPLIT)
 * from attendanceSubmissions with fallback to existingSplitDetails.
 */
export function computeCycleWaterBreakdown(
  activeMembers: any[],
  cycleAttendance: any[] = [],
  attendanceSubmissions: Record<string, any> | any[] = {},
  rateCentavosPerDay: number = 500,
  existingSplitDetails?: any[],
): {
  membersBreakdown: ComputedWaterMemberBreakdown[];
  totalAmountCentavos: number;
  getPayorShareCentavos: (targetUid?: string | null) => number;
} {
  const rate =
    Number.isFinite(Number(rateCentavosPerDay)) &&
    Number(rateCentavosPerDay) > 0
      ? Number(rateCentavosPerDay)
      : 500;
  const rawMembers = Array.isArray(activeMembers) ? activeMembers : [];
  const safeMembers = rawMembers.filter((m) => {
    if (!m) return false;
    const statusUpper = String(m.status || "").toUpperCase();
    const joinStatusUpper = String(m.joinRequestStatus || "").toUpperCase();
    if (
      statusUpper === "REJECTED" ||
      statusUpper === "DECLINED" ||
      statusUpper === "PENDING" ||
      statusUpper === "INACTIVE" ||
      statusUpper === "REMOVED" ||
      statusUpper === "CANCELLED" ||
      joinStatusUpper === "REJECTED" ||
      joinStatusUpper === "DECLINED" ||
      joinStatusUpper === "PENDING" ||
      joinStatusUpper === "REMOVED" ||
      Boolean(m.rejectionReason) ||
      Boolean(m.rejectedDate)
    ) {
      return false;
    }
    return (
      statusUpper === "ACTIVE" ||
      m.role === "HOST" ||
      (!m.status && !m.joinRequestStatus)
    );
  });
  const activePayors = safeMembers.filter((m) => isPayorMember(m));
  const effectivePayors = activePayors.length > 0 ? activePayors : safeMembers;

  const subList: any[] = Array.isArray(attendanceSubmissions)
    ? attendanceSubmissions
    : attendanceSubmissions && typeof attendanceSubmissions === "object"
      ? Object.values(attendanceSubmissions)
      : [];

  const findSubForMember = (m: any) =>
    subList.find(
      (s: any) => s && matchesMemberUid(m, s.userId || s.memberId || s.id),
    );

  const findExistingSplit = (m: any) =>
    Array.isArray(existingSplitDetails)
      ? existingSplitDetails.find((s: any) =>
          matchesMemberUid(m, s?.userId || s?.memberId || s?.id),
        )
      : null;

  const memberDaysMap = new Map<string, number>();
  const payorOwnMap = new Map<string, number>();
  const payorExtraMap = new Map<string, number>();
  const payorExtraNotesMap = new Map<string, string[]>();
  const nonPayorNoteMap = new Map<string, string>();
  const nonPayorSummaryMap = new Map<string, string>();

  effectivePayors.forEach((p: any) => {
    const pUid = getMemberPrimaryId(p);
    payorExtraMap.set(pUid, 0);
    payorExtraNotesMap.set(pUid, []);
  });

  for (const m of safeMembers) {
    const uid = getMemberPrimaryId(m);
    const userAttRecords = (cycleAttendance || []).filter((a: any) =>
      matchesMemberUid(m, a?.userId),
    );
    const presentFromAtt = userAttRecords.filter(
      (a: any) => a?.status === "PRESENT",
    ).length;
    const subRecord = findSubForMember(m);
    const existingSplit = findExistingSplit(m);

    const daysPresent =
      userAttRecords.length > 0
        ? presentFromAtt
        : subRecord?.daysPresent !== undefined
          ? Number(subRecord.daysPresent)
          : existingSplit?.daysPresent !== undefined
            ? Number(existingSplit.daysPresent)
            : 0;

    memberDaysMap.set(uid, daysPresent);
    const cost = daysPresent * rate;

    if (isPayorMember(m)) {
      payorOwnMap.set(uid, cost);
    } else {
      const npName = m.displayName || m.name || "Non-payor";
      const mode = subRecord?.allocationMode || "FAIR_SPLIT";
      const assignedPayorId = subRecord?.assignedPayorId;
      const customSplits =
        subRecord?.customPayorSplitsCentavos &&
        typeof subRecord.customPayorSplitsCentavos === "object"
          ? subRecord.customPayorSplitsCentavos
          : null;
      const customPcts =
        subRecord?.customPayorPercentages &&
        typeof subRecord.customPayorPercentages === "object"
          ? subRecord.customPayorPercentages
          : null;

      const matchedTargetPayor =
        mode === "SPECIFIC_PAYOR" && assignedPayorId
          ? effectivePayors.find((p: any) =>
              matchesMemberUid(p, assignedPayorId),
            )
          : null;

      if (matchedTargetPayor) {
        const targetUid = getMemberPrimaryId(matchedTargetPayor);
        const targetName =
          matchedTargetPayor.displayName || matchedTargetPayor.name || "Payor";
        payorExtraMap.set(
          targetUid,
          (payorExtraMap.get(targetUid) || 0) + cost,
        );
        if (cost > 0) {
          payorExtraNotesMap
            .get(targetUid)
            ?.push(`₱${(cost / 100).toFixed(2)} from ${npName} (Assigned)`);
        }
        nonPayorSummaryMap.set(
          uid,
          cost > 0
            ? `Assigned to ${targetName} (₱${(cost / 100).toFixed(2)})`
            : `Assigned to ${targetName}`,
        );
        nonPayorNoteMap.set(
          uid,
          `Exempted (Non-payor) — ${daysPresent} days water cost (₱${(cost / 100).toFixed(2)}) assigned to ${targetName}`,
        );
      } else if (mode === "CUSTOM_SPLIT" && (customSplits || customPcts)) {
        const savedEntries = effectivePayors.map((p: any) => {
          const pUid = getMemberPrimaryId(p);
          return {
            pUid,
            pName: p.displayName || p.name || "Payor",
            savedCents: getPayorMapValue(customSplits, p),
            savedPct: getPayorMapValue(customPcts, p),
          };
        });
        const savedCentsSum = savedEntries.reduce(
          (acc, e) => acc + e.savedCents,
          0,
        );
        const savedPctSum = savedEntries.reduce(
          (acc, e) => acc + e.savedPct,
          0,
        );

        if ((savedCentsSum > 0 || savedPctSum > 0) && cost > 0) {
          let distributed = 0;
          const useCents = savedCentsSum > 0;
          const activeEntries = savedEntries.filter((e) =>
            useCents ? e.savedCents > 0 : e.savedPct > 0,
          );
          const customParts: string[] = [];

          activeEntries.forEach((entry, idx) => {
            let share = 0;
            if (useCents) {
              if (Math.abs(savedCentsSum - cost) <= 5) {
                share =
                  idx === activeEntries.length - 1
                    ? Math.max(0, cost - distributed)
                    : Math.round(entry.savedCents);
              } else {
                share =
                  idx === activeEntries.length - 1
                    ? Math.max(0, cost - distributed)
                    : Math.round((cost * entry.savedCents) / savedCentsSum);
              }
            } else {
              share =
                idx === activeEntries.length - 1
                  ? Math.max(0, cost - distributed)
                  : Math.round((cost * entry.savedPct) / savedPctSum);
            }
            distributed += share;
            payorExtraMap.set(
              entry.pUid,
              (payorExtraMap.get(entry.pUid) || 0) + share,
            );
            if (share > 0) {
              payorExtraNotesMap
                .get(entry.pUid)
                ?.push(`₱${(share / 100).toFixed(2)} from ${npName} (Custom)`);
              const shortPayorName = entry.pName.split(" ")[0] || entry.pName;
              customParts.push(
                `${shortPayorName} ₱${(share / 100).toFixed(2)}`,
              );
            }
          });

          const breakdownStr =
            customParts.length > 0
              ? `Custom split: ${customParts.join(", ")}`
              : "Custom split across payors";
          nonPayorSummaryMap.set(uid, breakdownStr);
          nonPayorNoteMap.set(
            uid,
            `Exempted (Non-payor) — ${daysPresent} days water cost (₱${(cost / 100).toFixed(2)}) · ${breakdownStr}`,
          );
        } else {
          effectivePayors.forEach((p: any, idx: number) => {
            const pUid = getMemberPrimaryId(p);
            const extraPer =
              effectivePayors.length > 0
                ? getFairSplitShareAtIndex(cost, effectivePayors.length, idx)
                : 0;
            payorExtraMap.set(pUid, (payorExtraMap.get(pUid) || 0) + extraPer);
            if (extraPer > 0) {
              payorExtraNotesMap
                .get(pUid)
                ?.push(`₱${(extraPer / 100).toFixed(2)} from ${npName}`);
            }
          });
          nonPayorSummaryMap.set(
            uid,
            cost > 0 ? "Split fairly across payors" : "Exempted",
          );
          nonPayorNoteMap.set(
            uid,
            `Exempted (Non-payor) — ${daysPresent} days water cost split fairly across payors`,
          );
        }
      } else if (
        !subRecord &&
        subList.length === 0 &&
        Array.isArray(existingSplitDetails) &&
        existingSplitDetails.some(
          (s: any) => typeof s?.nonPayorWaterCentavos === "number",
        )
      ) {
        // Fallback to persisted splitDetails when attendanceSubmissions listener hasn't emitted yet
        const npExisting = findExistingSplit(m);
        nonPayorSummaryMap.set(
          uid,
          npExisting?.note
            ? String(npExisting.note).replace(
                /^Exempted \(Non-payor\)\s*[—·-]\s*/i,
                "",
              )
            : "Exempted",
        );
        nonPayorNoteMap.set(
          uid,
          npExisting?.note ||
            `Exempted (Non-payor) — ${daysPresent} days water cost absorbed by payors`,
        );
      } else {
        effectivePayors.forEach((p: any, idx: number) => {
          const pUid = getMemberPrimaryId(p);
          const extraPer =
            effectivePayors.length > 0
              ? getFairSplitShareAtIndex(cost, effectivePayors.length, idx)
              : 0;
          payorExtraMap.set(pUid, (payorExtraMap.get(pUid) || 0) + extraPer);
          if (extraPer > 0) {
            payorExtraNotesMap
              .get(pUid)
              ?.push(`₱${(extraPer / 100).toFixed(2)} from ${npName}`);
          }
        });
        nonPayorSummaryMap.set(
          uid,
          cost > 0 ? "Split fairly across payors" : "Exempted",
        );
        nonPayorNoteMap.set(
          uid,
          `Exempted (Non-payor) — ${daysPresent} days water cost split fairly across payors`,
        );
      }
    }
  }

  // If subList was not yet loaded and existingSplitDetails had nonPayorWaterCentavos, preserve them
  const usePersistedPayorExtra =
    subList.length === 0 &&
    Array.isArray(existingSplitDetails) &&
    existingSplitDetails.some(
      (s: any) =>
        typeof s?.nonPayorWaterCentavos === "number" &&
        s.nonPayorWaterCentavos > 0,
    );

  let totalAmountCentavos = 0;
  const membersBreakdown: ComputedWaterMemberBreakdown[] = safeMembers.map(
    (m: any) => {
      const uid = getMemberPrimaryId(m);
      const isPayor = isPayorMember(m);
      const daysPresent = memberDaysMap.get(uid) || 0;
      const existingSplit = findExistingSplit(m);

      if (isPayor) {
        const ownCost = payorOwnMap.get(uid) || 0;
        const extraForThisPayor = usePersistedPayorExtra
          ? Number(existingSplit?.nonPayorWaterCentavos ?? 0)
          : payorExtraMap.get(uid) || 0;
        const extraNotes = payorExtraNotesMap.get(uid) || [];
        const totalPayorShare = ownCost + extraForThisPayor;
        totalAmountCentavos += totalPayorShare;

        const computedNote =
          usePersistedPayorExtra && existingSplit?.note
            ? String(existingSplit.note)
            : extraForThisPayor > 0
              ? `${daysPresent} days @ ₱${rate / 100}/day (₱${(
                  ownCost / 100
                ).toFixed(2)}) + non-payor share (${
                  extraNotes.length > 0
                    ? extraNotes.join(", ")
                    : `₱${(extraForThisPayor / 100).toFixed(2)}`
                })`
              : `${daysPresent} days present @ ₱${rate / 100}/day`;

        return {
          userId: uid,
          displayName: m.displayName || m.name || "Roommate",
          role: m.role || "PAYOR",
          isPayor: true,
          isExempt: false,
          daysPresent,
          rateCentavosPerDay: rate,
          ownWaterCentavos: ownCost,
          nonPayorWaterCentavos: extraForThisPayor,
          nonPayorWaterNotes: extraNotes,
          nonPayorAllocationSummary: "",
          shareCentavos: totalPayorShare,
          note: computedNote,
        };
      } else {
        const summary = nonPayorSummaryMap.get(uid) || "Exempted";
        const note =
          nonPayorNoteMap.get(uid) ||
          `Exempted (Non-payor) — ${daysPresent} days water cost absorbed by payors`;
        return {
          userId: uid,
          displayName: m.displayName || m.name || "Roommate",
          role: "NON_PAYOR",
          isPayor: false,
          isExempt: true,
          daysPresent,
          rateCentavosPerDay: rate,
          ownWaterCentavos: 0,
          nonPayorWaterCentavos: 0,
          nonPayorWaterNotes: [],
          nonPayorAllocationSummary: summary,
          shareCentavos: 0,
          note,
        };
      }
    },
  );

  const getPayorShareCentavos = (targetUid?: string | null): number => {
    if (!targetUid) return 0;
    const found = membersBreakdown.find((item) =>
      matchesMemberUid({ userId: item.userId }, targetUid),
    );
    return found && found.isPayor ? found.shareCentavos : 0;
  };

  return {
    membersBreakdown,
    totalAmountCentavos,
    getPayorShareCentavos,
  };
}

/**
 * Excludes group name suffixes from bill/expense titles (e.g. "Electricity - Administrators" -> "Electricity").
 */
export function cleanBillTitle(
  title?: string,
  category?: string,
  groupName?: string,
): string {
  if (!title) return category || "";
  const trimmed = title.trim();

  // If title starts with "Category - " (case-insensitive)
  if (
    category &&
    trimmed.toLowerCase().startsWith(`${category.toLowerCase()} - `)
  ) {
    return category;
  }

  // If group name is provided and matches " - GroupName" suffix (case-insensitive)
  if (groupName && groupName.trim()) {
    const escaped = groupName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\s*-\\s*${escaped}$`, "i");
    if (regex.test(trimmed)) {
      return trimmed.replace(regex, "").trim();
    }
  }

  // If title contains " - ", strip off trailing group name suffix (e.g. "Electricity - Administrators" -> "Electricity")
  const dashIndex = trimmed.lastIndexOf(" - ");
  if (dashIndex > 0) {
    const prefix = trimmed.substring(0, dashIndex).trim();
    if (prefix.length > 0) {
      return prefix;
    }
  }

  return trimmed;
}

export interface MobileExpense {
  id: string;
  householdId: string;
  title: string;
  category: string;
  amountCents: number;
  date: string;
  payerName: string;
  payerId: string;
  splitMethod: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
  billingCycleId?: string;
  status?: "UNPAID" | "PAID" | "PENDING";
  isPaid?: boolean;
  recordedBy?: string;
  splitDetails?: Array<{
    userId: string;
    displayName: string;
    shareCentavos: number;
    percentage?: number;
    isPaid?: boolean;
    isExempt?: boolean;
    role?: string;
    note?: string;
    ownWaterCentavos?: number;
    nonPayorWaterCentavos?: number;
    daysPresent?: number;
    rateCentavosPerDay?: number;
  }>;
  splits?: Record<string, number>;
  previousReadingKwh?: number;
  currentReadingKwh?: number;
  consumedKwh?: number;
  rateCentavosPerKwh?: number;
}

export interface HostPaymentMethod {
  id: string;
  type: "GCASH" | "MAYA" | "BANK_TRANSFER" | "CASH" | "OTHER";
  name: string;
  accountName: string;
  accountNumber: string;
  qrCodeUrl?: string;
  customIconUrl?: string;
  notes?: string;
  isEnabled: boolean;
  updatedAt?: string;
}

export const DEFAULT_HOST_PAYMENT_METHODS: HostPaymentMethod[] = [
  {
    id: "default_gcash",
    type: "GCASH",
    name: "GCash",
    accountName: "Host GCash",
    accountNumber: "",
    notes: "Please include your room number in transfer remarks.",
    isEnabled: true,
  },
  {
    id: "default_maya",
    type: "MAYA",
    name: "Maya",
    accountName: "Host Maya",
    accountNumber: "",
    notes: "Scan QR or send to mobile number.",
    isEnabled: true,
  },
  {
    id: "default_bank",
    type: "BANK_TRANSFER",
    name: "Bank Transfer",
    accountName: "Host Bank Account",
    accountNumber: "",
    notes: "InstaPay or PESONet transfer.",
    isEnabled: true,
  },
  {
    id: "default_cash",
    type: "CASH",
    name: "Cash Handover",
    accountName: "Host / Property Manager",
    accountNumber: "Pay in person to Host",
    notes: "Please pay directly to the property host and request confirmation.",
    isEnabled: true,
  },
];

export interface MobilePaymentBreakdownItem {
  id: string;
  title: string;
  category: string;
  cycleId?: string;
  cycleName?: string;
  isOverdue?: boolean;
  householdAmountCentavos?: number;
  shareCentavos: number;
}

export interface MobilePayment {
  paymentId: string;
  householdId: string;
  billingCycleId: string;
  billingCycleName?: string;
  userId: string;
  userName: string;
  amountCentavos: number;
  paymentDate: string;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "GCASH" | "MAYA" | "OTHER" | string;
  referenceNumber: string;
  proofOfPaymentUrl?: string | null;
  notes?: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  createdDate: string;
  verifiedDate?: string;
  verifiedBy?: string | null;
  rejectionReason?: string | null;
  breakdownItems?: MobilePaymentBreakdownItem[];
}

export interface MobileAttendance {
  recordId: string;
  householdId: string;
  billingCycleId: string;
  userId: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "UNMARKED";
  locked: boolean;
}

export interface MobileHousehold {
  id: string;
  name: string;
  code: string;
  hostId: string;
  rates: {
    rentCents: number;
    electricityPerKwh: number;
    waterPerPersonDay: number;
    internetCents: number;
  };
  members: {
    id: string;
    name: string;
    role: "Host" | "Payor" | "Non-Payor";
    email: string;
    avatar: string;
  }[];
}

export function sortBillingCyclesNewest(cycles: any[]): any[] {
  return [...cycles].sort((a, b) => {
    const aActive = a?.status === "ACTIVE" || a?.status === "FINALIZED" ? 1 : 0;
    const bActive = b?.status === "ACTIVE" || b?.status === "FINALIZED" ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    const aCreated = a?.createdDate ? new Date(a.createdDate).getTime() : 0;
    const bCreated = b?.createdDate ? new Date(b.createdDate).getTime() : 0;
    if (aCreated !== bCreated && !isNaN(aCreated) && !isNaN(bCreated)) {
      return bCreated - aCreated;
    }
    return String(b?.startDate || "").localeCompare(String(a?.startDate || ""));
  });
}

export function normalizeCleanUid(raw?: string | null): string {
  return String(raw || "")
    .replace(/^mem_/, "")
    .trim();
}

export interface MemberCycleSettlementSummary {
  cycleId: string;
  userId: string;
  grossShareCentavos: number;
  unpaidSplitShareCentavos: number;
  allocatedPaidCentavos: number;
  allocatedPaidInCycleCentavos: number;
  settledArrearsInCycleCentavos: number;
  remainingCycleCentavos: number;
  priorUnpaidArrearsCentavos: number;
  totalPriorGrossCentavos: number;
  totalOwesAsOfCycleCentavos: number;
  isCycleSettled: boolean;
  isFullySettledAsOfCycle: boolean;
  settledViaRollover: boolean;
  settledViaCycleId?: string;
  matchedPayment?: MobilePayment;
}

export interface HouseholdCycleSettlementResult {
  orderedCycleIdsOldestFirst: string[];
  settledPayorUidsByCycle: Map<string, Set<string>>;
  allPayorsSettledByCycle: Map<string, boolean>;
  getMemberCycleSummary: (
    cycleId: string | undefined | null,
    memberOrUid: any,
  ) => MemberCycleSettlementSummary;
  getPriorUnpaidArrearsBeforeCycle: (
    cycleId: string | undefined | null,
    memberOrUid: any,
  ) => number;
  getMatchedPaymentForExpense: (
    exp: MobileExpense,
    memberOrUid: any,
  ) => MobilePayment | undefined;
}

export function evaluateHouseholdCycleSettlements(params: {
  cycles: any[];
  expenses: MobileExpense[];
  payments: MobilePayment[];
  allMemberBills: any[];
  members: any[];
  getCustomExpenseShare?: (
    exp: MobileExpense,
    cycleId: string,
    payor: any,
  ) => number | undefined;
}): HouseholdCycleSettlementResult {
  const rawMembers = Array.isArray(params.members) ? params.members : [];
  const seenMemberKeys = new Set<string>();
  const activeMembers: any[] = [];
  rawMembers.forEach((m) => {
    if (!m) return;
    const st = String(m.status || "").toUpperCase();
    const jst = String(m.joinRequestStatus || "").toUpperCase();
    if (
      st === "PENDING" ||
      st === "REJECTED" ||
      st === "DECLINED" ||
      st === "REMOVED" ||
      st === "INACTIVE" ||
      st === "CANCELLED" ||
      jst === "PENDING" ||
      jst === "REJECTED" ||
      jst === "DECLINED" ||
      jst === "REMOVED"
    ) {
      return;
    }
    const cleanKey =
      normalizeCleanUid(getMemberPrimaryId(m)) ||
      String(m.email || "")
        .trim()
        .toLowerCase();
    if (!cleanKey || seenMemberKeys.has(cleanKey)) return;
    seenMemberKeys.add(cleanKey);
    activeMembers.push(m);
  });

  const activePayors = activeMembers.filter((m) => isPayorMember(m));
  const effectivePayors =
    activePayors.length > 0 ? activePayors : activeMembers;
  const payorCount = Math.max(1, effectivePayors.length);

  const sortedNewest = sortBillingCyclesNewest(params.cycles || []);
  const orderedOldestFirst = [...sortedNewest].reverse();
  const orderedCycleIdsOldestFirst: string[] = [];
  orderedOldestFirst.forEach((c) => {
    const cid = String(c?.billingCycleId || "").trim();
    if (cid && !orderedCycleIdsOldestFirst.includes(cid)) {
      orderedCycleIdsOldestFirst.push(cid);
    }
  });

  const allExpenses = Array.isArray(params.expenses) ? params.expenses : [];
  allExpenses.forEach((e) => {
    const cid = String(e?.billingCycleId || "").trim();
    if (cid && cid !== "general" && !orderedCycleIdsOldestFirst.includes(cid)) {
      orderedCycleIdsOldestFirst.unshift(cid);
    }
  });

  if (orderedCycleIdsOldestFirst.length === 0) {
    orderedCycleIdsOldestFirst.push("general");
  }

  const knownCycleIds = new Set<string>(orderedCycleIdsOldestFirst);
  const oldestCycleId = orderedCycleIdsOldestFirst[0];
  const newestCycleId =
    orderedCycleIdsOldestFirst[orderedCycleIdsOldestFirst.length - 1];
  const isSingleCycle = orderedCycleIdsOldestFirst.length <= 1;

  const expensesByCycle = new Map<string, MobileExpense[]>();
  orderedCycleIdsOldestFirst.forEach((cid) => expensesByCycle.set(cid, []));
  allExpenses.forEach((exp) => {
    const rawCid = String(exp?.billingCycleId || "").trim();
    const targetCid =
      rawCid && knownCycleIds.has(rawCid) ? rawCid : oldestCycleId;
    const bucket = expensesByCycle.get(targetCid);
    if (bucket) bucket.push(exp);
  });

  const allBills = Array.isArray(params.allMemberBills)
    ? params.allMemberBills
    : [];
  const allPayments = Array.isArray(params.payments) ? params.payments : [];

  const getCycleBillForPayor = (cycleId: string, payor: any): any | null => {
    let best: any = null;
    for (const mb of allBills) {
      if (!mb) continue;
      const mbCid = String(mb.billingCycleId || "").trim();
      const cidMatches =
        mbCid === cycleId || ((!mbCid || mbCid === "general") && isSingleCycle);
      if (!cidMatches) continue;
      if (!matchesMemberUid(payor, mb.userId || mb.memberId || mb.billId)) {
        continue;
      }
      if (!best) {
        best = mb;
      } else {
        const bestCanonical = String(best.billId || "").startsWith("bill_");
        const curCanonical = String(mb.billId || "").startsWith("bill_");
        const bestPaid = Number(
          best.totalPaidCentavos || best.paidCentavos || 0,
        );
        const curPaid = Number(mb.totalPaidCentavos || mb.paidCentavos || 0);
        if (
          (curCanonical && !bestCanonical) ||
          (curCanonical === bestCanonical && curPaid > bestPaid)
        ) {
          best = mb;
        }
      }
    }
    return best;
  };

  const summaryMap = new Map<string, MemberCycleSettlementSummary>();
  const settledPayorUidsByCycle = new Map<string, Set<string>>();
  orderedCycleIdsOldestFirst.forEach((cid) =>
    settledPayorUidsByCycle.set(cid, new Set<string>()),
  );

  for (const payor of effectivePayors) {
    const rawPrimaryId = getMemberPrimaryId(payor);
    const cleanUid = normalizeCleanUid(rawPrimaryId);
    if (!cleanUid) continue;

    const grossShareByCycle = new Map<string, number>();
    const unpaidSplitShareByCycle = new Map<string, number>();
    const allSplitsMarkedPaidByCycle = new Map<string, boolean>();

    for (const cid of orderedCycleIdsOldestFirst) {
      const cycExps = expensesByCycle.get(cid) || [];
      let gross = 0;
      let unpaidSplits = 0;
      let allMarkedPaid = cycExps.length > 0;

      for (const exp of cycExps) {
        const splits = Array.isArray(exp.splitDetails) ? exp.splitDetails : [];
        const mySplit = splits.find((s: any) =>
          matchesMemberUid(payor, s?.userId || s?.memberId || s?.id),
        );
        if (mySplit?.isExempt) continue;

        let share = 0;
        const customVal = params.getCustomExpenseShare?.(exp, cid, payor);
        if (typeof customVal === "number" && Number.isFinite(customVal)) {
          share = Math.max(0, Math.round(customVal));
        } else {
          const isWater = (exp.category || "").toLowerCase().includes("water");
          const splitPayors = splits.filter(
            (s: any) => !s?.isExempt && (Number(s?.shareCentavos) || 0) > 0,
          );
          const splitSum = splitPayors.reduce(
            (acc: number, s: any) => acc + (Number(s?.shareCentavos) || 0),
            0,
          );
          const isSplitStale =
            (splitPayors.length > 0 && splitPayors.length !== payorCount) ||
            (!isWater &&
              splitPayors.length > 0 &&
              splitSum !== (Number(exp.amountCents) || 0));

          if (
            !isSplitStale &&
            mySplit &&
            typeof mySplit.shareCentavos === "number"
          ) {
            share = Math.max(0, mySplit.shareCentavos);
          } else {
            share = computeFairSplitShareCentavos(
              Number(exp.amountCents) || 0,
              effectivePayors,
              cleanUid,
            );
          }
        }

        gross += share;

        const isExpOrSplitPaid = Boolean(
          exp.status === "PAID" || exp.isPaid === true || mySplit?.isPaid,
        );
        if (!isExpOrSplitPaid && share > 0) {
          const partialPaid = Math.max(
            0,
            Number((mySplit as any)?.paidAmountCentavos) || 0,
          );
          const rem = Math.max(0, share - partialPaid);
          unpaidSplits += rem;
          if (rem > 0) {
            allMarkedPaid = false;
          }
        }
      }

      // Handle orphan carried-over arrears where original prior-cycle expense docs no longer exist
      if (gross === 0 && cycExps.length === 0) {
        let orphanArrearsAmt = 0;
        let orphanSettled = false;
        for (const mb of allBills) {
          if (!mb || !matchesMemberUid(payor, mb.userId || mb.memberId))
            continue;
          for (const li of mb.lineItems || []) {
            if (
              (li?.category === "Arrears" || li?.isArrears) &&
              !li?.isExempt &&
              String(li?.priorCycleId || "") === cid
            ) {
              const amt = Math.max(0, Number(li.amountCentavos) || 0);
              if (amt > orphanArrearsAmt) orphanArrearsAmt = amt;
              if (
                li.status === "PAID" ||
                li.isSettled ||
                (mb.status === "PAID" &&
                  Number(mb.outstandingCentavos || 0) === 0 &&
                  Number(mb.totalPaidCentavos || 0) > 0)
              ) {
                orphanSettled = true;
              }
            }
          }
        }
        if (orphanArrearsAmt > 0) {
          gross = orphanArrearsAmt;
          unpaidSplits = orphanSettled ? 0 : orphanArrearsAmt;
          allMarkedPaid = orphanSettled;
        }
      }

      grossShareByCycle.set(cid, gross);
      unpaidSplitShareByCycle.set(cid, unpaidSplits);
      allSplitsMarkedPaidByCycle.set(cid, gross > 0 && allMarkedPaid);
    }

    // Pass 1: Allocate non-rejected payments by explicit breakdownItems cycleId or payment's billingCycleId
    const userPayments = allPayments
      .filter(
        (pmt) =>
          pmt &&
          pmt.status !== "REJECTED" &&
          matchesMemberUid(payor, pmt.userId),
      )
      .slice()
      .sort((a, b) => {
        const tA = new Date(a.createdDate || a.paymentDate || 0).getTime() || 0;
        const tB = new Date(b.createdDate || b.paymentDate || 0).getTime() || 0;
        return tA - tB;
      });

    const allocatedPaidByCycle = new Map<string, number>();
    const directPaidInCycle = new Map<string, number>();
    const paymentsTouchingCycle = new Map<string, MobilePayment[]>();
    orderedCycleIdsOldestFirst.forEach((cid) => {
      allocatedPaidByCycle.set(cid, 0);
      directPaidInCycle.set(cid, 0);
      paymentsTouchingCycle.set(cid, []);
    });

    const recordPaymentTouch = (cid: string, pmt: MobilePayment) => {
      const list = paymentsTouchingCycle.get(cid);
      if (list && !list.some((x) => x.paymentId === pmt.paymentId)) {
        list.push(pmt);
      }
    };

    for (const pmt of userPayments) {
      const rawPmtCid = String(pmt.billingCycleId || "").trim();
      const pmtOriginCid =
        rawPmtCid && rawPmtCid !== "general" && knownCycleIds.has(rawPmtCid)
          ? rawPmtCid
          : isSingleCycle
            ? oldestCycleId
            : newestCycleId;
      const pmtAmt = Math.max(0, Number(pmt.amountCentavos) || 0);
      directPaidInCycle.set(
        pmtOriginCid,
        (directPaidInCycle.get(pmtOriginCid) || 0) + pmtAmt,
      );

      if (Array.isArray(pmt.breakdownItems) && pmt.breakdownItems.length > 0) {
        let allocatedFromBd = 0;
        for (const bi of pmt.breakdownItems) {
          const biAmt = Math.max(0, Number(bi?.shareCentavos) || 0);
          if (biAmt <= 0) continue;
          const rawBiCid = String(bi?.cycleId || "").trim();
          let targetCid = pmtOriginCid;
          if (
            rawBiCid &&
            rawBiCid !== "general" &&
            knownCycleIds.has(rawBiCid)
          ) {
            targetCid = rawBiCid;
          } else if (bi?.isOverdue) {
            const pmtIdx = orderedCycleIdsOldestFirst.indexOf(pmtOriginCid);
            const fallbackOlder = orderedCycleIdsOldestFirst
              .slice(0, pmtIdx > 0 ? pmtIdx : orderedCycleIdsOldestFirst.length)
              .find(
                (c) =>
                  (grossShareByCycle.get(c) || 0) >
                  (allocatedPaidByCycle.get(c) || 0),
              );
            targetCid = fallbackOlder || oldestCycleId;
          }
          allocatedPaidByCycle.set(
            targetCid,
            (allocatedPaidByCycle.get(targetCid) || 0) + biAmt,
          );
          recordPaymentTouch(targetCid, pmt);
          allocatedFromBd += biAmt;
        }
        const leftover = Math.max(0, pmtAmt - allocatedFromBd);
        if (leftover > 0) {
          allocatedPaidByCycle.set(
            pmtOriginCid,
            (allocatedPaidByCycle.get(pmtOriginCid) || 0) + leftover,
          );
          recordPaymentTouch(pmtOriginCid, pmt);
        }
      } else {
        allocatedPaidByCycle.set(
          pmtOriginCid,
          (allocatedPaidByCycle.get(pmtOriginCid) || 0) + pmtAmt,
        );
        recordPaymentTouch(pmtOriginCid, pmt);
      }
    }

    // Honor direct memberBill paidCentavos if a cycle had bill-level credit with no payment docs and was not a rollover mirror
    for (const cid of orderedCycleIdsOldestFirst) {
      const cBill = getCycleBillForPayor(cid, payor);
      if (
        cBill &&
        !cBill.settledViaCycleId &&
        (directPaidInCycle.get(cid) || 0) === 0
      ) {
        const billPaid = Math.max(
          0,
          Number(cBill.totalPaidCentavos || cBill.paidCentavos || 0),
        );
        if (billPaid > (allocatedPaidByCycle.get(cid) || 0)) {
          allocatedPaidByCycle.set(cid, billPaid);
        }
      }
    }

    // Pass 2: Chronological FIFO rollover spillover from newer cycles with excess payment to older unpaid cycles
    for (let k = 0; k < orderedCycleIdsOldestFirst.length; k++) {
      const cidK = orderedCycleIdsOldestFirst[k];
      const grossK = grossShareByCycle.get(cidK) || 0;
      const paidK = allocatedPaidByCycle.get(cidK) || 0;
      let excess = Math.max(0, paidK - grossK);
      if (excess <= 0) continue;

      for (let j = 0; j < k; j++) {
        if (excess <= 0) break;
        const cidJ = orderedCycleIdsOldestFirst[j];
        const grossJ = grossShareByCycle.get(cidJ) || 0;
        const paidJ = allocatedPaidByCycle.get(cidJ) || 0;
        const needJ = Math.max(0, grossJ - paidJ);
        if (needJ <= 0) continue;

        const spill = Math.min(excess, needJ);
        allocatedPaidByCycle.set(cidJ, paidJ + spill);
        allocatedPaidByCycle.set(
          cidK,
          Math.max(0, (allocatedPaidByCycle.get(cidK) || 0) - spill),
        );
        excess -= spill;
        const kTouches = paymentsTouchingCycle.get(cidK) || [];
        kTouches.forEach((pmt) => recordPaymentTouch(cidJ, pmt));
      }
    }

    // Step D: Evaluate per-cycle settlement and cumulative unpaid arrears
    let cumulativeUnpaidPrior = 0;
    let cumulativePriorGross = 0;

    for (const cid of orderedCycleIdsOldestFirst) {
      const gross = grossShareByCycle.get(cid) || 0;
      const unpaidSplits = unpaidSplitShareByCycle.get(cid) || 0;
      const allocPaid = allocatedPaidByCycle.get(cid) || 0;
      const paidInCyc = directPaidInCycle.get(cid) || 0;
      const cycleBill = getCycleBillForPayor(cid, payor);

      let settledViaLaterBill = false;
      let resolvedSettledViaCid: string | undefined =
        cycleBill?.settledViaCycleId
          ? String(cycleBill.settledViaCycleId)
          : undefined;

      if (resolvedSettledViaCid && cycleBill?.status === "PAID") {
        settledViaLaterBill = true;
      }

      if (!settledViaLaterBill) {
        for (const mb of allBills) {
          if (!mb) continue;
          const mbCid = String(mb.billingCycleId || "").trim();
          if (!mbCid || mbCid === cid) continue;
          if (!matchesMemberUid(payor, mb.userId || mb.memberId || mb.billId)) {
            continue;
          }
          const matchingArr = Array.isArray(mb.lineItems)
            ? mb.lineItems.find(
                (li: any) =>
                  (li?.category === "Arrears" || li?.isArrears) &&
                  String(li?.priorCycleId || "") === cid,
              )
            : null;
          if (matchingArr) {
            const arrPaid = Boolean(
              matchingArr.status === "PAID" ||
              matchingArr.isSettled ||
              (mb.status === "PAID" &&
                Number(mb.outstandingCentavos || 0) === 0 &&
                Number(mb.totalPaidCentavos || mb.paidCentavos || 0) > 0),
            );
            if (arrPaid) {
              settledViaLaterBill = true;
              resolvedSettledViaCid = mbCid;
              break;
            }
          }
        }
      }

      const isCycleBillExplicitlyPaid = Boolean(
        cycleBill &&
        cycleBill.status === "PAID" &&
        Number(cycleBill.outstandingCentavos || 0) === 0 &&
        (Number(cycleBill.totalPaidCentavos || cycleBill.paidCentavos || 0) >
          0 ||
          Boolean(cycleBill.settledViaCycleId)),
      );

      let settledArrearsInCycleCentavos = 0;
      if (cycleBill && Array.isArray(cycleBill.lineItems)) {
        for (const li of cycleBill.lineItems) {
          if (
            (li?.category === "Arrears" || li?.isArrears) &&
            !li?.isExempt &&
            (li?.status === "PAID" ||
              li?.isSettled ||
              isCycleBillExplicitlyPaid)
          ) {
            settledArrearsInCycleCentavos += Math.max(
              0,
              Number(li.amountCentavos) || 0,
            );
          }
        }
      }

      let remainingCycleCentavos = 0;
      if (gross > 0) {
        if (
          allSplitsMarkedPaidByCycle.get(cid) ||
          isCycleBillExplicitlyPaid ||
          settledViaLaterBill ||
          allocPaid >= gross
        ) {
          remainingCycleCentavos = 0;
        } else {
          remainingCycleCentavos = Math.min(
            unpaidSplits,
            Math.max(0, gross - allocPaid),
          );
        }
      }

      const touches = paymentsTouchingCycle.get(cid) || [];
      const matchedPayment =
        touches.length > 0 ? touches[touches.length - 1] : undefined;

      const settledViaRollover = Boolean(
        settledViaLaterBill ||
        (matchedPayment &&
          matchedPayment.billingCycleId &&
          matchedPayment.billingCycleId !== "general" &&
          matchedPayment.billingCycleId !== cid),
      );

      const isCycleSettled =
        gross > 0
          ? remainingCycleCentavos === 0
          : settledArrearsInCycleCentavos > 0 || paidInCyc > 0;

      if (isCycleSettled) {
        const set = settledPayorUidsByCycle.get(cid);
        if (set) {
          set.add(cleanUid);
          if (rawPrimaryId) set.add(rawPrimaryId);
          if (payor.userId) set.add(String(payor.userId));
          if (payor.memberId) set.add(String(payor.memberId));
        }
      }

      const priorUnpaidArrearsCentavos = cumulativeUnpaidPrior;
      const totalOwesAsOfCycleCentavos =
        remainingCycleCentavos + priorUnpaidArrearsCentavos;
      const isFullySettledAsOfCycle =
        totalOwesAsOfCycleCentavos === 0 &&
        (gross > 0 || settledArrearsInCycleCentavos > 0 || paidInCyc > 0);

      const summary: MemberCycleSettlementSummary = {
        cycleId: cid,
        userId: cleanUid,
        grossShareCentavos: gross,
        unpaidSplitShareCentavos: unpaidSplits,
        allocatedPaidCentavos: allocPaid,
        allocatedPaidInCycleCentavos: paidInCyc,
        settledArrearsInCycleCentavos,
        remainingCycleCentavos,
        priorUnpaidArrearsCentavos,
        totalPriorGrossCentavos: cumulativePriorGross,
        totalOwesAsOfCycleCentavos,
        isCycleSettled,
        isFullySettledAsOfCycle,
        settledViaRollover,
        settledViaCycleId:
          resolvedSettledViaCid ||
          (settledViaRollover ? matchedPayment?.billingCycleId : undefined),
        matchedPayment,
      };

      summaryMap.set(`${cid}__${cleanUid}`, summary);
      cumulativeUnpaidPrior += remainingCycleCentavos;
      cumulativePriorGross += gross;
    }
  }

  const allPayorsSettledByCycle = new Map<string, boolean>();
  for (const cid of orderedCycleIdsOldestFirst) {
    const cycExps = expensesByCycle.get(cid) || [];
    const hasPositiveExpense = cycExps.some(
      (e) => (Number(e.amountCents) || 0) > 0,
    );
    if (!hasPositiveExpense || effectivePayors.length === 0) {
      allPayorsSettledByCycle.set(cid, false);
      continue;
    }
    const allDone = effectivePayors.every((p) => {
      const cUid = normalizeCleanUid(getMemberPrimaryId(p));
      const sum = summaryMap.get(`${cid}__${cUid}`);
      if (!sum) return false;
      if (sum.grossShareCentavos <= 0) return true;
      return sum.remainingCycleCentavos === 0 && sum.isCycleSettled;
    });
    allPayorsSettledByCycle.set(cid, allDone);
  }

  const resolveCleanUid = (memberOrUid: any): string => {
    if (!memberOrUid) return "";
    if (typeof memberOrUid === "string") return normalizeCleanUid(memberOrUid);
    return normalizeCleanUid(getMemberPrimaryId(memberOrUid));
  };

  const getMemberCycleSummary = (
    cycleId: string | undefined | null,
    memberOrUid: any,
  ): MemberCycleSettlementSummary => {
    const cleanUid = resolveCleanUid(memberOrUid);
    const rawCid = String(cycleId || "").trim();
    const targetCid =
      rawCid && knownCycleIds.has(rawCid) ? rawCid : newestCycleId;
    const found = summaryMap.get(`${targetCid}__${cleanUid}`);
    if (found) return found;
    return {
      cycleId: targetCid,
      userId: cleanUid,
      grossShareCentavos: 0,
      unpaidSplitShareCentavos: 0,
      allocatedPaidCentavos: 0,
      allocatedPaidInCycleCentavos: 0,
      settledArrearsInCycleCentavos: 0,
      remainingCycleCentavos: 0,
      priorUnpaidArrearsCentavos: 0,
      totalPriorGrossCentavos: 0,
      totalOwesAsOfCycleCentavos: 0,
      isCycleSettled: false,
      isFullySettledAsOfCycle: false,
      settledViaRollover: false,
    };
  };

  const getPriorUnpaidArrearsBeforeCycle = (
    cycleId: string | undefined | null,
    memberOrUid: any,
  ): number => {
    return getMemberCycleSummary(cycleId, memberOrUid)
      .priorUnpaidArrearsCentavos;
  };

  const getMatchedPaymentForExpense = (
    exp: MobileExpense,
    memberOrUid: any,
  ): MobilePayment | undefined => {
    const cleanUid = resolveCleanUid(memberOrUid);
    if (!cleanUid) return undefined;
    const splits = Array.isArray(exp.splitDetails) ? exp.splitDetails : [];
    const splitEntry: any = splits.find((s: any) =>
      matchesMemberUid({ userId: cleanUid }, s?.userId || s?.memberId || s?.id),
    );
    if (splitEntry?.paymentId) {
      const exactById = allPayments.find(
        (pmt) =>
          pmt.paymentId === splitEntry.paymentId && pmt.status !== "REJECTED",
      );
      if (exactById) return exactById;
    }

    const byBreakdownId = allPayments.find(
      (pmt) =>
        pmt.status !== "REJECTED" &&
        matchesMemberUid({ userId: cleanUid }, pmt.userId) &&
        Array.isArray(pmt.breakdownItems) &&
        pmt.breakdownItems.some(
          (bi) =>
            bi.id === exp.id ||
            (exp.billingCycleId && bi.cycleId === exp.billingCycleId),
        ),
    );
    if (byBreakdownId) return byBreakdownId;

    const rawCid = String(exp?.billingCycleId || "").trim();
    const targetCid =
      rawCid && knownCycleIds.has(rawCid) ? rawCid : oldestCycleId;
    return summaryMap.get(`${targetCid}__${cleanUid}`)?.matchedPayment;
  };

  return {
    orderedCycleIdsOldestFirst,
    settledPayorUidsByCycle,
    allPayorsSettledByCycle,
    getMemberCycleSummary,
    getPriorUnpaidArrearsBeforeCycle,
    getMatchedPaymentForExpense,
  };
}

const _reconcileArrearsInFlight = new Map<string, number>();

export function isCyclePaymentsLocked(cycle?: any, household?: any): boolean {
  if (cycle) {
    if (cycle.paymentsLocked === true) return true;
    if (cycle.isFinalized === true || cycle.paymentsOpenedByHost === true) {
      return false;
    }
    return true;
  }
  if (household) {
    if (household.paymentsLocked === true) return true;
    if (household.paymentsOpenedByHost === true) return false;
  }
  return true;
}

function sanitizeData<T>(val: T): T {
  if (val === null || val === undefined) {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeData(item)) as unknown as T;
  }
  if (typeof val === "object" && !(val instanceof Date)) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        clean[k] = sanitizeData(v);
      }
    }
    return clean as T;
  }
  return val;
}

const _recalcInFlight = new Map<string, Promise<number>>();
const _recalcPendingCycle = new Map<string, string | undefined>();

function normalizeHostApplication(docId: string, raw: any): any {
  const appId = raw?.applicationId || raw?.id || docId;
  const applicantPhone = (raw?.phoneNumber || raw?.applicantPhone || "").trim();
  const reason = (
    raw?.reasonForApplying ||
    raw?.reason ||
    raw?.notes ||
    ""
  ).trim();
  const email = (raw?.userEmail || raw?.applicantEmail || "").trim();
  const date =
    raw?.createdAt ||
    raw?.submittedAt ||
    raw?.requestedAt ||
    new Date().toISOString();
  const address = (raw?.propertyAddress || raw?.address || "").trim();
  const propName = (
    raw?.propertyName ||
    raw?.householdName ||
    raw?.apartmentName ||
    address ||
    "Proposed Household"
  ).trim();

  return {
    ...raw,
    id: appId,
    applicationId: appId,
    userId: raw?.userId || "",
    applicantName: (
      raw?.applicantName ||
      raw?.displayName ||
      "Resident Applicant"
    ).trim(),
    applicantEmail: email,
    userEmail: email,
    applicantPhone,
    phoneNumber: applicantPhone,
    managementType: (
      raw?.managementType || "Primary Leaseholder / Master Tenant"
    ).trim(),
    selectedHouseholdId: (raw?.selectedHouseholdId || "").trim(),
    roommateGroupName: (
      raw?.roommateGroupName ||
      raw?.householdName ||
      ""
    ).trim(),
    propertyName: propName,
    propertyAddress: address,
    unitOrRoom: (raw?.unitOrRoom || "").trim(),
    monthlyRentOrShare: raw?.monthlyRentOrShare
      ? Number(raw.monthlyRentOrShare)
      : raw?.estimatedMonthlyBills
        ? Number(raw.estimatedMonthlyBills)
        : undefined,
    estimatedMonthlyBills: raw?.estimatedMonthlyBills
      ? Number(raw.estimatedMonthlyBills)
      : raw?.monthlyRentOrShare
        ? Number(raw.monthlyRentOrShare)
        : undefined,
    city: (raw?.city || "").trim(),
    estimatedRoommates: raw?.estimatedRoommates ?? 4,
    reason,
    reasonForApplying: reason,
    experience: (raw?.experience || raw?.propertyExperience || "").trim(),
    propertyExperience: (
      raw?.propertyExperience ||
      raw?.experience ||
      ""
    ).trim(),
    status: raw?.status || "PENDING",
    reviewedBy: raw?.reviewedBy,
    reviewerName: raw?.reviewerName,
    reviewNotes: raw?.reviewNotes || raw?.adminFeedback,
    adminFeedback: raw?.adminFeedback || raw?.reviewNotes,
    submittedAt: date,
    createdAt: date,
    reviewedAt: raw?.reviewedAt,
  };
}

let _cachedUserProfile: any = null;
let _cachedHousehold: any = null;
let _cachedReadNotificationIdsByUser: Record<
  string,
  Record<string, boolean>
> = {};
const _readNotificationSubscribers = new Map<
  (readIds: Record<string, boolean>) => void,
  string | undefined
>();
const _syncedCloudNotifIds = new Set<string>();

function getUserReadMap(uid?: string): Record<string, boolean> {
  const effectiveUid = (uid || auth.currentUser?.uid || "").trim();
  if (!effectiveUid) return {};
  if (!_cachedReadNotificationIdsByUser[effectiveUid]) {
    _cachedReadNotificationIdsByUser[effectiveUid] = {};
  }
  return _cachedReadNotificationIdsByUser[effectiveUid];
}

function mergeUserReadMap(
  uid: string | undefined,
  incoming: Record<string, boolean> | undefined | null,
): boolean {
  const effectiveUid = (uid || auth.currentUser?.uid || "").trim();
  if (!effectiveUid || !incoming || typeof incoming !== "object") {
    return false;
  }
  const prefix = `v2_${effectiveUid}_`;
  const current = getUserReadMap(effectiveUid);
  let changed = false;
  Object.entries(incoming).forEach(([k, val]) => {
    if (val === true && k.startsWith(prefix) && !current[k]) {
      current[k] = true;
      changed = true;
    }
  });
  return changed;
}

function notifyReadSubscribers(targetUid?: string) {
  _readNotificationSubscribers.forEach((subUid, cb) => {
    const effectiveSubUid = (subUid || auth.currentUser?.uid || "").trim();
    if (targetUid && effectiveSubUid && effectiveSubUid !== targetUid) {
      return;
    }
    try {
      cb({ ...getUserReadMap(effectiveSubUid) });
    } catch {}
  });
}

export const mobileDataService = {
  getCachedProfile(uid?: string): any {
    if (!uid) return null;
    if (_cachedUserProfile && _cachedUserProfile.uid !== uid) {
      return null;
    }
    return _cachedUserProfile;
  },
  setCachedProfile(p: any) {
    _cachedUserProfile = p;
    const pUid = p?.uid || auth.currentUser?.uid;
    if (
      pUid &&
      p?.readNotificationIdsV2 &&
      typeof p.readNotificationIdsV2 === "object"
    ) {
      if (mergeUserReadMap(pUid, p.readNotificationIdsV2)) {
        notifyReadSubscribers(pUid);
      }
    }
  },
  getCachedHousehold(): any {
    return _cachedHousehold;
  },
  setCachedHousehold(h: any) {
    _cachedHousehold = h;
  },
  getCachedReadNotifications(uid?: string): Record<string, boolean> {
    const effectiveUid = (uid || auth.currentUser?.uid || "").trim();
    if (!effectiveUid) return {};
    if (
      _cachedUserProfile &&
      _cachedUserProfile.uid === effectiveUid &&
      _cachedUserProfile.readNotificationIdsV2 &&
      typeof _cachedUserProfile.readNotificationIdsV2 === "object"
    ) {
      mergeUserReadMap(effectiveUid, _cachedUserProfile.readNotificationIdsV2);
    }
    return { ...getUserReadMap(effectiveUid) };
  },
  resolveCycleWaterConfig(
    waterConfig: any | null | undefined,
    cycleId?: string | null,
    options?: {
      cycleWaterExpense?: any | null;
      payorCount?: number;
      hasCycleAttendance?: boolean;
      totalCyclesCount?: number;
    },
  ): CycleWaterConfig | null {
    return resolveCycleWaterConfig(waterConfig, cycleId, options);
  },
  computeCycleWaterBreakdown(
    activeMembers: any[],
    cycleAttendance: any[] = [],
    attendanceSubmissions: Record<string, any> | any[] = {},
    rateCentavosPerDay: number = 500,
    existingSplitDetails?: any[],
  ) {
    return computeCycleWaterBreakdown(
      activeMembers,
      cycleAttendance,
      attendanceSubmissions,
      rateCentavosPerDay,
      existingSplitDetails,
    );
  },
  clearCache() {
    _cachedUserProfile = null;
    _cachedHousehold = null;
    _cachedReadNotificationIdsByUser = {};
    _syncedCloudNotifIds.clear();
    _readNotificationSubscribers.clear();
  },
  async submitHostApplication(data: {
    userId: string;
    applicantName: string;
    applicantEmail?: string;
    userEmail?: string;
    applicantPhone?: string;
    phoneNumber?: string;
    managementType?: string;
    selectedHouseholdId?: string;
    roommateGroupName?: string;
    propertyName?: string;
    propertyAddress: string;
    unitOrRoom?: string;
    monthlyRentOrShare?: number;
    estimatedMonthlyBills?: number;
    city?: string;
    estimatedRoommates?: number;
    reason?: string;
    reasonForApplying?: string;
    experience?: string;
    propertyExperience?: string;
    status?: string;
  }): Promise<string> {
    const applicationId = `host_app_${data.userId}`;
    const now = new Date().toISOString();
    const effectivePhone = (
      data.phoneNumber ||
      data.applicantPhone ||
      ""
    ).trim();
    const effectiveReason = (
      data.reasonForApplying ||
      data.reason ||
      ""
    ).trim();
    const effectiveEmail = (data.userEmail || data.applicantEmail || "").trim();
    const effectiveAddress = (data.propertyAddress || "").trim();
    const effectiveName = (data.applicantName || "Resident Applicant").trim();
    const effectivePropName = (
      data.propertyName ||
      effectiveAddress ||
      "Proposed Household"
    ).trim();
    const effectiveBills =
      data.estimatedMonthlyBills !== undefined
        ? data.estimatedMonthlyBills
        : data.monthlyRentOrShare;
    const effectiveExp = (
      data.propertyExperience ||
      data.experience ||
      ""
    ).trim();
    const effectiveMgmtType = (
      data.managementType || "Primary Leaseholder / Master Tenant"
    ).trim();

    const payload = {
      id: applicationId,
      applicationId,
      userId: data.userId,
      applicantName: effectiveName,
      applicantEmail: effectiveEmail,
      userEmail: effectiveEmail,
      applicantPhone: effectivePhone,
      phoneNumber: effectivePhone,
      managementType: effectiveMgmtType,
      selectedHouseholdId: (data.selectedHouseholdId || "").trim(),
      roommateGroupName: (data.roommateGroupName || "").trim(),
      propertyAddress: effectiveAddress,
      unitOrRoom: (data.unitOrRoom || "").trim(),
      monthlyRentOrShare: effectiveBills,
      estimatedMonthlyBills: effectiveBills,
      city: (data.city || "").trim(),
      estimatedRoommates: data.estimatedRoommates ?? 4,
      reason: effectiveReason,
      reasonForApplying: effectiveReason,
      experience: effectiveExp,
      propertyExperience: effectiveExp,
      status: data.status || "PENDING",
      submittedAt: now,
      createdAt: now,
    };

    const cleanPayload = sanitizeData(payload);
    await setDoc(doc(db, "hostApplications", applicationId), cleanPayload, {
      merge: true,
    });

    try {
      await setDoc(
        doc(db, "users", data.userId),
        {
          hostApplicationStatus: "PENDING",
          hostApplicationId: applicationId,
          ...(effectivePhone ? { phoneNumber: effectivePhone } : {}),
          updatedDate: now,
        },
        { merge: true },
      );
    } catch (err) {
      console.warn(
        "[Firestore Mobile] Error updating user profile with hostApplicationId:",
        err,
      );
    }

    return applicationId;
  },

  async getUserHostApplication(userId: string): Promise<any | null> {
    if (!userId) return null;
    try {
      const docSnap = await getDoc(
        doc(db, "hostApplications", `host_app_${userId}`),
      );
      if (docSnap.exists()) {
        return normalizeHostApplication(docSnap.id, docSnap.data());
      }
      const legacySnap = await getDoc(doc(db, "host_requests", userId));
      if (legacySnap.exists()) {
        return normalizeHostApplication(legacySnap.id, legacySnap.data());
      }
      return null;
    } catch (err) {
      console.warn("[Firestore Mobile] getUserHostApplication error:", err);
      return null;
    }
  },

  listenToUserHostApplication(
    userId: string,
    callback: (app: any | null) => void,
  ) {
    if (!userId) {
      callback(null);
      return () => undefined;
    }
    const ref = doc(db, "hostApplications", `host_app_${userId}`);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          callback(normalizeHostApplication(snap.id, snap.data()));
        } else {
          callback(null);
        }
      },
      (err) => {
        console.warn(
          "[Firestore Mobile] listenToUserHostApplication error:",
          err,
        );
        // Always invoke callback so loading state finishes
        callback(null);
      },
    );
  },

  async requestHostApproval(data: {
    householdName?: string;
    apartmentName?: string;
    address?: string;
    notes?: string;
  }): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    await this.submitHostApplication({
      userId: user.uid,
      applicantName: user.displayName || user.email || "Resident",
      applicantEmail: user.email || "",
      propertyName:
        data.householdName || data.apartmentName || "My Co-Living Space",
      propertyAddress: data.address || "",
      estimatedRoommates: 4,
      reason: data.notes || "Host application submitted during onboarding",
    });
  },

  // --- SUPER ADMIN GOVERNANCE SUITE ---
  listenToHostApplications(callback: (apps: any[]) => void) {
    const colRef = collection(db, "hostApplications");
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => {
          list.push(normalizeHostApplication(d.id, d.data()));
        });
        list.sort((a, b) =>
          String(b.submittedAt || b.createdAt || "").localeCompare(
            String(a.submittedAt || a.createdAt || ""),
          ),
        );
        callback(list);
      },
      (err) => {
        console.warn("[Firestore Mobile] listenToHostApplications error:", err);
        callback([]);
      },
    );
  },

  async reviewHostApplication(
    applicationId: string,
    status: "APPROVED" | "REJECTED",
    reviewNotes?: string,
    reviewerName?: string,
  ): Promise<void> {
    const reviewerId = auth.currentUser?.uid || "super_admin";
    const now = new Date().toISOString();

    const appRef = doc(db, "hostApplications", applicationId);
    const appSnap = await getDoc(appRef);
    const appData = appSnap.exists() ? appSnap.data() : null;
    const applicantUserId =
      appData?.userId || applicationId.replace("host_app_", "");

    const feedbackText =
      reviewNotes ||
      (status === "APPROVED"
        ? "Application approved by Super Admin"
        : "Application rejected by Super Admin");

    await updateDoc(appRef, {
      status,
      reviewedBy: reviewerId,
      reviewerName:
        reviewerName || auth.currentUser?.displayName || "Super Admin",
      reviewNotes: feedbackText,
      adminFeedback: feedbackText,
      reviewedAt: now,
    });

    if (status === "APPROVED") {
      await updateDoc(doc(db, "users", applicantUserId), {
        role: "HOST",
        hostApplicationStatus: "APPROVED",
        updatedDate: now,
      });
    } else {
      await updateDoc(doc(db, "users", applicantUserId), {
        hostApplicationStatus: "REJECTED",
        updatedDate: now,
      });
    }

    // Record audit log
    await this.recordAdminAuditLog({
      action:
        status === "APPROVED"
          ? "HOST_APPLICATION_APPROVE"
          : "HOST_APPLICATION_REJECT",
      entity: "host_application",
      entityId: applicationId,
      previousValue: { status: appData?.status || "PENDING" },
      newValue: { status, reviewNotes: feedbackText },
      reason: feedbackText,
    });
  },

  listenToAllUsers(callback: (users: any[]) => void) {
    const colRef = collection(db, "users");
    return onSnapshot(
      colRef,
      (snapshot) => {
        const users: any[] = [];
        snapshot.forEach((d) => {
          users.push({ uid: d.id, ...d.data() });
        });
        users.sort((a, b) =>
          String(b.createdDate || "").localeCompare(
            String(a.createdDate || ""),
          ),
        );
        callback(users);
      },
      (err) => {
        console.warn("[Firestore Mobile] listenToAllUsers error:", err);
        callback([]);
      },
    );
  },

  async setUserAccountStatus(
    userId: string,
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
    reason?: string,
  ): Promise<void> {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    const prevStatus = snap.exists() ? snap.data().accountStatus : "ACTIVE";
    const now = new Date().toISOString();

    await updateDoc(userRef, {
      accountStatus: status,
      updatedDate: now,
    });

    await this.recordAdminAuditLog({
      action: "USER_STATUS_CHANGE",
      entity: "user",
      entityId: userId,
      previousValue: { status: prevStatus },
      newValue: { status },
      reason: reason || `Status set to ${status}`,
    });
  },

  async updateUserRole(
    userId: string,
    role: "SUPER_ADMIN" | "HOST" | "PAYOR" | "NON_PAYOR",
    reason?: string,
  ): Promise<void> {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    const prevRole = snap.exists() ? snap.data().role : "PAYOR";
    const now = new Date().toISOString();

    await updateDoc(userRef, {
      role,
      updatedDate: now,
    });

    await this.recordAdminAuditLog({
      action: "USER_ROLE_CHANGE",
      entity: "user",
      entityId: userId,
      previousValue: { role: prevRole },
      newValue: { role },
      reason: reason || `Role elevated/changed to ${role}`,
    });
  },

  listenToAllHouseholds(callback: (households: any[]) => void) {
    const colRef = collection(db, "households");
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => {
          list.push({ householdId: d.id, id: d.id, ...d.data() });
        });
        list.sort((a, b) =>
          String(b.createdDate || "").localeCompare(
            String(a.createdDate || ""),
          ),
        );
        callback(list);
      },
      (err) => {
        console.warn("[Firestore Mobile] listenToAllHouseholds error:", err);
        callback([]);
      },
    );
  },

  async setHouseholdStatus(
    householdId: string,
    status: "ACTIVE" | "ARCHIVED",
    reason?: string,
  ): Promise<void> {
    const ref = doc(db, "households", householdId);
    const snap = await getDoc(ref);
    const prevStatus = snap.exists() ? snap.data().status : "ACTIVE";
    const now = new Date().toISOString();

    await updateDoc(ref, {
      status,
      updatedDate: now,
    });

    await this.recordAdminAuditLog({
      action: "HOUSEHOLD_STATUS_CHANGE",
      entity: "household",
      entityId: householdId,
      previousValue: { status: prevStatus },
      newValue: { status },
      reason: reason || `Household status set to ${status}`,
    });
  },

  async recordAdminAuditLog(data: {
    action: string;
    entity: string;
    entityId: string;
    previousValue?: any;
    newValue?: any;
    reason?: string;
  }): Promise<void> {
    try {
      const now = new Date().toISOString();
      const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const actorId = auth.currentUser?.uid || "super_admin";
      const actorName =
        auth.currentUser?.displayName ||
        auth.currentUser?.email ||
        "Super Admin";

      await setDoc(doc(db, "auditLogs", logId), {
        logId,
        actorId,
        actorName,
        role: "SUPER_ADMIN",
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        timestamp: now,
        previousValue: data.previousValue || null,
        newValue: data.newValue || null,
        reason: data.reason || "",
      });
    } catch (err) {
      console.warn("[Firestore Mobile] recordAdminAuditLog error:", err);
    }
  },

  listenToAuditLogs(limitCount = 50, callback: (logs: any[]) => void) {
    try {
      const q = query(
        collection(db, "auditLogs"),
        orderBy("timestamp", "desc"),
        limit(limitCount),
      );
      return onSnapshot(
        q,
        (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
          callback(list);
        },
        (err) => {
          console.warn("[Firestore Mobile] listenToAuditLogs error:", err);
          callback([]);
        },
      );
    } catch (err) {
      console.warn("[Firestore Mobile] listenToAuditLogs query error:", err);
      callback([]);
      return () => undefined;
    }
  },

  listenToPlatformSettings(callback: (settings: any) => void) {
    const defaultSettings = {
      maintenanceMode: false,
      maintenanceMessage: "",
      announcementBanner: "",
      minSupportedVersion: "1.0.0",
      latestVersion: "1.2.0",
      forceUpdate: false,
    };

    let unsubSecondary: (() => void) | null = null;
    let unsubPrimary: (() => void) | null = null;
    let didSecondaryTrigger = false;

    try {
      const primaryRef = doc(db, "platform_settings", "global");
      unsubPrimary = onSnapshot(
        primaryRef,
        (snap) => {
          if (snap.exists()) {
            callback(snap.data());
          } else {
            callback(defaultSettings);
          }
        },
        (err) => {
          // If primary path encountered permission-denied or error, fall back to systemSettings/platform
          if (!didSecondaryTrigger) {
            didSecondaryTrigger = true;
            try {
              const secondaryRef = doc(db, "systemSettings", "platform");
              unsubSecondary = onSnapshot(
                secondaryRef,
                (snap2) => {
                  if (snap2.exists()) {
                    callback(snap2.data());
                  } else {
                    callback(defaultSettings);
                  }
                },
                () => {
                  // Fall back smoothly to defaults without error
                  callback(defaultSettings);
                },
              );
            } catch {
              callback(defaultSettings);
            }
          }
        },
      );

      return () => {
        if (unsubPrimary) {
          try {
            unsubPrimary();
          } catch {}
        }
        if (unsubSecondary) {
          try {
            unsubSecondary();
          } catch {}
        }
      };
    } catch {
      callback(defaultSettings);
      return () => undefined;
    }
  },

  async updatePlatformSettings(settings: any): Promise<void> {
    const now = new Date().toISOString();
    const payload = {
      ...settings,
      updatedAt: now,
      updatedBy: auth.currentUser?.uid || "super_admin",
    };
    try {
      await setDoc(doc(db, "platform_settings", "global"), payload, {
        merge: true,
      });
    } catch (e) {
      console.warn(
        "[updatePlatformSettings] platform_settings write fallback notice:",
        e,
      );
    }
    try {
      await setDoc(doc(db, "systemSettings", "platform"), payload, {
        merge: true,
      });
    } catch (e) {
      console.warn(
        "[updatePlatformSettings] systemSettings write fallback notice:",
        e,
      );
    }
    await this.recordAdminAuditLog({
      action: "PLATFORM_SETTINGS_UPDATE",
      entity: "platform_settings",
      entityId: "global",
      newValue: settings,
      reason: "Updated system platform settings",
    });
  },

  async broadcastAnnouncement(data: {
    id?: string;
    title: string;
    message: string;
    priority?: "INFO" | "ALERT" | "UPDATE" | "EVENT";
    actionLabel?: string;
    actionTarget?: string;
    expiresAt?: string;
    isActive?: boolean;
  }): Promise<string> {
    const now = new Date().toISOString();
    const id = data.id || `ann_${Date.now()}`;
    const payload = {
      id,
      title: data.title.trim(),
      message: data.message.trim(),
      priority: data.priority || "INFO",
      actionLabel: data.actionLabel?.trim() || "",
      actionTarget: data.actionTarget?.trim() || "notifications",
      createdAt: now,
      updatedAt: now,
      createdBy: auth.currentUser?.uid || "super_admin",
      authorName: auth.currentUser?.displayName || "Super Admin",
      isActive: data.isActive !== false,
      expiresAt: data.expiresAt || null,
    };

    // 1. Write to systemAnnouncements collection
    try {
      await setDoc(doc(db, "systemAnnouncements", id), payload, {
        merge: true,
      });
    } catch (e) {
      console.warn(
        "[broadcastAnnouncement] systemAnnouncements write warning:",
        e,
      );
    }

    // 2. Sync to platform_settings/global so clients get instant real-time event
    try {
      await setDoc(
        doc(db, "platform_settings", "global"),
        {
          announcementBanner: payload.message,
          latestAnnouncement: payload,
          updatedAt: now,
        },
        { merge: true },
      );
    } catch (e) {
      console.warn(
        "[broadcastAnnouncement] platform_settings fallback notice:",
        e,
      );
    }

    // 3. Post a broadcast notification doc so all user notification inboxes get the item permanently
    try {
      await setDoc(
        doc(db, "notifications", `broadcast_${id}`),
        {
          id: `broadcast_${id}`,
          notificationId: `broadcast_${id}`,
          recipientId: "ALL",
          isBroadcast: true,
          type: "ANNOUNCEMENT",
          category: "announcement",
          title: payload.title,
          message: payload.message,
          relatedItemId: id,
          priority: payload.priority,
          actionLabel: payload.actionLabel,
          actionTarget: payload.actionTarget,
          createdTimestamp: now,
          data: { announcementId: id, ...payload },
        },
        { merge: true },
      );
    } catch (e) {
      console.warn(
        "[broadcastAnnouncement] broadcast notification write warning:",
        e,
      );
    }

    // 4. Log to audit logs
    await this.recordAdminAuditLog({
      action: "BROADCAST_ANNOUNCEMENT",
      entity: "systemAnnouncements",
      entityId: id,
      newValue: payload,
      reason: `Broadcasted announcement: ${payload.title}`,
    });

    return id;
  },

  listenToSystemAnnouncements(callback: (announcements: any[]) => void) {
    try {
      const colRef = collection(db, "systemAnnouncements");
      return onSnapshot(
        colRef,
        (snap) => {
          const list: any[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...d.data() });
          });
          list.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
          );
          callback(list);
        },
        (err) => {
          console.warn(
            "[Firestore Mobile] listenToSystemAnnouncements warning:",
            err,
          );
          callback([]);
        },
      );
    } catch {
      callback([]);
      return () => {};
    }
  },

  async deleteSystemAnnouncement(announcementId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "systemAnnouncements", announcementId));
    } catch (e) {
      console.warn(
        "[deleteSystemAnnouncement] systemAnnouncements delete notice:",
        e,
      );
    }
    try {
      await deleteDoc(doc(db, "notifications", `broadcast_${announcementId}`));
    } catch {}

    await this.recordAdminAuditLog({
      action: "DELETE_ANNOUNCEMENT",
      entity: "systemAnnouncements",
      entityId: announcementId,
      reason: `Deleted announcement ${announcementId}`,
    });
  },

  async toggleSystemAnnouncementActive(
    announcementId: string,
    isActive: boolean,
  ): Promise<void> {
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, "systemAnnouncements", announcementId), {
        isActive,
        updatedAt: now,
      });
    } catch (e) {
      console.warn("[toggleSystemAnnouncementActive] notice:", e);
    }

    await this.recordAdminAuditLog({
      action: "TOGGLE_ANNOUNCEMENT_STATUS",
      entity: "systemAnnouncements",
      entityId: announcementId,
      newValue: { isActive },
      reason: `Set announcement active=${isActive}`,
    });
  },

  listenToSupportTickets(callback: (tickets: any[]) => void) {
    const colRef = collection(db, "supportTickets");
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => list.push({ ticketId: d.id, ...d.data() }));
        list.sort((a, b) =>
          String(b.createdDate || "").localeCompare(
            String(a.createdDate || ""),
          ),
        );
        callback(list);
      },
      (err) => {
        console.warn("[Firestore Mobile] listenToSupportTickets error:", err);
        callback([]);
      },
    );
  },

  async updateSupportTicketStatus(
    ticketId: string,
    status: string,
  ): Promise<void> {
    const ref = doc(db, "supportTickets", ticketId);
    const now = new Date().toISOString();
    await updateDoc(ref, {
      status,
      updatedDate: now,
    });
    await this.recordAdminAuditLog({
      action: "SUPPORT_TICKET_STATUS_UPDATE",
      entity: "support_ticket",
      entityId: ticketId,
      newValue: { status },
      reason: `Support ticket status updated to ${status}`,
    });
  },

  // --- USER PROFILE ---
  async syncUserProfile(user: {
    uid: string;
    displayName: string;
    email: string;
    phoneNumber?: string;
    formattedPhone?: string;
    authMethod?: string;
    role?: string;
    householdId?: string;
    photoURL?: string;
  }): Promise<void> {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const existing = snap.exists() ? snap.data() : {};
    const preservedRole =
      user.email === "cebutitans07@gmail.com" ||
      existing.email === "cebutitans07@gmail.com" ||
      existing.role === "SUPER_ADMIN"
        ? "SUPER_ADMIN"
        : existing.role === "HOST" ||
            existing.hostApplicationStatus === "APPROVED" ||
            user.role === "HOST"
          ? "HOST"
          : existing.role || user.role || "PAYOR";

    const resolvedHouseholdId =
      existing.householdId !== undefined
        ? existing.householdId
        : user.householdId || undefined;

    await setDoc(
      userRef,
      sanitizeData({
        uid: user.uid,
        fullName: existing.fullName || user.displayName,
        displayName: user.displayName,
        email: user.email,
        phoneNumber: user.phoneNumber || existing.phoneNumber,
        formattedPhone: user.formattedPhone || existing.formattedPhone,
        authMethod: user.authMethod || existing.authMethod,
        role: preservedRole,
        accountStatus: existing.accountStatus || "ACTIVE",
        householdId: resolvedHouseholdId,
        hostApplicationStatus: existing.hostApplicationStatus,
        hostApplicationId: existing.hostApplicationId,
        createdDate: existing.createdDate || new Date().toISOString(),
        updatedDate: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      }),
      { merge: true },
    );
  },

  async getUserProfile(uid: string) {
    if (!uid) return null;
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return null;
      const data = snap.data();

      if (
        data.email === "cebutitans07@gmail.com" ||
        auth.currentUser?.email === "cebutitans07@gmail.com"
      ) {
        data.role = "SUPER_ADMIN";
      }

      // Promote to HOST if user has approved host application
      if (
        data.hostApplicationStatus === "APPROVED" &&
        data.role !== "SUPER_ADMIN"
      ) {
        data.role = "HOST";
      }

      // Verify if linked household exists in Firestore
      if (data.householdId) {
        try {
          const hhSnap = await getDoc(doc(db, "households", data.householdId));
          if (!hhSnap.exists()) {
            // Household was deleted in Firestore! Clean up stale pointers
            // IMPORTANT: If user was HOST or has approved host application, preserve HOST role!
            const isHost =
              data.role === "HOST" || data.hostApplicationStatus === "APPROVED";
            await updateDoc(userRef, {
              householdId: deleteField(),
              householdName: deleteField(),
              apartmentName: deleteField(),
              updatedDate: new Date().toISOString(),
              ...(isHost && data.role !== "SUPER_ADMIN"
                ? { role: "HOST" }
                : {}),
            }).catch(() => {});
            delete data.householdId;
            delete data.householdName;
            delete data.apartmentName;
            if (isHost && data.role !== "SUPER_ADMIN") {
              data.role = "HOST";
            }
          } else {
            const hhData = hhSnap.data();
            if (
              hhData &&
              hhData.hostId === uid &&
              data.role !== "SUPER_ADMIN"
            ) {
              data.role = "HOST";
              updateDoc(userRef, { role: "HOST" }).catch(() => {});
            }
          }
        } catch (hhErr) {
          console.warn("[Firestore Mobile] Household check err:", hhErr);
        }
      } else {
        try {
          const qHh = query(
            collection(db, "households"),
            where("hostId", "==", uid),
          );
          const hhDocs = await getDocs(qHh);
          if (!hhDocs.empty) {
            const hhData = hhDocs.docs[0].data();
            data.householdId = hhData.householdId;
            data.householdName = hhData.householdName || hhData.apartmentName;
            data.apartmentName = hhData.apartmentName;
            if (data.role !== "SUPER_ADMIN") {
              data.role = "HOST";
              updateDoc(userRef, {
                householdId: hhData.householdId,
                householdName: data.householdName,
                apartmentName: data.apartmentName,
                role: "HOST",
              }).catch(() => {});
            }
          }
        } catch (hhErr) {
          console.warn("[Firestore Mobile] host query err:", hhErr);
        }
      }

      if (data) {
        _cachedUserProfile = data;
        if (
          data.readNotificationIdsV2 &&
          typeof data.readNotificationIdsV2 === "object"
        ) {
          if (mergeUserReadMap(uid, data.readNotificationIdsV2)) {
            notifyReadSubscribers(uid);
          }
        }
      }
      return data;
    } catch (err) {
      console.warn("[Firestore Mobile] getUserProfile error:", err);
      return null;
    }
  },

  async saveUserProfile(profile: any): Promise<void> {
    if (!profile || !profile.uid) return;
    try {
      const userRef = doc(db, "users", profile.uid);
      await setDoc(userRef, sanitizeData(profile), { merge: true });
      if (_cachedUserProfile && _cachedUserProfile.uid === profile.uid) {
        _cachedUserProfile = { ..._cachedUserProfile, ...profile };
      }
    } catch (err) {
      console.warn("[saveUserProfile Mobile] Error:", err);
    }
  },

  async deleteUserProfile(uid: string): Promise<boolean> {
    if (!uid) return false;
    try {
      const cleanUid = String(uid).replace(/^mem_/, "").trim();
      const userRef = doc(db, "users", cleanUid);
      await deleteDoc(userRef);
      if (
        _cachedUserProfile &&
        (_cachedUserProfile.uid === cleanUid || _cachedUserProfile.uid === uid)
      ) {
        _cachedUserProfile = null;
      }
      return true;
    } catch (err) {
      console.warn("[deleteUserProfile Mobile] Error:", err);
      return false;
    }
  },

  listenToUserProfile(uid: string, callback: (data: any) => void) {
    if (!uid || typeof uid !== "string" || !uid.trim()) {
      callback(null);
      return () => undefined;
    }

    const safeUid = uid.trim();
    const userRef = doc(db, "users", safeUid);

    // Provide cached profile immediately so UI is responsive
    const cached = this.getCachedProfile(safeUid);
    if (cached) {
      callback(cached);
    }

    try {
      return onSnapshot(
        userRef,
        async (snap) => {
          if (!snap.exists()) {
            callback(null);
            return;
          }
          const data = snap.data();
          if (
            (data.email === "cebutitans07@gmail.com" ||
              auth.currentUser?.email === "cebutitans07@gmail.com") &&
            data.role !== "SUPER_ADMIN"
          ) {
            data.role = "SUPER_ADMIN";
          }
          if (
            data.hostApplicationStatus === "APPROVED" &&
            data.role !== "SUPER_ADMIN"
          ) {
            data.role = "HOST";
          }
          if (data.householdId) {
            try {
              const hhSnap = await getDoc(
                doc(db, "households", data.householdId),
              );
              if (!hhSnap.exists()) {
                // Household was deleted in Firestore - clean up in memory to prevent recursive snapshot loops
                const isHost =
                  data.role === "HOST" ||
                  data.hostApplicationStatus === "APPROVED";
                delete data.householdId;
                delete data.householdName;
                delete data.apartmentName;
                if (isHost && data.role !== "SUPER_ADMIN") {
                  data.role = "HOST";
                }
              } else {
                const hhData = hhSnap.data();
                if (
                  hhData &&
                  hhData.hostId === safeUid &&
                  data.role !== "SUPER_ADMIN"
                ) {
                  data.role = "HOST";
                }
              }
            } catch {
              // Ignore stale household lookup
            }
          }
          _cachedUserProfile = data;
          if (
            data.readNotificationIdsV2 &&
            typeof data.readNotificationIdsV2 === "object"
          ) {
            if (mergeUserReadMap(safeUid, data.readNotificationIdsV2)) {
              notifyReadSubscribers(safeUid);
            }
          }
          callback(data);
        },
        (err) => {
          if (err?.code === "permission-denied") {
            // Expected during sign out or before auth finishes restoring
            if (!auth.currentUser) {
              callback(null);
              return;
            }
            // Serve fallback cached profile if available to avoid flashing
            const fallback = this.getCachedProfile(safeUid);
            if (fallback) {
              callback(fallback);
              return;
            }
          }
          console.warn("[Firestore Mobile] listenToUserProfile:", err);
        },
      );
    } catch (e) {
      console.warn("[Firestore Mobile] listenToUserProfile setup notice:", e);
      return () => undefined;
    }
  },

  async ensureHostHousehold(uid: string, cachedProfile?: any): Promise<any> {
    if (cachedProfile) return cachedProfile;
    return this.getUserProfile(uid);
  },

  // --- HOUSEHOLD & MEMBERS ---
  async getHousehold(householdId: string): Promise<any | null> {
    if (!householdId) return null;
    try {
      const snap = await getDoc(doc(db, "households", householdId));
      if (snap.exists()) {
        const hh = {
          ...snap.data(),
          id: snap.id,
          householdId: snap.data().householdId || snap.id,
        };
        _cachedHousehold = hh;
        return hh;
      }
      return null;
    } catch (err) {
      console.warn("[Firestore Mobile] getHousehold err:", err);
      return _cachedHousehold || null;
    }
  },

  listenToHousehold(householdId: string, callback: (data: any) => void) {
    const docRef = doc(db, "households", householdId);
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const hh = snap.data();
          _cachedHousehold = hh;
          callback(hh);
        } else {
          _cachedHousehold = null;
          callback(null);
        }
      },
      (err) => console.warn("[Firestore Mobile] listenToHousehold:", err),
    );
  },

  listenToHouseholds(callback: (households: any[]) => void) {
    return onSnapshot(
      collection(db, "households"),
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => {
          list.push({
            ...d.data(),
            id: d.id,
            householdId: d.data().householdId || d.id,
          });
        });
        callback(list);
      },
      (err) => {
        console.warn("[Firestore Mobile] listenToHouseholds err:", err);
        callback([]);
      },
    );
  },

  async getHouseholds(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, "households"));
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({
          ...d.data(),
          id: d.id,
          householdId: d.data().householdId || d.id,
        });
      });
      return list;
    } catch (err) {
      console.warn("[Firestore Mobile] getHouseholds err:", err);
      return [];
    }
  },

  listenToHouseholdMembers(
    householdId: string,
    callback: (members: any[]) => void,
    options?: { includePending?: boolean },
  ) {
    const q = collection(db, `households/${householdId}/members`);
    return onSnapshot(
      q,
      async (snap) => {
        const rawItems: any[] = [];
        const seen = new Set<string>();
        const missingPhotoUids: string[] = [];

        snap.forEach((d) => {
          const data = d.data();
          const uid = data.userId || data.memberId || d.id;

          const statusUpper = String(data.status || "").toUpperCase();
          const joinStatusUpper = String(
            data.joinRequestStatus || "",
          ).toUpperCase();

          // Strictly filter out any rejected, declined, inactive, or removed applicants
          const isRejected =
            statusUpper === "REJECTED" ||
            statusUpper === "DECLINED" ||
            statusUpper === "REMOVED" ||
            statusUpper === "INACTIVE" ||
            statusUpper === "CANCELLED" ||
            joinStatusUpper === "REJECTED" ||
            joinStatusUpper === "DECLINED" ||
            joinStatusUpper === "REMOVED" ||
            Boolean(data.rejectionReason) ||
            Boolean(data.rejectedDate);

          if (isRejected) {
            // Clean up orphan rejected member record from Firestore
            deleteDoc(d.ref).catch(() => {});
            return;
          }

          const isPending =
            statusUpper === "PENDING" || joinStatusUpper === "PENDING";

          // Only callers that explicitly request pending records (e.g. host review in ManageGroupScreen)
          // should receive pending applicants. All standard household member lists must ONLY contain active members.
          if (isPending && !options?.includePending) {
            return;
          }

          const isActive =
            statusUpper === "ACTIVE" ||
            data.role === "HOST" ||
            (!data.status && !isPending && !isRejected);

          if (!isActive && !options?.includePending) {
            return;
          }

          const canonicalUid =
            (data.userId || "").replace(/^mem_/, "").trim() ||
            d.id.replace(/^mem_/, "").trim();
          const emailKey = (data.email || "").trim().toLowerCase();
          const dedupeKey = canonicalUid || emailKey || d.id;

          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            if (canonicalUid) seen.add(canonicalUid);
            if (emailKey) seen.add(emailKey);
            rawItems.push({
              ...data,
              id: d.id,
              docId: d.id,
              userId: canonicalUid || data.userId || d.id,
            });
            if (!data.profilePicture && !data.photoURL && canonicalUid) {
              missingPhotoUids.push(canonicalUid);
            }
          } else {
            // Already seen: if existing entry is missing profile picture or name, merge from this duplicate
            const existingIdx = rawItems.findIndex(
              (m) =>
                (m.userId && m.userId.replace(/^mem_/, "") === canonicalUid) ||
                (emailKey && m.email && m.email.toLowerCase() === emailKey),
            );
            if (existingIdx !== -1) {
              const current = rawItems[existingIdx];
              rawItems[existingIdx] = {
                ...data,
                ...current,
                profilePicture:
                  current.profilePicture ||
                  data.profilePicture ||
                  data.photoURL,
                photoURL:
                  current.photoURL || data.photoURL || data.profilePicture,
                displayName: current.displayName || data.displayName,
              };
            }
          }
        });

        // Fast callback first
        callback(rawItems);

        // Fetch missing user profile pictures from users collection
        if (missingPhotoUids.length > 0) {
          let hasEnriched = false;
          await Promise.all(
            missingPhotoUids.map(async (uid) => {
              try {
                const uDoc = await getDoc(doc(db, "users", uid));
                if (uDoc.exists()) {
                  const uData = uDoc.data();
                  const pic =
                    uData.profilePicture || uData.photoURL || uData.avatarUrl;
                  if (pic) {
                    const idx = rawItems.findIndex(
                      (m) => (m.userId || m.memberId) === uid,
                    );
                    if (idx !== -1) {
                      rawItems[idx] = {
                        ...rawItems[idx],
                        profilePicture: pic,
                        photoURL: pic,
                      };
                      hasEnriched = true;
                      // Backfill to the member doc in Firestore so future reads have it
                      setDoc(
                        doc(
                          db,
                          `households/${householdId}/members`,
                          rawItems[idx].memberId || uid,
                        ),
                        { profilePicture: pic, photoURL: pic },
                        { merge: true },
                      ).catch(() => {});
                    }
                  }
                }
              } catch (e) {}
            }),
          );
          if (hasEnriched) {
            callback([...rawItems]);
          }
        }
      },
      (err) =>
        console.warn("[Firestore Mobile] listenToHouseholdMembers:", err),
    );
  },

  async createHousehold(data: {
    householdName: string;
    apartmentName?: string;
    hostId: string;
    address?: string;
    members?: { name: string; phoneOrEmail?: string }[];
  }): Promise<string> {
    // Verify host privilege before creating household
    const userSnap = await getDoc(doc(db, "users", data.hostId));
    const uData = userSnap.exists() ? userSnap.data() : {};
    const isHost =
      uData.role === "HOST" ||
      uData.role === "SUPER_ADMIN" ||
      uData.hostApplicationStatus === "APPROVED";
    if (!isHost) {
      throw new Error(
        "Host privileges required. Only verified hosts can create household groups.",
      );
    }

    const householdId = `hh_${Date.now()}`;
    const name = data.householdName.trim() || "Apartment Roommate";
    const apt = (data.apartmentName || name).trim();
    const inviteCode = `PF-${Math.floor(100 + Math.random() * 900)}`;

    const newHh = {
      householdId,
      householdName: name,
      apartmentName: apt,
      address: data.address || "",
      hostId: data.hostId,
      status: "ACTIVE",
      paymentsLocked: true,
      paymentsOpenedByHost: false,
      inviteCode,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };

    await setDoc(doc(db, "households", householdId), sanitizeData(newHh), {
      merge: true,
    });

    // Add host member with profile picture if available
    const hostPic =
      uData.profilePicture ||
      uData.photoURL ||
      auth.currentUser?.photoURL ||
      "";

    await setDoc(
      doc(db, `households/${householdId}/members`, data.hostId),
      sanitizeData({
        memberId: data.hostId,
        userId: data.hostId,
        householdId,
        role: "HOST",
        displayName:
          uData.displayName ||
          uData.fullName ||
          auth.currentUser?.displayName ||
          "Host",
        email: uData.email || auth.currentUser?.email || "",
        profilePicture: hostPic,
        photoURL: hostPic,
        status: "ACTIVE",
        joinedDate: new Date().toISOString(),
      }),
      { merge: true },
    );

    // Add any initial invited members
    if (data.members && data.members.length > 0) {
      for (const m of data.members) {
        if (!m.name.trim()) continue;
        const memId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const isEmail = (m.phoneOrEmail || "").includes("@");
        await setDoc(
          doc(db, `households/${householdId}/members`, memId),
          sanitizeData({
            memberId: memId,
            householdId,
            role: "PAYOR",
            displayName: m.name.trim(),
            email: isEmail ? (m.phoneOrEmail || "").trim() : "",
            phoneNumber: !isEmail ? (m.phoneOrEmail || "").trim() : "",
            status: "PENDING",
            joinedDate: new Date().toISOString(),
          }),
          { merge: true },
        );
      }
    }

    // Update host user's profile
    const profileUpdate = {
      householdId,
      householdName: name,
      apartmentName: apt,
      role: "HOST",
      updatedDate: new Date().toISOString(),
    };
    await setDoc(doc(db, "users", data.hostId), profileUpdate, { merge: true });

    _cachedHousehold = newHh;
    if (_cachedUserProfile) {
      _cachedUserProfile = {
        ..._cachedUserProfile,
        ...profileUpdate,
      };
    }

    return householdId;
  },

  async updateHousehold(
    householdId: string,
    data: Partial<{
      householdName: string;
      apartmentName: string;
      address: string;
    }>,
  ): Promise<void> {
    const ref = doc(db, "households", householdId);
    await setDoc(
      ref,
      {
        ...data,
        updatedDate: new Date().toISOString(),
      },
      { merge: true },
    );

    const currentUser = auth.currentUser;
    if (currentUser?.uid) {
      await setDoc(
        doc(db, "users", currentUser.uid),
        {
          ...(data.householdName ? { householdName: data.householdName } : {}),
          ...(data.apartmentName ? { apartmentName: data.apartmentName } : {}),
          updatedDate: new Date().toISOString(),
        },
        { merge: true },
      );
    }
  },

  async updateMemberRole(
    householdId: string,
    memberId: string,
    userId: string,
    newRole: "PAYOR" | "NON_PAYOR",
  ): Promise<void> {
    const memRef = doc(db, `households/${householdId}/members`, memberId);
    await setDoc(
      memRef,
      { role: newRole, updatedDate: new Date().toISOString() },
      { merge: true },
    );

    if (userId && !userId.startsWith("mem_")) {
      const userRef = doc(db, "users", userId);
      await setDoc(
        userRef,
        { role: newRole, updatedDate: new Date().toISOString() },
        { merge: true },
      ).catch(() => {});
    }

    // Recalculate unpaid expenses so payor/non-payor changes are immediately reflected
    await this.recalculateUnpaidExpensesForHousehold(householdId);
  },

  async removeMemberFromHousehold(
    householdId: string,
    memberId: string,
    userId?: string,
  ): Promise<void> {
    const ref = doc(db, `households/${householdId}/members`, memberId);
    await deleteDoc(ref);

    if (userId && userId !== memberId) {
      const ref2 = doc(db, `households/${householdId}/members`, userId);
      await deleteDoc(ref2).catch(() => {});
    }

    const targetUid =
      userId && !userId.startsWith("mem_")
        ? userId
        : !memberId.startsWith("mem_")
          ? memberId
          : null;
    if (targetUid) {
      await setDoc(
        doc(db, "users", targetUid),
        {
          householdId: "",
          householdName: "",
          apartmentName: "",
          pendingHouseholdId: "",
          pendingHouseholdName: "",
          joinRequestStatus: null,
          updatedDate: new Date().toISOString(),
        },
        { merge: true },
      ).catch(() => {});
    }

    // Recalculate unpaid expenses across remaining active payors
    await this.recalculateUnpaidExpensesForHousehold(householdId);
  },

  async inviteMemberToHousehold(
    householdId: string,
    member: { name: string; phoneOrEmail: string; role?: string },
  ): Promise<void> {
    const memId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isEmail = member.phoneOrEmail.includes("@");
    await setDoc(
      doc(db, `households/${householdId}/members`, memId),
      sanitizeData({
        memberId: memId,
        householdId,
        role: member.role || "PAYOR",
        displayName: member.name.trim(),
        email: isEmail ? member.phoneOrEmail.trim() : "",
        phoneNumber: !isEmail ? member.phoneOrEmail.trim() : "",
        status: "PENDING",
        joinedDate: new Date().toISOString(),
      }),
      { merge: true },
    );
  },

  async joinHouseholdByCode(
    codeOrId: string,
    user: {
      uid: string;
      displayName: string;
      email: string;
      photoURL?: string;
    },
  ): Promise<{
    success: boolean;
    household?: any;
    isPendingApproval?: boolean;
    error?: string;
  }> {
    const cleanCode = codeOrId.trim();
    if (!cleanCode)
      return { success: false, error: "Please enter a valid code" };

    try {
      // 1. Try finding by ID
      const hhDocRef = doc(db, "households", cleanCode);
      const hhSnap = await getDoc(hhDocRef);
      let targetHh: any = hhSnap.exists() ? hhSnap.data() : null;

      // 2. If not found by ID, query by inviteCode
      if (!targetHh) {
        const q = query(
          collection(db, "households"),
          where("inviteCode", "==", cleanCode.toUpperCase()),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          targetHh = snap.docs[0].data();
        }
      }

      // 3. Try with PF- prefix if not provided
      if (!targetHh && !cleanCode.toUpperCase().startsWith("PF-")) {
        const q2 = query(
          collection(db, "households"),
          where("inviteCode", "==", `PF-${cleanCode.toUpperCase()}`),
        );
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          targetHh = snap2.docs[0].data();
        }
      }

      // 4. Fallback search across all households
      if (!targetHh) {
        const allSnap = await getDocs(collection(db, "households"));
        for (const d of allSnap.docs) {
          const data = d.data();
          const code = (data.inviteCode || "").toUpperCase();
          const target = cleanCode.toUpperCase();
          if (
            d.id.toUpperCase() === target ||
            code === target ||
            code === `PF-${target}` ||
            d.id.toUpperCase().endsWith(target)
          ) {
            targetHh = data;
            break;
          }
        }
      }

      if (!targetHh) {
        return {
          success: false,
          error: `No household found with code "${cleanCode}". Please check with your host.`,
        };
      }

      const hhId = targetHh.householdId;
      const nowIso = new Date().toISOString();
      const displayName = user.displayName || user.email || "Resident";

      // If user is already the host of this household
      if (targetHh.hostId === user.uid) {
        return {
          success: false,
          error: "You are already the host of this household.",
        };
      }

      // Check existing member record safely
      const memberRef = doc(db, `households/${hhId}/members`, user.uid);
      let memberSnap: any = null;
      try {
        memberSnap = await getDoc(memberRef);
      } catch (memErr) {
        console.warn(
          "[Firebase Mobile] joinHouseholdByCode member check:",
          memErr,
        );
      }
      if (memberSnap && memberSnap.exists()) {
        const memData = memberSnap.data();
        if (memData.status === "ACTIVE") {
          return {
            success: false,
            error: "You are already an active member of this household.",
          };
        }
        if (memData.status === "PENDING") {
          return {
            success: true,
            isPendingApproval: true,
            household: targetHh,
            error:
              "Your request to join this household is already awaiting host approval.",
          };
        }
      }

      // 1. Add member record with status PENDING (requires host approval)
      await setDoc(
        memberRef,
        sanitizeData({
          memberId: user.uid,
          userId: user.uid,
          householdId: hhId,
          householdName: targetHh.householdName || targetHh.apartmentName,
          role: "PAYOR",
          displayName,
          email: user.email || "",
          profilePicture: user.photoURL || null,
          photoURL: user.photoURL || null,
          status: "PENDING",
          joinedDate: "",
          requestedDate: nowIso,
          rejectionReason: null,
        }),
        { merge: true },
      );

      // 2. Update user profile document with pending status (do not grant full membership until approved)
      await setDoc(
        doc(db, "users", user.uid),
        {
          pendingHouseholdId: hhId,
          pendingHouseholdName:
            targetHh.householdName || targetHh.apartmentName,
          joinRequestStatus: "PENDING",
          joinRejectionReason: null,
          updatedDate: nowIso,
        },
        { merge: true },
      );

      // 3. Dispatch in-app notification & instant high-priority push alert to the Host
      const hostId = targetHh.hostId;
      const hhName =
        targetHh.householdName || targetHh.apartmentName || "your group";
      if (hostId) {
        try {
          const notifId = `notif_join_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await setDoc(
            doc(db, "notifications", notifId),
            sanitizeData({
              id: notifId,
              notificationId: notifId,
              recipientId: hostId,
              userId: hostId,
              householdId: hhId,
              title: "New Member Request",
              message: `${displayName} requested to join ${hhName}. Tap to review and approve.`,
              body: `${displayName} requested to join ${hhName}. Tap to review and approve.`,
              type: "JOIN_REQUEST",
              category: "group_invite",
              status: "UNREAD",
              read: false,
              readStatus: false,
              createdAt: nowIso,
              timestamp: nowIso,
              createdTimestamp: nowIso,
              relatedEntityId: user.uid,
              data: {
                type: "join_request",
                applicantUid: user.uid,
                applicantName: displayName,
                householdId: hhId,
              },
            }),
            { merge: true },
          );

          // Deliver high-priority push notification straight to host's phone (with sound & heads-up banner)
          pushDispatchService
            .sendJoinRequestPushToHost({
              hostId,
              householdId: hhId,
              householdName: hhName,
              applicantName: displayName,
              applicantUid: user.uid,
            })
            .catch((pushErr) => {
              console.warn(
                "[Firebase Mobile] Host push notification dispatch deferred:",
                pushErr,
              );
            });
        } catch (notifErr) {
          console.warn(
            "[Firebase Mobile] Could not write host notification doc:",
            notifErr,
          );
        }
      }

      return { success: true, household: targetHh, isPendingApproval: true };
    } catch (err: any) {
      console.error("[Firebase] joinHouseholdByCode error:", err);
      return { success: false, error: err.message || "Failed to join group." };
    }
  },

  async approveJoinRequest(
    householdId: string,
    memberId: string,
  ): Promise<boolean> {
    try {
      const nowIso = new Date().toISOString();
      const memRef = doc(db, `households/${householdId}/members`, memberId);
      await updateDoc(memRef, {
        status: "ACTIVE",
        joinedDate: nowIso,
        rejectionReason: null,
      });

      const hhSnap = await getDoc(doc(db, "households", householdId));
      const hhData = hhSnap.exists() ? hhSnap.data() : null;

      try {
        await updateDoc(doc(db, "users", memberId), {
          householdId,
          householdName: hhData?.householdName || hhData?.apartmentName || "",
          apartmentName: hhData?.apartmentName || hhData?.householdName || "",
          role: "PAYOR",
          joinRequestStatus: "APPROVED",
          pendingHouseholdId: null,
          joinRejectionReason: null,
          updatedDate: nowIso,
        });
      } catch (uErr) {
        console.warn(
          "[approveJoinRequest Mobile] User doc update deferred to client:",
          uErr,
        );
      }

      // Automatically recalculate and redistribute unpaid bills across active payors
      await this.recalculateUnpaidExpensesForHousehold(householdId);

      // Save cloud notification for approved group member
      try {
        const memSnap = await getDoc(memRef);
        const memData = memSnap.exists() ? memSnap.data() : null;
        const memberName = memData?.displayName || "Roommate";
        const groupName =
          hhData?.householdName || hhData?.apartmentName || "Household";
        const itemId = `member_${memberId}_ACTIVE`;
        const targetIds = Array.from(
          new Set([memberId, auth.currentUser?.uid].filter(Boolean)),
        ) as string[];
        await Promise.all(
          targetIds.map((recipientUid) => {
            const notifId = `notif_${recipientUid}_${itemId}`;
            return setDoc(
              doc(db, "notifications", notifId),
              sanitizeData({
                notificationId: notifId,
                recipientId: recipientUid,
                householdId,
                type: "INVITATION_RECEIVED",
                category: "group_invite",
                title: "Group Invite Accepted",
                message: `${memberName} joined the "${groupName}" group.`,
                relatedItemId: itemId,
                relatedEntityId: memberId,
                readStatus: false,
                createdTimestamp: nowIso,
              }),
              { merge: true },
            ).catch(() => {});
          }),
        );
      } catch {}

      // Notify the approved member via instant push notification
      try {
        const hhName =
          hhData?.householdName || hhData?.apartmentName || "Household";
        const cleanMemberId = String(memberId).replace(/^mem_/, "").trim();
        pushDispatchService
          .sendJoinDecisionPushToApplicant({
            applicantUid: cleanMemberId,
            householdName: hhName,
            approved: true,
          })
          .catch(() => {});
      } catch {}

      return true;
    } catch (err) {
      console.error("[approveJoinRequest Mobile] Error:", err);
      return false;
    }
  },

  async rejectJoinRequest(
    householdId: string,
    memberId: string,
    reason?: string,
    docId?: string,
  ): Promise<boolean> {
    try {
      const nowIso = new Date().toISOString();
      const cleanMemberId = String(memberId).replace(/^mem_/, "").trim();
      const memRef1 = doc(db, `households/${householdId}/members`, memberId);
      const memRef2 = doc(
        db,
        `households/${householdId}/members`,
        `mem_${cleanMemberId}`,
      );
      const memRef3 = doc(
        db,
        `households/${householdId}/members`,
        cleanMemberId,
      );

      // Collect all references associated with this member to guarantee full removal
      const refsToProcess = new Map<string, any>();
      refsToProcess.set(memRef1.path, memRef1);
      refsToProcess.set(memRef2.path, memRef2);
      refsToProcess.set(memRef3.path, memRef3);
      if (docId) {
        const dRef = doc(db, `households/${householdId}/members`, docId);
        refsToProcess.set(dRef.path, dRef);
      }

      // Query members subcollection to catch any docs matching by userId or memberId
      try {
        const membersSnap = await getDocs(
          collection(db, `households/${householdId}/members`),
        );
        membersSnap.forEach((d) => {
          const dData = d.data();
          const dUid = String(dData.userId || dData.memberId || d.id || "")
            .replace(/^mem_/, "")
            .trim();
          if (
            d.id === memberId ||
            d.id === cleanMemberId ||
            d.id === `mem_${cleanMemberId}` ||
            (docId && d.id === docId) ||
            dUid === cleanMemberId ||
            dData.userId === memberId ||
            dData.memberId === memberId
          ) {
            refsToProcess.set(d.ref.path, d.ref);
          }
        });
      } catch (scanErr) {
        console.warn("[rejectJoinRequest] Subcollection scan notice:", scanErr);
      }

      // Step 1: Explicitly stamp REJECTED status so any listener immediately excludes them
      await Promise.all(
        Array.from(refsToProcess.values()).map((r) =>
          setDoc(
            r,
            {
              status: "REJECTED",
              joinRequestStatus: "REJECTED",
              rejectionReason: reason || "Declined by host.",
              rejectedDate: nowIso,
            },
            { merge: true },
          ).catch(() => {}),
        ),
      );

      // Step 2: Permanently remove the rejected applicant from the household's members collection
      await Promise.all(
        Array.from(refsToProcess.values()).map((r) =>
          deleteDoc(r).catch(() => {}),
        ),
      );

      const hhSnap = await getDoc(doc(db, "households", householdId));
      const hhData = hhSnap.exists() ? hhSnap.data() : null;
      const hhName =
        hhData?.householdName || hhData?.apartmentName || "Household";

      try {
        await setDoc(
          doc(db, "users", cleanMemberId),
          {
            householdId: null,
            householdName: null,
            apartmentName: null,
            role: "MEMBER",
            pendingHouseholdId: null,
            pendingHouseholdName: null,
            joinRequestStatus: "REJECTED",
            joinRejectionReason: reason || "Declined by host.",
            rejectedDate: nowIso,
            updatedDate: nowIso,
          },
          { merge: true },
        );
        if (_cachedUserProfile && _cachedUserProfile.uid === cleanMemberId) {
          _cachedUserProfile = {
            ..._cachedUserProfile,
            householdId: null,
            householdName: null,
            apartmentName: null,
            pendingHouseholdId: null,
            pendingHouseholdName: null,
            joinRequestStatus: "REJECTED",
            joinRejectionReason: reason || "Declined by host.",
            rejectedDate: nowIso,
          };
        }
      } catch (uErr) {
        console.warn("[rejectJoinRequest] User doc update notice:", uErr);
      }

      // Create in-app notification in Firestore
      try {
        const notifId = `notif_${cleanMemberId}_join_rejected_${Date.now()}`;
        await setDoc(
          doc(db, "notifications", notifId),
          sanitizeData({
            notificationId: notifId,
            recipientId: cleanMemberId,
            householdId,
            type: "JOIN_REJECTED",
            category: "group_invite",
            title: "Join Request Declined",
            message: `Your request to join ${hhName} was declined: "${reason || "Declined by host."}"`,
            spans: [
              { text: `Your request to join ${hhName} was declined: ` },
              {
                text: `"${reason || "Declined by host."}"`,
                bold: true,
                color: "#BE123C",
              },
            ],
            readStatus: false,
            createdTimestamp: nowIso,
          }),
          { merge: true },
        );
      } catch {}

      // Dispatch high-priority push notification to applicant
      pushDispatchService
        .sendJoinDecisionPushToApplicant({
          applicantUid: cleanMemberId,
          householdName: hhName,
          approved: false,
          rejectionReason: reason || "Declined by host.",
        })
        .catch(() => {});

      return true;
    } catch (err) {
      console.error("[rejectJoinRequest Mobile] Error:", err);
      return false;
    }
  },

  /**
   * Recalculates and redistributes all UNPAID expenses across the current roster of ACTIVE payors.
   * Ensures new payors are properly included and not left out or marked exempt from ongoing bills.
   */
  async recalculateUnpaidExpensesForHousehold(
    householdId: string,
    targetCycleId?: string,
  ): Promise<number> {
    if (!householdId) return 0;
    const existingRun = _recalcInFlight.get(householdId);
    if (existingRun) {
      _recalcPendingCycle.set(
        householdId,
        targetCycleId ?? _recalcPendingCycle.get(householdId),
      );
      await existingRun.catch(() => 0);
      const followUp = _recalcInFlight.get(householdId);
      if (followUp) {
        return followUp;
      }
    }

    const runPromise = (async (): Promise<number> => {
      try {
        return await this._executeRecalculateUnpaidExpenses(
          householdId,
          targetCycleId,
        );
      } finally {
        _recalcInFlight.delete(householdId);
        if (_recalcPendingCycle.has(householdId)) {
          const nextCycleId = _recalcPendingCycle.get(householdId);
          _recalcPendingCycle.delete(householdId);
          this.recalculateUnpaidExpensesForHousehold(
            householdId,
            nextCycleId,
          ).catch(() => {});
        }
      }
    })();

    _recalcInFlight.set(householdId, runPromise);
    return runPromise;
  },

  async _executeRecalculateUnpaidExpenses(
    householdId: string,
    targetCycleId?: string,
  ): Promise<number> {
    try {
      if (!householdId) return 0;
      const membersSnap = await getDocs(
        collection(db, `households/${householdId}/members`),
      );
      let activeMembers: any[] = membersSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter(
          (m: any) =>
            m.status === "ACTIVE" || m.status === "SETTLED" || !m.status,
        );

      if (activeMembers.length === 0) {
        try {
          const hhSnap = await getDoc(doc(db, "households", householdId));
          const hhData = hhSnap.exists() ? hhSnap.data() : null;
          const fallbackUid = hhData?.hostId || auth.currentUser?.uid;
          if (fallbackUid) {
            activeMembers = [
              {
                id: fallbackUid,
                userId: fallbackUid,
                memberId: fallbackUid,
                displayName: auth.currentUser?.displayName || "Host",
                role: "HOST",
                status: "ACTIVE",
              },
            ];
          }
        } catch {}
      }

      if (activeMembers.length === 0) return 0;

      const activePayors = activeMembers.filter((m) => isPayorMember(m));
      const effectivePayors =
        activePayors.length > 0 ? activePayors : activeMembers;

      const expSnap = await getDocs(
        collection(db, `households/${householdId}/expenses`),
      );
      let updatedCount = 0;

      // Function-level map of member attendance days for water billing calculations
      const memberDaysMap = new Map<string, number>();
      let preActiveCycleId: string | undefined;
      let preOldestCycleId: string | undefined;
      let preIsSingleCycle = true;
      const preKnownCycleIds = new Set<string>();
      try {
        const preCyclesSnap = await getDocs(
          collection(db, `households/${householdId}/billingCycles`),
        );
        const preCycles = sortBillingCyclesNewest(
          preCyclesSnap.docs.map((cd) => ({
            ...cd.data(),
            billingCycleId: cd.data().billingCycleId || cd.id,
          })),
        );
        preCycles.forEach((c: any) => {
          if (c?.billingCycleId) preKnownCycleIds.add(c.billingCycleId);
        });
        preIsSingleCycle = preCycles.length <= 1;
        preOldestCycleId = preCycles[preCycles.length - 1]?.billingCycleId;
        const requestedCycle = targetCycleId
          ? preCycles.find((c: any) => c.billingCycleId === targetCycleId)
          : null;
        const preActiveCycle = requestedCycle || preCycles[0];
        preActiveCycleId = targetCycleId || preActiveCycle?.billingCycleId;
        if (preActiveCycleId) {
          const [attSnap, subSnap] = await Promise.all([
            getDocs(
              query(
                collection(db, `households/${householdId}/waterAttendance`),
                where("billingCycleId", "==", preActiveCycleId),
              ),
            ).catch(() => null),
            getDocs(
              query(
                collection(
                  db,
                  `households/${householdId}/attendanceSubmissions`,
                ),
                where("billingCycleId", "==", preActiveCycleId),
              ),
            ).catch(() => null),
          ]);
          const preAtt = attSnap ? attSnap.docs.map((sd) => sd.data()) : [];
          const preSub = subSnap ? subSnap.docs.map((sd) => sd.data()) : [];
          for (const m of activeMembers) {
            const uid = m.userId || m.memberId || m.id;
            const present = preAtt.filter(
              (a: any) => a.userId === uid && a.status === "PRESENT",
            ).length;
            const sub = preSub.find((s: any) => s.userId === uid);
            memberDaysMap.set(
              uid,
              present > 0 ? present : sub?.daysPresent || 0,
            );
          }
        }
      } catch {
        // Attendance pre-population fallback
      }

      // Fetch water configuration to apply cycle-scoped pricing mode
      let rawWaterConfig: any = null;
      try {
        const waterSnap = await getDoc(
          doc(db, `households/${householdId}/systemSettings`, "water"),
        );
        if (waterSnap.exists()) {
          rawWaterConfig = waterSnap.data();
        }
      } catch (wErr) {
        console.warn(
          "[recalculateUnpaidExpensesForHousehold] water settings load:",
          wErr,
        );
      }

      for (const d of expSnap.docs) {
        const expData = d.data();
        if (expData.isPaid === true || expData.status === "PAID") continue;
        const isUnscopedOrOrphan =
          !expData.billingCycleId ||
          (preKnownCycleIds.size > 0 &&
            !preKnownCycleIds.has(expData.billingCycleId));
        if (
          preActiveCycleId &&
          expData.billingCycleId !== preActiveCycleId &&
          !(
            isUnscopedOrOrphan &&
            (preIsSingleCycle || preActiveCycleId === preOldestCycleId)
          )
        ) {
          continue;
        }

        const catLower = (expData.category || "").toLowerCase();
        const isWater = catLower.includes("water");
        const isElectricity =
          catLower.includes("electric") ||
          (expData.title || "").toLowerCase().includes("electric");
        let newSplitDetails: any[] = [];

        if (isWater) {
          const expCycleId = expData.billingCycleId || preActiveCycleId;
          const waterConfig = resolveCycleWaterConfig(
            rawWaterConfig,
            expCycleId,
            {
              cycleWaterExpense: expData,
              payorCount: effectivePayors.length,
              totalCyclesCount: preKnownCycleIds.size,
            },
          );
          if (waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH") {
            // Mode 3: Flat fee per resident
            const perPersonCentavos =
              waterConfig.fixedPerPersonAmountCentavos || 0;
            const updatedTotalCents =
              perPersonCentavos * effectivePayors.length;
            newSplitDetails = activeMembers.map((m: any) => {
              const isPayor = isPayorMember(m);
              if (isPayor) {
                return {
                  userId: m.userId || m.memberId || m.id,
                  displayName: m.displayName || "Roommate",
                  shareCentavos: perPersonCentavos,
                  isPaid: false,
                  isExempt: false,
                  role: m.role || "PAYOR",
                  note: `Flat water rate: ₱${(perPersonCentavos / 100).toFixed(2)}/resident/month`,
                };
              } else {
                return {
                  userId: m.userId || m.memberId || m.id,
                  displayName: m.displayName || "Roommate",
                  shareCentavos: 0,
                  isPaid: true,
                  isExempt: true,
                  role: "NON_PAYOR",
                  note: "Exempted (Non-payor)",
                };
              }
            });
            if (
              updatedTotalCents > 0 &&
              expData.amountCents !== updatedTotalCents
            ) {
              await updateDoc(d.ref, { amountCents: updatedTotalCents });
            }
          } else if (waterConfig?.pricingModel === "FIXED_MONTHLY") {
            // Mode 2: Fixed monthly household total split equally across payors
            const fixedMonthlyCents =
              waterConfig.fixedMonthlyAmountCentavos || expData.amountCents;
            newSplitDetails = activeMembers.map((m: any) => {
              const uid = m.userId || m.memberId || m.id || "";
              const isPayor = isPayorMember(m);
              if (isPayor) {
                const shareCentavos = computeFairSplitShareCentavos(
                  fixedMonthlyCents,
                  effectivePayors,
                  uid,
                );
                return {
                  userId: uid,
                  displayName: m.displayName || "Roommate",
                  shareCentavos,
                  isPaid: false,
                  isExempt: false,
                  role: m.role || "PAYOR",
                  note: `Fixed monthly water bill (₱${(fixedMonthlyCents / 100).toFixed(2)}) split equally across ${effectivePayors.length} payors`,
                };
              } else {
                return {
                  userId: m.userId || m.memberId || m.id,
                  displayName: m.displayName || "Roommate",
                  shareCentavos: 0,
                  isPaid: true,
                  isExempt: true,
                  role: "NON_PAYOR",
                  note: "Exempted (Non-payor)",
                };
              }
            });
            if (
              waterConfig.fixedMonthlyAmountCentavos &&
              expData.amountCents !== waterConfig.fixedMonthlyAmountCentavos
            ) {
              await updateDoc(d.ref, {
                amountCents: waterConfig.fixedMonthlyAmountCentavos,
              });
            }
          } else {
            // Mode 1: Daily Attendance (PER_PERSON_DAY)
            let cycleId = expCycleId;
            if (!cycleId) {
              try {
                const cycSnap = await getDocs(
                  collection(db, `households/${householdId}/billingCycles`),
                );
                const allCycles = cycSnap.docs.map((cd) => ({
                  ...cd.data(),
                  billingCycleId: cd.data().billingCycleId || cd.id,
                }));
                const act =
                  allCycles.find((c: any) => c.status === "ACTIVE") ||
                  allCycles[0];
                if (act) cycleId = act.billingCycleId;
              } catch {
                // Ignore cycle fetch fallback error
              }
            }
            let attRecords: any[] = [];
            let subRecords: any[] = [];
            if (cycleId) {
              try {
                const [attSnap, subSnap] = await Promise.all([
                  getDocs(
                    query(
                      collection(
                        db,
                        `households/${householdId}/waterAttendance`,
                      ),
                      where("billingCycleId", "==", cycleId),
                    ),
                  ).catch((e) => {
                    console.warn(
                      "[recalculateUnpaidExpenses] waterAttendance read notice:",
                      e?.message || e,
                    );
                    return null;
                  }),
                  getDocs(
                    query(
                      collection(
                        db,
                        `households/${householdId}/attendanceSubmissions`,
                      ),
                      where("billingCycleId", "==", cycleId),
                    ),
                  ).catch((e) => {
                    console.warn(
                      "[recalculateUnpaidExpenses] attendanceSubmissions read notice:",
                      e?.message || e,
                    );
                    return null;
                  }),
                ]);
                if (attSnap) attRecords = attSnap.docs.map((sd) => sd.data());
                if (subSnap) subRecords = subSnap.docs.map((sd) => sd.data());
              } catch (attErr) {
                console.warn(
                  "[recalculateUnpaidExpenses] attendance read error:",
                  attErr,
                );
              }
            }

            const rate = Number(
              waterConfig?.rateCentavosPerPersonPerDay ?? 500,
            );
            const { membersBreakdown, totalAmountCentavos: totalWaterCents } =
              computeCycleWaterBreakdown(
                activeMembers,
                attRecords,
                subRecords,
                rate,
                expData.splitDetails,
              );

            newSplitDetails = membersBreakdown.map((item) => {
              memberDaysMap.set(item.userId, item.daysPresent);
              return {
                userId: item.userId,
                displayName: item.displayName,
                shareCentavos: item.shareCentavos,
                ownWaterCentavos: item.ownWaterCentavos,
                nonPayorWaterCentavos: item.nonPayorWaterCentavos,
                daysPresent: item.daysPresent,
                rateCentavosPerDay: item.rateCentavosPerDay,
                isPaid: item.isExempt,
                isExempt: item.isExempt,
                role: item.role,
                note: item.note,
              };
            });

            if (
              totalWaterCents >= 0 &&
              expData.amountCents !== totalWaterCents
            ) {
              await updateDoc(d.ref, { amountCents: totalWaterCents });
            }
          }
        } else {
          const payorCount = Math.max(1, effectivePayors.length);
          const elecMeterNote =
            isElectricity && expData.notes
              ? `${expData.notes} · Split among ${payorCount} payors`
              : null;

          newSplitDetails = activeMembers.map((m: any) => {
            const uid = m.userId || m.memberId || m.id || "";
            const isPayor = isPayorMember(m);
            if (isPayor) {
              const shareCentavos = computeFairSplitShareCentavos(
                expData.amountCents,
                effectivePayors,
                uid,
              );
              return {
                userId: uid,
                displayName: m.displayName || "Roommate",
                shareCentavos,
                percentage: Math.round((100 / payorCount) * 10) / 10,
                isPaid: false,
                isExempt: false,
                role: m.role || "PAYOR",
                note:
                  elecMeterNote ||
                  `Fair share among ${payorCount} payors (Non-payors exempt)`,
              };
            } else {
              return {
                userId: uid,
                displayName: m.displayName || "Roommate",
                shareCentavos: 0,
                percentage: 0,
                isPaid: true,
                isExempt: true,
                role: "NON_PAYOR",
                note: "Exempted (Non-payor)",
              };
            }
          });
        }

        // Preserve existing paid status per user ONLY when actual paid amount covers the new share
        if (
          Array.isArray(expData.splitDetails) &&
          expData.splitDetails.length > 0
        ) {
          newSplitDetails = newSplitDetails.map((s: any) => {
            if (s.isExempt) return sanitizeData(s);
            const prev = expData.splitDetails.find((ps: any) =>
              matchesMemberUid(
                { userId: s.userId },
                ps?.userId || ps?.memberId || ps?.id,
              ),
            );
            if (prev && prev.isPaid) {
              const prevActualPaid =
                typeof prev.paidAmountCentavos === "number"
                  ? prev.paidAmountCentavos
                  : prev.paymentId || prev.paidDate
                    ? Number(prev.shareCentavos) || 0
                    : 0;
              if (s.shareCentavos > 0 && prevActualPaid >= s.shareCentavos) {
                return sanitizeData({
                  ...s,
                  isPaid: true,
                  paidAmountCentavos: prevActualPaid,
                  ...(prev.paidDate !== undefined
                    ? { paidDate: prev.paidDate }
                    : {}),
                  ...(prev.paymentId !== undefined
                    ? { paymentId: prev.paymentId }
                    : {}),
                });
              }
            }
            return sanitizeData(s);
          });
        } else {
          newSplitDetails = newSplitDetails.map((s: any) => sanitizeData(s));
        }

        const allSplitsNowPaid =
          newSplitDetails.length > 0 &&
          newSplitDetails.every((s: any) => s.isExempt || s.isPaid);

        await updateDoc(
          d.ref,
          sanitizeData({
            splitDetails: newSplitDetails,
            ...(allSplitsNowPaid ? { status: "PAID", isPaid: true } : {}),
            participantUserIds: newSplitDetails
              .filter((s) => !s.isExempt && Boolean(s.userId))
              .map((s) => s.userId),
            updatedDate: new Date().toISOString(),
          }),
        );
        updatedCount++;
      }

      // Synchronize and update all memberBills in Firestore for all active members
      try {
        const [cyclesSnap, paymentsSnap] = await Promise.all([
          getDocs(collection(db, `households/${householdId}/billingCycles`)),
          getDocs(collection(db, `households/${householdId}/payments`)),
        ]);
        const cycles = sortBillingCyclesNewest(
          cyclesSnap.docs.map((cd) => ({
            ...cd.data(),
            billingCycleId: cd.data().billingCycleId || cd.id,
          })),
        );
        const knownCycleIds = new Set<string>();
        cycles.forEach((c: any) => {
          if (c?.billingCycleId) knownCycleIds.add(c.billingCycleId);
        });
        const isSingleCycle = cycles.length <= 1;
        const oldestCycleId = cycles[cycles.length - 1]?.billingCycleId;
        const requestedCycle = targetCycleId
          ? cycles.find((c: any) => c.billingCycleId === targetCycleId)
          : null;
        const activeCycle = requestedCycle || cycles[0];
        const activeCycleId =
          targetCycleId || activeCycle?.billingCycleId || `bc_${Date.now()}`;

        const paymentsByUser = new Map<string, number>();
        paymentsSnap.docs.forEach((pd) => {
          const pData = pd.data();
          if (pData.status === "REJECTED") return;
          const matchesCycle =
            pData.billingCycleId === activeCycleId ||
            ((!pData.billingCycleId || pData.billingCycleId === "general") &&
              isSingleCycle);
          if (matchesCycle && pData.userId) {
            const cleanPUid = normalizeCleanUid(pData.userId);
            paymentsByUser.set(
              cleanPUid,
              (paymentsByUser.get(cleanPUid) || 0) +
                (Number(pData.amountCentavos) || 0),
            );
          }
        });

        // Re-read updated expenses scoped strictly to the target/active billing cycle
        const updatedExpSnap = await getDocs(
          collection(db, `households/${householdId}/expenses`),
        );
        const allExpenses = updatedExpSnap.docs
          .map((ed) => ({
            id: ed.id,
            ...(ed.data() as any),
          }))
          .filter((exp: any) => {
            const isUnscopedOrOrphan =
              !exp.billingCycleId ||
              (knownCycleIds.size > 0 &&
                !knownCycleIds.has(exp.billingCycleId));
            return (
              exp.billingCycleId === activeCycleId ||
              (isUnscopedOrOrphan &&
                (isSingleCycle || activeCycleId === oldestCycleId))
            );
          });

        for (const member of activeMembers) {
          const rawUid = member.userId || member.memberId || member.id;
          const uid = normalizeCleanUid(rawUid) || rawUid;
          const billId = `bill_${activeCycleId}_${uid}`;
          const billRef = doc(
            db,
            `households/${householdId}/memberBills`,
            billId,
          );
          const existingSnap = await getDoc(billRef);
          const existing = existingSnap.exists() ? existingSnap.data() : null;
          const prevPaid = Math.max(
            existing?.totalPaidCentavos || 0,
            paymentsByUser.get(uid) || 0,
          );

          // Build line items for this member: preserve any Arrears carried forward from prior cycles
          const arrearsLineItems = (existing?.lineItems || []).filter(
            (li: any) => li.category === "Arrears" || li.isArrears,
          );

          const expenseLineItems = allExpenses.map((exp: any) => {
            const isWater = (exp.category || "")
              .toLowerCase()
              .includes("water");
            const split = exp.splitDetails?.find((s: any) =>
              matchesMemberUid(member, s?.userId || s?.memberId || s?.id),
            );
            const isPayor = isPayorMember(member);
            let share = 0;
            if (isPayor) {
              if (split && typeof split.shareCentavos === "number") {
                share = split.shareCentavos;
              } else if (isWater) {
                const expWaterCfg = resolveCycleWaterConfig(
                  rawWaterConfig,
                  exp.billingCycleId || activeCycleId,
                  {
                    cycleWaterExpense: exp,
                    payorCount: effectivePayors.length,
                    totalCyclesCount: preKnownCycleIds.size,
                  },
                );
                if (expWaterCfg?.pricingModel === "FIXED_PER_PERSON_MONTH") {
                  share = expWaterCfg.fixedPerPersonAmountCentavos || 0;
                } else {
                  share = computeFairSplitShareCentavos(
                    exp.amountCents,
                    effectivePayors,
                    uid,
                  );
                }
              } else {
                share = computeFairSplitShareCentavos(
                  exp.amountCents,
                  effectivePayors,
                  uid,
                );
              }
            }
            const isExempt = !isPayor || Boolean(split?.isExempt);
            const isExpPaid =
              exp.status === "PAID" || exp.isPaid || Boolean(split?.isPaid);
            const daysPresent =
              split?.daysPresent ??
              memberDaysMap.get(rawUid) ??
              memberDaysMap.get(uid) ??
              0;

            return {
              itemId: exp.id,
              description: exp.title,
              category: exp.category,
              amountCentavos: share,
              createdDate:
                exp.createdAt ||
                exp.date ||
                exp.createdDate ||
                new Date().toISOString(),
              status: isExpPaid ? "PAID" : "UNPAID",
              note:
                split?.note ||
                exp.notes ||
                (isExempt
                  ? "Exempted (Non-payor)"
                  : isWater
                    ? `${daysPresent}d water attendance`
                    : `Fair share among ${effectivePayors.length} payors`),
              isExempt,
            };
          });

          const allLineItems = [...arrearsLineItems, ...expenseLineItems];
          const nonExemptLineItems = allLineItems.filter(
            (li: any) => !li.isExempt,
          );
          const grossTotalDue = nonExemptLineItems.reduce(
            (sum: number, li: any) => sum + (li.amountCentavos || 0),
            0,
          );
          const unpaidLineItems = nonExemptLineItems.filter(
            (li: any) => li.status !== "PAID" && !li.isSettled,
          );
          const unpaidOnlyTotalDue = unpaidLineItems.reduce(
            (sum: number, li: any) => sum + (li.amountCentavos || 0),
            0,
          );
          const newTotalDue = prevPaid > 0 ? grossTotalDue : unpaidOnlyTotalDue;
          const newOutstanding = Math.max(0, newTotalDue - prevPaid);

          let remainingCredit = prevPaid;
          const reconciledLineItems = allLineItems.map((li: any) => {
            if (li.isExempt) return li;
            if (li.category === "Arrears" || li.isArrears) {
              const amt = Number(li.amountCentavos) || 0;
              if (amt > 0 && remainingCredit >= amt) {
                remainingCredit -= amt;
                return { ...li, status: "PAID", isSettled: true };
              }
              return li;
            }
            const amt = Number(li.amountCentavos) || 0;
            if (amt > 0 && remainingCredit >= amt) {
              remainingCredit -= amt;
              return { ...li, isSettled: true };
            }
            return li;
          });

          const billData = sanitizeData({
            billId,
            householdId,
            billingCycleId: activeCycleId,
            userId: uid,
            displayName: member.displayName || "Roommate",
            totalDueCentavos: newTotalDue,
            outstandingCentavos: newOutstanding,
            totalPaidCentavos: prevPaid,
            lineItems: reconciledLineItems,
            status: newTotalDue > 0 && newOutstanding === 0 ? "PAID" : "UNPAID",
            updatedDate: new Date().toISOString(),
          });

          await setDoc(billRef, billData, { merge: true });
        }
        // Check if all payors settled for this cycle when expenses exist
        if (allExpenses.length > 0) {
          await this.markExpensesPaidIfAllSettled(householdId, activeCycleId);
        }
      } catch (syncErr) {
        console.warn(
          "[recalculateUnpaidExpensesForHousehold] memberBills sync warning:",
          syncErr,
        );
      }

      return updatedCount;
    } catch (err) {
      console.error("[recalculateUnpaidExpensesForHousehold] Error:", err);
      return 0;
    }
  },

  async cleanupDuplicateMembers(
    householdId: string,
  ): Promise<{ cleaned: number }> {
    if (!householdId) return { cleaned: 0 };
    try {
      const snap = await getDocs(
        collection(db, `households/${householdId}/members`),
      );
      if (snap.empty) return { cleaned: 0 };

      const userGroups = new Map<
        string,
        Array<{ id: string; ref: any; data: any }>
      >();

      snap.forEach((d) => {
        const data = d.data() || {};
        const canonicalKey =
          (data.userId || "").replace(/^mem_/, "").trim() ||
          d.id.replace(/^mem_/, "").trim() ||
          (data.email || "").trim().toLowerCase();

        if (!canonicalKey) return;
        const list = userGroups.get(canonicalKey) || [];
        list.push({ id: d.id, ref: d.ref, data });
        userGroups.set(canonicalKey, list);
      });

      let cleaned = 0;
      for (const [key, docsList] of userGroups.entries()) {
        if (docsList.length > 1) {
          // Identify canonical doc: prefer doc where id === key (pure uid without mem_) or doc with most fields
          docsList.sort((a, b) => {
            const aIsCleanUid = a.id === key ? 1 : 0;
            const bIsCleanUid = b.id === key ? 1 : 0;
            if (aIsCleanUid !== bIsCleanUid) return bIsCleanUid - aIsCleanUid;
            const aFieldCount = Object.keys(a.data).length;
            const bFieldCount = Object.keys(b.data).length;
            return bFieldCount - aFieldCount;
          });

          const canonical = docsList[0];
          const duplicates = docsList.slice(1);

          // Merge fields from duplicates onto canonical
          const mergedData: any = {};
          duplicates.forEach((dup) => {
            if (dup.data.profilePicture && !canonical.data.profilePicture) {
              mergedData.profilePicture = dup.data.profilePicture;
            }
            if (dup.data.photoURL && !canonical.data.photoURL) {
              mergedData.photoURL = dup.data.photoURL;
            }
            if (dup.data.role && !canonical.data.role) {
              mergedData.role = dup.data.role;
            }
            if (dup.data.displayName && !canonical.data.displayName) {
              mergedData.displayName = dup.data.displayName;
            }
          });

          if (Object.keys(mergedData).length > 0) {
            await setDoc(canonical.ref, mergedData, { merge: true }).catch(
              () => {},
            );
          }

          // Delete all duplicate documents from Firestore
          for (const dup of duplicates) {
            await deleteDoc(dup.ref).catch(() => {});
            cleaned++;
          }
        }
      }
      return { cleaned };
    } catch (e) {
      console.warn("[cleanupDuplicateMembers] Notice:", e);
      return { cleaned: 0 };
    }
  },

  async updateUserProfilePicture(
    uid: string,
    photoUrl: string,
    householdId?: string,
  ): Promise<boolean> {
    try {
      const cleanUid = String(uid).replace(/^mem_/, "").trim();
      const userRef = doc(db, "users", cleanUid);
      await setDoc(
        userRef,
        {
          profilePicture: photoUrl,
          photoURL: photoUrl,
          updatedDate: new Date().toISOString(),
        },
        { merge: true },
      );
      if (
        _cachedUserProfile &&
        (_cachedUserProfile.uid === cleanUid || _cachedUserProfile.uid === uid)
      ) {
        _cachedUserProfile.profilePicture = photoUrl;
        _cachedUserProfile.photoURL = photoUrl;
      }
      if (
        auth.currentUser &&
        (auth.currentUser.uid === cleanUid || auth.currentUser.uid === uid)
      ) {
        await updateAuthProfile(auth.currentUser, { photoURL: photoUrl }).catch(
          () => {},
        );
      }
      if (householdId) {
        // Find existing member documents in this household to update in-place without duplicating
        const snap = await getDocs(
          collection(db, `households/${householdId}/members`),
        ).catch(() => null);

        let updatedExisting = false;
        if (snap && !snap.empty) {
          const userEmail = (auth.currentUser?.email || "")
            .trim()
            .toLowerCase();
          for (const d of snap.docs) {
            const data = d.data();
            const docCanonical = (data.userId || d.id || "")
              .replace(/^mem_/, "")
              .trim();
            const docEmail = (data.email || "").trim().toLowerCase();

            if (
              docCanonical === cleanUid ||
              (docEmail && userEmail && docEmail === userEmail)
            ) {
              updatedExisting = true;
              await updateDoc(d.ref, {
                profilePicture: photoUrl,
                photoURL: photoUrl,
              }).catch(() => {});
            }
          }
        }

        // Only create if completely absent
        if (!updatedExisting) {
          const memRef = doc(db, `households/${householdId}/members`, cleanUid);
          await setDoc(
            memRef,
            {
              userId: cleanUid,
              profilePicture: photoUrl,
              photoURL: photoUrl,
            },
            { merge: true },
          ).catch(() => {});
        }

        // Clean up any existing duplicate member documents
        this.cleanupDuplicateMembers(householdId).catch(() => {});
      }
      return true;
    } catch (err) {
      console.error("[updateUserProfilePicture Mobile] Error:", err);
      return false;
    }
  },

  async updateHouseholdRates(householdId: string, rates: any) {
    const docRef = doc(db, "households", householdId);
    await setDoc(
      docRef,
      { rates, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  },

  // --- EXPENSES / BILLS ---
  async addExpense(
    expense: Omit<MobileExpense, "id" | "createdAt">,
  ): Promise<string> {
    const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const ref = doc(db, `households/${expense.householdId}/expenses`, id);
    const status = expense.status || (expense.isPaid ? "PAID" : "UNPAID");
    const isPaid = status === "PAID";

    // 0. Resolve active billingCycleId immediately so the expense document and memberBills are always scoped to the active cycle
    let resolvedCycleId = expense.billingCycleId;
    if (!resolvedCycleId) {
      try {
        const cyclesSnap = await getDocs(
          collection(db, `households/${expense.householdId}/billingCycles`),
        );
        const cycles = sortBillingCyclesNewest(
          cyclesSnap.docs.map((d) => d.data()),
        );
        const active = cycles[0];
        if (active?.billingCycleId) {
          resolvedCycleId = active.billingCycleId;
        } else {
          resolvedCycleId = `bc_${Date.now()}`;
          const now = new Date();
          const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          const cycleName = `${monthNames[now.getMonth()]} ${now.getFullYear()} Billing`;
          await setDoc(
            doc(
              db,
              `households/${expense.householdId}/billingCycles`,
              resolvedCycleId,
            ),
            sanitizeData({
              billingCycleId: resolvedCycleId,
              householdId: expense.householdId,
              name: cycleName,
              startDate: new Date(now.getFullYear(), now.getMonth(), 1)
                .toISOString()
                .slice(0, 10),
              endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0)
                .toISOString()
                .slice(0, 10),
              status: "ACTIVE",
              paymentsLocked: true,
              isFinalized: false,
              paymentsOpenedByHost: false,
              createdDate: new Date().toISOString(),
              updatedDate: new Date().toISOString(),
            }),
            { merge: true },
          );
        }
      } catch {}
    }

    // 1. Fetch active household members to calculate automatic splits
    let activeMembers: any[] = [];
    try {
      const memSnap = await getDocs(
        collection(db, `households/${expense.householdId}/members`),
      );
      const allMem: any[] = [];
      memSnap.forEach((d) => allMem.push(d.data()));
      activeMembers = allMem.filter((m) => m.status === "ACTIVE");
    } catch (err) {
      console.warn(
        "[addExpense Mobile] Could not load members for split:",
        err,
      );
    }

    if (activeMembers.length === 0) {
      activeMembers = [
        {
          userId: expense.payerId || auth.currentUser?.uid || "host",
          displayName:
            expense.payerName || auth.currentUser?.displayName || "Host",
          role: "HOST",
        },
      ];
    }

    // 2. Compute split details across members (Fairly on Payors Only, Water absorption rule)
    const activePayors = activeMembers.filter((m) => isPayorMember(m));
    const activeNonPayors = activeMembers.filter((m) => !isPayorMember(m));
    const effectivePayors =
      activePayors.length > 0 ? activePayors : activeMembers;

    const isWater = (expense.category || "").toLowerCase().includes("water");

    let splitDetails: any[] = [];
    if (
      expense.splitDetails &&
      Array.isArray(expense.splitDetails) &&
      expense.splitDetails.length > 0
    ) {
      splitDetails = expense.splitDetails;
    } else if (isWater) {
      // Water mode: 5/person/day attendance rule.
      // Payors pay their OWN water + water from non-payors. NEVER split other payors' water on this payor!
      const cycleId = resolvedCycleId || expense.billingCycleId;
      let rawWaterConfig: any = null;
      try {
        const wSnap = await getDoc(
          doc(db, `households/${expense.householdId}/systemSettings`, "water"),
        );
        if (wSnap.exists()) rawWaterConfig = wSnap.data();
      } catch {}
      const waterConfig = resolveCycleWaterConfig(rawWaterConfig, cycleId, {
        cycleWaterExpense: expense,
        payorCount: effectivePayors.length,
      });

      const pricingModel = waterConfig?.pricingModel || "PER_PERSON_DAY";
      if (pricingModel === "PER_PERSON_DAY") {
        const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
        let attRecords: any[] = [];
        let subRecords: any[] = [];
        if (cycleId) {
          try {
            const [attSnap, subSnap] = await Promise.all([
              getDocs(
                query(
                  collection(
                    db,
                    `households/${expense.householdId}/waterAttendance`,
                  ),
                  where("billingCycleId", "==", cycleId),
                ),
              ).catch(() => null),
              getDocs(
                query(
                  collection(
                    db,
                    `households/${expense.householdId}/attendanceSubmissions`,
                  ),
                  where("billingCycleId", "==", cycleId),
                ),
              ).catch(() => null),
            ]);
            if (attSnap) attRecords = attSnap.docs.map((d) => d.data());
            if (subSnap) subRecords = subSnap.docs.map((d) => d.data());
          } catch {}
        }
        const { membersBreakdown } = computeCycleWaterBreakdown(
          activeMembers,
          attRecords,
          subRecords,
          rate,
        );

        splitDetails = membersBreakdown.map((item) => ({
          userId: item.userId,
          displayName: item.displayName,
          shareCentavos: item.shareCentavos,
          ownWaterCentavos: item.ownWaterCentavos,
          nonPayorWaterCentavos: item.nonPayorWaterCentavos,
          daysPresent: item.daysPresent,
          rateCentavosPerDay: item.rateCentavosPerDay,
          isPaid: item.isExempt ? true : isPaid,
          isExempt: item.isExempt,
          role: item.role,
          note: item.note,
        }));
      } else if (pricingModel === "FIXED_PER_PERSON_MONTH") {
        const flatRate = waterConfig?.fixedPerPersonAmountCentavos || 0;
        splitDetails = activeMembers.map((m) => {
          const isPayor = isPayorMember(m);
          return {
            userId: m.userId || m.memberId,
            displayName: m.displayName || "Roommate",
            shareCentavos: isPayor ? flatRate : 0,
            isPaid: !isPayor || isPaid,
            isExempt: !isPayor,
            role: m.role || (isPayor ? "PAYOR" : "NON_PAYOR"),
            note: isPayor
              ? `Flat rate water bill: ₱${(flatRate / 100).toFixed(2)}/mo`
              : "Exempted (Non-payor)",
          };
        });
      } else {
        splitDetails = activeMembers.map((m) => {
          const uid = m.userId || m.memberId || m.id || "";
          const isPayor = isPayorMember(m);
          const shareCentavos = isPayor
            ? computeFairSplitShareCentavos(
                expense.amountCents,
                effectivePayors,
                uid,
              )
            : 0;
          return {
            userId: uid,
            displayName: m.displayName || "Roommate",
            shareCentavos,
            isPaid: !isPayor || isPaid,
            isExempt: !isPayor,
            role: m.role || (isPayor ? "PAYOR" : "NON_PAYOR"),
            note: isPayor
              ? `Water bill split fairly across ${effectivePayors.length} payors`
              : "Exempted (Non-payor)",
          };
        });
      }
    } else {
      // Standard Bills (Rent, Wifi, Groceries, Electricity, Other):
      // Fairly split ONLY on payors. Non-payors are 100% exempted.
      const payorCount = Math.max(1, effectivePayors.length);

      splitDetails = activeMembers.map((m) => {
        const uid = m.userId || m.memberId || m.id || "";
        const isPayor = isPayorMember(m);
        if (isPayor) {
          const shareCentavos = computeFairSplitShareCentavos(
            expense.amountCents,
            effectivePayors,
            uid,
          );
          return {
            userId: uid,
            displayName: m.displayName || "Roommate",
            shareCentavos,
            percentage: Math.round((100 / payorCount) * 10) / 10,
            isPaid,
            isExempt: false,
            role: m.role || "PAYOR",
            note: `Fair share among ${payorCount} payors (Non-payors exempt)`,
          };
        } else {
          return {
            userId: m.userId || m.memberId,
            displayName: m.displayName || "Roommate",
            shareCentavos: 0,
            percentage: 0,
            isPaid: true,
            isExempt: true,
            role: "NON_PAYOR",
            note: "Exempted (Non-payor)",
          };
        }
      });
    }

    const splitsMap: Record<string, number> = {};
    splitDetails.forEach((s) => {
      if (s.userId) splitsMap[s.userId] = s.shareCentavos;
    });

    const createdAtIso = new Date().toISOString();
    const payload: MobileExpense = {
      ...expense,
      billingCycleId: resolvedCycleId || expense.billingCycleId,
      status,
      isPaid,
      id,
      splitDetails,
      splits: splitsMap,
      createdAt: createdAtIso,
    };

    // 3. Update memberBills in Firestore BEFORE writing expense doc so real-time listeners never see a 0-outstanding bill for a newly added expense
    try {
      const cycleId = resolvedCycleId || expense.billingCycleId;
      if (cycleId) {
        for (const item of splitDetails) {
          const billId = `bill_${cycleId}_${item.userId}`;
          const billRef = doc(
            db,
            `households/${expense.householdId}/memberBills`,
            billId,
          );
          const existingSnap = await getDoc(billRef);
          const existing = existingSnap.exists() ? existingSnap.data() : null;

          const lineItem = {
            itemId: id,
            description: expense.title,
            category: expense.category,
            amountCentavos: item.shareCentavos,
            createdDate: payload.createdAt,
            status,
            note: item.note || "",
            isExempt: Boolean(item.isExempt),
          };

          const existingLineItems = existing?.lineItems || [];
          const updatedLineItems = [
            ...existingLineItems.filter((li: any) => li.itemId !== id),
            lineItem,
          ];
          const prevPaid = existing?.totalPaidCentavos || 0;
          const nonExemptItems = updatedLineItems.filter(
            (li: any) => !li.isExempt,
          );
          const grossTotalDue = nonExemptItems.reduce(
            (sum: number, li: any) => sum + (Number(li.amountCentavos) || 0),
            0,
          );
          const unpaidOnlyTotalDue = nonExemptItems
            .filter((li: any) => li.status !== "PAID" && !li.isSettled)
            .reduce(
              (sum: number, li: any) => sum + (Number(li.amountCentavos) || 0),
              0,
            );
          const newTotalDue = prevPaid > 0 ? grossTotalDue : unpaidOnlyTotalDue;
          const newOutstanding = Math.max(0, newTotalDue - prevPaid);

          const billData = sanitizeData({
            billId,
            householdId: expense.householdId,
            billingCycleId: cycleId,
            userId: item.userId,
            displayName: item.displayName,
            totalDueCentavos: newTotalDue,
            outstandingCentavos: newOutstanding,
            totalPaidCentavos: prevPaid,
            lineItems: updatedLineItems,
            status: newTotalDue > 0 && newOutstanding === 0 ? "PAID" : "UNPAID",
            updatedDate: new Date().toISOString(),
          });

          await setDoc(billRef, billData, { merge: true });
        }
      }
    } catch (billErr) {
      console.warn(
        "[Firestore Mobile] auto memberBills creation warning:",
        billErr,
      );
    }

    await setDoc(ref, sanitizeData(payload));

    // 4. Mirror to charges collection for instantaneous cross-platform Web sync
    try {
      const categoryUpper = (expense.category || "").toUpperCase();
      let chargeType = "CUSTOM";
      if (categoryUpper.includes("RENT")) chargeType = "RENT";
      else if (categoryUpper.includes("ELEC")) chargeType = "ELECTRICITY";
      else if (categoryUpper.includes("WATER")) chargeType = "WATER";
      else if (
        categoryUpper.includes("NET") ||
        categoryUpper.includes("WIFI") ||
        categoryUpper.includes("INTERNET")
      )
        chargeType = "INTERNET";

      const chargeRef = doc(
        db,
        `households/${expense.householdId}/charges`,
        id,
      );
      await setDoc(
        chargeRef,
        sanitizeData({
          chargeId: id,
          householdId: expense.householdId,
          billingCycleId: resolvedCycleId || expense.billingCycleId || "",
          chargeType,
          name: expense.title,
          description: expense.notes || "",
          amountCentavos: expense.amountCents,
          distributionMethod:
            expense.splitMethod === "% Custom" ? "CUSTOM" : "PAYORS_ONLY",
          participantUserIds: splitDetails
            .filter((s) => !s.isExempt)
            .map((s) => s.userId),
          splitDetails,
          createdDate: payload.createdAt,
          createdBy: expense.payerId || "",
        }),
        { merge: true },
      );
    } catch (mirrorErr) {
      console.warn(
        "[Firestore Mobile] mirror expense to charges failed:",
        mirrorErr,
      );
    }

    // 5. Save real expense notification to Firestore `notifications` collection for household members
    try {
      const hhName =
        _cachedHousehold?.householdName ||
        _cachedHousehold?.name ||
        "Household";
      const cleanTitle =
        cleanBillTitle(expense.title, expense.category, hhName) ||
        expense.category ||
        "Expense";
      const amtStr = formatPesos(expense.amountCents);
      const payer = expense.payerName || "Host";
      const itemId = `exp_${id}`;
      const myUid = (expense.payerId || auth.currentUser?.uid || "").trim();
      const allRecipientIds = Array.from(
        new Set(
          [
            ...activeMembers.map((m) => {
              const raw = m.userId || m.memberId;
              return raw ? String(raw).replace(/^mem_/, "").trim() : "";
            }),
            auth.currentUser?.uid || "",
          ].filter(Boolean),
        ),
      );
      const pushRecipientIds = allRecipientIds.filter((uid) => uid !== myUid);

      await Promise.all(
        allRecipientIds.map((recipientUid) => {
          const notifId = `notif_${recipientUid}_${itemId}`;
          return setDoc(
            doc(db, "notifications", notifId),
            sanitizeData({
              notificationId: notifId,
              recipientId: recipientUid,
              householdId: expense.householdId,
              type: "BILL_UPDATED",
              category: "expense_added",
              title: "New Expense Added!",
              message: `${payer} added "${amtStr} for ${cleanTitle}" in ${hhName} group.`,
              spans: [
                { text: `${payer} added ` },
                {
                  text: `"${amtStr} for ${cleanTitle}"`,
                  bold: true,
                  color: "#334155",
                },
                { text: ` in ${hhName} group.` },
              ],
              relatedItemId: itemId,
              relatedEntityId: id,
              readStatus: false,
              createdTimestamp: payload.createdAt,
            }),
            { merge: true },
          ).catch(() => {});
        }),
      );

      // Dispatch high-priority OS-level push notification so roommates get a lock-screen alert even when their app is closed
      pushDispatchService
        .sendNewBillPush({
          householdId: expense.householdId,
          householdName: hhName,
          payerId: myUid,
          payerName: payer,
          billTitle: cleanTitle,
          amountCents: expense.amountCents,
          expenseId: id,
          recipientUserIds: pushRecipientIds,
        })
        .catch((pushErr) => {
          console.warn("[addExpense Mobile] Push dispatch deferred:", pushErr);
        });
    } catch {}

    return id;
  },

  async addBill(
    bill: Omit<MobileExpense, "id" | "createdAt">,
  ): Promise<string> {
    return this.addExpense(bill);
  },

  listenToExpenses(
    householdId: string,
    callback: (expenses: MobileExpense[]) => void,
  ) {
    const q = collection(db, `households/${householdId}/expenses`);
    return onSnapshot(
      q,
      (snap) => {
        const items: MobileExpense[] = [];
        snap.forEach((d) => items.push(d.data() as MobileExpense));
        // Sort newest first
        items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        callback(items);
      },
      (err) => console.warn("[Firestore Mobile] listenToExpenses:", err),
    );
  },

  async updateExpenseStatus(
    householdId: string,
    expenseId: string,
    isPaid: boolean,
  ): Promise<boolean> {
    try {
      const expRef = doc(db, `households/${householdId}/expenses`, expenseId);
      const snap = await getDoc(expRef);
      const data = snap.exists() ? snap.data() : null;
      let splitDetails = data?.splitDetails;
      if (Array.isArray(splitDetails)) {
        splitDetails = splitDetails.map((s: any) => ({
          ...s,
          isPaid: s.isExempt ? true : isPaid,
        }));
      }
      await updateDoc(expRef, {
        status: isPaid ? "PAID" : "UNPAID",
        isPaid,
        ...(splitDetails ? { splitDetails } : {}),
        updatedDate: new Date().toISOString(),
      });
      // Synchronize unpaid expenses and member bills
      this.recalculateUnpaidExpensesForHousehold(householdId).catch(() => {});
      return true;
    } catch (err) {
      console.error("[updateExpenseStatus] Error:", err);
      return false;
    }
  },

  async updateExpense(
    householdId: string,
    expenseId: string,
    updates: {
      title?: string;
      category?: string;
      amountCents?: number;
      notes?: string;
      status?: "PAID" | "UNPAID";
      isPaid?: boolean;
      splitDetails?: any[];
      splitMethod?: "Equal" | "% Custom";
      billingCycleId?: string;
      previousReadingKwh?: number;
      currentReadingKwh?: number;
      consumedKwh?: number;
      rateCentavosPerKwh?: number;
    },
  ): Promise<boolean> {
    try {
      const expRef = doc(db, `households/${householdId}/expenses`, expenseId);
      const snap = await getDoc(expRef);
      if (!snap.exists()) return false;
      const currentData = snap.data();

      const newAmountCents =
        updates.amountCents !== undefined
          ? updates.amountCents
          : currentData.amountCents;
      const newStatus =
        updates.status !== undefined
          ? updates.status
          : updates.isPaid !== undefined
            ? updates.isPaid
              ? "PAID"
              : "UNPAID"
            : currentData.status;
      const isPaid = newStatus === "PAID";

      let splitDetails = updates.splitDetails || currentData.splitDetails;
      if (
        Array.isArray(splitDetails) &&
        splitDetails.length > 0 &&
        updates.amountCents !== undefined &&
        updates.amountCents !== currentData.amountCents
      ) {
        const payorEntries = splitDetails.filter((s: any) => !s.isExempt);
        splitDetails = splitDetails.map((s: any) => {
          if (s.isExempt) {
            return { ...s, shareCentavos: 0, isPaid: true };
          }
          const shareCentavos = computeFairSplitShareCentavos(
            newAmountCents,
            payorEntries,
            s.userId || s.memberId || s.id || "",
          );
          const prevActualPaid =
            typeof s.paidAmountCentavos === "number"
              ? s.paidAmountCentavos
              : s.paymentId || s.paidDate
                ? Number(s.shareCentavos) || 0
                : 0;
          return {
            ...s,
            shareCentavos,
            isPaid:
              isPaid || (shareCentavos > 0 && prevActualPaid >= shareCentavos),
          };
        });
      } else if (
        Array.isArray(splitDetails) &&
        (updates.status !== undefined || updates.isPaid !== undefined)
      ) {
        splitDetails = splitDetails.map((s: any) => ({
          ...s,
          isPaid: s.isExempt ? true : isPaid,
        }));
      }

      const splitsMap: Record<string, number> = {};
      if (Array.isArray(splitDetails)) {
        splitDetails.forEach((s: any) => {
          if (s.userId) splitsMap[s.userId] = Number(s.shareCentavos) || 0;
        });
      }

      const nowIso = new Date().toISOString();
      const effectiveCycleId =
        updates.billingCycleId || currentData.billingCycleId;
      const effectiveCategory = updates.category ?? currentData.category ?? "";

      await updateDoc(
        expRef,
        sanitizeData({
          ...updates,
          status: newStatus,
          isPaid,
          splitDetails,
          splits:
            Object.keys(splitsMap).length > 0 ? splitsMap : currentData.splits,
          updatedAt: nowIso,
          updatedDate: nowIso,
        }),
      );

      // Keep mirrored charges document in sync if present
      await setDoc(
        doc(db, `households/${householdId}/charges`, expenseId),
        sanitizeData({
          chargeId: expenseId,
          householdId,
          billingCycleId: effectiveCycleId,
          name: updates.title ?? currentData.title,
          description: updates.notes ?? currentData.notes ?? "",
          amountCentavos: newAmountCents,
          splitDetails,
          updatedDate: nowIso,
        }),
        { merge: true },
      ).catch(() => {});

      // Keep systemSettings/electricity in sync when editing an Electricity bill
      if (effectiveCategory.toLowerCase().includes("electric")) {
        try {
          const elecRef = doc(
            db,
            `households/${householdId}/systemSettings`,
            "electricity",
          );
          const elecSnap = await getDoc(elecRef);
          const elecData = elecSnap.exists() ? elecSnap.data() : {};
          const existingCycles =
            elecData.cycles && typeof elecData.cycles === "object"
              ? { ...elecData.cycles }
              : {};
          const prevCycleEntry =
            (effectiveCycleId && existingCycles[effectiveCycleId]) || {};
          const updatedPrevKwh =
            updates.previousReadingKwh ??
            currentData.previousReadingKwh ??
            prevCycleEntry.previousReadingKwh;
          const updatedCurrKwh =
            updates.currentReadingKwh ??
            currentData.currentReadingKwh ??
            prevCycleEntry.currentReadingKwh;
          const updatedRate =
            updates.rateCentavosPerKwh ??
            currentData.rateCentavosPerKwh ??
            prevCycleEntry.rateCentavosPerKwh ??
            elecData.rateCentavosPerKwh ??
            1200;
          const updatedConsumed =
            updates.consumedKwh ??
            currentData.consumedKwh ??
            prevCycleEntry.consumedKwh;

          if (effectiveCycleId) {
            existingCycles[effectiveCycleId] = sanitizeData({
              ...prevCycleEntry,
              previousReadingKwh: updatedPrevKwh,
              currentReadingKwh: updatedCurrKwh,
              rateCentavosPerKwh: updatedRate,
              consumedKwh: updatedConsumed,
              totalAmountCentavos: newAmountCents,
              billingCycleId: effectiveCycleId,
              updatedAt: nowIso,
            });
          }

          await setDoc(
            elecRef,
            sanitizeData({
              totalAmountCentavos: newAmountCents,
              ...(updatedPrevKwh !== undefined
                ? { previousReadingKwh: updatedPrevKwh }
                : {}),
              ...(updatedCurrKwh !== undefined
                ? {
                    currentReadingKwh: updatedCurrKwh,
                    lastCurrentReadingKwh: updatedCurrKwh,
                  }
                : {}),
              ...(updatedRate !== undefined
                ? { rateCentavosPerKwh: updatedRate }
                : {}),
              ...(updatedConsumed !== undefined
                ? { consumedKwh: updatedConsumed }
                : {}),
              cycles: existingCycles,
              updatedAt: nowIso,
            }),
            { merge: true },
          );
        } catch {}
      }

      // Recalculate unpaid expenses and member bills across household
      await this.recalculateUnpaidExpensesForHousehold(
        householdId,
        effectiveCycleId,
      ).catch(() => {});
      return true;
    } catch (err) {
      console.error("[updateExpense] Error:", err);
      throw err;
    }
  },

  async deleteExpense(
    householdId: string,
    expenseId: string,
  ): Promise<boolean> {
    try {
      const expRef = doc(db, `households/${householdId}/expenses`, expenseId);
      const expSnap = await getDoc(expRef).catch(() => null);
      const expData = expSnap && expSnap.exists() ? expSnap.data() : null;
      const targetCycleId = expData?.billingCycleId;
      await deleteDoc(expRef);
      await deleteDoc(
        doc(db, `households/${householdId}/charges`, expenseId),
      ).catch(() => {});

      if (
        targetCycleId &&
        (expData?.category || "").toLowerCase().includes("electric")
      ) {
        try {
          const elecRef = doc(
            db,
            `households/${householdId}/systemSettings`,
            "electricity",
          );
          const elecSnap = await getDoc(elecRef);
          if (elecSnap.exists()) {
            const elecData = elecSnap.data();
            if (elecData?.cycles?.[targetCycleId]) {
              const nextCycles = { ...elecData.cycles };
              delete nextCycles[targetCycleId];
              await updateDoc(elecRef, {
                cycles: nextCycles,
                updatedAt: new Date().toISOString(),
              });
            }
          }
        } catch {}
      }

      if (
        targetCycleId &&
        (expData?.category || "").toLowerCase().includes("water")
      ) {
        try {
          const waterRef = doc(
            db,
            `households/${householdId}/systemSettings`,
            "water",
          );
          const waterSnap = await getDoc(waterRef);
          if (waterSnap.exists()) {
            const waterData = waterSnap.data();
            const nextCycles =
              waterData?.cycles && typeof waterData.cycles === "object"
                ? { ...waterData.cycles }
                : {};
            delete nextCycles[targetCycleId];
            await updateDoc(waterRef, {
              cycles: nextCycles,
              billingCycleId:
                waterData?.billingCycleId === targetCycleId
                  ? ""
                  : waterData?.billingCycleId || "",
              updatedAt: new Date().toISOString(),
            });
          }
        } catch {}
      }

      // Recalculate unpaid expenses and member bills across household
      await this.recalculateUnpaidExpensesForHousehold(
        householdId,
        targetCycleId,
      ).catch(() => {});
      return true;
    } catch (err) {
      console.error("[deleteExpense] Error:", err);
      throw err;
    }
  },

  async createBillingCycle(
    householdId: string,
    cycleData: {
      name: string;
      startDate: string;
      endDate: string;
      status?: string;
    },
  ): Promise<string> {
    const nowIso = new Date().toISOString();
    const billingCycleId = `bc_${Date.now()}`;

    // 1. Close any previously ACTIVE billing cycles and backfill any unscoped expenses to the closing cycle so previous cycle bills (e.g., Rent) never disappear
    let priorCycleId: string | undefined;
    let priorCycleName = "Previous Cycle";
    const priorBillsByUser = new Map<string, any>();
    try {
      const existingCyclesSnap = await getDocs(
        collection(db, `households/${householdId}/billingCycles`),
      );
      const existingCycles = sortBillingCyclesNewest(
        existingCyclesSnap.docs.map((cd) => ({
          ...cd.data(),
          billingCycleId: cd.data().billingCycleId || cd.id,
        })),
      );
      const knownIds = new Set(
        existingCycles.map((c: any) => c.billingCycleId).filter(Boolean),
      );
      const priorCycle =
        existingCycles.find((c: any) => c.status === "ACTIVE") ||
        existingCycles[0];
      priorCycleId = priorCycle?.billingCycleId;
      if (priorCycle?.name) {
        priorCycleName = priorCycle.name;
      }

      if (priorCycleId) {
        try {
          const [expSnap, priorMemberBillsSnap] = await Promise.all([
            getDocs(collection(db, `households/${householdId}/expenses`)),
            getDocs(collection(db, `households/${householdId}/memberBills`)),
          ]);

          priorMemberBillsSnap.docs.forEach((bd) => {
            const bData = bd.data();
            const rawUser = bData.userId || bData.memberId;
            const cleanUser = normalizeCleanUid(rawUser);
            if (bData.billingCycleId === priorCycleId && cleanUser) {
              const existing = priorBillsByUser.get(cleanUser);
              if (
                !existing ||
                bd.id.startsWith("bill_") ||
                Number(bData.totalPaidCentavos || 0) >
                  Number(existing.totalPaidCentavos || 0)
              ) {
                priorBillsByUser.set(cleanUser, bData);
              }
            }
          });

          await Promise.all(
            expSnap.docs.map(async (ed) => {
              const eData = ed.data();
              if (
                !eData.billingCycleId ||
                !knownIds.has(eData.billingCycleId)
              ) {
                await updateDoc(ed.ref, {
                  billingCycleId: priorCycleId,
                  updatedDate: nowIso,
                }).catch(() => {});
              }
            }),
          );
        } catch {}
      }

      await Promise.all(
        existingCyclesSnap.docs.map(async (cd) => {
          const data = cd.data();
          if (
            (data.status === "ACTIVE" || data.status === "FINALIZED") &&
            cd.id !== billingCycleId
          ) {
            await updateDoc(
              doc(db, `households/${householdId}/billingCycles`, cd.id),
              {
                status: "CLOSED",
                closedDate: nowIso,
                updatedDate: nowIso,
              },
            ).catch(() => {});
          }
        }),
      );
    } catch (closeErr) {
      console.warn(
        "[createBillingCycle] warning closing prior cycles:",
        closeErr,
      );
    }

    // 1b. Preserve closing cycle's electricity snapshot and store lastCurrentReadingKwh for rollover without stamping the new cycle
    try {
      const elecRef = doc(
        db,
        `households/${householdId}/systemSettings`,
        "electricity",
      );
      const elecSnap = await getDoc(elecRef);
      if (elecSnap.exists()) {
        const elecData = elecSnap.data();
        const rolledReading = Number(
          elecData.lastCurrentReadingKwh ??
            elecData.currentReadingKwh ??
            elecData.previousReadingKwh ??
            0,
        );
        const existingCyclesMap =
          elecData.cycles && typeof elecData.cycles === "object"
            ? { ...elecData.cycles }
            : {};
        if (
          elecData.billingCycleId &&
          !existingCyclesMap[elecData.billingCycleId] &&
          (Number(elecData.consumedKwh ?? 0) > 0 ||
            Number(elecData.totalAmountCentavos ?? 0) > 0)
        ) {
          existingCyclesMap[elecData.billingCycleId] = {
            previousReadingKwh: Number(elecData.previousReadingKwh ?? 0),
            currentReadingKwh: Number(elecData.currentReadingKwh ?? 0),
            rateCentavosPerKwh: Number(elecData.rateCentavosPerKwh ?? 1200),
            consumedKwh: Number(elecData.consumedKwh ?? 0),
            totalAmountCentavos: Number(elecData.totalAmountCentavos ?? 0),
            billingCycleId: elecData.billingCycleId,
            updatedAt: elecData.updatedAt || nowIso,
          };
        }
        await setDoc(
          elecRef,
          sanitizeData({
            lastCurrentReadingKwh: rolledReading,
            previousReadingKwh: rolledReading,
            currentReadingKwh: rolledReading,
            consumedKwh: 0,
            totalAmountCentavos: 0,
            rateCentavosPerKwh: Number(elecData.rateCentavosPerKwh ?? 1200),
            billingCycleId: "",
            cycles: existingCyclesMap,
            updatedAt: nowIso,
          }),
          { merge: true },
        ).catch(() => {});
      }
    } catch {}

    // 1c. Snapshot closing cycle's water configuration into cycles[priorCycleId] and clear top-level billingCycleId so the new cycle starts unconfigured
    try {
      const waterRef = doc(
        db,
        `households/${householdId}/systemSettings`,
        "water",
      );
      const waterSnap = await getDoc(waterRef);
      if (waterSnap.exists()) {
        const waterData = waterSnap.data();
        const existingWaterCycles =
          waterData.cycles && typeof waterData.cycles === "object"
            ? { ...waterData.cycles }
            : {};
        const closingWaterCid =
          waterData.billingCycleId ||
          (!waterData.cycles && waterData.updatedAt && priorCycleId
            ? priorCycleId
            : "");
        if (
          closingWaterCid &&
          !existingWaterCycles[closingWaterCid] &&
          waterData.updatedAt
        ) {
          existingWaterCycles[closingWaterCid] = {
            pricingModel:
              waterData.pricingModel ||
              (waterData.fixedMonthlyAmountCentavos
                ? "FIXED_MONTHLY"
                : "PER_PERSON_DAY"),
            rateCentavosPerPersonPerDay: Number(
              waterData.rateCentavosPerPersonPerDay ?? 500,
            ),
            fixedMonthlyAmountCentavos: Number(
              waterData.fixedMonthlyAmountCentavos ?? 0,
            ),
            fixedPerPersonAmountCentavos: Number(
              waterData.fixedPerPersonAmountCentavos ?? 0,
            ),
            mode: waterData.mode || "BILLING_CYCLE",
            billingCycleId: closingWaterCid,
            updatedAt: waterData.updatedAt || nowIso,
          };
        }
        await setDoc(
          waterRef,
          sanitizeData({
            billingCycleId: "",
            cycles: existingWaterCycles,
          }),
          { merge: true },
        ).catch(() => {});
      }
    } catch {}

    // 2. Create the new ACTIVE billing cycle starting with 0 bills and payments locked until host opens them
    const ref = doc(
      db,
      `households/${householdId}/billingCycles`,
      billingCycleId,
    );
    const newCycle = {
      billingCycleId,
      householdId,
      name: cycleData.name.trim(),
      startDate: cycleData.startDate,
      endDate: cycleData.endDate,
      status: cycleData.status || "ACTIVE",
      paymentsLocked: true,
      isFinalized: false,
      paymentsOpenedByHost: false,
      totalBilledCentavos: 0,
      totalCollectedCentavos: 0,
      createdDate: nowIso,
      updatedDate: nowIso,
    };
    await Promise.all([
      setDoc(ref, sanitizeData(newCycle), { merge: true }),
      updateDoc(doc(db, "households", householdId), {
        paymentsLocked: true,
        paymentsOpenedByHost: false,
        updatedAt: nowIso,
      }).catch(() => {}),
    ]);

    // 3. Reset all active payors' settlement status and initialize fresh memberBills for the new cycle (carrying forward ONLY genuinely unpaid prior-cycle arrears)
    try {
      const [
        membersSnap,
        latestCyclesSnap,
        latestExpSnap,
        latestBillsSnap,
        latestPmtsSnap,
      ] = await Promise.all([
        getDocs(collection(db, `households/${householdId}/members`)),
        getDocs(collection(db, `households/${householdId}/billingCycles`)),
        getDocs(collection(db, `households/${householdId}/expenses`)),
        getDocs(collection(db, `households/${householdId}/memberBills`)),
        getDocs(collection(db, `households/${householdId}/payments`)),
      ]);

      const priorCyclesOnly = latestCyclesSnap.docs
        .map((cd) => ({
          ...cd.data(),
          billingCycleId: cd.data().billingCycleId || cd.id,
        }))
        .filter((c: any) => c.billingCycleId !== billingCycleId);

      const priorSettlement = evaluateHouseholdCycleSettlements({
        cycles: priorCyclesOnly,
        expenses: latestExpSnap.docs.map(
          (ed) => ({ id: ed.id, ...ed.data() }) as MobileExpense,
        ),
        payments: latestPmtsSnap.docs.map((pd) => pd.data() as MobilePayment),
        allMemberBills: latestBillsSnap.docs.map((bd) => ({
          billId: bd.id,
          ...bd.data(),
        })),
        members: membersSnap.docs.map((md) => ({
          id: md.id,
          ...md.data(),
        })),
      });

      // Also persist PAID status on any prior cycles whose payors settled via rollover
      if (priorCycleId) {
        for (const cycId of priorSettlement.orderedCycleIdsOldestFirst) {
          if (priorSettlement.allPayorsSettledByCycle.get(cycId)) {
            await this.markExpensesPaidIfAllSettled(householdId, cycId).catch(
              () => {},
            );
          }
        }
      }

      await Promise.all(
        membersSnap.docs.map(async (md) => {
          const mData = md.data();
          const uid = mData.userId || mData.memberId || md.id;
          const cleanUid = normalizeCleanUid(uid);
          const isActiveOrSettled =
            !mData.status ||
            mData.status === "ACTIVE" ||
            mData.status === "SETTLED";
          if (!isActiveOrSettled) return;

          if (
            mData.status === "SETTLED" ||
            mData.paymentStatus === "PAID" ||
            mData.paymentStatus === "SETTLED" ||
            mData.isPaid === true
          ) {
            await updateDoc(
              doc(db, `households/${householdId}/members`, md.id),
              {
                status: "ACTIVE",
                paymentStatus: "UNPAID",
                isPaid: false,
                updatedDate: nowIso,
              },
            ).catch(() => {});
          }

          if (uid && cleanUid) {
            let priorOutstandingCentavos = 0;
            if (priorCycleId && isPayorMember(mData)) {
              const summary = priorSettlement.getMemberCycleSummary(
                priorCycleId,
                mData,
              );
              priorOutstandingCentavos = Math.max(
                0,
                summary.totalOwesAsOfCycleCentavos,
              );
            }

            const initialLineItems: any[] = [];
            if (priorOutstandingCentavos > 0 && priorCycleId) {
              initialLineItems.push({
                itemId: `arrears_${priorCycleId}_${cleanUid}`,
                description: `Previous Balance (${priorCycleName})`,
                category: "Arrears",
                amountCentavos: priorOutstandingCentavos,
                createdDate: nowIso,
                status: "UNPAID",
                note: `Unsettled dues carried over from ${priorCycleName}`,
                isExempt: false,
                isArrears: true,
                priorCycleId,
              });
            }

            const billId = `bill_${billingCycleId}_${cleanUid}`;
            const billRef = doc(
              db,
              `households/${householdId}/memberBills`,
              billId,
            );
            await setDoc(
              billRef,
              sanitizeData({
                billId,
                householdId,
                billingCycleId,
                userId: cleanUid,
                displayName: mData.displayName || "Roommate",
                totalDueCentavos: priorOutstandingCentavos,
                outstandingCentavos: priorOutstandingCentavos,
                totalPaidCentavos: 0,
                paidCentavos: 0,
                lineItems: initialLineItems,
                status: "UNPAID",
                createdDate: nowIso,
                updatedDate: nowIso,
              }),
              { merge: true },
            ).catch(() => {});
          }
        }),
      );
    } catch (memResetErr) {
      console.warn(
        "[createBillingCycle] warning resetting member bill state:",
        memResetErr,
      );
    }

    return billingCycleId;
  },

  async updateBillingCycle(
    householdId: string,
    billingCycleId: string,
    updates: {
      name?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    },
  ): Promise<void> {
    const ref = doc(
      db,
      `households/${householdId}/billingCycles`,
      billingCycleId,
    );
    await setDoc(
      ref,
      sanitizeData({
        ...updates,
        updatedDate: new Date().toISOString(),
      }),
      { merge: true },
    );
  },

  async deleteBillingCycle(
    householdId: string,
    billingCycleId: string,
  ): Promise<void> {
    const ref = doc(
      db,
      `households/${householdId}/billingCycles`,
      billingCycleId,
    );
    await deleteDoc(ref);
  },

  listenToBillingCycles(
    householdId: string,
    callback: (cycles: any[]) => void,
  ) {
    const q = collection(db, `households/${householdId}/billingCycles`);
    return onSnapshot(
      q,
      (snap) => {
        const items: any[] = [];
        snap.forEach((d) => items.push(d.data()));
        callback(sortBillingCyclesNewest(items));
      },
      (err) => console.warn("[Firestore Mobile] listenToBillingCycles:", err),
    );
  },

  listenToMemberBills(
    householdId: string,
    cycleIdOrCallback: string | ((bills: any[]) => void),
    maybeCallback?: (bills: any[]) => void,
  ): () => void {
    if (!householdId) {
      return () => {};
    }
    const isCycleProvided = typeof cycleIdOrCallback === "string";
    const cycleId = isCycleProvided ? cycleIdOrCallback : undefined;
    const callback = (isCycleProvided ? maybeCallback : cycleIdOrCallback) as (
      bills: any[],
    ) => void;

    if (typeof callback !== "function") {
      return () => {};
    }

    const colRef = collection(db, `households/${householdId}/memberBills`);
    const q = cycleId
      ? query(colRef, where("billingCycleId", "==", cycleId))
      : colRef;

    return onSnapshot(
      q,
      (snap) => {
        const map = new Map<string, any>();
        snap.forEach((d) => {
          const data = d.data();
          const uid = data.userId || d.id;
          const key = cycleId ? uid : `${data.billingCycleId || ""}_${uid}`;
          // Prefer bill_{cycleId}_{userId} format over direct userId doc to avoid double counting
          if (!map.has(key) || d.id.startsWith("bill_")) {
            map.set(key, data);
          }
        });
        callback(Array.from(map.values()));
      },
      (err) => console.warn("[Firestore Mobile] listenToMemberBills:", err),
    );
  },

  listenToWaterConfig(
    householdId: string,
    callback: (config: any | null) => void,
  ) {
    const defaultConfig = {
      pricingModel: "PER_PERSON_DAY",
      rateCentavosPerPersonPerDay: 500,
      fixedMonthlyAmountCentavos: 0,
      fixedPerPersonAmountCentavos: 0,
      mode: "BILLING_CYCLE",
    };
    if (!householdId) {
      callback(defaultConfig);
      return () => {};
    }
    const ref = doc(db, `households/${householdId}/systemSettings`, "water");
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          callback({
            ...defaultConfig,
            ...data,
            hasDoc: true,
            pricingModel:
              data.pricingModel ||
              (data.fixedMonthlyAmountCentavos
                ? "FIXED_MONTHLY"
                : "PER_PERSON_DAY"),
          });
        } else {
          callback({
            ...defaultConfig,
            hasDoc: false,
          });
        }
      },
      (_err) => {
        callback({
          ...defaultConfig,
          hasDoc: false,
        });
      },
    );
  },

  async saveWaterConfig(
    householdId: string,
    config: any,
    options?: { billingCycleId?: string; skipExpenseSync?: boolean },
  ): Promise<string | undefined> {
    if (!householdId) return undefined;
    try {
      const ref = doc(db, `households/${householdId}/systemSettings`, "water");
      const nowIso = new Date().toISOString();
      let targetCycleId = (
        options?.billingCycleId ||
        config?.billingCycleId ||
        ""
      ).trim();

      if (!targetCycleId) {
        const cyclesSnap = await getDocs(
          collection(db, `households/${householdId}/billingCycles`),
        );
        const cycles = sortBillingCyclesNewest(
          cyclesSnap.docs.map((cd) => ({
            ...cd.data(),
            billingCycleId: cd.data().billingCycleId || cd.id,
          })),
        );
        const activeCycle =
          cycles.find((c: any) => c.status === "ACTIVE") || cycles[0];
        if (activeCycle?.billingCycleId) {
          targetCycleId = activeCycle.billingCycleId;
        } else if (!options?.skipExpenseSync) {
          targetCycleId = `bc_${Date.now()}`;
          const now = new Date();
          const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          const cycleName = `${monthNames[now.getMonth()]} ${now.getFullYear()} Billing`;
          await setDoc(
            doc(db, `households/${householdId}/billingCycles`, targetCycleId),
            sanitizeData({
              billingCycleId: targetCycleId,
              householdId,
              name: cycleName,
              startDate: new Date(now.getFullYear(), now.getMonth(), 1)
                .toISOString()
                .slice(0, 10),
              endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0)
                .toISOString()
                .slice(0, 10),
              status: "ACTIVE",
              paymentsLocked: true,
              isFinalized: false,
              paymentsOpenedByHost: false,
              createdDate: nowIso,
              updatedDate: nowIso,
            }),
            { merge: true },
          );
        }
      }

      const pricingModel: CycleWaterConfig["pricingModel"] =
        config.pricingModel || "PER_PERSON_DAY";
      const rateCentavosPerPersonPerDay = Number(
        config.rateCentavosPerPersonPerDay ?? 500,
      );
      const fixedMonthlyAmountCentavos = Number(
        config.fixedMonthlyAmountCentavos ?? 0,
      );
      const fixedPerPersonAmountCentavos = Number(
        config.fixedPerPersonAmountCentavos ?? 0,
      );

      const cycleSnapshot = {
        pricingModel,
        rateCentavosPerPersonPerDay,
        fixedMonthlyAmountCentavos,
        fixedPerPersonAmountCentavos,
        mode: config.mode || "BILLING_CYCLE",
        billingCycleId: targetCycleId,
        updatedAt: nowIso,
      };

      const waterSnap = await getDoc(ref);
      const existingDoc = waterSnap.exists() ? waterSnap.data() : {};
      const existingCycles =
        existingDoc.cycles && typeof existingDoc.cycles === "object"
          ? { ...existingDoc.cycles }
          : {};
      if (targetCycleId) {
        existingCycles[targetCycleId] = cycleSnapshot;
      }

      const cleanConfig = sanitizeData({
        pricingModel,
        rateCentavosPerPersonPerDay,
        fixedMonthlyAmountCentavos,
        fixedPerPersonAmountCentavos,
        mode: config.mode || "BILLING_CYCLE",
        billingCycleId: targetCycleId || existingDoc.billingCycleId || "",
        cycles: existingCycles,
        updatedAt: nowIso,
      });
      await setDoc(ref, cleanConfig, { merge: true });

      if (!options?.skipExpenseSync) {
        await this.syncCycleWaterBill(
          householdId,
          targetCycleId || undefined,
          cycleSnapshot,
        );
        await this.recalculateUnpaidExpensesForHousehold(
          householdId,
          targetCycleId || undefined,
        );
      }

      return targetCycleId || undefined;
    } catch (err) {
      console.error("[saveWaterConfig Mobile] Error:", err);
      throw err;
    }
  },

  /**
   * Generates or synchronizes the target billing cycle's Water line item
   * according to that cycle's configured water mode (PER_PERSON_DAY, FIXED_MONTHLY, or FIXED_PER_PERSON_MONTH).
   */
  async syncCycleWaterBill(
    householdId: string,
    billingCycleId?: string,
    overrideConfig?: Partial<CycleWaterConfig> & Record<string, any>,
  ): Promise<string | null> {
    try {
      if (!householdId) return null;

      // 1. Fetch cycles, members, water settings, and existing expenses in parallel
      const waterRef = doc(
        db,
        `households/${householdId}/systemSettings`,
        "water",
      );
      const [cyclesSnap, memSnap, waterSnap, expSnap] = await Promise.all([
        getDocs(collection(db, `households/${householdId}/billingCycles`)),
        getDocs(collection(db, `households/${householdId}/members`)),
        getDoc(waterRef),
        getDocs(collection(db, `households/${householdId}/expenses`)),
      ]);

      let targetCycle: any = null;
      const cycles = sortBillingCyclesNewest(
        cyclesSnap.docs.map((cd) => ({
          ...cd.data(),
          billingCycleId: cd.data().billingCycleId || cd.id,
        })),
      );
      if (billingCycleId) {
        targetCycle = cycles.find(
          (c: any) => c.billingCycleId === billingCycleId,
        );
      }
      if (!targetCycle) {
        targetCycle =
          cycles.find((c: any) => c.status === "ACTIVE") || cycles[0];
      }
      if (!targetCycle) {
        return null;
      }
      if (
        !overrideConfig &&
        (targetCycle.status === "CLOSED" || targetCycle.status === "ARCHIVED")
      ) {
        return null;
      }
      const cycleId = targetCycle.billingCycleId;

      // 2. Resolve members
      const activeMembers = memSnap.docs
        .map((d) => d.data())
        .filter((m: any) => m.status === "ACTIVE" || !m.status);
      if (activeMembers.length === 0) return null;

      const activePayors = activeMembers.filter((m) => isPayorMember(m));
      const effectivePayors =
        activePayors.length > 0 ? activePayors : activeMembers;

      const existingWaterExp = expSnap.docs.find((ed) => {
        const data = ed.data();
        const cat = (data.category || "").toLowerCase();
        return (
          (data.billingCycleId === cycleId || ed.id.includes(cycleId)) &&
          (cat.includes("water") || ed.id.startsWith("water_"))
        );
      });
      const existingWaterData = existingWaterExp
        ? existingWaterExp.data()
        : null;

      // 3. Resolve cycle-scoped water configuration; do NOT create phantom water bills if unconfigured
      const rawWaterData = waterSnap.exists() ? waterSnap.data() : null;
      const resolvedWater = overrideConfig
        ? resolveCycleWaterConfig(
            {
              ...overrideConfig,
              billingCycleId: cycleId,
            },
            cycleId,
          )
        : resolveCycleWaterConfig(rawWaterData, cycleId, {
            cycleWaterExpense: existingWaterData,
            payorCount: effectivePayors.length,
            totalCyclesCount: cycles.length,
          });

      if (!resolvedWater) {
        return null;
      }

      const pricingModel = resolvedWater.pricingModel;

      let billTitle = "Water Attendance";
      let totalAmountCentavos = 0;
      let splitDetails: any[] = [];

      if (pricingModel === "FIXED_PER_PERSON_MONTH") {
        const perPersonCentavos = Number(
          resolvedWater.fixedPerPersonAmountCentavos || 0,
        );
        totalAmountCentavos = perPersonCentavos * effectivePayors.length;
        billTitle = "Water (Flat Per Person)";

        splitDetails = activeMembers.map((m: any) => {
          const isPayor = isPayorMember(m);
          if (isPayor) {
            return {
              userId: m.userId || m.memberId,
              displayName: m.displayName || "Roommate",
              shareCentavos: perPersonCentavos,
              isPaid: false,
              isExempt: false,
              role: m.role || "PAYOR",
              note: `Flat fee of ₱${(perPersonCentavos / 100).toFixed(2)}/resident/month`,
            };
          } else {
            return {
              userId: m.userId || m.memberId,
              displayName: m.displayName || "Roommate",
              shareCentavos: 0,
              isPaid: true,
              isExempt: true,
              role: "NON_PAYOR",
              note: "Exempted (Non-payor)",
            };
          }
        });
      } else if (pricingModel === "FIXED_MONTHLY") {
        totalAmountCentavos = Number(
          resolvedWater.fixedMonthlyAmountCentavos || 0,
        );
        billTitle = "Water (Fixed Household)";

        splitDetails = activeMembers.map((m: any) => {
          const uid = m.userId || m.memberId || m.id || "";
          const isPayor = isPayorMember(m);
          if (isPayor) {
            const shareCentavos = computeFairSplitShareCentavos(
              totalAmountCentavos,
              effectivePayors,
              uid,
            );
            return {
              userId: uid,
              displayName: m.displayName || "Roommate",
              shareCentavos,
              isPaid: false,
              isExempt: false,
              role: m.role || "PAYOR",
              note: `Household water bill (₱${(totalAmountCentavos / 100).toFixed(2)}) split equally across ${effectivePayors.length} payors`,
            };
          } else {
            return {
              userId: m.userId || m.memberId,
              displayName: m.displayName || "Roommate",
              shareCentavos: 0,
              isPaid: true,
              isExempt: true,
              role: "NON_PAYOR",
              note: "Exempted (Non-payor)",
            };
          }
        });
      } else {
        // Mode 1: PER_PERSON_DAY
        billTitle = "Water Attendance";
        const rate = Number(resolvedWater.rateCentavosPerPersonPerDay || 500);

        const [attSnap, subSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, `households/${householdId}/waterAttendance`),
              where("billingCycleId", "==", cycleId),
            ),
          ).catch(() => null),
          getDocs(
            query(
              collection(db, `households/${householdId}/attendanceSubmissions`),
              where("billingCycleId", "==", cycleId),
            ),
          ).catch(() => null),
        ]);
        const attRecords = attSnap ? attSnap.docs.map((d) => d.data()) : [];
        const subRecords = subSnap ? subSnap.docs.map((d) => d.data()) : [];

        const { membersBreakdown, totalAmountCentavos: computedWaterTotal } =
          computeCycleWaterBreakdown(
            activeMembers,
            attRecords,
            subRecords,
            rate,
          );
        totalAmountCentavos = computedWaterTotal;

        splitDetails = membersBreakdown.map((item) => ({
          userId: item.userId,
          displayName: item.displayName,
          shareCentavos: item.shareCentavos,
          ownWaterCentavos: item.ownWaterCentavos,
          nonPayorWaterCentavos: item.nonPayorWaterCentavos,
          daysPresent: item.daysPresent,
          rateCentavosPerDay: item.rateCentavosPerDay,
          isPaid: item.isExempt,
          isExempt: item.isExempt,
          role: item.role,
          note: item.note,
        }));
      }

      const expenseId = existingWaterExp
        ? existingWaterExp.id
        : `water_bill_${cycleId}`;
      const splitsMap: Record<string, number> = {};
      splitDetails.forEach((s) => {
        if (s.userId) splitsMap[s.userId] = s.shareCentavos;
      });

      const wasAlreadyPaid =
        existingWaterData?.status === "PAID" ||
        existingWaterData?.isPaid === true;

      // Preserve isPaid on existing splitDetails if previously settled and share hasn't increased
      if (
        existingWaterData?.splitDetails &&
        Array.isArray(existingWaterData.splitDetails)
      ) {
        const paidUserMap = new Map<
          string,
          { isPaid: boolean; share: number }
        >();
        existingWaterData.splitDetails.forEach((s: any) => {
          if (s.userId && s.isPaid) {
            paidUserMap.set(s.userId, {
              isPaid: true,
              share: Number(s.shareCentavos || 0),
            });
          }
        });
        splitDetails = splitDetails.map((s: any) => {
          const prev = paidUserMap.get(s.userId);
          const stillPaid =
            s.isExempt ||
            (Boolean(prev?.isPaid) &&
              Number(s.shareCentavos || 0) <= (prev?.share ?? 0));
          return {
            ...s,
            isPaid: stillPaid,
          };
        });
      }

      const allWaterPaid =
        splitDetails.length > 0 &&
        splitDetails.some((s) => !s.isExempt && s.shareCentavos > 0) &&
        splitDetails.every((s) => s.isExempt || s.isPaid) &&
        (wasAlreadyPaid ||
          totalAmountCentavos <= Number(existingWaterData?.amountCents || 0));

      const expensePayload = sanitizeData({
        id: expenseId,
        householdId,
        title: billTitle,
        category: "Water",
        amountCents: totalAmountCentavos,
        date: existingWaterData?.date || new Date().toISOString().slice(0, 10),
        payerName: "Household",
        payerId: "system",
        splitMethod:
          pricingModel === "FIXED_PER_PERSON_MONTH"
            ? "Flat Per Person"
            : pricingModel === "FIXED_MONTHLY"
              ? "Equal Split"
              : "Daily Attendance",
        billingCycleId: cycleId,
        status: allWaterPaid ? "PAID" : "UNPAID",
        isPaid: allWaterPaid,
        splitDetails,
        splits: splitsMap,
        updatedAt: new Date().toISOString(),
      });

      await Promise.all([
        setDoc(
          doc(db, `households/${householdId}/expenses`, expenseId),
          expensePayload,
          { merge: true },
        ),
        setDoc(
          doc(db, `households/${householdId}/charges`, expenseId),
          sanitizeData({
            chargeId: expenseId,
            householdId,
            billingCycleId: cycleId,
            chargeType: "WATER",
            name: billTitle,
            amountCentavos: totalAmountCentavos,
            distributionMethod: "PAYORS_ONLY",
            participantUserIds: splitDetails
              .filter((s) => !s.isExempt)
              .map((s) => s.userId),
            splitDetails,
            createdDate: new Date().toISOString(),
            createdBy: "system",
          }),
          { merge: true },
        ),
      ]);

      // Immediately refresh member bills for this cycle in Firestore
      this.recalculateUnpaidExpensesForHousehold(householdId, cycleId).catch(
        () => {},
      );

      return expenseId;
    } catch (err) {
      console.warn("[syncCycleWaterBill] error:", err);
      return null;
    }
  },

  listenToElectricityConfig(
    householdId: string,
    callback: (config: any | null) => void,
  ) {
    const defaultConfig = {
      previousReadingKwh: 0,
      currentReadingKwh: 0,
      rateCentavosPerKwh: 1200,
      consumedKwh: 0,
      totalAmountCentavos: 0,
    };
    if (!householdId) {
      callback(defaultConfig);
      return () => {};
    }
    const ref = doc(
      db,
      `households/${householdId}/systemSettings`,
      "electricity",
    );
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const prev = Number(data.previousReadingKwh ?? 0);
          const curr = Number(data.currentReadingKwh ?? prev);
          const rate = Number(data.rateCentavosPerKwh ?? 1200);
          const consumed = Math.max(0, Math.round((curr - prev) * 100) / 100);
          const total = Math.round(consumed * rate);
          callback({
            ...defaultConfig,
            ...data,
            previousReadingKwh: prev,
            currentReadingKwh: curr,
            rateCentavosPerKwh: rate,
            consumedKwh: consumed,
            totalAmountCentavos: total,
          });
        } else {
          callback(defaultConfig);
        }
      },
      (_err) => {
        callback(defaultConfig);
      },
    );
  },

  async saveElectricityConfig(
    householdId: string,
    config: {
      previousReadingKwh?: number;
      currentReadingKwh?: number;
      rateCentavosPerKwh?: number;
      consumedKwh?: number;
      totalAmountCentavos?: number;
      billingCycleId?: string;
    },
    options?: { billingCycleId?: string; skipExpenseSync?: boolean },
  ): Promise<string | undefined> {
    if (!householdId) return undefined;
    try {
      const ref = doc(
        db,
        `households/${householdId}/systemSettings`,
        "electricity",
      );
      const prev = Math.max(0, Number(config.previousReadingKwh ?? 0));
      const curr = Math.max(prev, Number(config.currentReadingKwh ?? prev));
      const rate = Math.max(0, Number(config.rateCentavosPerKwh ?? 1200));
      const consumedKwh = Math.max(0, Math.round((curr - prev) * 100) / 100);
      const totalAmountCentavos = Math.round(consumedKwh * rate);
      let targetCycleId = (
        options?.billingCycleId ||
        config.billingCycleId ||
        ""
      ).trim();
      const nowIso = new Date().toISOString();

      // Ensure an active billing cycle exists so electricity configuration & expense sync always bind cleanly
      if (!targetCycleId) {
        const cyclesSnap = await getDocs(
          collection(db, `households/${householdId}/billingCycles`),
        );
        const cycles = sortBillingCyclesNewest(
          cyclesSnap.docs.map((cd) => ({
            ...cd.data(),
            billingCycleId: cd.data().billingCycleId || cd.id,
          })),
        );
        const activeCycle =
          cycles.find((c: any) => c.status === "ACTIVE") || cycles[0];
        if (activeCycle?.billingCycleId) {
          targetCycleId = activeCycle.billingCycleId;
        } else if (!options?.skipExpenseSync) {
          targetCycleId = `bc_${Date.now()}`;
          const now = new Date();
          const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          const cycleName = `${monthNames[now.getMonth()]} ${now.getFullYear()} Billing`;
          await setDoc(
            doc(db, `households/${householdId}/billingCycles`, targetCycleId),
            sanitizeData({
              billingCycleId: targetCycleId,
              householdId,
              name: cycleName,
              startDate: new Date(now.getFullYear(), now.getMonth(), 1)
                .toISOString()
                .slice(0, 10),
              endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0)
                .toISOString()
                .slice(0, 10),
              status: "ACTIVE",
              paymentsLocked: true,
              isFinalized: false,
              paymentsOpenedByHost: false,
              createdDate: nowIso,
              updatedDate: nowIso,
            }),
            { merge: true },
          );
        }
      }

      const cycleSnapshot = {
        previousReadingKwh: prev,
        currentReadingKwh: curr,
        rateCentavosPerKwh: rate,
        consumedKwh,
        totalAmountCentavos,
        billingCycleId: targetCycleId,
        updatedAt: nowIso,
      };

      const elecSnap = await getDoc(ref);
      const existingDoc = elecSnap.exists() ? elecSnap.data() : {};
      const existingCycles =
        existingDoc.cycles && typeof existingDoc.cycles === "object"
          ? { ...existingDoc.cycles }
          : {};
      if (targetCycleId) {
        existingCycles[targetCycleId] = cycleSnapshot;
      }

      const cleanConfig = sanitizeData({
        previousReadingKwh: prev,
        currentReadingKwh: curr,
        lastCurrentReadingKwh: curr,
        rateCentavosPerKwh: rate,
        consumedKwh,
        totalAmountCentavos,
        billingCycleId: targetCycleId || existingDoc.billingCycleId || "",
        cycles: existingCycles,
        updatedAt: nowIso,
      });
      await setDoc(ref, cleanConfig, { merge: true });

      if (!options?.skipExpenseSync) {
        await this.syncCycleElectricityBill(
          householdId,
          targetCycleId || undefined,
          cycleSnapshot,
        );
      }

      return targetCycleId || undefined;
    } catch (err) {
      console.error("[saveElectricityConfig Mobile] Error:", err);
      throw err;
    }
  },

  async syncCycleElectricityBill(
    householdId: string,
    billingCycleId?: string,
    overrideConfig?: {
      previousReadingKwh?: number;
      currentReadingKwh?: number;
      rateCentavosPerKwh?: number;
      consumedKwh?: number;
      totalAmountCentavos?: number;
    },
  ): Promise<string | null> {
    if (!householdId) return null;
    try {
      const elecRef = doc(
        db,
        `households/${householdId}/systemSettings`,
        "electricity",
      );
      const [cyclesSnap, memSnap, elecSnap, expSnap] = await Promise.all([
        getDocs(collection(db, `households/${householdId}/billingCycles`)),
        getDocs(collection(db, `households/${householdId}/members`)),
        getDoc(elecRef),
        getDocs(collection(db, `households/${householdId}/expenses`)),
      ]);

      const cycles = sortBillingCyclesNewest(
        cyclesSnap.docs.map((cd) => ({
          ...cd.data(),
          billingCycleId: cd.data().billingCycleId || cd.id,
        })),
      );
      const knownCycleIds = new Set<string>();
      cycles.forEach((c: any) => {
        if (c?.billingCycleId) knownCycleIds.add(c.billingCycleId);
      });

      let targetCycle: any = null;
      if (billingCycleId) {
        targetCycle = cycles.find(
          (c: any) => c.billingCycleId === billingCycleId,
        );
      }
      if (!targetCycle) {
        targetCycle =
          cycles.find((c: any) => c.status === "ACTIVE") || cycles[0];
      }

      let cycleId = targetCycle?.billingCycleId || billingCycleId || "";
      if (!cycleId) {
        cycleId = `bc_${Date.now()}`;
        const now = new Date();
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const cycleName = `${monthNames[now.getMonth()]} ${now.getFullYear()} Billing`;
        const nowCreateIso = now.toISOString();
        await setDoc(
          doc(db, `households/${householdId}/billingCycles`, cycleId),
          sanitizeData({
            billingCycleId: cycleId,
            householdId,
            name: cycleName,
            startDate: new Date(now.getFullYear(), now.getMonth(), 1)
              .toISOString()
              .slice(0, 10),
            endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0)
              .toISOString()
              .slice(0, 10),
            status: "ACTIVE",
            paymentsLocked: true,
            isFinalized: false,
            paymentsOpenedByHost: false,
            createdDate: nowCreateIso,
            updatedDate: nowCreateIso,
          }),
          { merge: true },
        );
        knownCycleIds.add(cycleId);
      }

      let activeMembers: any[] = memSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter(
          (m: any) =>
            m.status === "ACTIVE" || m.status === "SETTLED" || !m.status,
        );

      if (activeMembers.length === 0) {
        const hhSnap = await getDoc(doc(db, "households", householdId)).catch(
          () => null,
        );
        const hhData = hhSnap && hhSnap.exists() ? hhSnap.data() : null;
        const fallbackUid = hhData?.hostId || auth.currentUser?.uid || "host";
        activeMembers = [
          {
            id: fallbackUid,
            userId: fallbackUid,
            memberId: fallbackUid,
            displayName: auth.currentUser?.displayName || "Host",
            role: "HOST",
            status: "ACTIVE",
          },
        ];
      }

      const activePayors = activeMembers.filter((m) => isPayorMember(m));
      const effectivePayors =
        activePayors.length > 0 ? activePayors : activeMembers;

      if (!overrideConfig && !elecSnap.exists()) return null;
      const elecDoc = elecSnap.exists() ? elecSnap.data() : {};
      const elecConfig =
        overrideConfig ||
        (cycleId && elecDoc.cycles && elecDoc.cycles[cycleId]) ||
        elecDoc;
      const prev = Math.max(0, Number(elecConfig.previousReadingKwh ?? 0));
      const curr = Math.max(prev, Number(elecConfig.currentReadingKwh ?? prev));
      const rateCentavos = Math.max(
        0,
        Number(
          elecConfig.rateCentavosPerKwh ?? elecDoc.rateCentavosPerKwh ?? 1200,
        ),
      );
      const consumedKwh = Math.max(0, Math.round((curr - prev) * 100) / 100);
      const totalAmountCentavos = Math.round(consumedKwh * rateCentavos);

      const payorCount = Math.max(1, effectivePayors.length);
      const ratePesosStr = (rateCentavos / 100).toFixed(2);
      const meterSummaryNote = `Prev: ${prev} kWh → Curr: ${curr} kWh (${consumedKwh} kWh × ₱${ratePesosStr}/kWh)`;

      const oldestCycleId = cycles[cycles.length - 1]?.billingCycleId;
      const isSingleOrOldestCycle =
        cycles.length <= 1 || cycleId === oldestCycleId;

      // Find all electricity expenses belonging to this cycle (including unscoped ones on single/oldest cycle)
      const matchingElecDocs = expSnap.docs
        .filter((ed) => {
          const data = ed.data();
          const cat = (data.category || "").toLowerCase();
          const title = (data.title || "").toLowerCase();
          const isElec =
            cat.includes("electric") ||
            title.includes("electric") ||
            ed.id.startsWith("elec_");
          if (!isElec) return false;
          const isUnscopedOrOrphan =
            !data.billingCycleId ||
            (knownCycleIds.size > 0 && !knownCycleIds.has(data.billingCycleId));
          return (
            data.billingCycleId === cycleId ||
            ed.id.includes(cycleId) ||
            (isUnscopedOrOrphan && isSingleOrOldestCycle)
          );
        })
        .sort((a, b) => {
          const aTime = String(a.data().createdAt || a.data().date || "");
          const bTime = String(b.data().createdAt || b.data().date || "");
          return bTime.localeCompare(aTime);
        });

      const existingElecExp = matchingElecDocs[0];
      const duplicateElecDocs = matchingElecDocs.slice(1);

      // Clean up any duplicate electricity bills in the same cycle so the UI always displays the synced bill
      for (const dupDoc of duplicateElecDocs) {
        await deleteDoc(dupDoc.ref).catch(() => {});
        await deleteDoc(
          doc(db, `households/${householdId}/charges`, dupDoc.id),
        ).catch(() => {});
      }

      if (totalAmountCentavos <= 0) {
        if (existingElecExp) {
          const existingData = existingElecExp.data();
          const hasVerifiedPayments =
            Array.isArray(existingData?.splitDetails) &&
            existingData.splitDetails.some(
              (s: any) =>
                !s.isExempt &&
                ((Number(s.paidAmountCentavos) || 0) > 0 ||
                  Boolean(s.paymentId) ||
                  Boolean(s.paidDate)),
            );
          if (!hasVerifiedPayments) {
            await deleteDoc(existingElecExp.ref).catch(() => {});
            await deleteDoc(
              doc(db, `households/${householdId}/charges`, existingElecExp.id),
            ).catch(() => {});
          } else {
            const zeroSplits = activeMembers.map((m: any) => ({
              userId: m.userId || m.memberId || m.id || "",
              displayName: m.displayName || "Roommate",
              shareCentavos: 0,
              percentage: 0,
              isPaid: true,
              isExempt: !isPayorMember(m),
              role: m.role || "PAYOR",
              note: `${meterSummaryNote} (0 kWh)`,
            }));
            await setDoc(
              existingElecExp.ref,
              sanitizeData({
                amountCents: 0,
                billingCycleId: cycleId,
                previousReadingKwh: prev,
                currentReadingKwh: curr,
                consumedKwh: 0,
                rateCentavosPerKwh: rateCentavos,
                notes: meterSummaryNote,
                splitDetails: zeroSplits,
                status: "PAID",
                isPaid: true,
                updatedAt: new Date().toISOString(),
              }),
              { merge: true },
            );
          }
        }
        await this.recalculateUnpaidExpensesForHousehold(householdId, cycleId);
        return null;
      }

      let splitDetails = activeMembers.map((m: any) => {
        const uid = m.userId || m.memberId || m.id || "";
        const isPayor = isPayorMember(m);
        if (isPayor) {
          const shareCentavos = computeFairSplitShareCentavos(
            totalAmountCentavos,
            effectivePayors,
            uid,
          );
          return {
            userId: uid,
            displayName: m.displayName || "Roommate",
            shareCentavos,
            percentage: Math.round((100 / payorCount) * 10) / 10,
            isPaid: false,
            isExempt: false,
            role: m.role || "PAYOR",
            note: `${meterSummaryNote} · Split among ${payorCount} payors`,
          };
        } else {
          return {
            userId: m.userId || m.memberId || m.id || "",
            displayName: m.displayName || "Roommate",
            shareCentavos: 0,
            percentage: 0,
            isPaid: true,
            isExempt: true,
            role: "NON_PAYOR",
            note: "Exempted (Non-payor)",
          };
        }
      });

      const expenseId = existingElecExp
        ? existingElecExp.id
        : `elec_bill_${cycleId}`;
      const existingElecData = existingElecExp ? existingElecExp.data() : null;

      // Only preserve a payor's paid status if they actually settled at least the new shareCentavos
      if (
        existingElecData?.splitDetails &&
        Array.isArray(existingElecData.splitDetails)
      ) {
        splitDetails = splitDetails.map((s: any) => {
          if (s.isExempt) return s;
          const prevSplit = existingElecData.splitDetails.find((ps: any) =>
            matchesMemberUid(
              { userId: s.userId },
              ps?.userId || ps?.memberId || ps?.id,
            ),
          );
          if (!prevSplit || !prevSplit.isPaid) return s;
          const prevActualPaid =
            typeof prevSplit.paidAmountCentavos === "number"
              ? prevSplit.paidAmountCentavos
              : prevSplit.paymentId || prevSplit.paidDate
                ? Number(prevSplit.shareCentavos) || 0
                : 0;
          const coversNewShare =
            s.shareCentavos > 0 && prevActualPaid >= s.shareCentavos;
          if (!coversNewShare) {
            return {
              ...s,
              isPaid: false,
              ...(prevActualPaid > 0
                ? { paidAmountCentavos: prevActualPaid }
                : {}),
            };
          }
          return {
            ...s,
            isPaid: true,
            paidAmountCentavos: prevActualPaid,
            ...(prevSplit.paidDate !== undefined
              ? { paidDate: prevSplit.paidDate }
              : {}),
            ...(prevSplit.paymentId !== undefined
              ? { paymentId: prevSplit.paymentId }
              : {}),
          };
        });
      }

      const allElecPaid =
        splitDetails.length > 0 &&
        splitDetails.every((s) => s.isExempt || s.isPaid);

      const splitsMap: Record<string, number> = {};
      splitDetails.forEach((s) => {
        if (s.userId) splitsMap[s.userId] = s.shareCentavos;
      });

      const nowIso = new Date().toISOString();
      const expensePayload = sanitizeData({
        id: expenseId,
        householdId,
        title: existingElecData?.title || "Electricity",
        category: "Electricity",
        amountCents: totalAmountCentavos,
        date: nowIso.slice(0, 10),
        payerName: existingElecData?.payerName || "Host",
        payerId: existingElecData?.payerId || auth.currentUser?.uid || "system",
        splitMethod: "Equal",
        billingCycleId: cycleId,
        status: allElecPaid ? "PAID" : "UNPAID",
        isPaid: allElecPaid,
        previousReadingKwh: prev,
        currentReadingKwh: curr,
        consumedKwh,
        rateCentavosPerKwh: rateCentavos,
        notes: meterSummaryNote,
        splitDetails,
        splits: splitsMap,
        participantUserIds: splitDetails
          .filter((s) => !s.isExempt && Boolean(s.userId))
          .map((s) => s.userId),
        createdAt: existingElecData?.createdAt || nowIso,
        updatedAt: nowIso,
        updatedDate: nowIso,
      });

      await Promise.all([
        setDoc(
          doc(db, `households/${householdId}/expenses`, expenseId),
          expensePayload,
          { merge: true },
        ),
        setDoc(
          doc(db, `households/${householdId}/charges`, expenseId),
          sanitizeData({
            chargeId: expenseId,
            householdId,
            billingCycleId: cycleId,
            chargeType: "ELECTRICITY",
            name: existingElecData?.title || "Electricity",
            description: meterSummaryNote,
            amountCentavos: totalAmountCentavos,
            distributionMethod: "PAYORS_ONLY",
            participantUserIds: splitDetails
              .filter((s) => !s.isExempt)
              .map((s) => s.userId),
            splitDetails,
            createdDate: existingElecData?.createdAt || nowIso,
            updatedDate: nowIso,
            createdBy: auth.currentUser?.uid || "system",
          }),
          { merge: true },
        ),
      ]);

      await this.recalculateUnpaidExpensesForHousehold(householdId, cycleId);
      return expenseId;
    } catch (err) {
      console.error("[syncCycleElectricityBill] error:", err);
      throw err;
    }
  },

  async toggleCyclePaymentsLock(
    householdId: string,
    billingCycleId: string,
    isLocked: boolean,
  ): Promise<boolean> {
    try {
      if (!householdId) return false;
      if (billingCycleId) {
        const cycleRef = doc(
          db,
          `households/${householdId}/billingCycles`,
          billingCycleId,
        );
        await updateDoc(cycleRef, {
          paymentsLocked: isLocked,
          isFinalized: !isLocked,
          paymentsOpenedByHost: !isLocked,
          updatedAt: new Date().toISOString(),
        });
      }
      await updateDoc(doc(db, "households", householdId), {
        paymentsLocked: isLocked,
        paymentsOpenedByHost: !isLocked,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (err) {
      console.warn("[toggleCyclePaymentsLock] error:", err);
      return false;
    }
  },

  async markExpensesPaidIfAllSettled(
    householdId: string,
    billingCycleId?: string,
  ): Promise<boolean> {
    if (!householdId) return false;
    try {
      const [membersSnap, cyclesSnap, expSnap, pmtSnap, billsSnap] =
        await Promise.all([
          getDocs(collection(db, `households/${householdId}/members`)),
          getDocs(collection(db, `households/${householdId}/billingCycles`)),
          getDocs(collection(db, `households/${householdId}/expenses`)),
          getDocs(collection(db, `households/${householdId}/payments`)),
          getDocs(collection(db, `households/${householdId}/memberBills`)),
        ]);

      const allMembers = membersSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const activeMembers = allMembers.filter(
        (m: any) =>
          !m.status || m.status === "ACTIVE" || m.status === "SETTLED",
      );
      const activePayors = activeMembers.filter((m) => isPayorMember(m));
      if (activePayors.length === 0) return false;

      const cycles = sortBillingCyclesNewest(
        cyclesSnap.docs.map((cd) => ({
          ...cd.data(),
          billingCycleId: cd.data().billingCycleId || cd.id,
        })),
      );
      const isSingleCycle = cycles.length <= 1;
      const oldestCycleId =
        cycles.length > 0
          ? cycles[cycles.length - 1]?.billingCycleId
          : undefined;
      let cycleId = billingCycleId;
      if (!cycleId) {
        const activeCycle = cycles[0];
        cycleId = activeCycle?.billingCycleId;
      }
      if (!cycleId) return false;

      const cycleExpenses = expSnap.docs.filter((ed) => {
        const data = ed.data();
        return (
          data.billingCycleId === cycleId ||
          (!data.billingCycleId && (isSingleCycle || cycleId === oldestCycleId))
        );
      });

      if (cycleExpenses.length === 0) return false;

      const hasPositiveExpense = cycleExpenses.some(
        (ed) => (Number(ed.data().amountCents) || 0) > 0,
      );
      if (!hasPositiveExpense) return false;

      const settlement = evaluateHouseholdCycleSettlements({
        cycles,
        expenses: expSnap.docs.map(
          (ed) => ({ id: ed.id, ...ed.data() }) as MobileExpense,
        ),
        payments: pmtSnap.docs.map((pd) => pd.data() as MobilePayment),
        allMemberBills: billsSnap.docs.map((bd) => ({
          billId: bd.id,
          ...bd.data(),
        })),
        members: activeMembers,
      });

      const allPayorsSettled = Boolean(
        settlement.allPayorsSettledByCycle.get(cycleId),
      );

      if (allPayorsSettled) {
        const nowIso = new Date().toISOString();
        for (const expDoc of cycleExpenses) {
          const data = expDoc.data();
          if (data.status !== "PAID" || !data.isPaid) {
            let splits = data.splitDetails;
            if (Array.isArray(splits)) {
              splits = splits.map((s: any) => {
                const matchedPmt = settlement.getMatchedPaymentForExpense(
                  { id: expDoc.id, ...data } as MobileExpense,
                  s?.userId || s?.memberId,
                );
                return sanitizeData({
                  ...s,
                  isPaid: true,
                  paidDate: s.paidDate || matchedPmt?.createdDate || nowIso,
                  ...(s.paymentId || matchedPmt?.paymentId
                    ? { paymentId: s.paymentId || matchedPmt?.paymentId }
                    : {}),
                });
              });
            }
            await updateDoc(
              doc(db, `households/${householdId}/expenses`, expDoc.id),
              sanitizeData({
                status: "PAID",
                isPaid: true,
                ...(splits ? { splitDetails: splits } : {}),
                updatedAt: nowIso,
              }),
            );
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[markExpensesPaidIfAllSettled] error:", err);
      return false;
    }
  },

  async reconcileStaleArrearsAndSettledCycles(
    householdId: string,
  ): Promise<void> {
    if (!householdId) return;
    const nowMs = Date.now();
    const lastRun = _reconcileArrearsInFlight.get(householdId) || 0;
    if (nowMs - lastRun < 6000) return;
    _reconcileArrearsInFlight.set(householdId, nowMs);

    try {
      const [membersSnap, cyclesSnap, expSnap, pmtSnap, billsSnap] =
        await Promise.all([
          getDocs(collection(db, `households/${householdId}/members`)),
          getDocs(collection(db, `households/${householdId}/billingCycles`)),
          getDocs(collection(db, `households/${householdId}/expenses`)),
          getDocs(collection(db, `households/${householdId}/payments`)),
          getDocs(collection(db, `households/${householdId}/memberBills`)),
        ]);

      const activeMembers = membersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (m: any) =>
            !m.status || m.status === "ACTIVE" || m.status === "SETTLED",
        );
      if (activeMembers.length === 0) return;

      const cycles = sortBillingCyclesNewest(
        cyclesSnap.docs.map((cd) => ({
          ...cd.data(),
          billingCycleId: cd.data().billingCycleId || cd.id,
        })),
      );
      if (cycles.length === 0) return;

      const allExpenses = expSnap.docs.map(
        (ed) => ({ id: ed.id, ...ed.data() }) as MobileExpense,
      );
      const allPayments = pmtSnap.docs.map((pd) => pd.data() as MobilePayment);
      const allBills = billsSnap.docs.map((bd) => ({
        billId: bd.id,
        _docId: bd.id,
        ...bd.data(),
      }));

      const settlement = evaluateHouseholdCycleSettlements({
        cycles,
        expenses: allExpenses,
        payments: allPayments,
        allMemberBills: allBills,
        members: activeMembers,
      });

      const nowIso = new Date().toISOString();

      // 1. Mark any fully-settled cycles' expenses as PAID (fixes historical cycles paid via rollover)
      for (const cid of settlement.orderedCycleIdsOldestFirst) {
        if (!settlement.allPayorsSettledByCycle.get(cid)) continue;
        const unpaidExps = expSnap.docs.filter((ed) => {
          const d = ed.data();
          return d.billingCycleId === cid && (d.status !== "PAID" || !d.isPaid);
        });
        for (const ed of unpaidExps) {
          const d = ed.data();
          let splits = d.splitDetails;
          if (Array.isArray(splits)) {
            splits = splits.map((s: any) => {
              const matchedPmt = settlement.getMatchedPaymentForExpense(
                { id: ed.id, ...d } as MobileExpense,
                s?.userId || s?.memberId,
              );
              return sanitizeData({
                ...s,
                isPaid: true,
                paidDate: s.paidDate || matchedPmt?.createdDate || nowIso,
                ...(s.paymentId || matchedPmt?.paymentId
                  ? { paymentId: s.paymentId || matchedPmt?.paymentId }
                  : {}),
              });
            });
          }
          await updateDoc(
            doc(db, `households/${householdId}/expenses`, ed.id),
            sanitizeData({
              status: "PAID",
              isPaid: true,
              ...(splits ? { splitDetails: splits } : {}),
              updatedAt: nowIso,
            }),
          ).catch(() => {});
        }
      }

      // 2. Remove or mark PAID any stale Arrears line items on newer memberBills whose prior cycles are already settled
      const activeCycle =
        cycles.find((c: any) => c.status === "ACTIVE") || cycles[0];
      const activeCycleId = activeCycle?.billingCycleId;
      if (activeCycleId) {
        for (const bd of billsSnap.docs) {
          const bData = bd.data();
          if (bData.billingCycleId !== activeCycleId) continue;
          const bUid = bData.userId || bData.memberId;
          if (!bUid || !Array.isArray(bData.lineItems)) continue;

          const truePriorArrears = settlement.getPriorUnpaidArrearsBeforeCycle(
            activeCycleId,
            bUid,
          );
          const prevPaid = Number(
            bData.totalPaidCentavos || bData.paidCentavos || 0,
          );

          const hasStaleUnpaidArrears = bData.lineItems.some((li: any) => {
            if (!(li?.category === "Arrears" || li?.isArrears) || li?.isExempt)
              return false;
            if (li.status === "PAID" || li.isSettled) return false;
            const pCid = String(li.priorCycleId || "").trim();
            if (truePriorArrears === 0) return true;
            if (pCid) {
              const pSummary = settlement.getMemberCycleSummary(pCid, bUid);
              if (
                pSummary.remainingCycleCentavos === 0 &&
                pSummary.priorUnpaidArrearsCentavos === 0
              ) {
                return true;
              }
            }
            return false;
          });

          if (hasStaleUnpaidArrears && prevPaid === 0) {
            const cleanedLineItems = bData.lineItems.filter((li: any) => {
              if (!(li?.category === "Arrears" || li?.isArrears)) return true;
              if (truePriorArrears === 0) return false;
              const pCid = String(li.priorCycleId || "").trim();
              if (pCid) {
                const pSummary = settlement.getMemberCycleSummary(pCid, bUid);
                if (
                  pSummary.remainingCycleCentavos === 0 &&
                  pSummary.priorUnpaidArrearsCentavos === 0
                ) {
                  return false;
                }
              }
              return true;
            });

            const newDue = cleanedLineItems
              .filter(
                (li: any) =>
                  !li.isExempt && li.status !== "PAID" && !li.isSettled,
              )
              .reduce(
                (sum: number, li: any) =>
                  sum + (Number(li.amountCentavos) || 0),
                0,
              );
            const newOut = Math.max(0, newDue - prevPaid);
            await updateDoc(
              bd.ref,
              sanitizeData({
                lineItems: cleanedLineItems,
                totalDueCentavos: newDue,
                outstandingCentavos: newOut,
                status: newDue > 0 && newOut === 0 ? "PAID" : "UNPAID",
                updatedDate: nowIso,
              }),
            ).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn("[reconcileStaleArrearsAndSettledCycles] warning:", err);
    }
  },

  // --- PAYMENTS ---
  async applyPaymentToMemberBills(
    householdId: string,
    billingCycleId: string,
    userId: string,
    amountCentavos: number,
    breakdownItems?: MobilePaymentBreakdownItem[],
  ): Promise<void> {
    try {
      const cycleKey = billingCycleId || "general";
      const cleanUid = normalizeCleanUid(userId) || userId;
      const billId = `bill_${cycleKey}_${cleanUid}`;
      const billRef = doc(db, `households/${householdId}/memberBills`, billId);
      let snap = await getDoc(billRef);
      let activeTargetRef = billRef;
      if (!snap.exists() && cleanUid !== userId) {
        const legacyRef = doc(
          db,
          `households/${householdId}/memberBills`,
          `bill_${cycleKey}_${userId}`,
        );
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          snap = legacySnap;
          activeTargetRef = legacyRef;
        }
      }

      const nowIso = new Date().toISOString();
      const settledPriorCycleIds = new Set<string>();
      const breakdownAmountByCycle = new Map<string, number>();

      if (Array.isArray(breakdownItems)) {
        for (const bi of breakdownItems) {
          const bCid = String(bi?.cycleId || "").trim();
          const bAmt = Math.max(0, Number(bi?.shareCentavos) || 0);
          if (bCid && bCid !== "general" && bCid !== cycleKey && bAmt > 0) {
            breakdownAmountByCycle.set(
              bCid,
              (breakdownAmountByCycle.get(bCid) || 0) + bAmt,
            );
            settledPriorCycleIds.add(bCid);
          }
        }
      }

      let isNowFullyPaid = false;

      if (snap.exists()) {
        const bill = snap.data();
        const prevPaid = bill.totalPaidCentavos || bill.paidCentavos || 0;
        const newPaid = prevPaid + amountCentavos;
        const existingItems = Array.isArray(bill.lineItems)
          ? bill.lineItems
          : [];
        const grossFromItems = existingItems
          .filter((li: any) => !li.isExempt)
          .reduce(
            (sum: number, li: any) => sum + (Number(li.amountCentavos) || 0),
            0,
          );
        const totalDue = Math.max(bill.totalDueCentavos || 0, grossFromItems);
        const newOutstanding = Math.max(0, totalDue - newPaid);
        const newStatus = newOutstanding === 0 ? "PAID" : "PARTIALLY_PAID";
        isNowFullyPaid = newOutstanding === 0;

        let creditPool = newPaid;
        const updatedLineItems = existingItems.map((li: any) => {
          if (li.isExempt) return sanitizeData(li);
          const itemAmt = Number(li.amountCentavos) || 0;
          const isArrearsItem = Boolean(
            li.category === "Arrears" || li.isArrears,
          );
          if ((itemAmt > 0 && creditPool >= itemAmt) || newOutstanding === 0) {
            if (itemAmt > 0 && creditPool >= itemAmt) {
              creditPool -= itemAmt;
            }
            if (isArrearsItem && li.priorCycleId) {
              settledPriorCycleIds.add(String(li.priorCycleId));
            }
            return sanitizeData({
              ...li,
              status: "PAID",
              isSettled: true,
              paidDate: li.paidDate || nowIso,
            });
          }
          return sanitizeData(li);
        });

        await updateDoc(
          activeTargetRef,
          sanitizeData({
            userId: cleanUid,
            totalDueCentavos: totalDue,
            totalPaidCentavos: newPaid,
            paidCentavos: newPaid,
            outstandingCentavos: newOutstanding,
            status: newStatus,
            ...(existingItems.length > 0
              ? { lineItems: updatedLineItems }
              : {}),
            updatedDate: nowIso,
          }),
        );

        // If all dues on this bill are cleared, also reconcile any older unpaid memberBills for this user
        if (newOutstanding === 0) {
          try {
            const allBillsSnap = await getDocs(
              collection(db, `households/${householdId}/memberBills`),
            );
            for (const bDoc of allBillsSnap.docs) {
              const bData = bDoc.data();
              if (
                !matchesMemberUid(
                  { userId: cleanUid },
                  bData.userId || bData.memberId,
                )
              ) {
                continue;
              }
              if (
                bData.billingCycleId &&
                bData.billingCycleId !== cycleKey &&
                (bData.status !== "PAID" ||
                  (Number(bData.outstandingCentavos) || 0) > 0)
              ) {
                settledPriorCycleIds.add(String(bData.billingCycleId));
              }
            }
          } catch {}
        }
      } else {
        isNowFullyPaid = true;
        await setDoc(
          billRef,
          sanitizeData({
            billId,
            householdId,
            billingCycleId: cycleKey,
            userId: cleanUid,
            totalDueCentavos: amountCentavos,
            totalPaidCentavos: amountCentavos,
            paidCentavos: amountCentavos,
            outstandingCentavos: 0,
            status: "PAID",
            updatedDate: nowIso,
            createdDate: nowIso,
          }),
          { merge: true },
        );
      }

      // Sync member doc payment status when fully settled
      if (isNowFullyPaid) {
        try {
          const memSnap = await getDocs(
            collection(db, `households/${householdId}/members`),
          );
          for (const md of memSnap.docs) {
            const mData = md.data();
            if (matchesMemberUid(mData, cleanUid) || md.id === cleanUid) {
              await updateDoc(md.ref, {
                paymentStatus: "PAID",
                isPaid: true,
                updatedDate: nowIso,
              }).catch(() => {});
            }
          }
        } catch {}
      }

      // Mark settled prior-cycle memberBills as PAID (creating canonical doc if missing) so cross-cycle overdue tracking stays consistent
      for (const priorCycleId of Array.from(settledPriorCycleIds)) {
        if (!priorCycleId || priorCycleId === cycleKey) continue;
        try {
          const priorBillId = `bill_${priorCycleId}_${cleanUid}`;
          const priorBillRef = doc(
            db,
            `households/${householdId}/memberBills`,
            priorBillId,
          );
          const priorSnap = await getDoc(priorBillRef);
          const coveredFromBreakdown =
            breakdownAmountByCycle.get(priorCycleId) || 0;

          if (priorSnap.exists()) {
            const pBill = priorSnap.data();
            const pDue = Math.max(
              Number(pBill.totalDueCentavos || 0),
              coveredFromBreakdown,
            );
            const pPaid = Math.max(
              pDue,
              Number(pBill.totalPaidCentavos || pBill.paidCentavos || 0),
              coveredFromBreakdown,
            );
            const pItems = Array.isArray(pBill.lineItems)
              ? pBill.lineItems.map((li: any) =>
                  sanitizeData({ ...li, status: "PAID", isSettled: true }),
                )
              : undefined;
            await updateDoc(
              priorBillRef,
              sanitizeData({
                totalDueCentavos: pDue,
                totalPaidCentavos: pPaid,
                paidCentavos: pPaid,
                outstandingCentavos: 0,
                status: "PAID",
                settledViaCycleId: cycleKey,
                ...(pItems ? { lineItems: pItems } : {}),
                updatedDate: nowIso,
              }),
            );
          } else {
            await setDoc(
              priorBillRef,
              sanitizeData({
                billId: priorBillId,
                householdId,
                billingCycleId: priorCycleId,
                userId: cleanUid,
                totalDueCentavos: coveredFromBreakdown,
                totalPaidCentavos: coveredFromBreakdown,
                paidCentavos: coveredFromBreakdown,
                outstandingCentavos: 0,
                status: "PAID",
                settledViaCycleId: cycleKey,
                createdDate: nowIso,
                updatedDate: nowIso,
              }),
              { merge: true },
            );
          }
        } catch {}
      }
    } catch (err) {
      console.warn("[applyPaymentToMemberBills] warning:", err);
    }
  },

  async applyPaymentToExpenses(
    householdId: string,
    userId: string,
    amountCentavos: number,
    paymentId?: string,
    billingCycleId?: string,
    breakdownItems?: MobilePaymentBreakdownItem[],
  ): Promise<void> {
    try {
      const expSnap = await getDocs(
        collection(db, `households/${householdId}/expenses`),
      );
      let remainingPayment = amountCentavos;
      const touchedCycleIds = new Set<string>();
      if (billingCycleId && billingCycleId !== "general") {
        touchedCycleIds.add(billingCycleId);
      }
      if (Array.isArray(breakdownItems)) {
        breakdownItems.forEach((bi) => {
          if (bi?.cycleId && bi.cycleId !== "general") {
            touchedCycleIds.add(String(bi.cycleId));
          }
        });
      }

      // Sort FIFO: settle overdue prior-cycle expenses first, then active-cycle expenses
      const sortedDocs = [...expSnap.docs].sort((a, b) => {
        const expA = a.data();
        const expB = b.data();
        const aIsPrior =
          billingCycleId &&
          billingCycleId !== "general" &&
          expA.billingCycleId &&
          expA.billingCycleId !== billingCycleId
            ? 0
            : 1;
        const bIsPrior =
          billingCycleId &&
          billingCycleId !== "general" &&
          expB.billingCycleId &&
          expB.billingCycleId !== billingCycleId
            ? 0
            : 1;
        if (aIsPrior !== bIsPrior) return aIsPrior - bIsPrior;
        const tA = new Date(expA.createdAt || expA.date || 0).getTime() || 0;
        const tB = new Date(expB.createdAt || expB.date || 0).getTime() || 0;
        return tA - tB;
      });

      for (const d of sortedDocs) {
        if (remainingPayment <= 0) break;
        const exp = d.data();
        if (exp.status === "PAID" && exp.isPaid) continue;

        let modified = false;
        let splits = exp.splitDetails || [];
        if (Array.isArray(splits)) {
          splits = splits.map((s: any) => {
            const isUser =
              matchesMemberUid(s, userId) ||
              s.userId === userId ||
              s.memberId === userId ||
              s.id === userId;
            if (isUser && !s.isPaid && (Number(s.shareCentavos) || 0) > 0) {
              const unpaidForSplit = Math.max(
                0,
                (Number(s.shareCentavos) || 0) -
                  (Number(s.paidAmountCentavos) || 0),
              );
              const targetAmt =
                unpaidForSplit > 0 ? unpaidForSplit : Number(s.shareCentavos);
              const toPay = Math.min(remainingPayment, targetAmt);
              if (toPay <= 0) return sanitizeData(s);
              remainingPayment -= toPay;
              modified = true;
              const newSplitPaid = (Number(s.paidAmountCentavos) || 0) + toPay;
              const isFullyPaidSplit =
                newSplitPaid >= (Number(s.shareCentavos) || 0);
              const resolvedPmtId = paymentId || s.paymentId;
              return sanitizeData({
                ...s,
                isPaid: isFullyPaidSplit,
                paidAmountCentavos: newSplitPaid,
                paidDate: new Date().toISOString(),
                ...(resolvedPmtId ? { paymentId: resolvedPmtId } : {}),
              });
            }
            return sanitizeData(s);
          });
        }

        const allPaid =
          Array.isArray(splits) &&
          splits.length > 0 &&
          splits.every((s: any) => s.isExempt || s.isPaid);

        if (modified) {
          if (exp.billingCycleId) {
            touchedCycleIds.add(String(exp.billingCycleId));
          }
          await updateDoc(
            doc(db, `households/${householdId}/expenses`, d.id),
            sanitizeData({
              splitDetails: splits,
              ...(allPaid ? { status: "PAID", isPaid: true } : {}),
              updatedAt: new Date().toISOString(),
            }),
          );
        }
      }

      // Check and update expenses for all affected cycles (both prior overdue cycles and active cycle)
      for (const cycId of Array.from(touchedCycleIds)) {
        await this.markExpensesPaidIfAllSettled(householdId, cycId);
      }
    } catch (err) {
      console.warn("[applyPaymentToExpenses] warning:", err);
    }
  },

  async submitPayment(
    payment: Omit<
      MobilePayment,
      "paymentId" | "status" | "createdDate" | "paymentDate"
    >,
  ): Promise<string> {
    try {
      const paymentId = `pmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);
      const uid = payment.userId || auth.currentUser?.uid || "";
      const userName =
        payment.userName ||
        auth.currentUser?.displayName ||
        _cachedUserProfile?.displayName ||
        "Resident";

      let hostId = _cachedHousehold?.hostId;
      if (!hostId && payment.householdId) {
        try {
          const hhSnap = await getDoc(
            doc(db, "households", payment.householdId),
          );
          if (hhSnap.exists()) {
            hostId = hhSnap.data()?.hostId;
          }
        } catch {}
      }

      const isHost = Boolean(
        uid &&
        (uid === hostId ||
          _cachedUserProfile?.role === "HOST" ||
          _cachedUserProfile?.role === "SUPER_ADMIN"),
      );

      // Status is VERIFIED immediately if host, or VERIFIED for auto-credit with record for roommate peace of mind
      const status: "PENDING" | "VERIFIED" = isHost ? "VERIFIED" : "VERIFIED";

      let resolvedCycleId = payment.billingCycleId;
      let resolvedCycleDoc: any = null;
      let allCyclesList: any[] = [];
      if (payment.householdId) {
        try {
          const cycSnap = await getDocs(
            collection(db, `households/${payment.householdId}/billingCycles`),
          );
          allCyclesList = sortBillingCyclesNewest(
            cycSnap.docs.map((d) => d.data()),
          );
          if (resolvedCycleId && resolvedCycleId !== "general") {
            resolvedCycleDoc =
              allCyclesList.find((c) => c.billingCycleId === resolvedCycleId) ||
              allCyclesList[0];
          } else {
            resolvedCycleDoc = allCyclesList[0];
            if (resolvedCycleDoc?.billingCycleId) {
              resolvedCycleId = resolvedCycleDoc.billingCycleId;
            }
          }
        } catch {}
      }
      const effectiveCycleId = resolvedCycleId || "general";
      const resolvedCycleName =
        payment.billingCycleName ||
        resolvedCycleDoc?.name ||
        resolvedCycleDoc?.cycleName ||
        undefined;

      // Block payment submission for non-host payors when the host has not opened payments for the cycle
      if (
        !isHost &&
        isCyclePaymentsLocked(resolvedCycleDoc, _cachedHousehold)
      ) {
        throw new Error(
          "Payments are currently locked by your host. Please wait until the host opens payments for this billing cycle.",
        );
      }

      // Build immutable itemized receipt breakdown snapshot (FIFO: Overdue charges first, then active cycle charges)
      let breakdownItems: MobilePaymentBreakdownItem[] | undefined =
        Array.isArray(payment.breakdownItems) &&
        payment.breakdownItems.length > 0
          ? payment.breakdownItems
          : undefined;

      if (!breakdownItems && payment.householdId && uid) {
        try {
          const cycleNameMap = new Map<string, string>();
          allCyclesList.forEach((c) => {
            if (c?.billingCycleId) {
              cycleNameMap.set(
                String(c.billingCycleId),
                c.name || c.cycleName || "Billing Cycle",
              );
            }
          });

          const [expSnap, memSnap, activeBillSnap] = await Promise.all([
            getDocs(
              collection(db, `households/${payment.householdId}/expenses`),
            ),
            getDocs(
              collection(db, `households/${payment.householdId}/members`),
            ),
            getDoc(
              doc(
                db,
                `households/${payment.householdId}/memberBills`,
                `bill_${effectiveCycleId}_${uid}`,
              ),
            ),
          ]);

          const activePayors = memSnap.docs
            .map((md) => md.data())
            .filter((m) => m.status === "ACTIVE" && isPayorMember(m));
          const payorCount = Math.max(1, activePayors.length);

          let budget = Number(payment.amountCentavos) || 0;
          const computedBreakdown: MobilePaymentBreakdownItem[] = [];
          const coveredPriorCycleAmounts = new Map<string, number>();

          const allExpenseDocs = expSnap.docs
            .map((ed) => ({ id: ed.id, ...(ed.data() as any) }))
            .filter((e) => !(e.status === "PAID" && e.isPaid));

          const priorExpenses = allExpenseDocs
            .filter(
              (e) =>
                e.billingCycleId &&
                effectiveCycleId !== "general" &&
                e.billingCycleId !== effectiveCycleId,
            )
            .sort((a, b) => {
              const tA = new Date(a.createdAt || a.date || 0).getTime() || 0;
              const tB = new Date(b.createdAt || b.date || 0).getTime() || 0;
              return tA - tB;
            });

          const activeExpenses = allExpenseDocs
            .filter(
              (e) =>
                !e.billingCycleId ||
                effectiveCycleId === "general" ||
                e.billingCycleId === effectiveCycleId,
            )
            .sort((a, b) => {
              const tA = new Date(a.createdAt || a.date || 0).getTime() || 0;
              const tB = new Date(b.createdAt || b.date || 0).getTime() || 0;
              return tA - tB;
            });

          const getShareForUser = (exp: any): number => {
            const split = Array.isArray(exp.splitDetails)
              ? exp.splitDetails.find(
                  (s: any) =>
                    matchesMemberUid(s, uid) ||
                    s.userId === uid ||
                    s.memberId === uid,
                )
              : null;
            if (split?.isExempt || split?.isPaid) return 0;
            if (split && typeof split.shareCentavos === "number") {
              const rem =
                split.shareCentavos - (Number(split.paidAmountCentavos) || 0);
              return Math.max(0, rem > 0 ? rem : split.shareCentavos);
            }
            return (
              computeFairSplitShareCentavos(
                Number(exp.amountCents) || 0,
                activePayors,
                uid,
              ) || Math.round((Number(exp.amountCents) || 0) / payorCount)
            );
          };

          // 1. Overdue expenses from closed/prior cycles
          for (const exp of priorExpenses) {
            if (budget <= 0) break;
            const share = getShareForUser(exp);
            if (share <= 0) continue;
            const covered = Math.min(budget, share);
            budget -= covered;
            const pCycId = String(exp.billingCycleId || "");
            coveredPriorCycleAmounts.set(
              pCycId,
              (coveredPriorCycleAmounts.get(pCycId) || 0) + covered,
            );
            computedBreakdown.push({
              id: exp.id,
              title:
                cleanBillTitle(
                  exp.title,
                  exp.category,
                  _cachedHousehold?.householdName || _cachedHousehold?.name,
                ) ||
                exp.category ||
                "Overdue Charge",
              category: exp.category || "General",
              cycleId: pCycId || undefined,
              cycleName: cycleNameMap.get(pCycId) || "Previous Cycle",
              isOverdue: true,
              householdAmountCentavos: Number(exp.amountCents) || undefined,
              shareCentavos: covered,
            });
          }

          // 2. Fallback: any carried-over Arrears line items on active memberBill not already detailed above
          if (budget > 0 && activeBillSnap.exists()) {
            const bData = activeBillSnap.data();
            const arrearsItems = (bData?.lineItems || []).filter(
              (li: any) =>
                (li.category === "Arrears" || li.isArrears) &&
                li.status !== "PAID" &&
                !li.isSettled &&
                !li.isExempt,
            );
            for (const arr of arrearsItems) {
              if (budget <= 0) break;
              const pCycId = String(arr.priorCycleId || "");
              const alreadyDetailed = pCycId
                ? coveredPriorCycleAmounts.get(pCycId) || 0
                : 0;
              const remArrears = Math.max(
                0,
                (Number(arr.amountCentavos) || 0) - alreadyDetailed,
              );
              if (remArrears <= 0) continue;
              const covered = Math.min(budget, remArrears);
              budget -= covered;
              computedBreakdown.push({
                id: arr.itemId || `arrears_${pCycId || "prior"}`,
                title: arr.description || "Previous Balance (Overdue)",
                category: "Arrears",
                cycleId: pCycId || undefined,
                cycleName:
                  (pCycId && cycleNameMap.get(pCycId)) || "Previous Cycle",
                isOverdue: true,
                shareCentavos: covered,
              });
            }
          }

          // 3. Current cycle expenses
          for (const exp of activeExpenses) {
            if (budget <= 0) break;
            const share = getShareForUser(exp);
            if (share <= 0) continue;
            const covered = Math.min(budget, share);
            budget -= covered;
            computedBreakdown.push({
              id: exp.id,
              title:
                cleanBillTitle(
                  exp.title,
                  exp.category,
                  _cachedHousehold?.householdName || _cachedHousehold?.name,
                ) ||
                exp.category ||
                "Bill",
              category: exp.category || "General",
              cycleId:
                effectiveCycleId !== "general" ? effectiveCycleId : undefined,
              cycleName: resolvedCycleName,
              isOverdue: false,
              householdAmountCentavos: Number(exp.amountCents) || undefined,
              shareCentavos: covered,
            });
          }

          if (computedBreakdown.length > 0) {
            breakdownItems = computedBreakdown;
          }
        } catch (bdErr) {
          console.warn("[submitPayment] breakdown snapshot warning:", bdErr);
        }
      }

      const paymentRecord: MobilePayment = sanitizeData({
        paymentId,
        householdId: payment.householdId,
        billingCycleId: effectiveCycleId,
        billingCycleName: resolvedCycleName,
        userId: uid,
        userName,
        amountCentavos: payment.amountCentavos,
        paymentMethod: payment.paymentMethod,
        referenceNumber:
          payment.referenceNumber || `REF-${Date.now().toString().slice(-6)}`,
        proofOfPaymentUrl: payment.proofOfPaymentUrl || undefined,
        notes: payment.notes || "",
        status,
        paymentDate: todayDate,
        createdDate: nowIso,
        verifiedDate: nowIso,
        verifiedBy: isHost ? uid : undefined,
        ...(breakdownItems ? { breakdownItems } : {}),
      });

      const paymentDocRef = doc(
        db,
        `households/${payment.householdId}/payments`,
        paymentId,
      );
      await setDoc(paymentDocRef, paymentRecord, { merge: true });

      // Apply directly to member bills and itemized expenses so dues drop immediately
      await this.applyPaymentToMemberBills(
        payment.householdId,
        effectiveCycleId,
        uid,
        payment.amountCentavos,
        breakdownItems,
      );
      await this.applyPaymentToExpenses(
        payment.householdId,
        uid,
        payment.amountCentavos,
        paymentId,
        effectiveCycleId,
        breakdownItems,
      );

      // Notify host or self
      try {
        const notifRecipientId = isHost ? uid : hostId;
        if (notifRecipientId) {
          const notifId = `notif_${notifRecipientId}_${paymentId}`;
          const amtStr = formatPesos(payment.amountCentavos);
          await setDoc(
            doc(db, "notifications", notifId),
            sanitizeData({
              notificationId: notifId,
              recipientId: notifRecipientId,
              householdId: payment.householdId,
              type: "PAYMENT_SUBMITTED",
              category: "payment_received",
              title: isHost ? "Payment Recorded" : "New Payment Submitted!",
              message: isHost
                ? `You recorded a verified payment of ${amtStr} via ${payment.paymentMethod}.`
                : `${userName} submitted a payment of ${amtStr} via ${payment.paymentMethod} (Ref: ${paymentRecord.referenceNumber}).`,
              spans: [
                {
                  text: isHost
                    ? "Recorded payment of "
                    : `${userName} submitted `,
                },
                { text: amtStr, bold: true, color: "#16A34A" },
                { text: ` via ${payment.paymentMethod}.` },
              ],
              relatedItemId: paymentId,
              relatedEntityId: paymentId,
              readStatus: false,
              createdTimestamp: nowIso,
            }),
            { merge: true },
          );
        }

        // Dispatch high-priority push notification to the host if roommate submitted payment
        if (!isHost && hostId) {
          const cleanHostId = String(hostId).replace(/^mem_/, "").trim();
          pushDispatchService
            .sendPaymentSubmittedPush({
              hostId: cleanHostId,
              payerName: userName,
              amountCentavos: payment.amountCentavos,
              paymentMethod: payment.paymentMethod,
              householdName:
                _cachedHousehold?.householdName ||
                _cachedHousehold?.name ||
                "Household",
              paymentId,
            })
            .catch((pushErr) => {
              console.warn(
                "[submitPayment] Push dispatch to host deferred:",
                pushErr,
              );
            });
        }
      } catch (notifErr) {
        console.warn("[submitPayment] notification error:", notifErr);
      }

      return paymentId;
    } catch (err) {
      console.error("[submitPayment Direct] Error:", err);
      throw err;
    }
  },

  async verifyPayment(
    householdId: string,
    paymentId: string,
    approved: boolean,
    rejectionReason?: string,
  ): Promise<boolean> {
    try {
      const paymentRef = doc(
        db,
        `households/${householdId}/payments`,
        paymentId,
      );
      const snap = await getDoc(paymentRef);
      if (!snap.exists()) return false;
      const payment = snap.data() as MobilePayment;
      const callerUid = auth.currentUser?.uid || "";
      const nowIso = new Date().toISOString();

      await updateDoc(paymentRef, {
        status: approved ? "VERIFIED" : "REJECTED",
        verifiedDate: nowIso,
        verifiedBy: callerUid,
        rejectionReason: rejectionReason || null,
        updatedDate: nowIso,
      });

      if (approved && payment.userId && payment.amountCentavos) {
        await this.applyPaymentToMemberBills(
          householdId,
          payment.billingCycleId || "general",
          payment.userId,
          payment.amountCentavos,
        );
      }

      if (payment.userId) {
        const notifId = `notif_${payment.userId}_${paymentId}_status`;
        const amtStr = formatPesos(payment.amountCentavos);
        await setDoc(
          doc(db, "notifications", notifId),
          sanitizeData({
            notificationId: notifId,
            recipientId: payment.userId,
            householdId,
            type: approved ? "PAYMENT_VERIFIED" : "PAYMENT_REJECTED",
            category: "payment_received",
            title: approved ? "Payment Approved! 🎉" : "Payment Rejected",
            message: approved
              ? `Your payment of ${amtStr} via ${payment.paymentMethod} was approved by the Host.`
              : `Your payment of ${amtStr} was not approved: ${rejectionReason || "Please verify reference details."}`,
            spans: [
              { text: approved ? "Your payment of " : "Payment of " },
              {
                text: amtStr,
                bold: true,
                color: approved ? "#16A34A" : "#E11D48",
              },
              {
                text: approved
                  ? " was verified."
                  : ` was declined: ${rejectionReason || ""}`,
              },
            ],
            relatedItemId: paymentId,
            relatedEntityId: paymentId,
            readStatus: false,
            createdTimestamp: nowIso,
          }),
          { merge: true },
        ).catch(() => {});

        // Dispatch high-priority push notification directly to the payor
        const cleanPayerId = String(payment.userId).replace(/^mem_/, "").trim();
        pushDispatchService
          .sendPaymentDecisionPush({
            payerId: cleanPayerId,
            approved,
            amountCentavos: payment.amountCentavos,
            paymentMethod: payment.paymentMethod,
            rejectionReason: rejectionReason || null,
            householdName:
              _cachedHousehold?.householdName ||
              _cachedHousehold?.name ||
              "Household",
            paymentId,
          })
          .catch((pushErr) => {
            console.warn(
              "[verifyPayment] Push dispatch to payor deferred:",
              pushErr,
            );
          });
      }

      return true;
    } catch (err) {
      console.error("[verifyPayment] Error:", err);
      throw err;
    }
  },

  listenToPayments(
    householdId: string,
    callback: (payments: MobilePayment[]) => void,
  ) {
    const q = collection(db, `households/${householdId}/payments`);
    return onSnapshot(
      q,
      (snap) => {
        const items: MobilePayment[] = [];
        snap.forEach((d) => items.push(d.data() as MobilePayment));
        items.sort(
          (a, b) =>
            new Date(b.createdDate).getTime() -
            new Date(a.createdDate).getTime(),
        );
        callback(items);
      },
      (err) => console.warn("[Firestore Mobile] listenToPayments:", err),
    );
  },

  // --- HOST PAYMENT METHODS ---
  async updateHouseholdPaymentMethods(
    householdId: string,
    paymentMethods: HostPaymentMethod[],
  ): Promise<boolean> {
    try {
      const docRef = doc(db, "households", householdId);
      await setDoc(
        docRef,
        sanitizeData({
          paymentMethods,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true },
      );
      return true;
    } catch (err) {
      console.error("[updateHouseholdPaymentMethods] Error:", err);
      throw err;
    }
  },

  listenToHouseholdPaymentMethods(
    householdId: string,
    callback: (methods: HostPaymentMethod[]) => void,
  ) {
    return this.listenToHousehold(householdId, (hh) => {
      if (
        hh &&
        Array.isArray(hh.paymentMethods) &&
        hh.paymentMethods.length > 0
      ) {
        callback(hh.paymentMethods);
      } else {
        callback(DEFAULT_HOST_PAYMENT_METHODS);
      }
    });
  },

  // --- WATER ATTENDANCE ---
  async toggleAttendance(
    householdId: string,
    cycleId: string,
    userId: string,
    date: string,
    status: "PRESENT" | "ABSENT",
  ): Promise<void> {
    try {
      const id = `${cycleId}_${userId}_${date}`;
      const ref = doc(db, `households/${householdId}/waterAttendance`, id);
      await setDoc(
        ref,
        sanitizeData({
          recordId: id,
          householdId,
          billingCycleId: cycleId,
          userId,
          date,
          status,
          locked: false,
          modifiedBy: auth.currentUser?.uid || userId,
          modifiedTimestamp: new Date().toISOString(),
        }),
        { merge: true },
      );
    } catch (err) {
      console.warn("[Firestore Mobile] toggleAttendance error:", err);
      throw err;
    }
  },

  async bulkToggleAttendance(
    householdId: string,
    cycleId: string,
    userId: string,
    entries: Array<{ date: string; status: "PRESENT" | "ABSENT" }>,
  ): Promise<void> {
    if (!householdId || !cycleId || !userId || entries.length === 0) return;
    try {
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();
      const modifier = auth.currentUser?.uid || userId;
      for (const item of entries) {
        const id = `${cycleId}_${userId}_${item.date}`;
        const ref = doc(db, `households/${householdId}/waterAttendance`, id);
        batch.set(
          ref,
          sanitizeData({
            recordId: id,
            householdId,
            billingCycleId: cycleId,
            userId,
            date: item.date,
            status: item.status,
            locked: false,
            modifiedBy: modifier,
            modifiedTimestamp: nowIso,
          }),
          { merge: true },
        );
      }
      await batch.commit();
    } catch (err) {
      console.warn("[Firestore Mobile] bulkToggleAttendance error:", err);
      throw err;
    }
  },

  listenToAttendance(
    householdId: string,
    cycleId: string,
    userId: string,
    callback: (markedDates: Record<string, "PRESENT" | "ABSENT">) => void,
  ) {
    const q = query(
      collection(db, `households/${householdId}/waterAttendance`),
      where("billingCycleId", "==", cycleId),
      where("userId", "==", userId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const map: Record<string, "PRESENT" | "ABSENT"> = {};
        snap.forEach((d) => {
          const item = d.data();
          if (item.billingCycleId === cycleId && item.userId === userId) {
            map[item.date] = item.status;
          }
        });
        callback(map);
      },
      (err) => console.warn("[Firestore Mobile] listenToAttendance:", err),
    );
  },

  listenToHouseholdCycleAttendance(
    householdId: string,
    cycleId: string,
    callback: (records: any[]) => void,
  ) {
    if (!householdId || !cycleId) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, `households/${householdId}/waterAttendance`),
      where("billingCycleId", "==", cycleId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push(d.data()));
        callback(list);
      },
      (err) =>
        console.warn(
          "[Firestore Mobile] listenToHouseholdCycleAttendance:",
          err,
        ),
    );
  },

  listenToAttendanceRecords(
    householdId: string,
    cycleId: string,
    callback: (records: any[]) => void,
  ) {
    return this.listenToHouseholdCycleAttendance(
      householdId,
      cycleId,
      callback,
    );
  },

  listenToAttendanceSubmissions(
    householdId: string,
    cycleId: string,
    callback: (submissions: Record<string, any>) => void,
  ) {
    if (!householdId || !cycleId) {
      callback({});
      return () => {};
    }
    const q = query(
      collection(db, `households/${householdId}/attendanceSubmissions`),
      where("billingCycleId", "==", cycleId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const map: Record<string, any> = {};
        snap.forEach((d) => {
          const item = d.data();
          map[item.userId] = item;
        });
        callback(map);
      },
      (err) =>
        console.warn("[Firestore Mobile] listenToAttendanceSubmissions:", err),
    );
  },

  async submitAttendance(
    householdId: string,
    cycleId: string,
    userId: string,
    daysPresent: number,
    daysAbsent: number,
    amountCentavos: number,
    allocationConfig?: {
      allocationMode: "FAIR_SPLIT" | "SPECIFIC_PAYOR" | "CUSTOM_SPLIT";
      assignedPayorId?: string;
      assignedPayorName?: string;
      customPayorSplitsCentavos?: Record<string, number>;
      customPayorPercentages?: Record<string, number>;
      customSplitInputType?: "PESO" | "PERCENT";
    },
  ): Promise<void> {
    if (!householdId || !cycleId || !userId) return;
    try {
      const subId = `${cycleId}_${userId}`;
      const ref = doc(
        db,
        `households/${householdId}/attendanceSubmissions`,
        subId,
      );
      await setDoc(
        ref,
        sanitizeData({
          id: subId,
          householdId,
          billingCycleId: cycleId,
          userId,
          daysPresent,
          daysAbsent,
          amountCentavos,
          ...(allocationConfig
            ? {
                allocationMode: allocationConfig.allocationMode,
                assignedPayorId: allocationConfig.assignedPayorId || "",
                assignedPayorName: allocationConfig.assignedPayorName || "",
                customPayorSplitsCentavos:
                  allocationConfig.customPayorSplitsCentavos || {},
                customPayorPercentages:
                  allocationConfig.customPayorPercentages || {},
                customSplitInputType:
                  allocationConfig.customSplitInputType || "PESO",
              }
            : {}),
          status: "SUBMITTED",
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        { merge: true },
      );

      // Synchronize water bill in active cycle and update all member bills
      await this.syncCycleWaterBill(householdId, cycleId);
      await this.recalculateUnpaidExpensesForHousehold(householdId);
    } catch (err) {
      console.error("[submitAttendance Mobile] Error:", err);
      throw err;
    }
  },

  async savePushToken(record: {
    userId: string;
    deviceId: string;
    pushToken: string;
    platform: string;
    appVersion: string;
    lastActiveDate: string;
  }): Promise<void> {
    const ref = doc(db, `users/${record.userId}/devices`, record.deviceId);
    await setDoc(ref, record, { merge: true });
  },

  // --- CLOUD NOTIFICATIONS & READ STATUS ---
  listenToNotifications(
    userId: string | undefined,
    callback: (items: any[]) => void,
  ) {
    if (!userId) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "in", [userId, "ALL"]),
    );

    const handleSnapshot = (snap: any) => {
      const list: any[] = [];
      let readUpdated = false;
      const userMap = getUserReadMap(userId);
      snap.forEach((d: any) => {
        const data = d.data();
        if (
          data.recipientId &&
          data.recipientId !== userId &&
          data.recipientId !== "ALL" &&
          !data.isBroadcast
        ) {
          return;
        }
        const docId = d.id || data.notificationId;
        list.push({ id: docId, ...data });
        if (data.readStatus === true && data.readByRecipientId === userId) {
          const scopedDocKey = getScopedNotificationReadKey(userId, docId);
          if (scopedDocKey && !userMap[scopedDocKey]) {
            userMap[scopedDocKey] = true;
            readUpdated = true;
          }
          if (data.relatedItemId) {
            const scopedItemKey = getScopedNotificationReadKey(
              userId,
              data.relatedItemId,
            );
            if (scopedItemKey && !userMap[scopedItemKey]) {
              userMap[scopedItemKey] = true;
              readUpdated = true;
            }
          }
        }
      });
      if (readUpdated) {
        notifyReadSubscribers(userId);
        AsyncStorage.setItem(
          getReadNotificationsStorageKey(userId),
          JSON.stringify(userMap),
        ).catch(() => {});
      }
      list.sort((a, b) =>
        String(b.createdTimestamp || "").localeCompare(
          String(a.createdTimestamp || ""),
        ),
      );
      callback(list);
    };

    try {
      return onSnapshot(q, handleSnapshot, (err) => {
        // If 'in' query encounters index constraint, fallback to standard direct query
        console.warn(
          "[Firestore Mobile] listenToNotifications fallback query notice:",
          err?.message || err,
        );
        try {
          const fallbackQ = query(
            collection(db, "notifications"),
            where("recipientId", "==", userId),
          );
          return onSnapshot(fallbackQ, handleSnapshot, () => callback([]));
        } catch {
          callback([]);
        }
      });
    } catch {
      callback([]);
      return () => {};
    }
  },

  listenToReadNotificationIds(
    userId: string | undefined,
    callback: (readIds: Record<string, boolean>) => void,
  ) {
    _readNotificationSubscribers.set(callback, userId);

    // Emit current cached state for this user immediately
    callback(this.getCachedReadNotifications(userId));

    if (userId) {
      // Load from per-user AsyncStorage key and merge with cloud user profile
      AsyncStorage.getItem(getReadNotificationsStorageKey(userId))
        .then((raw) => {
          if (raw) {
            const parsed = JSON.parse(raw);
            if (mergeUserReadMap(userId, parsed)) {
              notifyReadSubscribers(userId);
            }
          }
        })
        .catch(() => {});

      getDoc(doc(db, "users", userId))
        .then((snap) => {
          if (snap.exists()) {
            const uData = snap.data();
            if (
              uData?.readNotificationIdsV2 &&
              typeof uData.readNotificationIdsV2 === "object"
            ) {
              if (mergeUserReadMap(userId, uData.readNotificationIdsV2)) {
                notifyReadSubscribers(userId);
                AsyncStorage.setItem(
                  getReadNotificationsStorageKey(userId),
                  JSON.stringify(getUserReadMap(userId)),
                ).catch(() => {});
              }
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      _readNotificationSubscribers.delete(callback);
    };
  },

  async syncRealNotificationsToCloud(
    userId: string | undefined,
    householdId: string | undefined,
    items: MobileNotificationItem[],
    existingCloudDocs: any[],
    _readIds: Record<string, boolean>,
  ): Promise<void> {
    if (!userId || items.length === 0) return;

    const existingMap = new Map<string, any>();
    existingCloudDocs.forEach((docItem) => {
      if (docItem.recipientId && docItem.recipientId !== userId) return;
      const id = docItem.id || docItem.notificationId;
      if (id) existingMap.set(id, docItem);
      if (docItem.relatedItemId)
        existingMap.set(docItem.relatedItemId, docItem);
    });

    for (const item of items) {
      const perUserDocId = `notif_${userId}_${item.id}`;
      const existing =
        existingMap.get(perUserDocId) ||
        existingMap.get(item.cloudDocId) ||
        existingMap.get(item.id);

      if (!existing && !_syncedCloudNotifIds.has(perUserDocId)) {
        _syncedCloudNotifIds.add(perUserDocId);
        const typeMap: Record<NotificationCategory, string> = {
          reminder: "BILL_FINALIZED",
          expense_added: "BILL_UPDATED",
          payment_received: "PAYMENT_SUBMITTED",
          water_calculated: "ATTENDANCE_UPDATED",
          group_invite: "INVITATION_RECEIVED",
          announcement: "SYSTEM_BROADCAST",
        };
        setDoc(
          doc(db, "notifications", perUserDocId),
          sanitizeData({
            notificationId: perUserDocId,
            recipientId: userId,
            householdId: householdId || "",
            type: typeMap[item.category] || "BILL_UPDATED",
            category: item.category,
            title: item.title,
            message: item.message,
            spans: item.spans,
            relatedItemId: item.id,
            relatedEntityId: item.relatedEntityId || item.id,
            readStatus: false,
            createdTimestamp: item.createdTimestamp,
            updatedTimestamp: new Date().toISOString(),
          }),
          { merge: true },
        ).catch(() => {});
      }
    }
  },

  async markNotificationsRead(
    userId: string | undefined,
    items: Array<{ id: string; cloudDocId?: string }>,
  ): Promise<void> {
    const effectiveUid = (userId || auth.currentUser?.uid || "").trim();
    if (!effectiveUid || !items || items.length === 0) return;

    const nowIso = new Date().toISOString();
    const updatedReadMap: Record<string, boolean> = {
      ...this.getCachedReadNotifications(effectiveUid),
    };

    items.forEach((item) => {
      const perUserDocId =
        item.cloudDocId && item.cloudDocId.startsWith(`notif_${effectiveUid}_`)
          ? item.cloudDocId
          : `notif_${effectiveUid}_${item.id}`;
      let keyChanged = false;
      if (item.id) {
        const k1 = getScopedNotificationReadKey(effectiveUid, item.id);
        if (!updatedReadMap[k1]) {
          updatedReadMap[k1] = true;
          keyChanged = true;
        }
      }
      if (perUserDocId) {
        const k2 = getScopedNotificationReadKey(effectiveUid, perUserDocId);
        if (!updatedReadMap[k2]) {
          updatedReadMap[k2] = true;
          keyChanged = true;
        }
      }
      if (item.cloudDocId) {
        const k3 = getScopedNotificationReadKey(effectiveUid, item.cloudDocId);
        if (!updatedReadMap[k3]) {
          updatedReadMap[k3] = true;
          keyChanged = true;
        }
      }
    });

    _cachedReadNotificationIdsByUser[effectiveUid] = updatedReadMap;
    if (_cachedUserProfile && _cachedUserProfile.uid === effectiveUid) {
      _cachedUserProfile = {
        ..._cachedUserProfile,
        readNotificationIdsV2: updatedReadMap,
      };
    }

    // Notify all active screens for this user immediately in UI
    notifyReadSubscribers(effectiveUid);

    // Persist locally under per-user storage key (instant & zero Firestore quota)
    try {
      await AsyncStorage.setItem(
        getReadNotificationsStorageKey(effectiveUid),
        JSON.stringify(updatedReadMap),
      );
    } catch {}

    // Debounce cloud write to the single user document: exactly 1 write total, zero per-item writes
    _pendingUserReadMapUpdates[effectiveUid] = updatedReadMap;
    if (_markNotificationsReadTimer) {
      clearTimeout(_markNotificationsReadTimer);
    }
    _markNotificationsReadTimer = setTimeout(async () => {
      const pendingMap = _pendingUserReadMapUpdates[effectiveUid];
      if (!pendingMap) return;
      delete _pendingUserReadMapUpdates[effectiveUid];
      try {
        await setDoc(
          doc(db, "users", effectiveUid),
          sanitizeData({
            readNotificationIdsV2: pendingMap,
            updatedDate: new Date().toISOString(),
          }),
          { merge: true },
        );
      } catch (err) {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceeded();
        } else {
          console.warn(
            "[Firestore Mobile] markNotificationsRead user sync notice:",
            err,
          );
        }
      }
    }, 3000);
  },

  listenToHouseholdMessages(
    householdId: string,
    callback: (messages: any[]) => void,
  ): () => void {
    if (!householdId) {
      callback([]);
      return () => {};
    }
    const currentUid = auth.currentUser?.uid;
    const colRef = collection(db, `households/${householdId}/messages`);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const msgs = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter((m: any) => {
            if (
              currentUid &&
              m.deletedFor &&
              Array.isArray(m.deletedFor) &&
              (m.deletedFor.includes(currentUid) ||
                m.deletedFor.includes(`mem_${currentUid}`))
            ) {
              return false;
            }
            return true;
          })
          .map((m: any) => {
            const plain = decryptMessage(
              m.text,
              m.conversationId || householdId,
              [m.senderId, m.recipientId].filter(Boolean),
            );
            return { ...m, text: plain };
          });

        // Sort in memory by createdAt or timestamp ascending
        msgs.sort((a: any, b: any) => {
          const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
          const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
          return timeA - timeB;
        });
        callback(msgs);
      },
      (err) => {
        console.warn(
          "[Firestore Mobile] listenToHouseholdMessages error:",
          err,
        );
      },
    );
  },

  async sendHouseholdMessage(
    householdId: string,
    message: {
      conversationId: string;
      senderId: string;
      senderName: string;
      text: string;
      recipientId?: string;
      type?:
        | "text"
        | "expense_split"
        | "payment_claim"
        | "receipt_review"
        | "image"
        | "file"
        | string;
      meta?: any;
    },
  ): Promise<string> {
    if (!householdId) {
      throw new Error("householdId is required to send a message");
    }
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const encryptedText = encryptMessage(
      message.text,
      message.conversationId || householdId,
      [message.senderId, message.recipientId].filter(Boolean) as string[],
    );

    const newDoc = {
      id: msgId,
      householdId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.senderName,
      text: encryptedText,
      recipientId: message.recipientId || null,
      type: message.type || "text",
      meta: message.meta || {},
      readBy: [message.senderId],
      createdAt: nowIso,
      timestamp: nowIso,
      isEncrypted: true,
    };
    await setDoc(
      doc(db, `households/${householdId}/messages`, msgId),
      sanitizeData(newDoc),
    );

    // Real-time Push Notification dispatch to recipient / active roommates
    // Delivers heads-up banner with sound & vibration even when app is closed
    pushDispatchService
      .sendHouseholdMessagePush({
        householdId,
        senderId: message.senderId,
        senderName: message.senderName || "Roommate",
        text:
          message.type === "image"
            ? "📷 Sent an image"
            : message.type === "file"
              ? "📎 Sent a file"
              : message.text || "Sent a message",
        messageId: msgId,
        recipientId: message.recipientId || null,
      })
      .catch((pushErr) => {
        console.warn(
          "[Firestore Mobile] Message push dispatch deferred:",
          pushErr,
        );
      });

    return msgId;
  },

  async updateHouseholdMessage(
    householdId: string,
    messageId: string,
    updates: any,
  ): Promise<void> {
    if (!householdId || !messageId) return;
    await updateDoc(
      doc(db, `households/${householdId}/messages`, messageId),
      sanitizeData(updates),
    );
  },

  async markHouseholdMessagesRead(
    householdId: string,
    messageIds: string[],
    userId: string,
  ): Promise<void> {
    if (!householdId || !userId || !messageIds.length) return;
    try {
      const cleanIds = Array.from(new Set(messageIds)).slice(0, 25);
      const batch = writeBatch(db);
      cleanIds.forEach((msgId) => {
        const docRef = doc(db, `households/${householdId}/messages`, msgId);
        batch.update(docRef, {
          readBy: arrayUnion(userId),
        });
      });
      await batch.commit().catch(() => {});
    } catch (e) {
      console.warn("[Firestore Mobile] markHouseholdMessagesRead:", e);
    }
  },

  listenToDirectMessages(
    userId: string,
    callback: (messages: any[]) => void,
  ): () => void {
    if (!userId) {
      callback([]);
      return () => {};
    }
    const cleanUserId = String(userId).replace(/^mem_/, "").trim();
    const colRef = collection(db, "directMessages");
    const qSent = query(colRef, where("senderId", "==", cleanUserId));
    const qReceived = query(colRef, where("recipientId", "==", cleanUserId));

    let sentList: any[] = [];
    let receivedList: any[] = [];

    const notify = () => {
      const map = new Map<string, any>();
      sentList.forEach((m) => {
        if (
          !m.deletedFor ||
          !Array.isArray(m.deletedFor) ||
          (!m.deletedFor.includes(userId) &&
            !m.deletedFor.includes(cleanUserId))
        ) {
          const plain = decryptMessage(
            m.text,
            m.conversationId,
            [m.senderId, m.recipientId].filter(Boolean),
          );
          map.set(m.id, { ...m, text: plain });
        }
      });
      receivedList.forEach((m) => {
        if (
          !m.deletedFor ||
          !Array.isArray(m.deletedFor) ||
          (!m.deletedFor.includes(userId) &&
            !m.deletedFor.includes(cleanUserId))
        ) {
          const plain = decryptMessage(
            m.text,
            m.conversationId,
            [m.senderId, m.recipientId].filter(Boolean),
          );
          map.set(m.id, { ...m, text: plain });
        }
      });
      const list = Array.from(map.values());
      list.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
        const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
        return timeA - timeB;
      });
      callback(list);
    };

    const unsubSent = onSnapshot(
      qSent,
      (snap) => {
        sentList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        notify();
      },
      (err) => console.warn("[DirectMessages] sent:", err),
    );

    const unsubRecv = onSnapshot(
      qReceived,
      (snap) => {
        receivedList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        notify();
      },
      (err) => console.warn("[DirectMessages] received:", err),
    );

    return () => {
      unsubSent();
      unsubRecv();
    };
  },

  async markDirectMessagesRead(
    messageIds: string[],
    userId: string,
  ): Promise<void> {
    if (!userId || !messageIds.length) return;
    try {
      const cleanIds = Array.from(new Set(messageIds)).slice(0, 25);
      const batch = writeBatch(db);
      cleanIds.forEach((msgId) => {
        const docRef = doc(db, "directMessages", msgId);
        batch.update(docRef, {
          readBy: arrayUnion(userId),
        });
      });
      await batch.commit().catch(() => {});
    } catch (e) {
      console.warn("[Firestore Mobile] markDirectMessagesRead:", e);
    }
  },

  async sendDirectMessage(message: {
    conversationId: string;
    senderId: string;
    senderName: string;
    recipientId: string;
    text: string;
    type?: string;
    meta?: any;
    householdId?: string;
  }): Promise<string> {
    const msgId = `msg_dm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const cleanSenderId = message.senderId.replace(/^mem_/, "");
    const cleanRecipientId = message.recipientId.replace(/^mem_/, "");

    const encryptedText = encryptMessage(message.text, message.conversationId, [
      cleanSenderId,
      cleanRecipientId,
    ]);

    const newDoc = {
      id: msgId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.senderName,
      recipientId: message.recipientId,
      text: encryptedText,
      type: message.type || "text",
      meta: message.meta || {},
      readBy: [message.senderId],
      createdAt: nowIso,
      timestamp: nowIso,
      householdId: message.householdId || null,
      isEncrypted: true,
    };

    await setDoc(doc(db, "directMessages", msgId), sanitizeData(newDoc));

    if (message.householdId) {
      setDoc(
        doc(db, `households/${message.householdId}/messages`, msgId),
        sanitizeData(newDoc),
      ).catch(() => {});
    }

    pushDispatchService
      .sendHouseholdMessagePush({
        householdId: message.householdId || "direct",
        senderId: message.senderId,
        senderName: message.senderName || "Friend",
        text:
          message.type === "image"
            ? "📷 Sent an image"
            : message.type === "file"
              ? "📎 Sent a file"
              : message.text || "Sent a message",
        messageId: msgId,
        recipientId: message.recipientId,
      })
      .catch(() => {});

    return msgId;
  },

  /**
   * Updates an existing message's text (and encrypted payload) and marks it as edited.
   */
  async editMessage(options: {
    messageId: string;
    newText: string;
    householdId?: string;
    isDirect?: boolean;
    conversationId?: string;
    senderId?: string;
    recipientId?: string;
  }): Promise<void> {
    const {
      messageId,
      newText,
      householdId,
      isDirect,
      conversationId,
      senderId,
      recipientId,
    } = options;
    if (!messageId || typeof newText !== "string") return;

    const cleanSenderId = senderId
      ? String(senderId).replace(/^mem_/, "").trim()
      : "";
    const cleanRecipientId = recipientId
      ? String(recipientId).replace(/^mem_/, "").trim()
      : "";
    const encryptedText = encryptMessage(
      newText,
      conversationId || householdId || "general",
      [cleanSenderId, cleanRecipientId].filter(Boolean),
    );

    const updatePayload = sanitizeData({
      text: encryptedText,
      editedAt: new Date().toISOString(),
      isEdited: true,
    });

    if (isDirect) {
      await updateDoc(
        doc(db, "directMessages", messageId),
        updatePayload,
      ).catch(() => {});
    }
    if (householdId) {
      await updateDoc(
        doc(db, `households/${householdId}/messages`, messageId),
        updatePayload,
      ).catch(() => {});
    }
    if (!isDirect && !householdId) {
      await updateDoc(
        doc(db, "directMessages", messageId),
        updatePayload,
      ).catch(() => {});
    }
  },

  /**
   * Deletes an individual message either for everyone (permanent deletion)
   * or for the current user only (hidden via deletedFor array).
   */
  async deleteMessage(options: {
    messageId: string;
    householdId?: string;
    isDirect?: boolean;
    deleteForEveryone?: boolean;
    currentUid: string;
  }): Promise<void> {
    const { messageId, householdId, deleteForEveryone, currentUid } = options;
    if (!messageId) return;

    const cleanUid = String(currentUid || "")
      .replace(/^mem_/, "")
      .trim();

    if (deleteForEveryone) {
      try {
        await deleteDoc(doc(db, "directMessages", messageId)).catch(() => {});
      } catch {}
      if (householdId) {
        try {
          await deleteDoc(
            doc(db, `households/${householdId}/messages`, messageId),
          ).catch(() => {});
        } catch {}
      }
    } else {
      if (!cleanUid) return;
      try {
        await updateDoc(doc(db, "directMessages", messageId), {
          deletedFor: arrayUnion(cleanUid, currentUid),
        }).catch(() => {});
      } catch {}
      if (householdId) {
        try {
          await updateDoc(
            doc(db, `households/${householdId}/messages`, messageId),
            {
              deletedFor: arrayUnion(cleanUid, currentUid),
            },
          ).catch(() => {});
        } catch {}
      }
    }
  },

  /**
   * Toggles an emoji reaction from the current user on a message.
   * If the user already reacted with this emoji, removes it. Otherwise, adds it.
   */
  async toggleMessageReaction(options: {
    messageId: string;
    householdId?: string;
    isDirect?: boolean;
    emoji: string;
    userId: string;
  }): Promise<{ added: boolean; reactions: Record<string, string[]> }> {
    const { messageId, householdId, isDirect, emoji, userId } = options;
    const cleanUid = String(userId || "")
      .replace(/^mem_/, "")
      .trim();
    if (!messageId || !cleanUid || !emoji)
      return { added: false, reactions: {} };

    const docRef = isDirect
      ? doc(db, "directMessages", messageId)
      : householdId
        ? doc(db, `households/${householdId}/messages`, messageId)
        : doc(db, "directMessages", messageId);

    try {
      let targetRef = docRef;
      let snap = await getDoc(targetRef);
      if (!snap.exists()) {
        const altRef = householdId
          ? doc(db, `households/${householdId}/messages`, messageId)
          : doc(db, "directMessages", messageId);
        const altSnap = await getDoc(altRef);
        if (altSnap.exists()) {
          targetRef = altRef;
          snap = altSnap;
        } else {
          return { added: false, reactions: {} };
        }
      }

      const currentReactions: Record<string, string[]> =
        snap.data()?.reactions || {};
      const userList: string[] = Array.isArray(currentReactions[emoji])
        ? [...currentReactions[emoji]]
        : [];
      const idx = userList.indexOf(cleanUid);
      let added = false;
      if (idx >= 0) {
        userList.splice(idx, 1);
      } else {
        userList.push(cleanUid);
        added = true;
      }
      const updatedReactions = { ...currentReactions };
      if (userList.length === 0) {
        delete updatedReactions[emoji];
      } else {
        updatedReactions[emoji] = userList;
      }
      await updateDoc(targetRef, { reactions: updatedReactions }).catch(
        () => {},
      );
      return { added, reactions: updatedReactions };
    } catch (e) {
      console.warn("[toggleMessageReaction] Error:", e);
      return { added: false, reactions: {} };
    }
  },

  /**
   * Deletes an entire conversation and all its messages permanently.
   */
  async deleteConversation(options: {
    conversationId: string;
    householdId?: string;
    currentUid: string;
  }): Promise<void> {
    const { conversationId, householdId } = options;
    if (!conversationId) return;

    try {
      // 1. Delete all matching messages from directMessages
      const colRef = collection(db, "directMessages");
      const snapDirect = await getDocs(
        query(colRef, where("conversationId", "==", conversationId)),
      );
      if (!snapDirect.empty) {
        const batch = writeBatch(db);
        snapDirect.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit().catch(() => {});
      }

      // 2. If in household messages
      if (householdId) {
        const hhCol = collection(db, `households/${householdId}/messages`);
        const snapHh = await getDocs(
          query(hhCol, where("conversationId", "==", conversationId)),
        );
        if (!snapHh.empty) {
          const batchHh = writeBatch(db);
          snapHh.docs.forEach((d) => batchHh.delete(d.ref));
          await batchHh.commit().catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[deleteConversation] Error:", e);
    }
  },

  async seedHouseholdMessagesIfEmpty(
    _householdId: string,
    _initialMessages: any[],
  ): Promise<void> {
    // No-op: Do not auto-seed dummy data so deleted databases stay clean
    return;
  },

  async updateUserHeartbeat(
    householdId?: string,
    userId?: string,
  ): Promise<void> {
    const rawUid = userId || auth.currentUser?.uid;
    if (!rawUid) return;
    const uid = String(rawUid).replace(/^mem_/, "").trim();

    // 10-minute cooldown per user to eliminate ~95% of background heartbeat writes
    const now = Date.now();
    const lastHeartbeat = _lastHeartbeatTimestamps[uid] || 0;
    if (now - lastHeartbeat < HEARTBEAT_COOLDOWN_MS) {
      return;
    }
    _lastHeartbeatTimestamps[uid] = now;

    const nowIso = new Date().toISOString();
    const payload = {
      lastActiveAt: nowIso,
      lastActiveDate: nowIso,
      isOnline: true,
    };
    try {
      await updateDoc(doc(db, "users", uid), payload).catch(async (err) => {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceeded();
          return;
        }
        await setDoc(doc(db, "users", uid), payload, { merge: true }).catch(
          (setErr) => {
            if (isQuotaExceededError(setErr)) {
              notifyQuotaExceeded();
            }
          },
        );
      });
    } catch (e) {
      if (isQuotaExceededError(e)) {
        notifyQuotaExceeded();
      }
    }
  },

  async setUserOffline(householdId?: string, userId?: string): Promise<void> {
    const rawUid = userId || auth.currentUser?.uid;
    if (!rawUid) return;
    const uid = String(rawUid).replace(/^mem_/, "").trim();
    // Invalidate timestamp so next active session can immediately pulse online
    delete _lastHeartbeatTimestamps[uid];

    const nowIso = new Date().toISOString();
    const payload = {
      isOnline: false,
      lastActiveAt: nowIso,
      lastActiveDate: nowIso,
    };
    try {
      await updateDoc(doc(db, "users", uid), payload).catch((err) => {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceeded();
        }
      });
    } catch (e) {
      if (isQuotaExceededError(e)) {
        notifyQuotaExceeded();
      }
    }
  },

  listenToUsersPresence(
    userIds: string[],
    callback: (presenceMap: Record<string, any>) => void,
  ): () => void {
    const cleanIds = Array.from(
      new Set(
        (userIds || [])
          .map((id) =>
            String(id || "")
              .replace(/^mem_/, "")
              .trim(),
          )
          .filter(Boolean),
      ),
    );

    if (cleanIds.length === 0) {
      callback({});
      return () => {};
    }

    const presenceState: Record<string, any> = {};

    // 1. Immediately seed from existing in-memory cache
    cleanIds.forEach((uid) => {
      const cached = _presenceCache.get(uid);
      if (cached?.data) {
        presenceState[uid] = cached.data;
      }
    });
    if (Object.keys(presenceState).length > 0) {
      callback({ ...presenceState });
    }

    let isSubscribed = true;

    const fetchExpiredOrMissing = async () => {
      if (!isSubscribed) return;
      const now = Date.now();
      const toFetch = cleanIds.filter((uid) => {
        const entry = _presenceCache.get(uid);
        return !entry || now - entry.timestamp >= PRESENCE_CACHE_TTL_MS;
      });

      if (toFetch.length === 0) return;

      await Promise.all(
        toFetch.map(async (uid) => {
          if (!isSubscribed) return;
          try {
            const userRef = doc(db, "users", uid);
            const snap = await getDoc(userRef);
            if (!isSubscribed) return;
            if (snap.exists()) {
              const data = snap.data();
              const parsed = {
                userId: uid,
                lastActiveAt: data.lastActiveAt || data.lastActiveDate,
                lastActiveDate: data.lastActiveDate || data.lastActiveAt,
                isOnline: data.isOnline === true,
                photoURL:
                  data.photoURL ||
                  data.profilePicture ||
                  data.avatar ||
                  undefined,
                profilePicture:
                  data.profilePicture ||
                  data.photoURL ||
                  data.avatar ||
                  undefined,
                displayName: data.displayName || data.name,
                name: data.name || data.displayName,
                thoughtNote: data.thoughtNote,
                thoughtEmoji:
                  data.thoughtEmoji !== undefined && data.thoughtEmoji !== null
                    ? String(data.thoughtEmoji).trim()
                    : "",
                noteUpdatedAt: data.noteUpdatedAt,
                noteExpiresAt: data.noteExpiresAt,
              };
              _presenceCache.set(uid, { data: parsed, timestamp: now });
              presenceState[uid] = parsed;
            } else {
              _presenceCache.delete(uid);
              delete presenceState[uid];
            }
          } catch (e) {
            // Safe catch
          }
        }),
      );

      if (isSubscribed) {
        callback({ ...presenceState });
      }
    };

    fetchExpiredOrMissing();

    return () => {
      isSubscribed = false;
    };
  },

  listenToUserPresence(
    rawUserId: string,
    callback: (presence: any) => void,
  ): () => void {
    const uid = String(rawUserId || "")
      .replace(/^mem_/, "")
      .trim();
    if (!uid) {
      callback(null);
      return () => {};
    }
    try {
      const userRef = doc(db, "users", uid);
      return onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const parsed = {
              userId: uid,
              lastActiveAt: data.lastActiveAt || data.lastActiveDate,
              lastActiveDate: data.lastActiveDate || data.lastActiveAt,
              isOnline: data.isOnline === true,
              photoURL:
                data.photoURL ||
                data.profilePicture ||
                data.avatar ||
                undefined,
              profilePicture:
                data.profilePicture ||
                data.photoURL ||
                data.avatar ||
                undefined,
              displayName: data.displayName || data.name,
              name: data.name || data.displayName,
              thoughtNote: data.thoughtNote,
              thoughtEmoji:
                data.thoughtEmoji !== undefined && data.thoughtEmoji !== null
                  ? String(data.thoughtEmoji).trim()
                  : "",
              noteUpdatedAt: data.noteUpdatedAt,
              noteExpiresAt: data.noteExpiresAt,
            };
            _presenceCache.set(uid, { data: parsed, timestamp: Date.now() });
            callback(parsed);
          } else {
            callback(null);
          }
        },
        () => {
          callback(null);
        },
      );
    } catch {
      callback(null);
      return () => {};
    }
  },

  async setHouseholdUserNote(
    householdId: string,
    userId: string,
    note: string,
    emoji?: string,
  ): Promise<void> {
    if (!userId) return;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const expiresAtIso = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
    // Allow empty emoji ("") when the user selects "None"
    const cleanEmoji =
      typeof emoji === "string"
        ? emoji.trim()
        : emoji
          ? String(emoji).trim()
          : "";
    const noteData = {
      thoughtNote: note.trim(),
      thoughtEmoji: cleanEmoji,
      noteUpdatedAt: nowIso,
      noteExpiresAt: expiresAtIso,
    };

    // 1. Update user document (current user has write permission on users/{userId})
    try {
      await updateDoc(doc(db, "users", userId), noteData).catch(async () => {
        await setDoc(doc(db, "users", userId), noteData, { merge: true });
      });
    } catch (e) {
      console.warn("[Firestore Mobile] updateUser note notice:", e);
    }

    // 2. Update member document in household (members collection has public read and user update)
    if (householdId) {
      try {
        await updateDoc(
          doc(db, `households/${householdId}/members`, userId),
          noteData,
        ).catch(async () => {
          await updateDoc(
            doc(db, `households/${householdId}/members`, `mem_${userId}`),
            noteData,
          ).catch(() => {});
        });
      } catch (e) {
        console.warn("[Firestore Mobile] updateMember note notice:", e);
      }
    }
  },

  async deleteHouseholdUserNote(
    householdId: string,
    userId: string,
  ): Promise<void> {
    if (!userId) return;
    const clearData = {
      thoughtNote: deleteField(),
      thoughtEmoji: deleteField(),
      noteUpdatedAt: deleteField(),
      noteExpiresAt: deleteField(),
    };

    try {
      await updateDoc(doc(db, "users", userId), clearData).catch(() => {});
    } catch {}

    if (householdId) {
      try {
        await updateDoc(
          doc(db, `households/${householdId}/members`, userId),
          clearData,
        ).catch(async () => {
          await updateDoc(
            doc(db, `households/${householdId}/members`, `mem_${userId}`),
            clearData,
          ).catch(() => {});
        });
      } catch {}
    }
  },

  listenToHouseholdNotes(
    householdId: string,
    callback: (
      notes: Record<
        string,
        { note: string; emoji?: string; updatedAt: string; expiresAt?: string }
      >,
    ) => void,
  ): () => void {
    if (!householdId) {
      callback({});
      return () => {};
    }
    // Listen to households/{householdId}/members which already has 'allow read: if true;' in firestore.rules
    const membersCol = collection(db, `households/${householdId}/members`);
    return onSnapshot(
      membersCol,
      (snapshot) => {
        const result: Record<
          string,
          {
            note: string;
            emoji?: string;
            updatedAt: string;
            expiresAt?: string;
          }
        > = {};
        const now = Date.now();
        snapshot.forEach((d) => {
          const data = d.data();
          const uid = data.userId || data.memberId || d.id;
          if (data && data.thoughtNote) {
            // Check 24-hour expiration
            let isExpired = false;
            let computedExpiresAt = data.noteExpiresAt;
            if (data.noteExpiresAt) {
              const exp = new Date(data.noteExpiresAt).getTime();
              if (!isNaN(exp) && now >= exp) {
                isExpired = true;
              }
            } else if (data.noteUpdatedAt) {
              const updated = new Date(data.noteUpdatedAt).getTime();
              if (!isNaN(updated)) {
                if (now - updated >= 24 * 60 * 60 * 1000) {
                  isExpired = true;
                } else {
                  computedExpiresAt = new Date(
                    updated + 24 * 60 * 60 * 1000,
                  ).toISOString();
                }
              }
            }
            if (!isExpired) {
              result[uid] = {
                note: data.thoughtNote,
                emoji:
                  data.thoughtEmoji !== undefined && data.thoughtEmoji !== null
                    ? String(data.thoughtEmoji).trim()
                    : "",
                updatedAt: data.noteUpdatedAt || "",
                expiresAt: computedExpiresAt || "",
              };
            }
          }
        });
        callback(result);
      },
      (error) => {
        console.warn(
          "[Firestore Mobile] listenToHouseholdNotes notice:",
          error,
        );
        callback({});
      },
    );
  },
};
