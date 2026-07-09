import { Money } from '../../../shared/domain/money';

/** Peso em base 10 para evitar float: adulto = 1.0, criança (<8 anos) = 0.5 */
export const ADULT_WEIGHT = 10;
export const CHILD_WEIGHT = 5;

export interface ChaletOccupancy {
  chaletId: string;
  adults: number;
  children: number;
  alcoholConsumers: number;
}

export interface SettlementInput {
  occupancies: ChaletOccupancy[];
  commonTotal: Money;
  alcoholTotal: Money;
}

export interface SettlementShare {
  chaletId: string;
  commonCents: number;
  alcoholCents: number;
  totalCents: number;
}

export abstract class ExpenseSharingStrategy {
  abstract readonly name: string;
  abstract calculate(input: SettlementInput): SettlementShare[];
}
