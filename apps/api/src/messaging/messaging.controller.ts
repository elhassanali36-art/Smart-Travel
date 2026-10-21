import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthedRequest } from '../auth/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { SendMessageDto } from './dto';
import { MessagingService } from './messaging.service';

@Controller('messages')
export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  @Get() list(@Req() req: AuthedRequest) { return this.service.list(req.user.id); }
  @RateLimit(30, 60) @Post() send(@Req() req: AuthedRequest, @Body() dto: SendMessageDto) { return this.service.send(req.user.id, dto); }
}
