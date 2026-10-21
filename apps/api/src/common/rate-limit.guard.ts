import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiter } from './rate-limiter';

export const RATE_LIMIT_KEY = 'rateLimit';
// Tighter per-route limit (per client IP). Every request is also counted against the global limit.
export const RateLimit = (limit: number, windowSec: number) => SetMetadata(RATE_LIMIT_KEY, { limit, windowSec });

const GLOBAL_LIMIT = 300;
const GLOBAL_WINDOW_MS = 60_000;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly limiter: RateLimiter, private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const ip: string = req.ip ?? req.socket?.remoteAddress ?? 'unknown';

    const route = this.reflector.get<{ limit: number; windowSec: number }>(RATE_LIMIT_KEY, ctx.getHandler());
    const checks: Array<[string, number, number]> = [[`global:${ip}`, GLOBAL_LIMIT, GLOBAL_WINDOW_MS]];
    if (route) checks.push([`${ctx.getClass().name}.${ctx.getHandler().name}:${ip}`, route.limit, route.windowSec * 1000]);

    for (const [key, limit, windowMs] of checks) {
      const d = this.limiter.consume(key, limit, windowMs);
      if (!d.allowed) {
        res.setHeader('Retry-After', String(d.retryAfterSec));
        throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    return true;
  }
}
