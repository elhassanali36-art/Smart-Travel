import { AuthGuard } from './auth.guard';

const ctx = (req: any) => ({ switchToHttp: () => ({ getRequest: () => req }), getHandler: () => 'h', getClass: () => 'c' }) as never;
const reflector = (meta: Record<string, unknown>) => ({ getAllAndOverride: (k: string) => meta[k] }) as never;
const user = { id: 'u1', name: 'U', role: 'TRAVELER', status: 'ACTIVE' };
const auth = { verifyAccess: async (t: string) => { if (t === 'good') return user; throw Object.assign(new Error('x'), { status: 401 }); } } as never;

describe('AuthGuard', () => {
  it('lets @Public() routes through', async () => {
    expect(await new AuthGuard(auth, reflector({ public: true })).canActivate(ctx({ headers: {} }))).toBe(true);
  });
  it('requires a Bearer token on every other route (401)', async () => {
    const g = new AuthGuard(auth, reflector({}));
    await expect(g.canActivate(ctx({ headers: {} }))).rejects.toMatchObject({ status: 401 });
    await expect(g.canActivate(ctx({ headers: { authorization: 'Basic x' } }))).rejects.toMatchObject({ status: 401 });
    await expect(g.canActivate(ctx({ headers: { authorization: 'Bearer bad' } }))).rejects.toMatchObject({ status: 401 });
  });
  it('attaches the verified identity and enforces roles (403)', async () => {
    const req: any = { headers: { authorization: 'Bearer good' }, body: { role: 'ADMIN' } };
    expect(await new AuthGuard(auth, reflector({})).canActivate(ctx(req))).toBe(true);
    expect(req.user).toEqual(user);
    await expect(new AuthGuard(auth, reflector({ roles: ['ADMIN'] })).canActivate(ctx({ headers: { authorization: 'Bearer good' }, body: { role: 'ADMIN' } }))).rejects.toMatchObject({ status: 403 });
  });
});
