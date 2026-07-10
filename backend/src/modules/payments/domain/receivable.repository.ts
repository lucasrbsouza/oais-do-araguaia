import { Chalet, Event, Receivable } from '@prisma/client';

export type ReceivableDetail = Receivable & { chalet: Chalet; event: Event };

export abstract class ReceivableRepository {
  abstract findById(id: string): Promise<ReceivableDetail | null>;
  abstract listByEvent(eventId: string): Promise<ReceivableDetail[]>;
  abstract listOpen(): Promise<ReceivableDetail[]>;
  abstract settle(id: string, notes?: string): Promise<ReceivableDetail>;
}
