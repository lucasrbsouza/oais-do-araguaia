import { Injectable } from '@nestjs/common';
import { Chalet } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  ChaletRepository,
  ChaletWithOwner,
  CreateChaletData,
  UpdateChaletData,
} from '../domain/chalet.repository';

@Injectable()
export class PrismaChaletRepository implements ChaletRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ChaletWithOwner | null> {
    return this.prisma.chalet.findUnique({
      where: { id },
      include: { owner: true },
    });
  }

  findByNumber(number: number): Promise<Chalet | null> {
    return this.prisma.chalet.findUnique({ where: { number } });
  }

  create(data: CreateChaletData): Promise<ChaletWithOwner> {
    return this.prisma.chalet.create({ data, include: { owner: true } });
  }

  update(id: string, data: UpdateChaletData): Promise<ChaletWithOwner> {
    return this.prisma.chalet.update({
      where: { id },
      data,
      include: { owner: true },
    });
  }

  list(): Promise<ChaletWithOwner[]> {
    return this.prisma.chalet.findMany({
      include: { owner: true },
      orderBy: { number: 'asc' },
    });
  }

  findByOwner(ownerId: string): Promise<Chalet[]> {
    return this.prisma.chalet.findMany({
      where: { ownerId },
      orderBy: { number: 'asc' },
    });
  }

  async hasHistory(id: string): Promise<boolean> {
    const [reservations, payments, settlementItems] =
      await this.prisma.$transaction([
        this.prisma.reservation.count({ where: { chaletId: id } }),
        this.prisma.payment.count({ where: { chaletId: id } }),
        this.prisma.settlementItem.count({ where: { chaletId: id } }),
      ]);
    return reservations + payments + settlementItems > 0;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.chalet.delete({ where: { id } });
  }
}
