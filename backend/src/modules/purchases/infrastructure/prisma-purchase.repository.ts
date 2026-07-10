import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  ChaletAdvanceTotal,
  CreatePurchaseData,
  ListPurchasesFilter,
  PurchaseDetail,
  PurchaseRepository,
  UpdatePurchaseData,
} from '../domain/purchase.repository';

const DETAIL_INCLUDE = { responsible: true, chalet: true } as const;

@Injectable()
export class PrismaPurchaseRepository implements PurchaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<PurchaseDetail | null> {
    return this.prisma.purchase.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
  }

  create(data: CreatePurchaseData): Promise<PurchaseDetail> {
    return this.prisma.purchase.create({
      data,
      include: DETAIL_INCLUDE,
    });
  }

  update(id: string, data: UpdatePurchaseData): Promise<PurchaseDetail> {
    return this.prisma.purchase.update({
      where: { id },
      data,
      include: DETAIL_INCLUDE,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.purchase.delete({ where: { id } });
  }

  list(filter: ListPurchasesFilter): Promise<PurchaseDetail[]> {
    return this.prisma.purchase.findMany({
      where: {
        ...(filter.eventId ? { eventId: filter.eventId } : {}),
        ...(filter.category ? { category: filter.category } : {}),
      },
      include: DETAIL_INCLUDE,
      orderBy: { date: 'desc' },
    });
  }

  async advancesByEvent(eventId: string): Promise<ChaletAdvanceTotal[]> {
    const groups = await this.prisma.purchase.groupBy({
      by: ['chaletId'],
      where: { eventId, chaletId: { not: null } },
      _sum: { amountCents: true },
    });
    return groups.map((g) => ({
      chaletId: g.chaletId as string,
      totalCents: g._sum.amountCents ?? 0,
    }));
  }
}
