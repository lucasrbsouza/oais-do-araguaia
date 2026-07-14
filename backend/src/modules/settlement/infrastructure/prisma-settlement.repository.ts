import { Injectable } from '@nestjs/common';
import { PurchaseCategory } from '@prisma/client';
import { nightsOf } from '../../../shared/domain/stay';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { SettlementShare } from '../domain/expense-sharing.strategy';
import {
  SettlementAutoConfig,
  SettlementCalculationInput,
  SettlementRepository,
  SettlementView,
} from '../domain/settlement.repository';
import { syncEventReceivables } from './sync-receivables';

@Injectable()
export class PrismaSettlementRepository implements SettlementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getCalculationInput(
    eventId: string,
  ): Promise<SettlementCalculationInput | null> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        reservations: { where: { status: 'ACTIVE' } },
        purchases: true,
      },
    });
    if (!event) return null;

    let commonTotalCents = 0;
    let alcoholTotalCents = 0;
    for (const purchase of event.purchases) {
      if (purchase.category === PurchaseCategory.ALCOHOL) {
        alcoholTotalCents += purchase.amountCents;
      } else {
        commonTotalCents += purchase.amountCents;
      }
    }

    return {
      eventId: event.id,
      eventStatus: event.status,
      stays: event.reservations.map((r) => ({
        chaletId: r.chaletId,
        adults: r.adults,
        children: r.children,
        alcoholConsumers: r.alcoholConsumers,
        nights: nightsOf(r),
      })),
      commonTotalCents,
      alcoholTotalCents,
    };
  }

  async save(
    eventId: string,
    strategy: string,
    shares: SettlementShare[],
    computedById: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.settlement.deleteMany({ where: { eventId } });
      await tx.settlement.create({
        data: {
          eventId,
          strategy,
          computedById,
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
      await syncEventReceivables(tx, eventId, shares);
    });
  }

  async getAutoConfig(eventId: string): Promise<SettlementAutoConfig | null> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { settlementAutoMode: true, settlementAutoMinutes: true },
    });
    if (!event) return null;
    return {
      mode: event.settlementAutoMode,
      intervalMinutes: event.settlementAutoMinutes,
    };
  }

  async setAutoConfig(
    eventId: string,
    config: SettlementAutoConfig,
    setById: string,
  ): Promise<SettlementAutoConfig> {
    const event = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        settlementAutoMode: config.mode,
        settlementAutoMinutes: config.intervalMinutes,
        settlementAutoSetById: setById,
      },
      select: { settlementAutoMode: true, settlementAutoMinutes: true },
    });
    return {
      mode: event.settlementAutoMode,
      intervalMinutes: event.settlementAutoMinutes,
    };
  }

  async findByEvent(eventId: string): Promise<SettlementView | null> {
    const settlement = await this.prisma.settlement.findUnique({
      where: { eventId },
      include: {
        items: {
          include: { chalet: true },
          orderBy: { chalet: { number: 'asc' } },
        },
      },
    });
    if (!settlement) return null;

    const items = settlement.items.map((item) => ({
      chaletId: item.chaletId,
      chaletNumber: item.chalet.number,
      chaletName: item.chalet.name,
      commonCents: item.commonCents,
      alcoholCents: item.alcoholCents,
      totalCents: item.totalCents,
    }));

    return {
      eventId: settlement.eventId,
      strategy: settlement.strategy,
      computedAt: settlement.computedAt,
      commonTotalCents: items.reduce((sum, i) => sum + i.commonCents, 0),
      alcoholTotalCents: items.reduce((sum, i) => sum + i.alcoholCents, 0),
      totalCents: items.reduce((sum, i) => sum + i.totalCents, 0),
      items,
    };
  }
}
