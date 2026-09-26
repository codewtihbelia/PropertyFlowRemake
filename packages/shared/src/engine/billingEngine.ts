import {
  BillingCycle,
  Charge,
  ElectricityConfig,
  HouseholdMember,
  MemberBill,
  MemberBillItem,
  WaterAttendanceRecord,
  WaterConfig,
} from "../types";
import {
  splitCentavosEvenly,
  splitCentavosByPercentage,
} from "../math/splitter";
import {
  DEFAULT_ELECTRICITY_RATE_CENTAVOS,
  DEFAULT_WATER_RATE_CENTAVOS,
} from "../constants";

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

export function calculateHouseholdBilling(
  input: BillingEngineInput,
): HouseholdBillingSummary {
  const {
    billingCycle,
    members,
    charges,
    electricityConfig,
    waterConfig,
    waterAttendance,
    existingAdjustments = [],
  } = input;

  const activeMembers = members.filter(
    (m) => m.status === "ACTIVE" || !m.status,
  );
  const memberMap = new Map<string, HouseholdMember>(
    members.map((m) => [m.userId || m.memberId, m]),
  );

  // Track member aggregates
  const memberRent = new Map<string, number>();
  const memberInternet = new Map<string, number>();
  const memberElectricity = new Map<string, number>();
  const memberWater = new Map<string, number>();
  const memberCustom = new Map<string, number>();
  const memberAdjustments = new Map<string, number>();
  const memberItems = new Map<string, MemberBillItem[]>();
  const memberWaterDays = new Map<string, number>();

  for (const m of members) {
    const id = m.userId || m.memberId;
    memberRent.set(id, 0);
    memberInternet.set(id, 0);
    memberElectricity.set(id, 0);
    memberWater.set(id, 0);
    memberCustom.set(id, 0);
    memberAdjustments.set(id, 0);
    memberItems.set(id, []);
    memberWaterDays.set(id, 0);
    if (m.userId && m.userId !== id) {
      memberRent.set(m.userId, 0);
      memberInternet.set(m.userId, 0);
      memberElectricity.set(m.userId, 0);
      memberWater.set(m.userId, 0);
      memberCustom.set(m.userId, 0);
      memberAdjustments.set(m.userId, 0);
      memberItems.set(m.userId, []);
      memberWaterDays.set(m.userId, 0);
    }
  }

  let rentTotalCentavos = 0;
  let internetTotalCentavos = 0;
  let electricityTotalCentavos = 0;
  let waterTotalCentavos = 0;
  let customChargesTotalCentavos = 0;
  let adjustmentsTotalCentavos = 0;

  // Helper to resolve participants based on method
  const resolveParticipants = (charge: Charge): string[] => {
    // Rent, Internet, Electricity are strictly distributed fairly across Payors only; Non-payors are exempt
    if (
      charge.chargeType === "RENT" ||
      charge.chargeType === "INTERNET" ||
      charge.chargeType === "ELECTRICITY" ||
      charge.distributionMethod === "PAYORS_ONLY"
    ) {
      const payors = activeMembers
        .filter((m) => m.role === "PAYOR")
        .map((m) => m.userId || m.memberId);
      if (payors.length > 0) return payors;
      const eligible = activeMembers
        .filter((m) => m.role !== "NON_PAYOR")
        .map((m) => m.userId || m.memberId);
      return eligible.length > 0
        ? eligible
        : activeMembers.map((m) => m.userId || m.memberId);
    }

    switch (charge.distributionMethod) {
      case "ALL_MEMBERS":
        return activeMembers.map((m) => m.userId || m.memberId);
      case "SELECTED_MEMBERS":
      case "EQUAL_SPLIT":
      default: {
        if (charge.participantUserIds && charge.participantUserIds.length > 0) {
          return charge.participantUserIds;
        }
        const payors = activeMembers
          .filter((m) => m.role === "PAYOR")
          .map((m) => m.userId || m.memberId);
        if (payors.length > 0) return payors;
        const eligible = activeMembers
          .filter((m) => m.role !== "NON_PAYOR")
          .map((m) => m.userId || m.memberId);
        return eligible.length > 0
          ? eligible
          : activeMembers.map((m) => m.userId || m.memberId);
      }
    }
  };

  // 1. Process Charges (Rent, Internet, Electricity, Water, Custom)
  for (const charge of charges) {
    const participants = resolveParticipants(charge);
    if (participants.length === 0) continue;

    let allocations: Array<{ userId: string; amountCentavos: number }> = [];

    if (
      charge.distributionMethod === "PERCENTAGE_ALLOCATION" &&
      charge.percentages
    ) {
      allocations = splitCentavosByPercentage(
        charge.amountCentavos,
        charge.percentages,
      );
    } else if (
      charge.distributionMethod === "FIXED_AMOUNTS" &&
      charge.fixedAmounts
    ) {
      allocations = participants.map((uid) => ({
        userId: uid,
        amountCentavos: charge.fixedAmounts?.[uid] || 0,
      }));
    } else {
      allocations = splitCentavosEvenly(charge.amountCentavos, participants);
    }

    if (charge.chargeType === "RENT") {
      rentTotalCentavos += charge.amountCentavos;
      for (const alloc of allocations) {
        memberRent.set(
          alloc.userId,
          (memberRent.get(alloc.userId) || 0) + alloc.amountCentavos,
        );
        memberItems.get(alloc.userId)?.push({
          chargeId: charge.chargeId,
          chargeType: "RENT",
          name: charge.name || "Rent",
          amountCentavos: alloc.amountCentavos,
          details: `Rent share (${allocations.length} payors)`,
        });
      }
    } else if (charge.chargeType === "INTERNET") {
      internetTotalCentavos += charge.amountCentavos;
      for (const alloc of allocations) {
        memberInternet.set(
          alloc.userId,
          (memberInternet.get(alloc.userId) || 0) + alloc.amountCentavos,
        );
        memberItems.get(alloc.userId)?.push({
          chargeId: charge.chargeId,
          chargeType: "INTERNET",
          name: charge.name || "Internet",
          amountCentavos: alloc.amountCentavos,
          details: `Internet share (${allocations.length} payors)`,
        });
      }
    } else if (charge.chargeType === "ELECTRICITY") {
      electricityTotalCentavos += charge.amountCentavos;
      for (const alloc of allocations) {
        memberElectricity.set(
          alloc.userId,
          (memberElectricity.get(alloc.userId) || 0) + alloc.amountCentavos,
        );
        memberItems.get(alloc.userId)?.push({
          chargeId: charge.chargeId,
          chargeType: "ELECTRICITY",
          name: charge.name || "Electricity",
          amountCentavos: alloc.amountCentavos,
          details: `Electricity share (${allocations.length} payors)`,
        });
      }
    } else if (charge.chargeType === "WATER") {
      waterTotalCentavos += charge.amountCentavos;
      for (const alloc of allocations) {
        memberWater.set(
          alloc.userId,
          (memberWater.get(alloc.userId) || 0) + alloc.amountCentavos,
        );
        memberItems.get(alloc.userId)?.push({
          chargeId: charge.chargeId,
          chargeType: "WATER",
          name: charge.name || "Water",
          amountCentavos: alloc.amountCentavos,
          details: `Water share (${allocations.length} payors)`,
        });
      }
    } else {
      customChargesTotalCentavos += charge.amountCentavos;
      for (const alloc of allocations) {
        memberCustom.set(
          alloc.userId,
          (memberCustom.get(alloc.userId) || 0) + alloc.amountCentavos,
        );
        memberItems.get(alloc.userId)?.push({
          chargeId: charge.chargeId,
          chargeType: "CUSTOM",
          name: charge.name,
          amountCentavos: alloc.amountCentavos,
          details: charge.description || "Custom expense",
        });
      }
    }
  }

  // 2. Process Electricity from sub-meter configuration
  if (
    electricityConfig &&
    electricityConfig.currentReading > electricityConfig.previousReading
  ) {
    const consumptionKwh = Math.max(
      0,
      electricityConfig.currentReading - electricityConfig.previousReading,
    );
    const rate =
      electricityConfig.electricityRateCentavosPerKwh ||
      DEFAULT_ELECTRICITY_RATE_CENTAVOS;
    const totalElecCentavos = consumptionKwh * rate;
    electricityTotalCentavos += totalElecCentavos;

    const elecParticipants = activeMembers
      .filter((m) => m.role === "PAYOR")
      .map((m) => m.userId);
    const elecAllocations = splitCentavosEvenly(
      totalElecCentavos,
      elecParticipants,
    );

    for (const alloc of elecAllocations) {
      memberElectricity.set(
        alloc.userId,
        (memberElectricity.get(alloc.userId) || 0) + alloc.amountCentavos,
      );
      memberItems.get(alloc.userId)?.push({
        chargeId: "electricity-meter-charge",
        chargeType: "ELECTRICITY",
        name: "Electricity Meter",
        amountCentavos: alloc.amountCentavos,
        details: `${consumptionKwh} kWh @ ₱${rate / 100}/kWh (${allocationsSummary(consumptionKwh, rate)})`,
      });
    }
  }

  // 3. Process Water (Mode 1: Per Person/Day attendance, Mode 2: Fixed Household Monthly, Mode 3: Fixed Per Person Monthly)
  const isFixedPerPersonMonth =
    waterConfig?.pricingModel === "FIXED_PER_PERSON_MONTH";
  const isFixedMonthly =
    waterConfig?.pricingModel === "FIXED_MONTHLY" ||
    (!isFixedPerPersonMonth &&
      Boolean(waterConfig?.fixedMonthlyAmountCentavos) &&
      (waterConfig?.fixedMonthlyAmountCentavos || 0) > 0);

  const payorMembers = activeMembers.filter((m) => m.role === "PAYOR");
  const nonPayorMembers = activeMembers.filter((m) => m.role !== "PAYOR");

  if (isFixedPerPersonMonth) {
    // Mode 3: Fixed Per Person Monthly (e.g. ₱150.00 / resident / month)
    const perPersonCentavos = waterConfig?.fixedPerPersonAmountCentavos || 0;
    if (perPersonCentavos > 0 && payorMembers.length > 0) {
      for (const m of payorMembers) {
        memberWater.set(
          m.userId,
          (memberWater.get(m.userId) || 0) + perPersonCentavos,
        );
        waterTotalCentavos += perPersonCentavos;
        memberItems.get(m.userId)?.push({
          chargeId: "water-fixed-per-person-charge",
          chargeType: "WATER",
          name: "Water (Fixed / Person)",
          amountCentavos: perPersonCentavos,
          details: `Flat fee of ₱${(perPersonCentavos / 100).toFixed(2)}/resident/month`,
        });
      }
    }
  } else if (isFixedMonthly) {
    // Mode 2: Fixed Household Monthly (e.g. ₱1,200.00 / month split equally across payors)
    const fixedAmountCentavos = waterConfig?.fixedMonthlyAmountCentavos || 0;
    if (fixedAmountCentavos > 0 && payorMembers.length > 0) {
      waterTotalCentavos += fixedAmountCentavos;
      const fixedWaterAllocations = splitCentavosEvenly(
        fixedAmountCentavos,
        payorMembers.map((m) => m.userId),
      );
      for (const alloc of fixedWaterAllocations) {
        memberWater.set(
          alloc.userId,
          (memberWater.get(alloc.userId) || 0) + alloc.amountCentavos,
        );
        memberItems.get(alloc.userId)?.push({
          chargeId: "water-fixed-charge",
          chargeType: "WATER",
          name: "Water (Fixed Monthly)",
          amountCentavos: alloc.amountCentavos,
          details: `Household water bill (₱${(fixedAmountCentavos / 100).toFixed(2)}) split evenly across ${payorMembers.length} paying roommates`,
        });
      }
    }
  } else {
    // Per Person / Day (Default ₱5.00/person/day)
    const waterRate =
      waterConfig?.rateCentavosPerPersonPerDay || DEFAULT_WATER_RATE_CENTAVOS;
    let nonPayorWaterTotalCentavos = 0;
    const payorIndividualWater = new Map<string, number>();

    for (const m of activeMembers) {
      const presentRecords = waterAttendance.filter(
        (a) => a.userId === m.userId && a.status === "PRESENT",
      );
      const daysPresent = presentRecords.length;
      memberWaterDays.set(m.userId, daysPresent);

      const consumptionCentavos = daysPresent * waterRate;

      if (m.role === "PAYOR") {
        payorIndividualWater.set(m.userId, consumptionCentavos);
      } else {
        // Non-payors are exempted from paying, but their water consumption is tracked and distributed fairly to payors
        nonPayorWaterTotalCentavos += consumptionCentavos;
        memberWater.set(m.userId, 0);
      }
    }

    // Distribute non-payors' water consumption fairly across all payors
    const nonPayorSplits =
      payorMembers.length > 0 && nonPayorWaterTotalCentavos > 0
        ? splitCentavosEvenly(
            nonPayorWaterTotalCentavos,
            payorMembers.map((m) => m.userId),
          )
        : [];
    const nonPayorSplitMap = new Map<string, number>(
      nonPayorSplits.map((s) => [s.userId, s.amountCentavos]),
    );

    for (const m of payorMembers) {
      const ownWater = payorIndividualWater.get(m.userId) || 0;
      const nonPayorShare = nonPayorSplitMap.get(m.userId) || 0;
      const totalPayorWater = ownWater + nonPayorShare;

      memberWater.set(
        m.userId,
        (memberWater.get(m.userId) || 0) + totalPayorWater,
      );
      waterTotalCentavos += totalPayorWater;

      const daysPresent = memberWaterDays.get(m.userId) || 0;
      const details =
        nonPayorShare > 0
          ? `${daysPresent} days @ ₱${waterRate / 100}/day (₱${(ownWater / 100).toFixed(2)}) + non-payor water split (₱${(nonPayorShare / 100).toFixed(2)})`
          : `${daysPresent} days present @ ₱${waterRate / 100}/day`;

      memberItems.get(m.userId)?.push({
        chargeId: "water-attendance-charge",
        chargeType: "WATER",
        name: "Water Attendance",
        amountCentavos: totalPayorWater,
        details,
      });
    }
  }

  // 4. Process Adjustments
  for (const adj of existingAdjustments) {
    adjustmentsTotalCentavos += adj.amountCentavos;
    memberAdjustments.set(
      adj.userId,
      (memberAdjustments.get(adj.userId) || 0) + adj.amountCentavos,
    );
    memberItems.get(adj.userId)?.push({
      chargeId: "adjustment-charge",
      chargeType: "CUSTOM",
      name: "Adjustment",
      amountCentavos: adj.amountCentavos,
      details: adj.reason,
    });
  }

  const grandTotalCentavos =
    rentTotalCentavos +
    internetTotalCentavos +
    electricityTotalCentavos +
    waterTotalCentavos +
    customChargesTotalCentavos +
    adjustmentsTotalCentavos;

  // Build final member bills
  const memberBills: MemberBill[] = members.map((m) => {
    const id = m.userId || m.memberId;
    const r =
      (m.userId ? memberRent.get(m.userId) : undefined) ??
      memberRent.get(id) ??
      0;
    const i =
      (m.userId ? memberInternet.get(m.userId) : undefined) ??
      memberInternet.get(id) ??
      0;
    const e =
      (m.userId ? memberElectricity.get(m.userId) : undefined) ??
      memberElectricity.get(id) ??
      0;
    const w =
      (m.userId ? memberWater.get(m.userId) : undefined) ??
      memberWater.get(id) ??
      0;
    const c =
      (m.userId ? memberCustom.get(m.userId) : undefined) ??
      memberCustom.get(id) ??
      0;
    const a =
      (m.userId ? memberAdjustments.get(m.userId) : undefined) ??
      memberAdjustments.get(id) ??
      0;
    const totalDue = r + i + e + w + c + a;

    return {
      billId: `${billingCycle.billingCycleId}_${id}`,
      householdId: billingCycle.householdId,
      billingCycleId: billingCycle.billingCycleId,
      userId: id,
      userName: m.displayName || memberMap.get(id)?.displayName || "Resident",
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
      status: totalDue === 0 ? "PAID" : "UNPAID",
      items:
        (m.userId ? memberItems.get(m.userId) : undefined) ||
        memberItems.get(id) ||
        [],
      waterDaysPresent:
        (m.userId ? memberWaterDays.get(m.userId) : undefined) ??
        memberWaterDays.get(id) ??
        0,
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

function allocationsSummary(kwh: number, rateCentavos: number): string {
  return `${kwh} kWh × ₱${rateCentavos / 100}`;
}
