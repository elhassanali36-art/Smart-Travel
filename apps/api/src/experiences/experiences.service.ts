import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { definedOnly } from '../profiles/completion';
import { ExperienceDto, UpdateExperienceDto } from './dto';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

@Injectable()
export class ExperiencesService {
  constructor(private readonly db: PrismaService) {}

  list(destinationId?: string, category?: string, take = 50, skip = 0) {
    const cat = typeof category === 'string' ? category.trim().slice(0, 50) : '';
    return this.db.experience.findMany({
      where: { active: true, host: { user: { status: 'ACTIVE' } }, ...(destinationId ? { destinationId } : {}), ...(cat ? { category: cat } : {}) },
      include: { destination: true, host: { include: { user: { select: { id: true, name: true, role: true } } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: clamp(take, 1, 100),
      skip: clamp(skip, 0, 10000),
    });
  }

  mine(userId: string) {
    return this.db.experience.findMany({
      where: { host: { userId } },
      include: { destination: { select: { id: true, nameEn: true, nameAr: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
  }

  async create(userId: string, dto: ExperienceDto) {
    const host = await this.db.hostProfile.findUnique({ where: { userId } });
    if (!host) throw new ForbiddenException('Host profile required');
    const destination = await this.db.destination.findUnique({ where: { id: dto.destinationId }, select: { id: true } });
    if (!destination) throw new NotFoundException('Destination not found');
    const { destinationId, ...rest } = dto;
    return this.db.experience.create({ data: { ...rest, destinationId, hostProfileId: host.id } });
  }

  async update(userId: string, id: string, dto: UpdateExperienceDto) {
    const x = await this.db.experience.findUnique({ where: { id }, include: { host: true } });
    if (!x || x.host.userId !== userId) throw new NotFoundException();
    return this.db.experience.update({ where: { id }, data: definedOnly(dto) });
  }
}
