import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly db: PrismaService) {}

  list(userId: string) {
    return this.db.notification.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 100 });
  }

  // The userId in the filter is the ownership check: another user's notification id matches nothing.
  async read(userId: string, id: string) {
    const r = await this.db.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    if (r.count === 0) throw new NotFoundException('Notification not found');
    return { success: true };
  }

  // Best effort: a failed notification must never fail the booking/message/review that triggered it.
  // Text is stored bilingually ("English · العربية") because the table has a single title/body.
  async notify(userId: string, type: NotificationType, title: [string, string], body: [string, string]) {
    try {
      await this.db.notification.create({ data: { userId, type, title: `${title[0]} · ${title[1]}`, body: `${body[0]} · ${body[1]}` } });
    } catch {
      this.logger.warn(`Could not create ${type} notification`);
    }
  }
}
