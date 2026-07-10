import { Injectable } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { Money } from '../../../../shared/domain/money';
import { ExpenseSharingStrategy } from '../../domain/expense-sharing.strategy';
import {
  SettlementRepository,
  SettlementView,
} from '../../domain/settlement.repository';

@Injectable()
export class CalculateSettlementUseCase {
  constructor(
    private readonly settlementRepository: SettlementRepository,
    private readonly strategy: ExpenseSharingStrategy,
  ) {}

  async execute(
    eventId: string,
    requestedById: string,
  ): Promise<SettlementView> {
    const input = await this.settlementRepository.getCalculationInput(eventId);
    if (!input) {
      throw new NotFoundError('Evento não encontrado.');
    }
    if (input.eventStatus === EventStatus.CLOSED) {
      throw new ConflictError('Evento encerrado: o rateio está congelado.');
    }
    if (input.eventStatus === EventStatus.CANCELLED) {
      throw new ConflictError('Evento cancelado: o rateio não está disponível.');
    }

    const shares = this.strategy.calculate({
      occupancies: input.occupancies,
      commonTotal: Money.fromCents(input.commonTotalCents),
      alcoholTotal: Money.fromCents(input.alcoholTotalCents),
    });

    await this.settlementRepository.save(
      eventId,
      this.strategy.name,
      shares,
      requestedById,
    );

    const view = await this.settlementRepository.findByEvent(eventId);
    if (!view) {
      throw new NotFoundError('Falha ao gravar o rateio.');
    }
    return view;
  }
}
