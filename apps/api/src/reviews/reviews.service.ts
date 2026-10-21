import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly db: PrismaService, private readonly notifications: NotificationsService) {}

  // Only the TRAVELER of a COMPLETED booking can review (the host receives the rating). This also
  // stops a host from reviewing first and thereby locking the traveler out (one review per booking).
  async create(userId: string, bookingId: string, dto: { rating: number; comment?: string }) {
    const b = await this.db.booking.findUnique({ where: { id: bookingId }, select: { travelerId: true, hostId: true, status: true } });
    if (!b || b.travelerId !== userId) throw new NotFoundException();
    if (b.status !== 'COMPLETED') throw new BadRequestException('Booking is not reviewable');

    try {
      const review = await this.db.$transaction(async (tx) => {
        // Conditional status change doubles as the "already reviewed" guard under concurrency.
        const moved = await tx.booking.updateMany({ where: { id: bookingId, status: 'COMPLETED' }, data: { status: 'REVIEWED' } });
        if (moved.count !== 1) throw new ConflictException('This booking has already been reviewed');
        return tx.review.create({
          data: { bookingId, authorId: userId, subjectId: b.hostId, rating: dto.rating, comment: dto.comment?.trim() },
          select: { id: true, bookingId: true, rating: true, comment: true, createdAt: true },
        });
      });
      await this.notifications.notify(b.hostId, 'REVIEW', ['New review', 'تقييم جديد'], [`You received a ${dto.rating}/5 rating.`, `حصلت على تقييم ${dto.rating}/5.`]);
      return review;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('This booking has already been reviewed');
      throw e;
    }
  }

  list(subjectId: string) {
    return this.db.review.findMany({
      where: { subjectId },
      select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 50,
    });
  }
}
