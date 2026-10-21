import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagingService {
  constructor(private readonly db: PrismaService, private readonly notifications: NotificationsService) {}

  // Newest 200 messages of the caller, returned oldest-first for display. (Ordering ascending with
  // take: 200 would return the OLDEST 200 and hide every newer message once a user passes 200.)
  async list(userId: string) {
    const rows = await this.db.message.findMany({
      where: { OR: [{ senderId: userId }, { recipientId: userId }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
      include: { sender: { select: { id: true, name: true } }, recipient: { select: { id: true, name: true } } },
    });
    return rows.reverse();
  }

  async send(userId: string, dto: { recipientId: string; body: string }) {
    if (userId === dto.recipientId) throw new BadRequestException('Cannot message yourself');
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message must not be blank');
    const recipient = await this.db.user.findUnique({ where: { id: dto.recipientId }, select: { id: true, status: true } });
    if (!recipient) throw new NotFoundException('Recipient not found');
    if (recipient.status !== 'ACTIVE') throw new ForbiddenException('Recipient is not active');

    const message = await this.db.message.create({ data: { senderId: userId, recipientId: dto.recipientId, body } });
    await this.notifications.notify(dto.recipientId, 'MESSAGE', ['New message', 'رسالة جديدة'], ['You received a new message.', 'وصلتك رسالة جديدة.']);
    return message;
  }
}
