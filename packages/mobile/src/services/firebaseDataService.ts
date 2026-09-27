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
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { updateProfile as updateAuthProfile } from 'firebase/auth';
import { db, auth, functions } from '../firebase/config';
export { uploadImageToCloudinaryMobile, uploadImageToCloudinary } from './cloudinaryService';

export function isPayorMember(member: any): boolean {
  if (!member) return true;
  if (member.role === 'NON_PAYOR' || member.role === 'RESIDENT_NON_PAYOR' || member.isPayor === false) {
    return false;
  }
  if (member.role === 'PAYOR' || member.role === 'HOST' || member.isPayor === true) {
    return true;
  }
  return member.role !== 'NON_PAYOR';
}

/**
 * Excludes group name suffixes from bill/expense titles (e.g. "Electricity - Administrators" -> "Electricity").
 */
export function cleanBillTitle(title?: string, category?: string, groupName?: string): string {
  if (!title) return category || "";
  const trimmed = title.trim();

  // If title starts with "Category - " (case-insensitive)
  if (category && trimmed.toLowerCase().startsWith(`${category.toLowerCase()} - `)) {
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
  status?: 'UNPAID' | 'PAID' | 'PENDING';
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
}

export interface MobilePayment {
  paymentId: string;
  householdId: string;
  billingCycleId: string;
  userId: string;
  userName: string;
  amountCentavos: number;
  paymentDate: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'GCASH' | 'MAYA' | 'OTHER';
  referenceNumber: string;
  proofOfPaymentUrl?: string;
  notes?: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdDate: string;
}

export interface MobileAttendance {
  recordId: string;
  householdId: string;
  billingCycleId: string;
  userId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'UNMARKED';
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
    role: 'Host' | 'Payor' | 'Non-Payor';
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
  if (typeof val === 'object' && !(val instanceof Date)) {
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
  const applicantPhone = (raw?.phoneNumber || raw?.applicantPhone || '').trim();
  const reason = (raw?.reasonForApplying || raw?.reason || raw?.notes || '').trim();
  const email = (raw?.userEmail || raw?.applicantEmail || '').trim();
  const date = raw?.createdAt || raw?.submittedAt || raw?.requestedAt || new Date().toISOString();
  const address = (raw?.propertyAddress || raw?.address || '').trim();
  const propName = (raw?.propertyName || raw?.householdName || raw?.apartmentName || address || 'Proposed Household').trim();

  return {
    ...raw,
    id: appId,
    applicationId: appId,
    userId: raw?.userId || '',
    applicantName: (raw?.applicantName || raw?.displayName || 'Resident Applicant').trim(),
    applicantEmail: email,
    userEmail: email,
    applicantPhone,
    phoneNumber: applicantPhone,
    managementType: (raw?.managementType || 'Primary Leaseholder / Master Tenant').trim(),
    selectedHouseholdId: (raw?.selectedHouseholdId || '').trim(),
    roommateGroupName: (raw?.roommateGroupName || raw?.householdName || '').trim(),
    propertyName: propName,
    propertyAddress: address,
    unitOrRoom: (raw?.unitOrRoom || '').trim(),
    monthlyRentOrShare: raw?.monthlyRentOrShare ? Number(raw.monthlyRentOrShare) : (raw?.estimatedMonthlyBills ? Number(raw.estimatedMonthlyBills) : undefined),
    estimatedMonthlyBills: raw?.estimatedMonthlyBills ? Number(raw.estimatedMonthlyBills) : (raw?.monthlyRentOrShare ? Number(raw.monthlyRentOrShare) : undefined),
    city: (raw?.city || '').trim(),
    estimatedRoommates: raw?.estimatedRoommates ?? 4,
    reason,
    reasonForApplying: reason,
    experience: (raw?.experience || raw?.propertyExperience || '').trim(),
    propertyExperience: (raw?.propertyExperience || raw?.experience || '').trim(),
    status: raw?.status || 'PENDING',
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
  getCachedProfile(uid?: string): any {
    if (uid && _cachedUserProfile && _cachedUserProfile.uid !== uid) {
      return null;
    }
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
  clearCache() {
    _cachedUserProfile = null;
    _cachedHousehold = null;
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
    const effectivePhone = (data.phoneNumber || data.applicantPhone || '').trim();
    const effectiveReason = (data.reasonForApplying || data.reason || '').trim();
    const effectiveEmail = (data.userEmail || data.applicantEmail || '').trim();
    const effectiveAddress = (data.propertyAddress || '').trim();
    const effectiveName = (data.applicantName || 'Resident Applicant').trim();
    const effectivePropName = (data.propertyName || effectiveAddress || 'Proposed Household').trim();
    const effectiveBills = data.estimatedMonthlyBills !== undefined ? data.estimatedMonthlyBills : data.monthlyRentOrShare;
    const effectiveExp = (data.propertyExperience || data.experience || '').trim();
    const effectiveMgmtType = (data.managementType || 'Primary Leaseholder / Master Tenant').trim();

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
      selectedHouseholdId: (data.selectedHouseholdId || '').trim(),
      roommateGroupName: (data.roommateGroupName || '').trim(),
      propertyAddress: effectiveAddress,
      unitOrRoom: (data.unitOrRoom || '').trim(),
      monthlyRentOrShare: effectiveBills,
      estimatedMonthlyBills: effectiveBills,
      city: (data.city || '').trim(),
      estimatedRoommates: data.estimatedRoommates ?? 4,
      reason: effectiveReason,
      reasonForApplying: effectiveReason,
      experience: effectiveExp,
      propertyExperience: effectiveExp,
      status: data.status || 'PENDING',
      submittedAt: now,
      createdAt: now,
    };

    const cleanPayload = sanitizeData(payload);
    await setDoc(doc(db, 'hostApplications', applicationId), cleanPayload, { merge: true });

    try {
      await setDoc(
        doc(db, 'users', data.userId),
        {
          hostApplicationStatus: 'PENDING',
          hostApplicationId: applicationId,
          ...(effectivePhone ? { phoneNumber: effectivePhone } : {}),
          updatedDate: now,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[Firestore Mobile] Error updating user profile with hostApplicationId:', err);
    }

    return applicationId;
  },

  async getUserHostApplication(userId: string): Promise<any | null> {
    if (!userId) return null;
    try {
      const docSnap = await getDoc(doc(db, 'hostApplications', `host_app_${userId}`));
      if (docSnap.exists()) {
        return normalizeHostApplication(docSnap.id, docSnap.data());
      }
      const legacySnap = await getDoc(doc(db, 'host_requests', userId));
      if (legacySnap.exists()) {
        return normalizeHostApplication(legacySnap.id, legacySnap.data());
      }
      return null;
    } catch (err) {
      console.warn('[Firestore Mobile] getUserHostApplication error:', err);
      return null;
    }
  },

  listenToUserHostApplication(userId: string, callback: (app: any | null) => void) {
    if (!userId) {
      callback(null);
      return () => undefined;
    }
    const ref = doc(db, 'hostApplications', `host_app_${userId}`);
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
        console.warn('[Firestore Mobile] listenToUserHostApplication error:', err);
        // Always invoke callback so loading state finishes
        callback(null);
      }
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
      applicantName: user.displayName || user.email || 'Resident',
      applicantEmail: user.email || '',
      propertyName: data.householdName || data.apartmentName || 'My Co-Living Space',
      propertyAddress: data.address || '',
      estimatedRoommates: 4,
      reason: data.notes || 'Host application submitted during onboarding',
    });
  },

  // --- USER PROFILE ---
  async syncUserProfile(user: { uid: string; displayName: string; email: string; role?: string }): Promise<void> {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const existing = snap.exists() ? snap.data() : {};
    const preservedRole =
      existing.role === 'SUPER_ADMIN'
        ? 'SUPER_ADMIN'
        : existing.role === 'HOST' || existing.hostApplicationStatus === 'APPROVED' || user.role === 'HOST'
        ? 'HOST'
        : existing.role || user.role || 'PAYOR';

    await setDoc(
      userRef,
      sanitizeData({
        uid: user.uid,
        fullName: existing.fullName || user.displayName,
        displayName: user.displayName,
        email: user.email,
        role: preservedRole,
        accountStatus: existing.accountStatus || 'ACTIVE',
        householdId: existing.householdId,
        hostApplicationStatus: existing.hostApplicationStatus,
        hostApplicationId: existing.hostApplicationId,
        createdDate: existing.createdDate || new Date().toISOString(),
        updatedDate: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      }),
      { merge: true }
    );
  },

  async getUserProfile(uid: string) {
    if (!uid) return null;
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return null;
      const data = snap.data();

      // Promote to HOST if user has approved host application
      if (data.hostApplicationStatus === 'APPROVED' && data.role !== 'SUPER_ADMIN') {
        data.role = 'HOST';
      }

      // Verify if linked household exists in Firestore
      if (data.householdId) {
        try {
          const hhSnap = await getDoc(doc(db, 'households', data.householdId));
          if (!hhSnap.exists()) {
            // Household was deleted in Firestore! Clean up stale pointers
            // IMPORTANT: If user was HOST or has approved host application, preserve HOST role!
            const isHost = data.role === 'HOST' || data.hostApplicationStatus === 'APPROVED';
            await updateDoc(userRef, {
              householdId: deleteField(),
              householdName: deleteField(),
              apartmentName: deleteField(),
              updatedDate: new Date().toISOString(),
              ...(isHost && data.role !== 'SUPER_ADMIN' ? { role: 'HOST' } : {}),
            }).catch(() => {});
            delete data.householdId;
            delete data.householdName;
            delete data.apartmentName;
            if (isHost && data.role !== 'SUPER_ADMIN') {
              data.role = 'HOST';
            }
          } else {
            const hhData = hhSnap.data();
            if (hhData && hhData.hostId === uid && data.role !== 'SUPER_ADMIN') {
              data.role = 'HOST';
              updateDoc(userRef, { role: 'HOST' }).catch(() => {});
            }
          }
        } catch (hhErr) {
          console.warn('[Firestore Mobile] Household check err:', hhErr);
        }
      } else {
        try {
          const qHh = query(collection(db, 'households'), where('hostId', '==', uid));
          const hhDocs = await getDocs(qHh);
          if (!hhDocs.empty) {
            const hhData = hhDocs.docs[0].data();
            data.householdId = hhData.householdId;
            data.householdName = hhData.householdName || hhData.apartmentName;
            data.apartmentName = hhData.apartmentName;
            if (data.role !== 'SUPER_ADMIN') {
              data.role = 'HOST';
              updateDoc(userRef, {
                householdId: hhData.householdId,
                householdName: data.householdName,
                apartmentName: data.apartmentName,
                role: 'HOST',
              }).catch(() => {});
            }
          }
        } catch (hhErr) {
          console.warn('[Firestore Mobile] host query err:', hhErr);
        }
      }

      if (data) {
        _cachedUserProfile = data;
      }
      return data;
    } catch (err) {
      console.warn('[Firestore Mobile] getUserProfile error:', err);
      return null;
    }
  },

  async saveUserProfile(profile: any): Promise<void> {
    if (!profile || !profile.uid) return;
    try {
      const userRef = doc(db, 'users', profile.uid);
      await setDoc(userRef, sanitizeData(profile), { merge: true });
      if (_cachedUserProfile && _cachedUserProfile.uid === profile.uid) {
        _cachedUserProfile = { ..._cachedUserProfile, ...profile };
      }
    } catch (err) {
      console.warn('[saveUserProfile Mobile] Error:', err);
    }
  },

  listenToUserProfile(uid: string, callback: (data: any) => void) {
    const userRef = doc(db, 'users', uid);
    return onSnapshot(
      userRef,
      async (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const data = snap.data();
        if (data.hostApplicationStatus === 'APPROVED' && data.role !== 'SUPER_ADMIN') {
          data.role = 'HOST';
        }
        if (data.householdId) {
          try {
            const hhSnap = await getDoc(doc(db, 'households', data.householdId));
            if (!hhSnap.exists()) {
              // Household was deleted in Firestore
              const isHost = data.role === 'HOST' || data.hostApplicationStatus === 'APPROVED';
              delete data.householdId;
              delete data.householdName;
              delete data.apartmentName;
              if (isHost && data.role !== 'SUPER_ADMIN') {
                data.role = 'HOST';
              }
              updateDoc(userRef, {
                householdId: deleteField(),
                householdName: deleteField(),
                apartmentName: deleteField(),
                ...(isHost && data.role !== 'SUPER_ADMIN' ? { role: 'HOST' } : {}),
              }).catch(() => {});
            } else {
              const hhData = hhSnap.data();
              if (hhData && hhData.hostId === uid && data.role !== 'SUPER_ADMIN') {
                data.role = 'HOST';
              }
            }
          } catch (err) {
            console.warn('[Firestore Mobile] Household check err:', err);
          }
        }
        _cachedUserProfile = data;
        callback(data);
      },
      (err) => console.warn('[Firestore Mobile] listenToUserProfile:', err)
    );
  },

  async ensureHostHousehold(uid: string, cachedProfile?: any): Promise<any> {
    if (cachedProfile) return cachedProfile;
    return this.getUserProfile(uid);
  },

  // --- HOUSEHOLD & MEMBERS ---
  listenToHousehold(householdId: string, callback: (data: any) => void) {
    const docRef = doc(db, 'households', householdId);
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
      (err) => console.warn('[Firestore Mobile] listenToHousehold:', err)
    );
  },

  listenToHouseholds(callback: (households: any[]) => void) {
    return onSnapshot(
      collection(db, 'households'),
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => {
          list.push({ ...d.data(), id: d.id, householdId: d.data().householdId || d.id });
        });
        callback(list);
      },
      (err) => {
        console.warn('[Firestore Mobile] listenToHouseholds err:', err);
        callback([]);
      }
    );
  },

  async getHouseholds(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, 'households'));
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id, householdId: d.data().householdId || d.id });
      });
      return list;
    } catch (err) {
      console.warn('[Firestore Mobile] getHouseholds err:', err);
      return [];
    }
  },

  listenToHouseholdMembers(householdId: string, callback: (members: any[]) => void) {
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
            if (!data.profilePicture && !data.photoURL && uid && !uid.startsWith('mem_')) {
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
                const uDoc = await getDoc(doc(db, 'users', uid));
                if (uDoc.exists()) {
                  const uData = uDoc.data();
                  const pic = uData.profilePicture || uData.photoURL || uData.avatarUrl;
                  if (pic) {
                    const idx = rawItems.findIndex((m) => (m.userId || m.memberId) === uid);
                    if (idx !== -1) {
                      rawItems[idx] = { ...rawItems[idx], profilePicture: pic, photoURL: pic };
                      hasEnriched = true;
                      // Backfill to the member doc in Firestore so future reads have it
                      setDoc(
                        doc(db, `households/${householdId}/members`, rawItems[idx].memberId || uid),
                        { profilePicture: pic, photoURL: pic },
                        { merge: true }
                      ).catch(() => {});
                    }
                  }
                }
              } catch (e) {}
            })
          );
          if (hasEnriched) {
            callback([...rawItems]);
          }
        }
      },
      (err) => console.warn('[Firestore Mobile] listenToHouseholdMembers:', err)
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
    const userSnap = await getDoc(doc(db, 'users', data.hostId));
    const uData = userSnap.exists() ? userSnap.data() : {};
    const isHost = uData.role === 'HOST' || uData.role === 'SUPER_ADMIN' || uData.hostApplicationStatus === 'APPROVED';
    if (!isHost) {
      throw new Error('Host privileges required. Only verified hosts can create household groups.');
    }

    const householdId = `hh_${Date.now()}`;
    const name = data.householdName.trim() || 'Apartment Roommate';
    const apt = (data.apartmentName || name).trim();
    const inviteCode = `PF-${Math.floor(100 + Math.random() * 900)}`;

    const newHh = {
      householdId,
      householdName: name,
      apartmentName: apt,
      address: data.address || '',
      hostId: data.hostId,
      status: 'ACTIVE',
      inviteCode,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };

    await setDoc(doc(db, 'households', householdId), sanitizeData(newHh), { merge: true });

    // Add host member with profile picture if available
    const hostPic = uData.profilePicture || uData.photoURL || auth.currentUser?.photoURL || '';

    await setDoc(
      doc(db, `households/${householdId}/members`, data.hostId),
      sanitizeData({
        memberId: data.hostId,
        userId: data.hostId,
        householdId,
        role: 'HOST',
        displayName: uData.displayName || uData.fullName || auth.currentUser?.displayName || 'Host',
        email: uData.email || auth.currentUser?.email || '',
        profilePicture: hostPic,
        photoURL: hostPic,
        status: 'ACTIVE',
        joinedDate: new Date().toISOString(),
      }),
      { merge: true }
    );

    // Add any initial invited members
    if (data.members && data.members.length > 0) {
      for (const m of data.members) {
        if (!m.name.trim()) continue;
        const memId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const isEmail = (m.phoneOrEmail || '').includes('@');
        await setDoc(
          doc(db, `households/${householdId}/members`, memId),
          sanitizeData({
            memberId: memId,
            householdId,
            role: 'PAYOR',
            displayName: m.name.trim(),
            email: isEmail ? (m.phoneOrEmail || '').trim() : '',
            phoneNumber: !isEmail ? (m.phoneOrEmail || '').trim() : '',
            status: 'PENDING',
            joinedDate: new Date().toISOString(),
          }),
          { merge: true }
        );
      }
    }

    // Update host user's profile
    const profileUpdate = {
      householdId,
      householdName: name,
      apartmentName: apt,
      role: 'HOST',
      updatedDate: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', data.hostId), profileUpdate, { merge: true });

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
    data: Partial<{ householdName: string; apartmentName: string; address: string }>
  ): Promise<void> {
    const ref = doc(db, 'households', householdId);
    await setDoc(
      ref,
      {
        ...data,
        updatedDate: new Date().toISOString(),
      },
      { merge: true }
    );

    const currentUser = auth.currentUser;
    if (currentUser?.uid) {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          ...(data.householdName ? { householdName: data.householdName } : {}),
          ...(data.apartmentName ? { apartmentName: data.apartmentName } : {}),
          updatedDate: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  },

  async updateMemberRole(
    householdId: string,
    memberId: string,
    userId: string,
    newRole: 'PAYOR' | 'NON_PAYOR'
  ): Promise<void> {
    const memRef = doc(db, `households/${householdId}/members`, memberId);
    await setDoc(memRef, { role: newRole, updatedDate: new Date().toISOString() }, { merge: true });

    if (userId && !userId.startsWith('mem_')) {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { role: newRole, updatedDate: new Date().toISOString() }, { merge: true }).catch(() => {});
    }

    // Recalculate unpaid expenses so payor/non-payor changes are immediately reflected
    await this.recalculateUnpaidExpensesForHousehold(householdId);
  },

  async removeMemberFromHousehold(householdId: string, memberId: string, userId?: string): Promise<void> {
    const ref = doc(db, `households/${householdId}/members`, memberId);
    await deleteDoc(ref);

    if (userId && userId !== memberId) {
      const ref2 = doc(db, `households/${householdId}/members`, userId);
      await deleteDoc(ref2).catch(() => {});
    }

    const targetUid = userId && !userId.startsWith('mem_') ? userId : (!memberId.startsWith('mem_') ? memberId : null);
    if (targetUid) {
      await setDoc(
        doc(db, 'users', targetUid),
        {
          householdId: '',
          householdName: '',
          apartmentName: '',
          pendingHouseholdId: '',
          pendingHouseholdName: '',
          joinRequestStatus: null,
          updatedDate: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    }

    // Recalculate unpaid expenses across remaining active payors
    await this.recalculateUnpaidExpensesForHousehold(householdId);
  },

  async inviteMemberToHousehold(
    householdId: string,
    member: { name: string; phoneOrEmail: string; role?: string }
  ): Promise<void> {
    const memId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isEmail = member.phoneOrEmail.includes('@');
    await setDoc(
      doc(db, `households/${householdId}/members`, memId),
      sanitizeData({
        memberId: memId,
        householdId,
        role: member.role || 'PAYOR',
        displayName: member.name.trim(),
        email: isEmail ? member.phoneOrEmail.trim() : '',
        phoneNumber: !isEmail ? member.phoneOrEmail.trim() : '',
        status: 'PENDING',
        joinedDate: new Date().toISOString(),
      }),
      { merge: true }
    );
  },

  async joinHouseholdByCode(
    codeOrId: string,
    user: { uid: string; displayName: string; email: string; photoURL?: string }
  ): Promise<{ success: boolean; household?: any; isPendingApproval?: boolean; error?: string }> {
    const cleanCode = codeOrId.trim();
    if (!cleanCode) return { success: false, error: 'Please enter a valid code' };

    try {
      // 1. Try finding by ID
      const hhDocRef = doc(db, 'households', cleanCode);
      const hhSnap = await getDoc(hhDocRef);
      let targetHh: any = hhSnap.exists() ? hhSnap.data() : null;

      // 2. If not found by ID, query by inviteCode
      if (!targetHh) {
        const q = query(collection(db, 'households'), where('inviteCode', '==', cleanCode.toUpperCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          targetHh = snap.docs[0].data();
        }
      }

      // 3. Try with PF- prefix if not provided
      if (!targetHh && !cleanCode.toUpperCase().startsWith('PF-')) {
        const q2 = query(collection(db, 'households'), where('inviteCode', '==', `PF-${cleanCode.toUpperCase()}`));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          targetHh = snap2.docs[0].data();
        }
      }

      // 4. Fallback search across all households
      if (!targetHh) {
        const allSnap = await getDocs(collection(db, 'households'));
        for (const d of allSnap.docs) {
          const data = d.data();
          const code = (data.inviteCode || '').toUpperCase();
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
        return { success: false, error: `No household found with code "${cleanCode}". Please check with your host.` };
      }

      const hhId = targetHh.householdId;
      const nowIso = new Date().toISOString();
      const displayName = user.displayName || user.email || 'Resident';

      // If user is already the host of this household
      if (targetHh.hostId === user.uid) {
        return { success: false, error: 'You are already the host of this household.' };
      }

      // Check existing member record safely
      const memberRef = doc(db, `households/${hhId}/members`, user.uid);
      let memberSnap: any = null;
      try {
        memberSnap = await getDoc(memberRef);
      } catch (memErr) {
        console.warn('[Firebase Mobile] joinHouseholdByCode member check:', memErr);
      }
      if (memberSnap && memberSnap.exists()) {
        const memData = memberSnap.data();
        if (memData.status === 'ACTIVE') {
          return { success: false, error: 'You are already an active member of this household.' };
        }
        if (memData.status === 'PENDING') {
          return {
            success: true,
            isPendingApproval: true,
            household: targetHh,
            error: 'Your request to join this household is already awaiting host approval.',
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
          role: 'PAYOR',
          displayName,
          email: user.email || '',
          profilePicture: user.photoURL || null,
          photoURL: user.photoURL || null,
          status: 'PENDING',
          joinedDate: '',
          requestedDate: nowIso,
          rejectionReason: null,
        }),
        { merge: true }
      );

      // 2. Update user profile document with pending status (do not grant full membership until approved)
      await setDoc(
        doc(db, 'users', user.uid),
        {
          pendingHouseholdId: hhId,
          pendingHouseholdName: targetHh.householdName || targetHh.apartmentName,
          joinRequestStatus: 'PENDING',
          joinRejectionReason: null,
          updatedDate: nowIso,
        },
        { merge: true }
      );

      return { success: true, household: targetHh, isPendingApproval: true };
    } catch (err: any) {
      console.error('[Firebase] joinHouseholdByCode error:', err);
      return { success: false, error: err.message || 'Failed to join group.' };
    }
  },

  async approveJoinRequest(householdId: string, memberId: string): Promise<boolean> {
    try {
      const nowIso = new Date().toISOString();
      const memRef = doc(db, `households/${householdId}/members`, memberId);
      await updateDoc(memRef, {
        status: 'ACTIVE',
        joinedDate: nowIso,
        rejectionReason: null,
      });

      const hhSnap = await getDoc(doc(db, 'households', householdId));
      const hhData = hhSnap.exists() ? hhSnap.data() : null;

      try {
        await updateDoc(doc(db, 'users', memberId), {
          householdId,
          householdName: hhData?.householdName || hhData?.apartmentName || '',
          apartmentName: hhData?.apartmentName || hhData?.householdName || '',
          role: 'PAYOR',
          joinRequestStatus: 'APPROVED',
          pendingHouseholdId: null,
          joinRejectionReason: null,
          updatedDate: nowIso,
        });
      } catch (uErr) {
        console.warn('[approveJoinRequest Mobile] User doc update deferred to client:', uErr);
      }

      // Automatically recalculate and redistribute unpaid bills across active payors
      await this.recalculateUnpaidExpensesForHousehold(householdId);

      return true;
    } catch (err) {
      console.error('[approveJoinRequest Mobile] Error:', err);
      return false;
    }
  },

  /**
   * Recalculates and redistributes all UNPAID expenses across the current roster of ACTIVE payors.
   * Ensures new payors are properly included and not left out or marked exempt from ongoing bills.
   */
  async recalculateUnpaidExpensesForHousehold(householdId: string): Promise<number> {
    try {
      if (!householdId) return 0;
      const membersSnap = await getDocs(collection(db, `households/${householdId}/members`));
      const activeMembers = membersSnap.docs
        .map((d) => d.data())
        .filter((m: any) => m.status === 'ACTIVE' || !m.status);

      if (activeMembers.length === 0) return 0;

      const activePayors = activeMembers.filter((m) => isPayorMember(m));
      const activeNonPayors = activeMembers.filter((m) => !isPayorMember(m));
      const effectivePayors = activePayors.length > 0 ? activePayors : activeMembers;

      const expSnap = await getDocs(collection(db, `households/${householdId}/expenses`));
      let updatedCount = 0;

      // Function-level map of member attendance days for water billing calculations
      const memberDaysMap = new Map<string, number>();
      try {
        const preCyclesSnap = await getDocs(collection(db, `households/${householdId}/billingCycles`));
        const preCycles = preCyclesSnap.docs.map((cd) => cd.data());
        const preActiveCycle = preCycles.find((c: any) => c.status === 'ACTIVE') || preCycles[0];
        if (preActiveCycle?.billingCycleId) {
          const [attSnap, subSnap] = await Promise.all([
            getDocs(query(collection(db, `households/${householdId}/waterAttendance`), where('billingCycleId', '==', preActiveCycle.billingCycleId))).catch(() => null),
            getDocs(query(collection(db, `households/${householdId}/attendanceSubmissions`), where('billingCycleId', '==', preActiveCycle.billingCycleId))).catch(() => null),
          ]);
          const preAtt = attSnap ? attSnap.docs.map((sd) => sd.data()) : [];
          const preSub = subSnap ? subSnap.docs.map((sd) => sd.data()) : [];
          for (const m of activeMembers) {
            const uid = m.userId || m.memberId;
            const present = preAtt.filter((a: any) => a.userId === uid && a.status === 'PRESENT').length;
            const sub = preSub.find((s: any) => s.userId === uid);
            memberDaysMap.set(uid, present > 0 ? present : (sub?.daysPresent || 0));
          }
        }
      } catch {
        // Attendance pre-population fallback
      }

      // Fetch water configuration to apply correct pricing mode
      let waterConfig: any = { pricingModel: 'PER_PERSON_DAY', rateCentavosPerPersonPerDay: 500 };
      try {
        const waterSnap = await getDoc(doc(db, `households/${householdId}/systemSettings`, 'water'));
        if (waterSnap.exists()) {
          waterConfig = waterSnap.data();
        }
      } catch (wErr) {
        console.warn('[recalculateUnpaidExpensesForHousehold] water settings load:', wErr);
      }

      for (const d of expSnap.docs) {
        const expData = d.data();
        if (expData.isPaid === true || expData.status === 'PAID') continue;

        const isWater = (expData.category || '').toLowerCase().includes('water');
        let newSplitDetails: any[] = [];

        if (isWater) {
          if (waterConfig?.pricingModel === 'FIXED_PER_PERSON_MONTH') {
            // Mode 3: Flat fee per resident
            const perPersonCentavos = waterConfig.fixedPerPersonAmountCentavos || 0;
            const updatedTotalCents = perPersonCentavos * effectivePayors.length;
            newSplitDetails = activeMembers.map((m: any) => {
              const isPayor = isPayorMember(m);
              if (isPayor) {
                return {
                  userId: m.userId || m.memberId,
                  displayName: m.displayName || 'Roommate',
                  shareCentavos: perPersonCentavos,
                  isPaid: false,
                  isExempt: false,
                  role: m.role || 'PAYOR',
                  note: `Flat water rate: ₱${(perPersonCentavos / 100).toFixed(2)}/resident/month`,
                };
              } else {
                return {
                  userId: m.userId || m.memberId,
                  displayName: m.displayName || 'Roommate',
                  shareCentavos: 0,
                  isPaid: true,
                  isExempt: true,
                  role: 'NON_PAYOR',
                  note: 'Exempted (Non-payor)',
                };
              }
            });
            if (updatedTotalCents > 0 && expData.amountCents !== updatedTotalCents) {
              await updateDoc(d.ref, { amountCents: updatedTotalCents });
            }
          } else if (waterConfig?.pricingModel === 'FIXED_MONTHLY') {
            // Mode 2: Fixed monthly household total split equally across payors
            const fixedMonthlyCents = waterConfig.fixedMonthlyAmountCentavos || expData.amountCents;
            const shareCentavos = Math.round(fixedMonthlyCents / effectivePayors.length);
            newSplitDetails = activeMembers.map((m: any) => {
              const isPayor = isPayorMember(m);
              if (isPayor) {
                return {
                  userId: m.userId || m.memberId,
                  displayName: m.displayName || 'Roommate',
                  shareCentavos,
                  isPaid: false,
                  isExempt: false,
                  role: m.role || 'PAYOR',
                  note: `Fixed monthly water bill (₱${(fixedMonthlyCents / 100).toFixed(2)}) split equally across ${effectivePayors.length} payors`,
                };
              } else {
                return {
                  userId: m.userId || m.memberId,
                  displayName: m.displayName || 'Roommate',
                  shareCentavos: 0,
                  isPaid: true,
                  isExempt: true,
                  role: 'NON_PAYOR',
                  note: 'Exempted (Non-payor)',
                };
              }
            });
            if (waterConfig.fixedMonthlyAmountCentavos && expData.amountCents !== waterConfig.fixedMonthlyAmountCentavos) {
              await updateDoc(d.ref, { amountCents: waterConfig.fixedMonthlyAmountCentavos });
            }
          } else {
            // Mode 1: Daily Attendance (PER_PERSON_DAY)
            let cycleId = expData.billingCycleId;
            if (!cycleId) {
              try {
                const cycSnap = await getDocs(collection(db, `households/${householdId}/billingCycles`));
                const allCycles = cycSnap.docs.map((cd) => cd.data());
                const act = allCycles.find((c: any) => c.status === 'ACTIVE') || allCycles[0];
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
                      collection(db, `households/${householdId}/waterAttendance`),
                      where('billingCycleId', '==', cycleId)
                    )
                  ).catch((e) => {
                    console.warn('[recalculateUnpaidExpenses] waterAttendance read notice:', e?.message || e);
                    return null;
                  }),
                  getDocs(
                    query(
                      collection(db, `households/${householdId}/attendanceSubmissions`),
                      where('billingCycleId', '==', cycleId)
                    )
                  ).catch((e) => {
                    console.warn('[recalculateUnpaidExpenses] attendanceSubmissions read notice:', e?.message || e);
                    return null;
                  }),
                ]);
                if (attSnap) attRecords = attSnap.docs.map((sd) => sd.data());
                if (subSnap) subRecords = subSnap.docs.map((sd) => sd.data());
              } catch (attErr) {
                console.warn('[recalculateUnpaidExpenses] attendance read error:', attErr);
              }
            }

            const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
            let nonPayorTotalCentavos = 0;
            const payorIndividual = new Map<string, number>();

            for (const m of activeMembers) {
              const uid = m.userId || m.memberId;
              const presentFromAtt = attRecords.filter(
                (a: any) => a.userId === uid && a.status === 'PRESENT'
              ).length;
              const subRecord = subRecords.find((s: any) => s.userId === uid);
              const daysPresent =
                presentFromAtt > 0 ? presentFromAtt : (subRecord?.daysPresent || memberDaysMap.get(uid) || 0);
              memberDaysMap.set(uid, daysPresent);
              const cost = daysPresent * rate;
              if (isPayorMember(m)) {
                payorIndividual.set(uid, cost);
              } else {
                nonPayorTotalCentavos += cost;
              }
            }

            const extraPerPayor =
              effectivePayors.length > 0
                ? Math.round(nonPayorTotalCentavos / effectivePayors.length)
                : 0;
            const nonPayorNames = activeNonPayors
              .map((np: any) => np.displayName || 'Non-payor')
              .join(', ');
            let totalWaterCents = 0;

            newSplitDetails = activeMembers.map((m: any) => {
              const uid = m.userId || m.memberId;
              const isPayor = isPayorMember(m);
              const daysPresent = memberDaysMap.get(uid) || 0;
              if (isPayor) {
                const ownCost = payorIndividual.get(uid) || 0;
                const totalPayorShare = ownCost + extraPerPayor;
                totalWaterCents += totalPayorShare;
                return {
                  userId: uid,
                  displayName: m.displayName || 'Roommate',
                  shareCentavos: totalPayorShare,
                  ownWaterCentavos: ownCost,
                  nonPayorWaterCentavos: extraPerPayor,
                  daysPresent,
                  rateCentavosPerDay: rate,
                  isPaid: false,
                  isExempt: false,
                  role: m.role || 'PAYOR',
                  note:
                    extraPerPayor > 0
                      ? `${daysPresent} days @ ₱${rate / 100}/day (₱${(ownCost / 100).toFixed(
                          2
                        )}) + non-payor absorption (₱${(extraPerPayor / 100).toFixed(
                          2
                        )} from ${nonPayorNames})`
                      : `${daysPresent} days present @ ₱${rate / 100}/day`,
                };
              } else {
                return {
                  userId: uid,
                  displayName: m.displayName || 'Roommate',
                  shareCentavos: 0,
                  ownWaterCentavos: 0,
                  nonPayorWaterCentavos: 0,
                  daysPresent,
                  rateCentavosPerDay: rate,
                  isPaid: true,
                  isExempt: true,
                  role: 'NON_PAYOR',
                  note: `Exempted (Non-payor) — ${daysPresent} days water cost absorbed by payors`,
                };
              }
            });

            if (totalWaterCents >= 0 && expData.amountCents !== totalWaterCents) {
              await updateDoc(d.ref, { amountCents: totalWaterCents });
            }
          }
        } else {
          const payorCount = Math.max(1, effectivePayors.length);
          const shareCentavos = Math.round(expData.amountCents / payorCount);

          newSplitDetails = activeMembers.map((m: any) => {
            const isPayor = isPayorMember(m);
            if (isPayor) {
              return {
                userId: m.userId || m.memberId,
                displayName: m.displayName || 'Roommate',
                shareCentavos,
                percentage: Math.round((100 / payorCount) * 10) / 10,
                isPaid: false,
                isExempt: false,
                role: m.role || 'PAYOR',
                note: `Fair share among ${payorCount} payors (Non-payors exempt)`,
              };
            } else {
              return {
                userId: m.userId || m.memberId,
                displayName: m.displayName || 'Roommate',
                shareCentavos: 0,
                percentage: 0,
                isPaid: true,
                isExempt: true,
                role: 'NON_PAYOR',
                note: 'Exempted (Non-payor)',
              };
            }
          });
        }

        await updateDoc(d.ref, {
          splitDetails: newSplitDetails,
          participantUserIds: newSplitDetails.filter((s) => !s.isExempt).map((s) => s.userId),
          updatedDate: new Date().toISOString(),
        });
        updatedCount++;
      }

      // Synchronize and update all memberBills in Firestore for all active members
      try {
        const cyclesSnap = await getDocs(collection(db, `households/${householdId}/billingCycles`));
        const cycles = cyclesSnap.docs.map((cd) => cd.data());
        const activeCycle = cycles.find((c: any) => c.status === 'ACTIVE') || cycles[0];
        const activeCycleId = activeCycle?.billingCycleId || `bc_${Date.now()}`;

        // Re-read all updated expenses for the household
        const updatedExpSnap = await getDocs(collection(db, `households/${householdId}/expenses`));
        const allExpenses = updatedExpSnap.docs.map((ed) => ({ id: ed.id, ...(ed.data() as any) }));

        for (const member of activeMembers) {
          const uid = member.userId || member.memberId;
          const billId = `bill_${activeCycleId}_${uid}`;
          const billRef = doc(db, `households/${householdId}/memberBills`, billId);
          const existingSnap = await getDoc(billRef);
          const existing = existingSnap.exists() ? existingSnap.data() : null;
          const prevPaid = existing?.totalPaidCentavos || 0;

          // Build line items for this member from all current expenses
          const lineItems = allExpenses.map((exp: any) => {
            const isWater = (exp.category || '').toLowerCase().includes('water');
            const split = exp.splitDetails?.find((s: any) => s.userId === uid);
            const isPayor = isPayorMember(member);
            let share = 0;
            if (isPayor) {
              if (split && typeof split.shareCentavos === 'number') {
                share = split.shareCentavos;
              } else if (isWater) {
                if (waterConfig?.pricingModel === 'FIXED_PER_PERSON_MONTH') {
                  share = waterConfig.fixedPerPersonAmountCentavos || 0;
                } else {
                  share = Math.round(exp.amountCents / Math.max(1, effectivePayors.length));
                }
              } else {
                share = Math.round(exp.amountCents / Math.max(1, effectivePayors.length));
              }
            }
            const isExempt = !isPayor || Boolean(split?.isExempt);
            const isExpPaid = exp.status === 'PAID' || exp.isPaid;
            const daysPresent = split?.daysPresent ?? memberDaysMap.get(uid) ?? 0;

            return {
              itemId: exp.id,
              description: exp.title,
              category: exp.category,
              amountCentavos: share,
              createdDate: exp.createdAt || exp.createdDate || new Date().toISOString(),
              status: isExpPaid ? 'PAID' : 'UNPAID',
              note: split?.note || (isExempt ? 'Exempted (Non-payor)' : isWater ? `${daysPresent}d water attendance` : `Fair share among ${effectivePayors.length} payors`),
              isExempt,
            };
          });

          const unpaidLineItems = lineItems.filter((li: any) => li.status === 'UNPAID' && !li.isExempt);
          const newTotalDue = unpaidLineItems.reduce((sum: number, li: any) => sum + (li.amountCentavos || 0), 0);
          const newOutstanding = Math.max(0, newTotalDue - prevPaid);

          const billData = sanitizeData({
            billId,
            householdId,
            billingCycleId: activeCycleId,
            userId: uid,
            displayName: member.displayName || 'Roommate',
            totalDueCentavos: newTotalDue,
            outstandingCentavos: newOutstanding,
            totalPaidCentavos: prevPaid,
            lineItems,
            status: newOutstanding === 0 ? 'PAID' : 'UNPAID',
            updatedDate: new Date().toISOString(),
          });

          await setDoc(billRef, billData, { merge: true });
        }
      } catch (syncErr) {
        console.warn('[recalculateUnpaidExpensesForHousehold] memberBills sync warning:', syncErr);
      }

      return updatedCount;
    } catch (err) {
      console.error('[recalculateUnpaidExpensesForHousehold] Error:', err);
      return 0;
    }
  },

  async rejectJoinRequest(householdId: string, memberId: string, reason: string): Promise<boolean> {
    try {
      const nowIso = new Date().toISOString();
      const memRef = doc(db, `households/${householdId}/members`, memberId);
      await updateDoc(memRef, {
        status: 'REJECTED',
        rejectionReason: reason || 'Declined by host',
        rejectedDate: nowIso,
      });

      try {
        await updateDoc(doc(db, 'users', memberId), {
          joinRequestStatus: 'REJECTED',
          joinRejectionReason: reason || 'Declined by host',
          pendingHouseholdId: null,
          updatedDate: nowIso,
        });
      } catch (uErr) {
        console.warn('[rejectJoinRequest Mobile] User doc update deferred to client:', uErr);
      }
      return true;
    } catch (err) {
      console.error('[rejectJoinRequest Mobile] Error:', err);
      return false;
    }
  },

  async updateUserProfilePicture(uid: string, photoUrl: string, householdId?: string): Promise<boolean> {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        profilePicture: photoUrl,
        photoURL: photoUrl,
        updatedDate: new Date().toISOString(),
      }, { merge: true });
      if (_cachedUserProfile && _cachedUserProfile.uid === uid) {
        _cachedUserProfile.profilePicture = photoUrl;
        _cachedUserProfile.photoURL = photoUrl;
      }
      if (auth.currentUser && auth.currentUser.uid === uid) {
        await updateAuthProfile(auth.currentUser, { photoURL: photoUrl }).catch(() => {});
      }
      if (householdId) {
        const memRef1 = doc(db, `households/${householdId}/members`, uid);
        await setDoc(memRef1, {
          profilePicture: photoUrl,
          photoURL: photoUrl,
        }, { merge: true }).catch(() => {});
        const memRef2 = doc(db, `households/${householdId}/members`, `mem_${uid}`);
        await setDoc(memRef2, {
          profilePicture: photoUrl,
          photoURL: photoUrl,
        }, { merge: true }).catch(() => {});
      }
      return true;
    } catch (err) {
      console.error('[updateUserProfilePicture Mobile] Error:', err);
      return false;
    }
  },

  async updateHouseholdRates(householdId: string, rates: any) {
    const docRef = doc(db, 'households', householdId);
    await setDoc(docRef, { rates, updatedAt: new Date().toISOString() }, { merge: true });
  },

  // --- EXPENSES / BILLS ---
  async addExpense(expense: Omit<MobileExpense, 'id' | 'createdAt'>): Promise<string> {
    const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const ref = doc(db, `households/${expense.householdId}/expenses`, id);
    const status = expense.status || (expense.isPaid ? 'PAID' : 'UNPAID');
    const isPaid = status === 'PAID';

    // 1. Fetch active household members to calculate automatic splits
    let activeMembers: any[] = [];
    try {
      const memSnap = await getDocs(collection(db, `households/${expense.householdId}/members`));
      const allMem: any[] = [];
      memSnap.forEach((d) => allMem.push(d.data()));
      activeMembers = allMem.filter((m) => m.status === 'ACTIVE');
    } catch (err) {
      console.warn('[addExpense Mobile] Could not load members for split:', err);
    }

    if (activeMembers.length === 0) {
      activeMembers = [
        {
          userId: expense.payerId || auth.currentUser?.uid || 'host',
          displayName: expense.payerName || auth.currentUser?.displayName || 'Host',
          role: 'HOST',
        },
      ];
    }

    // 2. Compute split details across members (Fairly on Payors Only, Water absorption rule)
    const activePayors = activeMembers.filter((m) => isPayorMember(m));
    const activeNonPayors = activeMembers.filter((m) => !isPayorMember(m));
    const effectivePayors = activePayors.length > 0 ? activePayors : activeMembers;

    const isWater = (expense.category || '').toLowerCase().includes('water');

    let splitDetails: any[] = [];
    if (expense.splitDetails && Array.isArray(expense.splitDetails) && expense.splitDetails.length > 0) {
      splitDetails = expense.splitDetails;
    } else if (isWater) {
      // Water mode: 5/person/day attendance rule.
      // Payors pay their OWN water + water from non-payors. NEVER split other payors' water on this payor!
      let waterConfig: any = null;
      try {
        const wSnap = await getDoc(doc(db, 'households', expense.householdId, 'waterConfig', 'settings'));
        if (wSnap.exists()) waterConfig = wSnap.data();
      } catch {}

      const pricingModel = waterConfig?.pricingModel || 'PER_PERSON_DAY';
      if (pricingModel === 'PER_PERSON_DAY') {
        const rate = Number(waterConfig?.rateCentavosPerPersonPerDay ?? 500);
        let cycleId = expense.billingCycleId;
        let attRecords: any[] = [];
        let subRecords: any[] = [];
        if (cycleId) {
          try {
            const [attSnap, subSnap] = await Promise.all([
              getDocs(query(collection(db, `households/${expense.householdId}/waterAttendance`), where('billingCycleId', '==', cycleId))).catch(() => null),
              getDocs(query(collection(db, `households/${expense.householdId}/attendanceSubmissions`), where('billingCycleId', '==', cycleId))).catch(() => null),
            ]);
            if (attSnap) attRecords = attSnap.docs.map((d) => d.data());
            if (subSnap) subRecords = subSnap.docs.map((d) => d.data());
          } catch {}
        }
        let totalNonPayorWater = 0;
        const memberDaysMap = new Map<string, number>();
        for (const m of activeMembers) {
          const uid = m.userId || m.memberId;
          const present = attRecords.filter((a: any) => a.userId === uid && a.status === 'PRESENT').length;
          const sub = subRecords.find((s: any) => s.userId === uid);
          const days = present > 0 ? present : (sub?.daysPresent || 0);
          memberDaysMap.set(uid, days);
          const cost = days * rate;
          if (!isPayorMember(m)) totalNonPayorWater += cost;
        }
        const extraPerPayor = effectivePayors.length > 0 ? Math.round(totalNonPayorWater / effectivePayors.length) : 0;
        const nonPayorNames = activeNonPayors.map((np) => np.displayName || 'Non-payor').join(', ');

        splitDetails = activeMembers.map((m) => {
          const uid = m.userId || m.memberId;
          const isPayor = isPayorMember(m);
          const days = memberDaysMap.get(uid) || 0;
          if (isPayor) {
            const ownCost = days * rate;
            const payorTotal = ownCost + extraPerPayor;
            return {
              userId: uid,
              displayName: m.displayName || 'Roommate',
              shareCentavos: payorTotal,
              ownWaterCentavos: ownCost,
              nonPayorWaterCentavos: extraPerPayor,
              daysPresent: days,
              rateCentavosPerDay: rate,
              isPaid,
              isExempt: false,
              role: m.role || 'PAYOR',
              note: extraPerPayor > 0
                ? `${days} days @ ₱${rate / 100}/day (₱${(ownCost / 100).toFixed(2)}) + non-payor split (₱${(extraPerPayor / 100).toFixed(2)} from ${nonPayorNames})`
                : `${days} days present @ ₱${rate / 100}/day`,
            };
          } else {
            return {
              userId: uid,
              displayName: m.displayName || 'Roommate',
              shareCentavos: 0,
              ownWaterCentavos: 0,
              nonPayorWaterCentavos: 0,
              daysPresent: days,
              rateCentavosPerDay: rate,
              isPaid: true,
              isExempt: true,
              role: 'NON_PAYOR',
              note: `Exempted (Non-payor) — ${days} days water cost absorbed by payors`,
            };
          }
        });
      } else if (pricingModel === 'FIXED_PER_PERSON_MONTH') {
        const flatRate = waterConfig?.fixedPerPersonAmountCentavos || 0;
        splitDetails = activeMembers.map((m) => {
          const isPayor = isPayorMember(m);
          return {
            userId: m.userId || m.memberId,
            displayName: m.displayName || 'Roommate',
            shareCentavos: isPayor ? flatRate : 0,
            isPaid: !isPayor || isPaid,
            isExempt: !isPayor,
            role: m.role || (isPayor ? 'PAYOR' : 'NON_PAYOR'),
            note: isPayor ? `Flat rate water bill: ₱${(flatRate / 100).toFixed(2)}/mo` : 'Exempted (Non-payor)',
          };
        });
      } else {
        const shareCentavos = Math.round(expense.amountCents / effectivePayors.length);
        splitDetails = activeMembers.map((m) => {
          const isPayor = isPayorMember(m);
          return {
            userId: m.userId || m.memberId,
            displayName: m.displayName || 'Roommate',
            shareCentavos: isPayor ? shareCentavos : 0,
            isPaid: !isPayor || isPaid,
            isExempt: !isPayor,
            role: m.role || (isPayor ? 'PAYOR' : 'NON_PAYOR'),
            note: isPayor ? `Water bill split fairly across ${effectivePayors.length} payors` : 'Exempted (Non-payor)',
          };
        });
      }
    } else {
      // Standard Bills (Rent, Wifi, Groceries, Electricity, Other):
      // Fairly split ONLY on payors. Non-payors are 100% exempted.
      const payorCount = Math.max(1, effectivePayors.length);
      const shareCentavos = Math.round(expense.amountCents / payorCount);

      splitDetails = activeMembers.map((m) => {
        const isPayor = isPayorMember(m);
        if (isPayor) {
          return {
            userId: m.userId || m.memberId,
            displayName: m.displayName || 'Roommate',
            shareCentavos,
            percentage: Math.round((100 / payorCount) * 10) / 10,
            isPaid,
            isExempt: false,
            role: m.role || 'PAYOR',
            note: `Fair share among ${payorCount} payors (Non-payors exempt)`,
          };
        } else {
          return {
            userId: m.userId || m.memberId,
            displayName: m.displayName || 'Roommate',
            shareCentavos: 0,
            percentage: 0,
            isPaid: true,
            isExempt: true,
            role: 'NON_PAYOR',
            note: 'Exempted (Non-payor)',
          };
        }
      });
    }

    const splitsMap: Record<string, number> = {};
    splitDetails.forEach((s) => {
      if (s.userId) splitsMap[s.userId] = s.shareCentavos;
    });

    const payload: MobileExpense = {
      ...expense,
      status,
      isPaid,
      id,
      splitDetails,
      splits: splitsMap,
      createdAt: new Date().toISOString(),
    };
    await setDoc(ref, sanitizeData(payload));

    // 3. Resolve active billing cycle & update memberBills in Firestore
    try {
      let cycleId = expense.billingCycleId;
      if (!cycleId) {
        const cyclesSnap = await getDocs(collection(db, `households/${expense.householdId}/billingCycles`));
        const cycles = cyclesSnap.docs.map((d) => d.data());
        const active = cycles.find((c: any) => c.status === 'ACTIVE') || cycles[0];
        if (active) {
          cycleId = active.billingCycleId;
        } else {
          cycleId = `bc_${Date.now()}`;
          const now = new Date();
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const cycleName = `${monthNames[now.getMonth()]} ${now.getFullYear()} Billing`;
          await setDoc(doc(db, `households/${expense.householdId}/billingCycles`, cycleId), sanitizeData({
            billingCycleId: cycleId,
            householdId: expense.householdId,
            name: cycleName,
            startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
            endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
            status: 'ACTIVE',
            createdDate: new Date().toISOString(),
            updatedDate: new Date().toISOString(),
          }), { merge: true });
        }
      }

      if (cycleId) {
        for (const item of splitDetails) {
          const billId = `bill_${cycleId}_${item.userId}`;
          const billRef = doc(db, `households/${expense.householdId}/memberBills`, billId);
          const existingSnap = await getDoc(billRef);
          const existing = existingSnap.exists() ? existingSnap.data() : null;

          const lineItem = {
            itemId: id,
            description: expense.title,
            category: expense.category,
            amountCentavos: item.shareCentavos,
            createdDate: payload.createdAt,
            status,
            note: item.note || '',
            isExempt: Boolean(item.isExempt),
          };

          const existingLineItems = existing?.lineItems || [];
          const updatedLineItems = [...existingLineItems.filter((li: any) => li.itemId !== id), lineItem];
          const prevPaid = existing?.totalPaidCentavos || 0;
          // Calculate new total due accurately from unpaid line items
          const newTotalDue = updatedLineItems
            .filter((li: any) => li.status === 'UNPAID')
            .reduce((sum: number, li: any) => sum + (li.amountCentavos || 0), 0);
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
            status: newOutstanding === 0 ? 'PAID' : 'UNPAID',
            updatedDate: new Date().toISOString(),
          });

          await setDoc(billRef, billData, { merge: true });
        }
      }
    } catch (billErr) {
      console.warn('[Firestore Mobile] auto memberBills creation warning:', billErr);
    }

    // 4. Mirror to charges collection for instantaneous cross-platform Web sync
    try {
      const categoryUpper = (expense.category || '').toUpperCase();
      let chargeType = 'CUSTOM';
      if (categoryUpper.includes('RENT')) chargeType = 'RENT';
      else if (categoryUpper.includes('ELEC')) chargeType = 'ELECTRICITY';
      else if (categoryUpper.includes('WATER')) chargeType = 'WATER';
      else if (categoryUpper.includes('NET') || categoryUpper.includes('WIFI') || categoryUpper.includes('INTERNET')) chargeType = 'INTERNET';

      const chargeRef = doc(db, `households/${expense.householdId}/charges`, id);
      await setDoc(chargeRef, sanitizeData({
        chargeId: id,
        householdId: expense.householdId,
        billingCycleId: expense.billingCycleId || '',
        chargeType,
        name: expense.title,
        description: expense.notes || '',
        amountCentavos: expense.amountCents,
        distributionMethod: expense.splitMethod === '% Custom' ? 'CUSTOM' : 'PAYORS_ONLY',
        participantUserIds: splitDetails.filter((s) => !s.isExempt).map((s) => s.userId),
        splitDetails,
        createdDate: payload.createdAt,
        createdBy: expense.payerId || '',
      }), { merge: true });
    } catch (mirrorErr) {
      console.warn('[Firestore Mobile] mirror expense to charges failed:', mirrorErr);
    }

    return id;
  },

  async addBill(bill: Omit<MobileExpense, 'id' | 'createdAt'>): Promise<string> {
    return this.addExpense(bill);
  },

  listenToExpenses(householdId: string, callback: (expenses: MobileExpense[]) => void) {
    const q = collection(db, `households/${householdId}/expenses`);
    return onSnapshot(q, (snap) => {
      const items: MobileExpense[] = [];
      snap.forEach((d) => items.push(d.data() as MobileExpense));
      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    }, (err) => console.warn('[Firestore Mobile] listenToExpenses:', err));
  },

  async updateExpenseStatus(householdId: string, expenseId: string, isPaid: boolean): Promise<boolean> {
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
        status: isPaid ? 'PAID' : 'UNPAID',
        isPaid,
        ...(splitDetails ? { splitDetails } : {}),
        updatedDate: new Date().toISOString(),
      });
      // Synchronize unpaid expenses and member bills
      this.recalculateUnpaidExpensesForHousehold(householdId).catch(() => {});
      return true;
    } catch (err) {
      console.error('[updateExpenseStatus] Error:', err);
      return false;
    }
  },

  async createBillingCycle(householdId: string, cycleData: {
    name: string;
    startDate: string;
    endDate: string;
    status?: string;
  }): Promise<string> {
    const billingCycleId = `bc_${Date.now()}`;
    const ref = doc(db, `households/${householdId}/billingCycles`, billingCycleId);
    const newCycle = {
      billingCycleId,
      householdId,
      name: cycleData.name.trim(),
      startDate: cycleData.startDate,
      endDate: cycleData.endDate,
      status: cycleData.status || 'ACTIVE',
      totalBilledCentavos: 0,
      totalCollectedCentavos: 0,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    await setDoc(ref, sanitizeData(newCycle), { merge: true });
    return billingCycleId;
  },

  async updateBillingCycle(householdId: string, billingCycleId: string, updates: {
    name?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<void> {
    const ref = doc(db, `households/${householdId}/billingCycles`, billingCycleId);
    await setDoc(
      ref,
      sanitizeData({
        ...updates,
        updatedDate: new Date().toISOString(),
      }),
      { merge: true }
    );
  },

  async deleteBillingCycle(householdId: string, billingCycleId: string): Promise<void> {
    const ref = doc(db, `households/${householdId}/billingCycles`, billingCycleId);
    await deleteDoc(ref);
  },

  listenToBillingCycles(householdId: string, callback: (cycles: any[]) => void) {
    const q = collection(db, `households/${householdId}/billingCycles`);
    return onSnapshot(q, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => items.push(d.data()));
      items.sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
      callback(items);
    }, (err) => console.warn('[Firestore Mobile] listenToBillingCycles:', err));
  },

  listenToMemberBills(householdId: string, cycleId: string, callback: (bills: any[]) => void) {
    const q = query(
      collection(db, `households/${householdId}/memberBills`),
      where('billingCycleId', '==', cycleId)
    );
    return onSnapshot(
      q,
      (snap) => {
        const map = new Map<string, any>();
        snap.forEach((d) => {
          const data = d.data();
          const uid = data.userId || d.id;
          // Prefer bill_{cycleId}_{userId} format over direct userId doc to avoid double counting
          if (!map.has(uid) || d.id.startsWith('bill_')) {
            map.set(uid, data);
          }
        });
        callback(Array.from(map.values()));
      },
      (err) => console.warn('[Firestore Mobile] listenToMemberBills:', err)
    );
  },

  listenToWaterConfig(householdId: string, callback: (config: any | null) => void) {
    const defaultConfig = {
      pricingModel: 'PER_PERSON_DAY',
      rateCentavosPerPersonPerDay: 500,
      fixedMonthlyAmountCentavos: 0,
      fixedPerPersonAmountCentavos: 0,
      mode: 'BILLING_CYCLE',
    };
    if (!householdId) {
      callback(defaultConfig);
      return () => {};
    }
    const ref = doc(db, `households/${householdId}/systemSettings`, 'water');
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          callback({
            ...defaultConfig,
            ...data,
            pricingModel: data.pricingModel || (data.fixedMonthlyAmountCentavos ? 'FIXED_MONTHLY' : 'PER_PERSON_DAY'),
          });
        } else {
          callback(defaultConfig);
        }
      },
      (_err) => {
        callback(defaultConfig);
      }
    );
  },

  async saveWaterConfig(householdId: string, config: any): Promise<void> {
    if (!householdId) return;
    try {
      const ref = doc(db, `households/${householdId}/systemSettings`, 'water');
      const cleanConfig = sanitizeData({
        pricingModel: config.pricingModel || 'PER_PERSON_DAY',
        rateCentavosPerPersonPerDay: Number(config.rateCentavosPerPersonPerDay ?? 500),
        fixedMonthlyAmountCentavos: Number(config.fixedMonthlyAmountCentavos ?? 0),
        fixedPerPersonAmountCentavos: Number(config.fixedPerPersonAmountCentavos ?? 0),
        mode: config.mode || 'BILLING_CYCLE',
        updatedAt: new Date().toISOString(),
      });
      await setDoc(ref, cleanConfig, { merge: true });

      // Automatically sync water charge for the current cycle and recalculate member bills
      await this.syncCycleWaterBill(householdId);
      await this.recalculateUnpaidExpensesForHousehold(householdId);
    } catch (err) {
      console.error('[saveWaterConfig Mobile] Error:', err);
      throw err;
    }
  },

  /**
   * Generates or synchronizes the active billing cycle's Water line item
   * according to the household's configured water mode (PER_PERSON_DAY, FIXED_MONTHLY, or FIXED_PER_PERSON_MONTH).
   */
  async syncCycleWaterBill(householdId: string, billingCycleId?: string): Promise<string | null> {
    try {
      if (!householdId) return null;

      // 1. Resolve target billing cycle
      let targetCycle: any = null;
      const cyclesSnap = await getDocs(collection(db, `households/${householdId}/billingCycles`));
      const cycles = cyclesSnap.docs.map((cd) => cd.data());
      if (billingCycleId) {
        targetCycle = cycles.find((c: any) => c.billingCycleId === billingCycleId);
      }
      if (!targetCycle) {
        targetCycle = cycles.find((c: any) => c.status === 'ACTIVE') || cycles[0];
      }
      if (!targetCycle) {
        return null;
      }
      const cycleId = targetCycle.billingCycleId;

      // 2. Resolve members
      const memSnap = await getDocs(collection(db, `households/${householdId}/members`));
      const activeMembers = memSnap.docs
        .map((d) => d.data())
        .filter((m: any) => m.status === 'ACTIVE' || !m.status);
      if (activeMembers.length === 0) return null;

      const activePayors = activeMembers.filter((m) => isPayorMember(m));
      const activeNonPayors = activeMembers.filter((m) => !isPayorMember(m));
      const effectivePayors = activePayors.length > 0 ? activePayors : activeMembers;

      // 3. Resolve water configuration
      let waterConfig: any = { pricingModel: 'PER_PERSON_DAY', rateCentavosPerPersonPerDay: 500 };
      const waterRef = doc(db, `households/${householdId}/systemSettings`, 'water');
      const waterSnap = await getDoc(waterRef);
      if (waterSnap.exists()) {
        waterConfig = waterSnap.data();
      }

      const pricingModel =
        waterConfig.pricingModel ||
        (waterConfig.fixedMonthlyAmountCentavos ? 'FIXED_MONTHLY' : 'PER_PERSON_DAY');

      let billTitle = 'Water Attendance';
      let totalAmountCentavos = 0;
      let splitDetails: any[] = [];

      if (pricingModel === 'FIXED_PER_PERSON_MONTH') {
        const perPersonCentavos = Number(waterConfig.fixedPerPersonAmountCentavos || 0);
        totalAmountCentavos = perPersonCentavos * effectivePayors.length;
        billTitle = 'Water (Flat Per Person)';

        splitDetails = activeMembers.map((m: any) => {
          const isPayor = isPayorMember(m);
          if (isPayor) {
            return {
              userId: m.userId || m.memberId,
              displayName: m.displayName || 'Roommate',
              shareCentavos: perPersonCentavos,
              isPaid: false,
              isExempt: false,
              role: m.role || 'PAYOR',
              note: `Flat fee of ₱${(perPersonCentavos / 100).toFixed(2)}/resident/month`,
            };
          } else {
            return {
              userId: m.userId || m.memberId,
              displayName: m.displayName || 'Roommate',
              shareCentavos: 0,
              isPaid: true,
              isExempt: true,
              role: 'NON_PAYOR',
              note: 'Exempted (Non-payor)',
            };
          }
        });
      } else if (pricingModel === 'FIXED_MONTHLY') {
        totalAmountCentavos = Number(waterConfig.fixedMonthlyAmountCentavos || 0);
        billTitle = 'Water (Fixed Household)';
        const shareCentavos = effectivePayors.length > 0 ? Math.round(totalAmountCentavos / effectivePayors.length) : 0;

        splitDetails = activeMembers.map((m: any) => {
          const isPayor = isPayorMember(m);
          if (isPayor) {
            return {
              userId: m.userId || m.memberId,
              displayName: m.displayName || 'Roommate',
              shareCentavos,
              isPaid: false,
              isExempt: false,
              role: m.role || 'PAYOR',
              note: `Household water bill (₱${(totalAmountCentavos / 100).toFixed(2)}) split equally across ${effectivePayors.length} payors`,
            };
          } else {
            return {
              userId: m.userId || m.memberId,
              displayName: m.displayName || 'Roommate',
              shareCentavos: 0,
              isPaid: true,
              isExempt: true,
              role: 'NON_PAYOR',
              note: 'Exempted (Non-payor)',
            };
          }
        });
      } else {
        // Mode 1: PER_PERSON_DAY
        billTitle = 'Water Attendance';
        const rate = Number(waterConfig.rateCentavosPerPersonPerDay || 500);

        const [attSnap, subSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, `households/${householdId}/waterAttendance`),
              where('billingCycleId', '==', cycleId)
            )
          ).catch(() => null),
          getDocs(
            query(
              collection(db, `households/${householdId}/attendanceSubmissions`),
              where('billingCycleId', '==', cycleId)
            )
          ).catch(() => null),
        ]);
        const attRecords = attSnap ? attSnap.docs.map((d) => d.data()) : [];
        const subRecords = subSnap ? subSnap.docs.map((d) => d.data()) : [];

        let nonPayorTotalCentavos = 0;
        const payorIndividual = new Map<string, number>();
        const memberDaysMap = new Map<string, number>();

        for (const m of activeMembers) {
          const uid = m.userId || m.memberId;
          const presentCount = attRecords.filter((a: any) => a.userId === uid && a.status === 'PRESENT').length;
          const subRecord = subRecords.find((s: any) => s.userId === uid);
          const daysPresent = presentCount > 0 ? presentCount : (subRecord?.daysPresent || 0);
          memberDaysMap.set(uid, daysPresent);
          const cost = daysPresent * rate;

          if (isPayorMember(m)) {
            payorIndividual.set(uid, cost);
          } else {
            nonPayorTotalCentavos += cost;
          }
        }

        const extraPerPayor = effectivePayors.length > 0 ? Math.round(nonPayorTotalCentavos / effectivePayors.length) : 0;
        const nonPayorNames = activeNonPayors.map((np: any) => np.displayName || 'Non-payor').join(', ');

        splitDetails = activeMembers.map((m: any) => {
          const uid = m.userId || m.memberId;
          const isPayor = isPayorMember(m);
          const daysPresent = memberDaysMap.get(uid) || 0;
          if (isPayor) {
            const ownCost = payorIndividual.get(uid) || 0;
            const totalPayorShare = ownCost + extraPerPayor;
            totalAmountCentavos += totalPayorShare;
            return {
              userId: uid,
              displayName: m.displayName || 'Roommate',
              shareCentavos: totalPayorShare,
              ownWaterCentavos: ownCost,
              nonPayorWaterCentavos: extraPerPayor,
              daysPresent,
              rateCentavosPerDay: rate,
              isPaid: false,
              isExempt: false,
              role: m.role || 'PAYOR',
              note:
                extraPerPayor > 0
                  ? `${daysPresent} days @ ₱${rate / 100}/day (₱${(ownCost / 100).toFixed(2)}) + non-payor absorption (₱${(extraPerPayor / 100).toFixed(2)} from ${nonPayorNames})`
                  : `${daysPresent} days present @ ₱${rate / 100}/day`,
            };
          } else {
            return {
              userId: uid,
              displayName: m.displayName || 'Roommate',
              shareCentavos: 0,
              ownWaterCentavos: 0,
              nonPayorWaterCentavos: 0,
              daysPresent,
              rateCentavosPerDay: rate,
              isPaid: true,
              isExempt: true,
              role: 'NON_PAYOR',
              note: `Exempted (Non-payor) — ${daysPresent} days water cost absorbed by payors`,
            };
          }
        });
      }

      // Check if water expense already exists for this cycle
      const expSnap = await getDocs(collection(db, `households/${householdId}/expenses`));
      const existingWaterExp = expSnap.docs.find((ed) => {
        const data = ed.data();
        const cat = (data.category || '').toLowerCase();
        return (
          (data.billingCycleId === cycleId || ed.id.includes(cycleId)) &&
          (cat.includes('water') || ed.id.startsWith('water_'))
        );
      });

      const expenseId = existingWaterExp ? existingWaterExp.id : `water_bill_${cycleId}`;
      const splitsMap: Record<string, number> = {};
      splitDetails.forEach((s) => {
        if (s.userId) splitsMap[s.userId] = s.shareCentavos;
      });

      const expensePayload = sanitizeData({
        id: expenseId,
        householdId,
        title: billTitle,
        category: 'Water',
        amountCents: totalAmountCentavos,
        date: new Date().toISOString().slice(0, 10),
        payerName: 'Household',
        payerId: 'system',
        splitMethod:
          pricingModel === 'FIXED_PER_PERSON_MONTH'
            ? 'Flat Per Person'
            : pricingModel === 'FIXED_MONTHLY'
            ? 'Equal Split'
            : 'Daily Attendance',
        billingCycleId: cycleId,
        status: 'UNPAID',
        isPaid: false,
        splitDetails,
        splits: splitsMap,
        updatedAt: new Date().toISOString(),
      });

      await setDoc(doc(db, `households/${householdId}/expenses`, expenseId), expensePayload, { merge: true });

      // Mirror to charges
      await setDoc(
        doc(db, `households/${householdId}/charges`, expenseId),
        sanitizeData({
          chargeId: expenseId,
          householdId,
          billingCycleId: cycleId,
          chargeType: 'WATER',
          name: billTitle,
          amountCentavos: totalAmountCentavos,
          distributionMethod: 'PAYORS_ONLY',
          participantUserIds: splitDetails.filter((s) => !s.isExempt).map((s) => s.userId),
          splitDetails,
          createdDate: new Date().toISOString(),
          createdBy: 'system',
        }),
        { merge: true }
      );

      // Immediately refresh all member bills in Firestore
      this.recalculateUnpaidExpensesForHousehold(householdId).catch(() => {});

      return expenseId;
    } catch (err) {
      console.warn('[syncCycleWaterBill] error:', err);
      return null;
    }
  },

  // --- PAYMENTS ---
  async submitPayment(payment: Omit<MobilePayment, 'paymentId' | 'status' | 'createdDate' | 'paymentDate'>): Promise<string> {
    const submit = httpsCallable(functions, 'submitPayment');
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
    return serverPayment?.paymentId || '';
  },

  listenToPayments(householdId: string, callback: (payments: MobilePayment[]) => void) {
    const q = collection(db, `households/${householdId}/payments`);
    return onSnapshot(q, (snap) => {
      const items: MobilePayment[] = [];
      snap.forEach((d) => items.push(d.data() as MobilePayment));
      items.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
      callback(items);
    }, (err) => console.warn('[Firestore Mobile] listenToPayments:', err));
  },

  // --- WATER ATTENDANCE ---
  async toggleAttendance(householdId: string, cycleId: string, userId: string, date: string, status: 'PRESENT' | 'ABSENT'): Promise<void> {
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
        { merge: true }
      );
    } catch (err) {
      console.warn('[Firestore Mobile] toggleAttendance error:', err);
      throw err;
    }
  },

  async bulkToggleAttendance(
    householdId: string,
    cycleId: string,
    userId: string,
    entries: Array<{ date: string; status: 'PRESENT' | 'ABSENT' }>
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
          { merge: true }
        );
      }
      await batch.commit();
    } catch (err) {
      console.warn('[Firestore Mobile] bulkToggleAttendance error:', err);
      throw err;
    }
  },

  listenToAttendance(householdId: string, cycleId: string, userId: string, callback: (markedDates: Record<string, 'PRESENT' | 'ABSENT'>) => void) {
    const q = query(
      collection(db, `households/${householdId}/waterAttendance`),
      where('billingCycleId', '==', cycleId),
      where('userId', '==', userId)
    );
    return onSnapshot(q, (snap) => {
      const map: Record<string, 'PRESENT' | 'ABSENT'> = {};
      snap.forEach((d) => {
        const item = d.data();
        if (item.billingCycleId === cycleId && item.userId === userId) {
          map[item.date] = item.status;
        }
      });
      callback(map);
    }, (err) => console.warn('[Firestore Mobile] listenToAttendance:', err));
  },

  listenToHouseholdCycleAttendance(householdId: string, cycleId: string, callback: (records: any[]) => void) {
    if (!householdId || !cycleId) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, `households/${householdId}/waterAttendance`),
      where('billingCycleId', '==', cycleId)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push(d.data()));
        callback(list);
      },
      (err) => console.warn('[Firestore Mobile] listenToHouseholdCycleAttendance:', err)
    );
  },

  listenToAttendanceSubmissions(householdId: string, cycleId: string, callback: (submissions: Record<string, any>) => void) {
    if (!householdId || !cycleId) {
      callback({});
      return () => {};
    }
    const q = query(
      collection(db, `households/${householdId}/attendanceSubmissions`),
      where('billingCycleId', '==', cycleId)
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
      (err) => console.warn('[Firestore Mobile] listenToAttendanceSubmissions:', err)
    );
  },

  async submitAttendance(
    householdId: string,
    cycleId: string,
    userId: string,
    daysPresent: number,
    daysAbsent: number,
    amountCentavos: number
  ): Promise<void> {
    if (!householdId || !cycleId || !userId) return;
    try {
      const subId = `${cycleId}_${userId}`;
      const ref = doc(db, `households/${householdId}/attendanceSubmissions`, subId);
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
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );

      // Synchronize water bill in active cycle and update all member bills
      await this.syncCycleWaterBill(householdId, cycleId);
      await this.recalculateUnpaidExpensesForHousehold(householdId);
    } catch (err) {
      console.error('[submitAttendance Mobile] Error:', err);
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
};
