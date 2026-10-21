import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import { AuthedRequest } from '../auth/auth.guard';
import { TripDto, UpdateTripDto } from './dto';
import { ItineraryItemDto } from './itinerary.dto';
import { TripsService } from './trips.service';

@Controller('trips')
export class TripsController {
  constructor(private readonly service: TripsService) {}

  @Get() list(@Req() req: AuthedRequest) { return this.service.list(req.user.id); }
  @Post() create(@Req() req: AuthedRequest, @Body() dto: TripDto) { return this.service.create(req.user.id, dto); }
  @Put(':id') update(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTripDto) { return this.service.update(req.user.id, id, dto); }
  @Post(':id/itinerary') addItem(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ItineraryItemDto) { return this.service.addItineraryItem(req.user.id, id, dto); }
  @Put(':id/itinerary/:itemId') updateItem(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: ItineraryItemDto) { return this.service.updateItineraryItem(req.user.id, id, itemId, dto); }
  @Delete(':id/itinerary/:itemId') deleteItem(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) { return this.service.deleteItineraryItem(req.user.id, id, itemId); }
}
