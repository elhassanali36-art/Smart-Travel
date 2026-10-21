// Pure scheduling helpers (no I/O). The service applies the same overlap predicate in SQL.
export const MIN_LEAD_MINUTES = 60;
export const MAX_ADVANCE_DAYS = 365;

export function computeEnd(startsAt: Date, durationMinutes: number): Date {
  return new Date(startsAt.getTime() + durationMinutes * 60_000);
}

// Half-open intervals [start, end): back-to-back sessions do not overlap.
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export function validateStart(startsAt: Date, now: Date): string | null {
  if (Number.isNaN(startsAt.getTime())) return 'startsAt is not a valid date';
  if (startsAt.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) return `startsAt must be at least ${MIN_LEAD_MINUTES} minutes in the future`;
  if (startsAt.getTime() > now.getTime() + MAX_ADVANCE_DAYS * 86_400_000) return `startsAt must be within ${MAX_ADVANCE_DAYS} days`;
  return null;
}

export interface Slot { startsAt: Date; endsAt: Date; guests: number }

// Seats already taken by the given open bookings during the requested slot.
export function seatsTaken(open: Slot[], slot: { startsAt: Date; endsAt: Date }): number {
  return open.filter((b) => overlaps(b.startsAt, b.endsAt, slot.startsAt, slot.endsAt)).reduce((n, b) => n + b.guests, 0);
}

export function canFit(capacity: number, open: Slot[], request: Slot): boolean {
  return request.guests >= 1 && request.guests <= capacity && seatsTaken(open, request) + request.guests <= capacity;
}
