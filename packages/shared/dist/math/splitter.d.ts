/**
 * Deterministic Centavo Allocation Engine
 * Ensures the exact sum of allocations equals the target centavo amount without losing a single centavo.
 */
export interface AllocationResult {
    userId: string;
    amountCentavos: number;
}
/**
 * Deterministically splits an exact centavo amount among a list of user IDs.
 * The remainder centavos are allocated 1-by-1 to the first recipients in the list order.
 * Example: 21,950 centavos (₱219.50) / 3 users
 * Base: 7,316 centavos (₱73.16)
 * Remainder: 2 centavos
 * Result: User 0 = 7,317 (₱73.17), User 1 = 7,317 (₱73.17), User 2 = 7,316 (₱73.16)
 * Total: 73.17 + 73.17 + 73.16 = 219.50
 */
export declare function splitCentavosEvenly(totalCentavos: number, userIds: string[]): AllocationResult[];
/**
 * Splits an amount based on explicit percentages.
 * Remainder centavos resulting from rounding are deterministically allocated.
 */
export declare function splitCentavosByPercentage(totalCentavos: number, percentages: Record<string, number>): AllocationResult[];
