import { NotificationsService } from '../notifications/notifications.service';
import { FakeDb } from '../testing/fake-db';
import { MessagingService } from './messaging.service';

function setup() {
  const db = new FakeDb();
  db.user.rows.push({ id: 'u1', status: 'ACTIVE' }, { id: 'u2', status: 'ACTIVE' }, { id: 'u3', status: 'SUSPENDED' });
  return { db, svc: new MessagingService(db as never, new NotificationsService(db as never)) };
}

describe('MessagingService', () => {
  it('uses the authenticated sender, trims the body and notifies the recipient', async () => {
    const { db, svc } = setup();
    const m = await svc.send('u1', { recipientId: 'u2', body: '  hello  ' });
    expect(m).toMatchObject({ senderId: 'u1', recipientId: 'u2', body: 'hello' });
    expect(db.notification.rows[0].userId).toBe('u2');
  });
  it('rejects self messages, blank bodies, unknown and inactive recipients', async () => {
    const { svc } = setup();
    await expect(svc.send('u1', { recipientId: 'u1', body: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.send('u1', { recipientId: 'u2', body: '   ' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.send('u1', { recipientId: 'missing', body: 'x' })).rejects.toMatchObject({ status: 404 });
    await expect(svc.send('u1', { recipientId: 'u3', body: 'x' })).rejects.toMatchObject({ status: 403 });
  });
  it('lists only messages the caller sent or received', async () => {
    const { svc } = setup();
    await svc.send('u1', { recipientId: 'u2', body: 'a' });
    expect(await svc.list('u1')).toHaveLength(1);
    expect(await svc.list('u2')).toHaveLength(1);
    expect(await svc.list('u3')).toHaveLength(0);
  });
  it('returns the NEWEST 200 messages, oldest first (regression: old code returned the oldest 200)', async () => {
    const { db, svc } = setup();
    for (let i = 0; i < 250; i++) db.message.rows.push({ id: `m${String(i).padStart(3, '0')}`, senderId: 'u1', recipientId: 'u2', body: `msg ${i}`, createdAt: new Date(2026, 0, 1, 0, 0, i) });
    const list = await svc.list('u1');
    expect(list).toHaveLength(200);
    expect(list[0].body).toBe('msg 50');
    expect(list[199].body).toBe('msg 249');
  });
});
