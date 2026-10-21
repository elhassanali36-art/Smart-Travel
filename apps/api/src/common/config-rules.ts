export const NODE_ENVS = ['development', 'test', 'staging', 'production'] as const;

// "15m" -> 900. Only s/m/h/d (all supported by jose). Returns null when malformed.
export function parseTtlSeconds(value: string): number | null {
  const m = /^(\d{1,6})(s|m|h|d)$/.exec(value);
  if (!m) return null;
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return Number(m[1]) * unit;
}

export interface RawEnv {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  accessTtl: string;
  refreshDays: number;
  webOrigin: string;
  cookieSameSite?: string;
}

// Returns a list of problems. Messages never include secret values.
export function validateConfig(c: RawEnv): string[] {
  const errors: string[] = [];
  if (!(NODE_ENVS as readonly string[]).includes(c.nodeEnv)) errors.push(`NODE_ENV must be one of: ${NODE_ENVS.join(', ')}`);
  if (!Number.isInteger(c.port) || c.port < 1 || c.port > 65535) errors.push('PORT must be a valid TCP port');
  if (!c.jwtSecret || c.jwtSecret.length < 32) errors.push('JWT_SECRET must be at least 32 characters');
  else if (c.jwtSecret.includes('replace-with')) errors.push('JWT_SECRET must not use the example placeholder');
  if (!Number.isInteger(c.refreshDays) || c.refreshDays < 1 || c.refreshDays > 365) errors.push('REFRESH_TOKEN_TTL_DAYS must be between 1 and 365');
  const ttl = parseTtlSeconds(c.accessTtl);
  if (ttl === null) errors.push('ACCESS_TOKEN_TTL must look like 15m (units: s, m, h, d)');
  else if (ttl < 60 || ttl > 86400) errors.push('ACCESS_TOKEN_TTL must be between 1 minute and 24 hours');
  if (c.nodeEnv !== 'development' && !c.databaseUrl) errors.push('DATABASE_URL is required outside development');
  const ss = c.cookieSameSite ?? 'lax';
  if (!['lax', 'strict', 'none'].includes(ss)) errors.push('COOKIE_SAMESITE must be lax, strict or none');
  else if (ss === 'none' && c.nodeEnv === 'development') errors.push('COOKIE_SAMESITE=none requires HTTPS (not available in development)');
  try {
    const u = new URL(c.webOrigin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') errors.push('WEB_ORIGIN must be an http(s) URL');
  } catch {
    errors.push('WEB_ORIGIN must be a valid URL');
  }
  return errors;
}
