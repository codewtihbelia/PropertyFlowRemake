import { BillingCycle, Charge, ElectricityConfig, HouseholdMember, MemberBill, WaterAttendanceRecord, WaterConfig } from '../types';
export interface BillingEngineInput {
    billingCycle: BillingCycle;
    members: HouseholdMember[];
    charges: Charge[];
    electricityConfig?: ElectricityConfig;
    waterConfig?: WaterConfig;
    waterAttendance: WaterAttendanceRecord[];
    existingAdjustments?: Array<{
        userId: string;
        amountCentavos: number;
        reason: string;
    }>;
}
export interface HouseholdBillingSummary {
    rentTotalCentavos: number;
    internetTotalCentavos: number;
    electricityTotalCentavos: number;
    waterTotalCentavos: number;
    customChargesTotalCentavos: number;
    adjustmentsTotalCentavos: number;
    grandTotalCentavos: number;
    memberBills: MemberBill[];
}
export declare function calculateHouseholdBilling(input: BillingEngineInput): HouseholdBillingSummary;
