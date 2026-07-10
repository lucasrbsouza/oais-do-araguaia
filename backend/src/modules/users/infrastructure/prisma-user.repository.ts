import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  CreateUserData,
  UpdateUserData,
  UserRepository,
} from '../domain/user.repository';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: UpdateUserData): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  list(): Promise<User[]> {
    return this.prisma.user.findMany({ orderBy: { name: 'asc' } });
  }

  async hasHistory(id: string): Promise<boolean> {
    const [chalets, reservations, purchases, payments] = await Promise.all([
      this.prisma.chalet.count({ where: { ownerId: id } }),
      this.prisma.reservation.count({ where: { responsibleId: id } }),
      this.prisma.purchase.count({ where: { responsibleId: id } }),
      this.prisma.payment.count({ where: { registeredById: id } }),
    ]);
    return chalets + reservations + purchases + payments > 0;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
