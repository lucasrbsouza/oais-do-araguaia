import { Module } from '@nestjs/common';
import { ChaletsModule } from '../chalets/chalets.module';
import { EventsModule } from '../events/events.module';
import { SettlementModule } from '../settlement/settlement.module';
import {
  GetEventPaymentsUseCase,
  RegisterPaymentUseCase,
} from './application/use-cases/manage-payment.use-cases';
import { PaymentRepository } from './domain/payment.repository';
import { PrismaPaymentRepository } from './infrastructure/prisma-payment.repository';
import { PaymentsController } from './presentation/payments.controller';

@Module({
  imports: [EventsModule, ChaletsModule, SettlementModule],
  controllers: [PaymentsController],
  providers: [
    { provide: PaymentRepository, useClass: PrismaPaymentRepository },
    RegisterPaymentUseCase,
    GetEventPaymentsUseCase,
  ],
  exports: [PaymentRepository],
})
export class PaymentsModule {}
