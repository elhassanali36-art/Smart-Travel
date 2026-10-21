import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req } from '@nestjs/common';
import { AuthedRequest } from '../auth/auth.guard';
import { HostProfileDto, TravelerProfileDto } from './dto';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly service: ProfilesService) {}

  @Get('me') me(@Req() req: AuthedRequest) { return this.service.me(req.user.id); }
  @Put('me/traveler') traveler(@Req() req: AuthedRequest, @Body() dto: TravelerProfileDto) { return this.service.traveler(req.user.id, dto); }
  @Put('me/host') host(@Req() req: AuthedRequest, @Body() dto: HostProfileDto) { return this.service.host(req.user.id, dto); }
  // Declared after the 'me' routes so ':id' never shadows them.
  @Get(':id') publicProfile(@Param('id', ParseUUIDPipe) id: string) { return this.service.publicProfile(id); }
}
