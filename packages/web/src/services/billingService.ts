import {
  BillingCycle,
  Charge,
  ElectricityConfig,
  MemberBill,
  WaterConfig,
  calculateHouseholdBilling,
} from "@propertyflow/shared";
import { getAppState, saveAppState } from "./store";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase/config";
import { firebaseDataService } from "./firebaseDataService";

function actorId() {
  return auth.currentUser?.uid || getAppState().currentUserId;
}

export const billingService = {
  getBillingCycles(householdId: string): BillingCycle[] {
    return getAppState().billingCycles[householdId] || [];
  },

  createBillingCycle(
    householdId: string,
    cycle: Omit<BillingCycle, "billingCycleId" | "createdDate">,
  ): BillingCycle {
    const newCycle: BillingCycle = {
      ...cycle,
      billingCycleId: `cycle_${Date.now()}`,
      createdDate: new Date().toISOString(),
    };
    const s = getAppState();
    if (!s.billingCycles[householdId]) {
      s.billingCycles[householdId] = [];
    }
    s.billingCycles[householdId] = [
      ...s.billingCycles[householdId].filter(
        (c) => c.billingCycleId !== newCycle.billingCycleId,
      ),
      newCycle,
    ];
    saveAppState(s);

    void firebaseDataService.saveBillingCycle(newCycle);
    void firebaseDataService.saveAuditLog({
      logId: `log_${Date.now()}`,
      householdId,
      actorId: actorId(),
      actorName: auth.currentUser?.displayName || "Host",
      role: "HOST",
      action: "BILLING_CYCLE_CREATED",
      entity: "billingCycle",
      entityId: newCycle.billingCycleId,
      timestamp: new Date().toISOString(),
      newValue: {
        name: newCycle.name,
        startDate: newCycle.startDate,
        endDate: newCycle.endDate,
      },
    });
    return newCycle;
  },

  updateBillingCycle(householdId: string, updated: BillingCycle): BillingCycle {
    const s = getAppState();
    if (!s.billingCycles[householdId]) {
      s.billingCycles[householdId] = [];
    }
    s.billingCycles[householdId] = s.billingCycles[householdId].map((c) =>
      c.billingCycleId === updated.billingCycleId ? updated : c,
    );
    saveAppState(s);

    void firebaseDataService.saveBillingCycle(updated);
    void firebaseDataService.saveAuditLog({
      logId: `log_${Date.now()}`,
      householdId,
      actorId: actorId(),
      actorName: auth.currentUser?.displayName || "Host",
      role: "HOST",
      action: "BILLING_CYCLE_UPDATED",
      entity: "billingCycle",
      entityId: updated.billingCycleId,
      timestamp: new Date().toISOString(),
      newValue: {
        name: updated.name,
        startDate: updated.startDate,
        endDate: updated.endDate,
        status: updated.status,
      },
    });
    return updated;
  },

  async deleteBillingCycle(
    householdId: string,
    billingCycleId: string,
  ): Promise<void> {
    const s = getAppState();
    if (s.billingCycles[householdId]) {
      s.billingCycles[householdId] = s.billingCycles[householdId].filter(
        (c) => c.billingCycleId !== billingCycleId,
      );
      saveAppState(s);
    }

    await firebaseDataService.deleteBillingCycle(householdId, billingCycleId);
    void firebaseDataService.saveAuditLog({
      logId: `log_${Date.now()}`,
      householdId,
      actorId: actorId(),
      actorName: auth.currentUser?.displayName || "Host",
      role: "HOST",
      action: "BILLING_CYCLE_DELETED",
      entity: "billingCycle",
      entityId: billingCycleId,
      timestamp: new Date().toISOString(),
      newValue: { deleted: true },
    });
  },

  getCharges(householdId: string, billingCycleId: string): Charge[] {
    return (getAppState().charges[householdId] || []).filter(
      (c) => c.billingCycleId === billingCycleId,
    );
  },

  addCharge(
    householdId: string,
    charge: Omit<Charge, "chargeId" | "createdDate">,
  ): Charge {
    const newCharge: Charge = {
      ...charge,
      chargeId: `charge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdDate: new Date().toISOString(),
    };

    // Update local store immediately for instant UI responsiveness
    const s = getAppState();
    if (!s.charges[householdId]) s.charges[householdId] = [];
    s.charges[householdId] = [
      ...s.charges[householdId].filter(
        (c) => c.chargeId !== newCharge.chargeId,
      ),
      newCharge,
    ];
    saveAppState(s);

    void firebaseDataService.saveCharge(newCharge);
    void firebaseDataService.saveExpense(householdId, {
      id: newCharge.chargeId,
      householdId,
      title: newCharge.name,
      category: newCharge.chargeType,
      amountCents: newCharge.amountCentavos,
      date: new Date().toISOString().slice(0, 10),
      payerName: auth.currentUser?.displayName || "Host",
      payerId: actorId(),
      recordedBy: auth.currentUser?.displayName || "Host",
      status: "UNPAID",
      isPaid: false,
      splitMethod: newCharge.distributionMethod,
      notes: newCharge.description,
      createdAt: newCharge.createdDate,
      billingCycleId: newCharge.billingCycleId,
    });
    return newCharge;
  },

  async deleteCharge(householdId: string, chargeId: string): Promise<void> {
    const s = getAppState();
    if (s.charges[householdId]) {
      s.charges[householdId] = s.charges[householdId].filter(
        (c) => c.chargeId !== chargeId,
      );
      saveAppState(s);
    }
    await firebaseDataService.deleteCharge(householdId, chargeId);
  },

  getElectricityConfig(
    householdId: string,
    billingCycleId: string,
  ): ElectricityConfig | undefined {
    return getAppState().electricityConfigs[householdId]?.[billingCycleId];
  },

  saveElectricityConfig(
    householdId: string,
    billingCycleId: string,
    config: ElectricityConfig,
  ) {
    const s = getAppState();
    if (!s.electricityConfigs[householdId])
      s.electricityConfigs[householdId] = {};
    s.electricityConfigs[householdId][billingCycleId] = config;
    saveAppState(s);
    void firebaseDataService.saveElectricityConfig(
      householdId,
      billingCycleId,
      config,
    );
  },

  saveWaterConfig(householdId: string, config: WaterConfig) {
    const s = getAppState();
    s.waterConfigs[householdId] = config;
    saveAppState(s);
    void firebaseDataService.saveWaterConfig(householdId, config);
  },

  getMemberBills(householdId: string, billingCycleId: string): MemberBill[] {
    const s = getAppState();
    const stored = (s.memberBills[householdId] || []).filter(
      (b) => b.billingCycleId === billingCycleId,
    );
    if (stored.length > 0) return stored;

    // Dynamically calculate live preview bills if not yet finalized in Firestore
    const summary = this.calculateCurrentBilling(householdId, billingCycleId);
    return summary?.memberBills || [];
  },

  calculateCurrentBilling(
    householdId: string,
    billingCycleId: string,
    fallbackCycle?: BillingCycle,
  ) {
    const state = getAppState();
    let cycle = (state.billingCycles[householdId] || []).find(
      (c) => c.billingCycleId === billingCycleId,
    );
    if (
      !cycle &&
      fallbackCycle &&
      fallbackCycle.billingCycleId === billingCycleId
    ) {
      cycle = fallbackCycle;
      if (!state.billingCycles[householdId])
        state.billingCycles[householdId] = [];
      state.billingCycles[householdId].push(fallbackCycle);
      saveAppState(state);
    }
    if (!cycle) {
      console.warn(
        `[BillingService] calculateCurrentBilling: Cycle '${billingCycleId}' not found yet.`,
      );
      return null;
    }

    const members = (state.members[householdId] || []).map((m) => ({
      ...m,
      userId: m.userId || m.memberId || "",
      status: m.status || "ACTIVE",
    }));

    return calculateHouseholdBilling({
      billingCycle: cycle,
      members,
      charges: (state.charges[householdId] || []).filter(
        (c) => c.billingCycleId === billingCycleId,
      ),
      electricityConfig:
        state.electricityConfigs[householdId]?.[billingCycleId],
      waterConfig: state.waterConfigs[householdId],
      waterAttendance: (state.waterAttendance[householdId] || []).filter(
        (a) => a.billingCycleId === billingCycleId,
      ),
    });
  },

  async finalizeBillingCycle(householdId: string, billingCycleId: string) {
    const finalize = httpsCallable(functions, "finalizeBillingCycle");
    await finalize({ householdId, billingCycleId });
    return this.calculateCurrentBilling(householdId, billingCycleId);
  },

  async redistributeOutstandingBalance(
    householdId: string,
    billingCycleId: string,
    sourceUserId: string,
    recipientUserIds: string[],
    reason: string,
  ) {
    const redistribute = httpsCallable(functions, "redistributeBalance");
    const result = await redistribute({
      householdId,
      billingCycleId,
      sourceUserId,
      recipientUserIds,
      reason,
    });
    return result.data as { plan?: unknown; adjustmentId?: string };
  },
};
