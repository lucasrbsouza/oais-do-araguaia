import { Module } from '@nestjs/common';
import { ReportExportService } from './application/report-export.service';
import { ReportsQueryService } from './application/reports-query.service';
import { ReservationsExportService } from './application/reservations-export.service';
import { ReservationsReportService } from './application/reservations-report.service';
import { ReportsController } from './presentation/reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [
    ReportsQueryService,
    ReportExportService,
    ReservationsReportService,
    ReservationsExportService,
  ],
})
export class ReportsModule {}
