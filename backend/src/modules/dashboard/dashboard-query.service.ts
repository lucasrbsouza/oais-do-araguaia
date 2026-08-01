import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';
import { todayAsUtcDate } from '../../shared/domain/stay';
import { deriveChaletStatuses } from '../chalets/domain/chalet-occupancy';
import {
  derivePaymentStatus,
  netPaidCents,
  PaymentStatus,
} from '../payments/domain/payment-status';

export interface DashboardSummary {
  chalets: { total: number; occupied: number; reserved: number; free: number };
  upcomingReservations: Array<{
    id: string;
    chaletNumber: number;
    chaletName: string;
    responsibleName: string;
    checkIn: Date;
    checkOut: Date;
  }>;
  lastEvent: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    status: string;
    purchaseTotalCents: number;
    settlementTotalCents: number | null;
    pendingChalets: number;
    paidChalets: number;
  } | null;
}

@Injectable()
export class DashboardQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<DashboardSummary> {
    const today = todayAsUtcDate();

    const [totalChalets, currentStays, lastEvent] = await Promise.all([
      this.prisma.chalet.count(),
      this.prisma.reservation.findMany({
        where: {
          status: 'ACTIVE',
          checkOut: { gte: today },
          event: { status: { not: 'CANCELLED' } },
        },
        include: { chalet: true, responsible: true },
        orderBy: { checkIn: 'asc' },
      }),
      this.prisma.event.findFirst({
        where: { status: { not: 'CANCELLED' } },
        orderBy: { startDate: 'desc' },
        include: {
          purchases: { select: { amountCents: true } },
          payments: true,
          receivables: { where: { status: 'SETTLED' } },
          settlement: { include: { items: true } },
        },
      }),
    ]);

    // Mesma regra da tela de Chalés: ocupação sai das reservas, não de campo
    // editado à mão.
    const statuses = deriveChaletStatuses(currentStays, today);
    let occupied = 0;
    let reserved = 0;
    for (const status of statuses.values()) {
      if (status === 'OCCUPIED') occupied += 1;
      else reserved += 1;
    }
    const free = Math.max(0, totalChalets - occupied - reserved);

    let lastEventSummary: DashboardSummary['lastEvent'] = null;
    if (lastEvent) {
      const paidByChalet = new Map<string, number>();
      for (const payment of lastEvent.payments) {
        paidByChalet.set(
          payment.chaletId,
          (paidByChalet.get(payment.chaletId) ?? 0) + payment.amountCents,
        );
      }
      const refundByChalet = new Map<string, number>();
      for (const receivable of lastEvent.receivables) {
        refundByChalet.set(
          receivable.chaletId,
          (refundByChalet.get(receivable.chaletId) ?? 0) +
            receivable.amountCents,
        );
      }
      const items = lastEvent.settlement?.items ?? [];
      const statuses = items.map((item) =>
        derivePaymentStatus(
          item.totalCents,
          netPaidCents(
            paidByChalet.get(item.chaletId) ?? 0,
            0,
            refundByChalet.get(item.chaletId) ?? 0,
          ),
        ),
      );
      lastEventSummary = {
        id: lastEvent.id,
        name: lastEvent.name,
        startDate: lastEvent.startDate,
        endDate: lastEvent.endDate,
        status: lastEvent.status,
        purchaseTotalCents: lastEvent.purchases.reduce(
          (sum, p) => sum + p.amountCents,
          0,
        ),
        settlementTotalCents: lastEvent.settlement
          ? items.reduce((sum, i) => sum + i.totalCents, 0)
          : null,
        pendingChalets: statuses.filter((s) => s !== PaymentStatus.PAID).length,
        paidChalets: statuses.filter((s) => s === PaymentStatus.PAID).length,
      };
    }

    return {
      chalets: { total: totalChalets, occupied, reserved, free },
      upcomingReservations: currentStays.slice(0, 10).map((r) => ({
        id: r.id,
        chaletNumber: r.chalet.number,
        chaletName: r.chalet.name,
        responsibleName: r.responsible.name,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
      })),
      lastEvent: lastEventSummary,
    };
  }
}
