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
export function splitCentavosEvenly(
  totalCentavos: number,
  userIds: string[]
): AllocationResult[] {
  if (!userIds || userIds.length === 0) return [];
  if (totalCentavos <= 0) {
    return userIds.map((id) => ({ userId: id, amountCentavos: 0 }));
  }

  const count = userIds.length;
  const baseShare = Math.floor(totalCentavos / count);
  const remainder = totalCentavos % count;

  return userIds.map((userId, index) => ({
    userId,
    amountCentavos: baseShare + (index < remainder ? 1 : 0),
  }));
}

/**
 * Splits an amount based on explicit percentages.
 * Remainder centavos resulting from rounding are deterministically allocated.
 */
export function splitCentavosByPercentage(
  totalCentavos: number,
  percentages: Record<string, number>
): AllocationResult[] {
  const userIds = Object.keys(percentages);
  if (userIds.length === 0) return [];
  if (totalCentavos <= 0) {
    return userIds.map((id) => ({ userId: id, amountCentavos: 0 }));
  }

  let allocatedSum = 0;
  const rawAllocations: { userId: string; amountCentavos: number; remainderFraction: number }[] = [];

  for (const userId of userIds) {
    const pct = percentages[userId] || 0;
    const rawValue = (totalCentavos * pct) / 100;
    const baseCentavos = Math.floor(rawValue);
    const remainderFraction = rawValue - baseCentavos;
    rawAllocations.push({ userId, amountCentavos: baseCentavos, remainderFraction });
    allocatedSum += baseCentavos;
  }

  // Sort by highest remainder fraction to distribute leftover centavos
  const remainingCentavos = totalCentavos - allocatedSum;
  const sortedByRemainder = [...rawAllocations].sort(
    (a, b) => b.remainderFraction - a.remainderFraction
  );

  const bonusMap = new Set<string>();
  for (let i = 0; i < remainingCentavos && i < sortedByRemainder.length; i++) {
    bonusMap.add(sortedByRemainder[i].userId);
  }

  return rawAllocations.map((item) => ({
    userId: item.userId,
    amountCentavos: item.amountCentavos + (bonusMap.has(item.userId) ? 1 : 0),
  }));
}

