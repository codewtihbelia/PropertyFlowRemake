import { Payment, PaymentMethod } from '@propertyflow/shared';
import { getAppState } from './store';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

export const paymentService = {
  getPayments(householdId: string, billingCycleId?: string): Payment[] {
    const list = getAppState().payments[householdId] || [];
    if (billingCycleId) {
      return list.filter((p) => p.billingCycleId === billingCycleId);
    }
    return list;
  },

  getUserPayments(householdId: string, userId: string): Payment[] {
    return (getAppState().payments[householdId] || []).filter((p) => p.userId === userId);
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
    const submit = httpsCallable(functions, 'submitPayment');
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
    if (!serverPayment) {
      throw new Error('Payment was not saved to the cloud.');
    }
    return serverPayment;
  },

  async verifyPayment(
    householdId: string,
    paymentId: string,
    approved: boolean,
    rejectionReason?: string,
  ) {
    const verify = httpsCallable(functions, 'verifyPayment');
    await verify({ householdId, paymentId, approved, rejectionReason });
    return (getAppState().payments[householdId] || []).find((p) => p.paymentId === paymentId);
  },
};
