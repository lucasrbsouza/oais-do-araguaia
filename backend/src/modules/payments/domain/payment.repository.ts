import { Payment } from '@prisma/client';

export interface CreatePaymentData {
  eventId: string;
  chaletId: string;
  date: Date;
  amountCents: number;
  notes?: string;
  registeredById: string;
}

export abstract class PaymentRepository {
  abstract create(data: CreatePaymentData): Promise<Payment>;
  abstract listByEvent(eventId: string): Promise<Payment[]>;
  abstract listByEventAndChalet(
    eventId: string,
    chaletId: string,
  ): Promise<Payment[]>;
}
