import { Injectable } from '@nestjs/common';
import { SettlementAutoMode } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/domain-error';
import {
  SettlementAutoConfig,
  SettlementRepository,
} from '../../domain/settlement.repository';

@Injectable()
export class GetSettlementAutoConfigUseCase {
  constructor(private readonly settlementRepository: SettlementRepository) {}

  async execute(eventId: string): Promise<SettlementAutoConfig> {
    const config = await this.settlementRepository.getAutoConfig(eventId);
    if (!config) {
      throw new NotFoundError('Evento não encontrado.');
    }
    return config;
  }
}

@Injectable()
export class SetSettlementAutoConfigUseCase {
  constructor(private readonly settlementRepository: SettlementRepository) {}

  async execute(
    eventId: string,
    input: { mode: SettlementAutoMode; intervalMinutes?: number },
    setById: string,
  ): Promise<SettlementAutoConfig> {
    const existing = await this.settlementRepository.getAutoConfig(eventId);
    if (!existing) {
      throw new NotFoundError('Evento não encontrado.');
    }

    if (
      input.mode === SettlementAutoMode.INTERVAL &&
      (!input.intervalMinutes || input.intervalMinutes < 1)
    ) {
      throw new ValidationError(
        'Informe o intervalo em minutos para o rateio automático por tempo.',
      );
    }

    return this.settlementRepository.setAutoConfig(
      eventId,
      {
        mode: input.mode,
        intervalMinutes:
          input.mode === SettlementAutoMode.INTERVAL
            ? (input.intervalMinutes ?? null)
            : null,
      },
      setById,
    );
  }
}
