import { Injectable } from '@nestjs/common';
import { validateConfig } from './config-rules';

@Injectable()
export class ConfigService {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly port = Number(process.env.PORT ?? 4000);
  readonly webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  readonly databaseUrl = process.env.DATABASE_URL ?? '';
  readonly jwtSecret = process.env.JWT_SECRET ?? '';
  readonly issuer = process.env.JWT_ISSUER ?? 'smart-travel-api';
  readonly audience = process.env.JWT_AUDIENCE ?? 'smart-travel-web';
  readonly accessTtl = process.env.ACCESS_TOKEN_TTL ?? '15m';
  readonly cookieSameSite = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
  readonly refreshDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
  // Number of reverse-proxy hops to trust for req.ip (rate limiting). Unset = do not trust X-Forwarded-For.
  readonly trustProxy = process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : undefined;

  // Secure cookies everywhere except local development (browsers accept them on localhost too).
  get cookieSecure() {
    return this.nodeEnv !== 'development';
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }

  validate() {
    const errors = validateConfig(this);
    if (this.trustProxy !== undefined && (!Number.isInteger(this.trustProxy) || this.trustProxy < 0 || this.trustProxy > 10)) {
      errors.push('TRUST_PROXY must be an integer between 0 and 10');
    }
    if (errors.length) throw new Error(`Invalid configuration: ${errors.join('; ')}`);
  }
}
