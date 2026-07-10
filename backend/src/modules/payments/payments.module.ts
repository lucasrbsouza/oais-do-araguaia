import { Module } from '@nestjs/common';
import { ChaletsModule } from '../chalets/chalets.module';
import { EventsModule } from '../events/events.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { SettlementModule } from '../settlement/settlement.module';
import {
  GetEventPaymentsUseCase,
  RegisterPaymentUseCase,
} from './application/use-cases/manage-payment.use-cases';
import {
  ListEventReceivablesUseCase,
  ListOpenReceivablesUseCase,
  SettleReceivableUseCase,
} from './application/use-cases/manage-receivable.use-cases';
import { PaymentRepository } from './domain/payment.repository';
import { ReceivableRepository } from './domain/receivable.repository';
import { PrismaPaymentRepository } from './infrastructure/prisma-payment.repository';
import { PrismaReceivableRepository } from './infrastructure/prisma-receivable.repository';
import { PaymentsController } from './presentation/payments.controller';

@Module({
  imports: [EventsModule, ChaletsModule, SettlementModule, PurchasesModule],
  controllers: [PaymentsController],
  providers: [
    { provide: PaymentRepository, useClass: PrismaPaymentRepository },
    { provide: ReceivableRepository, useClass: PrismaReceivableRepository },
    RegisterPaymentUseCase,
    GetEventPaymentsUseCase,
    ListEventReceivablesUseCase,
    ListOpenReceivablesUseCase,
    SettleReceivableUseCase,
  ],
  exports: [PaymentRepository],
})
export class PaymentsModule {}
