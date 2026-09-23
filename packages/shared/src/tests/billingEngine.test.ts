import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  splitCentavosEvenly,
  formatPesos,
  pesosToCentavos,
  calculateHouseholdBilling,
  calculateRedistributionPlan,
  HouseholdMember,
  BillingCycle,
  Charge,
  WaterAttendanceRecord,
} from "../index";

describe("PropertyFlow Centavo Math & Billing Engine", () => {
  it("splits ₱219.50 (21950 centavos) across 3 recipients deterministically without losing centavos", () => {
    const totalCentavos = 21950; // ₱219.50
    const recipients = ["payor_b", "payor_c", "payor_d"];
    const result = splitCentavosEvenly(totalCentavos, recipients);

    assert.equal(result.length, 3);
    assert.equal(result[0].amountCentavos, 7317); // ₱73.17
    assert.equal(result[1].amountCentavos, 7317); // ₱73.17
    assert.equal(result[2].amountCentavos, 7316); // ₱73.16

    const sum = result.reduce((acc, curr) => acc + curr.amountCentavos, 0);
    assert.equal(sum, totalCentavos);

    assert.equal(formatPesos(result[0].amountCentavos), "₱73.17");
    assert.equal(formatPesos(result[1].amountCentavos), "₱73.17");
    assert.equal(formatPesos(result[2].amountCentavos), "₱73.16");
    assert.equal(formatPesos(sum), "₱219.50");
  });

  it("calculates exact rent and internet splits for 4 payors", () => {
    const rentCentavos = pesosToCentavos(14000); // ₱14,000
    const internetCentavos = pesosToCentavos(1500); // ₱1,500
    const payors = ["p1", "p2", "p3", "p4"];

    const rentAlloc = splitCentavosEvenly(rentCentavos, payors);
    assert.equal(rentAlloc[0].amountCentavos, 350000); // ₱3,500.00
    assert.equal(rentAlloc[3].amountCentavos, 350000);

    const netAlloc = splitCentavosEvenly(internetCentavos, payors);
    assert.equal(netAlloc[0].amountCentavos, 37500); // ₱375.00
    assert.equal(netAlloc[3].amountCentavos, 37500);
  });

  it("calculates full household billing with 7 residents (1 Host, 4 Payors, 3 Non-Payors)", () => {
    const members: HouseholdMember[] = [
      {
        memberId: "m0",
        userId: "u_host",
        householdId: "h1",
        role: "HOST",
        displayName: "Host Alex",
        email: "alex@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-08-01",
      },
      {
        memberId: "m1",
        userId: "u_p1",
        householdId: "h1",
        role: "PAYOR",
        displayName: "Payor Bea",
        email: "bea@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-08-01",
      },
      {
        memberId: "m2",
        userId: "u_p2",
        householdId: "h1",
        role: "PAYOR",
        displayName: "Payor Carlos",
        email: "carlos@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-08-01",
      },
      {
        memberId: "m3",
        userId: "u_p3",
        householdId: "h1",
        role: "PAYOR",
        displayName: "Payor Diana",
        email: "diana@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-08-01",
      },
      {
        memberId: "m4",
        userId: "u_p4",
        householdId: "h1",
        role: "PAYOR",
        displayName: "Payor Ethan",
        email: "ethan@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-08-01",
      },
      {
        memberId: "m5",
        userId: "u_np1",
        householdId: "h1",
        role: "NON_PAYOR",
        displayName: "Non-Payor Fiona",
        email: "fiona@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-08-01",
      },
      {
        memberId: "m6",
        userId: "u_np2",
        householdId: "h1",
        role: "NON_PAYOR",
        displayName: "Non-Payor George",
        email: "george@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-08-01",
      },
      {
        memberId: "m7",
        userId: "u_np3",
        householdId: "h1",
        role: "NON_PAYOR",
        displayName: "Non-Payor Hannah",
        email: "hannah@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-08-01",
      },
    ];

    const billingCycle: BillingCycle = {
      billingCycleId: "cycle_aug_sep_2026",
      householdId: "h1",
      name: "August 13 – September 12, 2026",
      startDate: "2026-08-13",
      endDate: "2026-09-12",
      status: "ACTIVE",
      createdBy: "u_host",
      createdDate: "2026-08-13",
    };

    const charges: Charge[] = [
      {
        chargeId: "c_rent",
        householdId: "h1",
        billingCycleId: "cycle_aug_sep_2026",
        chargeType: "RENT",
        name: "Apartment Rent",
        amountCentavos: pesosToCentavos(14000), // ₱14,000
        distributionMethod: "PAYORS_ONLY",
        participantUserIds: [],
        createdDate: "2026-08-13",
        createdBy: "u_host",
      },
      {
        chargeId: "c_net",
        householdId: "h1",
        billingCycleId: "cycle_aug_sep_2026",
        chargeType: "INTERNET",
        name: "Fiber Internet 300Mbps",
        amountCentavos: pesosToCentavos(1500), // ₱1,500
        distributionMethod: "PAYORS_ONLY",
        participantUserIds: [],
        createdDate: "2026-08-13",
        createdBy: "u_host",
      },
      {
        chargeId: "c_cleaning",
        householdId: "h1",
        billingCycleId: "cycle_aug_sep_2026",
        chargeType: "CUSTOM",
        name: "Bi-weekly Common Area Cleaning",
        amountCentavos: pesosToCentavos(200), // ₱200
        distributionMethod: "PAYORS_ONLY",
        participantUserIds: [],
        createdDate: "2026-08-13",
        createdBy: "u_host",
      },
    ];

    // Electricity: Previous = 1250, Current = 1390 => 140 kWh @ ₱16/kWh = ₱2,240 (224,000 centavos)
    const electricityConfig = {
      previousReading: 1250,
      currentReading: 1390,
      electricityRateCentavosPerKwh: 1600, // ₱16.00
      consumptionKwh: 140,
      totalCostCentavos: 224000,
    };

    // Water: ₱5/person/day. Payor Bea has 25 days present => ₱125.
    const waterAttendance: WaterAttendanceRecord[] = [];
    for (let day = 1; day <= 25; day++) {
      waterAttendance.push({
        recordId: `w_bea_${day}`,
        householdId: "h1",
        billingCycleId: "cycle_aug_sep_2026",
        userId: "u_p1",
        date: `2026-08-${day.toString().padStart(2, "0")}`,
        status: "PRESENT",
        locked: false,
      });
    }

    const summary = calculateHouseholdBilling({
      billingCycle,
      members,
      charges,
      electricityConfig,
      waterConfig: { rateCentavosPerPersonPerDay: 500, mode: "BILLING_CYCLE" },
      waterAttendance,
    });

    assert.equal(summary.rentTotalCentavos, 1400000); // ₱14,000
    assert.equal(summary.internetTotalCentavos, 150000); // ₱1,500
    assert.equal(summary.electricityTotalCentavos, 224000); // ₱2,240
    assert.equal(summary.customChargesTotalCentavos, 20000); // ₱200
    assert.equal(summary.waterTotalCentavos, 12500); // ₱125

    // Check Payor Bea's individual bill:
    // Rent: ₱3,500
    // Internet: ₱375
    // Electricity: ₱560 (2240 / 4)
    // Cleaning: ₱50 (200 / 4)
    // Water: ₱125 (25 days * ₱5)
    // Total: 3500 + 375 + 560 + 50 + 125 = ₱4,610.00 (461,000 centavos)
    const beaBill = summary.memberBills.find((b) => b.userId === "u_p1");
    assert(beaBill);
    assert.equal(beaBill.rentCentavos, 350000);
    assert.equal(beaBill.internetCentavos, 37500);
    assert.equal(beaBill.electricityCentavos, 56000);
    assert.equal(beaBill.customChargesCentavos, 5000);
    assert.equal(beaBill.waterCentavos, 12500);
    assert.equal(beaBill.totalDueCentavos, 461000);
    assert.equal(formatPesos(beaBill.totalDueCentavos), "₱4,610.00");

    // Non-payors should owe ₱0
    const fionaBill = summary.memberBills.find((b) => b.userId === "u_np1");
    assert(fionaBill);
    assert.equal(fionaBill.totalDueCentavos, 0);
  });

  it("performs partial payment and balance redistribution as specified in the prompt", () => {
    // Prompt scenario:
    // Original bill: ₱2,219.50
    // Payor pays: ₱2,000
    // Outstanding: ₱219.50
    // Redistribute across 3 Payors: ₱73.17, ₱73.17, ₱73.16
    const sampleBill = {
      billId: "b_1",
      householdId: "h1",
      billingCycleId: "c1",
      userId: "u_p1",
      userName: "Payor Bea",
      userRole: "PAYOR" as const,
      rentCentavos: 0,
      internetCentavos: 0,
      electricityCentavos: 0,
      waterCentavos: 0,
      customChargesCentavos: 0,
      adjustmentsCentavos: 0,
      totalDueCentavos: 221950, // ₱2,219.50
      paidCentavos: 200000, // ₱2,000.00
      outstandingCentavos: 21950, // ₱219.50
      status: "PARTIALLY_PAID" as const,
      items: [],
      waterDaysPresent: 0,
      finalizedAt: "2026-08-13",
    };

    const recipientPayors = [
      { userId: "u_p2", userName: "Payor Carlos" },
      { userId: "u_p3", userName: "Payor Diana" },
      { userId: "u_p4", userName: "Payor Ethan" },
    ];

    const plan = calculateRedistributionPlan(sampleBill, recipientPayors);

    assert.equal(plan.originalBillCentavos, 221950);
    assert.equal(plan.paidCentavos, 200000);
    assert.equal(plan.outstandingCentavos, 21950);
    assert.equal(plan.allocations.length, 3);
    assert.equal(plan.allocations[0].amountCentavos, 7317); // ₱73.17
    assert.equal(plan.allocations[1].amountCentavos, 7317); // ₱73.17
    assert.equal(plan.allocations[2].amountCentavos, 7316); // ₱73.16

    assert.equal(plan.totalRedistributedCentavos, 21950);
    assert.equal(formatPesos(plan.totalRedistributedCentavos), "₱219.50");
  });

  it("distributes Rent, Electricity, Internet to payors only, and redistributes non-payors water to payors", () => {
    const members: HouseholdMember[] = [
      {
        memberId: "m1",
        userId: "u_p1",
        householdId: "h1",
        role: "PAYOR",
        displayName: "Payor 1",
        email: "p1@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-07-13",
      },
      {
        memberId: "m2",
        userId: "u_p2",
        householdId: "h1",
        role: "PAYOR",
        displayName: "Payor 2",
        email: "p2@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-07-13",
      },
      {
        memberId: "m3",
        userId: "u_np1",
        householdId: "h1",
        role: "NON_PAYOR",
        displayName: "Non-Payor 1",
        email: "np1@flow.test",
        status: "ACTIVE",
        joinedDate: "2026-07-13",
      },
    ];

    const billingCycle: BillingCycle = {
      billingCycleId: "cycle_jul_aug_2026",
      householdId: "h1",
      name: "July 13, 2026 – August 12, 2026",
      startDate: "2026-07-13",
      endDate: "2026-08-12",
      status: "ACTIVE",
      createdBy: "u_host",
      createdDate: "2026-07-13",
    };

    const charges: Charge[] = [
      {
        chargeId: "c_rent",
        householdId: "h1",
        billingCycleId: "cycle_jul_aug_2026",
        chargeType: "RENT",
        name: "Rent",
        amountCentavos: 1000000, // ₱10,000
        distributionMethod: "PAYORS_ONLY",
        participantUserIds: [],
        createdDate: "2026-07-13",
        createdBy: "u_host",
      },
      {
        chargeId: "c_elec",
        householdId: "h1",
        billingCycleId: "cycle_jul_aug_2026",
        chargeType: "ELECTRICITY",
        name: "Electricity",
        amountCentavos: 200000, // ₱2,000
        distributionMethod: "PAYORS_ONLY",
        participantUserIds: [],
        createdDate: "2026-07-13",
        createdBy: "u_host",
      },
      {
        chargeId: "c_net",
        householdId: "h1",
        billingCycleId: "cycle_jul_aug_2026",
        chargeType: "INTERNET",
        name: "Internet",
        amountCentavos: 100000, // ₱1,000
        distributionMethod: "PAYORS_ONLY",
        participantUserIds: [],
        createdDate: "2026-07-13",
        createdBy: "u_host",
      },
    ];

    // Water: ₱5/person/day
    // Payor 1: 30 days present = ₱150 (15,000 centavos)
    // Payor 2: 20 days present = ₱100 (10,000 centavos)
    // Non-Payor 1: 30 days present = ₱150 (15,000 centavos)
    const waterAttendance: WaterAttendanceRecord[] = [];
    for (let day = 1; day <= 30; day++) {
      waterAttendance.push({
        recordId: `w_p1_${day}`,
        householdId: "h1",
        billingCycleId: "cycle_jul_aug_2026",
        userId: "u_p1",
        date: `2026-07-${day.toString().padStart(2, "0")}`,
        status: "PRESENT",
        locked: false,
      });
    }
    for (let day = 1; day <= 20; day++) {
      waterAttendance.push({
        recordId: `w_p2_${day}`,
        householdId: "h1",
        billingCycleId: "cycle_jul_aug_2026",
        userId: "u_p2",
        date: `2026-07-${day.toString().padStart(2, "0")}`,
        status: "PRESENT",
        locked: false,
      });
    }
    for (let day = 1; day <= 30; day++) {
      waterAttendance.push({
        recordId: `w_np1_${day}`,
        householdId: "h1",
        billingCycleId: "cycle_jul_aug_2026",
        userId: "u_np1",
        date: `2026-07-${day.toString().padStart(2, "0")}`,
        status: "PRESENT",
        locked: false,
      });
    }

    const summary = calculateHouseholdBilling({
      billingCycle,
      members,
      charges,
      waterConfig: {
        rateCentavosPerPersonPerDay: 500,
        mode: "BILLING_CYCLE",
        pricingModel: "PER_PERSON_DAY",
      },
      waterAttendance,
    });

    // Rent, Electricity, Internet: split between 2 payors = 5000 + 1000 + 500 = ₱6,500 each
    // Non-payor water = 30 * ₱5 = ₱150 split between 2 payors = ₱75 each
    // Payor 1 water = 30 * ₱5 (₱150) + ₱75 = ₱225 (22,500 centavos)
    // Payor 2 water = 20 * ₱5 (₱100) + ₱75 = ₱175 (17,500 centavos)
    // Non-Payor water = ₱0 (exempted)
    const p1Bill = summary.memberBills.find((b) => b.userId === "u_p1")!;
    const p2Bill = summary.memberBills.find((b) => b.userId === "u_p2")!;
    const np1Bill = summary.memberBills.find((b) => b.userId === "u_np1")!;

    assert.equal(p1Bill.rentCentavos, 500000);
    assert.equal(p1Bill.electricityCentavos, 100000);
    assert.equal(p1Bill.internetCentavos, 50000);
    assert.equal(p1Bill.waterCentavos, 22500); // ₱225.00
    assert.equal(p1Bill.totalDueCentavos, 672500); // ₱6,725.00

    assert.equal(p2Bill.rentCentavos, 500000);
    assert.equal(p2Bill.electricityCentavos, 100000);
    assert.equal(p2Bill.internetCentavos, 50000);
    assert.equal(p2Bill.waterCentavos, 17500); // ₱175.00
    assert.equal(p2Bill.totalDueCentavos, 667500); // ₱6,675.00

    assert.equal(np1Bill.totalDueCentavos, 0); // Exempted!
    assert.equal(np1Bill.waterCentavos, 0);

    // Total water collected = 225 + 175 = 400 (40,000 centavos)
    assert.equal(summary.waterTotalCentavos, 40000);
  });
});
