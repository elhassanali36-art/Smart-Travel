import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { AuthedRequest } from '../auth/auth.guard';
import { CreateReviewDto } from './dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Post(':bookingId') create(@Req() req: AuthedRequest, @Param('bookingId', ParseUUIDPipe) id: string, @Body() dto: CreateReviewDto) { return this.service.create(req.user.id, id, dto); }
  @Get('user/:userId') list(@Param('userId', ParseUUIDPipe) id: string) { return this.service.list(id); }
}
