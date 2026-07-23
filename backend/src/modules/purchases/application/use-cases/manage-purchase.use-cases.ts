import { Injectable } from '@nestjs/common';
import { EventStatus, PurchaseCategory, Role } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { ChaletRepository } from '../../../chalets/domain/chalet.repository';
import { EventRepository } from '../../../events/domain/event.repository';
import { AutoSettlementService } from '../../../settlement/application/auto-settlement.service';
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
  description: string | null;
  category: string;
  amountCents: number;
  responsible: { id: string; name: string };
  chalet: { id: string; number: number; name: string } | null;
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
  chalet: purchase.chalet
    ? {
        id: purchase.chalet.id,
        number: purchase.chalet.number,
        name: purchase.chalet.name,
      }
    : null,
  hasReceipt: purchase.receiptPath !== null,
});

export interface CreatePurchaseInput {
  eventId: string;
  date: Date;
  description?: string | null;
  category: PurchaseCategory;
  amountCents: number;
  responsibleId: string;
  chaletId?: string | null;
}

export interface UpdatePurchaseInput {
  id: string;
  date?: Date;
  description?: string | null;
  category?: PurchaseCategory;
  amountCents?: number;
  chaletId?: string | null;
}

@Injectable()
export class PurchaseEventGate {
  constructor(private readonly eventRepository: EventRepository) {}

  async ensureOpen(eventId: string): Promise<void> {
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    if (event.status !== EventStatus.OPEN) {
      const label =
        event.status === EventStatus.CLOSED ? 'encerrado' : 'cancelado';
      throw new ConflictError(
        `Evento ${label}: compras não podem ser alteradas.`,
      );
    }
  }
}

@Injectable()
export class PurchaseChaletGate {
  constructor(private readonly chaletRepository: ChaletRepository) {}

  async ensureExists(chaletId: string): Promise<void> {
    const chalet = await this.chaletRepository.findById(chaletId);
    if (!chalet) {
      throw new NotFoundError('Chalé não encontrado.');
    }
  }

  /**
   * Proprietário: toda compra é vinculada ao próprio chalé, sem escolha.
   * Retorna o chaletId a usar (o informado, se for dele; senão o dele).
   */
  async resolveForOwner(
    user: AuthenticatedUser,
    requestedChaletId?: string | null,
  ): Promise<string> {
    const ownChalets = await this.chaletRepository.findAccessibleByUser(
      user.id,
    );
    if (ownChalets.length === 0) {
      throw new ForbiddenError(
        'Você não possui chalé vinculado para lançar compras.',
      );
    }
    const ownIds = new Set(ownChalets.map((c) => c.id));
    if (requestedChaletId && !ownIds.has(requestedChaletId)) {
      throw new ForbiddenError(
        'Compras de proprietários são vinculadas ao próprio chalé.',
      );
    }
    return requestedChaletId ?? ownChalets[0].id;
  }

  async ensureCanManage(
    purchase: { responsibleId: string; chaletId: string | null },
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.role === Role.ADMIN) {
      return;
    }

    if (purchase.responsibleId === user.id) {
      return;
    }

    if (purchase.chaletId) {
      const ownChalets = await this.chaletRepository.findAccessibleByUser(
        user.id,
      );
      const ownIds = new Set(ownChalets.map((c) => c.id));
      if (ownIds.has(purchase.chaletId)) {
        return;
      }
    }

    throw new ForbiddenError(
      'Você não tem permissão para alterar esta compra.',
    );
  }
}

@Injectable()
export class CreatePurchaseUseCase {
  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly eventGate: PurchaseEventGate,
    private readonly chaletGate: PurchaseChaletGate,
    private readonly autoSettlement: AutoSettlementService,
  ) {}

  async execute(
    input: CreatePurchaseInput,
    user: AuthenticatedUser,
  ): Promise<PurchaseResponse> {
    await this.eventGate.ensureOpen(input.eventId);

    let chaletId = input.chaletId ?? null;
    if (user.role !== Role.ADMIN) {
      chaletId = await this.chaletGate.resolveForOwner(user, input.chaletId);
    } else if (chaletId) {
      await this.chaletGate.ensureExists(chaletId);
    }

    const purchase = await this.purchaseRepository.create({
      ...input,
      chaletId,
    });
    await this.autoSettlement.onPurchaseChange(input.eventId, user.id);
    return toPurchaseResponse(purchase);
  }
}

@Injectable()
export class UpdatePurchaseUseCase {
  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly eventGate: PurchaseEventGate,
    private readonly chaletGate: PurchaseChaletGate,
    private readonly autoSettlement: AutoSettlementService,
  ) {}

  async execute(
    input: UpdatePurchaseInput,
    user: AuthenticatedUser,
  ): Promise<PurchaseResponse> {
    const purchase = await this.purchaseRepository.findById(input.id);
    if (!purchase) {
      throw new NotFoundError('Compra não encontrada.');
    }
    await this.eventGate.ensureOpen(purchase.eventId);
    await this.chaletGate.ensureCanManage(purchase, user);

    // Proprietário não altera o vínculo do chalé; admin pode.
    let chaletId = input.chaletId;
    if (user.role !== Role.ADMIN) {
      chaletId = undefined;
    } else if (chaletId) {
      await this.chaletGate.ensureExists(chaletId);
    }

    const updated = await this.purchaseRepository.update(input.id, {
      date: input.date,
      description: input.description,
      category: input.category,
      amountCents: input.amountCents,
      chaletId,
    });
    await this.autoSettlement.onPurchaseChange(purchase.eventId, user.id);
    return toPurchaseResponse(updated);
  }
}

@Injectable()
export class DeletePurchaseUseCase {
  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly eventGate: PurchaseEventGate,
    private readonly fileStorage: FileStorage,
    private readonly chaletGate: PurchaseChaletGate,
    private readonly autoSettlement: AutoSettlementService,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<void> {
    const purchase = await this.purchaseRepository.findById(id);
    if (!purchase) {
      throw new NotFoundError('Compra não encontrada.');
    }
    await this.eventGate.ensureOpen(purchase.eventId);
    await this.chaletGate.ensureCanManage(purchase, user);
    if (purchase.receiptPath) {
      await this.fileStorage.delete(purchase.receiptPath);
    }
    await this.purchaseRepository.delete(id);
    await this.autoSettlement.onPurchaseChange(purchase.eventId, user.id);
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
    private readonly chaletGate: PurchaseChaletGate,
  ) {}

  async execute(
    id: string,
    buffer: Buffer,
    originalName: string,
    user: AuthenticatedUser,
  ): Promise<PurchaseResponse> {
    const purchase = await this.purchaseRepository.findById(id);
    if (!purchase) {
      throw new NotFoundError('Compra não encontrada.');
    }
    await this.eventGate.ensureOpen(purchase.eventId);
    await this.chaletGate.ensureCanManage(purchase, user);

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
