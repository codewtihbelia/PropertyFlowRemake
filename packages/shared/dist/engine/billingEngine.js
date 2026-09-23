"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateHouseholdBilling = calculateHouseholdBilling;
const splitter_1 = require("../math/splitter");
const constants_1 = require("../constants");
function calculateHouseholdBilling(input) {
    const { billingCycle, members, charges, electricityConfig, waterConfig, waterAttendance, existingAdjustments = [], } = input;
    const activeMembers = members.filter((m) => m.status === 'ACTIVE');
    const memberMap = new Map(members.map((m) => [m.userId, m]));
    // Track member aggregates
    const memberRent = new Map();
    const memberInternet = new Map();
    const memberElectricity = new Map();
    const memberWater = new Map();
    const memberCustom = new Map();
    const memberAdjustments = new Map();
    const memberItems = new Map();
    const memberWaterDays = new Map();
    for (const m of members) {
        memberRent.set(m.userId, 0);
        memberInternet.set(m.userId, 0);
        memberElectricity.set(m.userId, 0);
        memberWater.set(m.userId, 0);
        memberCustom.set(m.userId, 0);
        memberAdjustments.set(m.userId, 0);
        memberItems.set(m.userId, []);
        memberWaterDays.set(m.userId, 0);
    }
    let rentTotalCentavos = 0;
    let internetTotalCentavos = 0;
    let electricityTotalCentavos = 0;
    let waterTotalCentavos = 0;
    let customChargesTotalCentavos = 0;
    let adjustmentsTotalCentavos = 0;
    // Helper to resolve participants based on method
    const resolveParticipants = (charge) => {
        switch (charge.distributionMethod) {
            case 'ALL_MEMBERS':
                return activeMembers.map((m) => m.userId);
            case 'PAYORS_ONLY':
                return activeMembers.filter((m) => m.role === 'PAYOR').map((m) => m.userId);
            case 'SELECTED_MEMBERS':
            case 'EQUAL_SPLIT':
            default:
                return charge.participantUserIds && charge.participantUserIds.length > 0
                    ? charge.participantUserIds
                    : activeMembers.filter((m) => m.role === 'PAYOR').map((m) => m.userId);
        }
    };
    // 1. Process Charges (Rent, Internet, Custom)
    for (const charge of charges) {
        const participants = resolveParticipants(charge);
        if (participants.length === 0)
            continue;
        let allocations = [];
        if (charge.distributionMethod === 'PERCENTAGE_ALLOCATION' && charge.percentages) {
            allocations = (0, splitter_1.splitCentavosByPercentage)(charge.amountCentavos, charge.percentages);
        }
        else if (charge.distributionMethod === 'FIXED_AMOUNTS' && charge.fixedAmounts) {
            allocations = participants.map((uid) => ({
                userId: uid,
                amountCentavos: charge.fixedAmounts?.[uid] || 0,
            }));
        }
        else {
            allocations = (0, splitter_1.splitCentavosEvenly)(charge.amountCentavos, participants);
        }
        if (charge.chargeType === 'RENT') {
            rentTotalCentavos += charge.amountCentavos;
            for (const alloc of allocations) {
                memberRent.set(alloc.userId, (memberRent.get(alloc.userId) || 0) + alloc.amountCentavos);
                memberItems.get(alloc.userId)?.push({
                    chargeId: charge.chargeId,
                    chargeType: 'RENT',
                    name: charge.name || 'Rent',
                    amountCentavos: alloc.amountCentavos,
                    details: `Rent share (${allocations.length} payors)`,
                });
            }
        }
        else if (charge.chargeType === 'INTERNET') {
            internetTotalCentavos += charge.amountCentavos;
            for (const alloc of allocations) {
                memberInternet.set(alloc.userId, (memberInternet.get(alloc.userId) || 0) + alloc.amountCentavos);
                memberItems.get(alloc.userId)?.push({
                    chargeId: charge.chargeId,
                    chargeType: 'INTERNET',
                    name: charge.name || 'Internet',
                    amountCentavos: alloc.amountCentavos,
                    details: `Internet share (${allocations.length} payors)`,
                });
            }
        }
        else if (charge.chargeType === 'CUSTOM') {
            customChargesTotalCentavos += charge.amountCentavos;
            for (const alloc of allocations) {
                memberCustom.set(alloc.userId, (memberCustom.get(alloc.userId) || 0) + alloc.amountCentavos);
                memberItems.get(alloc.userId)?.push({
                    chargeId: charge.chargeId,
                    chargeType: 'CUSTOM',
                    name: charge.name,
                    amountCentavos: alloc.amountCentavos,
                    details: charge.description || 'Custom expense',
                });
            }
        }
    }
    // 2. Process Electricity
    if (electricityConfig) {
        const consumptionKwh = Math.max(0, electricityConfig.currentReading - electricityConfig.previousReading);
        const rate = electricityConfig.electricityRateCentavosPerKwh || constants_1.DEFAULT_ELECTRICITY_RATE_CENTAVOS;
        const totalElecCentavos = consumptionKwh * rate;
        electricityTotalCentavos = totalElecCentavos;
        const elecParticipants = activeMembers.filter((m) => m.role === 'PAYOR').map((m) => m.userId);
        const elecAllocations = (0, splitter_1.splitCentavosEvenly)(totalElecCentavos, elecParticipants);
        for (const alloc of elecAllocations) {
            memberElectricity.set(alloc.userId, (memberElectricity.get(alloc.userId) || 0) + alloc.amountCentavos);
            memberItems.get(alloc.userId)?.push({
                chargeId: 'electricity-charge',
                chargeType: 'ELECTRICITY',
                name: 'Electricity',
                amountCentavos: alloc.amountCentavos,
                details: `${consumptionKwh} kWh @ ₱${rate / 100}/kWh (${allocationsSummary(consumptionKwh, rate)})`,
            });
        }
    }
    // 3. Process Water (Attendance based)
    const waterRate = waterConfig?.rateCentavosPerPersonPerDay || constants_1.DEFAULT_WATER_RATE_CENTAVOS;
    for (const m of activeMembers) {
        const presentRecords = waterAttendance.filter((a) => a.userId === m.userId && a.status === 'PRESENT');
        const daysPresent = presentRecords.length;
        memberWaterDays.set(m.userId, daysPresent);
        const waterShareCentavos = daysPresent * waterRate;
        memberWater.set(m.userId, waterShareCentavos);
        waterTotalCentavos += waterShareCentavos;
        if (waterShareCentavos > 0 || m.role === 'PAYOR') {
            memberItems.get(m.userId)?.push({
                chargeId: 'water-charge',
                chargeType: 'WATER',
                name: 'Water Attendance',
                amountCentavos: waterShareCentavos,
                details: `${daysPresent} days present @ ₱${waterRate / 100}/day`,
            });
        }
    }
    // 4. Process Adjustments
    for (const adj of existingAdjustments) {
        adjustmentsTotalCentavos += adj.amountCentavos;
        memberAdjustments.set(adj.userId, (memberAdjustments.get(adj.userId) || 0) + adj.amountCentavos);
        memberItems.get(adj.userId)?.push({
            chargeId: 'adjustment-charge',
            chargeType: 'CUSTOM',
            name: 'Adjustment',
            amountCentavos: adj.amountCentavos,
            details: adj.reason,
        });
    }
    const grandTotalCentavos = rentTotalCentavos +
        internetTotalCentavos +
        electricityTotalCentavos +
        waterTotalCentavos +
        customChargesTotalCentavos +
        adjustmentsTotalCentavos;
    // Build final member bills
    const memberBills = members.map((m) => {
        const r = memberRent.get(m.userId) || 0;
        const i = memberInternet.get(m.userId) || 0;
        const e = memberElectricity.get(m.userId) || 0;
        const w = memberWater.get(m.userId) || 0;
        const c = memberCustom.get(m.userId) || 0;
        const a = memberAdjustments.get(m.userId) || 0;
        const totalDue = r + i + e + w + c + a;
        return {
            billId: `${billingCycle.billingCycleId}_${m.userId}`,
            householdId: billingCycle.householdId,
            billingCycleId: billingCycle.billingCycleId,
            userId: m.userId,
            userName: m.displayName || memberMap.get(m.userId)?.displayName || 'Resident',
            userRole: m.role,
            rentCentavos: r,
            internetCentavos: i,
            electricityCentavos: e,
            waterCentavos: w,
            customChargesCentavos: c,
            adjustmentsCentavos: a,
            totalDueCentavos: totalDue,
            paidCentavos: 0,
            outstandingCentavos: totalDue,
            status: totalDue === 0 ? 'PAID' : 'UNPAID',
            items: memberItems.get(m.userId) || [],
            waterDaysPresent: memberWaterDays.get(m.userId) || 0,
            finalizedAt: new Date().toISOString(),
        };
    });
    return {
        rentTotalCentavos,
        internetTotalCentavos,
        electricityTotalCentavos,
        waterTotalCentavos,
        customChargesTotalCentavos,
        adjustmentsTotalCentavos,
        grandTotalCentavos,
        memberBills,
    };
}
function allocationsSummary(kwh, rateCentavos) {
    return `${kwh} kWh × ₱${rateCentavos / 100}`;
}
