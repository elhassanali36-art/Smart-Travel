import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from './config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async onModuleInit() {
    // Same rule as ConfigService.validate(): only development may run without a database.
    if (!this.config.databaseUrl && this.config.nodeEnv === 'development') return;
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async ping() {
    if (!this.config.databaseUrl) return false;
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
