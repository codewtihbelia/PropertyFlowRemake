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
export declare function calculateRedistributionPlan(sourceBill: MemberBill, recipients: Array<{
    userId: string;
    userName: string;
}>, reason?: string): RedistributionPlan;
export declare function createAdjustmentRecord(plan: RedistributionPlan, householdId: string, billingCycleId: string, createdBy: string, customReason?: string): Adjustment;
