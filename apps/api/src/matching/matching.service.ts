import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { scoreHost } from './score';

@Injectable()
export class MatchingService {
  constructor(private readonly db: PrismaService) {}

  async hosts(userId: string) {
    const profile = await this.db.travelerProfile.findUnique({ where: { userId } });
    const hosts = await this.db.hostProfile.findMany({
      where: { verification: 'VERIFIED', user: { status: 'ACTIVE' } },
      include: { user: { select: { name: true } } },
      orderBy: { id: 'asc' },
      take: 200,
    });
    return hosts
      .map((h) => ({ id: h.userId, name: h.user.name, city: h.city, ...scoreHost(profile, h) }))
      // Equal scores are ordered by id so identical inputs always give an identical ranking.
      .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  }
}
