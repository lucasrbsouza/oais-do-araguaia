import { Injectable } from '@nestjs/common';
import { ReceivableStatus, Role } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { ChaletRepository } from '../../../chalets/domain/chalet.repository';
import {
  ReceivableDetail,
  ReceivableRepository,
} from '../../domain/receivable.repository';

export interface ReceivableResponse {
  id: string;
  eventId: string;
  eventName: string;
  chaletId: string;
  chaletNumber: number;
  chaletName: string;
  amountCents: number;
  status: ReceivableStatus;
  settledAt: Date | null;
  notes: string | null;
  createdAt: Date;
}

const toReceivableResponse = (r: ReceivableDetail): ReceivableResponse => ({
  id: r.id,
  eventId: r.eventId,
  eventName: r.event.name,
  chaletId: r.chaletId,
  chaletNumber: r.chalet.number,
  chaletName: r.chalet.name,
  amountCents: r.amountCents,
  status: r.status,
  settledAt: r.settledAt,
  notes: r.notes,
  createdAt: r.createdAt,
});

@Injectable()
export class ListEventReceivablesUseCase {
  constructor(
    private readonly receivableRepository: ReceivableRepository,
    private readonly chaletRepository: ChaletRepository,
  ) {}

  async execute(
    eventId: string,
    user: AuthenticatedUser,
  ): Promise<ReceivableResponse[]> {
    let receivables = await this.receivableRepository.listByEvent(eventId);
    if (user.role !== Role.ADMIN) {
      const ownChalets = await this.chaletRepository.findByOwner(user.id);
      const ownIds = new Set(ownChalets.map((c) => c.id));
      receivables = receivables.filter((r) => ownIds.has(r.chaletId));
    }
    return receivables.map(toReceivableResponse);
  }
}

@Injectable()
export class SettleReceivableUseCase {
  constructor(private readonly receivableRepository: ReceivableRepository) {}

  async execute(id: string, notes?: string): Promise<ReceivableResponse> {
    const receivable = await this.receivableRepository.findById(id);
    if (!receivable) {
      throw new NotFoundError('Crédito não encontrado.');
    }
    if (receivable.status === ReceivableStatus.SETTLED) {
      throw new ConflictError('Este crédito já foi quitado.');
    }
    const settled = await this.receivableRepository.settle(id, notes);
    return toReceivableResponse(settled);
  }
}

@Injectable()
export class ListOpenReceivablesUseCase {
  constructor(
    private readonly receivableRepository: ReceivableRepository,
    private readonly chaletRepository: ChaletRepository,
  ) {}

  async execute(user: AuthenticatedUser): Promise<ReceivableResponse[]> {
    let receivables = await this.receivableRepository.listOpen();
    if (user.role !== Role.ADMIN) {
      const ownChalets = await this.chaletRepository.findByOwner(user.id);
      const ownIds = new Set(ownChalets.map((c) => c.id));
      receivables = receivables.filter((r) => ownIds.has(r.chaletId));
      if (receivables.length === 0) {
        return [];
      }
    }
    return receivables.map(toReceivableResponse);
  }
}
