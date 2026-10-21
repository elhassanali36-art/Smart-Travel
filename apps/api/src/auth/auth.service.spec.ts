import { ConfigService } from '../common/config.service';
import { RateLimiter } from '../common/rate-limiter';
import { FakeDb } from '../testing/fake-db';
import { hashOpaqueToken } from './password';
import { AuthService } from './auth.service';

process.env.JWT_SECRET = 'k'.repeat(48);
process.env.NODE_ENV = 'test';

function setup() {
  const db = new FakeDb();
  const limiter = new RateLimiter();
  const svc = new AuthService(db as never, new ConfigService(), limiter);
  return { db, svc, limiter };
}
const reg = { name: 'Alice', email: 'Alice@Example.com', password: 'Str0ng-Passw0rd' };

describe('AuthService.register', () => {
  it('creates an ACTIVE TRAVELER, stores only hashes, never returns the password hash', async () => {
    const { db, svc } = setup();
    const t = await svc.register(reg);
    expect(t.expiresIn).toBe(900);
    const u = db.user.rows[0];
    expect(u.role).toBe('TRAVELER');
    expect(u.status).toBe('ACTIVE');
    expect(u.email).toBe('alice@example.com');
    expect(u.passwordHash.startsWith('scrypt$')).toBe(true);
    expect(u.passwordHash).not.toContain(reg.password);
    expect(JSON.stringify(t)).not.toContain('scrypt');
    expect(db.refreshToken.rows[0].tokenHash).toBe(hashOpaqueToken(t.refreshToken));
    expect(db.refreshToken.rows[0].tokenHash).not.toBe(t.refreshToken);
  });
  it('ignores a client-supplied role or status', async () => {
    const { db, svc } = setup();
    await svc.register({ ...reg, role: 'ADMIN', status: 'SUSPENDED' } as never);
    expect(db.user.rows[0].role).toBe('TRAVELER');
    expect(db.user.rows[0].status).toBe('ACTIVE');
  });
  it('requires email or phone (400) and rejects duplicates (409)', async () => {
    const { svc } = setup();
    await expect(svc.register({ name: 'X', password: 'Str0ng-Passw0rd' })).rejects.toMatchObject({ status: 400 });
    await svc.register(reg);
    await expect(svc.register({ ...reg, email: 'ALICE@example.com' })).rejects.toMatchObject({ status: 409 });
  });
  it('maps a unique-index race (P2002) to 409 instead of 500', async () => {
    const { db, svc } = setup();
    db.failNextCreate = 'user';
    await expect(svc.register(reg)).rejects.toMatchObject({ status: 409 });
  });
});

describe('AuthService.login', () => {
  it('returns tokens for valid credentials', async () => {
    const { svc } = setup();
    await svc.register(reg);
    const t = await svc.login({ email: 'alice@example.com', password: reg.password });
    expect(t.accessToken.split('.')).toHaveLength(3);
    expect(t.refreshToken.length).toBeGreaterThan(40);
  });
  it('gives the same 401 for a wrong password and an unknown account', async () => {
    const { svc } = setup();
    await svc.register(reg);
    let a: any; let b: any;
    try { await svc.login({ email: 'alice@example.com', password: 'wrong-password-1' }); } catch (e) { a = e; }
    try { await svc.login({ email: 'nobody@example.com', password: reg.password }); } catch (e) { b = e; }
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.message).toBe(b.message);
  });
  it('blocks a suspended account only after a correct password', async () => {
    const { db, svc } = setup();
    await svc.register(reg);
    db.user.rows[0].status = 'SUSPENDED';
    await expect(svc.login({ email: 'alice@example.com', password: reg.password })).rejects.toMatchObject({ status: 403 });
    await expect(svc.login({ email: 'alice@example.com', password: 'wrong-password-1' })).rejects.toMatchObject({ status: 401 });
  });
  it('throttles one account after 10 attempts (429) and resets on success', async () => {
    const { svc } = setup();
    await svc.register(reg);
    for (let i = 0; i < 10; i++) await expect(svc.login({ email: 'alice@example.com', password: 'wrong-password-1' })).rejects.toMatchObject({ status: 401 });
    await expect(svc.login({ email: 'alice@example.com', password: reg.password })).rejects.toMatchObject({ status: 429 });
  });
  it('requires an identifier', async () => {
    const { svc } = setup();
    await expect(svc.login({ password: 'x' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('AuthService.verifyAccess / me', () => {
  it('resolves a SafeUser without any security field', async () => {
    const { svc } = setup();
    const t = await svc.register(reg);
    const u = await svc.verifyAccess(t.accessToken);
    expect(Object.keys(u).sort()).toEqual(['id', 'name', 'role', 'status']);
  });
  it('rejects garbage, tampered tokens and suspended users', async () => {
    const { db, svc } = setup();
    const t = await svc.register(reg);
    await expect(svc.verifyAccess('garbage')).rejects.toMatchObject({ status: 401 });
    const [h, p, s] = t.accessToken.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'someone-else', iss: 'smart-travel-api', aud: 'smart-travel-web', exp: 9999999999 })).toString('base64url');
    await expect(svc.verifyAccess(`${h}.${forged}.${s}`)).rejects.toMatchObject({ status: 401 });
    db.user.rows[0].status = 'DISABLED';
    await expect(svc.verifyAccess(t.accessToken)).rejects.toMatchObject({ status: 401 });
  });
  it('me() never includes the password hash', async () => {
    const { db, svc } = setup();
    await svc.register(reg);
    const me = await svc.me(db.user.rows[0].id);
    expect(JSON.stringify(me)).not.toContain('scrypt');
    expect('passwordHash' in me).toBe(false);
  });
});

describe('AuthService.rotate / logout', () => {
  it('rotates the refresh token and revokes the old one', async () => {
    const { db, svc } = setup();
    const t1 = await svc.register(reg);
    const t2 = await svc.rotate(t1.refreshToken);
    expect(t2.refreshToken).not.toBe(t1.refreshToken);
    expect(db.refreshToken.rows).toHaveLength(2);
    expect(db.refreshToken.rows[0].revokedAt).toBeDefined();
    expect(db.refreshToken.rows[0].replacedById).toBe(db.refreshToken.rows[1].id);
  });
  it('detects replay: the old token fails and every session of the user is revoked', async () => {
    const { db, svc } = setup();
    const t1 = await svc.register(reg);
    const t2 = await svc.rotate(t1.refreshToken);
    await expect(svc.rotate(t1.refreshToken)).rejects.toMatchObject({ status: 401 });
    expect(db.refreshToken.rows.every((r) => r.revokedAt !== null)).toBe(true);
    await expect(svc.rotate(t2.refreshToken)).rejects.toMatchObject({ status: 401 });
  });
  it('treats a lost rotation race as replay', async () => {
    const { db, svc } = setup();
    const t1 = await svc.register(reg);
    db.failNextUpdateMany = 'refreshToken'; // the conditional consume matches nothing
    await expect(svc.rotate(t1.refreshToken)).rejects.toMatchObject({ status: 401 });
  });
  it('rejects unknown and expired tokens without revoking other sessions', async () => {
    const { db, svc } = setup();
    const t1 = await svc.register(reg);
    const t2 = await svc.login({ email: 'alice@example.com', password: reg.password });
    await expect(svc.rotate('unknown-token-value')).rejects.toMatchObject({ status: 401 });
    db.refreshToken.rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(svc.rotate(t1.refreshToken)).rejects.toMatchObject({ status: 401 });
    expect(db.refreshToken.rows[1].revokedAt).toBeNull();
    expect((await svc.rotate(t2.refreshToken)).refreshToken.length).toBeGreaterThan(40);
  });
  it('refuses to refresh for a deactivated user and ends their sessions', async () => {
    const { db, svc } = setup();
    const t1 = await svc.register(reg);
    db.user.rows[0].status = 'SUSPENDED';
    await expect(svc.rotate(t1.refreshToken)).rejects.toMatchObject({ status: 403 });
    expect(db.refreshToken.rows.every((r) => r.revokedAt !== null)).toBe(true);
  });
  it('logout revokes the token and is idempotent', async () => {
    const { svc } = setup();
    const t = await svc.register(reg);
    await svc.logout(t.refreshToken);
    await expect(svc.rotate(t.refreshToken)).rejects.toMatchObject({ status: 401 });
    await expect(svc.logout(t.refreshToken)).resolves.toEqual({ success: true });
    await expect(svc.logout('never-issued')).resolves.toEqual({ success: true });
  });
});
