import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../../shared/domain/domain-error';
import {
  ADULT_WEIGHT,
  CHILD_WEIGHT,
  ChaletStay,
  ExpenseSharingStrategy,
  SettlementInput,
  SettlementShare,
} from './expense-sharing.strategy';

interface ChaletWeights {
  chaletId: string;
  guestWeight: number;
  alcoholWeight: number;
}

/**
 * Rateio padrão do condomínio, em pessoa-diária:
 * - Despesas comuns: proporcionais a (adulto 1.0, criança 0.5) × diárias.
 * - Bebidas alcoólicas: proporcionais a consumidores marcados × diárias.
 * Um chalé pode ter várias entradas (3 suítes, estadias de durações
 * diferentes); os pesos de todas as entradas somam no chalé, que recebe uma
 * única cota. A soma das partes fecha exatamente com os totais (maior resto).
 */
@Injectable()
export class WeightedExpenseSharingStrategy extends ExpenseSharingStrategy {
  readonly name = 'weighted-common+alcohol-consumers';

  calculate(input: SettlementInput): SettlementShare[] {
    const { stays, commonTotal, alcoholTotal } = input;

    const chalets = this.groupByChalet(stays);
    const guestWeights = chalets.map((c) => c.guestWeight);
    const alcoholWeights = chalets.map((c) => c.alcoholWeight);

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

    return chalets.map((chalet, index) => ({
      chaletId: chalet.chaletId,
      commonCents: commonShares[index].cents,
      alcoholCents: alcoholShares[index].cents,
      totalCents: commonShares[index].add(alcoholShares[index]).cents,
    }));
  }

  /** Soma os pesos das entradas de cada chalé, preservando a ordem de entrada. */
  private groupByChalet(stays: ChaletStay[]): ChaletWeights[] {
    const byChalet = new Map<string, ChaletWeights>();
    for (const stay of stays) {
      const current = byChalet.get(stay.chaletId) ?? {
        chaletId: stay.chaletId,
        guestWeight: 0,
        alcoholWeight: 0,
      };
      current.guestWeight +=
        (stay.adults * ADULT_WEIGHT + stay.children * CHILD_WEIGHT) *
        stay.nights;
      current.alcoholWeight += stay.alcoholConsumers * stay.nights;
      byChalet.set(stay.chaletId, current);
    }
    return [...byChalet.values()];
  }
}
