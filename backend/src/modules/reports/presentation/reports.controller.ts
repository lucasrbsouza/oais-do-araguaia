import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../../shared/infrastructure/auth/decorators';
import type { AuthenticatedUser } from '../../../shared/infrastructure/auth/decorators';
import { AuditService } from '../../audit/audit.service';
import {
  ExportFile,
  ReportExportService,
} from '../application/report-export.service';
import {
  ChaletEventReport,
  EventReport,
  ReportsQueryService,
} from '../application/reports-query.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsQueryService,
    private readonly exports: ReportExportService,
    private readonly audit: AuditService,
  ) {}

  @Get('events/:eventId')
  eventReport(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<EventReport> {
    return this.reports.eventReport(eventId);
  }

  @Get('events/:eventId/export/xlsx')
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportEventXlsx(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const file = await this.exports.exportEventXlsx(eventId);
    await this.audit.log({
      userId: user.id,
      action: 'REPORT_EXPORTED',
      entity: 'Report',
      entityId: eventId,
      metadata: { format: 'xlsx' },
    });
    return this.toStreamableFile(file, res);
  }

  @Get('events/:eventId/export/pdf')
  @ApiProduces('application/pdf')
  async exportEventPdf(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const file = await this.exports.exportEventPdf(eventId);
    await this.audit.log({
      userId: user.id,
      action: 'REPORT_EXPORTED',
      entity: 'Report',
      entityId: eventId,
      metadata: { format: 'pdf' },
    });
    return this.toStreamableFile(file, res);
  }

  private toStreamableFile(file: ExportFile, res: Response): StreamableFile {
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    });
    return new StreamableFile(file.buffer);
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
