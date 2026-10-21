import { ConfigService } from '../common/config.service';
import { AuthController } from './auth.controller';

process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.NODE_ENV = 'production';

function setup(over: Partial<Record<'register' | 'login' | 'rotate' | 'logout', (...a: any[]) => any>> = {}) {
  const calls: string[] = [];
  const tokens = { accessToken: 'AT', refreshToken: 'RT-value', expiresIn: 900 };
  const svc = { register: async () => tokens, login: async () => tokens, rotate: async () => ({ ...tokens, refreshToken: 'RT-2' }), logout: async (t: string) => { calls.push(`logout:${t}`); }, ...over } as never;
  const cookies: Array<{ name: string; value?: string; opts: any }> = [];
  const res = { cookie: (name: string, value: string, opts: any) => cookies.push({ name, value, opts }), clearCookie: (name: string, opts: any) => cookies.push({ name, opts }) } as never;
  return { controller: new AuthController(svc, new ConfigService()), res, cookies, calls };
}
const req = (origin: string | undefined, cookie?: string) => ({ headers: { origin, cookie } }) as never;

describe('AuthController token transport', () => {
  it('login returns only the access token and sets an HttpOnly, Secure, path-scoped cookie', async () => {
    const { controller, res, cookies } = setup();
    const body = await controller.login({ email: 'a@b.co', password: 'x' }, res);
    expect(body).toEqual({ accessToken: 'AT', expiresIn: 900 });
    expect(JSON.stringify(body)).not.toContain('RT-value');
    expect(cookies[0]).toMatchObject({ name: 'st_refresh', value: 'RT-value', opts: { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/v1/auth' } });
  });
  it('register behaves the same way', async () => {
    const { controller, res, cookies } = setup();
    expect(await controller.register({ name: 'A', email: 'a@b.co', password: 'x' } as never, res)).toEqual({ accessToken: 'AT', expiresIn: 900 });
    expect(cookies[0].opts.httpOnly).toBe(true);
  });
  it('refresh rejects an untrusted or missing Origin (403) before touching the cookie', async () => {
    const { controller, res } = setup();
    await expect(controller.refresh(req('https://evil.example', 'st_refresh=RT-value'), res)).rejects.toMatchObject({ status: 403 });
    await expect(controller.refresh(req(undefined, 'st_refresh=RT-value'), res)).rejects.toMatchObject({ status: 403 });
  });
  it('refresh requires the cookie (401) and rotates it on success', async () => {
    const { controller, res, cookies } = setup();
    await expect(controller.refresh(req('http://localhost:3000'), res)).rejects.toMatchObject({ status: 401 });
    const body = await controller.refresh(req('http://localhost:3000', 'st_refresh=RT-value'), res);
    expect(body).toEqual({ accessToken: 'AT', expiresIn: 900 });
    expect(cookies[0].value).toBe('RT-2');
  });
  it('a rejected refresh clears the cookie and rethrows', async () => {
    const boom = Object.assign(new Error('replayed'), { status: 401 });
    const { controller, res, cookies } = setup({ rotate: async () => { throw boom; } });
    await expect(controller.refresh(req('http://localhost:3000', 'st_refresh=bad'), res)).rejects.toMatchObject({ status: 401 });
    expect(cookies[0].name).toBe('st_refresh');
    expect(cookies[0].value).toBeUndefined();
  });
  it('logout checks the origin, revokes the cookie token and clears the cookie', async () => {
    const { controller, res, cookies, calls } = setup();
    await expect(controller.logout(req('https://evil.example', 'st_refresh=RT-value'), res)).rejects.toMatchObject({ status: 403 });
    expect(await controller.logout(req('http://localhost:3000', 'st_refresh=RT-value'), res)).toEqual({ success: true });
    expect(calls).toEqual(['logout:RT-value']);
    expect(cookies[0].value).toBeUndefined();
  });
});
