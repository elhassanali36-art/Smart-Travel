import { parseTtlSeconds, validateConfig } from './config-rules';

const ok = { nodeEnv: 'production', port: 4000, databaseUrl: 'postgresql://u:p@db/x', jwtSecret: 'k'.repeat(40), accessTtl: '15m', refreshDays: 30, webOrigin: 'https://app.example.com' };

describe('parseTtlSeconds', () => {
  it('parses s/m/h/d durations', () => {
    expect(parseTtlSeconds('90s')).toBe(90);
    expect(parseTtlSeconds('15m')).toBe(900);
    expect(parseTtlSeconds('2h')).toBe(7200);
    expect(parseTtlSeconds('1d')).toBe(86400);
  });
  it('rejects units jose does not understand and malformed values', () => {
    for (const bad of ['500ms', '1y', '1w', '15', 'm', '', '-5m', '1.5h', '15 m', '9999999m']) expect(parseTtlSeconds(bad)).toBeNull();
  });
});

describe('validateConfig', () => {
  it('accepts a valid production configuration', () => {
    expect(validateConfig(ok)).toEqual([]);
  });
  it('rejects short, placeholder and missing JWT secrets without echoing them', () => {
    const short = validateConfig({ ...ok, jwtSecret: 'tooshort' });
    expect(short.join(' ')).toContain('JWT_SECRET');
    expect(short.join(' ')).not.toContain('tooshort');
    expect(validateConfig({ ...ok, jwtSecret: 'replace-with-at-least-32-random-characters' }).join(' ')).toContain('placeholder');
    expect(validateConfig({ ...ok, jwtSecret: '' })).toHaveLength(1);
  });
  it('bounds the access-token lifetime to 1 minute .. 24 hours', () => {
    expect(validateConfig({ ...ok, accessTtl: '30s' })).toHaveLength(1);
    expect(validateConfig({ ...ok, accessTtl: '2d' })).toHaveLength(1);
    expect(validateConfig({ ...ok, accessTtl: '24h' })).toEqual([]);
  });
  it('requires DATABASE_URL outside development only', () => {
    expect(validateConfig({ ...ok, databaseUrl: '' }).join(' ')).toContain('DATABASE_URL');
    expect(validateConfig({ ...ok, nodeEnv: 'development', databaseUrl: '' })).toEqual([]);
  });
  it('validates NODE_ENV, PORT, refresh days and WEB_ORIGIN', () => {
    expect(validateConfig({ ...ok, nodeEnv: 'prod' })).toHaveLength(1);
    expect(validateConfig({ ...ok, port: 70000 })).toHaveLength(1);
    expect(validateConfig({ ...ok, port: Number.NaN })).toHaveLength(1);
    expect(validateConfig({ ...ok, refreshDays: 0 })).toHaveLength(1);
    expect(validateConfig({ ...ok, webOrigin: 'not a url' })).toHaveLength(1);
    expect(validateConfig({ ...ok, webOrigin: 'ftp://x.example' })).toHaveLength(1);
  });
});
