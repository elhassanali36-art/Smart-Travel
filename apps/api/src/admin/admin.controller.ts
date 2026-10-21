import { BadRequestException, Body, Controller, DefaultValuePipe, Get, NotFoundException, Param, ParseIntPipe, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthedRequest, Roles } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { runSerializable } from '../common/tx';
import { HostVerificationDto, ReportStatusDto, UserRoleDto, UserStatusDto } from './dto';

const SAFE_USER = { id: true, name: true, email: true, phone: true, role: true, status: true, updatedAt: true } as const;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly db: PrismaService) {}

  @Get('overview')
  async overview() {
    const [users, hosts, experiences, bookings, reports] = await Promise.all([
      this.db.user.count(),
      this.db.hostProfile.count(),
      this.db.experience.count(),
      this.db.booking.count(),
      this.db.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
    ]);
    return { users, hosts, experiences, bookings, openReports: reports };
  }

  @Get('users')
  users(@Query('take', new DefaultValuePipe(200), ParseIntPipe) take = 200) {
    return this.db.user.findMany({
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: clamp(take, 1, 500),
    });
  }

  // Every privileged mutation below runs in one serializable transaction together with its audit row,
  // so the "last active administrator" check cannot be defeated by two concurrent requests.
  @Patch('users/:id/status')
  status(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UserStatusDto) {
    return runSerializable(this.db, async (tx) => {
      const target = await tx.user.findUnique({ where: { id }, select: { role: true, status: true } });
      if (!target) throw new NotFoundException('User not found');
      if (target.role === Role.ADMIN && target.status === 'ACTIVE' && dto.status !== 'ACTIVE') {
        const activeAdmins = await tx.user.count({ where: { role: Role.ADMIN, status: 'ACTIVE' } });
        if (activeAdmins <= 1) throw new BadRequestException('Cannot deactivate the last active administrator');
      }
      const updated = await tx.user.update({ where: { id }, data: { status: dto.status }, select: SAFE_USER });
      // A deactivated account must not be able to renew its session.
      if (dto.status !== 'ACTIVE') await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'USER_STATUS_CHANGED', targetType: 'User', targetId: id, metadata: { from: target.status, to: dto.status } } });
      return updated;
    });
  }

  @Patch('users/:id/role')
  role(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UserRoleDto) {
    return runSerializable(this.db, async (tx) => {
      const target = await tx.user.findUnique({ where: { id }, select: { role: true, status: true } });
      if (!target) throw new NotFoundException('User not found');
      if (target.role === Role.ADMIN && dto.role !== Role.ADMIN && target.status === 'ACTIVE') {
        const admins = await tx.user.count({ where: { role: Role.ADMIN, status: 'ACTIVE' } });
        if (admins <= 1) throw new BadRequestException('Cannot remove the last active administrator');
      }
      const updated = await tx.user.update({ where: { id }, data: { role: dto.role }, select: SAFE_USER });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'USER_ROLE_CHANGED', targetType: 'User', targetId: id, metadata: { from: target.role, to: dto.role } } });
      return updated;
    });
  }

  @Patch('hosts/:id/verification')
  verify(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: HostVerificationDto) {
    return runSerializable(this.db, async (tx) => {
      const host = await tx.hostProfile.findUnique({ where: { userId: id }, select: { verification: true } });
      if (!host) throw new NotFoundException('Host profile not found');
      const updated = await tx.hostProfile.update({ where: { userId: id }, data: { verification: dto.verification } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'HOST_VERIFICATION_CHANGED', targetType: 'HostProfile', targetId: id, metadata: { from: host.verification, to: dto.verification } } });
      return updated;
    });
  }

  @Get('reports')
  reports() {
    return this.db.report.findMany({
      include: { reporter: { select: { id: true, name: true } }, reportedUser: { select: { id: true, name: true, status: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
  }

  @Patch('reports/:id')
  report(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportStatusDto) {
    return runSerializable(this.db, async (tx) => {
      const current = await tx.report.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new NotFoundException('Report not found');
      const updated = await tx.report.update({ where: { id }, data: { status: dto.status } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'REPORT_STATUS_CHANGED', targetType: 'Report', targetId: id, metadata: { from: current.status, to: dto.status } } });
      return updated;
    });
  }

  @Get('audit-logs')
  auditLogs(@Query('take', new DefaultValuePipe(100), ParseIntPipe) take = 100) {
    return this.db.auditLog.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: clamp(take, 1, 500) });
  }
}
