import { Injectable } from '@nestjs/common';
import { Event, EventStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { SettlementShare } from '../../settlement/domain/expense-sharing.strategy';
import {
  CreateEventData,
  EventRepository,
  ListEventsFilter,
  PaginatedEvents,
} from '../domain/event.repository';

@Injectable()
export class PrismaEventRepository implements EventRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Event | null> {
    return this.prisma.event.findUnique({ where: { id } });
  }

  create(data: CreateEventData): Promise<Event> {
    return this.prisma.event.create({ data });
  }

  update(id: string, data: Partial<CreateEventData>): Promise<Event> {
    return this.prisma.event.update({ where: { id }, data });
  }

  async list(filter: ListEventsFilter): Promise<PaginatedEvents> {
    const where = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.from ? { endDate: { gte: filter.from } } : {}),
      ...(filter.to ? { startDate: { lte: filter.to } } : {}),
    };

    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
        include: {
          _count: { select: { reservations: { where: { status: 'ACTIVE' } } } },
          purchases: { select: { amountCents: true } },
          settlement: { select: { id: true } },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events.map(({ _count, purchases, settlement, ...event }) => ({
        ...event,
        reservationCount: _count.reservations,
        purchaseTotalCents: purchases.reduce(
          (sum, p) => sum + p.amountCents,
          0,
        ),
        hasSettlement: settlement !== null,
      })),
      total,
      page: filter.page,
      perPage: filter.perPage,
    };
  }

  findOverlapping(
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  closeWithSettlement(
    eventId: string,
    strategy: string,
    shares: SettlementShare[],
    closedById: string,
  ): Promise<Event> {
    return this.prisma.$transaction(async (tx) => {
      await tx.settlement.deleteMany({ where: { eventId } });
      await tx.settlement.create({
        data: {
          eventId,
          strategy,
          computedById: closedById,
          items: {
            create: shares.map((share) => ({
              chaletId: share.chaletId,
              commonCents: share.commonCents,
              alcoholCents: share.alcoholCents,
              totalCents: share.totalCents,
            })),
          },
        },
      });

      // Contas a receber: se pagamentos + adiantamentos (compras vinculadas
      // ao chalé) superam o devido no rateio, o excedente vira crédito.
      await tx.receivable.deleteMany({ where: { eventId } });
      const [payments, advances] = await Promise.all([
        tx.payment.groupBy({
          by: ['chaletId'],
          where: { eventId },
          _sum: { amountCents: true },
        }),
        tx.purchase.groupBy({
          by: ['chaletId'],
          where: { eventId, chaletId: { not: null } },
          _sum: { amountCents: true },
        }),
      ]);
      const paidByChalet = new Map(
        payments.map((p) => [p.chaletId, p._sum.amountCents ?? 0]),
      );
      const advanceByChalet = new Map(
        advances.map((a) => [a.chaletId as string, a._sum.amountCents ?? 0]),
      );
      const credits = shares
        .map((share) => ({
          chaletId: share.chaletId,
          amountCents:
            (paidByChalet.get(share.chaletId) ?? 0) +
            (advanceByChalet.get(share.chaletId) ?? 0) -
            share.totalCents,
        }))
        .filter((credit) => credit.amountCents > 0);
      if (credits.length > 0) {
        await tx.receivable.createMany({
          data: credits.map((credit) => ({
            eventId,
            chaletId: credit.chaletId,
            amountCents: credit.amountCents,
          })),
        });
      }

      return tx.event.update({
        where: { id: eventId },
        data: { status: EventStatus.CLOSED, closedAt: new Date(), closedById },
      });
    });
  }

  reopen(eventId: string): Promise<Event> {
    return this.prisma.$transaction(async (tx) => {
      // Créditos são recalculados no próximo fechamento.
      await tx.receivable.deleteMany({ where: { eventId } });
      return tx.event.update({
        where: { id: eventId },
        data: { status: EventStatus.OPEN, closedAt: null, closedById: null },
      });
    });
  }

  cancel(eventId: string): Promise<Event> {
    return this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.CANCELLED },
    });
  }

  async hasActivity(eventId: string): Promise<boolean> {
    const [reservations, purchases, payments] = await Promise.all([
      this.prisma.reservation.count({ where: { eventId } }),
      this.prisma.purchase.count({ where: { eventId } }),
      this.prisma.payment.count({ where: { eventId } }),
    ]);
    return reservations + purchases + payments > 0;
  }

  async delete(eventId: string): Promise<void> {
    // Settlement e receivables caem por cascade.
    await this.prisma.event.delete({ where: { id: eventId } });
  }
}
