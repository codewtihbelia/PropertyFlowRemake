"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRedistributionPlan = calculateRedistributionPlan;
exports.createAdjustmentRecord = createAdjustmentRecord;
const splitter_1 = require("../math/splitter");
function calculateRedistributionPlan(sourceBill, recipients, reason) {
    const outstanding = sourceBill.outstandingCentavos;
    const recipientIds = recipients.map((r) => r.userId);
    const recipientNameMap = new Map(recipients.map((r) => [r.userId, r.userName]));
    const splitResults = (0, splitter_1.splitCentavosEvenly)(outstanding, recipientIds);
    const allocations = splitResults.map((res) => ({
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
function createAdjustmentRecord(plan, householdId, billingCycleId, createdBy, customReason) {
    return {
        adjustmentId: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        householdId,
        billingCycleId,
        type: 'BALANCE_REDISTRIBUTION',
        amountCentavos: plan.totalRedistributedCentavos,
        sourceUserId: plan.sourceUserId,
        sourceUserName: plan.sourceUserName,
        reason: customReason ||
            `Redistribution of unpaid balance (₱${plan.outstandingCentavos / 100}) from ${plan.sourceUserName}`,
        allocations: plan.allocations,
        createdBy,
        createdDate: new Date().toISOString(),
    };
}
