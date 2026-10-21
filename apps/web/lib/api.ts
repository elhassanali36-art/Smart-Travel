const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

// Token model:
//  - the short-lived ACCESS token lives only in this module's memory (never in storage);
//  - the REFRESH token is an HttpOnly cookie set by the API (page scripts cannot read it);
//  - localStorage keeps only a non-secret hint ("a session may exist") so a reloaded page knows to try a silent refresh.
// Known limit: two tabs refreshing at the same instant can trip refresh-token replay detection and sign the user out.
const HINT = 'st.session';
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const browser = () => typeof window !== 'undefined';
export function hasSessionHint() {
  try { return browser() && localStorage.getItem(HINT) === '1'; } catch { return false; }
}
function setHint(on: boolean) {
  try { if (on) localStorage.setItem(HINT, '1'); else localStorage.removeItem(HINT); } catch { /* storage unavailable */ }
}
export function startSession(token: string) {
  accessToken = token;
  setHint(true);
}
export function endSession() {
  accessToken = null;
  setHint(false);
}

async function raw(path: string, init: RequestInit, token: string | null) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(`${BASE}${path}`, { ...init, headers, cache: 'no-store', credentials: 'include' });
  } catch {
    throw new ApiError(0, 'network');
  }
}

// One shared in-flight refresh: refresh tokens rotate and a replayed one revokes the whole session.
function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const res = await raw('/auth/refresh', { method: 'POST' }, null);
      if (!res.ok) { endSession(); return null; }
      const j = (await res.json()) as { accessToken: string };
      startSession(j.accessToken);
      return j.accessToken;
    } catch {
      return null; // network failure: keep the hint, the user may retry
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function ensureAccessToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  return hasSessionHint() ? refreshSession() : null;
}

type Options = Omit<RequestInit, 'credentials'> & { auth?: boolean; retry?: boolean };

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { auth, retry, ...init } = options;
  let token: string | null = null;
  if (auth) {
    token = await ensureAccessToken();
    if (!token) throw new ApiError(401, 'Not signed in');
  }
  let res = await raw(path, init, token);
  if (res.status === 401 && auth && retry !== false) {
    const renewed = await refreshSession();
    if (!renewed) throw new ApiError(401, 'Session expired');
    res = await raw(path, init, renewed);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = data?.error?.message ?? data?.message ?? 'Request failed';
    throw new ApiError(res.status, Array.isArray(m) ? m.join(', ') : String(m));
  }
  return data as T;
}

export async function login(body: { email?: string; phone?: string; password: string }) {
  const j = await api<{ accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  startSession(j.accessToken);
}
export async function register(body: { name: string; email?: string; phone?: string; password: string }) {
  const j = await api<{ accessToken: string }>('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  startSession(j.accessToken);
}
export async function logoutRequest() {
  endSession();
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* the local session is already gone */ }
}
