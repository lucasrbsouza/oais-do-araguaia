import { Chalet, Event, Receivable } from '@prisma/client';

export type ReceivableDetail = Receivable & { chalet: Chalet; event: Event };

/** Devoluções já pagas ao chalé num evento. */
export interface ChaletRefundTotal {
  chaletId: string;
  totalCents: number;
}

export abstract class ReceivableRepository {
  abstract findById(id: string): Promise<ReceivableDetail | null>;
  abstract listByEvent(eventId: string): Promise<ReceivableDetail[]>;
  abstract settledTotalsByEvent(eventId: string): Promise<ChaletRefundTotal[]>;
  abstract listOpen(): Promise<ReceivableDetail[]>;
  abstract settle(id: string, notes?: string): Promise<ReceivableDetail>;
}
