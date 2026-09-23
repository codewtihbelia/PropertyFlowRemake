"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORT_CATEGORIES = exports.PAYMENT_METHODS = exports.INITIAL_DEMO_HOUSEHOLD = exports.DEFAULT_WATER_RATE_CENTAVOS = exports.DEFAULT_ELECTRICITY_RATE_CENTAVOS = void 0;
exports.DEFAULT_ELECTRICITY_RATE_CENTAVOS = 1600; // ₱16.00 per kWh
exports.DEFAULT_WATER_RATE_CENTAVOS = 500; // ₱5.00 per person per day
exports.INITIAL_DEMO_HOUSEHOLD = {
    householdName: "Skyline Residences Unit 402",
    apartmentName: "Unit 402",
    address: "Tower 2, IT Park, Lahug, Cebu City",
    description: "Shared apartment with 7 residents: 1 Host, 4 Payors, and 3 Non-Payors.",
};
exports.PAYMENT_METHODS = [
    { id: 'GCASH', label: 'GCash' },
    { id: 'MAYA', label: 'Maya' },
    { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { id: 'CASH', label: 'Cash' },
    { id: 'OTHER', label: 'Other' },
];
exports.SUPPORT_CATEGORIES = [
    'BILLING',
    'ACCOUNT',
    'PAYMENT',
    'BUG',
    'FEATURE_REQUEST',
    'OTHER',
];
