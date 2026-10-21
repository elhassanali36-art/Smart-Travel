import { Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { AuthedRequest } from '../auth/auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get() list(@Req() req: AuthedRequest) { return this.service.list(req.user.id); }
  @Post(':id/read') read(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.service.read(req.user.id, id); }
}
