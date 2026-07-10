import { Injectable } from '@nestjs/common';
import { ReceivableStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  ReceivableDetail,
  ReceivableRepository,
} from '../domain/receivable.repository';

const DETAIL_INCLUDE = { chalet: true, event: true } as const;

@Injectable()
export class PrismaReceivableRepository implements ReceivableRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ReceivableDetail | null> {
    return this.prisma.receivable.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
  }

  listByEvent(eventId: string): Promise<ReceivableDetail[]> {
    return this.prisma.receivable.findMany({
      where: { eventId },
      include: DETAIL_INCLUDE,
      orderBy: { chalet: { number: 'asc' } },
    });
  }

  listOpen(): Promise<ReceivableDetail[]> {
    return this.prisma.receivable.findMany({
      where: { status: ReceivableStatus.OPEN },
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  settle(id: string, notes?: string): Promise<ReceivableDetail> {
    return this.prisma.receivable.update({
      where: { id },
      data: {
        status: ReceivableStatus.SETTLED,
        settledAt: new Date(),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: DETAIL_INCLUDE,
    });
  }
}
