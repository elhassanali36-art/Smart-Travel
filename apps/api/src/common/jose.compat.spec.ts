import { SignJWT, jwtVerify } from 'jose';

// Release gate for the CommonJS/ESM question: the API compiles to CommonJS, so `require('jose')` must work.
// jose v5 ships a CommonJS build; v6 is ESM-only. With the offline stub this proves nothing: it must run against the real package.
describe('jose compatibility', () => {
  it('signs and verifies an HS256 token through the CommonJS build', async () => {
    const key = new TextEncoder().encode('k'.repeat(48));
    const token = await new SignJWT({ sub: 'u1' }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuer('i').setAudience('a').setIssuedAt().setExpirationTime('15m').sign(key);
    const { payload } = await jwtVerify(token, key, { issuer: 'i', audience: 'a', algorithms: ['HS256'] });
    expect(payload.sub).toBe('u1');
  });
  it('rejects alg=none and a wrong key', async () => {
    const key = new TextEncoder().encode('k'.repeat(48));
    const token = await new SignJWT({ sub: 'u1' }).setProtectedHeader({ alg: 'HS256' }).setIssuer('i').setAudience('a').setIssuedAt().setExpirationTime('15m').sign(key);
    await expect(jwtVerify(token, new TextEncoder().encode('z'.repeat(48)), { issuer: 'i', audience: 'a', algorithms: ['HS256'] })).rejects.toThrow();
    const [, p] = token.split('.');
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${p}.`;
    await expect(jwtVerify(none, key, { issuer: 'i', audience: 'a', algorithms: ['HS256'] })).rejects.toThrow();
  });
});
