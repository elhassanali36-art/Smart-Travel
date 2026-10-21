// Pure helpers for the HttpOnly refresh-token cookie and its CSRF defence.
export const REFRESH_COOKIE = 'st_refresh';
// The cookie is only sent to the auth endpoints, never to the rest of the API.
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
export type SameSite = 'lax' | 'strict' | 'none';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (!name) continue;
    let value = part.slice(i + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);
    try { value = decodeURIComponent(value); } catch { continue; }
    if (!(name in out)) out[name] = value; // first occurrence wins
  }
  return out;
}

export function refreshCookieOptions(c: { secure: boolean; sameSite: SameSite; maxAgeMs: number }) {
  return { httpOnly: true, secure: c.secure, sameSite: c.sameSite, path: REFRESH_COOKIE_PATH, maxAge: c.maxAgeMs } as const;
}

// Cookie-authenticated requests (refresh, logout) must come from the configured web origin.
// Browsers always send Origin on POST, so a missing Origin is rejected too.
export function isTrustedOrigin(origin: string | undefined, allowed: string): boolean {
  if (!origin) return false;
  const norm = (v: string) => v.replace(/\/+$/, '').toLowerCase();
  return norm(origin) === norm(allowed);
}
