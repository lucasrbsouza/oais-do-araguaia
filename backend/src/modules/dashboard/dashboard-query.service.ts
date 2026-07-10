import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';
import {
  derivePaymentStatus,
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
    const today = new Date();

    const [chaletGroups, upcoming, lastEvent] = await Promise.all([
      this.prisma.chalet.groupBy({ by: ['status'], _count: true }),
      this.prisma.reservation.findMany({
        where: {
          status: 'ACTIVE',
          checkOut: { gte: today },
          event: { status: { not: 'CANCELLED' } },
        },
        include: { chalet: true, responsible: true },
        orderBy: { checkIn: 'asc' },
        take: 10,
      }),
      this.prisma.event.findFirst({
        where: { status: { not: 'CANCELLED' } },
        orderBy: { startDate: 'desc' },
        include: {
          purchases: { select: { amountCents: true } },
          payments: true,
          settlement: { include: { items: true } },
        },
      }),
    ]);

    const countByStatus = new Map(
      chaletGroups.map((g) => [g.status, g._count]),
    );
    const occupied = countByStatus.get('OCCUPIED') ?? 0;
    const reserved = countByStatus.get('RESERVED') ?? 0;
    const free = countByStatus.get('FREE') ?? 0;

    let lastEventSummary: DashboardSummary['lastEvent'] = null;
    if (lastEvent) {
      const paidByChalet = new Map<string, number>();
      for (const payment of lastEvent.payments) {
        paidByChalet.set(
          payment.chaletId,
          (paidByChalet.get(payment.chaletId) ?? 0) + payment.amountCents,
        );
      }
      const items = lastEvent.settlement?.items ?? [];
      const statuses = items.map((item) =>
        derivePaymentStatus(
          item.totalCents,
          paidByChalet.get(item.chaletId) ?? 0,
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
      chalets: { total: occupied + reserved + free, occupied, reserved, free },
      upcomingReservations: upcoming.map((r) => ({
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
