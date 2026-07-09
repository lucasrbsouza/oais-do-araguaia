import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../../shared/domain/domain-error';
import {
  ADULT_WEIGHT,
  CHILD_WEIGHT,
  ExpenseSharingStrategy,
  SettlementInput,
  SettlementShare,
} from './expense-sharing.strategy';

/**
 * Rateio padrão do condomínio:
 * - Despesas comuns: proporcionais ao peso dos hóspedes (adulto 1.0, criança 0.5).
 * - Bebidas alcoólicas: divididas igualmente apenas entre os consumidores marcados.
 * A soma das partes fecha exatamente com os totais (método do maior resto).
 */
@Injectable()
export class WeightedExpenseSharingStrategy extends ExpenseSharingStrategy {
  readonly name = 'weighted-common+alcohol-consumers';

  calculate(input: SettlementInput): SettlementShare[] {
    const { occupancies, commonTotal, alcoholTotal } = input;

    const guestWeights = occupancies.map(
      (o) => o.adults * ADULT_WEIGHT + o.children * CHILD_WEIGHT,
    );
    const alcoholWeights = occupancies.map((o) => o.alcoholConsumers);

    if (!commonTotal.isZero() && guestWeights.every((w) => w === 0)) {
      throw new ValidationError(
        'Há despesas comuns, mas nenhuma reserva com hóspedes neste evento.',
      );
    }
    if (!alcoholTotal.isZero() && alcoholWeights.every((w) => w === 0)) {
      throw new ValidationError(
        'Há despesas com bebidas alcoólicas, mas nenhum consumidor marcado nas reservas.',
      );
    }

    const commonShares = commonTotal.allocateByWeights(guestWeights);
    const alcoholShares = alcoholTotal.allocateByWeights(alcoholWeights);

    return occupancies.map((occupancy, index) => ({
      chaletId: occupancy.chaletId,
      commonCents: commonShares[index].cents,
      alcoholCents: alcoholShares[index].cents,
      totalCents: commonShares[index].add(alcoholShares[index]).cents,
    }));
  }
}
