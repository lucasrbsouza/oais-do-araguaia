import { Injectable } from '@nestjs/common';
import { Chalet } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  ChaletMemberDetail,
  ChaletRepository,
  ChaletWithOwner,
  CreateChaletData,
  UpdateChaletData,
} from '../domain/chalet.repository';

const defaultInclude = {
  owner: true,
  members: {
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  },
};

@Injectable()
export class PrismaChaletRepository implements ChaletRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ChaletWithOwner | null> {
    return this.prisma.chalet.findUnique({
      where: { id },
      include: defaultInclude,
    });
  }

  findByNumber(number: number): Promise<Chalet | null> {
    return this.prisma.chalet.findUnique({ where: { number } });
  }

  create(data: CreateChaletData): Promise<ChaletWithOwner> {
    return this.prisma.chalet.create({ data, include: defaultInclude });
  }

  update(id: string, data: UpdateChaletData): Promise<ChaletWithOwner> {
    return this.prisma.chalet.update({
      where: { id },
      data,
      include: defaultInclude,
    });
  }

  list(): Promise<ChaletWithOwner[]> {
    return this.prisma.chalet.findMany({
      include: defaultInclude,
      orderBy: { number: 'asc' },
    });
  }

  findByOwner(ownerId: string): Promise<Chalet[]> {
    return this.prisma.chalet.findMany({
      where: { ownerId },
      orderBy: { number: 'asc' },
    });
  }

  findAccessibleByUser(userId: string): Promise<Chalet[]> {
    return this.prisma.chalet.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { number: 'asc' },
    });
  }

  async isOwnerOrMember(userId: string, chaletId: string): Promise<boolean> {
    const chalet = await this.prisma.chalet.findFirst({
      where: {
        id: chaletId,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
    });
    return !!chalet;
  }

  async isMemberOfAnyChalet(userId: string): Promise<boolean> {
    const chalet = await this.prisma.chalet.findFirst({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
    });
    return !!chalet;
  }

  async listMembers(chaletId: string): Promise<ChaletMemberDetail[]> {
    const members = await this.prisma.chaletMember.findMany({
      where: { chaletId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      phone: m.user.phone,
      createdAt: m.createdAt,
    }));
  }

  async addMember(chaletId: string, userId: string): Promise<void> {
    await this.prisma.chaletMember.create({
      data: { chaletId, userId },
    });
  }

  async removeMember(chaletId: string, userId: string): Promise<void> {
    await this.prisma.chaletMember.deleteMany({
      where: { chaletId, userId },
    });
  }

  async countMembers(chaletId: string): Promise<number> {
    return this.prisma.chaletMember.count({ where: { chaletId } });
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
