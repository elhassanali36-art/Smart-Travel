import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from './config.service';
import { PrismaService } from './prisma.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimiter } from './rate-limiter';

@Global()
@Module({
  providers: [ConfigService, PrismaService, { provide: RateLimiter, useFactory: () => new RateLimiter() }, { provide: APP_GUARD, useClass: RateLimitGuard }],
  exports: [ConfigService, PrismaService, RateLimiter],
})
export class CommonModule {}
