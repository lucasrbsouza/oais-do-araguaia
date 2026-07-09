import { Module } from '@nestjs/common';
import { DashboardQueryService } from './dashboard-query.service';
import { DashboardController } from './dashboard.controller';

@Module({
  controllers: [DashboardController],
  providers: [DashboardQueryService],
})
export class DashboardModule {}
