import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteField,
  onSnapshot,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { updateProfile as updateAuthProfile } from "firebase/auth";
import { db, auth, functions, firestoreDatabaseId } from "../firebase/config";
import {
  UserProfile,
  Household,
  HouseholdMember,
  BillingCycle,
  Charge,
  Payment,
  WaterAttendanceRecord,
  Message,
  MemberBill,
  Adjustment,
  Announcement,
  NotificationItem,
  SupportTicket,
  AppVersion,
  AuditLog,
  ElectricityConfig,
  WaterConfig,
  HostApplication,
  HostApplicationStatus,
} from "@propertyflow/shared";

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

function mapDocs<T>(snapshot: {
  forEach: (cb: (d: { id: string; data: () => unknown }) => void) => void;
}): T[] {
  const list: T[] = [];
  snapshot.forEach((d) => {
    const data = d.data() as any;
    list.push({ id: d.id, ...data } as T);
  });
  return list;
}

function normalizeHostApplication(docId: string, raw: any): HostApplication {
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
    status: (raw?.status || "PENDING") as HostApplicationStatus,
    reviewedBy: raw?.reviewedBy,
    reviewerName: raw?.reviewerName,
    reviewNotes: raw?.reviewNotes || raw?.adminFeedback,
    adminFeedback: raw?.adminFeedback || raw?.reviewNotes,
    submittedAt: date,
    createdAt: date,
    reviewedAt: raw?.reviewedAt,
  };
}

export const firebaseDataService = {
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
    status?: HostApplicationStatus;
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

    const payload: HostApplication = {
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
    // Write to hostApplications
    await setDoc(doc(db, "hostApplications", applicationId), cleanPayload, {
      merge: true,
    });

    // Also update user profile with application reference
    try {
      await updateDoc(doc(db, "users", data.userId), {
        hostApplicationStatus: "PENDING",
        hostApplicationId: applicationId,
        ...(effectivePhone ? { phoneNumber: effectivePhone } : {}),
        updatedDate: now,
      });
    } catch (err) {
      console.warn(
        "[Firestore] Note updating user profile with hostApplicationId:",
        err,
      );
    }

    return applicationId;
  },

  async getUserHostApplication(
    userId: string,
  ): Promise<HostApplication | null> {
    if (!userId) return null;
    try {
      const docSnap = await getDoc(
        doc(db, "hostApplications", `host_app_${userId}`),
      );
      if (docSnap.exists()) {
        return normalizeHostApplication(docSnap.id, docSnap.data());
      }
      // Check legacy host_requests
      const legacySnap = await getDoc(doc(db, "host_requests", userId));
      if (legacySnap.exists()) {
        return normalizeHostApplication(legacySnap.id, legacySnap.data());
      }
      return null;
    } catch (err) {
      console.warn("[Firestore] getUserHostApplication error:", err);
      return null;
    }
  },

  listenToUserHostApplication(
    userId: string,
    callback: (app: HostApplication | null) => void,
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
        console.warn("[Firestore] listenToUserHostApplication error:", err);
        // Always invoke callback so the loading spinner never hangs on error
        callback(null);
      },
    );
  },

  listenToHostApplications(callback: (apps: HostApplication[]) => void) {
    return onSnapshot(
      collection(db, "hostApplications"),
      (snapshot) => {
        const list: HostApplication[] = [];
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
      (err) => console.warn("[Firestore] listenToHostApplications error:", err),
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
    const appData = appSnap.exists()
      ? (appSnap.data() as HostApplication)
      : null;
    const applicantUserId =
      appData?.userId || applicationId.replace("host_app_", "");

    // 1. Update application status with both reviewNotes and adminFeedback
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

    // 2. If APPROVED, upgrade user's role to HOST without creating a household yet.
    // The host can start creating their group/household from their dashboard screen.
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

  async bootstrapSuperAdmin(bootstrapSecret?: string): Promise<void> {
    const bootstrapSuperAdmin = httpsCallable(functions, "bootstrapSuperAdmin");
    await bootstrapSuperAdmin({ bootstrapSecret });
  },

  async saveUserProfile(
    user: Partial<UserProfile> & { uid: string },
  ): Promise<void> {
    const userRef = doc(db, "users", user.uid);
    const now = new Date().toISOString();
    const cleanPayload = sanitizeData({
      ...user,
      updatedDate: now,
      createdDate: user.createdDate || now,
    });

    try {
      await setDoc(userRef, cleanPayload, { merge: true });
      console.log(
        `[Firestore] User profile recorded in database '${firestoreDatabaseId}':`,
        user.uid,
      );
    } catch (err: any) {
      console.error(
        `[Firestore] Failed to save user profile to '${firestoreDatabaseId}':`,
        err,
      );
      throw err;
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 3000),
      );
      const fetchPromise = getDoc(doc(db, "users", uid))
        .then(async (snap) => {
          if (!snap.exists()) return null;
          const user = snap.data() as UserProfile;

          // Promote to HOST if user has approved host application
          if (
            user.hostApplicationStatus === "APPROVED" &&
            user.role !== "SUPER_ADMIN"
          ) {
            user.role = "HOST";
          }

          if (user.householdId) {
            try {
              const hhSnap = await getDoc(
                doc(db, "households", user.householdId),
              );
              if (!hhSnap.exists()) {
                // Household was deleted in Firestore! Clean up stale references
                // IMPORTANT: If user was HOST or has approved host application, preserve their HOST role!
                const isHost =
                  user.role === "HOST" ||
                  user.hostApplicationStatus === "APPROVED";
                updateDoc(doc(db, "users", uid), {
                  householdId: deleteField(),
                  householdName: deleteField(),
                  apartmentName: deleteField(),
                  updatedDate: new Date().toISOString(),
                  ...(isHost && user.role !== "SUPER_ADMIN"
                    ? { role: "HOST" }
                    : {}),
                }).catch(() => {});
                delete (user as any).householdId;
                delete (user as any).householdName;
                delete (user as any).apartmentName;
                if (isHost && user.role !== "SUPER_ADMIN") {
                  user.role = "HOST";
                }
              } else {
                const hhData = hhSnap.data();
                if (
                  hhData &&
                  hhData.hostId === uid &&
                  user.role !== "SUPER_ADMIN"
                ) {
                  user.role = "HOST";
                  updateDoc(doc(db, "users", uid), { role: "HOST" }).catch(
                    () => {},
                  );
                }
              }
            } catch (e) {
              console.warn(`[Firestore] household check err:`, e);
            }
          } else {
            // Check if user is host of an existing household
            try {
              const qHh = query(
                collection(db, "households"),
                where("hostId", "==", uid),
              );
              const hhDocs = await getDocs(qHh);
              if (!hhDocs.empty) {
                const hhData = hhDocs.docs[0].data();
                user.householdId = hhData.householdId;
                user.householdName =
                  hhData.householdName || hhData.apartmentName;
                user.apartmentName = hhData.apartmentName;
                if (user.role !== "SUPER_ADMIN") {
                  user.role = "HOST";
                  updateDoc(doc(db, "users", uid), {
                    householdId: hhData.householdId,
                    householdName: user.householdName,
                    apartmentName: user.apartmentName,
                    role: "HOST",
                  }).catch(() => {});
                }
              }
            } catch (hhErr) {
              console.warn(`[Firestore] host query err:`, hhErr);
            }
          }
          return user;
        })
        .catch((err) => {
          console.warn(
            `[Firestore] getUserProfile warning on database '${firestoreDatabaseId}':`,
            err,
          );
          return null;
        });

      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (err) {
      console.warn(
        `[Firestore] getUserProfile error on database '${firestoreDatabaseId}':`,
        err,
      );
      return null;
    }
  },

  listenToUserProfile(
    uid: string,
    callback: (user: UserProfile | null) => void,
  ) {
    const ref = doc(db, "users", uid);
    return onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const data = snap.data() as UserProfile;
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
              const isHost =
                data.role === "HOST" ||
                data.hostApplicationStatus === "APPROVED";
              delete (data as any).householdId;
              delete (data as any).householdName;
              delete (data as any).apartmentName;
              if (isHost && data.role !== "SUPER_ADMIN") {
                data.role = "HOST";
              }
              updateDoc(ref, {
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
          } catch (e) {
            console.warn("[Firestore] Household existence check err:", e);
          }
        }
        callback(data);
      },
      (err) =>
        console.warn(
          `[Firestore] listenToUserProfile error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  listenToUsers(callback: (users: UserProfile[]) => void) {
    return onSnapshot(
      collection(db, "users"),
      (snapshot) => callback(mapDocs<UserProfile>(snapshot)),
      (error) =>
        console.warn(
          `[Firestore] listenToUsers error on '${firestoreDatabaseId}':`,
          error,
        ),
    );
  },

  listenToHouseholds(callback: (households: Household[]) => void) {
    return onSnapshot(
      collection(db, "households"),
      (snapshot) => callback(mapDocs<Household>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToHouseholds error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async saveHousehold(household: Household): Promise<void> {
    const householdRef = doc(db, "households", household.householdId);
    const inviteCode =
      household.inviteCode || `PF-${Math.floor(100 + Math.random() * 900)}`;
    await setDoc(
      householdRef,
      sanitizeData({
        ...household,
        inviteCode,
        updatedDate: new Date().toISOString(),
      }),
      { merge: true },
    );
  },

  async getHousehold(householdId: string): Promise<Household | null> {
    try {
      const docSnap = await getDoc(doc(db, "households", householdId));
      if (docSnap.exists()) {
        const data = docSnap.data() as Household;
        if (!data.inviteCode) {
          const generatedCode = `PF-${Math.floor(100 + Math.random() * 900)}`;
          updateDoc(doc(db, "households", householdId), {
            inviteCode: generatedCode,
          }).catch(() => {});
          data.inviteCode = generatedCode;
        }
        return data;
      }
      return null;
    } catch (err) {
      console.warn(
        `[Firestore] getHousehold error on '${firestoreDatabaseId}':`,
        err,
      );
      return null;
    }
  },

  listenToHousehold(
    householdId: string,
    callback: (h: Household | null) => void,
  ) {
    const ref = doc(db, "households", householdId);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Household;
          if (!data.inviteCode) {
            const generatedCode = `PF-${Math.floor(100 + Math.random() * 900)}`;
            updateDoc(ref, { inviteCode: generatedCode }).catch(() => {});
            data.inviteCode = generatedCode;
          }
          callback(data);
        } else {
          callback(null);
        }
      },
      (err) => {
        console.warn(
          `[Firestore] listenToHousehold error on '${firestoreDatabaseId}':`,
          err,
        );
        callback(null);
      },
    );
  },

  async joinHouseholdByCode(
    codeOrId: string,
    user: { uid: string; displayName?: string; email?: string },
  ): Promise<{ success: boolean; household?: Household; error?: string }> {
    const cleanCode = codeOrId.trim();
    if (!cleanCode)
      return {
        success: false,
        error: "Please enter a valid household code or ID.",
      };

    try {
      // 1. Check direct doc ID match
      const directRef = doc(db, "households", cleanCode);
      const directSnap = await getDoc(directRef);
      let targetHh: Household | null = directSnap.exists()
        ? (directSnap.data() as Household)
        : null;

      // 2. Query by inviteCode (e.g. PF-402)
      if (!targetHh) {
        const qUpper = query(
          collection(db, "households"),
          where("inviteCode", "==", cleanCode.toUpperCase()),
        );
        const snapUpper = await getDocs(qUpper);
        if (!snapUpper.empty) {
          targetHh = snapUpper.docs[0].data() as Household;
        }
      }

      // 3. Try with "PF-" prefix if user only entered digits e.g. "402"
      if (!targetHh && !cleanCode.toUpperCase().startsWith("PF-")) {
        const qPrefix = query(
          collection(db, "households"),
          where("inviteCode", "==", `PF-${cleanCode.toUpperCase()}`),
        );
        const snapPrefix = await getDocs(qPrefix);
        if (!snapPrefix.empty) {
          targetHh = snapPrefix.docs[0].data() as Household;
        }
      }

      // 4. Fallback search across all households (case-insensitive & partial match for user convenience)
      if (!targetHh) {
        const allSnap = await getDocs(collection(db, "households"));
        for (const d of allSnap.docs) {
          const data = d.data() as Household;
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
          error: `No household found matching code "${cleanCode}". Please check with your host.`,
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
        console.warn("[Firestore] joinHouseholdByCode member check:", memErr);
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
            household: targetHh,
            error:
              "Your request to join this household is already awaiting host approval.",
          };
        }
      }

      const applicantPhoto =
        (user as any).profilePicture || (user as any).photoURL || null;

      // 1. Add/Update member record with status PENDING (requires host approval)
      await setDoc(
        memberRef,
        sanitizeData({
          memberId: user.uid,
          userId: user.uid,
          householdId: hhId,
          role: "PAYOR",
          displayName,
          email: user.email || "",
          profilePicture: applicantPhoto,
          photoURL: applicantPhoto,
          status: "PENDING",
          joinedDate: "",
          requestedDate: nowIso,
          rejectionReason: null,
        }),
        { merge: true },
      );

      // 2. Update user profile document with pending status (do not grant full membership until approved)
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        sanitizeData({
          pendingHouseholdId: hhId,
          pendingHouseholdName:
            targetHh.householdName || targetHh.apartmentName,
          joinRequestStatus: "PENDING",
          joinRejectionReason: null,
          updatedDate: nowIso,
        }),
        { merge: true },
      );

      return { success: true, household: targetHh };
    } catch (err: any) {
      console.error("[Firestore] joinHouseholdByCode error:", err);
      return {
        success: false,
        error: err.message || "Failed to join household. Please try again.",
      };
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
        joinedDate: nowIso.split("T")[0],
        rejectionReason: null,
      });

      const hhSnap = await getDoc(doc(db, "households", householdId));
      const hhData = hhSnap.exists() ? hhSnap.data() : null;

      try {
        await updateDoc(doc(db, "users", memberId), {
          householdId,
          householdName: hhData?.householdName || "",
          apartmentName: hhData?.apartmentName || "",
          role: "PAYOR",
          joinRequestStatus: "APPROVED",
          pendingHouseholdId: null,
          joinRejectionReason: null,
          updatedDate: nowIso,
        });
      } catch (uErr) {
        console.warn(
          "[approveJoinRequest] Host user doc update deferred to client:",
          uErr,
        );
      }

      await this.recalculateUnpaidExpensesForHousehold(householdId).catch(
        () => {},
      );
      return true;
    } catch (err) {
      console.error("[approveJoinRequest] Error:", err);
      return false;
    }
  },

  async recalculateUnpaidExpensesForHousehold(
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
      const activePayors = activeMembers.filter(
        (m: any) => (m.role || "").toUpperCase() !== "NON_PAYOR",
      );
      const effectivePayors =
        activePayors.length > 0 ? activePayors : activeMembers;

      const expSnap = await getDocs(
        collection(db, `households/${householdId}/expenses`),
      );
      let updatedCount = 0;

      for (const d of expSnap.docs) {
        const expData = d.data();
        if (expData.isPaid === true || expData.status === "PAID") continue;
        const payorCount = Math.max(1, effectivePayors.length);
        const shareCentavos = Math.round(expData.amountCents / payorCount);

        const newSplitDetails = activeMembers.map((m: any) => {
          const isPayor = (m.role || "").toUpperCase() !== "NON_PAYOR";
          if (isPayor) {
            return {
              userId: m.userId || m.memberId,
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

        await updateDoc(d.ref, {
          splitDetails: newSplitDetails,
          participantUserIds: newSplitDetails
            .filter((s) => !s.isExempt)
            .map((s) => s.userId),
          updatedDate: new Date().toISOString(),
        });
        updatedCount++;
      }
      return updatedCount;
    } catch (err) {
      console.error("[web recalculateUnpaidExpensesForHousehold] Error:", err);
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
      const cleanMemberId = String(memberId).replace(/^mem_/, "").trim();
      const memRef1 = doc(db, `households/${householdId}/members`, memberId);
      const memRef2 = doc(
        db,
        `households/${householdId}/members`,
        `mem_${cleanMemberId}`,
      );

      await Promise.all([
        deleteDoc(memRef1).catch(() => {}),
        deleteDoc(memRef2).catch(() => {}),
      ]);

      try {
        await updateDoc(doc(db, "users", cleanMemberId), {
          householdId: null,
          householdName: null,
          apartmentName: null,
          role: "MEMBER",
          joinRequestStatus: "REJECTED",
          joinRejectionReason: reason || "Declined by host",
          pendingHouseholdId: null,
          pendingHouseholdName: null,
          updatedDate: nowIso,
        });
      } catch (uErr) {
        console.warn(
          "[rejectJoinRequest] Host user doc update deferred to client:",
          uErr,
        );
      }
      return true;
    } catch (err) {
      console.error("[rejectJoinRequest] Error:", err);
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
      console.error("[updateUserProfilePicture] Error:", err);
      return false;
    }
  },

  async saveMember(
    householdId: string,
    member: HouseholdMember,
  ): Promise<void> {
    const ref = doc(db, `households/${householdId}/members`, member.memberId);
    await setDoc(ref, sanitizeData(member), { merge: true });
  },

  listenToMembers(
    householdId: string,
    callback: (members: HouseholdMember[]) => void,
  ) {
    return onSnapshot(
      collection(db, `households/${householdId}/members`),
      (snapshot) => {
        const list = mapDocs<HouseholdMember>(snapshot).filter((m: any) => {
          const isRejected =
            m.status === "REJECTED" ||
            m.status === "DECLINED" ||
            m.joinRequestStatus === "REJECTED";
          return !isRejected;
        });
        callback(list);
      },
      (err) => {
        console.warn(
          `[Firestore] listenToMembers error on '${firestoreDatabaseId}':`,
          err,
        );
        callback([]);
      },
    );
  },

  async saveBillingCycle(cycle: BillingCycle): Promise<void> {
    const ref = doc(
      db,
      `households/${cycle.householdId}/billingCycles`,
      cycle.billingCycleId,
    );
    await setDoc(ref, sanitizeData(cycle), { merge: true });
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
    callback: (cycles: BillingCycle[]) => void,
  ) {
    return onSnapshot(
      collection(db, `households/${householdId}/billingCycles`),
      (snapshot) => callback(mapDocs<BillingCycle>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToBillingCycles error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async saveCharge(charge: Charge): Promise<void> {
    const ref = doc(
      db,
      `households/${charge.householdId}/charges`,
      charge.chargeId,
    );
    await setDoc(ref, sanitizeData(charge), { merge: true });
  },

  listenToCharges(householdId: string, callback: (charges: Charge[]) => void) {
    return onSnapshot(
      collection(db, `households/${householdId}/charges`),
      (snapshot) => callback(mapDocs<Charge>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToCharges error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async saveExpense(
    householdId: string,
    expense: Record<string, unknown>,
  ): Promise<void> {
    const id = String(expense.id || expense.chargeId || `exp_${Date.now()}`);
    const ref = doc(db, `households/${householdId}/expenses`, id);
    const status = expense.status || (expense.isPaid ? "PAID" : "UNPAID");
    const isPaid = status === "PAID";
    await setDoc(
      ref,
      sanitizeData({ ...expense, status, isPaid, id, householdId }),
      { merge: true },
    );

    // Also mirror to charges so HostBilling table and calculations immediately include it
    try {
      const cat = String(expense.category || "").toUpperCase();
      let chargeType: Charge["chargeType"] = "CUSTOM";
      if (cat.includes("RENT")) chargeType = "RENT";
      else if (cat.includes("ELEC")) chargeType = "ELECTRICITY";
      else if (cat.includes("WATER")) chargeType = "WATER";
      else if (
        cat.includes("NET") ||
        cat.includes("WIFI") ||
        cat.includes("INTERNET")
      )
        chargeType = "INTERNET";

      const chargeRef = doc(db, `households/${householdId}/charges`, id);
      await setDoc(
        chargeRef,
        sanitizeData({
          chargeId: id,
          householdId,
          billingCycleId: expense.billingCycleId || "",
          chargeType,
          name: expense.title || expense.name || "Expense",
          description: expense.notes || expense.description || "",
          amountCentavos: Number(
            expense.amountCents || expense.amountCentavos || 0,
          ),
          distributionMethod: "PAYORS_ONLY",
          participantUserIds: [],
          createdDate:
            expense.createdAt ||
            expense.createdDate ||
            new Date().toISOString(),
          createdBy: expense.payerId || "",
        }),
        { merge: true },
      );
    } catch (mirrorErr) {
      console.warn(
        "[Firestore] mirror saveExpense to charges failed:",
        mirrorErr,
      );
    }
  },

  async deleteCharge(householdId: string, chargeId: string): Promise<void> {
    const chargeRef = doc(db, `households/${householdId}/charges`, chargeId);
    const expRef = doc(db, `households/${householdId}/expenses`, chargeId);
    await Promise.allSettled([deleteDoc(chargeRef), deleteDoc(expRef)]);
  },

  listenToExpenses(
    householdId: string,
    callback: (expenses: Record<string, unknown>[]) => void,
  ) {
    return onSnapshot(
      collection(db, `households/${householdId}/expenses`),
      (snapshot) => callback(mapDocs<Record<string, unknown>>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToExpenses error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async savePayment(payment: Payment): Promise<void> {
    const ref = doc(
      db,
      `households/${payment.householdId}/payments`,
      payment.paymentId,
    );
    await setDoc(ref, sanitizeData(payment), { merge: true });
  },

  listenToPayments(
    householdId: string,
    callback: (payments: Payment[]) => void,
  ) {
    return onSnapshot(
      collection(db, `households/${householdId}/payments`),
      (snapshot) => callback(mapDocs<Payment>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToPayments error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async saveAttendanceRecord(record: WaterAttendanceRecord): Promise<void> {
    const docId = `${record.billingCycleId}_${record.userId}_${record.date}`;
    const ref = doc(
      db,
      `households/${record.householdId}/waterAttendance`,
      docId,
    );
    await setDoc(ref, sanitizeData({ ...record, recordId: docId }), {
      merge: true,
    });
  },

  listenToWaterAttendance(
    householdId: string,
    callback: (records: WaterAttendanceRecord[]) => void,
  ) {
    return onSnapshot(
      collection(db, `households/${householdId}/waterAttendance`),
      (snapshot) => callback(mapDocs<WaterAttendanceRecord>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToWaterAttendance error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async saveElectricityConfig(
    householdId: string,
    billingCycleId: string,
    config: ElectricityConfig,
  ) {
    const ref = doc(
      db,
      `households/${householdId}/electricityConfig`,
      billingCycleId,
    );
    await setDoc(ref, sanitizeData(config), { merge: true });
  },

  listenToElectricityConfigs(
    householdId: string,
    callback: (configs: Record<string, ElectricityConfig>) => void,
  ) {
    return onSnapshot(
      collection(db, `households/${householdId}/electricityConfig`),
      (snapshot) => {
        const map: Record<string, ElectricityConfig> = {};
        snapshot.forEach((d) => {
          map[d.id] = d.data() as ElectricityConfig;
        });
        callback(map);
      },
      (err) =>
        console.warn(
          `[Firestore] listenToElectricityConfigs error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async saveWaterConfig(householdId: string, config: WaterConfig) {
    const ref = doc(db, `households/${householdId}/systemSettings`, "water");
    await setDoc(ref, sanitizeData(config), { merge: true });
  },

  listenToWaterConfig(
    householdId: string,
    callback: (config: WaterConfig | null) => void,
  ) {
    return onSnapshot(
      doc(db, `households/${householdId}/systemSettings`, "water"),
      (snap) => callback(snap.exists() ? (snap.data() as WaterConfig) : null),
      (err) =>
        console.warn(
          `[Firestore] listenToWaterConfig error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  listenToMemberBills(
    householdId: string,
    callback: (bills: MemberBill[]) => void,
  ) {
    return onSnapshot(
      collection(db, `households/${householdId}/memberBills`),
      (snapshot) => callback(mapDocs<MemberBill>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToMemberBills error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  listenToAdjustments(
    householdId: string,
    callback: (items: Adjustment[]) => void,
  ) {
    return onSnapshot(
      collection(db, `households/${householdId}/adjustments`),
      (snapshot) => callback(mapDocs<Adjustment>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToAdjustments error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async sendMessage(householdId: string, message: Message): Promise<void> {
    const ref = doc(
      db,
      `households/${householdId}/messages`,
      message.messageId,
    );
    await setDoc(ref, sanitizeData(message));
  },

  listenToMessages(
    householdId: string,
    callback: (messages: Message[]) => void,
  ) {
    return onSnapshot(
      collection(db, `households/${householdId}/messages`),
      (snapshot) => {
        const list = mapDocs<Message>(snapshot);
        list.sort((a, b) =>
          String(a.timestamp || "").localeCompare(String(b.timestamp || "")),
        );
        callback(list);
      },
      (err) =>
        console.warn(
          `[Firestore] listenToMessages error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async saveAnnouncement(announcement: Announcement): Promise<void> {
    const ref = doc(
      db,
      `households/${announcement.householdId}/announcements`,
      announcement.announcementId,
    );
    await setDoc(ref, sanitizeData(announcement), { merge: true });
  },

  listenToAnnouncements(
    householdId: string,
    callback: (items: Announcement[]) => void,
  ) {
    return onSnapshot(
      collection(db, `households/${householdId}/announcements`),
      (snapshot) => callback(mapDocs<Announcement>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToAnnouncements error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async saveNotification(notification: NotificationItem): Promise<void> {
    const ref = doc(db, "notifications", notification.notificationId);
    await setDoc(ref, sanitizeData(notification), { merge: true });
  },

  listenToNotifications(
    userId: string,
    callback: (items: NotificationItem[]) => void,
  ) {
    if (!userId) {
      callback([]);
      return () => undefined;
    }
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", userId),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const list = mapDocs<NotificationItem>(snapshot);
        list.sort((a, b) =>
          String(b.createdTimestamp || "").localeCompare(
            String(a.createdTimestamp || ""),
          ),
        );
        callback(list);
      },
      (err) =>
        console.warn(
          `[Firestore] listenToNotifications error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async markNotificationRead(
    notificationId: string,
    readStatus = true,
  ): Promise<void> {
    await updateDoc(doc(db, "notifications", notificationId), { readStatus });
  },

  async deleteNotification(notificationId: string): Promise<void> {
    await deleteDoc(doc(db, "notifications", notificationId));
  },

  async saveSupportTicket(ticket: SupportTicket): Promise<void> {
    const ref = doc(db, "supportTickets", ticket.ticketId);
    await setDoc(ref, sanitizeData(ticket), { merge: true });
  },

  listenToSupportTickets(
    callback: (tickets: SupportTicket[]) => void,
    userId?: string,
  ) {
    const q = userId
      ? query(collection(db, "supportTickets"), where("userId", "==", userId))
      : collection(db, "supportTickets");
    return onSnapshot(
      q,
      (snapshot) => callback(mapDocs<SupportTicket>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToSupportTickets error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  listenToAppVersions(callback: (versions: AppVersion[]) => void) {
    return onSnapshot(
      collection(db, "appVersions"),
      (snapshot) => callback(mapDocs<AppVersion>(snapshot)),
      (err) =>
        console.warn(
          `[Firestore] listenToAppVersions error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async saveAppVersion(version: AppVersion): Promise<void> {
    const ref = doc(db, "appVersions", version.versionId);
    await setDoc(ref, sanitizeData(version), { merge: true });
  },

  listenToAuditLogs(
    callback: (logs: AuditLog[]) => void,
    householdId?: string,
  ) {
    const q = householdId
      ? query(
          collection(db, "auditLogs"),
          where("householdId", "==", householdId),
        )
      : collection(db, "auditLogs");
    return onSnapshot(
      q,
      (snapshot) => {
        const list = mapDocs<AuditLog>(snapshot);
        list.sort((a, b) =>
          String(b.timestamp || "").localeCompare(String(a.timestamp || "")),
        );
        callback(list);
      },
      (err) =>
        console.warn(
          `[Firestore] listenToAuditLogs error on '${firestoreDatabaseId}':`,
          err,
        ),
    );
  },

  async saveAuditLog(log: AuditLog): Promise<void> {
    const ref = doc(db, "auditLogs", log.logId);
    await setDoc(ref, sanitizeData(log));
  },
};
