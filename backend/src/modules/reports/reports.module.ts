import { Module } from '@nestjs/common';
import { ReportExportService } from './application/report-export.service';
import { ReportsQueryService } from './application/reports-query.service';
import { ReportsController } from './presentation/reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [ReportsQueryService, ReportExportService],
})
export class ReportsModule {}
