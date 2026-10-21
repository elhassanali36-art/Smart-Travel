import { isTrustedOrigin, parseCookies, REFRESH_COOKIE, REFRESH_COOKIE_PATH, refreshCookieOptions } from './cookies';

describe('parseCookies', () => {
  it('parses multiple cookies, decodes values and keeps the first duplicate', () => {
    expect(parseCookies('a=1; st_refresh=abc%2Fdef; b="two"; a=9')).toEqual({ a: '1', st_refresh: 'abc/def', b: 'two' });
  });
  it('ignores malformed input', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
    expect(parseCookies('novalue; =x; ok=1; bad=%E0%A4%A')).toEqual({ ok: '1' });
  });
});

describe('refresh cookie options', () => {
  it('is HttpOnly, scoped to the auth path, with the configured flags', () => {
    const o = refreshCookieOptions({ secure: true, sameSite: 'lax', maxAgeMs: 1000 });
    expect(o).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: REFRESH_COOKIE_PATH, maxAge: 1000 });
    expect(REFRESH_COOKIE_PATH).toBe('/api/v1/auth');
    expect(REFRESH_COOKIE).toBe('st_refresh');
  });
});

describe('isTrustedOrigin (CSRF defence)', () => {
  it('accepts only the configured web origin', () => {
    expect(isTrustedOrigin('http://localhost:3000', 'http://localhost:3000')).toBe(true);
    expect(isTrustedOrigin('http://LOCALHOST:3000/', 'http://localhost:3000')).toBe(true);
    expect(isTrustedOrigin('https://evil.example', 'http://localhost:3000')).toBe(false);
    expect(isTrustedOrigin('http://localhost:3001', 'http://localhost:3000')).toBe(false);
    expect(isTrustedOrigin('null', 'http://localhost:3000')).toBe(false);
  });
  it('rejects a missing Origin header', () => {
    expect(isTrustedOrigin(undefined, 'http://localhost:3000')).toBe(false);
    expect(isTrustedOrigin('', 'http://localhost:3000')).toBe(false);
  });
});
