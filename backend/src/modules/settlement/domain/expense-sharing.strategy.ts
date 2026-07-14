import { Money } from '../../../shared/domain/money';

/** Peso em base 10 para evitar float: adulto = 1.0, criança (<8 anos) = 0.5 */
export const ADULT_WEIGHT = 10;
export const CHILD_WEIGHT = 5;

/** Uma entrada (check-in/check-out) de um chalé. O chalé pode ter várias. */
export interface ChaletStay {
  chaletId: string;
  adults: number;
  children: number;
  alcoholConsumers: number;
  /** Diárias da entrada; bate-volta conta 1. */
  nights: number;
}

export interface SettlementInput {
  stays: ChaletStay[];
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
