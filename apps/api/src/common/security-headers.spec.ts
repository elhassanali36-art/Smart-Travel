import { securityHeaders } from './security-headers';

function run(production: boolean) {
  const headers: Record<string, string> = {};
  let nexted = false;
  securityHeaders(production)({} as never, { setHeader: (k: string, v: string) => { headers[k] = v; } } as never, () => { nexted = true; });
  return { headers, nexted };
}
describe('securityHeaders', () => {
  it('sets the hardening headers and calls next()', () => {
    const { headers, nexted } = run(false);
    expect(nexted).toBe(true);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Content-Security-Policy']).toContain("default-src 'none'");
    expect(headers['Cache-Control']).toBe('no-store');
  });
  it('adds HSTS only in production', () => {
    expect(run(false).headers['Strict-Transport-Security']).toBeUndefined();
    expect(run(true).headers['Strict-Transport-Security']).toContain('max-age=');
  });
});
