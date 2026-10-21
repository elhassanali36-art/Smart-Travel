import { NotificationsService } from '../notifications/notifications.service';
import { FakeDb } from '../testing/fake-db';
import { ReviewsService } from './reviews.service';

function setup(status = 'COMPLETED') {
  const db = new FakeDb();
  db.booking.rows.push({ id: 'b1', travelerId: 't1', hostId: 'h1', status });
  return { db, svc: new ReviewsService(db as never, new NotificationsService(db as never)) };
}

describe('ReviewsService.create', () => {
  it('lets the traveler review a COMPLETED booking: booking becomes REVIEWED, host is notified', async () => {
    const { db, svc } = setup();
    const r = await svc.create('t1', 'b1', { rating: 5, comment: ' great ' });
    expect(r).toMatchObject({ bookingId: 'b1', rating: 5, comment: 'great' });
    expect(db.booking.rows[0].status).toBe('REVIEWED');
    expect(db.review.rows[0]).toMatchObject({ authorId: 't1', subjectId: 'h1' });
    expect(db.notification.rows[0].userId).toBe('h1');
  });
  it('does not let the host (or a stranger) review, so the host cannot lock the traveler out', async () => {
    const { db, svc } = setup();
    await expect(svc.create('h1', 'b1', { rating: 5 })).rejects.toMatchObject({ status: 404 });
    await expect(svc.create('someone', 'b1', { rating: 5 })).rejects.toMatchObject({ status: 404 });
    expect(db.booking.rows[0].status).toBe('COMPLETED');
    await expect(svc.create('t1', 'b1', { rating: 4 })).resolves.toBeDefined();
  });
  it('requires a COMPLETED booking and rejects a second review', async () => {
    for (const s of ['REQUESTED', 'ACCEPTED', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'DISPUTED']) {
      await expect(setup(s).svc.create('t1', 'b1', { rating: 5 })).rejects.toMatchObject({ status: 400 });
    }
    const { svc } = setup();
    await svc.create('t1', 'b1', { rating: 5 });
    await expect(svc.create('t1', 'b1', { rating: 5 })).rejects.toMatchObject({ status: 400 });
    await expect(svc.create('t1', 'missing', { rating: 5 })).rejects.toMatchObject({ status: 404 });
  });
  it('maps a concurrent duplicate (lost conditional update or unique index) to 409', async () => {
    const a = setup();
    a.db.failNextUpdateMany = 'booking';
    await expect(a.svc.create('t1', 'b1', { rating: 5 })).rejects.toMatchObject({ status: 409 });
    const b = setup();
    b.db.failNextCreate = 'review';
    await expect(b.svc.create('t1', 'b1', { rating: 5 })).rejects.toMatchObject({ status: 409 });
  });
  it('list() exposes only safe review fields', async () => {
    const { db, svc } = setup();
    await svc.create('t1', 'b1', { rating: 5 });
    const rows = await svc.list('h1');
    expect(rows).toHaveLength(1);
    expect(db.calls.pop()!.table).toBe('review');
  });
});
