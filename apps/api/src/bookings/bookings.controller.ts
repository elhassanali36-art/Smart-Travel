import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { AuthedRequest, Roles } from '../auth/auth.guard';
import { BookingsService } from './bookings.service';
import { BookingDto, DisputeDto, ResolveDisputeDto } from './dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Get() list(@Req() req: AuthedRequest) { return this.service.list(req.user); }
  @Post() create(@Req() req: AuthedRequest, @Body() dto: BookingDto) { return this.service.create(req.user, dto); }

  // Administrator tools. Declared before ':id' routes so the literal paths win.
  @Roles(Role.ADMIN) @Get('disputes') disputes() { return this.service.disputes(); }
  @Roles(Role.ADMIN) @Post('expire-overdue') expireOverdue(@Req() req: AuthedRequest) { return this.service.expireOverdueAudited(req.user.id); }

  @Post(':id/status/:status')
  status(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('status', new ParseEnumPipe(BookingStatus)) status: BookingStatus) {
    return this.service.transition(req.user, id, status);
  }

  @Post(':id/dispute')
  dispute(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DisputeDto) { return this.service.dispute(req.user, id, dto.reason); }

  @Roles(Role.ADMIN) @Post(':id/resolve')
  resolve(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDisputeDto) { return this.service.resolve(req.user.id, id, dto.outcome, dto.note); }
}
