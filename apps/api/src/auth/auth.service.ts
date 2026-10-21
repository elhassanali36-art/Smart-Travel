import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { ConfigService } from '../common/config.service';
import { parseTtlSeconds } from '../common/config-rules';
import { PrismaService } from '../common/prisma.service';
import { RateLimiter } from '../common/rate-limiter';
import type { SafeUser } from './auth.guard';
import { LoginDto, RegisterDto } from './dto';
import { hashOpaqueToken, hashPassword, verifyPassword } from './password';

const LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60_000;

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(private readonly db: PrismaService, private readonly config: ConfigService, private readonly limiter: RateLimiter) {}

  private secret() {
    return new TextEncoder().encode(this.config.jwtSecret);
  }

  private normalizeEmail(email?: string) {
    return email?.trim().toLowerCase() || undefined;
  }

  private normalizePhone(phone?: string) {
    return phone?.trim() || undefined;
  }

  private access(userId: string) {
    return new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt()
      .setExpirationTime(this.config.accessTtl)
      .sign(this.secret());
  }

  private newRefreshToken(userId: string) {
    const raw = randomBytes(48).toString('base64url');
    return { raw, data: { userId, tokenHash: hashOpaqueToken(raw), expiresAt: new Date(Date.now() + this.config.refreshDays * 86400000) } };
  }

  private revokeAll(userId: string) {
    return this.db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const phone = this.normalizePhone(dto.phone);
    if (!email && !phone) throw new BadRequestException('Email or phone is required');

    const existing = await this.db.user.findFirst({
      where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
      select: { id: true },
    });
    if (existing) throw new ConflictException('An account with these credentials already exists');

    try {
      const user = await this.db.user.create({
        data: { name: dto.name.trim(), email, phone, passwordHash: await hashPassword(dto.password), role: 'TRAVELER', status: 'ACTIVE' },
        select: { id: true },
      });
      return this.issue(user.id);
    } catch (e) {
      // Two simultaneous registrations can both pass the check above; the unique index decides.
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('An account with these credentials already exists');
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const phone = this.normalizePhone(dto.phone);
    if (!email && !phone) throw new BadRequestException('Email or phone is required');

    // Per-account throttle (in addition to the per-IP route limit) against distributed guessing.
    const key = `login:${email ?? phone}`;
    if (!this.limiter.consume(key, LOGIN_ATTEMPTS, LOGIN_WINDOW_MS).allowed) {
      throw new HttpException('Too many login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.db.user.findFirst({ where: email ? { email } : { phone } });
    // Always run one scrypt verification so unknown accounts cost the same time as known ones.
    const ok = await verifyPassword(dto.password, user?.passwordHash ?? (await this.getDummyHash()));
    if (!user || !ok) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new ForbiddenException('Account is not active');

    this.limiter.reset(key);
    return this.issue(user.id);
  }

  private getDummyHash() {
    this.dummyHash ??= hashPassword('timing-equalisation-placeholder');
    return this.dummyHash;
  }

  private async issue(userId: string) {
    const refresh = this.newRefreshToken(userId);
    await this.db.refreshToken.create({ data: refresh.data });
    return this.tokens(userId, refresh.raw);
  }

  private async tokens(userId: string, refreshToken: string) {
    return { accessToken: await this.access(userId), refreshToken, expiresIn: parseTtlSeconds(this.config.accessTtl) ?? 900 };
  }

  async verifyAccess(token: string): Promise<SafeUser> {
    try {
      const { payload } = await jwtVerify(token, this.secret(), { issuer: this.config.issuer, audience: this.config.audience, algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string') throw new Error('Missing subject');
      // Explicit select: the request context must never carry passwordHash.
      const user = await this.db.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, role: true, status: true } });
      if (!user || user.status !== 'ACTIVE') throw new Error('Inactive user');
      return user;
    } catch {
      throw new UnauthorizedException('Invalid authentication');
    }
  }

  async rotate(raw: string) {
    const token = await this.db.refreshToken.findUnique({ where: { tokenHash: hashOpaqueToken(raw) } });
    if (!token) throw new UnauthorizedException('Invalid refresh token');

    if (token.revokedAt) {
      // A rotated/revoked token is being replayed: assume theft and end every session of that user.
      await this.revokeAll(token.userId);
      throw new UnauthorizedException('Refresh token replayed');
    }
    if (token.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token expired');

    const user = await this.db.user.findUnique({ where: { id: token.userId }, select: { status: true } });
    if (!user || user.status !== 'ACTIVE') {
      await this.revokeAll(token.userId);
      throw new ForbiddenException('Account is not active');
    }

    // Consume the old token and create its replacement atomically: a failure cannot leave the user
    // with a consumed token and no successor, and a concurrent rotation loses the conditional update.
    const next = this.newRefreshToken(token.userId);
    const won = await this.db.$transaction(async (tx) => {
      const consumed = await tx.refreshToken.updateMany({ where: { id: token.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (consumed.count !== 1) return false;
      const created = await tx.refreshToken.create({ data: next.data });
      await tx.refreshToken.update({ where: { id: token.id }, data: { replacedById: created.id } });
      return true;
    });
    if (!won) {
      await this.revokeAll(token.userId);
      throw new UnauthorizedException('Refresh token replayed');
    }
    return this.tokens(token.userId, next.raw);
  }

  async logout(raw: string) {
    await this.db.refreshToken.updateMany({ where: { tokenHash: hashOpaqueToken(raw), revokedAt: null }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  async me(userId: string) {
    const u = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true, travelerProfile: true, hostProfile: true },
    });
    if (!u) throw new UnauthorizedException();
    return u;
  }
}
