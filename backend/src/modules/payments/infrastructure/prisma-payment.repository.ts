import { Injectable } from '@nestjs/common';
import { Payment } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  CreatePaymentData,
  PaymentRepository,
} from '../domain/payment.repository';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreatePaymentData): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  listByEvent(eventId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { eventId },
      orderBy: { date: 'asc' },
    });
  }

  listByEventAndChalet(eventId: string, chaletId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { eventId, chaletId },
      orderBy: { date: 'asc' },
    });
  }
}
