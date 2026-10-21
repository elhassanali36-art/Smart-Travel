import { Body, Controller, Post } from '@nestjs/common';
import { DeterministicTravelAI } from '../ai';
import { RateLimit } from '../common/rate-limit.guard';
import { AiRecommendDto } from './dto';

@Controller('ai')
export class AiController {
  private readonly provider = new DeterministicTravelAI();

  // Output is advisory text only; nothing here can change roles, bookings or any stored record.
  @RateLimit(20, 60) @Post('recommend')
  recommend(@Body() body: AiRecommendDto) {
    return this.provider.recommend({ prompt: body.prompt.trim(), context: body.context ?? {} });
  }
}
