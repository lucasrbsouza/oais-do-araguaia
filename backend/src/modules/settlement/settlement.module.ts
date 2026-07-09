import { Module } from '@nestjs/common';
import { CalculateSettlementUseCase } from './application/use-cases/calculate-settlement.use-case';
import { GetSettlementUseCase } from './application/use-cases/get-settlement.use-case';
import { ExpenseSharingStrategy } from './domain/expense-sharing.strategy';
import { SettlementRepository } from './domain/settlement.repository';
import { WeightedExpenseSharingStrategy } from './domain/weighted-expense-sharing.strategy';
import { PrismaSettlementRepository } from './infrastructure/prisma-settlement.repository';
import { SettlementController } from './presentation/settlement.controller';

@Module({
  controllers: [SettlementController],
  providers: [
    { provide: SettlementRepository, useClass: PrismaSettlementRepository },
    {
      provide: ExpenseSharingStrategy,
      useClass: WeightedExpenseSharingStrategy,
    },
    CalculateSettlementUseCase,
    GetSettlementUseCase,
  ],
  exports: [SettlementRepository, ExpenseSharingStrategy],
})
export class SettlementModule {}
