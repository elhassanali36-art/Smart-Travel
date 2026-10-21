import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { SafeUser } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { runSerializable } from '../common/tx';
import { NotificationsService } from '../notifications/notifications.service';
import { computeEnd, validateStart } from './booking-capacity';
import { ACTIVE_STATUSES, actorFor, evaluate, isOverdue, nextExpiry, timestampFieldFor, USER_SETTABLE } from './booking-rules';
import { BookingDto } from './dto';

const parties = { traveler: { select: { id: true, name: true } }, host: { select: { id: true, name: true } } };

@Injectable()
export class BookingsService {
  constructor(private readonly db: PrismaService, private readonly notifications: NotificationsService) {}

  // Expiry is deterministic and lazy: overdue pending bookings are marked EXPIRED whenever bookings are
  // listed, created or acted on, and by the admin endpoint. There is NO background scheduler yet.
  expireOverdue(now = new Date(), tx: Prisma.TransactionClient | PrismaService = this.db, where: Prisma.BookingWhereInput = {}) {
    return tx.booking.updateMany({
      where: { ...where, status: { in: ['REQUESTED', 'ACCEPTED'] }, expiresAt: { lte: now } },
      data: { status: 'EXPIRED', expiresAt: null },
    });
  }

  async expireOverdueAudited(adminId: string) {
    const r = await this.expireOverdue();
    await this.db.auditLog.create({ data: { actorId: adminId, action: 'BOOKINGS_EXPIRED', targetType: 'Booking', targetId: 'bulk', metadata: { count: r.count } } });
    return { expired: r.count };
  }

  async list(user: SafeUser) {
    await this.expireOverdue();
    const common = { orderBy: [{ startsAt: 'desc' as const }, { id: 'asc' as const }], take: 200 };
    if (user.role === 'ADMIN') return this.db.booking.findMany({ ...common, include: { experience: true, ...parties, trip: true } });
    // The traveler's trip (title, dates, private preferences) is visible to the traveler only, never to the host.
    if (user.role === 'TRAVELER') return this.db.booking.findMany({ ...common, where: { travelerId: user.id }, include: { experience: true, ...parties, trip: true } });
    return this.db.booking.findMany({ ...common, where: { hostId: user.id }, include: { experience: true, ...parties } });
  }

  disputes() {
    return this.db.booking.findMany({
      where: { status: 'DISPUTED' },
      include: { experience: { select: { id: true, titleEn: true, titleAr: true } }, ...parties },
      orderBy: [{ disputedAt: 'asc' }, { id: 'asc' }],
      take: 200,
    });
  }

  async create(user: SafeUser, dto: BookingDto) {
    if (user.role !== 'TRAVELER') throw new ForbiddenException('Only travelers can create bookings');
    const now = new Date();
    const startsAt = new Date(dto.startsAt);
    const startError = validateStart(startsAt, now);
    if (startError) throw new BadRequestException(startError);

    // Serializable: the capacity read and the insert must not interleave with another request.
    const booking = await runSerializable(this.db, async (tx) => {
      const e = await tx.experience.findUnique({ where: { id: dto.experienceId }, include: { host: { include: { user: { select: { status: true } } } } } });
      if (!e || !e.active || e.host.user.status !== 'ACTIVE') throw new NotFoundException('Experience not found');
      if (e.host.userId === user.id) throw new BadRequestException('Cannot book your own experience');
      if (dto.guests > e.capacity) throw new BadRequestException(`This experience accepts at most ${e.capacity} guests`);

      if (dto.tripId) {
        const trip = await tx.trip.findUnique({ where: { id: dto.tripId }, select: { travelerId: true } });
        if (!trip || trip.travelerId !== user.id) throw new NotFoundException('Trip not found');
      }

      const endsAt = computeEnd(startsAt, e.durationMinutes);
      await this.expireOverdue(now, tx, { experienceId: e.id }); // stale requests must not hold seats

      const overlap = { experienceId: e.id, status: { in: [...ACTIVE_STATUSES] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } };
      const duplicate = await tx.booking.findFirst({ where: { ...overlap, travelerId: user.id }, select: { id: true } });
      if (duplicate) throw new ConflictException('You already have an open booking for this experience at that time');

      const taken = await tx.booking.aggregate({ where: overlap, _sum: { guests: true } });
      if ((taken._sum.guests ?? 0) + dto.guests > e.capacity) throw new BadRequestException('Not enough seats left for that time');

      return tx.booking.create({
        data: { travelerId: user.id, hostId: e.host.userId, experienceId: e.id, tripId: dto.tripId, note: dto.note?.trim(), startsAt, endsAt, guests: dto.guests, expiresAt: nextExpiry(now, startsAt) },
      });
    });

    await this.notifications.notify(booking.hostId, 'BOOKING', ['New booking request', 'طلب حجز جديد'], ['A traveler requested one of your experiences.', 'طلب مسافر إحدى تجاربك.']);
    return booking;
  }

  private async load(user: SafeUser, id: string) {
    const b = await this.db.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();
    const actor = actorFor(user.role, user.id, b);
    if (!actor) {
      if (user.role === 'ADMIN') throw new ForbiddenException('Administrators cannot change bookings through the user workflow');
      throw new NotFoundException(); // not a participant: indistinguishable from a missing booking
    }
    return { b, actor };
  }

  async transition(user: SafeUser, id: string, next: BookingStatus) {
    if (!(USER_SETTABLE as readonly string[]).includes(next)) throw new BadRequestException('This status cannot be set directly');
    const { b, actor } = await this.load(user, id);
    const now = new Date();

    if (isOverdue(b, now)) {
      await this.expireOverdue(now, this.db, { id });
      throw new ConflictException('The booking has expired');
    }
    const decision = evaluate(actor, next, b, now);
    if (!decision.ok) throw new BadRequestException(decision.reason);

    // Conditional update: only succeeds if the status is still what we validated against.
    const stamps: Prisma.BookingUpdateManyMutationInput = {};
    const field = timestampFieldFor(next);
    if (field) stamps[field] = now;
    const expiresAt = next === 'ACCEPTED' ? nextExpiry(now, b.startsAt) : null; // traveler must confirm in time
    const res = await this.db.booking.updateMany({ where: { id, status: b.status }, data: { status: next, expiresAt, ...stamps } });
    if (res.count !== 1) throw new ConflictException('The booking was changed by someone else. Reload and try again.');

    const counterpart = actor === 'HOST' ? b.travelerId : b.hostId;
    await this.notifications.notify(counterpart, 'BOOKING', [`Booking ${next.toLowerCase()}`, `تحديث الحجز: ${next}`], [`The booking status is now ${next}.`, `أصبحت حالة الحجز ${next}.`]);
    return this.db.booking.findUniqueOrThrow({ where: { id } });
  }

  async dispute(user: SafeUser, id: string, reason: string) {
    const { b, actor } = await this.load(user, id);
    const now = new Date();
    const text = reason.trim();
    if (text.length < 10) throw new BadRequestException('reason must be at least 10 characters');
    const decision = evaluate(actor, 'DISPUTED', b, now);
    if (!decision.ok) throw new BadRequestException(decision.reason);

    const res = await this.db.booking.updateMany({
      where: { id, status: b.status },
      data: { status: 'DISPUTED', disputeReason: text, disputedAt: now, disputedById: user.id, expiresAt: null },
    });
    if (res.count !== 1) throw new ConflictException('The booking was changed by someone else. Reload and try again.');
    await this.notifications.notify(actor === 'HOST' ? b.travelerId : b.hostId, 'BOOKING', ['Booking disputed', 'تم فتح نزاع على الحجز'], ['The other party opened a dispute. An administrator will review it.', 'فتح الطرف الآخر نزاعًا وسيراجعه أحد المشرفين.']);
    return this.db.booking.findUniqueOrThrow({ where: { id } });
  }

  // Administrator resolves a dispute to COMPLETED or CANCELLED. Audited, atomic and conditional on DISPUTED.
  async resolve(adminId: string, id: string, outcome: 'COMPLETED' | 'CANCELLED', note: string) {
    const now = new Date();
    const updated = await runSerializable(this.db, async (tx) => {
      const b = await tx.booking.findUnique({ where: { id } });
      if (!b) throw new NotFoundException();
      const decision = evaluate('ADMIN', outcome, b, now);
      if (!decision.ok) throw new BadRequestException(decision.reason);
      const res = await tx.booking.updateMany({
        where: { id, status: 'DISPUTED' },
        data: { status: outcome, resolutionNote: note.trim(), resolvedAt: now, ...(outcome === 'COMPLETED' ? { completedAt: now } : { cancelledAt: now }) },
      });
      if (res.count !== 1) throw new ConflictException('The dispute was already resolved');
      await tx.auditLog.create({ data: { actorId: adminId, action: 'BOOKING_DISPUTE_RESOLVED', targetType: 'Booking', targetId: id, metadata: { outcome } } });
      return tx.booking.findUniqueOrThrow({ where: { id } });
    });
    for (const userId of [updated.travelerId, updated.hostId]) {
      await this.notifications.notify(userId, 'BOOKING', ['Dispute resolved', 'تم حل النزاع'], [`The dispute was resolved as ${outcome}.`, `تم حل النزاع بنتيجة ${outcome}.`]);
    }
    return updated;
  }
}
