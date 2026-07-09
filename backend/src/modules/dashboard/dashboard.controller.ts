import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  DashboardQueryService,
  DashboardSummary,
} from './dashboard-query.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardQueryService) {}

  @Get()
  summary(): Promise<DashboardSummary> {
    return this.dashboard.summary();
  }
}
