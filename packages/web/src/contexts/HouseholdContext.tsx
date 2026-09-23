import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doc, setDoc } from "firebase/firestore";
import { BillingCycle, Household, HouseholdMember } from "@propertyflow/shared";
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
  ) => Promise<{ success: boolean; error?: string }>;
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

    // Safety timeout so UI never hangs in loading state
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    const unsubscribeHousehold = firebaseDataService.listenToHousehold(
      householdId,
      (nextHousehold) => {
        clearTimeout(safetyTimer);
        setLoading(false);
        if (!nextHousehold) {
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
        }
      },
    );
    const unsubscribeMembers = firebaseDataService.listenToMembers(
      householdId,
      (m) => {
        setMembers(m);
        const s = getAppState();
        s.members[householdId] = m;
        saveAppState(s);
      },
    );
    const unsubscribeCycles = firebaseDataService.listenToBillingCycles(
      householdId,
      (cycles) => {
        setBillingCycles(cycles);
        const s = getAppState();
        s.billingCycles[householdId] = cycles;
        saveAppState(s);
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

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeHousehold();
      unsubscribeMembers();
      unsubscribeCycles();
      unsubscribeCharges();
      unsubscribeExpenses();
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
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser.uid) {
      return { success: false, error: "Please sign in first." };
    }
    const res = await firebaseDataService.joinHouseholdByCode(codeOrId, {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.fullName,
      email: currentUser.email,
    });
    if (res.success && res.household) {
      setHousehold(res.household);
      await updateProfile({
        householdId: res.household.householdId,
        householdName: res.household.householdName,
        apartmentName: res.household.apartmentName,
        role: "PAYOR",
      });
      return { success: true };
    }
    return { success: false, error: res.error || "Failed to join group." };
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
        updateHousehold,
        inviteMember,
        changeMemberRole,
        deactivateMember,
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
