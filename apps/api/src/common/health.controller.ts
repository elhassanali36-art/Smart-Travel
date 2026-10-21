import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.guard';
import { PrismaService } from './prisma.service';
import { ConfigService } from './config.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  @Public()
  @Get()
  async health() {
    const database = this.config.databaseUrl ? (await this.prisma.ping() ? 'up' : 'down') : 'unconfigured';
    return { status: 'ok', checks: { app: 'up', database }, timestamp: new Date().toISOString() };
  }
}
