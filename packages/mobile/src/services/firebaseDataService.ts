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
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions } from "../firebase/config";

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
}

export interface MobilePayment {
  paymentId: string;
  householdId: string;
  billingCycleId: string;
  userId: string;
  userName: string;
  amountCentavos: number;
  paymentDate: string;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "GCASH" | "MAYA" | "OTHER";
  referenceNumber: string;
  proofOfPaymentUrl?: string;
  notes?: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  createdDate: string;
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
    propertyName: propName,
    propertyAddress: address,
    unitOrRoom: (raw?.unitOrRoom || "").trim(),
    monthlyRentOrShare: raw?.monthlyRentOrShare
      ? Number(raw.monthlyRentOrShare)
      : undefined,
    city: (raw?.city || "").trim(),
    estimatedRoommates: raw?.estimatedRoommates ?? 4,
    reason,
    reasonForApplying: reason,
    experience: (raw?.experience || "").trim(),
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

export const mobileDataService = {
  getCachedProfile(): any {
    return _cachedUserProfile;
  },
  setCachedProfile(p: any) {
    _cachedUserProfile = p;
  },
  getCachedHousehold(): any {
    return _cachedHousehold;
  },
  setCachedHousehold(h: any) {
    _cachedHousehold = h;
  },
  async submitHostApplication(data: {
    userId: string;
    applicantName: string;
    applicantEmail?: string;
    userEmail?: string;
    applicantPhone?: string;
    phoneNumber?: string;
    propertyName?: string;
    propertyAddress: string;
    unitOrRoom?: string;
    monthlyRentOrShare?: number;
    city?: string;
    estimatedRoommates?: number;
    reason?: string;
    reasonForApplying?: string;
    experience?: string;
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

    const payload = {
      id: applicationId,
      applicationId,
      userId: data.userId,
      applicantName: effectiveName,
      applicantEmail: effectiveEmail,
      userEmail: effectiveEmail,
      applicantPhone: effectivePhone,
      phoneNumber: effectivePhone,
      propertyAddress: effectiveAddress,
      unitOrRoom: (data.unitOrRoom || "").trim(),
      monthlyRentOrShare: data.monthlyRentOrShare,
      city: (data.city || "").trim(),
      estimatedRoommates: data.estimatedRoommates ?? 4,
      reason: effectiveReason,
      reasonForApplying: effectiveReason,
      experience: (data.experience || "").trim(),
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

    await setDoc(
      userRef,
      sanitizeData({
        uid: user.uid,
        fullName: existing.fullName || user.displayName,
        displayName: user.displayName,
        email: user.email,
        role: existing.role || user.role || "PAYOR",
        accountStatus: existing.accountStatus || "ACTIVE",
        householdId: existing.householdId,
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

      // Verify if linked household exists in Firestore
      if (data.householdId) {
        try {
          const hhSnap = await getDoc(doc(db, "households", data.householdId));
          if (!hhSnap.exists()) {
            // Household was deleted in Firestore! Clean up stale pointers
            await updateDoc(userRef, {
              householdId: deleteField(),
              householdName: deleteField(),
              apartmentName: deleteField(),
              updatedDate: new Date().toISOString(),
            }).catch(() => {});
            delete data.householdId;
            delete data.householdName;
            delete data.apartmentName;
          }
        } catch (hhErr) {
          console.warn("[Firestore Mobile] Household check err:", hhErr);
        }
      }

      if (data) {
        _cachedUserProfile = data;
      }
      return data;
    } catch (err) {
      console.warn("[Firestore Mobile] getUserProfile error:", err);
      return null;
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
        if (data.householdId) {
          try {
            const hhSnap = await getDoc(
              doc(db, "households", data.householdId),
            );
            if (!hhSnap.exists()) {
              // Household was deleted in Firestore
              delete data.householdId;
              delete data.householdName;
              delete data.apartmentName;
              updateDoc(userRef, {
                householdId: deleteField(),
                householdName: deleteField(),
                apartmentName: deleteField(),
              }).catch(() => {});
            }
          } catch (err) {
            console.warn("[Firestore Mobile] Household check err:", err);
          }
        }
        _cachedUserProfile = data;
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

  listenToHouseholdMembers(
    householdId: string,
    callback: (members: any[]) => void,
  ) {
    const q = collection(db, `households/${householdId}/members`);
    return onSnapshot(
      q,
      (snap) => {
        const items: any[] = [];
        snap.forEach((d) => items.push(d.data()));
        callback(items);
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
      inviteCode,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };

    await setDoc(doc(db, "households", householdId), sanitizeData(newHh), {
      merge: true,
    });

    // Add host member
    const userSnap = await getDoc(doc(db, "users", data.hostId));
    const uData = userSnap.exists() ? userSnap.data() : {};
    await setDoc(
      doc(db, `households/${householdId}/members`, data.hostId),
      sanitizeData({
        memberId: data.hostId,
        userId: data.hostId,
        householdId,
        role: "HOST",
        displayName: uData.displayName || uData.fullName || "Host",
        email: uData.email || "",
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

  async removeMemberFromHousehold(
    householdId: string,
    memberId: string,
  ): Promise<void> {
    const ref = doc(db, `households/${householdId}/members`, memberId);
    await deleteDoc(ref);
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
    user: { uid: string; displayName: string; email: string },
  ): Promise<{ success: boolean; household?: any; error?: string }> {
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
      await setDoc(
        doc(db, `households/${hhId}/members`, user.uid),
        sanitizeData({
          memberId: user.uid,
          userId: user.uid,
          householdId: hhId,
          role: "PAYOR",
          displayName: user.displayName || "Resident",
          email: user.email || "",
          status: "ACTIVE",
          joinedDate: new Date().toISOString(),
        }),
        { merge: true },
      );

      await setDoc(
        doc(db, "users", user.uid),
        {
          householdId: hhId,
          householdName: targetHh.householdName || targetHh.apartmentName,
          apartmentName: targetHh.apartmentName || targetHh.householdName,
          role: "PAYOR",
          updatedDate: new Date().toISOString(),
        },
        { merge: true },
      );

      return { success: true, household: targetHh };
    } catch (err: any) {
      console.error("[Firebase] joinHouseholdByCode error:", err);
      return { success: false, error: err.message || "Failed to join group." };
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
    const payload: MobileExpense = {
      ...expense,
      status,
      isPaid,
      id,
      createdAt: new Date().toISOString(),
    };
    await setDoc(ref, sanitizeData(payload));

    // Mirror to charges collection for instantaneous cross-platform Web sync
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
          billingCycleId: expense.billingCycleId || "",
          chargeType,
          name: expense.title,
          description: expense.notes || "",
          amountCentavos: expense.amountCents,
          distributionMethod: "PAYORS_ONLY",
          participantUserIds: [],
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

    return id;
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

  async createBillingCycle(
    householdId: string,
    cycleData: {
      name: string;
      startDate: string;
      endDate: string;
      status?: string;
    },
  ): Promise<string> {
    const billingCycleId = `bc_${Date.now()}`;
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
      totalBilledCentavos: 0,
      totalCollectedCentavos: 0,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    await setDoc(ref, sanitizeData(newCycle), { merge: true });
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
        items.sort((a, b) =>
          String(b.startDate || "").localeCompare(String(a.startDate || "")),
        );
        callback(items);
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
        const items: any[] = [];
        snap.forEach((d) => items.push(d.data()));
        callback(items);
      },
      (err) => console.warn("[Firestore Mobile] listenToMemberBills:", err),
    );
  },

  listenToWaterConfig(
    householdId: string,
    callback: (config: any | null) => void,
  ) {
    const ref = doc(db, `households/${householdId}/systemSettings`, "water");
    return onSnapshot(
      ref,
      (snap) => {
        callback(snap.exists() ? snap.data() : null);
      },
      (err) => console.warn("[Firestore Mobile] listenToWaterConfig:", err),
    );
  },

  // --- PAYMENTS ---
  async submitPayment(
    payment: Omit<
      MobilePayment,
      "paymentId" | "status" | "createdDate" | "paymentDate"
    >,
  ): Promise<string> {
    const submit = httpsCallable(functions, "submitPayment");
    const result = await submit({
      householdId: payment.householdId,
      billingCycleId: payment.billingCycleId,
      amountCentavos: payment.amountCentavos,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      proofOfPaymentUrl: payment.proofOfPaymentUrl,
      notes: payment.notes,
    });

    const serverPayment = (result.data as { payment?: MobilePayment }).payment;
    return serverPayment?.paymentId || "";
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

  // --- WATER ATTENDANCE ---
  async toggleAttendance(
    householdId: string,
    cycleId: string,
    userId: string,
    date: string,
    status: "PRESENT" | "ABSENT",
  ): Promise<void> {
    const id = `${cycleId}_${userId}_${date}`;
    const ref = doc(db, `households/${householdId}/waterAttendance`, id);
    await setDoc(
      ref,
      {
        recordId: id,
        householdId,
        billingCycleId: cycleId,
        userId,
        date,
        status,
        locked: false,
        modifiedBy: auth.currentUser?.uid || userId,
        modifiedTimestamp: new Date().toISOString(),
      },
      { merge: true },
    );
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
};
