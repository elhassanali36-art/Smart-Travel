import { FakeDb } from '../testing/fake-db';
import { TripsService } from './trips.service';

function setup() {
  const db = new FakeDb();
  db.destination.rows.push({ id: 'd1' });
  db.experience.rows.push({ id: 'e1', active: true }, { id: 'e2', active: false });
  return { db, svc: new TripsService(db as never) };
}

describe('trip ownership', () => {
  it("returns 404 (not 403) for another user's trip on every operation", async () => {
    const { svc } = setup();
    const trip = await svc.create('t1', { title: 'Mine' });
    const item = await svc.addItineraryItem('t1', trip.id, { dayNumber: 1, title: 'Walk' });
    await expect(svc.update('t2', trip.id, { title: 'Hacked' })).rejects.toMatchObject({ status: 404 });
    await expect(svc.addItineraryItem('t2', trip.id, { dayNumber: 1, title: 'x' })).rejects.toMatchObject({ status: 404 });
    await expect(svc.updateItineraryItem('t2', trip.id, item.id, { dayNumber: 1, title: 'x' })).rejects.toMatchObject({ status: 404 });
    await expect(svc.deleteItineraryItem('t2', trip.id, item.id)).rejects.toMatchObject({ status: 404 });
  });
  it('an itinerary item can only be reached through its own trip', async () => {
    const { svc } = setup();
    const a = await svc.create('t1', { title: 'A' });
    const b = await svc.create('t1', { title: 'B' });
    const item = await svc.addItineraryItem('t1', a.id, { dayNumber: 1, title: 'Walk' });
    await expect(svc.updateItineraryItem('t1', b.id, item.id, { dayNumber: 2, title: 'moved' })).rejects.toMatchObject({ status: 404 });
    await expect(svc.deleteItineraryItem('t1', b.id, item.id)).rejects.toMatchObject({ status: 404 });
    await expect(svc.deleteItineraryItem('t1', a.id, item.id)).resolves.toEqual({ success: true });
  });
});

describe('trip validation', () => {
  it('rejects blank titles, inverted dates, unknown destinations and inactive experiences', async () => {
    const { svc } = setup();
    await expect(svc.create('t1', { title: '   ' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.create('t1', { title: 'x', startDate: '2026-02-10', endDate: '2026-02-01' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.create('t1', { title: 'x', destinationId: 'nope' })).rejects.toMatchObject({ status: 404 });
    const trip = await svc.create('t1', { title: 'ok', destinationId: 'd1', startDate: '2026-02-01', endDate: '2026-02-10' });
    await expect(svc.update('t1', trip.id, { endDate: '2026-01-01' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.addItineraryItem('t1', trip.id, { dayNumber: 1, title: 'x', experienceId: 'e2' })).rejects.toMatchObject({ status: 404 });
    await expect(svc.addItineraryItem('t1', trip.id, { dayNumber: 1, title: 'x', startTime: '2026-02-02T12:00:00Z', endTime: '2026-02-02T10:00:00Z' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.addItineraryItem('t1', trip.id, { dayNumber: 1, title: 'x', experienceId: 'e1' })).resolves.toBeDefined();
  });
});
