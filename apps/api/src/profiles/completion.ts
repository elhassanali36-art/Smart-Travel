// profileCompletion = round(100 * filledKeys / totalKeys), computed from the MERGED persisted record
// (never from a partial update body). Empty arrays, blank strings, null and undefined count as unfilled.
export const TRAVELER_COMPLETION_KEYS = ['bio', 'photoUrl', 'country', 'languages', 'interests', 'travelStyles', 'budgetLevel', 'preferredDestinations'] as const;
export const HOST_COMPLETION_KEYS = ['bio', 'photoUrl', 'city', 'country', 'languages', 'expertise', 'categories'] as const;

export function completionOf(value: Record<string, unknown>, keys: readonly string[]): number {
  const filled = keys.filter((key) => {
    const v = value[key];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    return Boolean(v);
  }).length;
  return Math.round((filled / keys.length) * 100);
}

// DTO instances carry every declared property (undefined when absent). Drop those so they neither
// overwrite stored values when merging nor reach Prisma.
export function definedOnly<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
