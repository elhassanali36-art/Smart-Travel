import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthedRequest, Public, Roles } from '../auth/auth.guard';
import { ExperienceDto, UpdateExperienceDto } from './dto';
import { ExperiencesService } from './experiences.service';

@Controller('experiences')
export class ExperiencesController {
  constructor(private readonly service: ExperiencesService) {}

  @Public() @Get()
  list(
    @Query('destinationId', new ParseUUIDPipe({ optional: true })) destinationId?: string,
    @Query('category') category?: string,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take = 50,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip = 0,
  ) {
    return this.service.list(destinationId, category, take, skip);
  }

  // The caller's own experiences, including inactive ones. Declared before any ':id' route.
  @Roles(Role.LOCAL_HOST, Role.ADMIN) @Get('mine')
  mine(@Req() req: AuthedRequest) { return this.service.mine(req.user.id); }

  @Roles(Role.LOCAL_HOST, Role.ADMIN) @Post()
  create(@Req() req: AuthedRequest, @Body() dto: ExperienceDto) { return this.service.create(req.user.id, dto); }

  @Roles(Role.LOCAL_HOST, Role.ADMIN) @Put(':id')
  update(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExperienceDto) { return this.service.update(req.user.id, id, dto); }
}
