import { Injectable } from '@nestjs/common';
import { ChaletStatus } from '@prisma/client';
import { todayAsUtcDate } from '../../../shared/domain/stay';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { deriveChaletStatuses } from '../domain/chalet-occupancy';

@Injectable()
export class ChaletOccupancyQuery {
  constructor(private readonly prisma: PrismaService) {}

  /** Status atual de cada chalé que tem estadia em aberto. */
  async currentStatuses(): Promise<Map<string, ChaletStatus>> {
    const today = todayAsUtcDate();
    const stays = await this.prisma.reservation.findMany({
      where: {
        status: 'ACTIVE',
        checkOut: { gte: today },
        event: { status: { not: 'CANCELLED' } },
      },
      select: { chaletId: true, checkIn: true, checkOut: true },
    });
    return deriveChaletStatuses(stays, today);
  }
}
