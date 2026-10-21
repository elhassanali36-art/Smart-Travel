import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { TripDto, UpdateTripDto } from './dto';
import { ItineraryItemDto } from './itinerary.dto';

@Injectable()
export class TripsService {
  constructor(private readonly db: PrismaService) {}

  list(userId: string) {
    return this.db.trip.findMany({
      where: { travelerId: userId },
      include: { destination: true, itineraryItems: { orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] }, bookings: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  // 404 (not 403) for someone else's trip: callers cannot probe which trip ids exist.
  private async assertTripOwner(userId: string, id: string) {
    const trip = await this.db.trip.findUnique({ where: { id } });
    if (!trip || trip.travelerId !== userId) throw new NotFoundException('Trip not found');
    return trip;
  }

  private async assertDestination(id?: string) {
    if (!id) return;
    const destination = await this.db.destination.findUnique({ where: { id }, select: { id: true } });
    if (!destination) throw new NotFoundException('Destination not found');
  }

  private title(raw: string) {
    const t = raw.trim();
    if (!t) throw new BadRequestException('title must not be blank');
    return t;
  }

  async create(userId: string, d: TripDto) {
    if (d.startDate && d.endDate && new Date(d.startDate) > new Date(d.endDate)) throw new BadRequestException('startDate must be before endDate');
    await this.assertDestination(d.destinationId);
    return this.db.trip.create({
      data: {
        title: this.title(d.title),
        destinationId: d.destinationId,
        travelerId: userId,
        preferences: d.preferences as Prisma.InputJsonValue | undefined,
        startDate: d.startDate ? new Date(d.startDate) : undefined,
        endDate: d.endDate ? new Date(d.endDate) : undefined,
      },
    });
  }

  async update(userId: string, id: string, d: UpdateTripDto) {
    const x = await this.assertTripOwner(userId, id);
    const startDate = d.startDate ? new Date(d.startDate) : x.startDate;
    const endDate = d.endDate ? new Date(d.endDate) : x.endDate;
    if (startDate && endDate && startDate > endDate) throw new BadRequestException('startDate must be before endDate');
    await this.assertDestination(d.destinationId);
    return this.db.trip.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: this.title(d.title) } : {}),
        ...(d.destinationId !== undefined ? { destinationId: d.destinationId } : {}),
        ...(d.preferences !== undefined ? { preferences: d.preferences as Prisma.InputJsonValue } : {}),
        ...(d.startDate !== undefined ? { startDate: new Date(d.startDate) } : {}),
        ...(d.endDate !== undefined ? { endDate: new Date(d.endDate) } : {}),
      },
    });
  }

  private async validateItinerary(dto: ItineraryItemDto) {
    if (dto.startTime && dto.endTime && new Date(dto.startTime) > new Date(dto.endTime)) throw new BadRequestException('startTime must be before endTime');
    if (dto.experienceId) {
      const experience = await this.db.experience.findUnique({ where: { id: dto.experienceId }, select: { id: true, active: true } });
      if (!experience || !experience.active) throw new NotFoundException('Experience not found');
    }
  }

  private async assertItem(tripId: string, itemId: string) {
    const item = await this.db.itineraryItem.findUnique({ where: { id: itemId }, select: { tripId: true } });
    if (!item || item.tripId !== tripId) throw new NotFoundException('Itinerary item not found');
  }

  async addItineraryItem(userId: string, tripId: string, dto: ItineraryItemDto) {
    await this.assertTripOwner(userId, tripId);
    await this.validateItinerary(dto);
    return this.db.itineraryItem.create({
      data: {
        tripId, dayNumber: dto.dayNumber, sortOrder: dto.sortOrder ?? 0, title: dto.title.trim(),
        description: dto.description?.trim(), location: dto.location?.trim(),
        startTime: dto.startTime ? new Date(dto.startTime) : undefined, endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        experienceId: dto.experienceId,
      },
    });
  }

  async updateItineraryItem(userId: string, tripId: string, itemId: string, dto: ItineraryItemDto) {
    await this.assertTripOwner(userId, tripId);
    await this.assertItem(tripId, itemId);
    await this.validateItinerary(dto);
    return this.db.itineraryItem.update({
      where: { id: itemId },
      data: {
        dayNumber: dto.dayNumber, sortOrder: dto.sortOrder ?? 0, title: dto.title.trim(),
        description: dto.description?.trim(), location: dto.location?.trim(),
        startTime: dto.startTime ? new Date(dto.startTime) : null, endTime: dto.endTime ? new Date(dto.endTime) : null,
        experienceId: dto.experienceId ?? null,
      },
    });
  }

  async deleteItineraryItem(userId: string, tripId: string, itemId: string) {
    await this.assertTripOwner(userId, tripId);
    await this.assertItem(tripId, itemId);
    await this.db.itineraryItem.delete({ where: { id: itemId } });
    return { success: true };
  }
}
