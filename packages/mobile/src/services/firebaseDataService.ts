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
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { updateProfile as updateAuthProfile } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatPesos } from "@propertyflow/shared";
import { db, auth, functions } from "../firebase/config";
export {
  uploadImageToCloudinaryMobile,
  uploadImageToCloudinary,
} from "./cloudinaryService";

export type NotificationCategory =
  | "reminder"
  | "expense_added"
  | "payment_received"
  | "water_calculated"
  | "group_invite";

export interface NotificationTextSpan {
  text: string;
  bold?: boolean;
  color?: string;
}

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
  actionTarget?: "settle_dues" | "bills" | "payments" | "attendance" | "groups";
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
    if (effectiveUid && cn.recipientId && cn.recipientId !== effectiveUid) {
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

    if (!cn.category && cn.type) {
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
  const safeMembers = Array.isArray(activeMembers) ? activeMembers : [];
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

export interface MobilePayment {
  paymentId: string;
  householdId: string;
  billingCycleId: string;
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
const _recalcPending = new Set<string>();

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
  clearCache() {
    _cachedUserProfile = null;
    _cachedHousehold = null;
    _cachedReadNotificationIdsByUser = {};
    _syncedCloudNotifIds.clear();
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

  // --- USER PROFILE ---
  async syncUserProfile(user: {
    uid: string;
    displayName: string;
    email: string;
    role?: string;
  }): Promise<void> {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const existing = snap.exists() ? snap.data() : {};
    const preservedRole =
      existing.role === "SUPER_ADMIN"
        ? "SUPER_ADMIN"
        : existing.role === "HOST" ||
            existing.hostApplicationStatus === "APPROVED" ||
            user.role === "HOST"
          ? "HOST"
          : existing.role || user.role || "PAYOR";

    await setDoc(
      userRef,
      sanitizeData({
        uid: user.uid,
        fullName: existing.fullName || user.displayName,
        displayName: user.displayName,
        email: user.email,
        role: preservedRole,
        accountStatus: existing.accountStatus || "ACTIVE",
        householdId: existing.householdId,
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

  listenToUserProfile(uid: string, callback: (data: any) => void) {
    const userRef = doc(db, "users", uid);
    return onSnapshot(
      userRef,
      async (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const data = snap.data();
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
              // Household was deleted in Firestore
              const isHost =
                data.role === "HOST" ||
                data.hostApplicationStatus === "APPROVED";
              delete data.householdId;
              delete data.householdName;
              delete data.apartmentName;
              if (isHost && data.role !== "SUPER_ADMIN") {
                data.role = "HOST";
              }
              updateDoc(userRef, {
                householdId: deleteField(),
                householdName: deleteField(),
                apartmentName: deleteField(),
                ...(isHost && data.role !== "SUPER_ADMIN"
                  ? { role: "HOST" }
                  : {}),
              }).catch(() => {});
            } else {
              const hhData = hhSnap.data();
              if (
                hhData &&
                hhData.hostId === uid &&
                data.role !== "SUPER_ADMIN"
              ) {
                data.role = "HOST";
              }
            }
          } catch (err) {
            console.warn("[Firestore Mobile] Household check err:", err);
          }
        }
        _cachedUserProfile = data;
        if (
          data.readNotificationIdsV2 &&
          typeof data.readNotificationIdsV2 === "object"
        ) {
          if (mergeUserReadMap(uid, data.readNotificationIdsV2)) {
            notifyReadSubscribers(uid);
          }
        }
        callback(data);
      },
      (err) => console.warn("[Firestore Mobile] listenToUserProfile:", err),
    );
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
          if (!seen.has(uid)) {
            seen.add(uid);
            rawItems.push(data);
            if (
              !data.profilePicture &&
              !data.photoURL &&
              uid &&
              !uid.startsWith("mem_")
            ) {
              missingPhotoUids.push(uid);
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

      return true;
    } catch (err) {
      console.error("[approveJoinRequest Mobile] Error:", err);
      return false;
    }
  },

  /**
   * Recalculates and redistributes all UNPAID expenses across the current roster of ACTIVE payors.
   * Ensures new payors are properly included and not left out or marked exempt from ongoing bills.
   */
  async recalculateUnpaidExpensesForHousehold(
    householdId: string,
  ): Promise<number> {
    if (!householdId) return 0;
    const existingRun = _recalcInFlight.get(householdId);
    if (existingRun) {
      _recalcPending.add(householdId);
      return existingRun;
    }

    const runPromise = (async (): Promise<number> => {
      try {
        return await this._executeRecalculateUnpaidExpenses(householdId);
      } finally {
        _recalcInFlight.delete(householdId);
        if (_recalcPending.has(householdId)) {
          _recalcPending.delete(householdId);
          this.recalculateUnpaidExpensesForHousehold(householdId).catch(
            () => {},
          );
        }
      }
    })();

    _recalcInFlight.set(householdId, runPromise);
    return runPromise;
  },

  async _executeRecalculateUnpaidExpenses(
    householdId: string,
  ): Promise<number> {
    try {
      if (!householdId) return 0;
      const membersSnap = await getDocs(
        collection(db, `households/${householdId}/members`),
      );
      const activeMembers = membersSnap.docs
        .map((d) => d.data())
        .filter((m: any) => m.status === "ACTIVE" || !m.status);

      if (activeMembers.length === 0) return 0;

      const activePayors = activeMembers.filter((m) => isPayorMember(m));
      const activeNonPayors = activeMembers.filter((m) => !isPayorMember(m));
      const effectivePayors =
        activePayors.length > 0 ? activePayors : activeMembers;

      const expSnap = await getDocs(
        collection(db, `households/${householdId}/expenses`),
      );
      let updatedCount = 0;

      // Function-level map of member attendance days for water billing calculations
      const memberDaysMap = new Map<string, number>();
      let preActiveCycleId: string | undefined;
      let preIsSingleCycle = true;
      try {
        const preCyclesSnap = await getDocs(
          collection(db, `households/${householdId}/billingCycles`),
        );
        const preCycles = sortBillingCyclesNewest(
          preCyclesSnap.docs.map((cd) => cd.data()),
        );
        preIsSingleCycle = preCycles.length <= 1;
        const preActiveCycle = preCycles[0];
        preActiveCycleId = preActiveCycle?.billingCycleId;
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
            const uid = m.userId || m.memberId;
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

      // Fetch water configuration to apply correct pricing mode
      let waterConfig: any = {
        pricingModel: "PER_PERSON_DAY",
        rateCentavosPerPersonPerDay: 500,
      };
      try {
        const waterSnap = await getDoc(
          doc(db, `households/${householdId}/systemSettings`, "water"),
        );
        if (waterSnap.exists()) {
          waterConfig = waterSnap.data();
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
        if (
          preActiveCycleId &&
          expData.billingCycleId !== preActiveCycleId &&
          !(!expData.billingCycleId && preIsSingleCycle)
        ) {
          continue;
        }

        const isWater = (expData.category || "")
          .toLowerCase()
          .includes("water");
        let newSplitDetails: any[] = [];

        if (isWater) {
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
                  userId: m.userId || m.memberId,
                  displayName: m.displayName || "Roommate",
                  shareCentavos: perPersonCentavos,
                  isPaid: false,
                  isExempt: false,
                  role: m.role || "PAYOR",
                  note: `Flat water rate: ₱${(perPersonCentavos / 100).toFixed(2)}/resident/month`,
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
            let cycleId = expData.billingCycleId;
            if (!cycleId) {
              try {
                const cycSnap = await getDocs(
                  collection(db, `households/${householdId}/billingCycles`),
                );
                const allCycles = cycSnap.docs.map((cd) => cd.data());
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
                note: `Fair share among ${payorCount} payors (Non-payors exempt)`,
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

        // Preserve existing paid status per user on splitDetails so partial/prior settlements are never lost
        if (
          Array.isArray(expData.splitDetails) &&
          expData.splitDetails.length > 0
        ) {
          const prevSplitMap = new Map<string, any>();
          expData.splitDetails.forEach((s: any) => {
            if (s.userId) prevSplitMap.set(s.userId, s);
          });
          newSplitDetails = newSplitDetails.map((s: any) => {
            if (s.isExempt) return sanitizeData(s);
            const prev = prevSplitMap.get(s.userId);
            if (prev && prev.isPaid) {
              return sanitizeData({
                ...s,
                isPaid: true,
                paidAmountCentavos: prev.paidAmountCentavos ?? s.shareCentavos,
                ...(prev.paidDate !== undefined
                  ? { paidDate: prev.paidDate }
                  : {}),
                ...(prev.paymentId !== undefined
                  ? { paymentId: prev.paymentId }
                  : {}),
              });
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
          cyclesSnap.docs.map((cd) => cd.data()),
        );
        const isSingleCycle = cycles.length <= 1;
        const activeCycle = cycles[0];
        const activeCycleId = activeCycle?.billingCycleId || `bc_${Date.now()}`;

        const paymentsByUser = new Map<string, number>();
        paymentsSnap.docs.forEach((pd) => {
          const pData = pd.data();
          if (pData.status === "REJECTED") return;
          const matchesCycle =
            pData.billingCycleId === activeCycleId ||
            ((!pData.billingCycleId || pData.billingCycleId === "general") &&
              isSingleCycle);
          if (matchesCycle && pData.userId) {
            paymentsByUser.set(
              pData.userId,
              (paymentsByUser.get(pData.userId) || 0) +
                (Number(pData.amountCentavos) || 0),
            );
          }
        });

        // Re-read updated expenses scoped strictly to the active billing cycle
        const updatedExpSnap = await getDocs(
          collection(db, `households/${householdId}/expenses`),
        );
        const allExpenses = updatedExpSnap.docs
          .map((ed) => ({
            id: ed.id,
            ...(ed.data() as any),
          }))
          .filter(
            (exp: any) =>
              exp.billingCycleId === activeCycleId ||
              (!exp.billingCycleId && isSingleCycle),
          );

        for (const member of activeMembers) {
          const uid = member.userId || member.memberId;
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

          // Build line items for this member from active cycle expenses only
          const lineItems = allExpenses.map((exp: any) => {
            const isWater = (exp.category || "")
              .toLowerCase()
              .includes("water");
            const split = exp.splitDetails?.find((s: any) => s.userId === uid);
            const isPayor = isPayorMember(member);
            let share = 0;
            if (isPayor) {
              if (split && typeof split.shareCentavos === "number") {
                share = split.shareCentavos;
              } else if (isWater) {
                if (waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH") {
                  share = waterConfig.fixedPerPersonAmountCentavos || 0;
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
            const isExpPaid = exp.status === "PAID" || exp.isPaid;
            const daysPresent =
              split?.daysPresent ?? memberDaysMap.get(uid) ?? 0;

            return {
              itemId: exp.id,
              description: exp.title,
              category: exp.category,
              amountCentavos: share,
              createdDate:
                exp.createdAt || exp.createdDate || new Date().toISOString(),
              status: isExpPaid ? "PAID" : "UNPAID",
              note:
                split?.note ||
                (isExempt
                  ? "Exempted (Non-payor)"
                  : isWater
                    ? `${daysPresent}d water attendance`
                    : `Fair share among ${effectivePayors.length} payors`),
              isExempt,
            };
          });

          const unpaidLineItems = lineItems.filter(
            (li: any) => li.status === "UNPAID" && !li.isExempt,
          );
          const newTotalDue = unpaidLineItems.reduce(
            (sum: number, li: any) => sum + (li.amountCentavos || 0),
            0,
          );
          const newOutstanding = Math.max(0, newTotalDue - prevPaid);

          const billData = sanitizeData({
            billId,
            householdId,
            billingCycleId: activeCycleId,
            userId: uid,
            displayName: member.displayName || "Roommate",
            totalDueCentavos: newTotalDue,
            outstandingCentavos: newOutstanding,
            totalPaidCentavos: prevPaid,
            lineItems,
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

  async rejectJoinRequest(
    householdId: string,
    memberId: string,
    reason: string,
  ): Promise<boolean> {
    try {
      const nowIso = new Date().toISOString();
      const memRef = doc(db, `households/${householdId}/members`, memberId);
      await updateDoc(memRef, {
        status: "REJECTED",
        rejectionReason: reason || "Declined by host",
        rejectedDate: nowIso,
      });

      try {
        await updateDoc(doc(db, "users", memberId), {
          joinRequestStatus: "REJECTED",
          joinRejectionReason: reason || "Declined by host",
          pendingHouseholdId: null,
          updatedDate: nowIso,
        });
      } catch (uErr) {
        console.warn(
          "[rejectJoinRequest Mobile] User doc update deferred to client:",
          uErr,
        );
      }
      return true;
    } catch (err) {
      console.error("[rejectJoinRequest Mobile] Error:", err);
      return false;
    }
  },

  async updateUserProfilePicture(
    uid: string,
    photoUrl: string,
    householdId?: string,
  ): Promise<boolean> {
    try {
      const userRef = doc(db, "users", uid);
      await setDoc(
        userRef,
        {
          profilePicture: photoUrl,
          photoURL: photoUrl,
          updatedDate: new Date().toISOString(),
        },
        { merge: true },
      );
      if (_cachedUserProfile && _cachedUserProfile.uid === uid) {
        _cachedUserProfile.profilePicture = photoUrl;
        _cachedUserProfile.photoURL = photoUrl;
      }
      if (auth.currentUser && auth.currentUser.uid === uid) {
        await updateAuthProfile(auth.currentUser, { photoURL: photoUrl }).catch(
          () => {},
        );
      }
      if (householdId) {
        const memRef1 = doc(db, `households/${householdId}/members`, uid);
        await setDoc(
          memRef1,
          {
            profilePicture: photoUrl,
            photoURL: photoUrl,
          },
          { merge: true },
        ).catch(() => {});
        const memRef2 = doc(
          db,
          `households/${householdId}/members`,
          `mem_${uid}`,
        );
        await setDoc(
          memRef2,
          {
            profilePicture: photoUrl,
            photoURL: photoUrl,
          },
          { merge: true },
        ).catch(() => {});
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
      let waterConfig: any = null;
      try {
        const wSnap = await getDoc(
          doc(db, "households", expense.householdId, "waterConfig", "settings"),
        );
        if (wSnap.exists()) waterConfig = wSnap.data();
      } catch {}

      const pricingModel = waterConfig?.pricingModel || "PER_PERSON_DAY";
      if (pricingModel === "PER_PERSON_DAY") {
        const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
        const cycleId = resolvedCycleId || expense.billingCycleId;
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
          // Calculate new total due accurately from unpaid line items
          const newTotalDue = updatedLineItems
            .filter((li: any) => li.status === "UNPAID" && !li.isExempt)
            .reduce(
              (sum: number, li: any) => sum + (li.amountCentavos || 0),
              0,
            );
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
      const recipientIds = Array.from(
        new Set(
          [
            ...activeMembers.map((m) => m.userId || m.memberId),
            auth.currentUser?.uid,
          ].filter((u): u is string => Boolean(u && !u.startsWith("mem_"))),
        ),
      );
      await Promise.all(
        recipientIds.map((recipientUid) => {
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
        const count = Math.max(1, payorEntries.length);
        const sharePerPayor = Math.round(newAmountCents / count);
        splitDetails = splitDetails.map((s: any) => ({
          ...s,
          shareCentavos: s.isExempt ? 0 : sharePerPayor,
          isPaid: s.isExempt ? true : isPaid,
        }));
      } else if (
        Array.isArray(splitDetails) &&
        (updates.status !== undefined || updates.isPaid !== undefined)
      ) {
        splitDetails = splitDetails.map((s: any) => ({
          ...s,
          isPaid: s.isExempt ? true : isPaid,
        }));
      }

      await updateDoc(
        expRef,
        sanitizeData({
          ...updates,
          status: newStatus,
          isPaid,
          splitDetails,
          updatedDate: new Date().toISOString(),
        }),
      );

      // Recalculate unpaid expenses and member bills across household
      await this.recalculateUnpaidExpensesForHousehold(householdId).catch(
        () => {},
      );
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
      await deleteDoc(expRef);

      // Recalculate unpaid expenses and member bills across household
      await this.recalculateUnpaidExpensesForHousehold(householdId).catch(
        () => {},
      );
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
      priorCycleId = existingCycles[0]?.billingCycleId;

      if (priorCycleId) {
        try {
          const expSnap = await getDocs(
            collection(db, `households/${householdId}/expenses`),
          );
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

    // 3. Reset all active payors' settlement status and initialize fresh UNPAID memberBills for the new cycle
    try {
      const membersSnap = await getDocs(
        collection(db, `households/${householdId}/members`),
      );
      await Promise.all(
        membersSnap.docs.map(async (md) => {
          const mData = md.data();
          const uid = mData.userId || mData.memberId || md.id;
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

          if (uid) {
            const billId = `bill_${billingCycleId}_${uid}`;
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
                userId: uid,
                displayName: mData.displayName || "Roommate",
                totalDueCentavos: 0,
                outstandingCentavos: 0,
                totalPaidCentavos: 0,
                paidCentavos: 0,
                lineItems: [],
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
    cycleId: string,
    callback: (bills: any[]) => void,
  ) {
    const q = query(
      collection(db, `households/${householdId}/memberBills`),
      where("billingCycleId", "==", cycleId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const map = new Map<string, any>();
        snap.forEach((d) => {
          const data = d.data();
          const uid = data.userId || d.id;
          // Prefer bill_{cycleId}_{userId} format over direct userId doc to avoid double counting
          if (!map.has(uid) || d.id.startsWith("bill_")) {
            map.set(uid, data);
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
            pricingModel:
              data.pricingModel ||
              (data.fixedMonthlyAmountCentavos
                ? "FIXED_MONTHLY"
                : "PER_PERSON_DAY"),
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

  async saveWaterConfig(householdId: string, config: any): Promise<void> {
    if (!householdId) return;
    try {
      const ref = doc(db, `households/${householdId}/systemSettings`, "water");
      const cleanConfig = sanitizeData({
        pricingModel: config.pricingModel || "PER_PERSON_DAY",
        rateCentavosPerPersonPerDay: Number(
          config.rateCentavosPerPersonPerDay ?? 500,
        ),
        fixedMonthlyAmountCentavos: Number(
          config.fixedMonthlyAmountCentavos ?? 0,
        ),
        fixedPerPersonAmountCentavos: Number(
          config.fixedPerPersonAmountCentavos ?? 0,
        ),
        mode: config.mode || "BILLING_CYCLE",
        updatedAt: new Date().toISOString(),
      });
      await setDoc(ref, cleanConfig, { merge: true });

      // Automatically sync water charge for the current cycle and recalculate member bills
      await this.syncCycleWaterBill(householdId);
      await this.recalculateUnpaidExpensesForHousehold(householdId);
    } catch (err) {
      console.error("[saveWaterConfig Mobile] Error:", err);
      throw err;
    }
  },

  /**
   * Generates or synchronizes the active billing cycle's Water line item
   * according to the household's configured water mode (PER_PERSON_DAY, FIXED_MONTHLY, or FIXED_PER_PERSON_MONTH).
   */
  async syncCycleWaterBill(
    householdId: string,
    billingCycleId?: string,
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
        cyclesSnap.docs.map((cd) => cd.data()),
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
      const cycleId = targetCycle.billingCycleId;

      // 2. Resolve members
      const activeMembers = memSnap.docs
        .map((d) => d.data())
        .filter((m: any) => m.status === "ACTIVE" || !m.status);
      if (activeMembers.length === 0) return null;

      const activePayors = activeMembers.filter((m) => isPayorMember(m));
      const activeNonPayors = activeMembers.filter((m) => !isPayorMember(m));
      const effectivePayors =
        activePayors.length > 0 ? activePayors : activeMembers;

      // 3. Resolve water configuration
      let waterConfig: any = {
        pricingModel: "PER_PERSON_DAY",
        rateCentavosPerPersonPerDay: 500,
      };
      if (waterSnap.exists()) {
        waterConfig = waterSnap.data();
      }

      const pricingModel =
        waterConfig.pricingModel ||
        (waterConfig.fixedMonthlyAmountCentavos
          ? "FIXED_MONTHLY"
          : "PER_PERSON_DAY");

      let billTitle = "Water Attendance";
      let totalAmountCentavos = 0;
      let splitDetails: any[] = [];

      if (pricingModel === "FIXED_PER_PERSON_MONTH") {
        const perPersonCentavos = Number(
          waterConfig.fixedPerPersonAmountCentavos || 0,
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
          waterConfig.fixedMonthlyAmountCentavos || 0,
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
        const rate = Number(waterConfig.rateCentavosPerPersonPerDay || 500);

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

      const existingWaterExp = expSnap.docs.find((ed) => {
        const data = ed.data();
        const cat = (data.category || "").toLowerCase();
        return (
          (data.billingCycleId === cycleId || ed.id.includes(cycleId)) &&
          (cat.includes("water") || ed.id.startsWith("water_"))
        );
      });

      const expenseId = existingWaterExp
        ? existingWaterExp.id
        : `water_bill_${cycleId}`;
      const existingWaterData = existingWaterExp
        ? existingWaterExp.data()
        : null;
      const splitsMap: Record<string, number> = {};
      splitDetails.forEach((s) => {
        if (s.userId) splitsMap[s.userId] = s.shareCentavos;
      });

      const wasAlreadyPaid =
        existingWaterData?.status === "PAID" ||
        existingWaterData?.isPaid === true;

      // Preserve isPaid on existing splitDetails if previously settled
      if (
        existingWaterData?.splitDetails &&
        Array.isArray(existingWaterData.splitDetails)
      ) {
        const paidUserMap = new Map<string, boolean>();
        existingWaterData.splitDetails.forEach((s: any) => {
          if (s.userId && s.isPaid) paidUserMap.set(s.userId, true);
        });
        splitDetails = splitDetails.map((s: any) => ({
          ...s,
          isPaid:
            s.isExempt || Boolean(paidUserMap.get(s.userId)) || wasAlreadyPaid,
        }));
      }

      const allWaterPaid =
        wasAlreadyPaid ||
        (splitDetails.length > 0 &&
          splitDetails.every((s) => s.isExempt || s.isPaid));

      const expensePayload = sanitizeData({
        id: expenseId,
        householdId,
        title: billTitle,
        category: "Water",
        amountCents: totalAmountCentavos,
        date: new Date().toISOString().slice(0, 10),
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

      // Immediately refresh all member bills in Firestore
      this.recalculateUnpaidExpensesForHousehold(householdId).catch(() => {});

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
  ): Promise<void> {
    if (!householdId) return;
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
      const targetCycleId =
        options?.billingCycleId || config.billingCycleId || "";
      const nowIso = new Date().toISOString();

      const cycleSnapshot = {
        previousReadingKwh: prev,
        currentReadingKwh: curr,
        rateCentavosPerKwh: rate,
        consumedKwh,
        totalAmountCentavos,
        billingCycleId: targetCycleId,
        updatedAt: nowIso,
      };

      const cleanConfig = sanitizeData({
        previousReadingKwh: prev,
        currentReadingKwh: curr,
        lastCurrentReadingKwh: curr,
        rateCentavosPerKwh: rate,
        consumedKwh,
        totalAmountCentavos,
        ...(targetCycleId
          ? {
              billingCycleId: targetCycleId,
              cycles: {
                [targetCycleId]: cycleSnapshot,
              },
            }
          : {}),
        updatedAt: nowIso,
      });
      await setDoc(ref, cleanConfig, { merge: true });

      if (!options?.skipExpenseSync && totalAmountCentavos > 0) {
        await this.syncCycleElectricityBill(householdId, targetCycleId);
        await this.recalculateUnpaidExpensesForHousehold(householdId);
      }
    } catch (err) {
      console.error("[saveElectricityConfig Mobile] Error:", err);
      throw err;
    }
  },

  async syncCycleElectricityBill(
    householdId: string,
    billingCycleId?: string,
  ): Promise<string | null> {
    try {
      if (!householdId) return null;

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

      let targetCycle: any = null;
      const cycles = sortBillingCyclesNewest(
        cyclesSnap.docs.map((cd) => cd.data()),
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
      if (!targetCycle) return null;
      const cycleId = targetCycle.billingCycleId;

      const activeMembers = memSnap.docs
        .map((d) => d.data())
        .filter((m: any) => m.status === "ACTIVE" || !m.status);
      if (activeMembers.length === 0) return null;

      const activePayors = activeMembers.filter((m) => isPayorMember(m));
      const effectivePayors =
        activePayors.length > 0 ? activePayors : activeMembers;

      if (!elecSnap.exists()) return null;
      const elecDoc = elecSnap.data();
      const elecConfig =
        (cycleId && elecDoc.cycles && elecDoc.cycles[cycleId]) || elecDoc;
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

      if (totalAmountCentavos <= 0) return null;

      const payorCount = Math.max(1, effectivePayors.length);
      const ratePesosStr = (rateCentavos / 100).toFixed(2);
      const meterSummaryNote = `Prev: ${prev} kWh → Curr: ${curr} kWh (${consumedKwh} kWh × ₱${ratePesosStr}/kWh)`;

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

      const existingElecExp = expSnap.docs.find((ed) => {
        const data = ed.data();
        const cat = (data.category || "").toLowerCase();
        return (
          (data.billingCycleId === cycleId || ed.id.includes(cycleId)) &&
          (cat.includes("electric") || ed.id.startsWith("elec_"))
        );
      });

      const expenseId = existingElecExp
        ? existingElecExp.id
        : `elec_bill_${cycleId}`;
      const existingElecData = existingElecExp ? existingElecExp.data() : null;

      const wasAlreadyPaid =
        existingElecData?.status === "PAID" ||
        existingElecData?.isPaid === true;

      if (
        existingElecData?.splitDetails &&
        Array.isArray(existingElecData.splitDetails)
      ) {
        const paidUserMap = new Map<string, boolean>();
        existingElecData.splitDetails.forEach((s: any) => {
          if (s.userId && s.isPaid) paidUserMap.set(s.userId, true);
        });
        splitDetails = splitDetails.map((s: any) => ({
          ...s,
          isPaid:
            s.isExempt || Boolean(paidUserMap.get(s.userId)) || wasAlreadyPaid,
        }));
      }

      const allElecPaid =
        wasAlreadyPaid ||
        (splitDetails.length > 0 &&
          splitDetails.every((s) => s.isExempt || s.isPaid));

      const splitsMap: Record<string, number> = {};
      splitDetails.forEach((s) => {
        if (s.userId) splitsMap[s.userId] = s.shareCentavos;
      });

      const nowIso = new Date().toISOString();
      const expensePayload = sanitizeData({
        id: expenseId,
        householdId,
        title: "Electricity",
        category: "Electricity",
        amountCents: totalAmountCentavos,
        date: nowIso.slice(0, 10),
        payerName: "Host",
        payerId: auth.currentUser?.uid || "system",
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
        createdAt: existingElecData?.createdAt || nowIso,
        updatedAt: nowIso,
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
            name: "Electricity",
            description: meterSummaryNote,
            amountCentavos: totalAmountCentavos,
            distributionMethod: "PAYORS_ONLY",
            participantUserIds: splitDetails
              .filter((s) => !s.isExempt)
              .map((s) => s.userId),
            splitDetails,
            createdDate: existingElecData?.createdAt || nowIso,
            createdBy: auth.currentUser?.uid || "system",
          }),
          { merge: true },
        ),
      ]);

      this.recalculateUnpaidExpensesForHousehold(householdId).catch(() => {});
      return expenseId;
    } catch (err) {
      console.warn("[syncCycleElectricityBill] error:", err);
      return null;
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
      const membersSnap = await getDocs(
        collection(db, `households/${householdId}/members`),
      );
      const allMembers = membersSnap.docs.map((d) => d.data());
      const activeMembers = allMembers.filter(
        (m: any) => m.status === "ACTIVE" || !m.status,
      );
      const activePayors = activeMembers.filter((m) => isPayorMember(m));
      if (activePayors.length === 0) return false;

      const cyclesSnap = await getDocs(
        collection(db, `households/${householdId}/billingCycles`),
      );
      const cycles = sortBillingCyclesNewest(
        cyclesSnap.docs.map((cd) => cd.data()),
      );
      const isSingleCycle = cycles.length <= 1;
      let cycleId = billingCycleId;
      if (!cycleId) {
        const activeCycle = cycles[0];
        cycleId = activeCycle?.billingCycleId;
      }
      if (!cycleId) return false;

      // Fetch expenses and payments for this cycle to verify settlement accurately
      const [expSnap, pmtSnap] = await Promise.all([
        getDocs(collection(db, `households/${householdId}/expenses`)),
        getDocs(collection(db, `households/${householdId}/payments`)),
      ]);

      const cycleExpenses = expSnap.docs.filter((ed) => {
        const data = ed.data();
        return (
          data.billingCycleId === cycleId ||
          (!data.billingCycleId && isSingleCycle)
        );
      });

      if (cycleExpenses.length === 0) return false;

      const hasPositiveExpense = cycleExpenses.some(
        (ed) => (Number(ed.data().amountCents) || 0) > 0,
      );
      if (!hasPositiveExpense) return false;

      const paymentsByUser = new Map<string, number>();
      pmtSnap.docs.forEach((pd) => {
        const pData = pd.data();
        if (pData.status === "REJECTED") return;
        const matchesCycle =
          pData.billingCycleId === cycleId ||
          ((!pData.billingCycleId || pData.billingCycleId === "general") &&
            isSingleCycle);
        if (matchesCycle && pData.userId) {
          paymentsByUser.set(
            pData.userId,
            (paymentsByUser.get(pData.userId) || 0) +
              (Number(pData.amountCentavos) || 0),
          );
        }
      });

      const payorCount = Math.max(1, activePayors.length);

      // Check each payor's member bill and payment coverage strictly within this cycle
      let allPayorsSettled = true;
      for (const p of activePayors) {
        const uid = p.userId || p.memberId || p.id;
        const userPaidTotal = paymentsByUser.get(uid) || 0;

        // Calculate this payor's total share across cycle expenses
        let payorShareTotal = 0;
        let allUserSplitsMarkedPaid = true;
        cycleExpenses.forEach((ed) => {
          const exp = ed.data();
          const mySplit = Array.isArray(exp.splitDetails)
            ? exp.splitDetails.find((s: any) => s.userId === uid)
            : null;
          if (mySplit?.isExempt) return;
          const share =
            mySplit && typeof mySplit.shareCentavos === "number"
              ? mySplit.shareCentavos
              : Math.round((exp.amountCents || 0) / payorCount);
          payorShareTotal += share;
          if (
            !exp.isPaid &&
            exp.status !== "PAID" &&
            !mySplit?.isPaid &&
            share > 0
          ) {
            allUserSplitsMarkedPaid = false;
          }
        });

        if (payorShareTotal <= 0) continue;

        const billSnap = await getDoc(
          doc(
            db,
            `households/${householdId}/memberBills`,
            `bill_${cycleId}_${uid}`,
          ),
        );
        if (billSnap.exists()) {
          const bData = billSnap.data();
          const billPaid = Math.max(
            bData.totalPaidCentavos || 0,
            userPaidTotal,
          );
          const isSettledByPayments =
            payorShareTotal > 0 && billPaid >= payorShareTotal;
          if (!isSettledByPayments && !allUserSplitsMarkedPaid) {
            allPayorsSettled = false;
            break;
          }
        } else {
          const isSettledByPayments =
            payorShareTotal > 0 && userPaidTotal >= payorShareTotal;
          if (!isSettledByPayments && !allUserSplitsMarkedPaid) {
            allPayorsSettled = false;
            break;
          }
        }
      }

      if (allPayorsSettled) {
        const nowIso = new Date().toISOString();
        for (const expDoc of cycleExpenses) {
          const data = expDoc.data();
          if (data.status !== "PAID" || !data.isPaid) {
            let splits = data.splitDetails;
            if (Array.isArray(splits)) {
              splits = splits.map((s: any) =>
                sanitizeData({
                  ...s,
                  isPaid: true,
                  paidDate: s.paidDate || nowIso,
                }),
              );
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

  // --- PAYMENTS ---
  async applyPaymentToMemberBills(
    householdId: string,
    billingCycleId: string,
    userId: string,
    amountCentavos: number,
  ): Promise<void> {
    try {
      const cycleKey = billingCycleId || "general";
      const billId = `bill_${cycleKey}_${userId}`;
      const billRef = doc(db, `households/${householdId}/memberBills`, billId);
      const snap = await getDoc(billRef);
      if (snap.exists()) {
        const bill = snap.data();
        const prevPaid = bill.totalPaidCentavos || bill.paidCentavos || 0;
        const newPaid = prevPaid + amountCentavos;
        const totalDue = bill.totalDueCentavos || 0;
        const newOutstanding = Math.max(0, totalDue - newPaid);
        const newStatus = newOutstanding === 0 ? "PAID" : "PARTIALLY_PAID";
        await updateDoc(billRef, {
          totalPaidCentavos: newPaid,
          paidCentavos: newPaid,
          outstandingCentavos: newOutstanding,
          status: newStatus,
          updatedDate: new Date().toISOString(),
        });
      } else {
        await setDoc(
          billRef,
          sanitizeData({
            billId,
            householdId,
            billingCycleId: cycleKey,
            userId,
            totalDueCentavos: amountCentavos,
            totalPaidCentavos: amountCentavos,
            paidCentavos: amountCentavos,
            outstandingCentavos: 0,
            status: "PAID",
            updatedDate: new Date().toISOString(),
            createdDate: new Date().toISOString(),
          }),
          { merge: true },
        );
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
  ): Promise<void> {
    try {
      const expSnap = await getDocs(
        collection(db, `households/${householdId}/expenses`),
      );
      let remainingPayment = amountCentavos;

      for (const d of expSnap.docs) {
        if (remainingPayment <= 0) break;
        const exp = d.data();
        if (exp.status === "PAID" && exp.isPaid) continue;
        if (
          billingCycleId &&
          billingCycleId !== "general" &&
          exp.billingCycleId &&
          exp.billingCycleId !== billingCycleId
        ) {
          continue;
        }

        let modified = false;
        let splits = exp.splitDetails || [];
        if (Array.isArray(splits)) {
          splits = splits.map((s: any) => {
            const isUser =
              s.userId === userId || s.memberId === userId || s.id === userId;
            if (isUser && !s.isPaid && s.shareCentavos > 0) {
              const toPay = Math.min(remainingPayment, s.shareCentavos);
              remainingPayment -= toPay;
              modified = true;
              const resolvedPmtId = paymentId || s.paymentId;
              return sanitizeData({
                ...s,
                isPaid: true,
                paidAmountCentavos: (s.paidAmountCentavos || 0) + toPay,
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

      // Check and update any expenses if all payors settled for this cycle
      await this.markExpensesPaidIfAllSettled(householdId, billingCycleId);
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
      if (payment.householdId) {
        try {
          const cycSnap = await getDocs(
            collection(db, `households/${payment.householdId}/billingCycles`),
          );
          const allCycles = sortBillingCyclesNewest(
            cycSnap.docs.map((d) => d.data()),
          );
          if (resolvedCycleId && resolvedCycleId !== "general") {
            resolvedCycleDoc =
              allCycles.find((c) => c.billingCycleId === resolvedCycleId) ||
              allCycles[0];
          } else {
            resolvedCycleDoc = allCycles[0];
            if (resolvedCycleDoc?.billingCycleId) {
              resolvedCycleId = resolvedCycleDoc.billingCycleId;
            }
          }
        } catch {}
      }
      const effectiveCycleId = resolvedCycleId || "general";

      // Block payment submission for non-host payors when the host has not opened payments for the cycle
      if (
        !isHost &&
        isCyclePaymentsLocked(resolvedCycleDoc, _cachedHousehold)
      ) {
        throw new Error(
          "Payments are currently locked by your host. Please wait until the host opens payments for this billing cycle.",
        );
      }

      const paymentRecord: MobilePayment = sanitizeData({
        paymentId,
        householdId: payment.householdId,
        billingCycleId: effectiveCycleId,
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
      );
      await this.applyPaymentToExpenses(
        payment.householdId,
        uid,
        payment.amountCentavos,
        paymentId,
        effectiveCycleId,
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
      where("recipientId", "==", userId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        let readUpdated = false;
        const userMap = getUserReadMap(userId);
        snap.forEach((d) => {
          const data = d.data();
          if (data.recipientId && data.recipientId !== userId) return;
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
      },
      (err) => {
        console.warn("[Firestore Mobile] listenToNotifications:", err);
        callback([]);
      },
    );
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
      if (item.id) {
        updatedReadMap[getScopedNotificationReadKey(effectiveUid, item.id)] =
          true;
      }
      if (perUserDocId) {
        updatedReadMap[
          getScopedNotificationReadKey(effectiveUid, perUserDocId)
        ] = true;
      }
      if (item.cloudDocId) {
        updatedReadMap[
          getScopedNotificationReadKey(effectiveUid, item.cloudDocId)
        ] = true;
      }
    });

    _cachedReadNotificationIdsByUser[effectiveUid] = updatedReadMap;
    if (_cachedUserProfile && _cachedUserProfile.uid === effectiveUid) {
      _cachedUserProfile = {
        ..._cachedUserProfile,
        readNotificationIdsV2: updatedReadMap,
      };
    }

    // Notify all active screens for this user immediately
    notifyReadSubscribers(effectiveUid);

    // Persist locally under per-user storage key
    try {
      await AsyncStorage.setItem(
        getReadNotificationsStorageKey(effectiveUid),
        JSON.stringify(updatedReadMap),
      );
    } catch {}

    // Persist to Firestore cloud (`users/{uid}` and `notifications/{perUserDocId}`)
    try {
      await setDoc(
        doc(db, "users", effectiveUid),
        sanitizeData({
          readNotificationIdsV2: updatedReadMap,
          updatedDate: nowIso,
        }),
        { merge: true },
      );
    } catch (err) {
      console.warn("[Firestore Mobile] markNotificationsRead user sync:", err);
    }

    try {
      await Promise.all(
        items.map((item) => {
          const docId =
            item.cloudDocId &&
            item.cloudDocId.startsWith(`notif_${effectiveUid}_`)
              ? item.cloudDocId
              : `notif_${effectiveUid}_${item.id}`;
          return setDoc(
            doc(db, "notifications", docId),
            sanitizeData({
              notificationId: docId,
              recipientId: effectiveUid,
              relatedItemId: item.id,
              readStatus: true,
              readByRecipientId: effectiveUid,
              readAt: nowIso,
            }),
            { merge: true },
          ).catch(() => {});
        }),
      );
    } catch (err) {
      console.warn("[Firestore Mobile] markNotificationsRead docs sync:", err);
    }
  },

  listenToHouseholdMessages(
    householdId: string,
    callback: (messages: any[]) => void,
  ): () => void {
    if (!householdId) {
      callback([]);
      return () => {};
    }
    const colRef = collection(db, `households/${householdId}/messages`);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const msgs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
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
      type?: "text" | "expense_split" | "payment_claim" | "receipt_review";
      meta?: any;
    },
  ): Promise<string> {
    if (!householdId) {
      throw new Error("householdId is required to send a message");
    }
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const newDoc = {
      id: msgId,
      householdId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
      recipientId: message.recipientId || null,
      type: message.type || "text",
      meta: message.meta || {},
      readBy: [message.senderId],
      createdAt: nowIso,
      timestamp: nowIso,
    };
    await setDoc(
      doc(db, `households/${householdId}/messages`, msgId),
      sanitizeData(newDoc),
    );
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
      await Promise.all(
        messageIds.map(async (msgId) => {
          const docRef = doc(db, `households/${householdId}/messages`, msgId);
          await updateDoc(docRef, {
            readBy: arrayUnion(userId),
          }).catch(() => {});
        }),
      );
    } catch (e) {
      console.warn("[Firestore Mobile] markHouseholdMessagesRead:", e);
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
    const uid = userId || auth.currentUser?.uid;
    if (!uid) return;
    const nowIso = new Date().toISOString();
    try {
      await updateDoc(doc(db, "users", uid), {
        lastActiveAt: nowIso,
      }).catch(async () => {
        await setDoc(
          doc(db, "users", uid),
          { lastActiveAt: nowIso },
          { merge: true },
        );
      });

      if (householdId) {
        // Also update member doc if it exists
        const memberRef = doc(db, `households/${householdId}/members`, uid);
        await updateDoc(memberRef, {
          lastActiveAt: nowIso,
        }).catch(() => {});
      }
    } catch (e) {
      // Quiet background failure
    }
  },

  async setHouseholdUserNote(
    householdId: string,
    userId: string,
    note: string,
    emoji?: string,
  ): Promise<void> {
    if (!userId) return;
    const nowIso = new Date().toISOString();
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
        { note: string; emoji?: string; updatedAt: string }
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
          { note: string; emoji?: string; updatedAt: string }
        > = {};
        snapshot.forEach((d) => {
          const data = d.data();
          const uid = data.userId || data.memberId || d.id;
          if (data && data.thoughtNote) {
            result[uid] = {
              note: data.thoughtNote,
              emoji:
                data.thoughtEmoji !== undefined && data.thoughtEmoji !== null
                  ? String(data.thoughtEmoji).trim()
                  : "",
              updatedAt: data.noteUpdatedAt || "",
            };
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
