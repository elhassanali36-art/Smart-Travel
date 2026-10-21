import { FakeDb } from '../testing/fake-db';
import { ProfilesService } from './profiles.service';

function setup() {
  const db = new FakeDb();
  db.user.rows.push({ id: 'u1', name: 'Alice', email: 'secret@x.co', phone: '+249900000000', passwordHash: 'scrypt$aa$bb', role: 'TRAVELER', status: 'ACTIVE' });
  db.user.rows.push({ id: 'h1', name: 'Host', email: 'host@x.co', passwordHash: 'scrypt$aa$bb', role: 'LOCAL_HOST', status: 'ACTIVE' });
  db.user.rows.push({ id: 'a1', name: 'Admin', passwordHash: 'x', role: 'ADMIN', status: 'ACTIVE' });
  db.user.rows.push({ id: 's1', name: 'Suspended', passwordHash: 'x', role: 'TRAVELER', status: 'SUSPENDED' });
  return { db, svc: new ProfilesService(db as never) };
}

describe('traveler profile', () => {
  it('computes completion from the merged record, so partial updates keep earlier fields', async () => {
    const { svc } = setup();
    await svc.traveler('u1', { bio: 'Hello', country: 'Sudan', languages: ['ar'], interests: ['food'] } as never);
    const second = await svc.traveler('u1', { bio: 'New bio' } as never);
    expect(second.completion).toBe(50); // 4 of 8 fields still counted
    expect(second.country).toBe('Sudan');
  });
  it('ignores declared-but-absent (undefined) DTO fields instead of overwriting stored data', async () => {
    const { svc } = setup();
    await svc.traveler('u1', { bio: 'kept', country: 'Egypt' } as never);
    const r = await svc.traveler('u1', { bio: undefined, country: 'Sudan', languages: undefined } as never);
    expect(r.bio).toBe('kept');
    expect(r.country).toBe('Sudan');
  });
  it('writes only to the caller profile', async () => {
    const { db, svc } = setup();
    await svc.traveler('u1', { bio: 'mine' } as never);
    expect(db.travelerProfile.rows).toHaveLength(1);
    expect(db.travelerProfile.rows[0].userId).toBe('u1');
  });
});

describe('host profile', () => {
  it('requires the LOCAL_HOST (or ADMIN) role', async () => {
    const { svc } = setup();
    await expect(svc.host('u1', { city: 'Khartoum' } as never)).rejects.toMatchObject({ status: 403 });
    await expect(svc.host('s1', { city: 'x' } as never)).rejects.toMatchObject({ status: 403 });
    const p = await svc.host('h1', { city: 'Khartoum', country: 'Sudan' } as never);
    expect(p.completion).toBe(29);
  });
  it('cannot be used to set verification (the DTO has no such field; the service never copies it)', async () => {
    const { db, svc } = setup();
    await svc.host('h1', { city: 'K' } as never);
    expect(db.hostProfile.rows[0].verification).toBeUndefined();
  });
});

describe('public profile', () => {
  it('never exposes email, phone, hash or status', async () => {
    const { svc } = setup();
    await svc.traveler('u1', { bio: 'Hi', budgetLevel: 5, accessibilityNeeds: ['wheelchair'], country: 'Sudan' } as never);
    const p = await svc.publicProfile('u1');
    const json = JSON.stringify(p);
    for (const secret of ['secret@x.co', '+249900000000', 'scrypt', 'passwordHash', 'email', 'phone', 'wheelchair', 'accessibilityNeeds', 'budgetLevel']) expect(json).not.toContain(secret);
    expect(p.name).toBe('Alice');
  });
  it('hides suspended users and administrators, and unknown ids (404)', async () => {
    const { svc } = setup();
    for (const id of ['s1', 'a1', 'missing']) await expect(svc.publicProfile(id)).rejects.toMatchObject({ status: 404 });
  });
  it('maps raw verification states to VERIFIED/UNVERIFIED only', async () => {
    const { db, svc } = setup();
    await svc.host('h1', { city: 'K' } as never);
    db.hostProfile.rows[0].verification = 'REJECTED';
    expect((await svc.publicProfile('h1')).hostProfile!.verification).toBe('UNVERIFIED');
    db.hostProfile.rows[0].verification = 'VERIFIED';
    expect((await svc.publicProfile('h1')).hostProfile!.verification).toBe('VERIFIED');
  });
  it('lists only active experiences of the host', async () => {
    const { db, svc } = setup();
    await svc.host('h1', { city: 'K' } as never);
    const hp = db.hostProfile.rows[0].id;
    db.experience.rows.push({ id: 'e1', hostProfileId: hp, active: true, titleEn: 'A', capacity: 1 }, { id: 'e2', hostProfileId: hp, active: false, titleEn: 'B', capacity: 1 });
    const p = await svc.publicProfile('h1');
    expect(p.hostProfile!.experiences).toHaveLength(1);
    expect(p.hostProfile!.experiences[0].titleEn).toBe('A');
  });
});
