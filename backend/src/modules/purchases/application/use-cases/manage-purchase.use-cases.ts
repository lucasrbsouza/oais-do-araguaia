import { Injectable } from '@nestjs/common';
import { EventStatus, PurchaseCategory } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { EventRepository } from '../../../events/domain/event.repository';
import { FileStorage } from '../../domain/file-storage';
import {
  ListPurchasesFilter,
  PurchaseDetail,
  PurchaseRepository,
} from '../../domain/purchase.repository';

export interface PurchaseResponse {
  id: string;
  eventId: string;
  date: Date;
  description: string;
  category: string;
  amountCents: number;
  responsible: { id: string; name: string };
  hasReceipt: boolean;
}

const toPurchaseResponse = (purchase: PurchaseDetail): PurchaseResponse => ({
  id: purchase.id,
  eventId: purchase.eventId,
  date: purchase.date,
  description: purchase.description,
  category: purchase.category,
  amountCents: purchase.amountCents,
  responsible: { id: purchase.responsible.id, name: purchase.responsible.name },
  hasReceipt: purchase.receiptPath !== null,
});

export interface CreatePurchaseInput {
  eventId: string;
  date: Date;
  description: string;
  category: PurchaseCategory;
  amountCents: number;
  responsibleId: string;
}

export interface UpdatePurchaseInput {
  id: string;
  date?: Date;
  description?: string;
  category?: PurchaseCategory;
  amountCents?: number;
}

@Injectable()
export class PurchaseEventGate {
  constructor(private readonly eventRepository: EventRepository) {}

  async ensureOpen(eventId: string): Promise<void> {
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    if (event.status === EventStatus.CLOSED) {
      throw new ConflictError(
        'Evento encerrado: compras não podem ser alteradas.',
      );
    }
  }
}

@Injectable()
export class CreatePurchaseUseCase {
  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly eventGate: PurchaseEventGate,
  ) {}

  async execute(input: CreatePurchaseInput): Promise<PurchaseResponse> {
    await this.eventGate.ensureOpen(input.eventId);
    const purchase = await this.purchaseRepository.create(input);
    return toPurchaseResponse(purchase);
  }
}

@Injectable()
export class UpdatePurchaseUseCase {
  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly eventGate: PurchaseEventGate,
  ) {}

  async execute(input: UpdatePurchaseInput): Promise<PurchaseResponse> {
    const purchase = await this.purchaseRepository.findById(input.id);
    if (!purchase) {
      throw new NotFoundError('Compra não encontrada.');
    }
    await this.eventGate.ensureOpen(purchase.eventId);
    const updated = await this.purchaseRepository.update(input.id, {
      date: input.date,
      description: input.description,
      category: input.category,
      amountCents: input.amountCents,
    });
    return toPurchaseResponse(updated);
  }
}

@Injectable()
export class DeletePurchaseUseCase {
  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly eventGate: PurchaseEventGate,
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(id: string): Promise<void> {
    const purchase = await this.purchaseRepository.findById(id);
    if (!purchase) {
      throw new NotFoundError('Compra não encontrada.');
    }
    await this.eventGate.ensureOpen(purchase.eventId);
    if (purchase.receiptPath) {
      await this.fileStorage.delete(purchase.receiptPath);
    }
    await this.purchaseRepository.delete(id);
  }
}

@Injectable()
export class ListPurchasesUseCase {
  constructor(private readonly purchaseRepository: PurchaseRepository) {}

  async execute(filter: ListPurchasesFilter): Promise<PurchaseResponse[]> {
    const purchases = await this.purchaseRepository.list(filter);
    return purchases.map(toPurchaseResponse);
  }
}

@Injectable()
export class AttachReceiptUseCase {
  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly eventGate: PurchaseEventGate,
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(
    id: string,
    buffer: Buffer,
    originalName: string,
  ): Promise<PurchaseResponse> {
    const purchase = await this.purchaseRepository.findById(id);
    if (!purchase) {
      throw new NotFoundError('Compra não encontrada.');
    }
    await this.eventGate.ensureOpen(purchase.eventId);

    if (purchase.receiptPath) {
      await this.fileStorage.delete(purchase.receiptPath);
    }
    const stored = await this.fileStorage.save(buffer, originalName);
    const updated = await this.purchaseRepository.update(id, {
      receiptPath: stored.path,
    });
    return toPurchaseResponse(updated);
  }
}

@Injectable()
export class GetReceiptUseCase {
  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(id: string): Promise<string> {
    const purchase = await this.purchaseRepository.findById(id);
    if (!purchase?.receiptPath) {
      throw new NotFoundError('Comprovante não encontrado.');
    }
    return this.fileStorage.resolve(purchase.receiptPath);
  }
}
