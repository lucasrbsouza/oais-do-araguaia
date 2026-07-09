import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/infrastructure/auth/decorators';
import type { AuthenticatedUser } from '../../../shared/infrastructure/auth/decorators';
import {
  ChaletEventReport,
  EventReport,
  ReportsQueryService,
} from '../application/reports-query.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsQueryService) {}

  @Get('events/:eventId')
  eventReport(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<EventReport> {
    return this.reports.eventReport(eventId);
  }

  @Get('chalets/:chaletId/events/:eventId')
  chaletReport(
    @Param('chaletId', ParseUUIDPipe) chaletId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChaletEventReport> {
    return this.reports.chaletEventReport(chaletId, eventId, user);
  }
}
