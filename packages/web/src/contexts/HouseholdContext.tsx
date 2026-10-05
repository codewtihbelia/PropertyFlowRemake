import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  BillingCycle,
  Charge,
  Household,
  HouseholdMember,
} from "@propertyflow/shared";
import { db } from "../firebase/config";
import { firebaseDataService } from "../services/firebaseDataService";
import { getAppState, saveAppState } from "../services/store";
import { useAuth } from "./AuthContext";

interface HouseholdContextType {
  household: Household;
  loading: boolean;
  members: HouseholdMember[];
  billingCycles: BillingCycle[];
  activeCycle?: BillingCycle;
  createHousehold: (data: {
    householdName: string;
    apartmentName?: string;
    address?: string;
    description?: string;
  }) => Promise<string>;
  joinHousehold: (
    codeOrId: string,
  ) => Promise<{ success: boolean; isPending?: boolean; error?: string }>;
  joinHouseholdByCode?: (
    codeOrId: string,
  ) => Promise<{ success: boolean; isPending?: boolean; error?: string }>;
  updateHousehold: (updates: Partial<Household>) => Promise<void>;
  inviteMember: (
    email: string,
    role: HouseholdMember["role"],
    displayName: string,
  ) => Promise<void>;
  changeMemberRole: (
    memberId: string,
    newRole: HouseholdMember["role"],
  ) => Promise<void>;
  deactivateMember: (memberId: string) => Promise<void>;
  approveJoinRequest: (memberId: string) => Promise<boolean>;
  rejectJoinRequest: (memberId: string, reason: string) => Promise<boolean>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(
  undefined,
);

const makeEmptyHousehold = (householdId = ""): Household => ({
  householdId,
  householdName: householdId ? "Household" : "No household connected",
  apartmentName: "",
  address: "",
  hostId: "",
  status: "ACTIVE",
  createdDate: "",
  updatedDate: "",
});

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentUser, updateProfile, loading: authLoading } = useAuth();
  const householdId = currentUser.householdId || "";
  const [household, setHousehold] = useState<Household>(
    makeEmptyHousehold(householdId),
  );
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [billingCycles, setBillingCycles] = useState<BillingCycle[]>([]);
  const [loading, setLoading] = useState<boolean>(
    Boolean(householdId) || authLoading,
  );

  // Real-time listener for join request approval / rejection
  useEffect(() => {
    if (
      !currentUser.uid ||
      currentUser.joinRequestStatus !== "PENDING" ||
      !currentUser.pendingHouseholdId
    ) {
      return;
    }
    const memRef = doc(
      db,
      `households/${currentUser.pendingHouseholdId}/members`,
      currentUser.uid,
    );
    const unsub = onSnapshot(memRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === "ACTIVE") {
          updateProfile({
            householdId: currentUser.pendingHouseholdId,
            joinRequestStatus: "APPROVED",
            pendingHouseholdId: undefined,
            householdName: data.householdName || undefined,
          }).catch(() => {});
        } else if (data.status === "REJECTED") {
          updateProfile({
            joinRequestStatus: "REJECTED",
            joinRejectionReason: data.rejectionReason || "Declined by host",
            pendingHouseholdId: undefined,
          }).catch(() => {});
        }
      }
    });
    return () => unsub();
  }, [
    currentUser.uid,
    currentUser.joinRequestStatus,
    currentUser.pendingHouseholdId,
  ]);

  useEffect(() => {
    if (authLoading) return;
    if (!householdId) {
      setHousehold(makeEmptyHousehold());
      setMembers([]);
      setBillingCycles([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const initialLoadTracker = {
      household: false,
      members: false,
      cycles: false,
    };

    const checkComplete = () => {
      if (
        initialLoadTracker.household &&
        initialLoadTracker.members &&
        initialLoadTracker.cycles
      ) {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    };

    // Safety timeout so UI never hangs indefinitely in loading state
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const unsubscribeHousehold = firebaseDataService.listenToHousehold(
      householdId,
      (nextHousehold) => {
        initialLoadTracker.household = true;
        if (!nextHousehold) {
          clearTimeout(safetyTimer);
          setLoading(false);
          setHousehold(makeEmptyHousehold(""));
          setMembers([]);
          setBillingCycles([]);
          if (currentUser.uid) {
            updateProfile({
              householdId: undefined,
              householdName: undefined,
              apartmentName: undefined,
            }).catch(() => {});
          }
        } else {
          setHousehold(nextHousehold);
          if (
            nextHousehold.hostId === currentUser.uid &&
            currentUser.role !== "HOST" &&
            currentUser.role !== "SUPER_ADMIN"
          ) {
            updateProfile({ role: "HOST" }).catch(() => {});
          }
          checkComplete();
        }
      },
    );
    const unsubscribeMembers = firebaseDataService.listenToMembers(
      householdId,
      (m) => {
        initialLoadTracker.members = true;
        setMembers(m);
        const s = getAppState();
        s.members[householdId] = m;
        saveAppState(s);
        const myMem = m.find(
          (mem) =>
            mem.userId === currentUser.uid ||
            mem.memberId === currentUser.uid ||
            mem.memberId === `mem_${currentUser.uid}`,
        );
        if (
          myMem &&
          myMem.role === "HOST" &&
          currentUser.role !== "HOST" &&
          currentUser.role !== "SUPER_ADMIN"
        ) {
          updateProfile({ role: "HOST" }).catch(() => {});
        }
        checkComplete();
      },
    );
    const unsubscribeCycles = firebaseDataService.listenToBillingCycles(
      householdId,
      (cycles) => {
        initialLoadTracker.cycles = true;
        setBillingCycles(cycles);
        const s = getAppState();
        s.billingCycles[householdId] = cycles;
        saveAppState(s);
        checkComplete();
      },
    );

    let latestCharges: Charge[] = [];
    let latestExpenses: Record<string, unknown>[] = [];

    const syncChargesToStore = () => {
      const chargeMap = new Map<string, Charge>();
      // 1. Add direct charges
      for (const c of latestCharges) {
        chargeMap.set(c.chargeId, c);
      }
      // 2. Merge expenses added from mobile or web
      for (const exp of latestExpenses) {
        const id = String(exp.id || exp.chargeId || exp.expenseId || "");
        if (!id) continue;
        if (!chargeMap.has(id)) {
          const cat = String(exp.category || "").toUpperCase();
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

          chargeMap.set(id, {
            chargeId: id,
            householdId,
            billingCycleId: String(exp.billingCycleId || ""),
            chargeType,
            name: String(exp.title || exp.name || "Expense"),
            description: String(exp.notes || exp.description || ""),
            amountCentavos: Number(exp.amountCents || exp.amountCentavos || 0),
            distributionMethod: "PAYORS_ONLY",
            participantUserIds: [],
            createdDate: String(
              exp.createdAt || exp.createdDate || new Date().toISOString(),
            ),
            createdBy: String(exp.payerId || ""),
          });
        }
      }

      const merged = Array.from(chargeMap.values());
      const s = getAppState();
      s.charges[householdId] = merged;
      saveAppState(s);
    };

    const unsubscribeCharges = firebaseDataService.listenToCharges(
      householdId,
      (c) => {
        latestCharges = c;
        syncChargesToStore();
      },
    );

    const unsubscribeExpenses = firebaseDataService.listenToExpenses(
      householdId,
      (exp) => {
        latestExpenses = exp;
        syncChargesToStore();
      },
    );

    const unsubscribeWaterAttendance =
      firebaseDataService.listenToWaterAttendance(householdId, (att) => {
        const s = getAppState();
        s.waterAttendance[householdId] = att;
        saveAppState(s);
      });

    const unsubscribeWaterConfig = firebaseDataService.listenToWaterConfig(
      householdId,
      (wc) => {
        if (wc) {
          const s = getAppState();
          s.waterConfigs[householdId] = wc;
          saveAppState(s);
        }
      },
    );

    const unsubscribeElectricityConfigs =
      firebaseDataService.listenToElectricityConfigs(householdId, (configs) => {
        const s = getAppState();
        s.electricityConfigs[householdId] = configs;
        saveAppState(s);
      });

    const unsubscribeMemberBills = firebaseDataService.listenToMemberBills(
      householdId,
      (bills) => {
        const s = getAppState();
        s.memberBills[householdId] = bills;
        saveAppState(s);
      },
    );

    const unsubscribePayments = firebaseDataService.listenToPayments(
      householdId,
      (pmts) => {
        const s = getAppState();
        s.payments[householdId] = pmts;
        saveAppState(s);
      },
    );

    const unsubscribeAdjustments = firebaseDataService.listenToAdjustments(
      householdId,
      (adjs) => {
        const s = getAppState();
        s.adjustments[householdId] = adjs;
        saveAppState(s);
      },
    );

    const unsubscribeAnnouncements = firebaseDataService.listenToAnnouncements(
      householdId,
      (anns) => {
        const s = getAppState();
        s.announcements[householdId] = anns;
        saveAppState(s);
      },
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeHousehold();
      unsubscribeMembers();
      unsubscribeCycles();
      unsubscribeCharges();
      unsubscribeExpenses();
      unsubscribeWaterAttendance();
      unsubscribeWaterConfig();
      unsubscribeElectricityConfigs();
      unsubscribeMemberBills();
      unsubscribePayments();
      unsubscribeAdjustments();
      unsubscribeAnnouncements();
    };
  }, [householdId, authLoading, currentUser.uid]);

  const activeCycle = useMemo(
    () =>
      billingCycles.find(
        (c) => c.status === "ACTIVE" || c.status === "FINALIZED",
      ) || billingCycles[0],
    [billingCycles],
  );

  const createHousehold = async (data: {
    householdName: string;
    apartmentName?: string;
    address?: string;
    description?: string;
  }): Promise<string> => {
    if (!currentUser.uid)
      throw new Error("You must be signed in to create a room.");

    const newHouseholdId = `hh_${Date.now()}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const inviteCode = `PF-${Math.floor(100 + Math.random() * 900)}`;

    const newHousehold: Household = {
      householdId: newHouseholdId,
      householdName: data.householdName.trim(),
      apartmentName: data.apartmentName?.trim() || "",
      address: data.address?.trim() || "",
      description: data.description?.trim() || "",
      hostId: currentUser.uid,
      inviteCode,
      status: "ACTIVE",
      createdDate: nowIso,
      updatedDate: nowIso,
    };

    // 1. Save new household record
    await firebaseDataService.saveHousehold(newHousehold);

    // 2. Register current user as the Host member
    const hostMember: HouseholdMember = {
      memberId: `mem_${currentUser.uid}`,
      userId: currentUser.uid,
      householdId: newHouseholdId,
      role: "HOST",
      displayName: currentUser.displayName || currentUser.fullName || "Host",
      email: currentUser.email || "",
      profilePicture: currentUser.profilePicture,
      status: "ACTIVE",
      joinedDate: nowIso.split("T")[0],
      notes: "Household Creator & Host",
    };
    await firebaseDataService.saveMember(newHouseholdId, hostMember);

    // 3. Create initial active billing cycle for this room
    const cycleStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const cycleEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    ).toISOString();
    const billingCycleId = `bc_${Date.now()}`;
    const initialCycle: BillingCycle = {
      billingCycleId,
      householdId: newHouseholdId,
      name: `${now.toLocaleString("default", { month: "short" })} ${now.getFullYear()} Cycle`,
      startDate: cycleStart,
      endDate: cycleEnd,
      status: "ACTIVE",
      createdBy: currentUser.uid,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(),
      cutoffDate: cycleEnd,
      totalBilledCentavos: 0,
      totalCollectedCentavos: 0,
      createdDate: nowIso,
    };
    await firebaseDataService.saveBillingCycle(initialCycle);

    // 4. Update the user profile with householdId and ensure role is HOST
    await updateProfile({
      householdId: newHouseholdId,
      householdName: newHousehold.householdName,
      apartmentName: newHousehold.apartmentName,
      role: "HOST",
    });

    setHousehold(newHousehold);
    setMembers([hostMember]);
    setBillingCycles([initialCycle]);

    return newHouseholdId;
  };

  const joinHousehold = async (
    codeOrId: string,
  ): Promise<{ success: boolean; isPending?: boolean; error?: string }> => {
    if (!currentUser.uid) {
      return { success: false, error: "Please sign in first." };
    }
    const res = await firebaseDataService.joinHouseholdByCode(codeOrId, {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.fullName,
      email: currentUser.email,
    });
    if (res.success && res.household) {
      await updateProfile({
        pendingHouseholdId: res.household.householdId,
        pendingHouseholdName:
          res.household.householdName || res.household.apartmentName,
        joinRequestStatus: "PENDING",
        joinRejectionReason: undefined,
      });
      return { success: true, isPending: true };
    }
    return {
      success: false,
      error: res.error || "Failed to send join request.",
    };
  };

  const approveJoinRequest = async (memberId: string): Promise<boolean> => {
    if (!householdId) return false;
    const ok = await firebaseDataService.approveJoinRequest(
      householdId,
      memberId,
    );
    if (ok) {
      setMembers((prev) =>
        prev.map((m) =>
          m.memberId === memberId ? { ...m, status: "ACTIVE" } : m,
        ),
      );
    }
    return ok;
  };

  const rejectJoinRequest = async (
    memberId: string,
    reason: string,
  ): Promise<boolean> => {
    if (!householdId) return false;
    const ok = await firebaseDataService.rejectJoinRequest(
      householdId,
      memberId,
      reason,
    );
    if (ok) {
      setMembers((prev) =>
        prev.map((m) =>
          m.memberId === memberId
            ? { ...m, status: "REJECTED", rejectionReason: reason }
            : m,
        ),
      );
    }
    return ok;
  };

  const updateHousehold = async (updates: Partial<Household>) => {
    if (!householdId) return;
    await firebaseDataService.saveHousehold({
      ...household,
      ...updates,
      householdId,
      updatedDate: new Date().toISOString(),
    });
  };

  const inviteMember = async (
    email: string,
    role: HouseholdMember["role"],
    displayName: string,
  ) => {
    if (!householdId) return;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();
    const invitationId = `inv_${Date.now()}`;
    const memberId = `mem_${Date.now()}`;

    // 1. Create invitation record
    await setDoc(doc(db, "invitations", invitationId), {
      invitationId,
      householdId,
      householdName: household.householdName,
      invitedEmail: trimmedEmail,
      assignedRole: role,
      invitedBy: currentUser.uid,
      displayName: trimmedName,
      createdDate: new Date().toISOString(),
      expirationDate: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      status: "PENDING",
    });

    // 2. Add to household members immediately so the host can view, manage, and assign bills to them
    const newMember: HouseholdMember = {
      memberId,
      userId: "",
      householdId,
      role,
      displayName: trimmedName,
      email: trimmedEmail,
      status: "ACTIVE",
      joinedDate: new Date().toISOString().split("T")[0],
      notes: "Invited roommate",
    };
    await firebaseDataService.saveMember(householdId, newMember);
  };

  const changeMemberRole = async (
    memberId: string,
    newRole: HouseholdMember["role"],
  ) => {
    if (!householdId) return;
    const member = members.find((m) => m.memberId === memberId);
    if (!member) return;

    await firebaseDataService.saveMember(householdId, {
      ...member,
      role: newRole,
    });
    await firebaseDataService.saveUserProfile({
      uid: member.userId,
      role: newRole,
    });
  };

  const deactivateMember = async (memberId: string) => {
    if (!householdId) return;
    const member = members.find((m) => m.memberId === memberId);
    if (!member) return;

    await firebaseDataService.saveMember(householdId, {
      ...member,
      status: "INACTIVE",
    });
    await firebaseDataService.saveUserProfile({
      uid: member.userId,
      accountStatus: "INACTIVE",
    });
  };

  return (
    <HouseholdContext.Provider
      value={{
        household,
        loading,
        members,
        billingCycles,
        activeCycle,
        createHousehold,
        joinHousehold,
        joinHouseholdByCode: joinHousehold,
        updateHousehold,
        inviteMember,
        changeMemberRole,
        deactivateMember,
        approveJoinRequest,
        rejectJoinRequest,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
};

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context)
    throw new Error("useHousehold must be used within a HouseholdProvider");
  return context;
}
