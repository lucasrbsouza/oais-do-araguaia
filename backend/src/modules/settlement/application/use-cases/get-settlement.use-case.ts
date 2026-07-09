import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import {
  SettlementRepository,
  SettlementView,
} from '../../domain/settlement.repository';

@Injectable()
export class GetSettlementUseCase {
  constructor(private readonly settlementRepository: SettlementRepository) {}

  async execute(eventId: string): Promise<SettlementView> {
    const view = await this.settlementRepository.findByEvent(eventId);
    if (!view) {
      throw new NotFoundError('Rateio ainda não calculado para este evento.');
    }
    return view;
  }
}
