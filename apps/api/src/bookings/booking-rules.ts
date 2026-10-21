// Central booking state machine (pure, no I/O). Every status change in the system goes through evaluate().
export type BookingActor = 'HOST' | 'TRAVELER' | 'ADMIN' | 'SYSTEM';

export const ACTIVE_STATUSES = ['REQUESTED', 'ACCEPTED', 'CONFIRMED'] as const;
// Statuses a participant may request through POST /bookings/:id/status/:status.
export const USER_SETTABLE = ['ACCEPTED', 'REJECTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as const;
export const RESPONSE_WINDOW_HOURS = 48;
export const DISPUTE_WINDOW_DAYS = 14;

export interface BookingFacts {
  status: string;
  startsAt: Date;
  endsAt: Date;
  expiresAt: Date | null;
}
export type Decision = { ok: true } | { ok: false; reason: string };

const ok: Decision = { ok: true };
const no = (reason: string): Decision => ({ ok: false, reason });

export function actorFor(role: string, userId: string, booking: { hostId: string; travelerId: string }): BookingActor | null {
  if (role === 'LOCAL_HOST' && booking.hostId === userId) return 'HOST';
  if (role === 'TRAVELER' && booking.travelerId === userId) return 'TRAVELER';
  return null; // non-participants (and admins, who only resolve disputes) have no user workflow
}

export function isOverdue(b: { status: string; expiresAt: Date | null }, now: Date): boolean {
  return (b.status === 'REQUESTED' || b.status === 'ACCEPTED') && b.expiresAt !== null && b.expiresAt.getTime() <= now.getTime();
}

// Deadline for the pending party: 48h, but never later than the session start.
export function nextExpiry(now: Date, startsAt: Date): Date {
  return new Date(Math.min(now.getTime() + RESPONSE_WINDOW_HOURS * 3_600_000, startsAt.getTime()));
}

export function evaluate(actor: BookingActor, to: string, b: BookingFacts, now: Date): Decision {
  const t = now.getTime();
  const started = b.startsAt.getTime() <= t;
  const finished = b.endsAt.getTime() <= t;
  const from = b.status;

  if (to === 'EXPIRED') {
    if (actor !== 'SYSTEM') return no('Only the system can expire a booking');
    if (!isOverdue(b, now)) return no('Booking is not overdue');
    return ok;
  }
  if (to === 'REVIEWED') {
    if (actor !== 'SYSTEM') return no('Reviewed is set only by the review workflow');
    return from === 'COMPLETED' ? ok : no('Only completed bookings can be reviewed');
  }
  if (to === 'DISPUTED') {
    if (actor !== 'HOST' && actor !== 'TRAVELER') return no('Only a participant can open a dispute');
    if (from === 'CONFIRMED') return started ? ok : no('A booking can be disputed only after it has started');
    if (from === 'COMPLETED') return t <= b.endsAt.getTime() + DISPUTE_WINDOW_DAYS * 86_400_000 ? ok : no('The dispute window has closed');
    return no('This booking cannot be disputed in its current status');
  }
  if (from === 'DISPUTED') {
    if (actor !== 'ADMIN') return no('Only an administrator can resolve a dispute');
    return to === 'COMPLETED' || to === 'CANCELLED' ? ok : no('A dispute resolves to COMPLETED or CANCELLED');
  }
  if (actor === 'ADMIN' || actor === 'SYSTEM') return no('Not allowed for this actor');
  if (isOverdue(b, now)) return no('The booking has expired');

  switch (to) {
    case 'ACCEPTED':
    case 'REJECTED':
      if (actor !== 'HOST' || from !== 'REQUESTED') return no('Only the host can answer a pending request');
      return to === 'ACCEPTED' && started ? no('The session has already started') : ok;
    case 'CONFIRMED':
      if (actor !== 'TRAVELER' || from !== 'ACCEPTED') return no('Only the traveler can confirm an accepted booking');
      return started ? no('The session has already started') : ok;
    case 'CANCELLED':
      if (started) return no('A started booking cannot be cancelled');
      if (actor === 'TRAVELER' && (from === 'REQUESTED' || from === 'ACCEPTED' || from === 'CONFIRMED')) return ok;
      if (actor === 'HOST' && (from === 'ACCEPTED' || from === 'CONFIRMED')) return ok;
      return no('Invalid cancellation for this user or status');
    case 'COMPLETED':
      if (from !== 'CONFIRMED') return no('Only a confirmed booking can be completed');
      return finished ? ok : no('The session has not ended yet');
    default:
      return no('Unknown target status');
  }
}

export function timestampFieldFor(to: string): 'acceptedAt' | 'confirmedAt' | 'completedAt' | 'cancelledAt' | null {
  return ({ ACCEPTED: 'acceptedAt', CONFIRMED: 'confirmedAt', COMPLETED: 'completedAt', CANCELLED: 'cancelledAt' } as Record<string, 'acceptedAt' | 'confirmedAt' | 'completedAt' | 'cancelledAt'>)[to] ?? null;
}
