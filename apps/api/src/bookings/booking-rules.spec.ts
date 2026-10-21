import { ACTIVE_STATUSES, actorFor, evaluate, isOverdue, nextExpiry, timestampFieldFor, USER_SETTABLE } from './booking-rules';

const H = 3_600_000;
const now = new Date('2026-06-01T12:00:00Z');
const at = (hours: number) => new Date(now.getTime() + hours * H);
const facts = (status: string, over: Partial<{ startsAt: Date; endsAt: Date; expiresAt: Date | null }> = {}) => ({ status, startsAt: at(24), endsAt: at(26), expiresAt: at(10), ...over });
const ok = (a: any, to: string, f: any) => evaluate(a, to, f, now).ok;

describe('actorFor', () => {
  const b = { hostId: 'H', travelerId: 'T' };
  it('maps participants only; admins and strangers get no user workflow', () => {
    expect(actorFor('LOCAL_HOST', 'H', b)).toBe('HOST');
    expect(actorFor('TRAVELER', 'T', b)).toBe('TRAVELER');
    expect(actorFor('TRAVELER', 'H', b)).toBeNull();
    expect(actorFor('LOCAL_HOST', 'T', b)).toBeNull();
    expect(actorFor('ADMIN', 'H', b)).toBeNull();
    expect(actorFor('TRAVELER', 'X', b)).toBeNull();
  });
});

describe('happy path', () => {
  it('REQUESTED -> ACCEPTED (host) -> CONFIRMED (traveler) -> COMPLETED after the session ends', () => {
    expect(ok('HOST', 'ACCEPTED', facts('REQUESTED'))).toBe(true);
    expect(ok('TRAVELER', 'CONFIRMED', facts('ACCEPTED'))).toBe(true);
    const done = facts('CONFIRMED', { startsAt: at(-3), endsAt: at(-1), expiresAt: null });
    expect(ok('HOST', 'COMPLETED', done)).toBe(true);
    expect(ok('TRAVELER', 'COMPLETED', done)).toBe(true);
  });
  it('host can reject; both sides can cancel before the start', () => {
    expect(ok('HOST', 'REJECTED', facts('REQUESTED'))).toBe(true);
    expect(ok('TRAVELER', 'CANCELLED', facts('REQUESTED'))).toBe(true);
    expect(ok('TRAVELER', 'CANCELLED', facts('ACCEPTED'))).toBe(true);
    expect(ok('TRAVELER', 'CANCELLED', facts('CONFIRMED', { expiresAt: null }))).toBe(true);
    expect(ok('HOST', 'CANCELLED', facts('ACCEPTED'))).toBe(true);
    expect(ok('HOST', 'CANCELLED', facts('CONFIRMED', { expiresAt: null }))).toBe(true);
  });
});

describe('role separation', () => {
  it('traveler cannot act as host and host cannot act as traveler', () => {
    expect(ok('TRAVELER', 'ACCEPTED', facts('REQUESTED'))).toBe(false);
    expect(ok('TRAVELER', 'REJECTED', facts('REQUESTED'))).toBe(false);
    expect(ok('HOST', 'CONFIRMED', facts('ACCEPTED'))).toBe(false);
    expect(ok('HOST', 'CANCELLED', facts('REQUESTED'))).toBe(false); // hosts reject instead
  });
  it('admin and system have no user transitions', () => {
    for (const to of USER_SETTABLE) {
      expect(ok('ADMIN', to, facts('REQUESTED'))).toBe(false);
      expect(ok('SYSTEM', to, facts('REQUESTED'))).toBe(false);
    }
  });
});

describe('time rules', () => {
  it('cannot complete before the session ends or confirm/accept after it started', () => {
    expect(ok('HOST', 'COMPLETED', facts('CONFIRMED', { expiresAt: null }))).toBe(false);
    const started = { startsAt: at(-1), endsAt: at(1) };
    expect(ok('HOST', 'COMPLETED', facts('CONFIRMED', { ...started, expiresAt: null }))).toBe(false);
    expect(ok('TRAVELER', 'CONFIRMED', facts('ACCEPTED', started))).toBe(false);
    expect(ok('HOST', 'ACCEPTED', facts('REQUESTED', started))).toBe(false);
    expect(ok('TRAVELER', 'CANCELLED', facts('CONFIRMED', { ...started, expiresAt: null }))).toBe(false);
  });
  it('an overdue pending booking cannot be acted on', () => {
    expect(ok('HOST', 'ACCEPTED', facts('REQUESTED', { expiresAt: at(-1) }))).toBe(false);
    expect(ok('TRAVELER', 'CONFIRMED', facts('ACCEPTED', { expiresAt: at(-1) }))).toBe(false);
  });
});

describe('expiry', () => {
  it('only the system expires, only overdue REQUESTED/ACCEPTED bookings', () => {
    expect(ok('SYSTEM', 'EXPIRED', facts('REQUESTED', { expiresAt: at(-1) }))).toBe(true);
    expect(ok('SYSTEM', 'EXPIRED', facts('ACCEPTED', { expiresAt: at(-1) }))).toBe(true);
    expect(ok('SYSTEM', 'EXPIRED', facts('REQUESTED'))).toBe(false);
    expect(ok('SYSTEM', 'EXPIRED', facts('CONFIRMED', { expiresAt: at(-1) }))).toBe(false);
    expect(ok('HOST', 'EXPIRED', facts('REQUESTED', { expiresAt: at(-1) }))).toBe(false);
  });
  it('isOverdue and nextExpiry', () => {
    expect(isOverdue({ status: 'REQUESTED', expiresAt: at(-1) }, now)).toBe(true);
    expect(isOverdue({ status: 'CONFIRMED', expiresAt: at(-1) }, now)).toBe(false);
    expect(isOverdue({ status: 'REQUESTED', expiresAt: null }, now)).toBe(false);
    expect(nextExpiry(now, at(100)).getTime()).toBe(at(48).getTime());
    expect(nextExpiry(now, at(5)).getTime()).toBe(at(5).getTime()); // never later than the start
  });
});

describe('disputes', () => {
  it('participants may dispute a started CONFIRMED booking or a recently COMPLETED one', () => {
    const started = { startsAt: at(-3), endsAt: at(-1), expiresAt: null };
    expect(ok('TRAVELER', 'DISPUTED', facts('CONFIRMED', started))).toBe(true);
    expect(ok('HOST', 'DISPUTED', facts('COMPLETED', started))).toBe(true);
    expect(ok('TRAVELER', 'DISPUTED', facts('CONFIRMED'))).toBe(false); // not started: cancel instead
    expect(ok('TRAVELER', 'DISPUTED', facts('REQUESTED'))).toBe(false);
    expect(ok('TRAVELER', 'DISPUTED', facts('COMPLETED', { startsAt: at(-24 * 20), endsAt: at(-24 * 20 + 2), expiresAt: null }))).toBe(false); // window closed
    expect(ok('ADMIN', 'DISPUTED', facts('CONFIRMED', started))).toBe(false);
  });
  it('only an administrator resolves, to COMPLETED or CANCELLED', () => {
    const d = facts('DISPUTED', { expiresAt: null });
    expect(ok('ADMIN', 'COMPLETED', d)).toBe(true);
    expect(ok('ADMIN', 'CANCELLED', d)).toBe(true);
    expect(ok('ADMIN', 'CONFIRMED', d)).toBe(false);
    expect(ok('HOST', 'COMPLETED', d)).toBe(false);
    expect(ok('TRAVELER', 'CANCELLED', d)).toBe(false);
  });
});

describe('terminal states and review', () => {
  it('nothing leaves a terminal state through the user workflow', () => {
    for (const from of ['REJECTED', 'CANCELLED', 'EXPIRED', 'REVIEWED']) {
      for (const actor of ['HOST', 'TRAVELER'] as const) for (const to of ['REQUESTED', 'ACCEPTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']) expect(ok(actor, to, facts(from, { expiresAt: null }))).toBe(false);
    }
  });
  it('COMPLETED is not reversible and REVIEWED is system-only after COMPLETED', () => {
    const c = facts('COMPLETED', { startsAt: at(-3), endsAt: at(-1), expiresAt: null });
    for (const to of ['REQUESTED', 'ACCEPTED', 'CONFIRMED', 'CANCELLED']) expect(ok('HOST', to, c)).toBe(false);
    expect(ok('SYSTEM', 'REVIEWED', c)).toBe(true);
    expect(ok('TRAVELER', 'REVIEWED', c)).toBe(false);
    expect(ok('SYSTEM', 'REVIEWED', facts('CONFIRMED'))).toBe(false);
  });
  it('unknown targets are rejected and the settable list excludes system statuses', () => {
    expect(ok('HOST', 'NOPE', facts('REQUESTED'))).toBe(false);
    for (const s of ['REVIEWED', 'EXPIRED', 'DISPUTED', 'REQUESTED']) expect((USER_SETTABLE as readonly string[]).includes(s)).toBe(false);
    expect([...ACTIVE_STATUSES]).toEqual(['REQUESTED', 'ACCEPTED', 'CONFIRMED']);
    expect(timestampFieldFor('ACCEPTED')).toBe('acceptedAt');
    expect(timestampFieldFor('REJECTED')).toBeNull();
  });
});
