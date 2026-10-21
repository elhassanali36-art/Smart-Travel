import { Body, Controller, Post, Req } from '@nestjs/common';
import { AuthedRequest } from '../auth/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { CreateReportDto } from './dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @RateLimit(10, 60) @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateReportDto) { return this.service.create(req.user.id, dto); }
}
