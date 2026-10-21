import { FakeDb } from '../testing/fake-db';
import { ExperiencesService } from './experiences.service';

const dto = { titleEn: 'Tour', titleAr: 'جولة', descriptionEn: 'd', descriptionAr: 'و', category: 'food', priceCents: 1000, durationMinutes: 60, capacity: 3, languages: ['en'], tags: [], destinationId: 'd1' };

function setup() {
  const db = new FakeDb();
  db.destination.rows.push({ id: 'd1' });
  db.hostProfile.rows.push({ id: 'hp1', userId: 'h1' }, { id: 'hp2', userId: 'h2' });
  return { db, svc: new ExperiencesService(db as never) };
}

describe('ExperiencesService', () => {
  it('create needs a host profile and an existing destination, and binds the experience to the caller', async () => {
    const { svc } = setup();
    await expect(svc.create('nobody', dto)).rejects.toMatchObject({ status: 403 });
    await expect(svc.create('h1', { ...dto, destinationId: 'missing' })).rejects.toMatchObject({ status: 404 });
    const e = await svc.create('h1', dto);
    expect(e.hostProfileId).toBe('hp1');
  });
  it("a host cannot update another host's experience (404) but can edit and deactivate their own", async () => {
    const { db, svc } = setup();
    const e = await svc.create('h1', dto);
    await expect(svc.update('h2', e.id, { titleEn: 'Hijacked' })).rejects.toMatchObject({ status: 404 });
    expect(db.experience.rows[0].titleEn).toBe('Tour');
    expect((await svc.update('h1', e.id, { capacity: 5 })).capacity).toBe(5);
    expect((await svc.update('h1', e.id, { active: false })).active).toBe(false);
    await expect(svc.update('h1', 'missing', { capacity: 1 })).rejects.toMatchObject({ status: 404 });
  });
  it('update ignores absent (undefined) DTO fields', async () => {
    const { svc } = setup();
    const e = await svc.create('h1', dto);
    const u = await svc.update('h1', e.id, { titleEn: undefined, capacity: 2 } as never);
    expect(u.titleEn).toBe('Tour');
    expect(u.capacity).toBe(2);
  });
  it('mine() returns only the caller experiences, including inactive ones', async () => {
    const { svc } = setup();
    const a = await svc.create('h1', dto);
    await svc.create('h2', dto);
    await svc.update('h1', a.id, { active: false });
    const mine = await svc.mine('h1');
    expect(mine).toHaveLength(1);
    expect(mine[0].active).toBe(false);
  });
});
