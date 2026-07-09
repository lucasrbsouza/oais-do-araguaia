import { Module } from '@nestjs/common';
import { ReportsQueryService } from './application/reports-query.service';
import { ReportsController } from './presentation/reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [ReportsQueryService],
})
export class ReportsModule {}
