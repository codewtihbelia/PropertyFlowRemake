"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
(0, node_test_1.describe)("PropertyFlow Centavo Math & Billing Engine", () => {
    (0, node_test_1.it)("splits ₱219.50 (21950 centavos) across 3 recipients deterministically without losing centavos", () => {
        const totalCentavos = 21950; // ₱219.50
        const recipients = ["payor_b", "payor_c", "payor_d"];
        const result = (0, index_1.splitCentavosEvenly)(totalCentavos, recipients);
        strict_1.default.equal(result.length, 3);
        strict_1.default.equal(result[0].amountCentavos, 7317); // ₱73.17
        strict_1.default.equal(result[1].amountCentavos, 7317); // ₱73.17
        strict_1.default.equal(result[2].amountCentavos, 7316); // ₱73.16
        const sum = result.reduce((acc, curr) => acc + curr.amountCentavos, 0);
        strict_1.default.equal(sum, totalCentavos);
        strict_1.default.equal((0, index_1.formatPesos)(result[0].amountCentavos), "₱73.17");
        strict_1.default.equal((0, index_1.formatPesos)(result[1].amountCentavos), "₱73.17");
        strict_1.default.equal((0, index_1.formatPesos)(result[2].amountCentavos), "₱73.16");
        strict_1.default.equal((0, index_1.formatPesos)(sum), "₱219.50");
    });
    (0, node_test_1.it)("calculates exact rent and internet splits for 4 payors", () => {
        const rentCentavos = (0, index_1.pesosToCentavos)(14000); // ₱14,000
        const internetCentavos = (0, index_1.pesosToCentavos)(1500); // ₱1,500
        const payors = ["p1", "p2", "p3", "p4"];
        const rentAlloc = (0, index_1.splitCentavosEvenly)(rentCentavos, payors);
        strict_1.default.equal(rentAlloc[0].amountCentavos, 350000); // ₱3,500.00
        strict_1.default.equal(rentAlloc[3].amountCentavos, 350000);
        const netAlloc = (0, index_1.splitCentavosEvenly)(internetCentavos, payors);
        strict_1.default.equal(netAlloc[0].amountCentavos, 37500); // ₱375.00
        strict_1.default.equal(netAlloc[3].amountCentavos, 37500);
    });
    (0, node_test_1.it)("calculates full household billing with 7 residents (1 Host, 4 Payors, 3 Non-Payors)", () => {
        const members = [
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
        const billingCycle = {
            billingCycleId: "cycle_aug_sep_2026",
            householdId: "h1",
            name: "August 13 – September 12, 2026",
            startDate: "2026-08-13",
            endDate: "2026-09-12",
            status: "ACTIVE",
            createdBy: "u_host",
            createdDate: "2026-08-13",
        };
        const charges = [
            {
                chargeId: "c_rent",
                householdId: "h1",
                billingCycleId: "cycle_aug_sep_2026",
                chargeType: "RENT",
                name: "Apartment Rent",
                amountCentavos: (0, index_1.pesosToCentavos)(14000), // ₱14,000
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
                amountCentavos: (0, index_1.pesosToCentavos)(1500), // ₱1,500
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
                amountCentavos: (0, index_1.pesosToCentavos)(200), // ₱200
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
        const waterAttendance = [];
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
        const summary = (0, index_1.calculateHouseholdBilling)({
            billingCycle,
            members,
            charges,
            electricityConfig,
            waterConfig: { rateCentavosPerPersonPerDay: 500, mode: "BILLING_CYCLE" },
            waterAttendance,
        });
        strict_1.default.equal(summary.rentTotalCentavos, 1400000); // ₱14,000
        strict_1.default.equal(summary.internetTotalCentavos, 150000); // ₱1,500
        strict_1.default.equal(summary.electricityTotalCentavos, 224000); // ₱2,240
        strict_1.default.equal(summary.customChargesTotalCentavos, 20000); // ₱200
        strict_1.default.equal(summary.waterTotalCentavos, 12500); // ₱125
        // Check Payor Bea's individual bill:
        // Rent: ₱3,500
        // Internet: ₱375
        // Electricity: ₱560 (2240 / 4)
        // Cleaning: ₱50 (200 / 4)
        // Water: ₱125 (25 days * ₱5)
        // Total: 3500 + 375 + 560 + 50 + 125 = ₱4,610.00 (461,000 centavos)
        const beaBill = summary.memberBills.find((b) => b.userId === "u_p1");
        (0, strict_1.default)(beaBill);
        strict_1.default.equal(beaBill.rentCentavos, 350000);
        strict_1.default.equal(beaBill.internetCentavos, 37500);
        strict_1.default.equal(beaBill.electricityCentavos, 56000);
        strict_1.default.equal(beaBill.customChargesCentavos, 5000);
        strict_1.default.equal(beaBill.waterCentavos, 12500);
        strict_1.default.equal(beaBill.totalDueCentavos, 461000);
        strict_1.default.equal((0, index_1.formatPesos)(beaBill.totalDueCentavos), "₱4,610.00");
        // Non-payors should owe ₱0
        const fionaBill = summary.memberBills.find((b) => b.userId === "u_np1");
        (0, strict_1.default)(fionaBill);
        strict_1.default.equal(fionaBill.totalDueCentavos, 0);
    });
    (0, node_test_1.it)("performs partial payment and balance redistribution as specified in the prompt", () => {
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
            userRole: "PAYOR",
            rentCentavos: 0,
            internetCentavos: 0,
            electricityCentavos: 0,
            waterCentavos: 0,
            customChargesCentavos: 0,
            adjustmentsCentavos: 0,
            totalDueCentavos: 221950, // ₱2,219.50
            paidCentavos: 200000, // ₱2,000.00
            outstandingCentavos: 21950, // ₱219.50
            status: "PARTIALLY_PAID",
            items: [],
            waterDaysPresent: 0,
            finalizedAt: "2026-08-13",
        };
        const recipientPayors = [
            { userId: "u_p2", userName: "Payor Carlos" },
            { userId: "u_p3", userName: "Payor Diana" },
            { userId: "u_p4", userName: "Payor Ethan" },
        ];
        const plan = (0, index_1.calculateRedistributionPlan)(sampleBill, recipientPayors);
        strict_1.default.equal(plan.originalBillCentavos, 221950);
        strict_1.default.equal(plan.paidCentavos, 200000);
        strict_1.default.equal(plan.outstandingCentavos, 21950);
        strict_1.default.equal(plan.allocations.length, 3);
        strict_1.default.equal(plan.allocations[0].amountCentavos, 7317); // ₱73.17
        strict_1.default.equal(plan.allocations[1].amountCentavos, 7317); // ₱73.17
        strict_1.default.equal(plan.allocations[2].amountCentavos, 7316); // ₱73.16
        strict_1.default.equal(plan.totalRedistributedCentavos, 21950);
        strict_1.default.equal((0, index_1.formatPesos)(plan.totalRedistributedCentavos), "₱219.50");
    });
});
