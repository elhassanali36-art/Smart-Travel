import { NotificationsService } from '../notifications/notifications.service';
import { FakeDb } from '../testing/fake-db';
import { BookingsService } from './bookings.service';

const H = 3_600_000;
const hours = (h: number) => new Date(Date.now() + h * H);
const iso = (h: number) => hours(h).toISOString();
const T = { id: 't1', name: 'Traveler', role: 'TRAVELER', status: 'ACTIVE' } as const;
const T2 = { id: 't2', name: 'Traveler 2', role: 'TRAVELER', status: 'ACTIVE' } as const;
const HOST = { id: 'h1', name: 'Host', role: 'LOCAL_HOST', status: 'ACTIVE' } as const;
const ADMIN = { id: 'a1', name: 'Admin', role: 'ADMIN', status: 'ACTIVE' } as const;

function setup(over: { capacity?: number; duration?: number } = {}) {
  const db = new FakeDb();
  db.user.rows.push({ id: 'h1', status: 'ACTIVE', role: 'LOCAL_HOST' });
  db.hostProfile.rows.push({ id: 'hp1', userId: 'h1' });
  db.experience.rows.push({ id: 'e1', hostProfileId: 'hp1', active: true, capacity: over.capacity ?? 4, durationMinutes: over.duration ?? 120 });
  db.trip.rows.push({ id: 'trip-t1', travelerId: 't1' });
  const svc = new BookingsService(db as never, new NotificationsService(db as never));
  const book = (u: typeof T | typeof T2, startH: number, guests = 1, extra: object = {}) => svc.create(u, { experienceId: 'e1', startsAt: iso(startH), guests, ...extra });
  return { db, svc, book };
}

describe('BookingsService.create', () => {
  it('stores schedule, guests and a response deadline; notifies the host', async () => {
    const { db, book } = setup();
    const b = await book(T, 48, 2);
    expect(b.status).toBe('REQUESTED');
    expect(b.guests).toBe(2);
    expect(b.endsAt.getTime() - b.startsAt.getTime()).toBe(120 * 60_000);
    expect(b.expiresAt.getTime()).toBeGreaterThan(Date.now() + 47 * H);
    expect(b.hostId).toBe('h1');
    expect(db.notification.rows[0].userId).toBe('h1');
  });
  it('caps the response deadline at the session start', async () => {
    const { book } = setup();
    const b = await book(T, 5);
    expect(b.expiresAt.getTime()).toBe(b.startsAt.getTime());
  });
  it('rejects bad dates, oversized parties, wrong roles and unavailable experiences', async () => {
    const { db, svc, book } = setup();
    await expect(book(T, -2)).rejects.toMatchObject({ status: 400 });
    await expect(book(T, 24 * 400)).rejects.toMatchObject({ status: 400 });
    await expect(book(T, 24, 5)).rejects.toMatchObject({ status: 400 });
    await expect(svc.create(HOST as never, { experienceId: 'e1', startsAt: iso(24), guests: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(svc.create(ADMIN as never, { experienceId: 'e1', startsAt: iso(24), guests: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(svc.create(T, { experienceId: 'missing', startsAt: iso(24), guests: 1 })).rejects.toMatchObject({ status: 404 });
    db.experience.rows[0].active = false;
    await expect(book(T, 24)).rejects.toMatchObject({ status: 404 });
    db.experience.rows[0].active = true;
    db.user.rows[0].status = 'SUSPENDED';
    await expect(book(T, 24)).rejects.toMatchObject({ status: 404 });
  });
  it("refuses another traveler's trip", async () => {
    const { book } = setup();
    await expect(book(T2, 24, 1, { tripId: 'trip-t1' })).rejects.toMatchObject({ status: 404 });
    await expect(book(T, 24, 1, { tripId: 'trip-t1' })).resolves.toBeDefined();
  });
});

describe('capacity per time slot', () => {
  it('sums guests of overlapping bookings and stops at capacity', async () => {
    const { book } = setup({ capacity: 4 });
    await book(T, 48, 3);
    await expect(book(T2, 48, 2)).rejects.toMatchObject({ status: 400 });
    await expect(book(T2, 49, 2)).rejects.toMatchObject({ status: 400 }); // overlaps the second hour
    await expect(book(T2, 48, 1)).resolves.toBeDefined();
  });
  it('allows back-to-back sessions at full capacity', async () => {
    const { book } = setup({ capacity: 4, duration: 120 });
    await book(T, 48, 4);
    await expect(book(T2, 50, 4)).resolves.toBeDefined(); // starts exactly when the first ends
  });
  it('cancelled bookings free their seats', async () => {
    const { svc, book } = setup({ capacity: 2 });
    const b = await book(T, 48, 2);
    await expect(book(T2, 48, 1)).rejects.toMatchObject({ status: 400 });
    await svc.transition(T, b.id, 'CANCELLED');
    await expect(book(T2, 48, 2)).resolves.toBeDefined();
  });
  it('overdue pending requests do not hold seats and become EXPIRED', async () => {
    const { db, book } = setup({ capacity: 2 });
    const b = await book(T, 48, 2);
    db.booking.rows[0].expiresAt = hours(-1);
    await expect(book(T2, 48, 2)).resolves.toBeDefined();
    expect(db.booking.rows.find((r) => r.id === b.id)!.status).toBe('EXPIRED');
  });
  it('rejects a second open booking by the same traveler for an overlapping time', async () => {
    const { book } = setup();
    await book(T, 48, 1);
    await expect(book(T, 48, 1)).rejects.toMatchObject({ status: 409 });
    await expect(book(T, 49, 1)).rejects.toMatchObject({ status: 409 });
    await expect(book(T, 96, 1)).resolves.toBeDefined();
  });
});

describe('BookingsService.transition', () => {
  it('runs REQUESTED -> ACCEPTED -> CONFIRMED -> COMPLETED with deadlines and timestamps', async () => {
    const { db, svc, book } = setup();
    const b = await book(T, 72);
    const a = await svc.transition(HOST as never, b.id, 'ACCEPTED');
    expect(a.status).toBe('ACCEPTED');
    expect(a.acceptedAt).toBeDefined();
    expect(a.expiresAt).not.toBeNull();
    const c = await svc.transition(T, b.id, 'CONFIRMED');
    expect(c.status).toBe('CONFIRMED');
    expect(c.expiresAt).toBeNull();
    await expect(svc.transition(HOST as never, b.id, 'COMPLETED')).rejects.toMatchObject({ status: 400 }); // not ended yet
    const row = db.booking.rows[0];
    row.startsAt = hours(-3); row.endsAt = hours(-1);
    const d = await svc.transition(HOST as never, b.id, 'COMPLETED');
    expect(d.status).toBe('COMPLETED');
    expect(d.completedAt).toBeDefined();
    expect(db.notification.rows.length).toBeGreaterThan(2);
  });
  it('rejects invalid actors, participants and statuses', async () => {
    const { svc, book } = setup();
    const b = await book(T, 72);
    await expect(svc.transition(T, b.id, 'ACCEPTED')).rejects.toMatchObject({ status: 400 });
    await expect(svc.transition(HOST as never, b.id, 'CONFIRMED')).rejects.toMatchObject({ status: 400 });
    await expect(svc.transition(T2, b.id, 'CANCELLED')).rejects.toMatchObject({ status: 404 }); // not a participant
    await expect(svc.transition(ADMIN as never, b.id, 'CANCELLED')).rejects.toMatchObject({ status: 403 });
    await expect(svc.transition({ ...HOST, id: 'other-host' } as never, b.id, 'ACCEPTED')).rejects.toMatchObject({ status: 404 });
    for (const s of ['REVIEWED', 'EXPIRED', 'DISPUTED', 'REQUESTED']) await expect(svc.transition(T, b.id, s as never)).rejects.toMatchObject({ status: 400 });
    await expect(svc.transition(T, 'unknown', 'CANCELLED')).rejects.toMatchObject({ status: 404 });
  });
  it('never reopens a rejected or cancelled booking', async () => {
    const { svc, book } = setup();
    const b = await book(T, 72);
    await svc.transition(HOST as never, b.id, 'REJECTED');
    for (const s of ['ACCEPTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']) await expect(svc.transition(HOST as never, b.id, s as never)).rejects.toMatchObject({ status: 400 });
    await expect(svc.transition(T, b.id, 'CONFIRMED')).rejects.toMatchObject({ status: 400 });
  });
  it('returns 409 when the status changed concurrently (conditional update)', async () => {
    const { db, svc, book } = setup();
    const b = await book(T, 72);
    db.failNextUpdateMany = 'booking';
    await expect(svc.transition(HOST as never, b.id, 'ACCEPTED')).rejects.toMatchObject({ status: 409 });
    expect(db.booking.rows[0].status).toBe('REQUESTED');
  });
  it('expires an overdue booking when someone acts on it', async () => {
    const { db, svc, book } = setup();
    const b = await book(T, 72);
    db.booking.rows[0].expiresAt = hours(-1);
    await expect(svc.transition(HOST as never, b.id, 'ACCEPTED')).rejects.toMatchObject({ status: 409 });
    expect(db.booking.rows[0].status).toBe('EXPIRED');
    await expect(svc.transition(HOST as never, b.id, 'ACCEPTED')).rejects.toMatchObject({ status: 400 });
  });
});

describe('expiry and listing', () => {
  it('list() expires overdue bookings first; hosts never receive the traveler trip', async () => {
    const { db, svc, book } = setup();
    await book(T, 72);
    db.booking.rows[0].expiresAt = hours(-1);
    await svc.list(HOST as never);
    expect(db.booking.rows[0].status).toBe('EXPIRED');
    const calls = db.calls.filter((c) => c.op === 'findMany');
    expect(calls[calls.length - 1].args.include.trip).toBeUndefined();
    await svc.list(T);
    expect(db.calls.filter((c) => c.op === 'findMany').pop()!.args.include.trip).toBe(true);
  });
  it('expireOverdueAudited counts and audits', async () => {
    const { db, svc, book } = setup();
    await book(T, 72);
    db.booking.rows[0].expiresAt = hours(-1);
    expect(await svc.expireOverdueAudited('a1')).toEqual({ expired: 1 });
    expect(db.auditLog.rows[0]).toMatchObject({ actorId: 'a1', action: 'BOOKINGS_EXPIRED' });
  });
});

describe('disputes', () => {
  async function confirmedStarted() {
    const ctx = setup();
    const b = await ctx.book(T, 72);
    await ctx.svc.transition(HOST as never, b.id, 'ACCEPTED');
    await ctx.svc.transition(T, b.id, 'CONFIRMED');
    return { ...ctx, b };
  }
  it('a participant opens a dispute with a persisted reason after the session started', async () => {
    const { db, svc, b } = await confirmedStarted();
    await expect(svc.dispute(T, b.id, 'The host never showed up at the place')).rejects.toMatchObject({ status: 400 }); // not started
    db.booking.rows[0].startsAt = hours(-3); db.booking.rows[0].endsAt = hours(-1);
    await expect(svc.dispute(T, b.id, 'too short')).rejects.toMatchObject({ status: 400 });
    const d = await svc.dispute(T, b.id, 'The host never showed up at the place');
    expect(d).toMatchObject({ status: 'DISPUTED', disputedById: 't1', disputeReason: 'The host never showed up at the place' });
    expect(d.disputedAt).toBeDefined();
  });
  it('strangers cannot dispute and admins resolve through the audited admin path only', async () => {
    const { db, svc, b } = await confirmedStarted();
    db.booking.rows[0].startsAt = hours(-3); db.booking.rows[0].endsAt = hours(-1);
    await expect(svc.dispute(T2, b.id, 'I was not part of this booking')).rejects.toMatchObject({ status: 404 });
    await expect(svc.dispute(ADMIN as never, b.id, 'Admins use the resolve endpoint')).rejects.toMatchObject({ status: 403 });
    await svc.dispute(HOST as never, b.id, 'The traveler did not pay on site');
    await expect(svc.transition(T, b.id, 'CANCELLED')).rejects.toMatchObject({ status: 400 });
    const r = await svc.resolve('a1', b.id, 'COMPLETED', 'Evidence reviewed: session took place');
    expect(r).toMatchObject({ status: 'COMPLETED', resolutionNote: 'Evidence reviewed: session took place' });
    expect(db.auditLog.rows[0]).toMatchObject({ actorId: 'a1', action: 'BOOKING_DISPUTE_RESOLVED', targetId: b.id });
    await expect(svc.resolve('a1', b.id, 'CANCELLED', 'again')).rejects.toMatchObject({ status: 400 });
  });
  it('cannot resolve a booking that is not disputed', async () => {
    const { svc, book } = setup();
    const b = await book(T, 72);
    await expect(svc.resolve('a1', b.id, 'COMPLETED', 'no dispute here')).rejects.toMatchObject({ status: 400 });
    await expect(svc.resolve('a1', 'missing', 'COMPLETED', 'no booking')).rejects.toMatchObject({ status: 404 });
  });
});
