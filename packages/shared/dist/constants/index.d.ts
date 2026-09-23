export declare const DEFAULT_ELECTRICITY_RATE_CENTAVOS = 1600;
export declare const DEFAULT_WATER_RATE_CENTAVOS = 500;
export declare const INITIAL_DEMO_HOUSEHOLD: {
    householdName: string;
    apartmentName: string;
    address: string;
    description: string;
};
export declare const PAYMENT_METHODS: readonly [{
    readonly id: "GCASH";
    readonly label: "GCash";
}, {
    readonly id: "MAYA";
    readonly label: "Maya";
}, {
    readonly id: "BANK_TRANSFER";
    readonly label: "Bank Transfer";
}, {
    readonly id: "CASH";
    readonly label: "Cash";
}, {
    readonly id: "OTHER";
    readonly label: "Other";
}];
export declare const SUPPORT_CATEGORIES: readonly ["BILLING", "ACCOUNT", "PAYMENT", "BUG", "FEATURE_REQUEST", "OTHER"];
