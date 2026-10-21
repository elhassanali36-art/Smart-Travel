import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Query } from '@nestjs/common';
import { Public } from '../auth/auth.guard';
import { DestinationsService } from './destinations.service';

@Controller('destinations')
export class DestinationsController {
  constructor(private readonly service: DestinationsService) {}

  @Public() @Get()
  list(@Query('q') q?: string, @Query('take', new DefaultValuePipe(50), ParseIntPipe) take = 50, @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip = 0) {
    return this.service.list(q, take, skip);
  }

  @Public() @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }
}
