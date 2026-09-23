import { splitCentavosEvenly } from '../math/splitter';
import { Adjustment, AdjustmentAllocation, MemberBill } from '../types';

export interface RedistributionPlan {
  originalBillCentavos: number;
  paidCentavos: number;
  outstandingCentavos: number;
  sourceUserId: string;
  sourceUserName: string;
  recipientUserIds: string[];
  allocations: AdjustmentAllocation[];
  totalRedistributedCentavos: number;
}

export function calculateRedistributionPlan(
  sourceBill: MemberBill,
  recipients: Array<{ userId: string; userName: string }>,
  reason?: string
): RedistributionPlan {
  const outstanding = sourceBill.outstandingCentavos;
  const recipientIds = recipients.map((r) => r.userId);
  const recipientNameMap = new Map<string, string>(recipients.map((r) => [r.userId, r.userName]));

  const splitResults = splitCentavosEvenly(outstanding, recipientIds);

  const allocations: AdjustmentAllocation[] = splitResults.map((res) => ({
    userId: res.userId,
    userName: recipientNameMap.get(res.userId) || 'Resident',
    amountCentavos: res.amountCentavos,
  }));

  const totalRedistributed = allocations.reduce((sum, a) => sum + a.amountCentavos, 0);

  return {
    originalBillCentavos: sourceBill.totalDueCentavos,
    paidCentavos: sourceBill.paidCentavos,
    outstandingCentavos: outstanding,
    sourceUserId: sourceBill.userId,
    sourceUserName: sourceBill.userName,
    recipientUserIds: recipientIds,
    allocations,
    totalRedistributedCentavos: totalRedistributed,
  };
}

export function createAdjustmentRecord(
  plan: RedistributionPlan,
  householdId: string,
  billingCycleId: string,
  createdBy: string,
  customReason?: string
): Adjustment {
  return {
    adjustmentId: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    householdId,
    billingCycleId,
    type: 'BALANCE_REDISTRIBUTION',
    amountCentavos: plan.totalRedistributedCentavos,
    sourceUserId: plan.sourceUserId,
    sourceUserName: plan.sourceUserName,
    reason:
      customReason ||
      `Redistribution of unpaid balance (₱${plan.outstandingCentavos / 100}) from ${plan.sourceUserName}`,
    allocations: plan.allocations,
    createdBy,
    createdDate: new Date().toISOString(),
  };
}

