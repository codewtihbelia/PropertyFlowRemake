import { Payment, PaymentMethod } from "@propertyflow/shared";
import { getAppState, saveAppState } from "./store";
import { httpsCallable } from "firebase/functions";
import { functions, auth } from "../firebase/config";
import { firebaseDataService } from "./firebaseDataService";

export const paymentService = {
  getPayments(householdId: string, billingCycleId?: string): Payment[] {
    const list = getAppState().payments[householdId] || [];
    if (billingCycleId) {
      return list.filter((p) => p.billingCycleId === billingCycleId);
    }
    return list;
  },

  getUserPayments(householdId: string, userId: string): Payment[] {
    return (getAppState().payments[householdId] || []).filter(
      (p) => p.userId === userId,
    );
  },

  async submitPayment(
    householdId: string,
    billingCycleId: string,
    amountCentavos: number,
    paymentMethod: PaymentMethod,
    referenceNumber: string,
    proofOfPaymentUrl?: string,
    notes?: string,
  ): Promise<Payment> {
    try {
      const submit = httpsCallable(functions, "submitPayment");
      const result = await submit({
        householdId,
        billingCycleId,
        amountCentavos,
        paymentMethod,
        referenceNumber,
        proofOfPaymentUrl,
        notes,
      });
      const serverPayment = (result.data as { payment?: Payment }).payment;
      if (serverPayment) {
        return serverPayment;
      }
    } catch (funcErr) {
      console.warn(
        "[paymentService] Functions submit payment failed, saving directly to Firestore:",
        funcErr,
      );
    }

    // Direct Firestore fallback
    const paymentId = `pmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const fallbackPayment: Payment = {
      paymentId,
      householdId,
      billingCycleId,
      userId: auth.currentUser?.uid || "anonymous",
      userName: auth.currentUser?.displayName || "Resident",
      amountCentavos,
      paymentMethod,
      referenceNumber:
        referenceNumber || `REF-${Date.now().toString().slice(-6)}`,
      proofOfPaymentUrl: proofOfPaymentUrl || "",
      notes: notes || "",
      status: "VERIFIED",
      paymentDate: nowIso.slice(0, 10),
      createdDate: nowIso,
    };

    await firebaseDataService.savePayment(fallbackPayment);

    // Update local app state
    const s = getAppState();
    if (!s.payments[householdId]) {
      s.payments[householdId] = [];
    }
    s.payments[householdId] = [
      fallbackPayment,
      ...s.payments[householdId].filter((p) => p.paymentId !== paymentId),
    ];

    // Apply to member bill in store if available
    if (s.memberBills[householdId]) {
      s.memberBills[householdId] = s.memberBills[householdId].map((b) => {
        if (
          b.userId === fallbackPayment.userId &&
          b.billingCycleId === billingCycleId
        ) {
          const newPaid = b.paidCentavos + amountCentavos;
          const newOutstanding = Math.max(0, b.totalDueCentavos - newPaid);
          return {
            ...b,
            paidCentavos: newPaid,
            outstandingCentavos: newOutstanding,
            status: newOutstanding === 0 ? "PAID" : "PARTIALLY_PAID",
          };
        }
        return b;
      });
    }
    saveAppState(s);

    return fallbackPayment;
  },

  async verifyPayment(
    householdId: string,
    paymentId: string,
    approved: boolean,
    rejectionReason?: string,
  ) {
    try {
      const verify = httpsCallable(functions, "verifyPayment");
      await verify({ householdId, paymentId, approved, rejectionReason });
    } catch (funcErr) {
      console.warn(
        "[paymentService] Functions verify payment failed, updating local state:",
        funcErr,
      );
    }

    const s = getAppState();
    if (s.payments[householdId]) {
      s.payments[householdId] = s.payments[householdId].map((p) => {
        if (p.paymentId === paymentId) {
          return {
            ...p,
            status: approved ? "VERIFIED" : "REJECTED",
            rejectionReason: rejectionReason || undefined,
          };
        }
        return p;
      });
      saveAppState(s);
    }
    return (getAppState().payments[householdId] || []).find(
      (p) => p.paymentId === paymentId,
    );
  },
};
