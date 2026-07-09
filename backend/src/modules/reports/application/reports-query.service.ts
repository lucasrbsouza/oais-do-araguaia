import { Injectable } from '@nestjs/common';
import { PurchaseCategory, Role } from '@prisma/client';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../shared/domain/domain-error';
import { AuthenticatedUser } from '../../../shared/infrastructure/auth/decorators';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  derivePaymentStatus,
  PaymentStatus,
} from '../../payments/domain/payment-status';

export interface EventReport {
  event: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    status: string;
  };
  guests: { adults: number; children: number; alcoholConsumers: number };
  purchasesByCategory: Array<{
    category: PurchaseCategory;
    totalCents: number;
    count: number;
  }>;
  commonTotalCents: number;
  alcoholTotalCents: number;
  totalCents: number;
  settlement: Array<{
    chaletNumber: number;
    chaletName: string;
    commonCents: number;
    alcoholCents: number;
    totalCents: number;
    paidCents: number;
    paymentStatus: PaymentStatus;
  }> | null;
}

export interface ChaletEventReport {
  chalet: { id: string; number: number; name: string };
  event: { id: string; name: string; startDate: Date; endDate: Date };
  reservation: {
    adults: number;
    children: number;
    alcoholConsumers: number;
    checkIn: Date;
    checkOut: Date;
  } | null;
  commonCents: number;
  alcoholCents: number;
  totalCents: number;
  paidCents: number;
  paymentStatus: PaymentStatus;
  payments: Array<{ date: Date; amountCents: number; notes: string | null }>;
}

@Injectable()
export class ReportsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async eventReport(eventId: string): Promise<EventReport> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        reservations: { where: { status: 'ACTIVE' } },
        purchases: true,
        payments: true,
        settlement: {
          include: {
            items: {
              include: { chalet: true },
              orderBy: { chalet: { number: 'asc' } },
            },
          },
        },
      },
    });
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }

    const byCategory = new Map<
      PurchaseCategory,
      { totalCents: number; count: number }
    >();
    for (const purchase of event.purchases) {
      const entry = byCategory.get(purchase.category) ?? {
        totalCents: 0,
        count: 0,
      };
      entry.totalCents += purchase.amountCents;
      entry.count += 1;
      byCategory.set(purchase.category, entry);
    }

    const alcoholTotalCents =
      byCategory.get(PurchaseCategory.ALCOHOL)?.totalCents ?? 0;
    const totalCents = event.purchases.reduce(
      (sum, p) => sum + p.amountCents,
      0,
    );

    const paidByChalet = new Map<string, number>();
    for (const payment of event.payments) {
      paidByChalet.set(
        payment.chaletId,
        (paidByChalet.get(payment.chaletId) ?? 0) + payment.amountCents,
      );
    }

    return {
      event: {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
      },
      guests: {
        adults: event.reservations.reduce((sum, r) => sum + r.adults, 0),
        children: event.reservations.reduce((sum, r) => sum + r.children, 0),
        alcoholConsumers: event.reservations.reduce(
          (sum, r) => sum + r.alcoholConsumers,
          0,
        ),
      },
      purchasesByCategory: [...byCategory.entries()].map(
        ([category, entry]) => ({
          category,
          ...entry,
        }),
      ),
      commonTotalCents: totalCents - alcoholTotalCents,
      alcoholTotalCents,
      totalCents,
      settlement:
        event.settlement?.items.map((item) => {
          const paidCents = paidByChalet.get(item.chaletId) ?? 0;
          return {
            chaletNumber: item.chalet.number,
            chaletName: item.chalet.name,
            commonCents: item.commonCents,
            alcoholCents: item.alcoholCents,
            totalCents: item.totalCents,
            paidCents,
            paymentStatus: derivePaymentStatus(item.totalCents, paidCents),
          };
        }) ?? null,
    };
  }

  async chaletEventReport(
    chaletId: string,
    eventId: string,
    user: AuthenticatedUser,
  ): Promise<ChaletEventReport> {
    const chalet = await this.prisma.chalet.findUnique({
      where: { id: chaletId },
    });
    if (!chalet) {
      throw new NotFoundError('Chalé não encontrado.');
    }
    if (user.role !== Role.ADMIN && chalet.ownerId !== user.id) {
      throw new ForbiddenError(
        'Você só pode ver relatórios do seu próprio chalé.',
      );
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        reservations: { where: { chaletId, status: 'ACTIVE' } },
        payments: { where: { chaletId }, orderBy: { date: 'asc' } },
        settlement: { include: { items: { where: { chaletId } } } },
      },
    });
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }

    const item = event.settlement?.items[0];
    const reservation = event.reservations[0] ?? null;
    const paidCents = event.payments.reduce((sum, p) => sum + p.amountCents, 0);
    const totalCents = item?.totalCents ?? 0;

    return {
      chalet: { id: chalet.id, number: chalet.number, name: chalet.name },
      event: {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
      },
      reservation: reservation
        ? {
            adults: reservation.adults,
            children: reservation.children,
            alcoholConsumers: reservation.alcoholConsumers,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
          }
        : null,
      commonCents: item?.commonCents ?? 0,
      alcoholCents: item?.alcoholCents ?? 0,
      totalCents,
      paidCents,
      paymentStatus: derivePaymentStatus(totalCents, paidCents),
      payments: event.payments.map((p) => ({
        date: p.date,
        amountCents: p.amountCents,
        notes: p.notes,
      })),
    };
  }
}
