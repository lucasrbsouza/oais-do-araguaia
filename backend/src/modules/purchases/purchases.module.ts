import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import {
  AttachReceiptUseCase,
  CreatePurchaseUseCase,
  DeletePurchaseUseCase,
  GetReceiptUseCase,
  ListPurchasesUseCase,
  PurchaseEventGate,
  UpdatePurchaseUseCase,
} from './application/use-cases/manage-purchase.use-cases';
import { FileStorage } from './domain/file-storage';
import { PurchaseRepository } from './domain/purchase.repository';
import { LocalFileStorage } from './infrastructure/local-file-storage';
import { PrismaPurchaseRepository } from './infrastructure/prisma-purchase.repository';
import { PurchasesController } from './presentation/purchases.controller';

@Module({
  imports: [EventsModule],
  controllers: [PurchasesController],
  providers: [
    { provide: PurchaseRepository, useClass: PrismaPurchaseRepository },
    { provide: FileStorage, useClass: LocalFileStorage },
    PurchaseEventGate,
    CreatePurchaseUseCase,
    UpdatePurchaseUseCase,
    DeletePurchaseUseCase,
    ListPurchasesUseCase,
    AttachReceiptUseCase,
    GetReceiptUseCase,
  ],
})
export class PurchasesModule {}
