import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly db: PrismaService) {}

  async create(reporterId: string, dto: { subjectUserId?: string; reason: string; details?: string }) {
    const reason = dto.reason.trim();
    if (reason.length < 2) throw new BadRequestException('reason must not be blank');
    if (dto.subjectUserId === reporterId) throw new BadRequestException('A user cannot report themselves');
    if (dto.subjectUserId) {
      const subject = await this.db.user.findUnique({ where: { id: dto.subjectUserId }, select: { id: true } });
      if (!subject) throw new NotFoundException('Reported user not found');
    }
    return this.db.report.create({
      data: { reporterId, subjectUserId: dto.subjectUserId, reason, details: dto.details?.trim() },
    });
  }
}
