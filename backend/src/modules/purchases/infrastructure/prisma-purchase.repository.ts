import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  CreatePurchaseData,
  ListPurchasesFilter,
  PurchaseDetail,
  PurchaseRepository,
  UpdatePurchaseData,
} from '../domain/purchase.repository';

@Injectable()
export class PrismaPurchaseRepository implements PurchaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<PurchaseDetail | null> {
    return this.prisma.purchase.findUnique({
      where: { id },
      include: { responsible: true },
    });
  }

  create(data: CreatePurchaseData): Promise<PurchaseDetail> {
    return this.prisma.purchase.create({
      data,
      include: { responsible: true },
    });
  }

  update(id: string, data: UpdatePurchaseData): Promise<PurchaseDetail> {
    return this.prisma.purchase.update({
      where: { id },
      data,
      include: { responsible: true },
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
      include: { responsible: true },
      orderBy: { date: 'desc' },
    });
  }
}
