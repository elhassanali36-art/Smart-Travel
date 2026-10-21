import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

@Injectable()
export class DestinationsService {
  constructor(private readonly db: PrismaService) {}

  list(q?: string, take = 50, skip = 0) {
    // ?q=a&q=b arrives as an array: only a plain string is accepted.
    const term = typeof q === 'string' ? q.trim().slice(0, 100) : '';
    return this.db.destination.findMany({
      where: term ? { OR: [{ nameEn: { contains: term, mode: 'insensitive' } }, { nameAr: { contains: term } }, { countryEn: { contains: term, mode: 'insensitive' } }] } : undefined,
      include: { _count: { select: { experiences: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: clamp(take, 1, 100),
      skip: clamp(skip, 0, 10000),
    });
  }

  // PUBLIC endpoint: hosts are exposed as {id, name, city} only. Never include the full user record.
  async get(id: string) {
    const d = await this.db.destination.findUnique({
      where: { id },
      include: {
        experiences: {
          where: { active: true, host: { user: { status: 'ACTIVE' } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          include: { host: { select: { id: true, city: true, country: true, verification: true, user: { select: { id: true, name: true } } } } },
        },
      },
    });
    if (!d) throw new NotFoundException('Destination not found');
    return d;
  }
}
