import { EventStatus } from '@prisma/client';
import { ChaletOccupancy, SettlementShare } from './expense-sharing.strategy';

export interface SettlementCalculationInput {
  eventId: string;
  eventStatus: EventStatus;
  occupancies: ChaletOccupancy[];
  commonTotalCents: number;
  alcoholTotalCents: number;
}

export interface SettlementItemView {
  chaletId: string;
  chaletNumber: number;
  chaletName: string;
  commonCents: number;
  alcoholCents: number;
  totalCents: number;
}

export interface SettlementView {
  eventId: string;
  strategy: string;
  computedAt: Date;
  commonTotalCents: number;
  alcoholTotalCents: number;
  totalCents: number;
  items: SettlementItemView[];
}

export abstract class SettlementRepository {
  abstract getCalculationInput(
    eventId: string,
  ): Promise<SettlementCalculationInput | null>;
  abstract save(
    eventId: string,
    strategy: string,
    shares: SettlementShare[],
    computedById: string,
  ): Promise<void>;
  abstract findByEvent(eventId: string): Promise<SettlementView | null>;
}
