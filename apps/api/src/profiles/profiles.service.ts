import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { completionOf, definedOnly, HOST_COMPLETION_KEYS, TRAVELER_COMPLETION_KEYS } from './completion';
import { HostProfileDto, TravelerProfileDto } from './dto';

@Injectable()
export class ProfilesService {
  constructor(private readonly db: PrismaService) {}

  me(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true, travelerProfile: true, hostProfile: true },
    });
  }

  async traveler(userId: string, dto: TravelerProfileDto) {
    const data = definedOnly(dto);
    const existing = await this.db.travelerProfile.findUnique({ where: { userId } });
    const completion = completionOf({ ...(existing ?? {}), ...data }, TRAVELER_COMPLETION_KEYS);
    return this.db.travelerProfile.upsert({ where: { userId }, create: { ...data, userId, completion }, update: { ...data, completion } });
  }

  async host(userId: string, dto: HostProfileDto) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'LOCAL_HOST' && user?.role !== 'ADMIN') throw new ForbiddenException('Host role required');
    const data = definedOnly(dto);
    const existing = await this.db.hostProfile.findUnique({ where: { userId } });
    const completion = completionOf({ ...(existing ?? {}), ...data }, HOST_COMPLETION_KEYS);
    return this.db.hostProfile.upsert({ where: { userId }, create: { ...data, userId, completion }, update: { ...data, completion } });
  }

  // Authenticated, read-only. Only ACTIVE non-admin users are visible, and only allow-listed fields.
  async publicProfile(userId: string) {
    const u = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, role: true, status: true,
        travelerProfile: { select: { bio: true, photoUrl: true, country: true, languages: true, interests: true, travelStyles: true, completion: true } },
        hostProfile: {
          select: {
            bio: true, photoUrl: true, city: true, country: true, languages: true, expertise: true, categories: true, availabilityNote: true, verification: true, completion: true,
            experiences: { where: { active: true }, select: { id: true, titleEn: true, titleAr: true, category: true, priceCents: true, durationMinutes: true, languages: true, tags: true } },
          },
        },
      },
    });
    if (!u || u.status !== 'ACTIVE' || u.role === 'ADMIN') throw new NotFoundException();
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      travelerProfile: u.travelerProfile,
      // Only expose whether the host is verified, not internal moderation states such as REJECTED.
      hostProfile: u.hostProfile ? { ...u.hostProfile, verification: u.hostProfile.verification === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED' } : null,
    };
  }
}
